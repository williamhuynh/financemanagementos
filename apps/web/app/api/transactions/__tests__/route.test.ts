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

beforeEach(async () => {
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
