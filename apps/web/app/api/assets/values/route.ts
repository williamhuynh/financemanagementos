import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { getWorkspaceById } from "../../../../lib/workspace-service";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { validateBody, AssetValuesCreateSchema } from "../../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../../lib/audit";

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

async function fetchHomeCurrencyRate(fromCurrency: string, homeCurrency: string) {
  const normalizedFrom = fromCurrency.toUpperCase();
  const normalizedHome = homeCurrency.toUpperCase();
  if (normalizedFrom === normalizedHome) {
    return { rate: 1, source: "local" };
  }
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) {
    throw new Error("Missing OPEN_EXCHANGE_RATES_APP_ID.");
  }

  // openexchangerates uses USD as base — fetch both currencies relative to USD
  const symbols = new Set([normalizedFrom, normalizedHome]);
  symbols.delete("USD"); // USD is always the base, no need to request it
  const symbolsParam = Array.from(symbols).join(",");

  const url = new URL("https://openexchangerates.org/api/latest.json");
  url.searchParams.set("app_id", appId);
  if (symbolsParam) {
    url.searchParams.set("symbols", symbolsParam);
  }

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    throw new Error(`openexchangerates.org (${response.status})`);
  }
  const data = (await response.json()) as { rates?: Record<string, number> };
  const rates = data.rates ?? {};

  // USD base rate is implicitly 1
  const homeRate = normalizedHome === "USD" ? 1 : rates[normalizedHome];
  const fromRate = normalizedFrom === "USD" ? 1 : rates[normalizedFrom];

  if (!homeRate || !Number.isFinite(homeRate)) {
    throw new Error(`openexchangerates.org (missing ${normalizedHome} rate)`);
  }
  if (!fromRate || !Number.isFinite(fromRate)) {
    throw new Error(`openexchangerates.org (missing ${normalizedFrom} rate)`);
  }

  // Cross rate: how many home currency units per 1 fromCurrency unit
  return { rate: homeRate / fromRate, source: "openexchangerates.org" };
}

export async function POST(request: Request) {
  try {
    const blocked = rateLimit(request, DATA_RATE_LIMITS.write);
    if (blocked) return blocked;

    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check write permission
    await requireWorkspacePermission(workspaceId, user.$id, 'write');

    const body = await request.json();
    const parsed = validateBody(AssetValuesCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { items, recordedAt: rawRecordedAt } = parsed.data;

    const recordedAt = rawRecordedAt?.trim() || new Date().toISOString();

    // Fetch workspace to determine home currency
    const workspace = await getWorkspaceById(workspaceId);
    const homeCurrency = workspace?.currency ?? "AUD";

    let created = 0;
    const rateCache = new Map<string, { rate: number; source: string }>();
    for (const item of items) {
      if (!item.assetName || !Number.isFinite(item.value)) {
        continue;
      }
      const currency = (item.currency ?? homeCurrency).toUpperCase();
      let rate = rateCache.get(currency);
      if (!rate) {
        try {
          rate = await fetchHomeCurrencyRate(currency, homeCurrency);
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
      const homeValue = item.value * rate.rate;
      await databases.createDocument(config.databaseId, "asset_values", ID.unique(), {
        workspace_id: workspaceId,
        asset_id: item.assetId ?? "",
        asset_name: item.assetName,
        asset_type: item.assetType,
        value: String(item.value),
        currency,
        original_value: String(item.value),
        original_currency: currency,
        value_aud: String(homeValue),
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

    // Fire-and-forget audit log
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "asset_value",
      resource_id: workspaceId,
      summary: `Created ${created} asset value(s)`,
      metadata: { count: created, recordedAt },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Asset values POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
