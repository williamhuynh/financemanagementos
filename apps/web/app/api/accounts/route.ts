import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const blocked = rateLimit(request, DATA_RATE_LIMITS.read);
    if (blocked) return blocked;

    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check read permission
    await requireWorkspacePermission(workspaceId, user.$id, 'read');

    const names = new Set<string>();
    let offset = 0;

    while (true) {
      const response = await databases.listDocuments(config.databaseId, "transactions", [
        Query.equal("workspace_id", workspaceId),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
        Query.offset(offset)
      ]);
      const documents = response?.documents ?? [];
      for (const doc of documents) {
        const name = String(doc.account_name ?? "").trim();
        if (name) {
          names.add(name);
        }
      }
      offset += documents.length;
      if (documents.length === 0 || offset >= (response?.total ?? 0)) {
        break;
      }
    }

    return NextResponse.json(
      {
        accounts: Array.from(names).sort((a, b) => a.localeCompare(b))
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Accounts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
