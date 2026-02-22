/**
 * Check if a user has the superadmin label.
 * Superadmin is a platform-level role stored in Appwrite user labels,
 * separate from workspace RBAC.
 */
export function isSuperadmin(labels: string[] | undefined | null): boolean {
  if (!Array.isArray(labels)) return false;
  return labels.includes("superadmin");
}
