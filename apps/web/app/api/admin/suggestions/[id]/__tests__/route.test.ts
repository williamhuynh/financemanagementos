import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";

vi.mock("../../../../../../lib/api-auth");
vi.mock("../../../../../../lib/rate-limit");

const mockDatabases = {
  updateDocument: vi.fn(),
};

const mockCtx = {
  databases: mockDatabases,
  config: { databaseId: "test-db", endpoint: "", projectId: "", apiKey: "" },
  workspaceId: "workspace-123",
  user: { $id: "admin-user", email: "admin@example.com", name: "Admin" },
  role: "owner" as const,
  plan: "free",
  featureOverrides: "[]",
};

const mockAccount = { get: vi.fn() };
const mockSession = { account: mockAccount };

const makeRouteContext = (id = "suggestion-1") => ({
  params: Promise.resolve({ id }),
});

const makeUpdatedDoc = (status: string) => ({
  $id: "suggestion-1",
  $createdAt: "2026-01-01T00:00:00.000Z",
  $updatedAt: "2026-01-02T00:00:00.000Z",
  workspace_id: "workspace-123",
  user_id: "user-456",
  user_name: "Regular User",
  title: "Great idea",
  description: "Here is why",
  status,
  upvoted_by: "[]",
});

beforeEach(async () => {
  vi.clearAllMocks();

  const apiAuth = await import("../../../../../../lib/api-auth");
  vi.mocked(apiAuth.getApiContext).mockResolvedValue(mockCtx);
  vi.mocked(apiAuth.createSessionClient).mockResolvedValue(mockSession as any);

  const rateLimit = await import("../../../../../../lib/rate-limit");
  vi.mocked(rateLimit.rateLimit).mockResolvedValue(null as any);
});

describe("PATCH /api/admin/suggestions/[id]", () => {
  it("allows superadmin to update status", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });
    mockDatabases.updateDocument.mockResolvedValue(makeUpdatedDoc("approved"));

    const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PATCH(request, makeRouteContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestion.status).toBe("approved");
    expect(mockDatabases.updateDocument).toHaveBeenCalledWith(
      "test-db",
      "suggestions",
      "suggestion-1",
      { status: "approved" }
    );
  });

  it("returns 403 for non-superadmin", async () => {
    mockAccount.get.mockResolvedValue({ labels: [] });

    const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PATCH(request, makeRouteContext());
    expect(response.status).toBe(403);
    expect(mockDatabases.updateDocument).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid status value", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });

    const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "invalid_status" }),
    });

    const response = await PATCH(request, makeRouteContext());
    expect(response.status).toBe(400);
    expect(mockDatabases.updateDocument).not.toHaveBeenCalled();
  });

  it("returns 400 when no valid fields provided", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });

    const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, makeRouteContext());
    expect(response.status).toBe(400);
  });

  it("returns 404 when document not found", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });
    mockDatabases.updateDocument.mockRejectedValue(
      new Error("Document with the requested ID could not be found")
    );

    const request = new NextRequest("http://localhost/api/admin/suggestions/missing-id", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PATCH(request, makeRouteContext("missing-id"));
    expect(response.status).toBe(404);
  });

  it("returns 401 when session missing", async () => {
    const apiAuth = await import("../../../../../../lib/api-auth");
    vi.mocked(apiAuth.createSessionClient).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PATCH(request, makeRouteContext());
    expect(response.status).toBe(401);
  });

  it("accepts all valid statuses", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });

    for (const status of ["new", "approved", "in_progress", "done"]) {
      mockDatabases.updateDocument.mockResolvedValue(makeUpdatedDoc(status));

      const request = new NextRequest("http://localhost/api/admin/suggestions/suggestion-1", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      const response = await PATCH(request, makeRouteContext());
      expect(response.status).toBe(200);
    }
  });
});
