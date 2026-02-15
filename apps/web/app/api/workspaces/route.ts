import { NextResponse } from "next/server";
import { Client, Databases, Query, ID } from "node-appwrite";
import { getServerConfig, createSessionClient } from "../../../lib/api-auth";
import { DEFAULT_CATEGORIES } from "../../../lib/categories";
import { COLLECTIONS } from "../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, WorkspaceCreateSchema } from "../../../lib/validations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/workspaces - Get all workspaces for the current user
 *
 * Production-ready approach: Uses session cookies (set by Appwrite) instead of localStorage.
 */
export async function GET(request: Request) {
  const blocked = rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    // Create session client from cookies (secure, production-ready)
    const session = await createSessionClient();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the authenticated user
    const user = await session.account.get();

    // Use the server API key for database operations (bypasses permissions)
    const config = getServerConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Missing Appwrite server configuration." },
        { status: 500 }
      );
    }

    const adminClient = new Client();
    adminClient.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
    const databases = new Databases(adminClient);

    // Get all memberships for user
    const memberships = await databases.listDocuments(
      session.databaseId,
      "workspace_members",
      [Query.equal("user_id", user.$id), Query.limit(100)]
    );

    if (memberships.documents.length === 0) {
      return NextResponse.json({ workspaces: [], currentWorkspaceId: null });
    }

    // Get user's stored workspace preference
    const prefs = await session.account.getPrefs();
    const storedWorkspaceId = prefs.activeWorkspaceId as string | undefined;

    // Get workspace details
    const workspaces = [];
    for (const membership of memberships.documents) {
      try {
        const workspace = await databases.getDocument(
          session.databaseId,
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

    // Return stored preference if valid, otherwise fall back to first workspace
    const isStoredWorkspaceValid = storedWorkspaceId && workspaces.some(w => w.id === storedWorkspaceId);
    const currentWorkspaceId = isStoredWorkspaceValid ? storedWorkspaceId : (workspaces.length > 0 ? workspaces[0].id : null);

    return NextResponse.json({
      workspaces,
      currentWorkspaceId
    });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}

/**
 * POST /api/workspaces - Create a new workspace
 *
 * Production-ready approach: Uses session cookies (set by Appwrite) instead of localStorage.
 * This is secure and works with HttpOnly cookies.
 */
export async function POST(request: Request) {
  const blocked = rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const session = await createSessionClient();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 });
    }

    const user = await session.account.get();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = validateBody(WorkspaceCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { name, currency } = parsed.data;

    const config = getServerConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Missing Appwrite server configuration." },
        { status: 500 }
      );
    }

    const adminClient = new Client();
    adminClient.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
    const databases = new Databases(adminClient);

    const workspaceId = ID.unique();
    const workspace = await databases.createDocument(
      session.databaseId,
      "workspaces",
      workspaceId,
      {
        name,
        currency,
        owner_id: user.$id
      }
    );

    await databases.createDocument(
      session.databaseId,
      "workspace_members",
      ID.unique(),
      {
        workspace_id: workspaceId,
        user_id: user.$id,
        role: "owner"
      }
    );

    // Seed default categories for the new workspace
    let seedFailures = 0;
    for (const cat of DEFAULT_CATEGORIES) {
      try {
        await databases.createDocument(
          session.databaseId,
          COLLECTIONS.CATEGORIES,
          ID.unique(),
          {
            workspace_id: workspaceId,
            name: cat.name,
            group: cat.group ?? "",
            color: "",
          }
        );
      } catch (seedError) {
        seedFailures++;
        console.error(`Failed to seed category "${cat.name}" for workspace ${workspaceId}:`, seedError);
      }
    }
    if (seedFailures > 0) {
      console.error(
        `Category seeding incomplete for workspace ${workspaceId}: ${seedFailures}/${DEFAULT_CATEGORIES.length} failed. Lazy seed will repair on first GET /api/categories.`
      );
    }

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
    console.error("Workspace creation error:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
