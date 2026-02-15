import { describe, it, expect, vi } from "vitest";
import { getClientIp } from "../audit";

// We test the pure functions here. The writeAuditLog function
// depends on Appwrite Databases, which is tested via integration tests.

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("returns first IP when multiple are present", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no forwarded header", () => {
    const request = new Request("http://localhost:3000/api/test");
    expect(getClientIp(request)).toBe("unknown");
  });

  it("trims whitespace from IP", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "  1.2.3.4  " },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });
});

describe("writeAuditLog", () => {
  it("calls createDocument with correct structure", async () => {
    // Dynamic import to avoid module-level mock issues
    const { writeAuditLog } = await import("../audit");

    const mockCreateDocument = vi.fn().mockResolvedValue({ $id: "audit-1" });
    const mockDatabases = {
      createDocument: mockCreateDocument,
    };

    await writeAuditLog(mockDatabases as any, "test-db", {
      workspace_id: "ws-1",
      user_id: "user-1",
      action: "create",
      resource_type: "category",
      resource_id: "cat-1",
      summary: 'Created category "Food"',
      ip_address: "1.2.3.4",
    });

    expect(mockCreateDocument).toHaveBeenCalledOnce();
    const [dbId, collectionId, , doc] = mockCreateDocument.mock.calls[0];
    expect(dbId).toBe("test-db");
    expect(collectionId).toBe("audit_logs");
    expect(doc.workspace_id).toBe("ws-1");
    expect(doc.user_id).toBe("user-1");
    expect(doc.action).toBe("create");
    expect(doc.resource_type).toBe("category");
    expect(doc.resource_id).toBe("cat-1");
    expect(doc.summary).toBe('Created category "Food"');
    expect(doc.ip_address).toBe("1.2.3.4");
    expect(doc.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not throw when createDocument fails", async () => {
    const { writeAuditLog } = await import("../audit");

    const mockDatabases = {
      createDocument: vi.fn().mockRejectedValue(new Error("DB down")),
    };

    // Should not throw
    await expect(
      writeAuditLog(mockDatabases as any, "test-db", {
        workspace_id: "ws-1",
        user_id: "user-1",
        action: "delete",
        resource_type: "asset",
        resource_id: "asset-1",
        summary: "Deleted asset",
      })
    ).resolves.toBeUndefined();
  });

  it("serializes metadata to JSON string", async () => {
    const { writeAuditLog } = await import("../audit");

    const mockCreateDocument = vi.fn().mockResolvedValue({ $id: "audit-2" });
    const mockDatabases = { createDocument: mockCreateDocument };

    await writeAuditLog(mockDatabases as any, "test-db", {
      workspace_id: "ws-1",
      user_id: "user-1",
      action: "update",
      resource_type: "transaction",
      resource_id: "txn-1",
      summary: "Updated transaction",
      metadata: { old_category: "Food", new_category: "Transport" },
    });

    const doc = mockCreateDocument.mock.calls[0][3];
    expect(typeof doc.metadata).toBe("string");
    const parsed = JSON.parse(doc.metadata);
    expect(parsed.old_category).toBe("Food");
    expect(parsed.new_category).toBe("Transport");
  });
});
