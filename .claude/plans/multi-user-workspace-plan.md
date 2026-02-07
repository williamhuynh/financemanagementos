# Multi-User/Multi-Workspace Readiness Plan

> **Status (Feb 2026):** ALL PHASES COMPLETE. See [docs/ROADMAP.md](../../docs/ROADMAP.md) for the master plan and current priorities.
>
> This document is kept as an architectural reference. For user-facing docs see [docs/MULTI_WORKSPACE_FEATURE.md](../../docs/MULTI_WORKSPACE_FEATURE.md).

## Overview
Prepare the finance management app for multiple users/families with proper data isolation. All phases below have been implemented.

## Architecture Decision
**Data Access Model: Server-Side Only**
- All data access flows through Next.js API routes (no client-side Appwrite SDK usage)
- Server uses Appwrite API key for database access
- Client never gets direct Appwrite credentials
- **Benefits:** Simpler security model, all authorization checks in one place, easier to audit
- **Trade-offs:**
  - Users cannot use Appwrite console/SDK directly (acceptable for production apps)
  - No Appwrite real-time subscriptions (requires client SDK)
  - Collaborative editing features need custom WebSocket implementation

This architectural choice simplifies workspace isolation - we only need to enforce security at the API route level rather than managing document-level permissions.

### Appwrite Client Patterns

The codebase uses TWO types of Appwrite clients for different purposes:

**1. API Key Client (Admin Access)**
```typescript
const client = new Client().setKey(apiKey);
const databases = new Databases(client);
```
- **Purpose:** Full admin access to query/modify any data
- **Permissions:** Bypasses ALL Appwrite document-level permissions
- **Use case:** All database queries (transactions, assets, workspace_members, etc.)
- **Security:** WE enforce authorization in API routes

**2. Session Client (User Access)**
```typescript
const client = new Client().setSession(sessionToken);
const account = new Account(client);
```
- **Purpose:** Acts as the logged-in user
- **Permissions:** Respects Appwrite document-level permissions
- **Use case:** User account operations (preferences, settings)
- **Security:** Appwrite enforces permissions

**Why both?** User preferences (like activeWorkspaceId) are stored in Appwrite account prefs, which require a session client. But we need API key access to validate workspace membership without depending on document-level permissions.

**Pattern consolidation:** All Appwrite client logic should live in `apps/web/lib/api-auth.ts`. The file `appwrite-server.ts` currently has duplicate patterns that will be consolidated.

### Authentication Architecture (iron-session)

**IMPORTANT:** This application uses **iron-session** (encrypted HttpOnly cookies), NOT Appwrite's native session cookies.

**Session Flow:**
1. Login creates Appwrite session via API key (admin client)
2. Appwrite session secret stored in iron-session (server-side encrypted cookie)
3. `createSessionClient()` reads from iron-session and creates Appwrite client with stored session
4. `getCurrentUser()` reads user data from iron-session (NOT from Appwrite cookies)

**Why iron-session instead of Appwrite cookies?**
- ✅ Works reliably with Appwrite Cloud (no cross-domain cookie issues)
- ✅ Server-side encrypted storage (more secure)
- ✅ Full control over session lifetime
- ✅ Single source of truth for authentication state

**File:** `apps/web/lib/session.ts` defines the session structure:
```typescript
export interface SessionData {
  appwriteSession: string; // The Appwrite session secret
  userId: string;
  email: string;
  name: string;
  isLoggedIn: boolean;
}
```

**CRITICAL:** When implementing workspace features, ALL authentication checks must use iron-session via `getSession()` or `createSessionClient()`, NOT by looking for Appwrite cookies directly.

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

### 4. Missing Unique Constraint on Workspace Membership
**Severity: CRITICAL** - The `workspace_members` collection lacks a unique index on `(workspace_id, user_id)`.

This allows duplicate memberships which can cause:
- Ambiguous role resolution (which role applies if user has multiple entries?)
- Data integrity issues
- Security bypass if roles conflict

### 5. Authorization Only Covers Mutations
**Severity: HIGH** - Current plan focuses on securing write operations (POST, PATCH, DELETE) but read operations also need workspace verification.

Server components or functions calling `data.ts` directly (outside API routes) could bypass workspace guards.

---

## Type Definitions

These types should be defined early and shared across the implementation:

**File:** `apps/web/lib/workspace-types.ts` (new file)

```typescript
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

export interface ApiContext {
  config: ApiConfig;
  user: AuthenticatedUser;
  workspaceId: string;
  role: WorkspaceMemberRole;
  databases: Databases;
}
```

**File:** `apps/web/lib/collection-names.ts` (new file)

```typescript
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
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
```

---

## Implementation Phases

### Phase 0: New User Workspace Bootstrap

**CRITICAL:** Every new user needs a workspace and activeWorkspaceId set automatically.

#### 0.1 Workspace Auto-Creation on Signup
**File:** `apps/web/app/api/auth/signup/route.ts`

After creating the user account, automatically:
1. Create a default workspace (name: "{User's name}'s Workspace")
2. Add user as owner in workspace_members
3. Set user's activeWorkspaceId preference to this workspace

```typescript
export async function POST(request: Request) {
  // ... existing user creation code ...

  // After user is created:
  const workspaceId = ID.unique();

  // 1. Create workspace
  await databases.createDocument(
    databaseId,
    COLLECTIONS.WORKSPACES,
    workspaceId,
    {
      name: `${user.name}'s Workspace`,
      created_by: user.$id,
      created_at: new Date().toISOString(),
    }
  );

  // 2. Add user as owner
  await databases.createDocument(
    databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    ID.unique(),
    {
      workspace_id: workspaceId,
      user_id: user.$id,
      role: 'owner',
      joined_at: new Date().toISOString(),
    }
  );

  // 3. Set active workspace preference
  const sessionClient = new Client().setSession(appwriteSession.secret);
  const sessionAccount = new Account(sessionClient);
  await sessionAccount.updatePrefs({ activeWorkspaceId: workspaceId });

  // ... rest of response
}
```

#### 0.2 Handle Existing Users Without Workspaces
**File:** `apps/web/lib/api-auth.ts`

Update `getApiContext()` to handle legacy users:

```typescript
const prefs = await sessionClient.account.getPrefs();
let activeWorkspaceId = prefs.activeWorkspaceId;

// Legacy user without workspace - create one
if (!activeWorkspaceId) {
  const workspaceId = await createDefaultWorkspaceForUser(user.$id, user.name);
  await sessionClient.account.updatePrefs({ activeWorkspaceId: workspaceId });
  activeWorkspaceId = workspaceId;
}
```

---

### Phase 1: Critical Security Fixes

**NOTE:** Phase order has been adjusted - workspace session management (previously 2.3) must come before API route updates that depend on it.

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

#### 1.3 Consolidate Appwrite Client Patterns and Add Workspace Session Storage

**CRITICAL - This must happen before updating API routes that depend on `getApiContext()` returning `workspaceId`**

**Step 1: Move `createSessionClient()` to `api-auth.ts` and remove unused functions**

**File:** `apps/web/lib/api-auth.ts`

1. Move the `createSessionClient()` function from `appwrite-server.ts` to this file (it's already implemented correctly there).

2. **Remove or update the following functions that are incompatible with iron-session:**
   - `getCurrentUser(config: ApiConfig)` - This function incorrectly looks for Appwrite cookies (`a_session_${projectId}`) instead of reading from iron-session. Since the new `getApiContext()` uses `createSessionClient()` directly, this function is no longer needed and should be removed.
   - `getWorkspaceForUser()` - Will be replaced by reading from `account.getPrefs()` in the new implementation.

3. The `createSessionClient()` function already correctly reads from iron-session (see `appwrite-server.ts` lines 37-68), so no changes needed to it.

**Step 2: Update `getApiContext()` to use both client types**

**IMPORTANT:** The `createSessionClient()` function returns an object with `{ client, account, databases, databaseId }` where the session is already authenticated via iron-session.

```typescript
import { Query } from 'node-appwrite';
import { createSessionClient } from './appwrite-server'; // Will be moved to this file
import { COLLECTIONS } from './collection-names';
import type { WorkspaceMemberRole } from './workspace-types';

export async function getApiContext(): Promise<ApiContext> {
  const config = getServerConfig();
  if (!config) {
    throw new Error('Server config missing');
  }

  // 1. Get session-based client for account access (reads from iron-session)
  const sessionClient = await createSessionClient();
  if (!sessionClient) {
    throw new Error('Unauthorized');
  }

  // 2. Get authenticated user from Appwrite (using session from iron-session)
  const user = await sessionClient.account.get();

  // 3. Get user preferences (activeWorkspaceId) from Appwrite account
  const prefs = await sessionClient.account.getPrefs();
  let activeWorkspaceId = prefs.activeWorkspaceId;

  // 4. Handle missing workspace (for legacy users or first login)
  if (!activeWorkspaceId) {
    // Try to find an existing workspace for this user
    const adminDatabases = createDatabasesClient(config);
    const memberships = await adminDatabases.listDocuments(
      config.databaseId,
      COLLECTIONS.WORKSPACE_MEMBERS,
      [Query.equal('user_id', user.$id), Query.limit(1)]
    );

    if (memberships.documents.length > 0) {
      activeWorkspaceId = memberships.documents[0].workspace_id as string;
      // Save to prefs for next time
      await sessionClient.account.updatePrefs({ activeWorkspaceId });
    } else {
      throw new Error('No workspace found - user needs to create one');
    }
  }

  // 5. Use API key client to validate workspace membership
  const adminDatabases = createDatabasesClient(config);
  const membership = await adminDatabases.listDocuments(
    config.databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    [
      Query.equal('user_id', user.$id),
      Query.equal('workspace_id', activeWorkspaceId),
    ]
  );

  if (membership.documents.length === 0) {
    throw new Error('User not member of active workspace');
  }

  if (membership.documents.length > 1) {
    // Should be prevented by unique index
    console.error('Duplicate workspace memberships found', {
      userId: user.$id,
      workspaceId: activeWorkspaceId,
    });
    throw new Error('Data integrity error: duplicate memberships');
  }

  // 6. Return context with API key databases client (for data access)
  return {
    config,
    user: {
      $id: user.$id,
      email: user.email,
      name: user.name,
    },
    workspaceId: activeWorkspaceId,
    role: membership.documents[0].role as WorkspaceMemberRole,
    databases: adminDatabases, // Use API key client for all DB operations
  };
}
```

**Step 3: New API endpoint for workspace switching**

**File:** `apps/web/app/api/workspaces/switch/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createSessionClient } from '../../../lib/api-auth';

export async function POST(request: Request) {
  try {
    const { workspaceId } = await request.json();

    // Get session client
    const sessionClient = await createSessionClient();
    if (!sessionClient) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is member of target workspace
    const membership = await sessionClient.databases.listDocuments(
      sessionClient.databaseId,
      COLLECTIONS.WORKSPACE_MEMBERS,
      [
        Query.equal('user_id', sessionClient.account.$id),
        Query.equal('workspace_id', workspaceId),
      ]
    );

    if (membership.documents.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this workspace' },
        { status: 403 }
      );
    }

    // Update user preference (server-side session)
    await sessionClient.account.updatePrefs({ activeWorkspaceId: workspaceId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Workspace switch error:', error);
    return NextResponse.json(
      { error: 'Failed to switch workspace' },
      { status: 500 }
    );
  }
}
```

**Step 4: Update import statements and delete `appwrite-server.ts`**

**Files that need import updates:**

1. `apps/web/app/api/workspaces/route.ts`:
   ```typescript
   // BEFORE:
   import { createSessionClient } from "../../../lib/appwrite-server";

   // AFTER:
   import { createSessionClient } from "../../../lib/api-auth";
   ```

2. `apps/web/lib/cash-logs-service.ts`:
   ```typescript
   // BEFORE:
   import { getServerAppwrite, DEFAULT_WORKSPACE_ID } from "./appwrite-server";

   // AFTER:
   import { createDatabasesClient, getServerConfig } from "./api-auth";
   import { COLLECTIONS } from "./collection-names";

   // Then update function calls:
   // const serverClient = getServerAppwrite(); // OLD
   const config = getServerConfig();
   const databases = createDatabasesClient(config); // NEW

   // Query.equal("workspace_id", DEFAULT_WORKSPACE_ID) // OLD
   // Query.equal("workspace_id", workspaceId) // NEW (add workspaceId param)
   ```

**After all imports are updated, delete:**
- `apps/web/lib/appwrite-server.ts` (entire file)

**Why this matters:** Without server-side storage and validation, a user could manipulate requests to send any workspace ID and access other users' data (IDOR vulnerability). Using both client types ensures we can access user preferences while maintaining full database control.

#### 1.4 Update API Routes Using data.ts
**Files:**
- `apps/web/app/api/ledger/route.ts`
- `apps/web/app/api/monthly-close/route.ts`
- Any other routes calling data.ts functions

- Use `getApiContext()` to get authenticated user's workspaceId (now available after Phase 1.3)
- Pass workspaceId to data.ts functions

#### 1.5 Fix transfer-pairs Security Vulnerability
**File:** `apps/web/app/api/transfer-pairs/[id]/route.ts`

- Add authentication via `getApiContext()`
- Verify the transfer pair belongs to user's workspace before deletion
- Return 401/403 for unauthorized access

#### 1.6 Delete appwrite-server.ts
**File:** `apps/web/lib/appwrite-server.ts`

- Delete this entire file (all functionality now consolidated in `api-auth.ts`)
- Update any imports from `appwrite-server.ts` to use `api-auth.ts` instead

#### 1.7 Audit Server Components for Direct Data Access
**CRITICAL:** Ensure ALL data access goes through workspace guards, not just API routes.

**Action items:**
1. Search for all imports of `data.ts` outside of API routes:
   ```bash
   grep -r "from.*data" apps/web/app --include="*.tsx" --include="*.ts" | grep -v "api/"
   ```

2. For each server component or server action that calls `data.ts`:
   - Add authentication check via `getApiContext()`
   - Add workspace permission check via `requireWorkspacePermission()`
   - Pass `workspaceId` to data.ts functions

3. **Pattern for server components:**
   ```typescript
   // In server component
   export default async function DashboardPage() {
     const context = await getApiContext();
     if (!context) {
       redirect('/login');
     }

     // Verify read permission
     await requireWorkspacePermission(
       context.workspaceId,
       context.user.$id,
       'read'
     );

     // Safe to call data functions
     const ledger = await getLedgerRowsWithTotal(context.workspaceId, { limit: 50 });

     return <div>...</div>;
   }
   ```

4. **Pattern for server actions:**
   ```typescript
   'use server'

   export async function deleteTransaction(transactionId: string) {
     const context = await getApiContext();
     if (!context) {
       throw new Error('Unauthorized');
     }

     await requireWorkspacePermission(
       context.workspaceId,
       context.user.$id,
       'delete'
     );

     // Verify transaction belongs to workspace before deletion
     // ... delete logic
   }
   ```

**Files to audit:**
- All files in `apps/web/app/(shell)/`
- Any server actions in `app/actions/`
- Any middleware that accesses data

---

### Phase 2: Role-Based Access Control

**Note:** Type definitions (Permission, WorkspaceMemberRole, etc.) were already created in the Type Definitions section above.

#### 2.1 Create Permission Helper
**New file:** `apps/web/lib/workspace-permissions.ts`

```typescript
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
```

#### 2.2 Create Centralized Workspace Guard (CRITICAL)
**New file:** `apps/web/lib/workspace-guard.ts`

This is the single enforcement point for workspace access - ALL API routes AND server functions must call this first.

```typescript
export async function requireWorkspacePermission(
  workspaceId: string,
  userId: string,
  permission: Permission
): Promise<WorkspaceMemberRole> {
  // 1. Query workspace_members for this user + workspace
  const membership = await databases.listDocuments(
    'workspace_members',
    [Query.equal('user_id', userId), Query.equal('workspace_id', workspaceId)]
  );

  // 2. Throw 403 if not a member or has duplicate memberships
  if (membership.documents.length === 0) {
    throw new Error('User not member of workspace');
  }
  if (membership.documents.length > 1) {
    // This indicates data corruption - should be prevented by unique index
    logger.error('Duplicate workspace memberships found', { userId, workspaceId });
    throw new Error('Data integrity error: duplicate memberships');
  }

  const role = membership.documents[0].role;

  // 3. Check if role has required permission
  if (!hasPermission(role, permission)) {
    throw new Error(`Insufficient permission: ${permission} required`);
  }

  // 4. Return user's role
  return role;
}
```

**Pattern for all API routes (including READ operations):**

**IMPORTANT:** All API routes must return proper NextResponse with HTTP status codes, not throw errors.

```typescript
import { NextResponse } from 'next/server';

// For mutation endpoints (POST, PATCH, DELETE)
export async function POST(request: Request) {
  try {
    const context = await getApiContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, workspaceId } = context;

    // First line of every protected route
    const role = await requireWorkspacePermission(workspaceId, user.$id, 'write');

    // ... rest of route logic

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error.message.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (error.message.includes('Insufficient permission')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// For read endpoints (GET)
export async function GET(request: Request) {
  try {
    const context = await getApiContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, workspaceId } = context;

    // READ operations also need workspace verification
    const role = await requireWorkspacePermission(workspaceId, user.$id, 'read');

    // ... rest of route logic

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error.message.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Error Response Standards:**
- `401 Unauthorized` - No valid session/authentication
- `403 Forbidden` - Authenticated but not member or insufficient permissions
- `404 Not Found` - Resource doesn't exist in workspace
- `500 Internal Server Error` - Unexpected errors

**IMPORTANT:** Any server components or server actions that call `data.ts` directly must ALSO call `requireWorkspacePermission()` first. Do NOT bypass the guard by calling data functions outside of guarded API routes.

#### 2.3 Enhance API Context with Role (COMPLETED IN PHASE 1.3)
**File:** `apps/web/lib/api-auth.ts`

- Add `role: WorkspaceMemberRole` to ApiContext return type
- Fetch user's role when getting workspace context (already included in Phase 1.3)

#### 2.4 Add Role Checks to All API Endpoints (READ and WRITE)
**Files to update:**
- `apps/web/app/api/imports/route.ts` - POST requires 'write'
- `apps/web/app/api/imports/[id]/route.ts` - DELETE requires 'delete'
- `apps/web/app/api/transactions/[id]/route.ts` - PATCH requires 'write'
- `apps/web/app/api/assets/route.ts` - POST requires 'write'
- `apps/web/app/api/assets/[id]/route.ts` - PATCH/DELETE requires 'write'/'delete'
- `apps/web/app/api/monthly-close/route.ts` - POST/PATCH requires 'admin'
- **All existing routes** - Add `requireWorkspacePermission()` as first call

**Important:** Any new API routes created in the future MUST also call `requireWorkspacePermission()` first. This should be part of code review checklist.

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

#### 4.3 Create Invitation Service (High Security)
**New file:** `apps/web/lib/invitation-service.ts`

**Security requirements:**
- **Hash tokens** - Use HMAC-SHA256 for deterministic hashing (enables O(1) lookup by hash, more scalable than bcrypt with full table scan)
- **Single-use** - Mark invitation as `used` after acceptance (prevents replay)
- **Auto-expire** - Default 7-day TTL (prevents indefinite exposure)
- **Rate limiting** - Max 10 invitations per hour per workspace (prevents abuse) - requires rate limit storage (Redis or DB table)
- **Idempotent acceptance** - If user already member, return success (prevents errors)

**Why HMAC-SHA256 instead of bcrypt:**
- Bcrypt requires comparing against ALL pending invitations (O(N) operation)
- HMAC-SHA256 produces deterministic hash - can index and lookup by hash (O(1) operation)
- For invitation tokens, constant-time lookup is more important than slow hashing (they already expire in 7 days)

**HMAC Secret Key Management:**
- **Environment Variable:** `INVITATION_TOKEN_SECRET` (32+ random characters)
- **Storage:** Server-side only, never exposed to client
- **Rotation:** If secret changes, all pending invitations become invalid
- **Generation:** Use `openssl rand -hex 32` or similar cryptographically secure method
- **Required:** Add to `.env.local` and production environment

```bash
# Add to .env.local
INVITATION_TOKEN_SECRET=your_random_32_character_secret_here
```

**Rate Limiting Implementation:**
- **MVP/Small Scale:** In-memory rate limiting (acceptable for <100 workspaces)
- **Production/Scale:** Use Redis or DB table to track invitation creation times
- **Recommendation:** Start with in-memory, migrate to Redis when scaling beyond 1000 workspaces

```typescript
export async function createInvitation(
  workspaceId: string,
  role: WorkspaceMemberRole,
  invitedBy: string
): Promise<{ token: string; inviteUrl: string }> {
  // 1. Check rate limit (query recent invitations from this workspace)
  // 2. Generate cryptographically secure random token (32 bytes)
  // 3. Hash token with HMAC-SHA256 (deterministic - enables O(1) lookup)
  // 4. Store hashed token + workspace_id + role + expires_at (7 days)
  // 5. Return plain token (only time it's visible) + invite URL
}

export async function getInvitationByToken(token: string): Promise<InvitationDetails> {
  // 1. Hash the provided token with HMAC-SHA256
  // 2. Query invitation by token_hash (O(1) lookup with index)
  // 3. Verify not used, not expired, not revoked
  // 4. Return invitation details (workspace name, role, inviter)
  // 5. Throw error if not found/expired/used
}

export async function acceptInvitation(token: string, userId: string): Promise<void> {
  // 1. Find and validate invitation
  // 2. Check if user already member (idempotent - return success)
  // 3. Add user to workspace_members with specified role
  // 4. Mark invitation as used (status = 'accepted', accepted_by = userId)
  // 5. Update user's activeWorkspaceId preference to this workspace
}

export async function listPendingInvitations(workspaceId: string): Promise<Invitation[]> {
  // Show only pending invitations (not used, not expired, not revoked)
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  // Set status = 'revoked'
}
```

**Invitation Flow (Share Link/Code):**
1. Owner/Admin generates invite link from settings
2. Link contains unique token (e.g., `/join/abc123xyz`)
3. System stores hashed version only
4. Owner manually shares link with invitee
5. Invitee clicks link:
   - **If logged in:** Validate invitation → Add to workspace → Switch to new workspace
   - **If not logged in:** Show invitation preview → Force signup/login → Add to workspace → Switch to new workspace
6. Token becomes invalid after use or 7 days

**Implementation for logged-in vs logged-out users:**
```typescript
// In /join/[token]/page.tsx
export default async function JoinInvitationPage({ params }) {
  const token = params.token;
  const sessionClient = await createSessionClient();

  // Check if user is logged in
  if (!sessionClient) {
    // Not logged in - show invitation preview
    const inviteDetails = await getInvitationByToken(token);
    return <InvitationPreview details={inviteDetails} requireAuth={true} />;
  }

  // Logged in - accept invitation automatically
  try {
    await acceptInvitation(token, sessionClient.account.$id);
    redirect('/dashboard');
  } catch (error) {
    return <ErrorPage message={error.message} />;
  }
}
```

#### 4.4 Add Owner Protection Logic
**New file:** `apps/web/lib/workspace-member-management.ts`

```typescript
export async function removeMember(workspaceId: string, userId: string, removedBy: string): Promise<void> {
  // 1. Verify the person removing has 'owner' or 'admin' permission
  const removerRole = await requireWorkspacePermission(workspaceId, removedBy, 'admin');

  // 2. Get the member being removed
  const targetMember = await getMember(workspaceId, userId);

  // 3. CRITICAL: Prevent removing the last owner
  if (targetMember.role === 'owner') {
    const owners = await countMembersWithRole(workspaceId, 'owner');
    if (owners <= 1) {
      throw new Error('Cannot remove the last owner. Transfer ownership first.');
    }
  }

  // 4. Admins cannot remove owners
  if (removerRole === 'admin' && targetMember.role === 'owner') {
    throw new Error('Admins cannot remove owners');
  }

  // 5. Proceed with removal
  await deleteMember(workspaceId, userId);
}

export async function changeRole(
  workspaceId: string,
  userId: string,
  newRole: WorkspaceMemberRole,
  changedBy: string
): Promise<void> {
  // 1. Verify the person changing role has permission
  await requireWorkspacePermission(workspaceId, changedBy, 'admin');

  // 2. Get current member
  const member = await getMember(workspaceId, userId);

  // 3. CRITICAL: Prevent downgrading the last owner
  if (member.role === 'owner' && newRole !== 'owner') {
    const owners = await countMembersWithRole(workspaceId, 'owner');
    if (owners <= 1) {
      throw new Error('Cannot downgrade the last owner. Assign another owner first.');
    }
  }

  // 4. Update role
  await updateMemberRole(workspaceId, userId, newRole);
}
```

#### 4.5 Update Settings Page with Dynamic Members
**File:** `apps/web/app/(shell)/settings/page.tsx`

- Replace hardcoded members (William, Peggy) with dynamic list from workspace_members
- Add "Invite Member" button
- Functional "Manage" buttons for role changes/removal (using functions from 4.4)
- Disable "Remove" button for last owner
- Show warning when attempting to change last owner's role

#### 4.6 Workspace Deletion
**New file:** `apps/web/lib/workspace-deletion.ts`

```typescript
export async function deleteWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  // 1. Verify user is owner
  const role = await requireWorkspacePermission(workspaceId, userId, 'owner');

  // 2. Check if user has other workspaces
  const userWorkspaces = await databases.listDocuments(
    databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    [Query.equal('user_id', userId)]
  );

  if (userWorkspaces.documents.length <= 1) {
    throw new Error('Cannot delete your only workspace');
  }

  // 3. CASCADE DELETE all workspace data
  const collections = [
    COLLECTIONS.TRANSACTIONS,
    COLLECTIONS.ASSETS,
    COLLECTIONS.CATEGORIES,
    COLLECTIONS.IMPORTS,
    COLLECTIONS.MONTHLY_SNAPSHOTS,
    COLLECTIONS.CASH_LOGS,
    COLLECTIONS.TRANSFER_PAIRS,
    COLLECTIONS.WORKSPACE_MEMBERS,
  ];

  for (const collection of collections) {
    const docs = await databases.listDocuments(
      databaseId,
      collection,
      [Query.equal('workspace_id', workspaceId), Query.limit(100)]
    );

    for (const doc of docs.documents) {
      await databases.deleteDocument(databaseId, collection, doc.$id);
    }
  }

  // 4. Delete workspace document
  await databases.deleteDocument(databaseId, COLLECTIONS.WORKSPACES, workspaceId);

  // 5. Switch user to another workspace
  const remainingWorkspace = userWorkspaces.documents.find(
    (w) => w.workspace_id !== workspaceId
  );

  const sessionClient = await createSessionClient();
  await sessionClient.account.updatePrefs({
    activeWorkspaceId: remainingWorkspace.workspace_id,
  });
}
```

**API Endpoint:**
**File:** `apps/web/app/api/workspaces/[id]/route.ts`

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getApiContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteWorkspace(params.id, context.user.$id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message.includes('only workspace')) {
      return NextResponse.json(
        { error: 'Cannot delete your only workspace' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
```

**Important considerations:**
- Only owners can delete workspaces
- Users cannot delete their last workspace (prevents lockout)
- Deletion is permanent and cascades to all data
- Consider soft delete (archive) as alternative for safety

#### 4.7 User Self-Removal from Workspace
**New file:** `apps/web/lib/workspace-leave.ts`

```typescript
export async function leaveWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  // 1. Get user's membership
  const membership = await databases.listDocuments(
    databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    [
      Query.equal('user_id', userId),
      Query.equal('workspace_id', workspaceId),
    ]
  );

  if (membership.documents.length === 0) {
    throw new Error('Not a member of this workspace');
  }

  const userRole = membership.documents[0].role;

  // 2. CRITICAL: Prevent last owner from leaving
  if (userRole === 'owner') {
    const owners = await databases.listDocuments(
      databaseId,
      COLLECTIONS.WORKSPACE_MEMBERS,
      [
        Query.equal('workspace_id', workspaceId),
        Query.equal('role', 'owner'),
      ]
    );

    if (owners.documents.length <= 1) {
      throw new Error('Cannot leave workspace as the only owner. Transfer ownership or delete the workspace first.');
    }
  }

  // 3. Check if user has other workspaces
  const userWorkspaces = await databases.listDocuments(
    databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    [Query.equal('user_id', userId)]
  );

  if (userWorkspaces.documents.length <= 1) {
    throw new Error('Cannot leave your only workspace');
  }

  // 4. Remove membership
  await databases.deleteDocument(
    databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    membership.documents[0].$id
  );

  // 5. Switch user to another workspace
  const remainingWorkspace = userWorkspaces.documents.find(
    (w) => w.workspace_id !== workspaceId
  );

  const sessionClient = await createSessionClient();
  await sessionClient.account.updatePrefs({
    activeWorkspaceId: remainingWorkspace.workspace_id,
  });
}
```

**API Endpoint:**
**File:** `apps/web/app/api/workspaces/[id]/leave/route.ts`

```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getApiContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await leaveWorkspace(params.id, context.user.$id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message.includes('only owner')) {
      return NextResponse.json(
        { error: 'Cannot leave as the only owner. Transfer ownership first.' },
        { status: 400 }
      );
    }
    if (error.message.includes('only workspace')) {
      return NextResponse.json(
        { error: 'Cannot leave your only workspace' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to leave workspace' },
      { status: 500 }
    );
  }
}
```

#### 4.8 Create Members Management Page
**New files:**
- `apps/web/app/(shell)/settings/members/page.tsx`
- `apps/web/app/(shell)/settings/members/MembersClient.tsx`
- Add "Leave Workspace" button (disabled if only workspace or last owner)
- Add "Delete Workspace" button (owner only, disabled if only workspace)

---

### Phase 5: Data Migration & Testing

#### 5.1 Create Comprehensive Migration Script
**New file:** `apps/web/scripts/migrate-workspace-data.mjs`

**Migration scope (handles all edge cases):**

```javascript
// 1. Migrate documents with workspace_id = "default"
const defaultDocs = await findDocuments({ workspace_id: "default" });

// 2. Migrate documents with NULL or missing workspace_id
const orphanedDocs = await findDocuments({ workspace_id: null });

// 3. Collections to migrate:
const collections = [
  'transactions',
  'assets',
  'categories',
  'imports',
  'monthly_snapshots',
  'cash_logs',
  'transfer_pairs',
  'workspace_members' // update if any still reference "default"
];

// 4. Migrate storage buckets/files
// - Check for uploaded files in default bucket
// - Update metadata or move to workspace-scoped buckets

// 5. Update document permissions (if any were set)
// - Not needed for server-side only model, but good to clean up
```

**Migration features:**
- **Dry-run mode:** `--dry-run` flag to preview changes without applying
- **Logging:** Write detailed log file with all changes made
- **Rollback capability:** Export backup JSON before making changes
- **Validation:** Verify all docs have valid workspace_id after migration
- **Progress tracking:** Show progress bar for large datasets

**Migration decision tree:**
```
For each document:
  If workspace_id = "default":
    → Assign to first workspace found, or prompt user

  If workspace_id is NULL/missing:
    → Check created_by user if present
    → Find user's default workspace
    → If no user reference, prompt for assignment

  If workspace_id is invalid (workspace doesn't exist):
    → Log error, prompt for correction
```

#### 5.2 Create Required Database Indexes
**Update file:** `apps/web/scripts/appwrite-schema-mvp.mjs`

Add index creation for optimal query performance:

```javascript
// Add to each collection's schema:
await createIndex('transactions', 'workspace_id_idx', ['workspace_id']);
await createIndex('assets', 'workspace_id_idx', ['workspace_id']);
await createIndex('categories', 'workspace_id_idx', ['workspace_id']);
await createIndex('imports', 'workspace_id_idx', ['workspace_id']);
await createIndex('monthly_snapshots', 'workspace_id_idx', ['workspace_id']);
await createIndex('cash_logs', 'workspace_id_idx', ['workspace_id']);
await createIndex('transfer_pairs', 'workspace_id_idx', ['workspace_id']);

// CRITICAL: Unique index for workspace members (prevents duplicate memberships)
await createUniqueIndex('workspace_members', 'workspace_user_unique_idx', ['workspace_id', 'user_id']);

// Also add non-unique compound index for fast lookups
await createIndex('workspace_members', 'workspace_user_idx', ['workspace_id', 'user_id']);

// Unique index for invitation tokens (critical for security)
await createUniqueIndex('workspace_invitations', 'token_unique_idx', ['token_hash']);
```

**Why indexes are critical:**
- Without `workspace_id` indexes, queries will be slow (full table scan)
- **CRITICAL:** Unique index on `(workspace_id, user_id)` prevents duplicate memberships and ensures deterministic role resolution
- Without unique index on tokens, duplicate invitations could be created
- Compound indexes speed up membership checks (done on every API request)

#### 5.3 Add Workspace Validation
**New file:** `apps/web/lib/workspace-validation.ts`

```typescript
export function validateWorkspaceId(workspaceId: string): void {
  // 1. Reject "default" in production (only allow in development)
  if (workspaceId === "default" && process.env.NODE_ENV === 'production') {
    throw new Error('Invalid workspace ID: "default" not allowed in production');
  }

  // 2. Validate format (Appwrite document ID format)
  const validIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;
  if (!validIdPattern.test(workspaceId)) {
    throw new Error('Invalid workspace ID format');
  }

  // 3. Log suspicious access attempts
  if (workspaceId.includes('..') || workspaceId.includes('/')) {
    logger.warn('Suspicious workspace ID attempted', { workspaceId });
    throw new Error('Invalid workspace ID');
  }
}
```

---

## Implementation Order

**PREREQUISITE:**
1. **Phase 0.1-0.2** - New user workspace bootstrap (update signup flow and handle legacy users)

**CRITICAL PATH (Must complete before any production use):**
2. **Phase 5.2** - Create database indexes FIRST (including unique constraint on workspace_members)
3. **Phase 1.5** - Fix transfer-pairs vulnerability (immediate security fix)
4. **Phase 1.1-1.2** - Refactor data.ts and cash-logs-service.ts to accept workspaceId parameter
5. **Phase 1.3** - Consolidate Appwrite client patterns and add workspace session storage
6. **Phase 1.4** - Update API routes using data.ts to pass workspaceId from context
7. **Phase 1.6** - Delete appwrite-server.ts file (consolidate into api-auth.ts)
8. **Phase 1.7** - Audit server components for direct data access
9. **Phase 2.1** - Create permission helper (imports from workspace-types.ts)
10. **Phase 2.2** - Create centralized workspace guard with proper HTTP error responses
11. **Phase 2.4** - Add role checks to ALL existing API routes (including GET/read operations)
12. **Phase 5.1** - Run comprehensive data migration (after code is secure)
13. **Verification 1-4** - Security testing before proceeding

**FEATURE ADDITIONS (After security is solid):**
14. **Phase 3** - Add workspace switcher UI
15. **Phase 4.1-4.5** - Member management and invitations (with high security and owner protection)
16. **Phase 4.6** - Workspace deletion (owner only, prevent deleting last workspace)
17. **Phase 4.7** - User self-removal from workspace (prevent last owner from leaving)
18. **Phase 4.8** - Members management page with Leave/Delete buttons
19. **Verification 5-6** - Invitation and migration testing

**IMPORTANT UPDATES:**
- **Type definitions created first** - All shared types defined in workspace-types.ts and collection-names.ts
- **Client patterns consolidated** - All Appwrite client logic lives in api-auth.ts (deleted appwrite-server.ts)
- **Database indexes created first** - Unique constraint on workspace_members prevents data corruption
- **Workspace session storage** - Moved to Phase 1.3 because API route updates depend on it
- **READ operations secured** - All endpoints (GET/POST/PATCH/DELETE) require workspace permission checks
- **Error responses standardized** - All API routes return NextResponse with proper HTTP status codes
- **Server components audited** - Phase 1.7 ensures no data access bypasses workspace guards
- **HMAC secret management** - INVITATION_TOKEN_SECRET environment variable required
- **Workspace lifecycle** - Added deletion and self-removal with owner protection

**IMPORTANT:** Do NOT skip ahead to UI features before completing the critical security fixes. An unsecured multi-workspace system is worse than a single-workspace system.

---

## Open Architecture Questions

These questions need answers before implementation begins:

### 1. Authentication Method
**Status:** ✅ ANSWERED - Uses iron-session (encrypted HttpOnly cookies)

**Current Implementation:**
- Login creates Appwrite session via API key (admin client)
- Appwrite session secret stored in **iron-session** (server-side encrypted cookie)
- `createSessionClient()` reads from iron-session and creates Appwrite client with stored session
- API routes call `getApiContext()` which uses `createSessionClient()` internally

**CSRF Protection:**
- ✅ Already has `SameSite=lax` (see `session.ts` line 26)
- ✅ Uses HttpOnly cookies (cannot be accessed by JavaScript)
- ✅ Server-side encrypted with iron-session
- ⚠️ **TODO:** Upgrade to `SameSite=strict` for production
- ⚠️ **TODO:** Add CSRF token validation for state-changing operations (POST/PATCH/DELETE)
- ⚠️ **TODO:** Add Origin header verification

**Session Cookie Details:**
- Cookie name: `financelab_session` (see `session.ts` line 22)
- Max age: 7 days (see `session.ts` line 27)
- Encrypted with: `SESSION_SECRET` environment variable
- Contains: `{ appwriteSession, userId, email, name, isLoggedIn }`

### 2. Data Access Patterns
**Status:** ✅ ADDRESSED IN PHASE 1.7

**Question:** Do any server components or server actions call `data.ts` directly today, or is all data access already via API routes?

**Impact:** If server components call `data.ts` directly, they MUST also call `requireWorkspacePermission()` to prevent bypassing workspace guards.

**Solution:** Phase 1.7 includes a comprehensive audit of all server components and server actions to ensure all data access goes through workspace permission checks.

### 3. Active Workspace Scope
**Question:** Is "active workspace" intended to be global across devices (synced via Appwrite user preferences) or per-session (browser-specific)?

**Current Plan:** Uses Appwrite user preferences (global across devices)

**Trade-offs:**
- Global: User sees same workspace on all devices, but switching on one device affects all
- Per-session: More flexible, but requires session storage and doesn't sync

### 4. Expected Scale
**Question:** What is the expected number of workspaces, users per workspace, and invitation volume?

**Impact:**
- Small scale (<100 workspaces): Current approach is fine
- Medium scale (100-1000 workspaces): Need proper rate limiting backend (Redis)
- Large scale (>1000 workspaces): May need additional caching and optimization

**Current Plan:** Assumes small-to-medium scale

### 5. File Storage Strategy
**Question:** Should file downloads be direct from Appwrite storage or always proxied through API routes to enforce workspace membership?

**Impact:**
- Direct: Faster, but requires Appwrite document-level permissions
- Proxied: Slower, but keeps all security in API layer (matches server-side only architecture)

**Recommendation:** Proxy file downloads through API routes for consistency with server-side only model.

---

## API Route Security Checklist

Use this checklist when creating or reviewing API routes to ensure workspace security:

### Required for ALL API Routes:

- [ ] **Authentication:** Calls `getApiContext()` at the start
- [ ] **Null Check:** Returns `401 Unauthorized` if context is null
- [ ] **Workspace Permission:** Calls `requireWorkspacePermission()` with appropriate permission level
  - `'read'` for GET endpoints
  - `'write'` for POST/PATCH endpoints
  - `'delete'` for DELETE endpoints
  - `'admin'` for administrative actions (monthly close, etc.)
  - `'owner'` for ownership-required actions (workspace deletion, etc.)
- [ ] **Error Handling:** Uses try-catch with proper NextResponse status codes
  - `401` - No authentication
  - `403` - Authenticated but unauthorized (not member or insufficient permission)
  - `404` - Resource not found
  - `500` - Internal server error
- [ ] **Workspace Filtering:** All database queries include workspace_id filter from context
- [ ] **Collection Names:** Uses constants from `COLLECTIONS` instead of magic strings
- [ ] **Input Validation:** Validates request body/params before processing
- [ ] **Resource Ownership:** Verifies resource belongs to workspace before modification/deletion

### Additional Checks for Mutation Endpoints (POST/PATCH/DELETE):

- [ ] **CSRF Protection:** Uses POST/PATCH/DELETE (not GET) for state-changing operations
- [ ] **Idempotency:** Handles duplicate requests gracefully where appropriate
- [ ] **Atomic Operations:** Uses transactions if modifying multiple collections

### Code Review Questions:

- Can a user from Workspace A access data from Workspace B?
- Can a viewer perform write operations?
- Can an editor perform admin operations?
- Can a user access data after being removed from workspace?
- Does the endpoint bypass workspace guards by calling data.ts directly?
- Are error messages informative without leaking sensitive information?

---

## Verification Steps

1. **Architecture Verification (Server-Side Only):**
   - Open browser console on app homepage
   - Attempt to initialize Appwrite SDK: `const client = new Appwrite.Client()`
   - **Expected:** Should fail - no client-side Appwrite SDK installed
   - Inspect Network tab - verify no Appwrite API key in client-side JavaScript
   - **Expected:** Only server-side API routes visible, no direct Appwrite calls from browser

2. **Security Testing:**
   - Log in as User A, attempt to access User B's workspace data via API
   - Verify 401/403 responses for unauthorized access
   - Confirm transfer-pairs DELETE requires authentication
   - **Test IDOR:** Manually change workspace ID in API request (use browser dev tools)
   - **Expected:** 403 Forbidden (user not member of that workspace)

3. **Workspace Isolation:**
   - Create two workspaces with different data
   - Verify switching workspaces shows correct data
   - Verify queries never return cross-workspace data
   - Check that workspace switch persists across page refreshes (server-side session)

4. **Role Enforcement:**
   - Test viewer cannot create/edit transactions
   - Test editor cannot close months (admin action)
   - Test admin cannot remove owner
   - Verify all mutation endpoints call `requireWorkspacePermission()` with appropriate permission level
   - **NEW:** Verify READ endpoints also call `requireWorkspacePermission('read')`
   - **NEW:** Test that user removed from workspace cannot read data via GET endpoints

5. **Invitation Flow:**
   - Generate invite link, copy to clipboard
   - Verify token is hashed in database (cannot see original in DB)
   - Open link in incognito, sign up as new user
   - Verify new member appears in workspace with correct role
   - Attempt to reuse same invite link
   - **Expected:** Fails with "invitation already used"
   - Test expired invitation (manually set expires_at to past date)
   - **Expected:** Fails with "invitation expired"
   - Test rate limiting by creating 11+ invitations rapidly
   - **Expected:** 11th invitation fails with rate limit error

6. **Migration Verification:**
   - Run migration script in dry-run mode first
   - Review migration log for correctness
   - Run actual migration
   - Verify all documents have valid workspace_id (no NULL, no "default")
   - Verify indexes exist: `SHOW INDEXES` or check Appwrite console
   - Test query performance on large collections (should be fast)

---

## Plan Improvements (Based on Codex Review - January 2026)

This plan was reviewed by OpenAI Codex (gpt-5.2-codex with xhigh reasoning) and enhanced to address critical security and architectural concerns.

### Critical Issues Identified by Codex:

1. **Unique Constraint Missing** (CRITICAL)
   - No unique index on `(workspace_id, user_id)` in workspace_members
   - Could allow duplicate memberships with ambiguous role resolution
   - **Fixed:** Added unique index in Phase 5.2

2. **Authorization Only on Mutations** (HIGH)
   - Original plan only secured write operations (POST/PATCH/DELETE)
   - Read operations (GET) could bypass workspace verification
   - Server components calling `data.ts` directly could bypass guards
   - **Fixed:** Phase 2.2 now requires `requireWorkspacePermission('read')` for ALL operations

3. **Phase Sequencing Problem** (HIGH)
   - Phase 1.3 needed `getApiContext()` to return `workspaceId`, but that wasn't added until Phase 2.3
   - **Fixed:** Moved workspace session storage to Phase 1.3 (before API route updates)

4. **Invitation Token Scalability** (MEDIUM)
   - Original plan used bcrypt with O(N) full table scan
   - Doesn't scale beyond small number of invitations
   - **Fixed:** Changed to HMAC-SHA256 with indexed lookup (O(1))

5. **Owner Protection Not Enforced** (MEDIUM)
   - Original plan only tested "admin cannot remove owner" but didn't enforce it in code
   - **Fixed:** Added Phase 4.4 with explicit owner protection logic

6. **Missing Architecture Documentation** (INFO)
   - Several open questions about authentication method, scale, and file storage
   - **Fixed:** Added "Open Architecture Questions" section

### Added Sections:
1. **Critical Security Issue #4** - Unique constraint on workspace_members
2. **Critical Security Issue #5** - Authorization on read operations
3. **Phase 1.3** - Workspace session storage (moved from Phase 2.3)
4. **Phase 2.2 Enhancement** - Added duplicate membership detection and READ permission pattern
5. **Phase 4.4** - Owner protection enforcement logic
6. **Phase 5.2 Enhancement** - Added unique index on workspace_members
7. **Open Architecture Questions** - Documents decisions that need answers before implementation

### Key Security Improvements:
- **Data Integrity:** Unique index prevents duplicate memberships
- **Authorization Completeness:** Read operations now require workspace permission
- **IDOR Prevention:** Workspace selection validated server-side on every request (including reads)
- **Enforcement Pattern:** Single `requireWorkspacePermission()` function prevents routes from missing checks
- **Token Security:** HMAC-SHA256 enables O(1) lookup while maintaining security
- **Owner Protection:** Last owner cannot be removed/downgraded (enforced in code)
- **Implementation Order:** Database indexes created first, session storage before API updates

### What This Means:
The original plan had the right features but was missing critical security infrastructure and had implementation ordering issues. These improvements ensure:
- No data integrity issues from duplicate memberships
- All data access (read and write) goes through workspace verification
- No user can manipulate workspace IDs to access other users' data
- Every API endpoint and server function is protected by default
- Invitation system scales beyond toy implementations
- Workspace owners cannot accidentally lock themselves out
- Implementation proceeds in the correct dependency order

---

## Latest Plan Refinements (January 2026)

This plan was further refined based on comprehensive review of current codebase and best practices.

### Additional Issues Addressed:

1. **Duplicate Appwrite Client Patterns** (CRITICAL)
   - Found two conflicting patterns: `api-auth.ts` and `appwrite-server.ts`
   - **Fixed:** Consolidated all client logic into `api-auth.ts`, deleted `appwrite-server.ts`
   - Now uses both session client (for account prefs) and API key client (for database ops)

2. **Missing Type Definitions** (HIGH)
   - Types like `WorkspaceMemberRole`, `Permission`, `InvitationDetails` were referenced but not defined
   - **Fixed:** Added comprehensive type definitions section at the beginning (workspace-types.ts, collection-names.ts)

3. **New User Workspace Initialization** (CRITICAL)
   - No automatic workspace creation for new signups
   - **Fixed:** Added Phase 0 to create workspace on signup and handle legacy users

4. **Error Response Format Inconsistent** (MEDIUM)
   - Plan showed throwing errors instead of returning NextResponse
   - **Fixed:** Updated all patterns to use `NextResponse.json()` with proper HTTP status codes

5. **Missing Server Component Audit** (HIGH)
   - Server components could bypass workspace guards by calling data.ts directly
   - **Fixed:** Added Phase 1.7 with comprehensive audit instructions

6. **HMAC Secret Management Missing** (MEDIUM)
   - No documentation on where to store HMAC secret or rotation strategy
   - **Fixed:** Added INVITATION_TOKEN_SECRET environment variable documentation in Phase 4.3

7. **Workspace Deletion Not Addressed** (MEDIUM)
   - No way for owners to delete workspaces
   - **Fixed:** Added Phase 4.6 with cascade deletion and safety checks

8. **User Self-Removal Missing** (MEDIUM)
   - No way for users to leave workspaces voluntarily
   - **Fixed:** Added Phase 4.7 with last owner protection

9. **Invitation Flow Unclear for Auth States** (LOW)
   - Didn't distinguish between logged-in and logged-out users clicking invite links
   - **Fixed:** Added implementation details for both auth states in Phase 4.3

10. **Phase Numbering Error** (LOW)
    - Referenced Phase 2.4 in implementation order but defined as Phase 2.5
    - **Fixed:** Corrected to Phase 2.4 throughout

11. **Authentication Pattern Regression Risk** (CRITICAL)
    - Plan's `getCurrentUser()` looked for Appwrite cookies, but system uses iron-session
    - Plan's `getApiContext()` could have broken authentication flow
    - **Fixed:**
      - Added "Authentication Architecture (iron-session)" section explaining the session flow
      - Updated Phase 1.3 Step 1 to remove incompatible `getCurrentUser()` function
      - Updated Phase 1.3 Step 2 to use `createSessionClient()` correctly with iron-session
      - Marked Open Architecture Question #1 as "ANSWERED - uses iron-session"
      - Added detailed CSRF protection TODO items

### New Sections Added:

1. **Type Definitions** - Centralized type system for workspace-related types
2. **Collection Names Constants** - Avoid magic strings throughout codebase
3. **Appwrite Client Patterns** - Explains when to use session vs API key client
4. **Authentication Architecture (iron-session)** - Documents current auth flow and prevents regression
5. **Phase 0** - New user workspace bootstrap
6. **Phase 1.7** - Server component audit for direct data access
7. **Phase 4.6** - Workspace deletion with cascade
8. **Phase 4.7** - User self-removal from workspace
9. **API Route Security Checklist** - Code review checklist for all API routes

### Implementation Improvements:

- **Client Pattern Consolidation:** Single source of truth in api-auth.ts
- **Error Standards:** All API routes return proper HTTP status codes (401/403/404/500)
- **Type Safety:** Shared types prevent inconsistencies across files
- **Collection Names:** Constants prevent typos and make refactoring easier
- **Comprehensive Coverage:** Workspace lifecycle from creation to deletion
- **Security Checklist:** Ensures consistent security patterns across all endpoints

### What Changed:

**Before:** Plan had architectural ambiguity about client patterns, missing lifecycle features, and inconsistent error handling.

**After:** Plan has clear client patterns, complete workspace lifecycle (create → join → leave → delete), standardized error responses, and comprehensive security checklist.

The plan is now ready for implementation with clear patterns, proper dependency ordering, and comprehensive coverage of all workspace operations.
