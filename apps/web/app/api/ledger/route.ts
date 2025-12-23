import { NextResponse } from "next/server";
import {
  getLedgerRowsWithTotal,
  type LedgerFilterParams
} from "../../../lib/data";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitRaw = parseNumber(searchParams.get("limit"), DEFAULT_LIMIT);
  const offsetRaw = parseNumber(searchParams.get("offset"), 0);
  const limit = Math.max(1, Math.min(limitRaw, MAX_LIMIT));
  const offset = Math.max(0, offsetRaw);

  const account = searchParams.get("account") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const amount = searchParams.get("amount") ?? undefined;
  const month = searchParams.get("month") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;

  const result = await getLedgerRowsWithTotal({
    limit,
    offset,
    account,
    category,
    amount: amount as LedgerFilterParams["amount"],
    month,
    sort: sort as LedgerFilterParams["sort"]
  });

  return NextResponse.json({
    items: result.rows,
    total: result.total,
    nextOffset: offset + result.rows.length,
    hasMore: result.hasMore
  });
}
