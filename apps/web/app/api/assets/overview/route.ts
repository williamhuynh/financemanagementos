import { NextResponse } from "next/server";
import { getAssetOverview } from "../../../../lib/data";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { getWorkspaceById } from "../../../../lib/workspace-service";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    const workspace = await getWorkspaceById(workspaceId);
    const homeCurrency = workspace?.currency ?? "AUD";
    const overview = await getAssetOverview(workspaceId, homeCurrency);
    return NextResponse.json(overview, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error: any) {
    if (error.message?.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (error.message?.includes('Insufficient permission')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('Assets overview GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset overview' },
      { status: 500 }
    );
  }
}
