import { WorkspaceMemberRole, Permission } from './workspace-types';

const ROLE_PERMISSIONS: Record<WorkspaceMemberRole, Permission[]> = {
  viewer: ['read'],
  editor: ['read', 'write'],
  admin: ['read', 'write', 'delete', 'admin'],
  owner: ['read', 'write', 'delete', 'admin', 'owner']
};

export function hasPermission(role: WorkspaceMemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
