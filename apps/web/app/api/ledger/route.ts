import { NextResponse } from "next/server";
import {
  getLedgerRowsWithTotal,
  type LedgerFilterParams
} from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  try {
    const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
    if (blocked) return blocked;

    // Authentication and workspace context
    const context = await getApiContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, workspaceId } = context;

    // Verify user has read permission
    await requireWorkspacePermission(workspaceId, user.$id, 'read');

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

    const result = await getLedgerRowsWithTotal(workspaceId, {
      limit,
      offset,
      account,
      category,
      amount: amount as LedgerFilterParams["amount"],
      month,
      sort: sort as LedgerFilterParams["sort"]
    });

    return NextResponse.json(
      {
        items: result.rows,
        total: result.total,
        nextOffset: offset + result.rows.length,
        hasMore: result.hasMore
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  } catch (error: any) {
    if (error.message?.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (error.message?.includes('Insufficient permission')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('Ledger GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ledger data' },
      { status: 500 }
    );
  }
}
