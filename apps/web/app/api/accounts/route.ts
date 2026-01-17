import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;
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
}
