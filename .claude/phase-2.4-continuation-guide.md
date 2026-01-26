# Phase 2.4 Continuation Guide

## Overview
Phase 2.4 requires adding `requireWorkspacePermission()` checks to all API routes to enforce role-based access control.

## Progress: 50% Complete (5/16 routes done)

### ✅ Completed Routes
1. `/api/imports/route.ts` - POST ('write'), GET ('read')
2. `/api/imports/[id]/route.ts` - DELETE ('delete')
3. `/api/transactions/[id]/route.ts` - PATCH ('write')
4. `/api/assets/route.ts` - POST ('write')
5. `/api/assets/[id]/route.ts` - PATCH ('write'), DELETE ('delete')

### ⏳ Remaining Routes (11 files)
1. `/api/assets/values/route.ts` - POST ('write'), GET ('read')
2. `/api/assets/values/[id]/route.ts` - PATCH ('write'), DELETE ('delete')
3. `/api/cash-logs/route.ts` - GET ('read'), POST ('write')
4. `/api/cash-logs/[id]/route.ts` - PATCH ('write'), DELETE ('delete')
5. `/api/cash-logs/commit/route.ts` - POST ('admin')
6. `/api/cash-logs/process/route.ts` - POST ('admin')
7. `/api/categories/route.ts` - GET ('read'), POST ('write')
8. `/api/transfer-pairs/route.ts` - GET ('read'), POST ('write')
9. `/api/accounts/route.ts` - GET ('read')
10. `/api/transcribe/route.ts` - POST ('write')

Note: `/api/transfer-pairs/[id]/route.ts` already completed in Phase 1.5

## Standard Update Pattern

### 1. Add Import
```typescript
import { requireWorkspacePermission } from "../../../lib/workspace-guard"; // adjust path
```

### 2. Wrap Function in Try-Catch
```typescript
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check permission (adjust based on operation)
    await requireWorkspacePermission(workspaceId, user.$id, 'write');

    // ... existing route logic ...

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 3. Permission Mapping
- **GET** - Use `'read'`
- **POST (create/update)** - Use `'write'`
- **PATCH** - Use `'write'`
- **DELETE** - Use `'delete'`
- **Admin operations** (monthly close, commit, process) - Use `'admin'`

### 4. Remove Nested Try-Catch
If the route has nested try-catch for verification (like checking if resource exists), flatten it:

**Before:**
```typescript
try {
  const existingAssets = await databases.listDocuments(...);
  if (existingAssets.documents.length === 0) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
} catch (error) {
  console.error("Error:", error);
  return NextResponse.json({ detail: "Error" }, { status: 500 });
}
```

**After:**
```typescript
const existingAssets = await databases.listDocuments(...);
if (existingAssets.documents.length === 0) {
  return NextResponse.json({ detail: "Not found" }, { status: 404 });
}
// Errors caught by outer try-catch
```

## Testing Checklist (After All Routes Updated)

### Security Tests
1. Unauthenticated access returns 401
2. User from Workspace A cannot access Workspace B data (returns 403)
3. Viewer cannot write/delete (returns 403)
4. Editor cannot perform admin operations (returns 403)
5. Admin cannot delete workspace (only owner can)

### Permission Matrix
| Role   | Read | Write | Delete | Admin | Owner |
|--------|------|-------|--------|-------|-------|
| Viewer | ✅   | ❌    | ❌     | ❌    | ❌    |
| Editor | ✅   | ✅    | ❌     | ❌    | ❌    |
| Admin  | ✅   | ✅    | ✅     | ✅    | ❌    |
| Owner  | ✅   | ✅    | ✅     | ✅    | ✅    |

## After Completion

When all 16 routes are updated:

1. Update `.claude/workspace-implementation-progress.md`:
   - Mark Phase 2.4 as COMPLETE
   - Move to Phase 5.2 (Database Indexes - CRITICAL)

2. Test all endpoints systematically with different roles

3. Proceed to Phase 5.2: Create database indexes
   - Unique index on `(workspace_id, user_id)` in `workspace_members`
   - Index on `workspace_id` in all data collections

## Notes

- All routes should already have `getApiContext()` and use `workspaceId` for queries
- The security checks add an additional authorization layer
- Pattern is consistent across all routes - only permission level changes
