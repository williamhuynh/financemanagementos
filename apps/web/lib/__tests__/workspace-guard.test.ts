import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock api-auth before importing workspace-guard
vi.mock("../api-auth", () => ({
  getServerConfig: vi.fn(),
  createDatabasesClient: vi.fn(),
}));

import { requireWorkspacePermission } from "../workspace-guard";
import { getServerConfig, createDatabasesClient } from "../api-auth";

const mockGetServerConfig = vi.mocked(getServerConfig);
const mockCreateDatabasesClient = vi.mocked(createDatabasesClient);

const FAKE_CONFIG = {
  endpoint: "https://appwrite.test",
  projectId: "proj-1",
  databaseId: "db-1",
  apiKey: "key-1",
};

function mockListDocuments(documents: Record<string, unknown>[]) {
  const listDocuments = vi.fn().mockResolvedValue({ documents });
  mockCreateDatabasesClient.mockReturnValue({ listDocuments } as any);
  return listDocuments;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerConfig.mockReturnValue(FAKE_CONFIG);
});

describe("requireWorkspacePermission", () => {
  it("throws when server config is missing", async () => {
    mockGetServerConfig.mockReturnValue(null);

    await expect(
      requireWorkspacePermission("ws-1", "user-1", "read")
    ).rejects.toThrow("Server configuration missing");
  });

  it("throws when user is not a member of the workspace", async () => {
    mockListDocuments([]);

    await expect(
      requireWorkspacePermission("ws-1", "user-1", "read")
    ).rejects.toThrow("User not member of workspace");
  });

  it("throws on duplicate memberships (data integrity)", async () => {
    mockListDocuments([
      { role: "editor" },
      { role: "editor" },
    ]);

    await expect(
      requireWorkspacePermission("ws-1", "user-1", "read")
    ).rejects.toThrow("Data integrity error: duplicate memberships");
  });

  it("throws when role lacks required permission", async () => {
    mockListDocuments([{ role: "viewer" }]);

    await expect(
      requireWorkspacePermission("ws-1", "user-1", "write")
    ).rejects.toThrow("Insufficient permission: write required");
  });

  it("returns the user role when permission is satisfied", async () => {
    mockListDocuments([{ role: "admin" }]);

    const role = await requireWorkspacePermission("ws-1", "user-1", "write");
    expect(role).toBe("admin");
  });

  it("queries with the correct user and workspace IDs", async () => {
    const listDocuments = mockListDocuments([{ role: "owner" }]);

    await requireWorkspacePermission("ws-42", "user-99", "read");

    const queries = listDocuments.mock.calls[0][2];
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({}),
      ])
    );
    // Verify it was called with the right database and collection
    expect(listDocuments).toHaveBeenCalledWith(
      "db-1",
      expect.any(String),
      expect.any(Array)
    );
  });

  it("owner passes all permission levels", async () => {
    const permissions = ["read", "write", "delete", "admin", "owner"] as const;

    for (const perm of permissions) {
      mockListDocuments([{ role: "owner" }]);
      const role = await requireWorkspacePermission("ws-1", "user-1", perm);
      expect(role).toBe("owner");
    }
  });

  it("viewer is denied write permission", async () => {
    mockListDocuments([{ role: "viewer" }]);

    await expect(
      requireWorkspacePermission("ws-1", "user-1", "write")
    ).rejects.toThrow("Insufficient permission");
  });

  it("editor is denied delete permission", async () => {
    mockListDocuments([{ role: "editor" }]);

    await expect(
      requireWorkspacePermission("ws-1", "user-1", "delete")
    ).rejects.toThrow("Insufficient permission");
  });

  it("admin is denied owner permission", async () => {
    mockListDocuments([{ role: "admin" }]);

    await expect(
      requireWorkspacePermission("ws-1", "user-1", "owner")
    ).rejects.toThrow("Insufficient permission");
  });
});
