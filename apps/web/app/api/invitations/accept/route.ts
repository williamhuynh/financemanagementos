import { NextResponse } from "next/server";
import { Client, Databases, Account } from "node-appwrite";
import { verifyInvitationToken, acceptInvitation } from "../../../../lib/invitation-service";
import { createSessionClient } from "../../../../lib/api-auth";
import { rateLimit, AUTH_RATE_LIMITS } from "../../../../lib/rate-limit";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const apiKey = process.env.APPWRITE_API_KEY!;

/**
 * POST /api/invitations/accept
 * Accept an invitation and join the workspace
 * Requires authentication
 */
export async function POST(request: Request) {
  const blocked = rateLimit(request, AUTH_RATE_LIMITS.invitation);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Get the authenticated user
    const sessionClient = await createSessionClient();
    if (!sessionClient) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await sessionClient.account.get();

    // Use API key client for database operations
    const client = new Client();
    client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);

    // Verify the invitation token
    const invitation = await verifyInvitationToken(databases, databaseId, token);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Verify email matches (optional but recommended for security)
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
      );
    }

    // Accept the invitation
    await acceptInvitation(databases, databaseId, invitation, user.$id);

    // Switch user to the new workspace
    await sessionClient.account.updatePrefs({
      activeWorkspaceId: invitation.workspace_id,
    });

    return NextResponse.json({
      success: true,
      workspaceId: invitation.workspace_id,
    });
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
