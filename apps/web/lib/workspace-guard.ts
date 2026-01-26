import { Query } from 'node-appwrite';
import { hasPermission } from './workspace-permissions';
import { getServerConfig, createDatabasesClient } from './api-auth';
import { COLLECTIONS } from './collection-names';
import type { Permission, WorkspaceMemberRole } from './workspace-types';

/**
 * Central enforcement point for workspace access control.
 * ALL API routes AND server functions must call this first.
 *
 * @param workspaceId - The workspace ID to check access for
 * @param userId - The user ID to check
 * @param permission - The required permission level
 * @returns The user's role in the workspace
 * @throws Error if user is not a member or lacks required permission
 */
export async function requireWorkspacePermission(
  workspaceId: string,
  userId: string,
  permission: Permission
): Promise<WorkspaceMemberRole> {
  const config = getServerConfig();
  if (!config) {
    throw new Error('Server configuration missing');
  }

  const databases = createDatabasesClient(config);

  // 1. Query workspace_members for this user + workspace
  const membership = await databases.listDocuments(
    config.databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    [Query.equal('user_id', userId), Query.equal('workspace_id', workspaceId)]
  );

  // 2. Throw 403 if not a member or has duplicate memberships
  if (membership.documents.length === 0) {
    throw new Error('User not member of workspace');
  }

  if (membership.documents.length > 1) {
    // This indicates data corruption - should be prevented by unique index
    console.error('Duplicate workspace memberships found', { userId, workspaceId });
    throw new Error('Data integrity error: duplicate memberships');
  }

  const role = membership.documents[0].role as WorkspaceMemberRole;

  // 3. Check if role has required permission
  if (!hasPermission(role, permission)) {
    throw new Error(`Insufficient permission: ${permission} required`);
  }

  // 4. Return user's role
  return role;
}
