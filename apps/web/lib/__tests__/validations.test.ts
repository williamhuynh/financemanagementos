import { describe, it, expect } from "vitest";
import {
  validateBody,
  LoginSchema,
  SignupSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CategoryDeleteSchema,
  AssetCreateSchema,
  TransactionUpdateSchema,
  ImportCreateSchema,
  TransferPairCreateSchema,
  WorkspaceCreateSchema,
  InvitationCreateSchema,
  CashLogCreateSchema,
  CashLogProcessSchema,
  MonthlyCloseCreateSchema,
  SuggestMappingSchema,
  ImportPresetCreateSchema,
} from "../validations";

// ─── validateBody helper ─────────────────────────────────────

describe("validateBody", () => {
  it("returns success with data on valid input", () => {
    const result = validateBody(LoginSchema, {
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.error).toBeNull();
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("returns failure with error string on invalid input", () => {
    const result = validateBody(LoginSchema, { email: "", password: "" });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
    expect(typeof result.error).toBe("string");
  });

  it("includes field path in error message", () => {
    const result = validateBody(LoginSchema, { email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("email");
    }
  });
});

// ─── Auth schemas ────────────────────────────────────────────

describe("LoginSchema", () => {
  it("accepts valid email and password", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = LoginSchema.safeParse({ email: "", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = LoginSchema.safeParse({ email: "not-email", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("trims email whitespace", () => {
    const result = LoginSchema.safeParse({
      email: "  user@example.com  ",
      password: "secret",
    });
    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("user@example.com");
  });

  it("rejects password over 256 chars", () => {
    const result = LoginSchema.safeParse({
      email: "a@b.com",
      password: "x".repeat(257),
    });
    expect(result.success).toBe(false);
  });
});

describe("SignupSchema", () => {
  it("accepts valid signup data", () => {
    const result = SignupSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("enforces minimum password length of 8", () => {
    const result = SignupSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = SignupSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Category schemas ────────────────────────────────────────

describe("CategoryCreateSchema", () => {
  it("accepts minimal valid category", () => {
    const result = CategoryCreateSchema.safeParse({ name: "Groceries" });
    expect(result.success).toBe(true);
    expect(result.data!.group).toBe("expense"); // default
  });

  it("accepts full category with group and color", () => {
    const result = CategoryCreateSchema.safeParse({
      name: "Salary",
      group: "income",
      color: "#FF0000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CategoryCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 characters", () => {
    const result = CategoryCreateSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const result = CategoryCreateSchema.safeParse({ name: "  Food  " });
    expect(result.success).toBe(true);
    expect(result.data!.name).toBe("Food");
  });

  it("rejects invalid group value", () => {
    const result = CategoryCreateSchema.safeParse({ name: "Test", group: "other" });
    expect(result.success).toBe(false);
  });
});

describe("CategoryUpdateSchema", () => {
  it("accepts partial update", () => {
    const result = CategoryUpdateSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = CategoryUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("CategoryDeleteSchema", () => {
  it("requires remap_to field", () => {
    const result = CategoryDeleteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts valid remap_to", () => {
    const result = CategoryDeleteSchema.safeParse({ remap_to: "Uncategorised" });
    expect(result.success).toBe(true);
  });
});

// ─── Asset schemas ───────────────────────────────────────────

describe("AssetCreateSchema", () => {
  it("accepts valid asset", () => {
    const result = AssetCreateSchema.safeParse({
      name: "Home",
      type: "property",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing type", () => {
    const result = AssetCreateSchema.safeParse({ name: "Home" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 characters", () => {
    const result = AssetCreateSchema.safeParse({
      name: "x".repeat(201),
      type: "property",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Transaction schemas ─────────────────────────────────────

describe("TransactionUpdateSchema", () => {
  it("accepts category update", () => {
    const result = TransactionUpdateSchema.safeParse({ category: "Food" });
    expect(result.success).toBe(true);
  });

  it("accepts is_transfer update", () => {
    const result = TransactionUpdateSchema.safeParse({ is_transfer: true });
    expect(result.success).toBe(true);
  });

  it("rejects non-boolean is_transfer", () => {
    const result = TransactionUpdateSchema.safeParse({ is_transfer: "yes" });
    expect(result.success).toBe(false);
  });
});

// ─── Import schemas ──────────────────────────────────────────

describe("ImportCreateSchema", () => {
  it("accepts valid import with rows", () => {
    const result = ImportCreateSchema.safeParse({
      rows: [{ date: "2025-01-01", description: "Test", amount: "100" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty rows array", () => {
    const result = ImportCreateSchema.safeParse({ rows: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing rows", () => {
    const result = ImportCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts full import payload", () => {
    const result = ImportCreateSchema.safeParse({
      sourceName: "Bank CSV",
      fileName: "export.csv",
      rows: [{ date: "2025-01-01", description: "Test", amount: "-50.00" }],
      sourceAccount: "Checking",
      sourceOwner: "John",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Transfer pair schemas ───────────────────────────────────

describe("TransferPairCreateSchema", () => {
  it("accepts valid pair", () => {
    const result = TransferPairCreateSchema.safeParse({
      fromId: "abc123",
      toId: "def456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fromId", () => {
    const result = TransferPairCreateSchema.safeParse({ toId: "def456" });
    expect(result.success).toBe(false);
  });
});

// ─── Workspace schemas ───────────────────────────────────────

describe("WorkspaceCreateSchema", () => {
  it("accepts name with default currency", () => {
    const result = WorkspaceCreateSchema.safeParse({ name: "Family" });
    expect(result.success).toBe(true);
    expect(result.data!.currency).toBe("AUD");
  });

  it("accepts name with custom currency", () => {
    const result = WorkspaceCreateSchema.safeParse({
      name: "Business",
      currency: "USD",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = WorkspaceCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

// ─── Invitation schemas ──────────────────────────────────────

describe("InvitationCreateSchema", () => {
  it("accepts valid invitation", () => {
    const result = InvitationCreateSchema.safeParse({
      email: "user@example.com",
      role: "editor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = InvitationCreateSchema.safeParse({
      email: "user@example.com",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("validates all four roles", () => {
    for (const role of ["owner", "admin", "editor", "viewer"]) {
      const result = InvitationCreateSchema.safeParse({
        email: "u@e.com",
        role,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ─── Cash log schemas ────────────────────────────────────────

describe("CashLogCreateSchema", () => {
  it("accepts valid log", () => {
    const result = CashLogCreateSchema.safeParse({ text: "Coffee $5" });
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const result = CashLogCreateSchema.safeParse({ text: "" });
    expect(result.success).toBe(false);
  });

  it("rejects text over 5000 chars", () => {
    const result = CashLogCreateSchema.safeParse({ text: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe("CashLogProcessSchema", () => {
  it("accepts valid process request", () => {
    const result = CashLogProcessSchema.safeParse({
      logIds: ["id1", "id2"],
      categories: ["Food", "Transport"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty logIds", () => {
    const result = CashLogProcessSchema.safeParse({
      logIds: [],
      categories: ["Food"],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Monthly close schemas ───────────────────────────────────

describe("MonthlyCloseCreateSchema", () => {
  it("accepts valid YYYY-MM", () => {
    const result = MonthlyCloseCreateSchema.safeParse({ month: "2025-06" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid month format", () => {
    const result = MonthlyCloseCreateSchema.safeParse({ month: "June 2025" });
    expect(result.success).toBe(false);
  });

  it("rejects YYYY-MM-DD format", () => {
    const result = MonthlyCloseCreateSchema.safeParse({ month: "2025-06-15" });
    expect(result.success).toBe(false);
  });
});

// ─── Suggest mapping schema ──────────────────────────────────

describe("SuggestMappingSchema", () => {
  it("accepts valid headers", () => {
    const result = SuggestMappingSchema.safeParse({
      headers: ["Date", "Description", "Amount"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty headers", () => {
    const result = SuggestMappingSchema.safeParse({ headers: [] });
    expect(result.success).toBe(false);
  });
});

// ─── Import preset schema ────────────────────────────────────

describe("ImportPresetCreateSchema", () => {
  it("accepts valid preset", () => {
    const result = ImportPresetCreateSchema.safeParse({
      name: "My Bank",
      headerMap: { Date: "date", Description: "description", Amount: "amount" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid mapping key", () => {
    const result = ImportPresetCreateSchema.safeParse({
      name: "Test",
      headerMap: { Date: "invalid_key" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = ImportPresetCreateSchema.safeParse({
      name: "",
      headerMap: {},
    });
    expect(result.success).toBe(false);
  });
});
