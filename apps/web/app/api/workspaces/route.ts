import { NextRequest, NextResponse } from "next/server";
import { Client, Account, Databases, Query, ID } from "node-appwrite";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

async function getCurrentUser(config: { endpoint: string; projectId: string }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(`a_session_${config.projectId}`);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const client = new Client();
    client.setEndpoint(config.endpoint).setProject(config.projectId);
    client.setSession(sessionCookie.value);

    const account = new Account(client);
    return await account.get();
  } catch {
    return null;
  }
}

/**
 * GET /api/workspaces - Get all workspaces for the current user
 */
export async function GET() {
  const config = getServerConfig();
  if (!config) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const user = await getCurrentUser(config);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const client = new Client();
  client.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
  const databases = new Databases(client);

  try {
    // Get all memberships for user
    const memberships = await databases.listDocuments(
      config.databaseId,
      "workspace_members",
      [Query.equal("user_id", user.$id), Query.limit(100)]
    );

    if (memberships.documents.length === 0) {
      return NextResponse.json({ workspaces: [], currentWorkspaceId: null });
    }

    // Get workspace details
    const workspaces = [];
    for (const membership of memberships.documents) {
      try {
        const workspace = await databases.getDocument(
          config.databaseId,
          "workspaces",
          membership.workspace_id as string
        );
        workspaces.push({
          id: workspace.$id,
          name: workspace.name,
          currency: workspace.currency,
          owner_id: workspace.owner_id,
          role: membership.role
        });
      } catch {
        // Skip workspaces that no longer exist
        continue;
      }
    }

    // Return first workspace as current (later can add preference storage)
    const currentWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null;

    return NextResponse.json({
      workspaces,
      currentWorkspaceId
    });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json({ detail: "Failed to fetch workspaces" }, { status: 500 });
  }
}

/**
 * POST /api/workspaces - Create a new workspace
 */
export async function POST(request: NextRequest) {
  const config = getServerConfig();
  if (!config) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const user = await getCurrentUser(config);
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; currency?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const currency = body.currency?.trim() || "AUD";

  if (!name) {
    return NextResponse.json({ detail: "Workspace name is required" }, { status: 400 });
  }

  const client = new Client();
  client.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
  const databases = new Databases(client);

  try {
    // Create the workspace
    const workspaceId = ID.unique();
    const workspace = await databases.createDocument(
      config.databaseId,
      "workspaces",
      workspaceId,
      {
        name,
        currency,
        owner_id: user.$id
      }
    );

    // Add user as owner member
    await databases.createDocument(
      config.databaseId,
      "workspace_members",
      ID.unique(),
      {
        workspace_id: workspaceId,
        user_id: user.$id,
        role: "owner"
      }
    );

    return NextResponse.json({
      workspace: {
        id: workspace.$id,
        name: workspace.name,
        currency: workspace.currency,
        owner_id: workspace.owner_id,
        role: "owner"
      }
    });
  } catch (error) {
    console.error("Error creating workspace:", error);
    return NextResponse.json({ detail: "Failed to create workspace" }, { status: 500 });
  }
}
