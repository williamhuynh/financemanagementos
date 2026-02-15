import { NextResponse } from "next/server";
import { Databases, ID, Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { DEFAULT_CATEGORIES, isSystemCategory } from "../../../lib/categories";
import type { CategoryGroup } from "../../../lib/categories";
import { COLLECTIONS } from "../../../lib/collection-names";

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

export async function GET() {
  try {
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ categories: defaultCategoryObjects() });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "read");

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
        return {
          id: doc.$id,
          name,
          group: (doc.group || null) as CategoryGroup,
          color: doc.color ?? null,
          is_system: isSystemCategory(name),
          transaction_count: transactionCount,
        };
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
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "admin");

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const group: CategoryGroup = body.group === "income" ? "income" : "expense";
    const color = typeof body.color === "string" ? body.color.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "Category name must be 100 characters or fewer" }, { status: 400 });
    }
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
