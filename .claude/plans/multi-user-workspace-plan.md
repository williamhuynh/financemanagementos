# Multi-User/Multi-Workspace Readiness Plan

## Overview
Prepare the finance management app for multiple users/families with proper data isolation. The workspace foundation exists but has critical security gaps that must be fixed before extending to other users.

---

## Critical Security Issues (Must Fix First)

### 1. Hardcoded DEFAULT_WORKSPACE_ID = "default"
**Severity: CRITICAL** - All users currently see the same "default" workspace data.

**Files with hardcoded workspace:**
- `apps/web/lib/data.ts` - 13 occurrences (lines 11, 523, 557, 887, 919, 1249, 1503, 1657, 1706, 1750, 1800, 1833, 2448, 2494)
- `apps/web/lib/cash-logs-service.ts` - lines 52, 134
- `apps/web/lib/appwrite-server.ts` - line 9 (exported constant)

### 2. Unauthenticated API Endpoint
**Severity: CRITICAL** - `apps/web/app/api/transfer-pairs/[id]/route.ts`

The DELETE endpoint has NO authentication or workspace verification. Any request can delete any transfer pair by ID.

### 3. No Role Enforcement
Roles (owner/admin/editor/viewer) are defined in `workspace_members` but never checked in API routes.

---

## Implementation Phases

### Phase 1: Critical Security Fixes

#### 1.1 Refactor data.ts to Accept workspaceId Parameter
**File:** `apps/web/lib/data.ts`

- Remove `const DEFAULT_WORKSPACE_ID = "default"` (line 11)
- Add `workspaceId: string` parameter to all exported functions:
  - `getLedgerRowsWithTotal()`
  - `getCategories()`
  - `getReviewItems()`
  - `getCashFlowWaterfall()`
  - `getExpenseBreakdown()`
  - `getMonthlyCloseSummary()`
  - `buildMonthlySnapshotPayload()`
- Update all internal helpers to pass workspaceId through

#### 1.2 Refactor cash-logs-service.ts
**File:** `apps/web/lib/cash-logs-service.ts`

- Remove `DEFAULT_WORKSPACE_ID` import
- Add `workspaceId` parameter to `fetchCashLogs()` and `fetchCategories()`

#### 1.3 Update API Routes Using data.ts
**Files:**
- `apps/web/app/api/ledger/route.ts`
- `apps/web/app/api/monthly-close/route.ts`
- Any other routes calling data.ts functions

- Use `getApiContext()` to get authenticated user's workspaceId
- Pass workspaceId to data.ts functions

#### 1.4 Fix transfer-pairs Security Vulnerability
**File:** `apps/web/app/api/transfer-pairs/[id]/route.ts`

- Add authentication via `getApiContext()`
- Verify the transfer pair belongs to user's workspace before deletion
- Return 401/403 for unauthorized access

#### 1.5 Remove DEFAULT_WORKSPACE_ID Export
**File:** `apps/web/lib/appwrite-server.ts`

- Remove `export const DEFAULT_WORKSPACE_ID` (line 9)

---

### Phase 2: Role-Based Access Control

#### 2.1 Create Permission Helper
**New file:** `apps/web/lib/workspace-permissions.ts`

```typescript
export type Permission = 'read' | 'write' | 'delete' | 'admin' | 'owner';
export type WorkspaceMemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

const ROLE_PERMISSIONS: Record<WorkspaceMemberRole, Permission[]> = {
  viewer: ['read'],
  editor: ['read', 'write'],
  admin: ['read', 'write', 'delete', 'admin'],
  owner: ['read', 'write', 'delete', 'admin', 'owner']
};

export function hasPermission(role: WorkspaceMemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
```

#### 2.2 Enhance API Context with Role
**File:** `apps/web/lib/api-auth.ts`

- Add `role: WorkspaceMemberRole` to ApiContext return type
- Fetch user's role when getting workspace context

#### 2.3 Add Role Checks to Mutation Endpoints
**Files to update:**
- `apps/web/app/api/imports/route.ts` - POST requires 'write'
- `apps/web/app/api/imports/[id]/route.ts` - DELETE requires 'delete'
- `apps/web/app/api/transactions/[id]/route.ts` - PATCH requires 'write'
- `apps/web/app/api/assets/route.ts` - POST requires 'write'
- `apps/web/app/api/assets/[id]/route.ts` - PATCH/DELETE requires 'write'/'delete'
- `apps/web/app/api/monthly-close/route.ts` - POST/PATCH requires 'admin'

---

### Phase 3: Workspace Switcher UI

#### 3.1 Create Workspace Switcher Component
**New file:** `apps/web/app/(shell)/WorkspaceSwitcher.tsx`

- Dropdown showing user's workspaces
- Current workspace highlighted
- "Create new workspace" option
- Uses `useWorkspace()` context and `switchWorkspace()`

#### 3.2 Add Switcher to Topbar
**File:** `apps/web/app/(shell)/TopbarWithUser.tsx`

- Add WorkspaceSwitcher component next to user menu

---

### Phase 4: Member Management

#### 4.1 Create Invitation Schema
**File:** `apps/web/scripts/appwrite-schema-mvp.mjs`

Add new collection `workspace_invitations`:
- workspace_id, role, invited_by, token (unique code), status, expires_at

#### 4.2 Create Invitation API Routes
**New files:**
- `apps/web/app/api/workspaces/[id]/invitations/route.ts` - POST (create), GET (list)
- `apps/web/app/api/invitations/[token]/route.ts` - GET (view invite details), POST (accept)

#### 4.3 Create Invitation Service
**New file:** `apps/web/lib/invitation-service.ts`

- `createInvitation(workspaceId, role)` - generates shareable link/code
- `getInvitationByToken(token)` - validate and return invite details
- `acceptInvitation(token, userId)` - add user to workspace
- `listPendingInvitations(workspaceId)` - for management UI
- `revokeInvitation(invitationId)` - cancel pending invite

**Invitation Flow (Share Link/Code):**
1. Owner/Admin generates invite link from settings
2. Link contains unique token (e.g., `/join/abc123xyz`)
3. Owner manually shares link with invitee
4. Invitee clicks link, signs up/logs in, gets added to workspace

#### 4.4 Update Settings Page with Dynamic Members
**File:** `apps/web/app/(shell)/settings/page.tsx`

- Replace hardcoded members (William, Peggy) with dynamic list from workspace_members
- Add "Invite Member" button
- Functional "Manage" buttons for role changes/removal

#### 4.5 Create Members Management Page
**New files:**
- `apps/web/app/(shell)/settings/members/page.tsx`
- `apps/web/app/(shell)/settings/members/MembersClient.tsx`

---

### Phase 5: Data Migration & Testing

#### 5.1 Create Migration Script
**New file:** `apps/web/scripts/migrate-workspace-data.mjs`

- Find documents with workspace_id = "default"
- Associate with proper workspace or prompt for action

#### 5.2 Add Workspace Validation
**New file:** `apps/web/lib/workspace-validation.ts`

- Validate workspaceId format
- Reject "default" in production
- Log suspicious access attempts

---

## Implementation Order

1. **Phase 1.4** - Fix transfer-pairs vulnerability (immediate)
2. **Phase 1.1-1.3** - Refactor data.ts and update API routes
3. **Phase 1.5** - Clean up DEFAULT_WORKSPACE_ID exports
4. **Phase 5.1** - Run migration for existing data
5. **Phase 2** - Add role-based access control
6. **Phase 3** - Add workspace switcher UI
7. **Phase 4** - Member management and invitations

---

## Verification Steps

1. **Security Testing:**
   - Log in as User A, attempt to access User B's workspace data via API
   - Verify 401/403 responses for unauthorized access
   - Confirm transfer-pairs DELETE requires authentication

2. **Workspace Isolation:**
   - Create two workspaces with different data
   - Verify switching workspaces shows correct data
   - Verify queries never return cross-workspace data

3. **Role Enforcement:**
   - Test viewer cannot create/edit transactions
   - Test editor cannot close months (admin action)
   - Test admin cannot remove owner

4. **Invitation Flow:**
   - Generate invite link, copy to clipboard
   - Open link in incognito, sign up as new user
   - Verify new member appears in workspace with correct role
   - Verify invite link expires/becomes invalid after use
