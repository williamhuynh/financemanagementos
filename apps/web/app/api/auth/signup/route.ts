import { NextResponse } from "next/server";
import { Client, Account, ID, Databases } from "node-appwrite";
import { getSession } from "../../../../lib/session";
import { COLLECTIONS } from "../../../../lib/collection-names";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup - Create user account and session
 */
export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      return NextResponse.json(
        { error: "Appwrite configuration missing" },
        { status: 500 }
      );
    }

    const apiKey = process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create admin client with API key - required to get session secret
    const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

    if (!databaseId) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    const adminAccount = new Account(adminClient);
    const adminDatabases = new Databases(adminClient);

    // Create user account
    await adminAccount.create(ID.unique(), email, password, name);

    // Create session using admin client
    const appwriteSession = await adminAccount.createEmailPasswordSession(email, password);

    // Create session client to get user info
    const sessionClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setSession(appwriteSession.secret);
    const sessionAccount = new Account(sessionClient);
    const user = await sessionAccount.get();

    // Create default workspace for new user
    const workspaceId = ID.unique();

    try {
      // 1. Create workspace
      await adminDatabases.createDocument(
        databaseId,
        COLLECTIONS.WORKSPACES,
        workspaceId,
        {
          name: `${user.name}'s Workspace`,
          currency: 'USD',
          owner_id: user.$id,
        }
      );

      // 2. Add user as owner in workspace_members
      await adminDatabases.createDocument(
        databaseId,
        COLLECTIONS.WORKSPACE_MEMBERS,
        ID.unique(),
        {
          workspace_id: workspaceId,
          user_id: user.$id,
          role: 'owner',
        }
      );

      // 3. Set active workspace preference
      await sessionAccount.updatePrefs({ activeWorkspaceId: workspaceId });
    } catch (workspaceError) {
      console.error("Error creating workspace for new user:", workspaceError);
      // Continue anyway - workspace can be created later
    }

    // Store session server-side (encrypted, HttpOnly cookie)
    const session = await getSession();
    session.appwriteSession = appwriteSession.secret;
    session.userId = user.$id;
    session.email = user.email;
    session.name = user.name;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
