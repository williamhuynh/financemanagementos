import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

vi.mock("../../../../lib/api-auth");
vi.mock("../../../../lib/workspace-guard");
vi.mock("../../../../lib/rate-limit");

const mockDatabases = {
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
};

const mockContext = {
  databases: mockDatabases,
  config: { databaseId: "test-db", endpoint: "", projectId: "", apiKey: "" },
  workspaceId: "workspace-123",
  user: { $id: "user-123", email: "test@example.com", name: "Test User" },
  role: "owner" as const,
  plan: "free",
  featureOverrides: "[]",
};

beforeEach(async () => {
  vi.clearAllMocks();

  const apiAuth = await import("../../../../lib/api-auth");
  vi.mocked(apiAuth.getApiContext).mockResolvedValue(mockContext);

  const rateLimit = await import("../../../../lib/rate-limit");
  vi.mocked(rateLimit.rateLimit).mockResolvedValue(null as any);

  const workspaceGuard = await import("../../../../lib/workspace-guard");
  vi.mocked(workspaceGuard.requireWorkspacePermission).mockResolvedValue(undefined as any);
});

const makeSuggestionDoc = (overrides = {}) => ({
  $id: "suggestion-1",
  $createdAt: "2026-01-01T00:00:00.000Z",
  $updatedAt: "2026-01-01T00:00:00.000Z",
  workspace_id: "workspace-123",
  user_id: "user-123",
  user_name: "Test User",
  title: "My Suggestion",
  description: "A great idea",
  status: "new",
  upvoted_by: "[]",
  ...overrides,
});

describe("GET /api/suggestions", () => {
  it("returns list of suggestions with upvote info", async () => {
    const doc = makeSuggestionDoc({ upvoted_by: '["user-123"]' });
    mockDatabases.listDocuments.mockResolvedValue({ documents: [doc] });

    const request = new NextRequest("http://localhost/api/suggestions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0]).toMatchObject({
      id: "suggestion-1",
      title: "My Suggestion",
      upvote_count: 1,
      has_upvoted: true,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const apiAuth = await import("../../../../lib/api-auth");
    vi.mocked(apiAuth.getApiContext).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/suggestions");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});

describe("POST /api/suggestions", () => {
  it("creates a suggestion and returns 201", async () => {
    const doc = makeSuggestionDoc();
    mockDatabases.createDocument.mockResolvedValue(doc);

    const request = new NextRequest("http://localhost/api/suggestions", {
      method: "POST",
      body: JSON.stringify({ title: "My Suggestion", description: "A great idea" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.suggestion.title).toBe("My Suggestion");
    expect(data.suggestion.status).toBe("new");
    expect(mockDatabases.createDocument).toHaveBeenCalledWith(
      "test-db",
      "suggestions",
      expect.any(String),
      expect.objectContaining({
        workspace_id: "workspace-123",
        user_id: "user-123",
        title: "My Suggestion",
        description: "A great idea",
        status: "new",
        upvoted_by: "[]",
      })
    );
  });

  it("returns 400 when title is missing", async () => {
    const request = new NextRequest("http://localhost/api/suggestions", {
      method: "POST",
      body: JSON.stringify({ description: "A great idea" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    const request = new NextRequest("http://localhost/api/suggestions", {
      method: "POST",
      body: JSON.stringify({ title: "My Suggestion" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when title exceeds 200 chars", async () => {
    const request = new NextRequest("http://localhost/api/suggestions", {
      method: "POST",
      body: JSON.stringify({ title: "x".repeat(201), description: "desc" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const apiAuth = await import("../../../../lib/api-auth");
    vi.mocked(apiAuth.getApiContext).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/suggestions", {
      method: "POST",
      body: JSON.stringify({ title: "T", description: "D" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
