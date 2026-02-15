import { NextResponse } from "next/server";
import { Databases, ID, Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { DEFAULT_CATEGORIES, isSystemCategory } from "../../../lib/categories";
import type { CategoryGroup } from "../../../lib/categories";
import { COLLECTIONS } from "../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, CategoryCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

type AppwriteDocument = { $id: string; [key: string]: unknown };

export const dynamic = "force-dynamic";
export const revalidate = 0;

function defaultCategoryObjects() {
  return DEFAULT_CATEGORIES.map((cat, i) => ({
    id: `default-${i}`,
    name: cat.name,
    group: cat.group,
    color: null,
    is_system: isSystemCategory(cat.name),
    transaction_count: 0,
  }));
}

async function seedDefaultCategories(
  databases: Databases,
  databaseId: string,
  workspaceId: string
): Promise<void> {
  // Fetch existing category names to avoid duplicates
  const existing = await databases.listDocuments(databaseId, COLLECTIONS.CATEGORIES, [
    Query.equal("workspace_id", workspaceId),
    Query.limit(200),
  ]);
  const existingNames = new Set(
    existing.documents.map((doc: AppwriteDocument) =>
      String(doc.name ?? "").trim().toLowerCase()
    )
  );

  for (const cat of DEFAULT_CATEGORIES) {
    if (existingNames.has(cat.name.toLowerCase())) continue;
    try {
      await databases.createDocument(databaseId, COLLECTIONS.CATEGORIES, ID.unique(), {
        workspace_id: workspaceId,
        name: cat.name,
        group: cat.group ?? "",
        color: "",
      });
    } catch {
      // Ignore duplicates from potential race
    }
  }
}

async function fetchMonthSpending(
  databases: Databases,
  databaseId: string,
  workspaceId: string,
  monthPrefix: string
): Promise<Map<string, number>> {
  const spending = new Map<string, number>();
  let cursor: string | undefined;
  const batchSize = 100;

  // Paginate through all transactions for the month
  for (;;) {
    const queries = [
      Query.equal("workspace_id", workspaceId),
      Query.greaterThanEqual("date", `${monthPrefix}-01`),
      Query.lessThan("date", nextMonthPrefix(monthPrefix)),
      Query.limit(batchSize),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const batch = await databases.listDocuments(databaseId, COLLECTIONS.TRANSACTIONS, queries);
    for (const doc of batch.documents) {
      const category = String(doc.category_name ?? "Uncategorised").trim();
      const rawAmount = String(doc.amount ?? "0");
      const numeric = Number(rawAmount.replace(/[^0-9.\-]/g, ""));
      if (!Number.isFinite(numeric)) continue;
      const direction = String(doc.direction ?? "");
      // Use absolute value for spending; debits are spending
      const value = direction === "debit" ? Math.abs(numeric) : -Math.abs(numeric);
      spending.set(category, (spending.get(category) ?? 0) + value);
    }
    if (batch.documents.length < batchSize) break;
    cursor = batch.documents[batch.documents.length - 1].$id;
  }

  return spending;
}

function nextMonthPrefix(monthPrefix: string): string {
  const [yearStr, monthStr] = monthPrefix.split("-");
  let year = Number(yearStr);
  let month = Number(monthStr);
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export async function GET(request: Request) {
  const blocked = rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ categories: defaultCategoryObjects() });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "read");

    const url = new URL(request.url);
    const month = url.searchParams.get("month"); // YYYY-MM format

    const response = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.CATEGORIES,
      [Query.equal("workspace_id", workspaceId), Query.orderAsc("name"), Query.limit(100)]
    );

    // Lazy seed: fill in missing defaults for empty or partially-seeded workspaces
    let docs: AppwriteDocument[];
    if (response.total < DEFAULT_CATEGORIES.length) {
      await seedDefaultCategories(databases, config.databaseId, workspaceId);
      const seeded = await databases.listDocuments(
        config.databaseId,
        COLLECTIONS.CATEGORIES,
        [Query.equal("workspace_id", workspaceId), Query.orderAsc("name"), Query.limit(100)]
      );
      docs = seeded.documents as AppwriteDocument[];
    } else {
      docs = response.documents as AppwriteDocument[];
    }

    // Fetch month spending if requested (in parallel with transaction counts)
    const monthSpending = month
      ? await fetchMonthSpending(databases, config.databaseId, workspaceId, month)
      : null;

    // Fetch transaction counts per category
    const categories = await Promise.all(
      docs.map(async (doc) => {
        const name = String(doc.name ?? "").trim();
        let transactionCount = 0;
        try {
          const countRes = await databases.listDocuments(
            config.databaseId,
            COLLECTIONS.TRANSACTIONS,
            [
              Query.equal("workspace_id", workspaceId),
              Query.equal("category_name", name),
              Query.limit(1),
            ]
          );
          transactionCount = countRes.total;
        } catch {
          // Count unavailable — leave as 0
        }
        const result: Record<string, unknown> = {
          id: doc.$id,
          name,
          group: (doc.group || null) as CategoryGroup,
          color: doc.color ?? null,
          is_system: isSystemCategory(name),
          transaction_count: transactionCount,
        };
        if (monthSpending) {
          result.month_spent = monthSpending.get(name) ?? 0;
        }
        return result;
      })
    );

    return NextResponse.json({ categories });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    console.error("Categories GET error:", error);
    return NextResponse.json({ categories: defaultCategoryObjects() });
  }
}

export async function POST(request: Request) {
  const blocked = rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "admin");

    const body = await request.json();
    const parsed = validateBody(CategoryCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { name, group, color } = parsed.data;

    if (isSystemCategory(name)) {
      return NextResponse.json({ error: "Cannot create a category with a system name" }, { status: 400 });
    }

    // Check for duplicate (case-insensitive)
    const existing = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.CATEGORIES,
      [Query.equal("workspace_id", workspaceId), Query.limit(200)]
    );
    const duplicate = existing.documents.some(
      (doc: AppwriteDocument) =>
        String(doc.name ?? "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }

    const doc = await databases.createDocument(
      config.databaseId,
      COLLECTIONS.CATEGORIES,
      ID.unique(),
      {
        workspace_id: workspaceId,
        name,
        group,
        color,
      }
    );

    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "category",
      resource_id: doc.$id,
      summary: `Created category "${name}"`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      category: {
        id: doc.$id,
        name,
        group,
        color: color || null,
        is_system: false,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    console.error("Categories POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
