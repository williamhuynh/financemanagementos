import { NextResponse } from "next/server";
import { Client, Databases } from "node-appwrite";
import { verifyInvitationToken } from "../../../../lib/invitation-service";
import { COLLECTIONS } from "../../../../lib/collection-names";
import { rateLimit, AUTH_RATE_LIMITS } from "../../../../lib/rate-limit";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const apiKey = process.env.APPWRITE_API_KEY!;

/**
 * GET /api/invitations/verify?token=xxx
 * Verify an invitation token and return invitation details
 * This is a public endpoint (no auth required) for displaying invitation info
 */
export async function GET(request: Request) {
  const blocked = rateLimit(request, AUTH_RATE_LIMITS.invitation);
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Use API key client for verification (no user session required)
    const client = new Client();
    client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);

    const invitation = await verifyInvitationToken(databases, databaseId, token);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Get workspace name for display
    const workspace = await databases.getDocument(
      databaseId,
      COLLECTIONS.WORKSPACES,
      invitation.workspace_id
    );

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        workspace_name: workspace.name,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error("Failed to verify invitation:", error);
    return NextResponse.json({ error: "Failed to verify invitation" }, { status: 500 });
  }
}
