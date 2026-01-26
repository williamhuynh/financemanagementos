# Multi-Workspace Feature

## Overview

The Finance Management Tool now supports **multi-workspace collaboration**, allowing users to:
- Create multiple workspaces for different financial contexts (personal, business, family, etc.)
- Invite collaborators with role-based permissions
- Switch between workspaces seamlessly
- Maintain complete data isolation between workspaces

## User Roles

### Owner
- Full control over workspace
- Can perform all actions
- **Cannot be removed** (workspace protection)
- Automatically assigned to workspace creator

### Admin
- Manage workspace members
- Invite and remove users
- Close/reopen months
- All editor permissions

### Editor
- Create, edit, and delete transactions
- Manage assets and categories
- Cannot perform administrative tasks

### Viewer
- **Read-only access**
- View all data but cannot make changes
- Ideal for accountants or external advisors

## Getting Started

### Creating Your First Workspace

When you sign up, a default workspace is automatically created with the format:
```
{Your Name}'s Workspace
```

You are added as the **owner** of this workspace.

### Creating Additional Workspaces

1. Click your user chip in the topbar
2. Select "Create New Workspace"
3. Enter workspace details
4. You become the owner

### Switching Between Workspaces

If you're a member of multiple workspaces:
1. Use the workspace dropdown in the topbar
2. Select the workspace you want to view
3. The page will refresh with the selected workspace's data

**Note:** The workspace switcher is hidden if you only have one workspace.

## Inviting Team Members

### As an Owner or Admin

1. Navigate to **Settings** from the sidebar
2. In the **Members** section, click "Invite Member"
3. Enter the collaborator's email address
4. Select their role (Viewer, Editor, or Admin)
5. Click "Send Invitation"
6. Copy the invitation URL and share it with them

### Invitation Details

- Invitations expire after **7 days**
- Each invitation is single-use
- The invitation URL is unique and secure
- Recipients must sign in with the invited email address

## Accepting Invitations

### If You Have an Account

1. Click the invitation link
2. Sign in if not already signed in
3. Verify the workspace details
4. Click "Accept Invitation"
5. You'll be automatically switched to the new workspace

### If You're New

1. Click the invitation link
2. Click "Create Account"
3. Sign up with the email address that received the invitation
4. You'll be redirected back to accept the invitation
5. Click "Accept Invitation"

## Managing Members

### Viewing Members

**Settings > Members** shows:
- All current members with their roles
- Pending invitations
- Member sort order: Owners → Admins → Editors → Viewers

### Removing Members

**As Owner or Admin:**
1. Go to Settings > Members
2. Find the member to remove
3. Click "Remove"
4. Confirm the action

**Protections:**
- Owners cannot be removed
- You cannot remove yourself (use "Leave Workspace" instead)

### Canceling Invitations

**As Owner or Admin:**
1. Go to Settings > Members
2. Find the pending invitation
3. Click "Cancel"
4. The invitation link will no longer work

## Data Isolation

### Complete Separation

Each workspace maintains completely isolated data:
- Transactions
- Assets and asset values
- Categories and rules
- Accounts
- Imports
- Monthly closes

**You cannot access another workspace's data**, even by manipulating API calls. All requests are authenticated and authorized.

### Database Security

- Unique indexes prevent duplicate memberships
- All queries are filtered by `workspace_id`
- Permission checks on every API request
- 401 Unauthorized for unauthenticated requests
- 403 Forbidden for insufficient permissions

## Permissions Reference

### Read Permission
**Who has it:** All roles

**What it allows:**
- View dashboard
- View ledger
- View assets
- View reports
- List categories and accounts

### Write Permission
**Who has it:** Editor, Admin, Owner

**What it allows:**
- Create/edit/delete transactions
- Create/edit/delete assets
- Create/edit asset values
- Import bank statements

### Delete Permission
**Who has it:** Editor, Admin, Owner

**What it allows:**
- Delete imports
- Delete asset values
- Remove transfer pairs

### Admin Permission
**Who has it:** Admin, Owner

**What it allows:**
- Close/reopen months
- Process cash logs
- Commit transactions
- Invite members
- Remove members (except owner)
- Cancel invitations

## Best Practices

### Workspace Organization

**Personal Finance:**
- Create one workspace for personal finances
- Invite spouse/partner as Admin or Editor
- Invite financial advisor as Viewer

**Business:**
- Create separate workspaces for each business entity
- Invite bookkeeper as Editor
- Invite accountant as Viewer
- Invite business partner as Admin

**Family:**
- Create family workspace
- Invite all family members
- Assign roles based on responsibility

### Role Assignment Guidelines

**Assign Owner to:**
- Primary decision maker
- Person responsible for the financial entity

**Assign Admin to:**
- Trusted collaborators who need to manage the workspace
- Accountants who need to close months

**Assign Editor to:**
- People who enter transactions regularly
- Bookkeepers
- Family members who contribute to finances

**Assign Viewer to:**
- External advisors
- Accountants who only need to review
- Stakeholders who need visibility but not edit access

### Security Tips

1. **Don't share invitation links publicly**
   - Send via email or secure messaging
   - Links are valid for 7 days

2. **Review members regularly**
   - Remove members who no longer need access
   - Check pending invitations and cancel if needed

3. **Use appropriate roles**
   - Don't give Admin access unless necessary
   - Start with Viewer for new collaborators

4. **Protect your account**
   - Use a strong password
   - Enable two-factor authentication (if available)
   - Don't share your credentials

## API Reference

### Workspace Endpoints

```
GET /api/workspaces
- List all workspaces user is a member of

POST /api/workspaces/switch
- Switch active workspace
- Body: { workspaceId: string }

GET /api/workspaces/[id]/members
- List workspace members
- Requires: read permission

DELETE /api/workspaces/[id]/members/[memberId]
- Remove member from workspace
- Requires: admin permission
```

### Invitation Endpoints

```
GET /api/workspaces/[id]/invitations
- List pending invitations
- Requires: admin permission

POST /api/workspaces/[id]/invitations
- Create new invitation
- Requires: admin permission
- Body: { email: string, role: WorkspaceMemberRole }

DELETE /api/workspaces/[id]/invitations/[invitationId]
- Cancel pending invitation
- Requires: admin permission

GET /api/invitations/verify?token=xxx
- Verify invitation token (public)
- Returns: workspace name, role, email

POST /api/invitations/accept
- Accept invitation
- Requires: authenticated user
- Body: { token: string }
```

## Troubleshooting

### "Forbidden" Errors

**Problem:** You get a 403 Forbidden error

**Solutions:**
- Verify you're a member of the workspace
- Check your role has sufficient permissions
- Try refreshing the page
- Contact the workspace owner

### Can't See Workspace Switcher

**Problem:** Workspace dropdown doesn't appear

**Solution:** This is normal if you only have one workspace. Create or get invited to another workspace to see the switcher.

### Invitation Link Doesn't Work

**Problem:** "Invalid or expired invitation" error

**Possible causes:**
- Invitation expired (7 days old)
- Invitation already accepted
- Invitation cancelled by admin
- Token corrupted (check the full URL was copied)

**Solution:** Ask the workspace admin to send a new invitation

### Email Mismatch Error

**Problem:** "This invitation was sent to a different email address"

**Solution:**
- Sign out
- Sign in with the email that received the invitation
- Or ask admin to send invitation to your current email

## Technical Details

### Security Implementation

**Token Hashing:**
- Invitation tokens use HMAC-SHA256
- Raw tokens never stored in database
- One-time use enforcement

**Database Indexes:**
- Unique constraint on `(workspace_id, user_id)`
- Performance indexes on all workspace queries
- Prevents duplicate memberships

**API Security:**
- All routes validate workspace membership
- Permission checks on every request
- Consistent error handling

### Performance

**Optimizations:**
- Database indexes on all workspace-scoped collections
- Efficient query filtering
- Minimal API calls on workspace switch

**Expected Performance:**
- Dashboard load: < 2 seconds
- Workspace switch: < 1 second
- Member listing: < 500ms

## Future Enhancements

Planned features for future releases:
- Workspace deletion
- User self-removal ("Leave Workspace")
- Workspace settings customization
- Usage analytics per workspace
- Billing per workspace
- Workspace templates

## Support

For issues or questions:
1. Check this documentation
2. Review the testing plan in `.claude/testing-plan.md`
3. See implementation details in `.claude/multi-workspace-completion-summary.md`
4. Contact the development team

---

**Version:** 1.0
**Last Updated:** 2026-01-26
**Status:** Production Ready (pending testing)
