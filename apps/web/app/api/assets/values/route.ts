import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";

type AssetValuePayload = {
  assetId?: string;
  assetName: string;
  assetType: string;
  value: number;
  currency?: string;
  source?: string;
  notes?: string;
};

async function fetchWithTimeout(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAudRate(currency: string) {
  const normalized = currency.toUpperCase();
  if (normalized === "AUD") {
    return { rate: 1, source: "local" };
  }
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) {
    throw new Error("Missing OPEN_EXCHANGE_RATES_APP_ID.");
  }

  const url = new URL("https://openexchangerates.org/api/latest.json");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("symbols", normalized === "USD" ? "AUD" : `${normalized},AUD`);

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    throw new Error(`openexchangerates.org (${response.status})`);
  }
  const data = (await response.json()) as { rates?: Record<string, number> };
  const rates = data.rates ?? {};
  const audRate = rates.AUD;
  if (!audRate || !Number.isFinite(audRate)) {
    throw new Error("openexchangerates.org (missing AUD rate)");
  }
  if (normalized === "USD") {
    return { rate: audRate, source: "openexchangerates.org" };
  }
  const baseRate = rates[normalized];
  if (!baseRate || !Number.isFinite(baseRate)) {
    throw new Error(`openexchangerates.org (missing ${normalized} rate)`);
  }
  return { rate: audRate / baseRate, source: "openexchangerates.org" };
}

export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;

  const body = (await request.json()) as {
    recordedAt?: string;
    items?: AssetValuePayload[];
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json(
      { detail: "No asset values provided." },
      { status: 400 }
    );
  }

  const recordedAt = body.recordedAt?.trim() || new Date().toISOString();

  let created = 0;
  const rateCache = new Map<string, { rate: number; source: string }>();
  for (const item of items) {
    if (!item.assetName || !Number.isFinite(item.value)) {
      continue;
    }
    const currency = (item.currency ?? "AUD").toUpperCase();
    let rate = rateCache.get(currency);
    if (!rate) {
      try {
        rate = await fetchAudRate(currency);
      } catch (error) {
        return NextResponse.json(
          {
            detail:
              error instanceof Error
                ? error.message
                : `Unable to fetch FX rate for ${currency}.`
          },
          { status: 502 }
        );
      }
      rateCache.set(currency, rate);
    }
    const audValue = item.value * rate.rate;
    await databases.createDocument(config.databaseId, "asset_values", ID.unique(), {
      workspace_id: workspaceId,
      asset_id: item.assetId ?? "",
      asset_name: item.assetName,
      asset_type: item.assetType,
      value: String(item.value),
      currency,
      original_value: String(item.value),
      original_currency: currency,
      value_aud: String(audValue),
      fx_rate: String(rate.rate),
      fx_source: rate.source,
      recorded_at: recordedAt,
      source: item.source ?? "manual",
      notes: item.notes ?? ""
    });
    created += 1;
  }

  if (created === 0) {
    return NextResponse.json(
      { detail: "No valid asset values provided." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, created });
}
