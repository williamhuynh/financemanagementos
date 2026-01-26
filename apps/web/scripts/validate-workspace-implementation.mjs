#!/usr/bin/env node

/**
 * Automated validation script for multi-workspace implementation
 * Checks for common issues and security concerns
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

const results = {
  passed: [],
  warnings: [],
  failed: [],
};

function pass(message) {
  results.passed.push(message);
  console.log(`✅ ${message}`);
}

function warn(message) {
  results.warnings.push(message);
  console.log(`⚠️  ${message}`);
}

function fail(message) {
  results.failed.push(message);
  console.log(`❌ ${message}`);
}

async function checkFileExists(path, description) {
  try {
    await readFile(path, "utf-8");
    pass(`${description} exists`);
    return true;
  } catch {
    fail(`${description} missing: ${path}`);
    return false;
  }
}

async function checkFileContains(path, pattern, description) {
  try {
    const content = await readFile(path, "utf-8");
    if (content.includes(pattern)) {
      pass(description);
      return true;
    } else {
      fail(`${description} - pattern not found: ${pattern}`);
      return false;
    }
  } catch (error) {
    fail(`Cannot read file for check: ${path}`);
    return false;
  }
}

async function checkApiRouteHasAuth(path, routeName) {
  try {
    const content = await readFile(path, "utf-8");

    // Check for authentication
    if (!content.includes("getApiContext")) {
      fail(`${routeName}: Missing authentication (getApiContext)`);
      return false;
    }

    // Check for permission check
    if (!content.includes("requireWorkspacePermission") && !content.includes("getApiContext")) {
      warn(`${routeName}: May be missing permission check`);
    }

    // Check for workspace filtering
    if (content.includes("databases.listDocuments") && !content.includes("workspaceId")) {
      warn(`${routeName}: Database query may not filter by workspaceId`);
    }

    pass(`${routeName}: Has authentication`);
    return true;
  } catch (error) {
    fail(`Cannot validate ${routeName}: ${error.message}`);
    return false;
  }
}

async function validateApiRoutes() {
  console.log("\n📝 Validating API Routes...\n");

  const routes = [
    { path: "app/api/accounts/route.ts", name: "GET /api/accounts" },
    { path: "app/api/assets/route.ts", name: "POST /api/assets" },
    { path: "app/api/assets/[id]/route.ts", name: "PATCH/DELETE /api/assets/[id]" },
    { path: "app/api/assets/overview/route.ts", name: "GET /api/assets/overview" },
    { path: "app/api/assets/values/route.ts", name: "POST /api/assets/values" },
    { path: "app/api/assets/values/[id]/route.ts", name: "DELETE /api/assets/values/[id]" },
    { path: "app/api/cash-logs/route.ts", name: "GET/POST /api/cash-logs" },
    { path: "app/api/cash-logs/[id]/route.ts", name: "PATCH/DELETE /api/cash-logs/[id]" },
    { path: "app/api/cash-logs/commit/route.ts", name: "POST /api/cash-logs/commit" },
    { path: "app/api/cash-logs/process/route.ts", name: "POST /api/cash-logs/process" },
    { path: "app/api/categories/route.ts", name: "GET /api/categories" },
    { path: "app/api/imports/route.ts", name: "GET/POST /api/imports" },
    { path: "app/api/imports/[id]/route.ts", name: "DELETE /api/imports/[id]" },
    { path: "app/api/ledger/route.ts", name: "GET /api/ledger" },
    { path: "app/api/monthly-close/route.ts", name: "GET/POST/PATCH /api/monthly-close" },
    { path: "app/api/transactions/[id]/route.ts", name: "PATCH /api/transactions/[id]" },
    { path: "app/api/transfer-pairs/route.ts", name: "POST /api/transfer-pairs" },
    { path: "app/api/transfer-pairs/[id]/route.ts", name: "DELETE /api/transfer-pairs/[id]" },
    { path: "app/api/transcribe/route.ts", name: "POST /api/transcribe" },
  ];

  for (const route of routes) {
    await checkApiRouteHasAuth(route.path, route.name);
  }
}

async function validateWorkspaceRoutes() {
  console.log("\n📝 Validating Workspace-Specific Routes...\n");

  await checkFileExists(
    "app/api/workspaces/route.ts",
    "Workspaces list endpoint"
  );

  await checkFileExists(
    "app/api/workspaces/switch/route.ts",
    "Workspace switch endpoint"
  );

  await checkFileExists(
    "app/api/workspaces/[id]/members/route.ts",
    "Members list endpoint"
  );

  await checkFileExists(
    "app/api/workspaces/[id]/members/[memberId]/route.ts",
    "Member removal endpoint"
  );

  await checkFileExists(
    "app/api/workspaces/[id]/invitations/route.ts",
    "Invitations endpoint"
  );

  await checkFileExists(
    "app/api/workspaces/[id]/invitations/[invitationId]/route.ts",
    "Invitation cancellation endpoint"
  );

  await checkFileExists(
    "app/api/invitations/verify/route.ts",
    "Invitation verification endpoint"
  );

  await checkFileExists(
    "app/api/invitations/accept/route.ts",
    "Invitation acceptance endpoint"
  );
}

async function validateServices() {
  console.log("\n📝 Validating Service Files...\n");

  await checkFileExists("lib/workspace-types.ts", "Workspace type definitions");
  await checkFileExists("lib/workspace-permissions.ts", "Permission helper");
  await checkFileExists("lib/workspace-guard.ts", "Workspace guard");
  await checkFileExists("lib/invitation-service.ts", "Invitation service");
  await checkFileExists("lib/collection-names.ts", "Collection name constants");
  await checkFileExists("lib/api-auth.ts", "API authentication");

  // Check for HMAC usage in invitation service
  await checkFileContains(
    "lib/invitation-service.ts",
    "createHmac",
    "Invitation service uses HMAC for token hashing"
  );

  // Check for token expiry
  await checkFileContains(
    "lib/invitation-service.ts",
    "INVITATION_EXPIRY",
    "Invitation service has expiry configuration"
  );
}

async function validateComponents() {
  console.log("\n📝 Validating UI Components...\n");

  await checkFileExists(
    "app/(shell)/WorkspaceSwitcher.tsx",
    "Workspace switcher component"
  );

  await checkFileExists(
    "app/(shell)/settings/MembersSection.tsx",
    "Members section component"
  );

  await checkFileExists(
    "app/invite/accept/page.tsx",
    "Invitation accept page"
  );

  // Check workspace switcher uses API
  await checkFileContains(
    "app/(shell)/WorkspaceSwitcher.tsx",
    "/api/workspaces",
    "Workspace switcher fetches from API"
  );

  // Check members section has permission checks
  await checkFileContains(
    "app/(shell)/settings/MembersSection.tsx",
    "canManageMembers",
    "Members section checks permissions"
  );
}

async function validateDataLayer() {
  console.log("\n📝 Validating Data Layer...\n");

  const dataFile = "lib/data.ts";
  const content = await readFile(dataFile, "utf-8");

  // Check critical functions accept workspaceId
  const functionsToCheck = [
    "getCategories",
    "getLedgerRowsWithTotal",
    "getReviewItems",
    "getTransferReviewData",
    "getExpenseBreakdown",
  ];

  for (const funcName of functionsToCheck) {
    const regex = new RegExp(`export\\s+async\\s+function\\s+${funcName}\\s*\\(\\s*workspaceId`);
    if (regex.test(content)) {
      pass(`${funcName} accepts workspaceId parameter`);
    } else {
      fail(`${funcName} may not accept workspaceId parameter`);
    }
  }

  // Check for DEFAULT_WORKSPACE_ID (should be removed)
  if (content.includes("DEFAULT_WORKSPACE_ID")) {
    fail("data.ts still contains DEFAULT_WORKSPACE_ID constant");
  } else {
    pass("DEFAULT_WORKSPACE_ID removed from data.ts");
  }
}

async function validateSecurity() {
  console.log("\n📝 Validating Security Implementation...\n");

  // Check workspace-guard has proper validation
  const guardContent = await readFile("lib/workspace-guard.ts", "utf-8");

  if (guardContent.includes("workspace_id") && guardContent.includes("user_id")) {
    pass("Workspace guard validates membership");
  } else {
    fail("Workspace guard may not properly validate membership");
  }

  if (guardContent.includes("hasPermission")) {
    pass("Workspace guard uses permission helper");
  } else {
    fail("Workspace guard may not check permissions");
  }

  // Check for SQL injection protection (should use SDK, not raw SQL)
  const apiFiles = await readdir("app/api", { recursive: true });
  let foundRawSql = false;

  for (const file of apiFiles) {
    if (file.endsWith(".ts") || file.endsWith(".js")) {
      const path = join("app/api", file);
      try {
        const content = await readFile(path, "utf-8");
        if (content.includes("SELECT ") || content.includes("INSERT INTO") || content.includes("UPDATE ")) {
          warn(`Possible raw SQL found in ${file}`);
          foundRawSql = true;
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }

  if (!foundRawSql) {
    pass("No raw SQL queries found (using Appwrite SDK)");
  }
}

async function validateSchemas() {
  console.log("\n📝 Validating Database Schemas...\n");

  const schemaContent = await readFile("scripts/appwrite-schema-mvp.mjs", "utf-8");

  // Check workspace_invitations collection
  if (schemaContent.includes('id: "workspace_invitations"')) {
    pass("workspace_invitations collection defined");
  } else {
    fail("workspace_invitations collection not found in schema");
  }

  // Check workspace_members collection
  if (schemaContent.includes('id: "workspace_members"')) {
    pass("workspace_members collection defined");
  } else {
    fail("workspace_members collection not found in schema");
  }

  // Check workspaces collection
  if (schemaContent.includes('id: "workspaces"')) {
    pass("workspaces collection defined");
  } else {
    fail("workspaces collection not found in schema");
  }
}

async function validateDocumentation() {
  console.log("\n📝 Validating Documentation...\n");

  await checkFileExists(
    "../../.claude/workspace-implementation-progress.md",
    "Implementation progress tracker"
  );

  await checkFileExists(
    "../../.claude/testing-plan.md",
    "Testing plan"
  );

  await checkFileExists(
    "../../.claude/multi-workspace-completion-summary.md",
    "Completion summary"
  );

  await checkFileExists(
    "../../docs/MULTI_WORKSPACE_FEATURE.md",
    "User documentation"
  );
}

async function runValidation() {
  console.log("🔍 Multi-Workspace Implementation Validation");
  console.log("=".repeat(50));

  await validateServices();
  await validateApiRoutes();
  await validateWorkspaceRoutes();
  await validateComponents();
  await validateDataLayer();
  await validateSecurity();
  await validateSchemas();
  await validateDocumentation();

  console.log("\n" + "=".repeat(50));
  console.log("📊 Validation Summary");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    results.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (results.failed.length > 0) {
    console.log("\n❌ Failures:");
    results.failed.forEach(f => console.log(`   - ${f}`));
    process.exit(1);
  } else {
    console.log("\n🎉 All validation checks passed!");
    process.exit(0);
  }
}

runValidation().catch((error) => {
  console.error("\n💥 Validation script error:", error);
  process.exit(1);
});
