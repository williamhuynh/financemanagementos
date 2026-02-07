import { createHmac, randomBytes } from "crypto";
import { Query, ID } from "node-appwrite";
import { COLLECTIONS } from "./collection-names";
import type { WorkspaceMemberRole } from "./workspace-types";

if (process.env.NODE_ENV === "production" && !process.env.INVITATION_SECRET) {
  throw new Error(
    "FATAL: INVITATION_SECRET environment variable is not set. " +
    "Set INVITATION_SECRET to a random secret string before running in production."
  );
}

const INVITATION_SECRET = process.env.INVITATION_SECRET || "default-invitation-secret-dev-only";
const INVITATION_EXPIRY_DAYS = 7;

export type WorkspaceInvitation = {
  $id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceMemberRole;
  token_hash: string;
  created_at: string;
  expires_at: string;
  created_by_id: string;
  accepted_at?: string;
};

/**
 * Generate a secure random token for invitations
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash an invitation token using HMAC-SHA256
 */
export function hashToken(token: string): string {
  return createHmac("sha256", INVITATION_SECRET).update(token).digest("hex");
}

/**
 * Create a new workspace invitation
 */
export async function createInvitation(
  databases: { createDocument: Function; listDocuments: Function },
  databaseId: string,
  workspaceId: string,
  email: string,
  role: WorkspaceMemberRole,
  createdById: string
): Promise<{ invitation: WorkspaceInvitation; token: string }> {
  const token = generateInvitationToken();
  const tokenHash = hashToken(token);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Check if there's already a pending invitation for this email/workspace
  const existing = await databases.listDocuments(databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, [
    Query.equal("workspace_id", workspaceId),
    Query.equal("email", email.toLowerCase()),
    Query.isNull("accepted_at"),
  ]);

  if (existing.documents.length > 0) {
    // Delete existing pending invitation
    for (const doc of existing.documents) {
      await (databases as any).deleteDocument(databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, doc.$id);
    }
  }

  const invitation = await databases.createDocument(
    databaseId,
    COLLECTIONS.WORKSPACE_INVITATIONS,
    ID.unique(),
    {
      workspace_id: workspaceId,
      email: email.toLowerCase(),
      role,
      token_hash: tokenHash,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      created_by_id: createdById,
    }
  );

  return { invitation, token };
}

/**
 * Verify an invitation token and return the invitation if valid
 */
export async function verifyInvitationToken(
  databases: { listDocuments: Function },
  databaseId: string,
  token: string
): Promise<WorkspaceInvitation | null> {
  const tokenHash = hashToken(token);

  const result = await databases.listDocuments(databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, [
    Query.equal("token_hash", tokenHash),
    Query.isNull("accepted_at"),
  ]);

  if (result.documents.length === 0) {
    return null;
  }

  const invitation = result.documents[0] as WorkspaceInvitation;

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return null;
  }

  return invitation;
}

/**
 * Accept an invitation and add the user to the workspace
 */
export async function acceptInvitation(
  databases: { updateDocument: Function; createDocument: Function; listDocuments: Function },
  databaseId: string,
  invitation: WorkspaceInvitation,
  userId: string
): Promise<void> {
  // Check if user is already a member
  const existingMembership = await databases.listDocuments(
    databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    [
      Query.equal("workspace_id", invitation.workspace_id),
      Query.equal("user_id", userId),
    ]
  );

  if (existingMembership.documents.length > 0) {
    // Mark invitation as accepted but don't create duplicate membership
    await databases.updateDocument(
      databaseId,
      COLLECTIONS.WORKSPACE_INVITATIONS,
      invitation.$id,
      { accepted_at: new Date().toISOString() }
    );
    return;
  }

  // Add user to workspace
  await databases.createDocument(databaseId, COLLECTIONS.WORKSPACE_MEMBERS, ID.unique(), {
    workspace_id: invitation.workspace_id,
    user_id: userId,
    role: invitation.role,
  });

  // Mark invitation as accepted
  await databases.updateDocument(
    databaseId,
    COLLECTIONS.WORKSPACE_INVITATIONS,
    invitation.$id,
    { accepted_at: new Date().toISOString() }
  );
}

/**
 * List pending invitations for a workspace
 */
export async function listPendingInvitations(
  databases: { listDocuments: Function },
  databaseId: string,
  workspaceId: string
): Promise<WorkspaceInvitation[]> {
  const result = await databases.listDocuments(databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, [
    Query.equal("workspace_id", workspaceId),
    Query.isNull("accepted_at"),
    Query.greaterThan("expires_at", new Date().toISOString()),
  ]);

  return result.documents as WorkspaceInvitation[];
}

/**
 * Cancel/delete a pending invitation
 */
export async function cancelInvitation(
  databases: { deleteDocument: Function },
  databaseId: string,
  invitationId: string
): Promise<void> {
  await databases.deleteDocument(databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, invitationId);
}
