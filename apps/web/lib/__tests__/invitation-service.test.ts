import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateInvitationToken,
  hashToken,
  createInvitation,
  verifyInvitationToken,
  acceptInvitation,
  listPendingInvitations,
  cancelInvitation,
} from "../invitation-service";

// --- helpers to build mock databases objects ---

function mockDatabases(overrides: Record<string, Function> = {}) {
  return {
    createDocument: vi.fn().mockImplementation(
      (_db: string, _col: string, _id: string, data: Record<string, unknown>) => ({
        $id: "inv-1",
        ...data,
      })
    ),
    listDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    updateDocument: vi.fn().mockResolvedValue({}),
    deleteDocument: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const DB_ID = "test-db";

describe("generateInvitationToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens across calls", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateInvitationToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    const token = "abc123";
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("returns a hex string", () => {
    expect(hashToken("test")).toMatch(/^[0-9a-f]+$/);
  });
});

describe("createInvitation", () => {
  it("normalizes email to lowercase", async () => {
    const db = mockDatabases();
    await createInvitation(db, DB_ID, "ws-1", "User@Example.COM", "editor", "user-1");

    const createCall = db.createDocument.mock.calls[0];
    expect(createCall[3].email).toBe("user@example.com");
  });

  it("sets expiry roughly 7 days from now", async () => {
    const db = mockDatabases();
    const { invitation } = await createInvitation(db, DB_ID, "ws-1", "a@b.com", "viewer", "u-1");

    const created = new Date(invitation.created_at).getTime();
    const expires = new Date(invitation.expires_at).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires - created).toBe(sevenDaysMs);
  });

  it("returns a raw token and hashed version in the document", async () => {
    const db = mockDatabases();
    const { token, invitation } = await createInvitation(
      db, DB_ID, "ws-1", "a@b.com", "editor", "u-1"
    );

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(invitation.token_hash).toBe(hashToken(token));
  });

  it("deletes existing pending invitations for same email+workspace", async () => {
    const db = mockDatabases({
      listDocuments: vi.fn().mockResolvedValue({
        documents: [{ $id: "old-inv-1" }, { $id: "old-inv-2" }],
      }),
    });

    await createInvitation(db, DB_ID, "ws-1", "a@b.com", "editor", "u-1");

    expect(db.deleteDocument).toHaveBeenCalledTimes(2);
    expect(db.deleteDocument).toHaveBeenCalledWith(DB_ID, expect.any(String), "old-inv-1");
    expect(db.deleteDocument).toHaveBeenCalledWith(DB_ID, expect.any(String), "old-inv-2");
  });
});

describe("verifyInvitationToken", () => {
  it("returns null when no invitation matches the token hash", async () => {
    const db = mockDatabases();
    const result = await verifyInvitationToken(db, DB_ID, "nonexistent-token");
    expect(result).toBeNull();
  });

  it("returns null when the invitation is expired", async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const db = mockDatabases({
      listDocuments: vi.fn().mockResolvedValue({
        documents: [{ expires_at: pastDate }],
      }),
    });

    const result = await verifyInvitationToken(db, DB_ID, "some-token");
    expect(result).toBeNull();
  });

  it("returns the invitation when valid and not expired", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const doc = {
      $id: "inv-1",
      workspace_id: "ws-1",
      email: "a@b.com",
      role: "editor",
      token_hash: "hash",
      created_at: new Date().toISOString(),
      expires_at: futureDate,
      created_by_id: "u-1",
    };

    const db = mockDatabases({
      listDocuments: vi.fn().mockResolvedValue({ documents: [doc] }),
    });

    const result = await verifyInvitationToken(db, DB_ID, "some-token");
    expect(result).toEqual(doc);
  });
});

describe("acceptInvitation", () => {
  const invitation = {
    $id: "inv-1",
    workspace_id: "ws-1",
    email: "a@b.com",
    role: "editor" as const,
    token_hash: "hash",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    created_by_id: "u-1",
  };

  it("creates membership and marks invitation accepted for new member", async () => {
    const db = mockDatabases();

    await acceptInvitation(db, DB_ID, invitation, "user-2");

    expect(db.createDocument).toHaveBeenCalledTimes(1);
    const createCall = db.createDocument.mock.calls[0];
    expect(createCall[3]).toMatchObject({
      workspace_id: "ws-1",
      user_id: "user-2",
      role: "editor",
    });

    expect(db.updateDocument).toHaveBeenCalledTimes(1);
    const updateCall = db.updateDocument.mock.calls[0];
    expect(updateCall[2]).toBe("inv-1");
    expect(updateCall[3]).toHaveProperty("accepted_at");
  });

  it("skips creating membership if user is already a member", async () => {
    const db = mockDatabases({
      listDocuments: vi.fn().mockResolvedValue({
        documents: [{ $id: "existing-member" }],
      }),
    });

    await acceptInvitation(db, DB_ID, invitation, "user-2");

    expect(db.createDocument).not.toHaveBeenCalled();
    expect(db.updateDocument).toHaveBeenCalledTimes(1);
  });
});

describe("listPendingInvitations", () => {
  it("returns documents from the query", async () => {
    const docs = [{ $id: "inv-1" }, { $id: "inv-2" }];
    const db = mockDatabases({
      listDocuments: vi.fn().mockResolvedValue({ documents: docs }),
    });

    const result = await listPendingInvitations(db, DB_ID, "ws-1");
    expect(result).toEqual(docs);
  });
});

describe("cancelInvitation", () => {
  it("calls deleteDocument with the invitation id", async () => {
    const db = mockDatabases();
    await cancelInvitation(db, DB_ID, "inv-42");
    expect(db.deleteDocument).toHaveBeenCalledWith(DB_ID, expect.any(String), "inv-42");
  });
});
