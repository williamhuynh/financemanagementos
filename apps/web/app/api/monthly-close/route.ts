import { NextResponse } from "next/server";
import { Databases, ID, Query } from "node-appwrite";
import { buildMonthlySnapshotPayload, getMonthlyCloseSummary } from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";

function isValidMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

async function getCloseDocument(
  databases: Databases,
  databaseId: string,
  workspaceId: string,
  month: string
) {
  const response = await databases.listDocuments(databaseId, "monthly_closes", [
    Query.equal("workspace_id", workspaceId),
    Query.equal("month", month),
    Query.limit(1)
  ]);
  return response?.documents?.[0] ?? null;
}

async function createMonthlySnapshot(
  databases: Databases,
  databaseId: string,
  payload: Record<string, unknown>
) {
  return await databases.createDocument(
    databaseId,
    "monthly_snapshots",
    ID.unique(),
    payload
  );
}

function getSchemaHintMessage(databaseId: string, projectId: string) {
  return `Schema mismatch: check APPWRITE_DATABASE_ID (${databaseId}) and APPWRITE_PROJECT_ID (${projectId}).`;
}

async function listCollectionAttributes(
  databases: Databases,
  databaseId: string,
  collectionId: string
) {
  try {
    const response = await databases.listAttributes(databaseId, collectionId);
    return (response?.attributes ?? []).map((attr) => ({
      key: attr.key,
      status: attr.status,
      type: attr.type
    }));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    // Authentication and workspace context
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, workspaceId } = ctx;

    // Verify user has read permission
    await requireWorkspacePermission(workspaceId, user.$id, 'read');

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? "";
    if (month && !isValidMonth(month)) {
      return NextResponse.json({ detail: "Invalid month format." }, { status: 400 });
    }
    const summary = await getMonthlyCloseSummary(workspaceId, month || undefined);
    return NextResponse.json(summary);
  } catch (error: any) {
    if (error.message?.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (error.message?.includes('Insufficient permission')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('Monthly close GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly close summary' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Monthly close requires admin permission
    await requireWorkspacePermission(workspaceId, user.$id, 'admin');

    const body = (await request.json()) as { month?: string; notes?: string };
    const month = body.month?.trim() ?? "";
    if (!isValidMonth(month)) {
      return NextResponse.json({ detail: "Invalid month format." }, { status: 400 });
    }

    const snapshotPayload = await buildMonthlySnapshotPayload(workspaceId, month);
  if (!snapshotPayload) {
    return NextResponse.json(
      { detail: "Unable to build monthly snapshot." },
      { status: 500 }
    );
  }

  let snapshot;
  try {
    snapshot = await createMonthlySnapshot(
      databases,
      config.databaseId,
      snapshotPayload
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create snapshot.";
    const attributes = await listCollectionAttributes(
      databases,
      config.databaseId,
      "monthly_snapshots"
    );
    const pendingAttributes = (attributes ?? []).filter(
      (attr) => attr.status && attr.status !== "available"
    );
    console.error("Monthly close snapshot failed.", {
      message,
      databaseId: config.databaseId,
      projectId: config.projectId,
      attributes,
      pendingAttributes
    });
    return NextResponse.json(
      {
        detail: message,
        hint: getSchemaHintMessage(config.databaseId, config.projectId),
        attributes,
        pendingAttributes
      },
      { status: 500 }
    );
  }

  const existing = await getCloseDocument(databases, config.databaseId, workspaceId, month);
  const updatePayload = {
    workspace_id: workspaceId,
    month,
    status: "closed",
    closed_at: new Date().toISOString(),
    closed_by: "system",
    notes: body.notes ?? "",
    snapshot_id: String(snapshot.$id ?? "")
  };

  if (existing) {
    await databases.updateDocument(
      config.databaseId,
      "monthly_closes",
      String(existing.$id),
      updatePayload
    );
  } else {
    await databases.createDocument(
      config.databaseId,
      "monthly_closes",
      ID.unique(),
      updatePayload
    );
  }

    return NextResponse.json({ ok: true, status: "closed", snapshotId: snapshot.$id });
  } catch (error: any) {
    if (error.message?.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (error.message?.includes('Insufficient permission')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('Monthly close POST error:', error);
    return NextResponse.json(
      { error: 'Failed to close month' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Reopening month requires admin permission
    await requireWorkspacePermission(workspaceId, user.$id, 'admin');

    const body = (await request.json()) as { month?: string; notes?: string };
    const month = body.month?.trim() ?? "";
    if (!isValidMonth(month)) {
      return NextResponse.json({ detail: "Invalid month format." }, { status: 400 });
    }

  const existing = await getCloseDocument(databases, config.databaseId, workspaceId, month);
  if (!existing) {
    await databases.createDocument(config.databaseId, "monthly_closes", ID.unique(), {
      workspace_id: workspaceId,
      month,
      status: "open",
      reopened_at: new Date().toISOString(),
      reopened_by: "system",
      notes: body.notes ?? ""
    });
    return NextResponse.json({ ok: true, status: "open" });
  }

    await databases.updateDocument(
      config.databaseId,
      "monthly_closes",
      String(existing.$id),
      {
        status: "open",
        reopened_at: new Date().toISOString(),
        reopened_by: "system",
        notes: body.notes ?? ""
      }
    );

    return NextResponse.json({ ok: true, status: "open" });
  } catch (error: any) {
    if (error.message?.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (error.message?.includes('Insufficient permission')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('Monthly close PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to reopen month' },
      { status: 500 }
    );
  }
}
