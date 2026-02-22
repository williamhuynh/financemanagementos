export type WorkspaceMemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type Permission = 'read' | 'write' | 'delete' | 'admin' | 'owner';

export interface WorkspaceMember {
  $id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  joined_at: string;
}

export interface Invitation {
  $id: string;
  workspace_id: string;
  role: WorkspaceMemberRole;
  invited_by: string;
  token_hash: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  accepted_by?: string;
  accepted_at?: string;
}

export interface InvitationDetails {
  workspaceName: string;
  role: WorkspaceMemberRole;
  inviterName: string;
  expiresAt: string;
}

export interface AuthenticatedUser {
  $id: string;
  email: string;
  name: string;
  emailVerification?: boolean;
}

export interface ApiConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
  databaseId: string;
}

export interface ApiContext {
  config: ApiConfig;
  user: AuthenticatedUser;
  workspaceId: string;
  role: WorkspaceMemberRole;
  plan: string;
  featureOverrides: string;
  databases: any; // Databases type from node-appwrite
}

