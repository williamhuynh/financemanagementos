type AppwriteDocument = { $id: string; [key: string]: unknown };

export function parseUpvotedBy(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatSuggestion(doc: AppwriteDocument, currentUserId?: string) {
  const upvotedBy = parseUpvotedBy(doc.upvoted_by);
  return {
    id: doc.$id,
    workspace_id: doc.workspace_id,
    user_id: doc.user_id,
    user_name: doc.user_name,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    upvote_count: upvotedBy.length,
    has_upvoted: currentUserId ? upvotedBy.includes(currentUserId) : false,
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  };
}

export function formatSuggestionAdmin(doc: AppwriteDocument, workspaceName?: string) {
  const upvotedBy = parseUpvotedBy(doc.upvoted_by);
  return {
    id: doc.$id,
    workspace_id: doc.workspace_id,
    workspace_name: workspaceName ?? doc.workspace_id,
    user_id: doc.user_id,
    user_name: doc.user_name,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    upvote_count: upvotedBy.length,
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  };
}
