import { NextResponse } from "next/server";
import { Client, Databases, ID, Query } from "node-appwrite";
import { buildMonthlySnapshotPayload, getMonthlyCloseSummary } from "../../../lib/data";

const DEFAULT_WORKSPACE_ID = "default";

function getServerConfig() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return null;
  }
  return { endpoint, projectId, databaseId, apiKey };
}

function isValidMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

async function getCloseDocument(databases: Databases, databaseId: string, month: string) {
  const response = await databases.listDocuments(databaseId, "monthly_closes", [
    Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
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
  } catch (error) {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? "";
  if (month && !isValidMonth(month)) {
    return NextResponse.json({ detail: "Invalid month format." }, { status: 400 });
  }
  const summary = await getMonthlyCloseSummary(month || undefined);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  const config = getServerConfig();
  if (!config) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as { month?: string; notes?: string };
  const month = body.month?.trim() ?? "";
  if (!isValidMonth(month)) {
    return NextResponse.json({ detail: "Invalid month format." }, { status: 400 });
  }

  const snapshotPayload = await buildMonthlySnapshotPayload(month);
  if (!snapshotPayload) {
    return NextResponse.json(
      { detail: "Unable to build monthly snapshot." },
      { status: 500 }
    );
  }

  const client = new Client();
  client.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
  const databases = new Databases(client);

  let snapshot;
  try {
    console.log("Monthly close snapshot payload keys", {
      keys: Object.keys(snapshotPayload)
    });
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

  const existing = await getCloseDocument(databases, config.databaseId, month);
  const updatePayload = {
    workspace_id: DEFAULT_WORKSPACE_ID,
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
}

export async function PATCH(request: Request) {
  const config = getServerConfig();
  if (!config) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as { month?: string; notes?: string };
  const month = body.month?.trim() ?? "";
  if (!isValidMonth(month)) {
    return NextResponse.json({ detail: "Invalid month format." }, { status: 400 });
  }

  const client = new Client();
  client.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
  const databases = new Databases(client);

  const existing = await getCloseDocument(databases, config.databaseId, month);
  if (!existing) {
    await databases.createDocument(config.databaseId, "monthly_closes", ID.unique(), {
      workspace_id: DEFAULT_WORKSPACE_ID,
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
}
