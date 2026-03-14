import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("../../../../../lib/api-auth");
vi.mock("../../../../../lib/rate-limit");

const mockDatabases = {
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
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

beforeEach(async () => {
  vi.clearAllMocks();

  const apiAuth = await import("../../../../../lib/api-auth");
  vi.mocked(apiAuth.getApiContext).mockResolvedValue(mockCtx);
  vi.mocked(apiAuth.createSessionClient).mockResolvedValue(mockSession as any);

  const rateLimit = await import("../../../../../lib/rate-limit");
  vi.mocked(rateLimit.rateLimit).mockResolvedValue(null as any);
});

const makeSuggestionDoc = (overrides = {}) => ({
  $id: "s-1",
  $createdAt: "2026-01-01T00:00:00.000Z",
  $updatedAt: "2026-01-01T00:00:00.000Z",
  workspace_id: "workspace-123",
  user_id: "user-456",
  user_name: "Regular User",
  title: "Great idea",
  description: "Here is why",
  status: "new",
  upvoted_by: "[]",
  ...overrides,
});

describe("GET /api/admin/suggestions", () => {
  it("returns suggestions with workspace names for superadmin", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });
    const doc = makeSuggestionDoc();
    mockDatabases.listDocuments.mockResolvedValue({ documents: [doc], total: 1 });
    mockDatabases.getDocument.mockResolvedValue({ name: "Acme Corp" });

    const request = new NextRequest("http://localhost/api/admin/suggestions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0]).toMatchObject({
      id: "s-1",
      workspace_name: "Acme Corp",
      title: "Great idea",
      upvote_count: 0,
    });
    expect(data.total).toBe(1);
  });

  it("returns 403 for non-superadmin", async () => {
    mockAccount.get.mockResolvedValue({ labels: [] });

    const request = new NextRequest("http://localhost/api/admin/suggestions");
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("returns 401 when session missing", async () => {
    const apiAuth = await import("../../../../../lib/api-auth");
    vi.mocked(apiAuth.createSessionClient).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/suggestions");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("filters by status query param", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });
    mockDatabases.listDocuments.mockResolvedValue({ documents: [], total: 0 });

    const request = new NextRequest("http://localhost/api/admin/suggestions?status=approved");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const callArgs = mockDatabases.listDocuments.mock.calls[0][2] as string[];
    expect(callArgs.some((q) => q.includes('"attribute":"status"') && q.includes('"approved"'))).toBe(true);
  });

  it("handles corrupt upvoted_by gracefully", async () => {
    mockAccount.get.mockResolvedValue({ labels: ["superadmin"] });
    const doc = makeSuggestionDoc({ upvoted_by: "NOT_JSON" });
    mockDatabases.listDocuments.mockResolvedValue({ documents: [doc], total: 1 });
    mockDatabases.getDocument.mockResolvedValue({ name: "Test WS" });

    const request = new NextRequest("http://localhost/api/admin/suggestions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestions[0].upvote_count).toBe(0);
  });
});
