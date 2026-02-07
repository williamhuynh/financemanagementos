# Testing Plan

See [ROADMAP.md](ROADMAP.md) for current status. **No automated tests exist yet** — this is a Phase 2 blocker.

---

## Automated Tests (To Build)

### Unit Tests
- CSV mapping and normalization (column mapping, date parsing, amount parsing).
- Categorization rules and confidence scoring.
- Transfer matching heuristics (amount, direction, date window).
- Permission helper (`hasPermission` for each role).

### Integration Tests
- **Auth flow:** signup → email verification → login → session validation → logout.
- **Import pipeline:** upload CSV → preview → map columns → detect duplicates → commit to ledger.
- **Review queue:** assign category, match transfer, dismiss duplicate.
- **Monthly close:** generate snapshot → close month → verify totals → reopen.
- **Permission enforcement:** viewer can't write, editor can't admin, non-member gets 403.

### Fixtures
- CSV samples per institution for parsing and normalization.
- Edge-case samples: refunds, reversals, split transactions.

### Validation
- Compare dashboard totals to manual checks.
- Verify duplicate detection reduces false positives.

---

## Manual Test Plan — Multi-Workspace

26 test cases across 8 phases. See [.claude/testing-plan.md](../.claude/testing-plan.md) for the full detailed plan with step-by-step instructions.

### Phase 1: Workspace Isolation (3 tests)
- [ ] 1.1 Data isolation between workspaces
- [ ] 1.2 API route workspace filtering
- [ ] 1.3 Direct API access prevention (IDOR)

### Phase 2: Permission Enforcement (5 tests)
- [ ] 2.1 Owner has full access
- [ ] 2.2 Admin permissions (close months, invite, remove non-owners)
- [ ] 2.3 Editor permissions (write but not admin)
- [ ] 2.4 Viewer read-only access
- [ ] 2.5 Permission downgrade takes effect immediately

### Phase 3: Invitation System (6 tests)
- [ ] 3.1 Create and send invitation
- [ ] 3.2 Accept invitation (existing user)
- [ ] 3.3 Accept invitation (new user signup)
- [ ] 3.4 Invalid/expired invitation rejected
- [ ] 3.5 Email mismatch error
- [ ] 3.6 Cancel invitation

### Phase 4: Member Management (4 tests)
- [ ] 4.1 List members with correct roles
- [ ] 4.2 Remove member
- [ ] 4.3 Owner protection (cannot be removed)
- [ ] 4.4 Self-removal prevention

### Phase 5: Workspace Switcher (3 tests)
- [ ] 5.1 Display all user's workspaces
- [ ] 5.2 Switch workspace loads correct data
- [ ] 5.3 Switcher hidden for single workspace

### Phase 6: Security (4 tests)
- [ ] 6.1 Injection prevention (SQL, XSS)
- [ ] 6.2 XSS prevention in user content
- [ ] 6.3 CSRF protection (httpOnly, sameSite cookies)
- [ ] 6.4 Rate limiting (once implemented)

### Phase 7: Edge Cases (4 tests)
- [ ] 7.1 Duplicate membership prevention
- [ ] 7.2 Last owner protection
- [ ] 7.3 Concurrent workspace switch
- [ ] 7.4 Network failure handling

### Phase 8: Performance (2 tests)
- [ ] 8.1 Large dataset (1000+ transactions)
- [ ] 8.2 Index effectiveness (< 500ms queries)

---

## Known Issues
- `workspace_invitations.idx_email` index may still be pending Appwrite attribute provisioning
- `monthly_snapshots` collection doesn't include `workspace_id` yet (non-critical)
