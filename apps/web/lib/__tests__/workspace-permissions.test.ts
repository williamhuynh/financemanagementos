import { describe, it, expect } from "vitest";
import { hasPermission } from "../workspace-permissions";
import type { WorkspaceMemberRole, Permission } from "../workspace-types";

describe("hasPermission", () => {
  const roles: WorkspaceMemberRole[] = ["viewer", "editor", "admin", "owner"];
  const permissions: Permission[] = ["read", "write", "delete", "admin", "owner"];

  it("viewer can only read", () => {
    expect(hasPermission("viewer", "read")).toBe(true);
    expect(hasPermission("viewer", "write")).toBe(false);
    expect(hasPermission("viewer", "delete")).toBe(false);
    expect(hasPermission("viewer", "admin")).toBe(false);
    expect(hasPermission("viewer", "owner")).toBe(false);
  });

  it("editor can read and write", () => {
    expect(hasPermission("editor", "read")).toBe(true);
    expect(hasPermission("editor", "write")).toBe(true);
    expect(hasPermission("editor", "delete")).toBe(false);
    expect(hasPermission("editor", "admin")).toBe(false);
    expect(hasPermission("editor", "owner")).toBe(false);
  });

  it("admin can read, write, delete, and admin", () => {
    expect(hasPermission("admin", "read")).toBe(true);
    expect(hasPermission("admin", "write")).toBe(true);
    expect(hasPermission("admin", "delete")).toBe(true);
    expect(hasPermission("admin", "admin")).toBe(true);
    expect(hasPermission("admin", "owner")).toBe(false);
  });

  it("owner has all permissions", () => {
    for (const permission of permissions) {
      expect(hasPermission("owner", permission)).toBe(true);
    }
  });

  it("each role level is a superset of the previous", () => {
    for (let i = 1; i < roles.length; i++) {
      const currentRole = roles[i];
      const previousRole = roles[i - 1];

      // Everything the previous role can do, the current role should also be able to do
      for (const perm of permissions) {
        if (hasPermission(previousRole, perm)) {
          expect(hasPermission(currentRole, perm)).toBe(true);
        }
      }
    }
  });
});
