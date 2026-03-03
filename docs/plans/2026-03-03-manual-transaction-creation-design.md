# Manual Transaction Creation Feature Design

**Date:** 2026-03-03
**Status:** Approved
**Author:** Sky (Dev Agent)

## Overview

Add ability for users to manually create transactions via a "+" button on the ledger page. This enables users to add transactions that weren't imported from bank statements, such as cash transactions, corrections, or manual entries.

## User Experience

1. User clicks "+" button next to the filter button on the ledger page
2. DetailPanel drawer opens from the right with "Add Transaction" form
3. User fills in required fields (Date, Amount, Account) and optional fields (Category, Description, Currency, Notes)
4. User clicks "Save" button
5. Form validates and submits to API
6. On success, drawer closes and ledger refreshes
7. New transaction appears in list only if it matches current filter criteria

## Architecture

### High-Level Flow

```
User clicks "+" → DetailPanel drawer opens with NewTransactionForm
                       ↓
            Form validates client-side
                       ↓
            POST to /api/transactions
                       ↓
    API validates, checks permissions, creates transaction, logs audit
                       ↓
        Form closes drawer, triggers ledger refresh
                       ↓
    Transaction appears only if matching current filters
```

### Implementation Approach

**Approach 1: Dedicated API Endpoint** (Selected)
- Create POST /api/transactions route handler
- Follows existing API patterns (rate limiting, permissions, audit logging)
- Clear separation of concerns
- Easier to test and maintain

## Component Structure

### NewTransactionForm Component

**Type:** Client component with form state management

**Fields (in order):**
- Date picker (required) — defaults to today
- Amount input (required) — number input, accepts negative or positive
- Account dropdown (required) — populated from workspace accounts
- Category dropdown (optional) — populated from workspace categories, defaults to "Uncategorised"
- Description textarea (optional) — free text
- Currency field — defaults to workspace currency, can be changed
- Notes textarea (optional) — free text

**Form Validation:**
- Client-side validation using Zod schema before API call
- Required field indicators with red asterisks
- Inline error messages for validation failures
- Submit button disabled until required fields are filled

**Integration Points:**
- "+" button added to LedgerFilters area (FloatingActionButton or similar from @tandemly/ui)
- Opens DetailPanel drawer with title "Add Transaction"
- On successful creation, closes drawer and calls router.refresh() to reload ledger data
- Error handling shows toast notification or inline error message

**Loading States:**
- Submit button shows loading spinner during API call
- Form fields disabled during submission
- Drawer prevents closing during submission

## Data Flow and API Contract

### POST /api/transactions Endpoint

**Request Body Schema:**
```typescript
{
  date: string;           // ISO date string, required
  amount: number;         // required, negative = outflow, positive = inflow
  account_name: string;   // required, must match existing workspace account
  category_name?: string; // optional, defaults to "Uncategorised"
  description?: string;   // optional, free text
  currency?: string;      // optional, defaults to workspace currency
  notes?: string;         // optional, free text
}
```

**Server-Side Processing:**
1. Validate request with TransactionCreateSchema (Zod)
2. Check workspace permission with `requireWorkspacePermission(workspaceId, user.$id, 'write')`
3. Apply rate limiting with `DATA_RATE_LIMITS.write`
4. Derive direction from amount sign (amount < 0 ? "outflow" : "inflow")
5. Set `needs_review` flag based on category (true if "Uncategorised")
6. Set `is_transfer` based on category (true if "Transfer")
7. Generate unique transaction ID
8. Create document with fields:
   - workspace_id, date, description, amount, account_name, category_name, currency, direction, notes, is_transfer, needs_review
   - No import_id (manual transactions aren't linked to imports)
9. Write audit log with action: "create", resource_type: "transaction"
10. Return success response with transaction ID

**Response:**
- Success: `{ ok: true, id: string }` (201 Created)
- Error: `{ error: string }` with appropriate status code (400/401/403/500)

## Error Handling and Validation

### Client-Side Validation

- Required fields validated before submit enabled
- Amount must be non-zero number
- Date must be valid ISO date string
- Account must exist in workspace accounts list
- Inline error messages shown below each invalid field

### Server-Side Validation (TransactionCreateSchema)

```typescript
z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/), // ISO date format
  amount: z.number().refine(val => val !== 0, "Amount cannot be zero"),
  account_name: z.string().min(1, "Account is required"),
  category_name: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional()
})
```

### Error Scenarios

- 401 Unauthorized: User not authenticated → redirect to login
- 403 Forbidden: Insufficient workspace permissions → show error toast "You don't have permission to create transactions"
- 400 Bad Request: Validation failure → show specific field errors from Zod
- 500 Internal Server Error: Database/Appwrite failure → show generic error toast "Failed to create transaction. Please try again."

### Edge Cases

- Duplicate transaction detection: None (manual transactions can be identical, user's responsibility)
- Account doesn't exist: Validation against workspace accounts before submission
- Invalid currency code: Accept any string, defaults to workspace currency if empty
- Past/future dates: Allow any valid date (no restrictions)

## Testing Strategy

### TDD Workflow

All implementation will follow Test-Driven Development:
1. Write failing test first
2. Write minimal code to pass test
3. Refactor if needed
4. Repeat

### Unit Tests

**lib/validations.ts - TransactionCreateSchema validation tests:**
- Valid transaction data passes validation
- Missing required fields rejected
- Zero amount rejected
- Invalid date format rejected
- Optional fields handled correctly

### Integration Tests

**app/api/transactions/route.test.ts - POST endpoint tests:**
- Successful transaction creation returns 201 with transaction ID
- Unauthenticated requests return 401
- Insufficient permissions return 403
- Invalid data returns 400 with validation errors
- Rate limiting enforced
- Audit log entry created
- Direction correctly derived from amount sign
- Defaults applied correctly (category, currency, needs_review, is_transfer)

### Component Tests

**NewTransactionForm.test.tsx - Form component tests:**
- Required fields show validation errors when empty
- Submit button disabled until required fields filled
- Form resets after successful submission
- Error messages displayed for API failures
- Loading state shown during submission
- Drawer closes after successful creation

### E2E Tests

- User flow: Open drawer → fill form → submit → see new transaction in list (if matches filters)
- User flow: Create transaction that doesn't match current filters → confirm not shown in list
- User flow: Submit invalid data → see validation errors → correct and resubmit successfully

### Manual Testing Checklist

- Create transaction with all fields filled
- Create transaction with only required fields
- Create negative amount (outflow) and verify direction
- Create positive amount (inflow) and verify direction
- Verify "Uncategorised" shows needs_review flag
- Verify "Transfer" category sets is_transfer flag
- Test with various filter combinations

## Files to Modify/Create

### New Files
- `apps/web/app/api/transactions/route.ts` - POST endpoint handler
- `apps/web/app/(shell)/ledger/NewTransactionForm.tsx` - Form component
- `apps/web/app/api/transactions/__tests__/route.test.ts` - API integration tests
- `apps/web/app/(shell)/ledger/__tests__/NewTransactionForm.test.tsx` - Component tests

### Modified Files
- `apps/web/lib/validations.ts` - Add TransactionCreateSchema
- `apps/web/app/(shell)/ledger/page.tsx` - Add "+" button to SectionHead
- `apps/web/app/(shell)/ledger/LedgerClient.tsx` - Handle drawer state and refresh

## Implementation Notes

- Manual transactions do NOT have an `import_id` field (distinguishes them from imported transactions)
- Direction is auto-inferred from amount sign (negative = outflow, positive = inflow)
- Category defaults to "Uncategorised" which sets `needs_review: true`
- Currency defaults to workspace default currency
- New transactions respect current filter criteria (may not appear after creation if filters don't match)
- Follow existing patterns from TransactionDetail and LedgerFilters for UI consistency

## Success Criteria

- Users can create manual transactions with all required and optional fields
- Validation prevents invalid data on both client and server
- Transactions appear in ledger only when matching current filters
- Audit log captures all manual transaction creations
- All tests pass (unit, integration, component, E2E)
- No regression in existing transaction functionality
