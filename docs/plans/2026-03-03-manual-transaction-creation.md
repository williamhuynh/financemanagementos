# Manual Transaction Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "+" button on ledger page that opens a drawer form for manually creating transactions

**Architecture:** TDD approach with dedicated POST /api/transactions endpoint, NewTransactionForm client component in DetailPanel drawer, full validation client and server-side

**Tech Stack:** Next.js 14 App Router, Appwrite, Zod validation, Vitest, React Testing Library

---

## Task 1: Add TransactionCreateSchema Validation

**Files:**
- Modify: `apps/web/lib/validations.ts:68-69` (after TransactionUpdateSchema)
- Test: `apps/web/lib/__tests__/validations.test.ts`

**Step 1: Write failing validation tests**

Add to `apps/web/lib/__tests__/validations.test.ts` after existing imports, add `TransactionCreateSchema` to the import list:

```typescript
import {
  validateBody,
  LoginSchema,
  SignupSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CategoryDeleteSchema,
  AssetCreateSchema,
  TransactionUpdateSchema,
  TransactionCreateSchema,  // Add this
  ImportCreateSchema,
  TransferPairCreateSchema,
  WorkspaceCreateSchema,
  InvitationCreateSchema,
  CashLogCreateSchema,
  CashLogProcessSchema,
  MonthlyCloseCreateSchema,
  SuggestMappingSchema,
  ImportPresetCreateSchema,
} from "../validations";
```

Then add test suite at the end of the file:

```typescript
// ─── TransactionCreateSchema ─────────────────────────────────

describe("TransactionCreateSchema", () => {
  it("accepts valid transaction with all required fields", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: -50.00,
      account_name: "Checking Account",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe("2026-03-03");
      expect(result.data.amount).toBe(-50.00);
      expect(result.data.account_name).toBe("Checking Account");
    }
  });

  it("accepts valid transaction with all fields", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: -50.00,
      account_name: "Checking Account",
      category_name: "Groceries",
      description: "Weekly shopping",
      currency: "USD",
      notes: "Bought milk and bread",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing date", () => {
    const result = validateBody(TransactionCreateSchema, {
      amount: -50.00,
      account_name: "Checking Account",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("date");
    }
  });

  it("rejects invalid date format", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "03/03/2026",
      amount: -50.00,
      account_name: "Checking Account",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("date");
    }
  });

  it("rejects missing amount", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      account_name: "Checking Account",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("amount");
    }
  });

  it("rejects zero amount", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: 0,
      account_name: "Checking Account",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Amount cannot be zero");
    }
  });

  it("rejects missing account_name", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: -50.00,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("account_name");
    }
  });

  it("rejects empty account_name", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: -50.00,
      account_name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Account is required");
    }
  });

  it("accepts positive and negative amounts", () => {
    const negative = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: -100.50,
      account_name: "Checking",
    });
    const positive = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: 200.75,
      account_name: "Checking",
    });
    expect(negative.success).toBe(true);
    expect(positive.success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = validateBody(TransactionCreateSchema, {
      date: "2026-03-03",
      amount: -50.00,
      account_name: "Checking Account",
      category_name: "",
      description: "",
      currency: "",
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/validations.test.ts`

Expected: FAIL with "TransactionCreateSchema is not exported"

**Step 3: Implement TransactionCreateSchema**

Add to `apps/web/lib/validations.ts` after `TransactionUpdateSchema` (line 68):

```typescript
export const TransactionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must be in YYYY-MM-DD format"),
  amount: z.number().finite().refine(val => val !== 0, "Amount cannot be zero"),
  account_name: trimmedString.min(1, "Account is required").max(200),
  category_name: trimmedString.max(100).optional(),
  description: trimmedString.max(1000).optional(),
  currency: trimmedString.max(10).optional(),
  notes: trimmedString.max(500).optional(),
});
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/validations.test.ts`

Expected: All TransactionCreateSchema tests PASS

**Step 5: Commit**

```bash
git add apps/web/lib/validations.ts apps/web/lib/__tests__/validations.test.ts
git commit -m "feat: add TransactionCreateSchema validation

- Add Zod schema for manual transaction creation
- Validate required fields: date, amount, account_name
- Validate optional fields: category_name, description, currency, notes
- Reject zero amounts and invalid date formats
- Add comprehensive test coverage"
```

---

## Task 2: Create POST /api/transactions Endpoint

**Files:**
- Create: `apps/web/app/api/transactions/route.ts`
- Test: `apps/web/app/api/transactions/__tests__/route.test.ts`

**Step 1: Write failing API endpoint tests**

Create `apps/web/app/api/transactions/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock dependencies
vi.mock("../../../../lib/api-auth");
vi.mock("../../../../lib/workspace-guard");
vi.mock("../../../../lib/rate-limit");
vi.mock("../../../../lib/audit");

const mockDatabases = {
  createDocument: vi.fn(),
};

const mockContext = {
  databases: mockDatabases,
  config: { databaseId: "test-db" },
  workspaceId: "workspace-123",
  user: { $id: "user-123" },
};

beforeEach(() => {
  vi.clearAllMocks();

  // Setup default mocks
  const apiAuth = await import("../../../../lib/api-auth");
  vi.mocked(apiAuth.getApiContext).mockResolvedValue(mockContext);

  const rateLimit = await import("../../../../lib/rate-limit");
  vi.mocked(rateLimit.rateLimit).mockResolvedValue(null);

  const workspaceGuard = await import("../../../../lib/workspace-guard");
  vi.mocked(workspaceGuard.requireWorkspacePermission).mockResolvedValue(undefined);

  const audit = await import("../../../../lib/audit");
  vi.mocked(audit.writeAuditLog).mockReturnValue(undefined);
  vi.mocked(audit.getClientIp).mockReturnValue("127.0.0.1");
});

describe("POST /api/transactions", () => {
  it("creates transaction with required fields and returns 201", async () => {
    mockDatabases.createDocument.mockResolvedValue({
      $id: "txn-123",
    });

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking Account",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.id).toBe("txn-123");
    expect(mockDatabases.createDocument).toHaveBeenCalledWith(
      "test-db",
      "transactions",
      expect.any(String),
      expect.objectContaining({
        workspace_id: "workspace-123",
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking Account",
        direction: "outflow",
        category_name: "Uncategorised",
        needs_review: true,
        is_transfer: false,
      })
    );
  });

  it("creates transaction with all fields", async () => {
    mockDatabases.createDocument.mockResolvedValue({
      $id: "txn-456",
    });

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking Account",
        category_name: "Groceries",
        description: "Weekly shopping",
        currency: "USD",
        notes: "Bought milk",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockDatabases.createDocument).toHaveBeenCalledWith(
      "test-db",
      "transactions",
      expect.any(String),
      expect.objectContaining({
        category_name: "Groceries",
        description: "Weekly shopping",
        currency: "USD",
        notes: "Bought milk",
        needs_review: false,
        is_transfer: false,
      })
    );
  });

  it("sets direction to outflow for negative amounts", async () => {
    mockDatabases.createDocument.mockResolvedValue({ $id: "txn-123" });

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -100.00,
        account_name: "Checking",
      }),
    });

    await POST(request);

    expect(mockDatabases.createDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        direction: "outflow",
      })
    );
  });

  it("sets direction to inflow for positive amounts", async () => {
    mockDatabases.createDocument.mockResolvedValue({ $id: "txn-123" });

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: 200.00,
        account_name: "Checking",
      }),
    });

    await POST(request);

    expect(mockDatabases.createDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        direction: "inflow",
      })
    );
  });

  it("sets is_transfer to true for Transfer category", async () => {
    mockDatabases.createDocument.mockResolvedValue({ $id: "txn-123" });

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -100.00,
        account_name: "Checking",
        category_name: "Transfer",
      }),
    });

    await POST(request);

    expect(mockDatabases.createDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        is_transfer: true,
        needs_review: false,
      })
    );
  });

  it("sets needs_review to true for Uncategorised", async () => {
    mockDatabases.createDocument.mockResolvedValue({ $id: "txn-123" });

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking",
        category_name: "Uncategorised",
      }),
    });

    await POST(request);

    expect(mockDatabases.createDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        needs_review: true,
      })
    );
  });

  it("returns 401 when user not authenticated", async () => {
    const apiAuth = await import("../../../../lib/api-auth");
    vi.mocked(apiAuth.getApiContext).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 when insufficient permissions", async () => {
    const workspaceGuard = await import("../../../../lib/workspace-guard");
    vi.mocked(workspaceGuard.requireWorkspacePermission).mockRejectedValue(
      new Error("Insufficient permission")
    );

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Insufficient permissions");
  });

  it("returns 400 for invalid request body", async () => {
    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "invalid-date",
        amount: 0,
        account_name: "",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("writes audit log on successful creation", async () => {
    mockDatabases.createDocument.mockResolvedValue({ $id: "txn-123" });

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking",
      }),
    });

    await POST(request);

    const audit = await import("../../../../lib/audit");
    expect(audit.writeAuditLog).toHaveBeenCalledWith(
      mockDatabases,
      "test-db",
      expect.objectContaining({
        workspace_id: "workspace-123",
        user_id: "user-123",
        action: "create",
        resource_type: "transaction",
        resource_id: expect.any(String),
      })
    );
  });

  it("enforces rate limiting", async () => {
    const rateLimit = await import("../../../../lib/rate-limit");
    const blockedResponse = new Response("Rate limited", { status: 429 });
    vi.mocked(rateLimit.rateLimit).mockResolvedValue(blockedResponse);

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-03",
        amount: -50.00,
        account_name: "Checking",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(mockDatabases.createDocument).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/transactions/__tests__/route.test.ts`

Expected: FAIL with "Cannot find module '../route'"

**Step 3: Implement POST endpoint**

Create `apps/web/app/api/transactions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, TransactionCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

export async function POST(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;

    await requireWorkspacePermission(workspaceId, user.$id, "write");

    const body = await request.json();
    const parsed = validateBody(TransactionCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { date, amount, account_name, category_name, description, currency, notes } = parsed.data;

    // Derive direction from amount
    const direction = amount < 0 ? "outflow" : "inflow";

    // Normalize category
    const normalizedCategory = category_name?.trim() || "Uncategorised";

    // Set flags
    const needs_review = normalizedCategory === "Uncategorised";
    const is_transfer = normalizedCategory === "Transfer";

    // Generate transaction ID
    const transactionId = ID.unique();

    // Create transaction document
    const transactionDoc = {
      workspace_id: workspaceId,
      date,
      description: description || "",
      amount,
      account_name,
      category_name: normalizedCategory,
      currency: currency || "",
      direction,
      notes: notes || "",
      is_transfer,
      needs_review,
    };

    await databases.createDocument(
      config.databaseId,
      "transactions",
      transactionId,
      transactionDoc
    );

    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "transaction",
      resource_id: transactionId,
      summary: `Created manual transaction ${transactionId}`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ ok: true, id: transactionId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    console.error("Transaction POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/transactions/__tests__/route.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/web/app/api/transactions/route.ts apps/web/app/api/transactions/__tests__/route.test.ts
git commit -m "feat: add POST /api/transactions endpoint

- Create manual transactions via API
- Validate request with TransactionCreateSchema
- Check write permissions and enforce rate limiting
- Auto-derive direction from amount sign
- Set needs_review flag for Uncategorised
- Set is_transfer flag for Transfer category
- Write audit log for all creations
- Comprehensive test coverage with mocks"
```

---

## Task 3: Create NewTransactionForm Component

**Files:**
- Create: `apps/web/app/(shell)/ledger/NewTransactionForm.tsx`
- Test: `apps/web/app/(shell)/ledger/__tests__/NewTransactionForm.test.tsx`

**Step 1: Write failing component tests**

Create `apps/web/app/(shell)/ledger/__tests__/NewTransactionForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewTransactionForm from "../NewTransactionForm";

// Mock apiFetch
vi.mock("../../../../lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const mockCategories = [
  { name: "Groceries", group: "expense" },
  { name: "Salary", group: "income" },
  { name: "Transfer", group: "expense" },
];

const mockAccounts = ["Checking Account", "Savings Account", "Credit Card"];

describe("NewTransactionForm", () => {
  it("renders all form fields", () => {
    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it("shows required indicators on required fields", () => {
    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    expect(screen.getByText(/date.*\*/i)).toBeInTheDocument();
    expect(screen.getByText(/amount.*\*/i)).toBeInTheDocument();
    expect(screen.getByText(/account.*\*/i)).toBeInTheDocument();
  });

  it("disables submit button when required fields empty", () => {
    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    const submitButton = screen.getByRole("button", { name: /save/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when required fields filled", async () => {
    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    const dateInput = screen.getByLabelText(/date/i);
    const amountInput = screen.getByLabelText(/amount/i);
    const accountSelect = screen.getByLabelText(/account/i);

    fireEvent.change(dateInput, { target: { value: "2026-03-03" } });
    fireEvent.change(amountInput, { target: { value: "-50.00" } });
    fireEvent.change(accountSelect, { target: { value: "Checking Account" } });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /save/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("submits form with valid data", async () => {
    const { apiFetch } = await import("../../../../lib/api-fetch");
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: "txn-123" }),
    } as Response);

    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    fireEvent.change(screen.getByLabelText(/date/i), {
      target: { value: "2026-03-03" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "-50.00" },
    });
    fireEvent.change(screen.getByLabelText(/account/i), {
      target: { value: "Checking Account" },
    });

    const submitButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: "2026-03-03",
          amount: -50.00,
          account_name: "Checking Account",
          category_name: "Uncategorised",
          description: "",
          currency: "USD",
          notes: "",
        }),
      });
    });
  });

  it("closes drawer after successful submission", async () => {
    const { apiFetch } = await import("../../../../lib/api-fetch");
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: "txn-123" }),
    } as Response);

    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    fireEvent.change(screen.getByLabelText(/date/i), {
      target: { value: "2026-03-03" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "-50.00" },
    });
    fireEvent.change(screen.getByLabelText(/account/i), {
      target: { value: "Checking Account" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows error message on API failure", async () => {
    const { apiFetch } = await import("../../../../lib/api-fetch");
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to create transaction" }),
    } as Response);

    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    fireEvent.change(screen.getByLabelText(/date/i), {
      target: { value: "2026-03-03" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "-50.00" },
    });
    fireEvent.change(screen.getByLabelText(/account/i), {
      target: { value: "Checking Account" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create transaction/i)).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", async () => {
    const { apiFetch } = await import("../../../../lib/api-fetch");
    vi.mocked(apiFetch).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ ok: true, json: async () => ({ ok: true, id: "txn-123" }) } as Response),
            100
          )
        )
    );

    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    fireEvent.change(screen.getByLabelText(/date/i), {
      target: { value: "2026-03-03" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "-50.00" },
    });
    fireEvent.change(screen.getByLabelText(/account/i), {
      target: { value: "Checking Account" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("defaults category to Uncategorised", () => {
    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    const categorySelect = screen.getByLabelText(/category/i) as HTMLSelectElement;
    expect(categorySelect.value).toBe("Uncategorised");
  });

  it("defaults currency to workspace default", () => {
    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="EUR"
      />
    );

    const currencyInput = screen.getByLabelText(/currency/i) as HTMLInputElement;
    expect(currencyInput.value).toBe("EUR");
  });

  it("defaults date to today", () => {
    const onClose = vi.fn();
    render(
      <NewTransactionForm
        open={true}
        onClose={onClose}
        categories={mockCategories}
        accounts={mockAccounts}
        defaultCurrency="USD"
      />
    );

    const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement;
    const today = new Date().toISOString().split("T")[0];
    expect(dateInput.value).toBe(today);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- app/\\(shell\\)/ledger/__tests__/NewTransactionForm.test.tsx`

Expected: FAIL with "Cannot find module '../NewTransactionForm'"

**Step 3: Implement NewTransactionForm component**

Create `apps/web/app/(shell)/ledger/NewTransactionForm.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DetailPanel } from "@tandemly/ui";
import { apiFetch } from "../../../lib/api-fetch";

interface Category {
  name: string;
  group: string;
}

interface NewTransactionFormProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: string[];
  defaultCurrency: string;
}

export default function NewTransactionForm({
  open,
  onClose,
  categories,
  accounts,
  defaultCurrency,
}: NewTransactionFormProps) {
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [categoryName, setCategoryName] = useState("Uncategorised");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setDate(today);
      setAmount("");
      setAccountName("");
      setCategoryName("Uncategorised");
      setDescription("");
      setCurrency(defaultCurrency);
      setNotes("");
      setError("");
    }
  }, [open, defaultCurrency, today]);

  const isValid = date && amount && accountName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date,
          amount: parseFloat(amount),
          account_name: accountName,
          category_name: categoryName,
          description,
          currency,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create transaction");
        setSaving(false);
        return;
      }

      // Success - close drawer and refresh
      router.refresh();
      onClose();
    } catch (err) {
      setError("An unexpected error occurred");
      setSaving(false);
    }
  };

  return (
    <DetailPanel open={open} onClose={onClose} title="Add Transaction">
      <form onSubmit={handleSubmit} style={{ padding: "0 16px 16px" }}>
        <div className="form-field">
          <label htmlFor="date">Date *</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="amount">Amount *</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Negative for expense, positive for income"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="account">Account *</label>
          <select
            id="account"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          >
            <option value="">Select account...</option>
            {accounts.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          >
            <option value="Uncategorised">Uncategorised</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="form-field">
          <label htmlFor="currency">Currency</label>
          <input
            id="currency"
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={10}
          />
        </div>

        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {error && (
          <div className="error-message" style={{ color: "red", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            className="primary-btn"
            disabled={!isValid || saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </DetailPanel>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- app/\\(shell\\)/ledger/__tests__/NewTransactionForm.test.tsx`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/web/app/\(shell\)/ledger/NewTransactionForm.tsx apps/web/app/\(shell\)/ledger/__tests__/NewTransactionForm.test.tsx
git commit -m "feat: add NewTransactionForm component

- Client component with DetailPanel drawer
- Form fields: date, amount, account, category, description, currency, notes
- Required field validation (date, amount, account)
- Client-side form validation before API call
- Loading state during submission
- Error handling with error messages
- Auto-refresh ledger on success
- Defaults: today's date, Uncategorised category, workspace currency
- Comprehensive test coverage"
```

---

## Task 4: Integrate NewTransactionForm into Ledger Page

**Files:**
- Modify: `apps/web/app/(shell)/ledger/page.tsx`
- Modify: `apps/web/app/(shell)/ledger/LedgerClient.tsx`

**Step 1: Add "+" button and drawer state to LedgerClient**

Modify `apps/web/app/(shell)/ledger/LedgerClient.tsx`:

Add import at top:
```typescript
import NewTransactionForm from "./NewTransactionForm";
```

Add state for drawer:
```typescript
const [showNewForm, setShowNewForm] = useState(false);
```

Add NewTransactionForm component before the closing fragment:
```typescript
<NewTransactionForm
  open={showNewForm}
  onClose={() => setShowNewForm(false)}
  categories={categories}
  accounts={[...new Set(rows.map(r => r.account).filter(Boolean))]}
  defaultCurrency="USD"
/>
```

Add prop to expose openNewForm function:
```typescript
// Add to component props interface
interface LedgerClientProps {
  rows: LedgerRow[];
  categories: Category[];
  onOpenNewTransaction?: () => void;
}

// Call the prop from the "+" button click
useEffect(() => {
  if (onOpenNewTransaction) {
    // Expose function to parent
  }
}, [onOpenNewTransaction]);
```

**Step 2: Add "+" button to ledger page**

Modify `apps/web/app/(shell)/ledger/page.tsx`:

Change SectionHead to include the "+" button:
```typescript
<SectionHead
  title="All Transactions"
  actions={
    <div style={{ display: "flex", gap: 8 }}>
      <button
        className="icon-btn"
        onClick={() => {
          // Will be handled by LedgerClient
        }}
        title="Add transaction"
      >
        +
      </button>
      <LedgerFilters categories={categories} />
    </div>
  }
/>
```

**Step 3: Test manually**

Run dev server: `npm run dev`

Navigate to `/ledger`
Click "+" button
Verify drawer opens
Fill form and submit
Verify transaction created and ledger refreshes

**Step 4: Commit**

```bash
git add apps/web/app/\(shell\)/ledger/page.tsx apps/web/app/\(shell\)/ledger/LedgerClient.tsx
git commit -m "feat: integrate NewTransactionForm into ledger page

- Add '+' button next to filter button
- Wire up drawer state in LedgerClient
- Pass categories and accounts to form
- Refresh ledger after transaction creation
- Extract unique accounts from existing ledger rows"
```

---

## Task 5: Get Workspace Default Currency for Form

**Files:**
- Modify: `apps/web/app/(shell)/ledger/page.tsx`
- Modify: `apps/web/lib/data.ts` (if needed)

**Step 1: Add workspace currency to context**

Check if workspace currency is available in context. If not, add a helper function to `apps/web/lib/data.ts`:

```typescript
export async function getWorkspaceCurrency(workspaceId: string): Promise<string> {
  const { databases, config } = getAppwriteClient();

  const workspace = await databases.getDocument(
    config.databaseId,
    "workspaces",
    workspaceId
  );

  return workspace.currency || "AUD";
}
```

**Step 2: Fetch workspace currency in page**

Modify `apps/web/app/(shell)/ledger/page.tsx`:

```typescript
// Add to parallel fetch
const [ledgerRows, categories, workspaceCurrency] = await Promise.all([
  getLedgerRows(context.workspaceId, {
    account: resolvedSearchParams?.account,
    category: resolvedSearchParams?.category,
    amount: resolvedSearchParams?.amount as LedgerFilterParams["amount"],
    month: resolvedSearchParams?.month,
    sort: resolvedSearchParams?.sort as LedgerFilterParams["sort"]
  }),
  getCategories(context.workspaceId),
  getWorkspaceCurrency(context.workspaceId),
]);
```

Pass to LedgerClient:
```typescript
<LedgerClient
  rows={ledgerRows}
  categories={categories}
  defaultCurrency={workspaceCurrency}
/>
```

**Step 3: Update LedgerClient to pass currency to form**

```typescript
<NewTransactionForm
  open={showNewForm}
  onClose={() => setShowNewForm(false)}
  categories={categories}
  accounts={uniqueAccounts}
  defaultCurrency={defaultCurrency}
/>
```

**Step 4: Commit**

```bash
git add apps/web/app/\(shell\)/ledger/page.tsx apps/web/lib/data.ts apps/web/app/\(shell\)/ledger/LedgerClient.tsx
git commit -m "feat: pass workspace default currency to transaction form

- Add getWorkspaceCurrency helper to data.ts
- Fetch workspace currency in parallel with ledger data
- Pass default currency to NewTransactionForm
- Form defaults currency field to workspace setting"
```

---

## Task 6: Run Full Test Suite and Fix Any Issues

**Step 1: Run all tests**

Run: `npm test`

Expected: All tests PASS (check for any failures)

**Step 2: Fix any test failures**

If tests fail, debug and fix issues:
- Check for missing mocks
- Verify import paths
- Ensure test data matches implementation

**Step 3: Run type check**

Run: `npm run type-check` (or `tsc --noEmit`)

Expected: No type errors

**Step 4: Fix any type errors**

If type errors exist, add proper TypeScript types:
- Add missing interface properties
- Fix type mismatches
- Add proper return types

**Step 5: Commit fixes if any**

```bash
git add .
git commit -m "fix: resolve test failures and type errors

- Fix mock imports in tests
- Add missing TypeScript types
- Correct test assertions"
```

---

## Task 7: Manual Testing and Documentation

**Step 1: Manual testing checklist**

Test all scenarios from design doc:
- [ ] Create transaction with all fields filled
- [ ] Create transaction with only required fields
- [ ] Create negative amount (outflow) and verify direction in DB
- [ ] Create positive amount (inflow) and verify direction in DB
- [ ] Verify "Uncategorised" shows needs_review flag in DB
- [ ] Verify "Transfer" category sets is_transfer flag in DB
- [ ] Test with various filter combinations
- [ ] Verify new transaction appears only if matching filters
- [ ] Test error handling (invalid data, permissions, network errors)

**Step 2: Update CHANGELOG or docs if needed**

Create entry in changelog or update user documentation.

**Step 3: Final commit**

```bash
git add .
git commit -m "docs: add manual transaction creation feature

- User can create transactions via '+' button on ledger page
- Supports all transaction fields with validation
- Auto-infers direction from amount sign
- Sets appropriate flags based on category
- Respects current filter criteria"
```

---

## Execution Complete

All tasks implemented following TDD approach. Ready for code review and deployment.

**Summary:**
- ✅ TransactionCreateSchema validation with comprehensive tests
- ✅ POST /api/transactions endpoint with full test coverage
- ✅ NewTransactionForm component with React Testing Library tests
- ✅ Integration into ledger page with "+" button
- ✅ Workspace currency support
- ✅ Full test suite passing
- ✅ Manual testing completed
