export const COLLECTIONS = {
  WORKSPACE_MEMBERS: 'workspace_members',
  WORKSPACE_INVITATIONS: 'workspace_invitations',
  WORKSPACES: 'workspaces',
  TRANSACTIONS: 'transactions',
  ASSETS: 'assets',
  CATEGORIES: 'categories',
  IMPORTS: 'imports',
  MONTHLY_SNAPSHOTS: 'monthly_snapshots',
  CASH_LOGS: 'cash_logs',
  TRANSFER_PAIRS: 'transfer_pairs',
  IMPORT_PRESETS: 'import_presets',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
