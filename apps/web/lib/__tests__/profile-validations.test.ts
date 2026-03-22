import { describe, it, expect } from "vitest";
import {
  validateBody,
  UpdateNameSchema,
  UpdateEmailSchema,
  UpdatePasswordSchema,
} from "../validations";

// ─── UpdateNameSchema ─────────────────────────────────────────

describe("UpdateNameSchema", () => {
  it("accepts a valid name", () => {
    const result = validateBody(UpdateNameSchema, { name: "Alice Smith" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Alice Smith");
  });

  it("trims whitespace from name", () => {
    const result = validateBody(UpdateNameSchema, { name: "  Bob  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Bob");
  });

  it("rejects empty name", () => {
    const result = validateBody(UpdateNameSchema, { name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 128 characters", () => {
    const result = validateBody(UpdateNameSchema, { name: "a".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("rejects missing name field", () => {
    const result = validateBody(UpdateNameSchema, {});
    expect(result.success).toBe(false);
  });
});

// ─── UpdateEmailSchema ────────────────────────────────────────

describe("UpdateEmailSchema", () => {
  it("accepts valid email and password", () => {
    const result = validateBody(UpdateEmailSchema, {
      email: "new@example.com",
      password: "mypassword123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("new@example.com");
      expect(result.data.password).toBe("mypassword123");
    }
  });

  it("rejects invalid email format", () => {
    const result = validateBody(UpdateEmailSchema, {
      email: "not-an-email",
      password: "mypassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = validateBody(UpdateEmailSchema, { email: "new@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = validateBody(UpdateEmailSchema, {
      email: "new@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("trims email whitespace", () => {
    const result = validateBody(UpdateEmailSchema, {
      email: "  test@example.com  ",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("test@example.com");
  });
});

// ─── UpdatePasswordSchema ─────────────────────────────────────

describe("UpdatePasswordSchema", () => {
  it("accepts valid new and old passwords", () => {
    const result = validateBody(UpdatePasswordSchema, {
      password: "newpassword123",
      oldPassword: "oldpassword123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe("newpassword123");
      expect(result.data.oldPassword).toBe("oldpassword123");
    }
  });

  it("rejects new password under 8 characters", () => {
    const result = validateBody(UpdatePasswordSchema, {
      password: "short",
      oldPassword: "oldpassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects old password under 8 characters", () => {
    const result = validateBody(UpdatePasswordSchema, {
      password: "newpassword123",
      oldPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing old password", () => {
    const result = validateBody(UpdatePasswordSchema, { password: "newpassword123" });
    expect(result.success).toBe(false);
  });

  it("rejects missing new password", () => {
    const result = validateBody(UpdatePasswordSchema, { oldPassword: "oldpassword123" });
    expect(result.success).toBe(false);
  });

  it("rejects new password over 256 characters", () => {
    const result = validateBody(UpdatePasswordSchema, {
      password: "a".repeat(257),
      oldPassword: "oldpassword123",
    });
    expect(result.success).toBe(false);
  });
});
