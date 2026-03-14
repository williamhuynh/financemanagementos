import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../route";

vi.mock("../../../../../lib/api-auth");
vi.mock("../../../../../lib/workspace-guard");
vi.mock("../../../../../lib/rate-limit");

const mockDatabases = {
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
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

const makeRouteContext = (id = "suggestion-1") => ({
  params: Promise.resolve({ id }),
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

beforeEach(async () => {
  vi.clearAllMocks();

  const apiAuth = await import("../../../../../lib/api-auth");
  vi.mocked(apiAuth.getApiContext).mockResolvedValue(mockContext);

  const rateLimit = await import("../../../../../lib/rate-limit");
  vi.mocked(rateLimit.rateLimit).mockResolvedValue(null as any);

  const workspaceGuard = await import("../../../../../lib/workspace-guard");
  vi.mocked(workspaceGuard.requireWorkspacePermission).mockResolvedValue(undefined as any);
});

describe("PATCH /api/suggestions/[id]", () => {
  it("allows author to edit title and description", async () => {
    const existing = makeSuggestionDoc();
    const updated = makeSuggestionDoc({ title: "Updated Title", description: "New desc" });
    mockDatabases.getDocument.mockResolvedValue(existing);
    mockDatabases.updateDocument.mockResolvedValue(updated);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title", description: "New desc" }),
    });

    const response = await PATCH(request, makeRouteContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestion.title).toBe("Updated Title");
  });

  it("returns 403 when non-author tries to edit", async () => {
    const existing = makeSuggestionDoc({ user_id: "other-user" });
    mockDatabases.getDocument.mockResolvedValue(existing);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Changed" }),
    });

    const response = await PATCH(request, makeRouteContext());
    expect(response.status).toBe(403);
  });

  it("toggles upvote on (any workspace member)", async () => {
    const existing = makeSuggestionDoc({ upvoted_by: "[]" });
    const updated = makeSuggestionDoc({ upvoted_by: '["user-123"]' });
    mockDatabases.getDocument.mockResolvedValue(existing);
    mockDatabases.updateDocument.mockResolvedValue(updated);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ upvote: true }),
    });

    const response = await PATCH(request, makeRouteContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestion.upvote_count).toBe(1);
    expect(data.suggestion.has_upvoted).toBe(true);
  });

  it("toggles upvote off", async () => {
    const existing = makeSuggestionDoc({ upvoted_by: '["user-123"]' });
    const updated = makeSuggestionDoc({ upvoted_by: "[]" });
    mockDatabases.getDocument.mockResolvedValue(existing);
    mockDatabases.updateDocument.mockResolvedValue(updated);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ upvote: false }),
    });

    const response = await PATCH(request, makeRouteContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestion.upvote_count).toBe(0);
    expect(data.suggestion.has_upvoted).toBe(false);
  });

  it("returns 404 when suggestion belongs to different workspace", async () => {
    const existing = makeSuggestionDoc({ workspace_id: "other-workspace" });
    mockDatabases.getDocument.mockResolvedValue(existing);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({ upvote: true }),
    });

    const response = await PATCH(request, makeRouteContext());
    expect(response.status).toBe(404);
  });

  it("returns 400 when no valid fields provided", async () => {
    const existing = makeSuggestionDoc();
    mockDatabases.getDocument.mockResolvedValue(existing);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "PATCH",
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, makeRouteContext());
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/suggestions/[id]", () => {
  it("allows author to delete their suggestion", async () => {
    const existing = makeSuggestionDoc();
    mockDatabases.getDocument.mockResolvedValue(existing);
    mockDatabases.deleteDocument.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, makeRouteContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockDatabases.deleteDocument).toHaveBeenCalledWith("test-db", "suggestions", "suggestion-1");
  });

  it("returns 403 when non-author tries to delete", async () => {
    const existing = makeSuggestionDoc({ user_id: "other-user" });
    mockDatabases.getDocument.mockResolvedValue(existing);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, makeRouteContext());
    expect(response.status).toBe(403);
  });

  it("returns 404 when suggestion belongs to different workspace", async () => {
    const existing = makeSuggestionDoc({ workspace_id: "other-workspace" });
    mockDatabases.getDocument.mockResolvedValue(existing);

    const request = new NextRequest("http://localhost/api/suggestions/suggestion-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, makeRouteContext());
    expect(response.status).toBe(404);
  });
});
