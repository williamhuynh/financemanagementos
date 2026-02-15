import { z } from "zod";

/**
 * Centralized Zod schemas for API request validation.
 *
 * Every API route should validate its input using one of these schemas
 * before processing. Use `safeParse()` and return 400 on failure.
 */

// ─── Helpers ─────────────────────────────────────────────────

const trimmedString = z.string().trim();
const yearMonthPattern = /^\d{4}-\d{2}$/;
const maxPayloadItems = 5000; // Appwrite Query.limit() cap

// ─── Auth ────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: trimmedString.min(1, "Email is required").email("Invalid email"),
  password: z.string().min(1, "Password is required").max(256),
});

export const SignupSchema = z.object({
  name: trimmedString.min(1, "Name is required").max(128),
  email: trimmedString.min(1, "Email is required").email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(256),
});

export const ForgotPasswordSchema = z.object({
  email: trimmedString.min(1, "Email is required").email("Invalid email"),
});

export const ResetPasswordSchema = z.object({
  userId: z.string().min(1),
  secret: z.string().min(1),
  password: z.string().min(8).max(256),
});

export const VerifyEmailSchema = z.object({
  action: z.enum(["send", "confirm"]),
  userId: z.string().optional(),
  secret: z.string().optional(),
});

// ─── Categories ──────────────────────────────────────────────

export const CategoryCreateSchema = z.object({
  name: trimmedString.min(1, "Category name is required").max(100),
  group: z.enum(["income", "expense"]).optional().default("expense"),
  color: trimmedString.max(20).optional().default(""),
});

export const CategoryUpdateSchema = z.object({
  name: trimmedString.min(1).max(100).optional(),
  group: z.enum(["income", "expense"]).optional(),
  color: trimmedString.max(20).optional(),
});

export const CategoryDeleteSchema = z.object({
  remap_to: trimmedString.min(1, "remap_to category is required"),
});

// ─── Transactions ────────────────────────────────────────────

export const TransactionUpdateSchema = z.object({
  category: trimmedString.max(100).optional(),
  is_transfer: z.boolean().optional(),
});

// ─── Assets ──────────────────────────────────────────────────

export const AssetCreateSchema = z.object({
  name: trimmedString.min(1, "Asset name is required").max(200),
  type: trimmedString.min(1, "Asset type is required").max(100),
  owner: trimmedString.max(100).optional(),
  currency: trimmedString.max(10).optional(),
});

export const AssetUpdateSchema = z.object({
  name: trimmedString.min(1).max(200).optional(),
  type: trimmedString.max(100).optional(),
  owner: trimmedString.max(100).optional(),
  currency: trimmedString.max(10).optional(),
  status: z.enum(["active", "disposed"]).optional(),
  disposedAt: trimmedString.optional(),
});

const AssetValueItemSchema = z.object({
  assetId: z.string().optional(),
  assetName: trimmedString.min(1).max(200),
  assetType: trimmedString.min(1).max(100),
  value: z.number().finite(),
  currency: trimmedString.max(10).optional(),
  source: trimmedString.max(100).optional(),
  notes: trimmedString.max(500).optional(),
});

export const AssetValuesCreateSchema = z.object({
  recordedAt: trimmedString.optional(),
  items: z.array(AssetValueItemSchema).min(1).max(maxPayloadItems),
});

// ─── Imports ─────────────────────────────────────────────────

const ImportRowSchema = z.object({
  date: z.string().optional(),
  description: z.string().max(1000).optional(),
  amount: z.string().max(50).optional(),
  account: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  currency: z.string().max(10).optional(),
});

export const ImportCreateSchema = z.object({
  sourceName: trimmedString.max(200).optional(),
  fileName: trimmedString.max(500).optional(),
  rows: z.array(ImportRowSchema).min(1).max(maxPayloadItems),
  sourceAccount: trimmedString.max(200).optional(),
  sourceOwner: trimmedString.max(200).optional(),
});

// ─── Import Presets ──────────────────────────────────────────

const MappingKeySchema = z.enum([
  "ignore", "date", "description", "amount",
  "debit", "credit", "account", "category", "currency",
]);

export const ImportPresetCreateSchema = z.object({
  name: trimmedString.min(1, "Preset name is required").max(200),
  headerMap: z.record(z.string(), MappingKeySchema),
  invertAmount: z.boolean().optional().default(false),
});

// ─── Cash Logs ───────────────────────────────────────────────

export const CashLogCreateSchema = z.object({
  text: trimmedString.min(1, "Text is required").max(5000),
  date: trimmedString.optional(),
  isIncome: z.boolean().optional(),
});

export const CashLogUpdateSchema = z.object({
  text: trimmedString.max(5000).optional(),
  date: trimmedString.optional(),
  isIncome: z.boolean().optional(),
  status: z.string().optional(),
  parsedItems: z.array(z.unknown()).optional(),
});

export const CashLogProcessSchema = z.object({
  logIds: z.array(z.string().min(1)).min(1).max(100),
  categories: z.array(z.string().min(1)).min(1).max(500),
});

const ParsedItemSchema = z.object({
  description: z.string().max(500),
  amount: z.number().finite(),
  category: z.string().max(100),
  confidence: z.number().min(0).max(1).optional(),
});

const ProcessedGroupSchema = z.object({
  logId: z.string().min(1),
  items: z.array(ParsedItemSchema).min(1).max(100),
});

export const CashLogCommitSchema = z.object({
  processed: z.array(ProcessedGroupSchema).min(1).max(100),
});

// ─── Transfer Pairs ──────────────────────────────────────────

export const TransferPairCreateSchema = z.object({
  fromId: z.string().min(1, "fromId is required"),
  toId: z.string().min(1, "toId is required"),
});

// ─── Workspaces ──────────────────────────────────────────────

export const WorkspaceCreateSchema = z.object({
  name: trimmedString.min(1, "Workspace name is required").max(100),
  currency: trimmedString.max(10).optional().default("AUD"),
});

export const WorkspaceSwitchSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
});

// ─── Invitations ─────────────────────────────────────────────

export const InvitationCreateSchema = z.object({
  email: trimmedString.min(1, "Email is required").email("Invalid email"),
  role: z.enum(["owner", "admin", "editor", "viewer"]),
});

export const InvitationAcceptSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// ─── Monthly Close ───────────────────────────────────────────

export const MonthlyCloseCreateSchema = z.object({
  month: trimmedString.regex(yearMonthPattern, "Month must be YYYY-MM format"),
  notes: trimmedString.max(1000).optional(),
});

export const MonthlyCloseReopenSchema = z.object({
  month: trimmedString.regex(yearMonthPattern, "Month must be YYYY-MM format"),
  notes: trimmedString.max(1000).optional(),
});

// ─── Suggest Mapping ─────────────────────────────────────────

const RecentMappingSchema = z.object({
  headers: z.array(z.string()),
  mapping: z.record(z.string(), MappingKeySchema),
  invertAmount: z.boolean().optional(),
});

export const SuggestMappingSchema = z.object({
  headers: z.array(z.string().max(200)).min(1).max(200),
  sampleRows: z.array(z.array(z.string().max(500))).max(10).optional(),
  recentMappings: z.array(RecentMappingSchema).max(10).optional(),
});

// ─── Utility ─────────────────────────────────────────────────

/**
 * Helper to validate request JSON body against a Zod schema.
 *
 * Usage pattern:
 *   const v = validateBody(Schema, body);
 *   if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 });
 *   const { field1, field2 } = v.data;
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T; error: null } | { success: false; data: null; error: string } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data, error: null };
  }
  const firstIssue = result.error.issues[0];
  const path = firstIssue?.path.length ? `${firstIssue.path.join(".")}: ` : "";
  return { success: false, data: null, error: `${path}${firstIssue?.message ?? "Invalid input"}` };
}
