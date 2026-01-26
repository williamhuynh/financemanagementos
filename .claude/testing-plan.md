# Multi-Workspace Testing Plan

## Test Environment Setup
- Local development environment with Appwrite
- Two test user accounts (User A, User B)
- Multiple test workspaces

## Phase 1: Workspace Isolation Tests

### Test 1.1: Data Isolation Between Workspaces
**Objective:** Verify that data from one workspace is never visible in another workspace

**Steps:**
1. Create Workspace A and Workspace B
2. Add transactions, assets, and categories to Workspace A
3. Switch to Workspace B
4. Verify that Workspace A's data is NOT visible in:
   - Dashboard
   - Ledger
   - Assets page
   - Review page
   - Reports

**Expected:** All data views show only Workspace B's data (empty if new workspace)

### Test 1.2: API Route Workspace Filtering
**Objective:** Verify API routes filter by workspaceId

**Steps:**
1. Create transactions in Workspace A
2. Use browser devtools to inspect API calls when viewing dashboard
3. Verify `workspaceId` parameter is passed in queries
4. Verify returned data belongs only to current workspace

**Expected:** All API responses contain only data from the active workspace

### Test 1.3: Direct API Access Prevention
**Objective:** Verify users cannot access other workspaces' data via API manipulation

**Steps:**
1. Get Workspace A's ID
2. Switch to Workspace B
3. Try to access Workspace A's data via API:
   - `GET /api/transactions?workspaceId=<workspace-a-id>`
   - `GET /api/assets?workspaceId=<workspace-a-id>`
4. Verify request is rejected with 403 Forbidden

**Expected:** All requests to other workspaces are blocked

## Phase 2: Permission Enforcement Tests

### Test 2.1: Owner Permissions
**Objective:** Verify owners have full access

**Steps:**
1. As owner, test all operations:
   - Create/edit/delete transactions
   - Create/edit/delete assets
   - Close/reopen months (admin operations)
   - Invite members
   - Remove members

**Expected:** All operations succeed

### Test 2.2: Admin Permissions
**Objective:** Verify admins can perform admin operations

**Steps:**
1. Create workspace as User A (owner)
2. Invite User B as admin
3. As User B (admin), test:
   - Close/reopen months
   - Invite new members
   - Remove non-owner members
   - Try to remove owner (should fail)

**Expected:** Admin operations succeed except owner removal

### Test 2.3: Editor Permissions
**Objective:** Verify editors can write but not perform admin operations

**Steps:**
1. Invite User B as editor
2. As User B (editor), test:
   - Create/edit/delete transactions (should succeed)
   - Create/edit/delete assets (should succeed)
   - Try to close month (should fail - requires admin)
   - Try to invite members (should fail - requires admin)

**Expected:** Write operations succeed, admin operations fail

### Test 2.4: Viewer Permissions
**Objective:** Verify viewers have read-only access

**Steps:**
1. Invite User B as viewer
2. As User B (viewer), verify:
   - Can view dashboard, ledger, reports (read access)
   - Cannot create/edit/delete transactions
   - Cannot create/edit/delete assets
   - Cannot close months
   - Cannot invite members

**Expected:** Read operations succeed, all write/delete/admin operations fail

### Test 2.5: Permission Downgrade
**Objective:** Verify permission changes take effect immediately

**Steps:**
1. User B starts as admin
2. Owner changes User B's role to viewer
3. User B refreshes page
4. Verify User B can no longer perform admin operations

**Expected:** Permission changes are enforced immediately

## Phase 3: Invitation System Tests

### Test 3.1: Create and Send Invitation
**Objective:** Verify invitation creation flow

**Steps:**
1. As owner/admin, go to Settings
2. Click "Invite Member"
3. Enter email and select role
4. Submit invitation
5. Copy invitation URL

**Expected:** Invitation created, URL displayed

### Test 3.2: Accept Invitation (Existing User)
**Objective:** Verify existing users can accept invitations

**Steps:**
1. Create invitation for User B's email
2. Sign in as User B
3. Open invitation URL
4. Accept invitation
5. Verify User B is now member of workspace
6. Verify User B's active workspace switched to new workspace

**Expected:** User added to workspace, workspace switched

### Test 3.3: Accept Invitation (New User)
**Objective:** Verify new users can create account and accept invitation

**Steps:**
1. Create invitation for new email address
2. Open invitation URL (not signed in)
3. Click "Create Account"
4. Complete signup with invited email
5. Verify redirected back to invitation
6. Accept invitation

**Expected:** New user created, added to workspace

### Test 3.4: Invalid/Expired Invitation
**Objective:** Verify invalid invitations are rejected

**Steps:**
1. Try to use invitation URL with invalid token
2. Try to use already-accepted invitation
3. (If testing expiry) Try to use invitation after 7 days

**Expected:** All cases show error message

### Test 3.5: Email Mismatch
**Objective:** Verify invitation email validation

**Steps:**
1. Create invitation for `user-a@example.com`
2. Sign in as User B (`user-b@example.com`)
3. Try to accept invitation

**Expected:** Error message about email mismatch

### Test 3.6: Cancel Invitation
**Objective:** Verify pending invitations can be cancelled

**Steps:**
1. Create invitation
2. Go to Settings > Members
3. Find pending invitation
4. Click "Cancel"
5. Try to use invitation URL

**Expected:** Invitation cancelled, URL no longer works

## Phase 4: Member Management Tests

### Test 4.1: List Members
**Objective:** Verify members are displayed correctly

**Steps:**
1. Create workspace with multiple members (owner, admin, editor, viewer)
2. Go to Settings > Members
3. Verify all members are listed with correct roles

**Expected:** All members displayed, sorted by role (owner first)

### Test 4.2: Remove Member
**Objective:** Verify member removal works

**Steps:**
1. As owner/admin, go to Settings
2. Click "Remove" on a member (not owner)
3. Confirm removal
4. Verify member is removed from list

**Expected:** Member removed successfully

### Test 4.3: Owner Protection
**Objective:** Verify owners cannot be removed

**Steps:**
1. As admin, try to remove owner

**Expected:** Remove button not shown for owner, or removal fails

### Test 4.4: Self-Removal Prevention
**Objective:** Verify users cannot remove themselves via admin endpoint

**Steps:**
1. As admin, try to remove self using member removal

**Expected:** Error message suggesting use of "leave workspace" instead

## Phase 5: Workspace Switcher Tests

### Test 5.1: Display Workspaces
**Objective:** Verify workspace switcher shows all user's workspaces

**Steps:**
1. User is member of 3 workspaces
2. View topbar
3. Verify workspace dropdown shows all 3 workspaces

**Expected:** All workspaces listed

### Test 5.2: Switch Workspace
**Objective:** Verify switching workspaces works

**Steps:**
1. Note current workspace and its data
2. Select different workspace from dropdown
3. Verify page refreshes
4. Verify data changes to new workspace's data

**Expected:** Workspace switches, data updates

### Test 5.3: Hide Switcher for Single Workspace
**Objective:** Verify switcher is hidden when user has only one workspace

**Steps:**
1. User has only one workspace
2. View topbar

**Expected:** Workspace switcher not displayed

## Phase 6: Security Tests

### Test 6.1: SQL Injection Prevention
**Objective:** Verify Appwrite SDK prevents SQL injection

**Steps:**
1. Try malicious inputs in:
   - Transaction description: `'; DROP TABLE transactions; --`
   - Category name: `' OR '1'='1`
   - Asset name: `<script>alert('xss')</script>`

**Expected:** Inputs are safely stored and displayed, no code execution

### Test 6.2: XSS Prevention
**Objective:** Verify user input is sanitized

**Steps:**
1. Create transaction with description containing:
   - `<script>alert('xss')</script>`
   - `<img src=x onerror=alert('xss')>`
2. View transaction in ledger/dashboard

**Expected:** Scripts not executed, displayed as text

### Test 6.3: CSRF Protection
**Objective:** Verify state-changing operations are protected

**Steps:**
1. Try to make API calls from external page
2. Verify session cookies are httpOnly and sameSite

**Expected:** Cross-site requests fail

### Test 6.4: Rate Limiting
**Objective:** Verify invitation creation is rate-limited

**Steps:**
1. Try to create 100 invitations rapidly

**Expected:** Rate limit applied (depends on implementation)

## Phase 7: Edge Cases and Error Handling

### Test 7.1: Duplicate Membership Prevention
**Objective:** Verify unique index prevents duplicate memberships

**Steps:**
1. Try to add same user to workspace twice (via invitation)

**Expected:** Second invitation either replaces first or shows error

### Test 7.2: Last Owner Protection
**Objective:** Verify workspace always has at least one owner

**Steps:**
1. Try to change owner's role to admin
2. Try to remove owner when they're the only member

**Expected:** Operations fail with appropriate error

### Test 7.3: Concurrent Workspace Switch
**Objective:** Verify race conditions are handled

**Steps:**
1. Open two browser tabs
2. Switch to different workspaces in each tab simultaneously
3. Verify final state is consistent

**Expected:** No data corruption, consistent state

### Test 7.4: Network Failure Handling
**Objective:** Verify graceful degradation

**Steps:**
1. Simulate network failure during:
   - Workspace switch
   - Invitation acceptance
   - Member removal
2. Verify appropriate error messages

**Expected:** User-friendly error messages, no crashes

## Phase 8: Performance Tests

### Test 8.1: Large Dataset Performance
**Objective:** Verify performance with large datasets

**Setup:**
- Create workspace with 1000+ transactions
- Create workspace with 50+ assets

**Steps:**
1. Load dashboard
2. Load ledger
3. Switch between workspaces
4. Measure page load times

**Expected:** Acceptable performance (< 2 seconds for dashboard load)

### Test 8.2: Index Effectiveness
**Objective:** Verify indexes improve query performance

**Steps:**
1. Use browser devtools to monitor API response times
2. Verify queries use indexes (check database query plans if possible)

**Expected:** Fast query responses (< 500ms)

## Test Execution Checklist

### Pre-Testing
- [ ] Fresh database with test data
- [ ] Two test user accounts created
- [ ] Appwrite indexes verified (`node scripts/appwrite-create-indexes.mjs`)
- [ ] Local development server running

### Phase 1: Workspace Isolation
- [ ] Test 1.1: Data Isolation
- [ ] Test 1.2: API Filtering
- [ ] Test 1.3: Direct Access Prevention

### Phase 2: Permissions
- [ ] Test 2.1: Owner Permissions
- [ ] Test 2.2: Admin Permissions
- [ ] Test 2.3: Editor Permissions
- [ ] Test 2.4: Viewer Permissions
- [ ] Test 2.5: Permission Downgrade

### Phase 3: Invitations
- [ ] Test 3.1: Create Invitation
- [ ] Test 3.2: Accept (Existing User)
- [ ] Test 3.3: Accept (New User)
- [ ] Test 3.4: Invalid/Expired
- [ ] Test 3.5: Email Mismatch
- [ ] Test 3.6: Cancel Invitation

### Phase 4: Member Management
- [ ] Test 4.1: List Members
- [ ] Test 4.2: Remove Member
- [ ] Test 4.3: Owner Protection
- [ ] Test 4.4: Self-Removal Prevention

### Phase 5: Workspace Switcher
- [ ] Test 5.1: Display Workspaces
- [ ] Test 5.2: Switch Workspace
- [ ] Test 5.3: Hide for Single Workspace

### Phase 6: Security
- [ ] Test 6.1: SQL Injection
- [ ] Test 6.2: XSS Prevention
- [ ] Test 6.3: CSRF Protection
- [ ] Test 6.4: Rate Limiting

### Phase 7: Edge Cases
- [ ] Test 7.1: Duplicate Membership
- [ ] Test 7.2: Last Owner Protection
- [ ] Test 7.3: Concurrent Switch
- [ ] Test 7.4: Network Failure

### Phase 8: Performance
- [ ] Test 8.1: Large Dataset
- [ ] Test 8.2: Index Effectiveness

## Known Issues / Technical Debt
- [ ] workspace_invitations.idx_email index pending Appwrite attribute provisioning
- [ ] Monthly snapshots collection doesn't support workspaces yet
- [ ] Legacy users without workspaces need migration (Phase 5.1)

## Success Criteria
- ✅ All Phase 1-5 tests pass
- ✅ All Phase 6 security tests pass
- ✅ No data leakage between workspaces
- ✅ All permissions enforced correctly
- ✅ Invitation flow works end-to-end
- ✅ Performance meets targets
