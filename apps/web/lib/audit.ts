import { Databases, ID } from "node-appwrite";
import { COLLECTIONS } from "./collection-names";

/**
 * Structured audit logging for mutation operations.
 *
 * Records who changed what and when for compliance and debugging.
 * All entries are append-only — never update or delete audit logs.
 */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "import"
  | "commit"
  | "accept_invitation"
  | "remove_member"
  | "export";

export interface AuditEntry {
  workspace_id: string;
  user_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

/**
 * Write an audit log entry. Fire-and-forget — errors are logged
 * but never thrown, so audit failures don't break business logic.
 */
export async function writeAuditLog(
  databases: Databases,
  databaseId: string,
  entry: AuditEntry
): Promise<void> {
  try {
    await databases.createDocument(
      databaseId,
      COLLECTIONS.AUDIT_LOGS,
      ID.unique(),
      {
        workspace_id: entry.workspace_id,
        user_id: entry.user_id,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        summary: entry.summary,
        metadata: safeSerializeMetadata(entry.metadata),
        ip_address: entry.ip_address ?? "",
        created_at: new Date().toISOString(),
      }
    );
  } catch (error) {
    // Audit logging must never crash the request
    console.error("Audit log write failed:", error);
  }
}

const MAX_METADATA_LENGTH = 4096;

/** Safely serialize metadata, with size capping and error handling. */
function safeSerializeMetadata(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return "";
  try {
    const json = JSON.stringify(metadata);
    if (json.length > MAX_METADATA_LENGTH) {
      return JSON.stringify({ _truncated: true, _length: json.length });
    }
    return json;
  } catch {
    return JSON.stringify({ _error: "Failed to serialize metadata" });
  }
}

/** Extract client IP from request headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
