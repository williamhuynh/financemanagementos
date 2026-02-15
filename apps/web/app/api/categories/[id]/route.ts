import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { isSystemCategory } from "../../../../lib/categories";
import type { CategoryGroup } from "../../../../lib/categories";
import { COLLECTIONS } from "../../../../lib/collection-names";

type AppwriteDocument = { $id: string; [key: string]: unknown };

export const dynamic = "force-dynamic";

const BATCH_SIZE = 100;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "admin");

    const { id } = await context.params;

    // Fetch the existing category
    let existingDoc: AppwriteDocument;
    try {
      existingDoc = await databases.getDocument(
        config.databaseId,
        COLLECTIONS.CATEGORIES,
        id
      );
    } catch {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Verify it belongs to this workspace
    if (existingDoc.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const currentName = String(existingDoc.name ?? "");
    const isSystem = isSystemCategory(currentName);

    const body = await request.json();
    const newName = typeof body.name === "string" ? body.name.trim() : undefined;
    const newGroup = body.group as CategoryGroup | undefined;
    const newColor = typeof body.color === "string" ? body.color.trim() : undefined;

    // Cannot modify system categories' name or group
    if (isSystem && newName && newName !== currentName) {
      return NextResponse.json(
        { error: "Cannot rename a system category" },
        { status: 400 }
      );
    }
    if (isSystem && newGroup !== undefined) {
      return NextResponse.json(
        { error: "Cannot change group of a system category" },
        { status: 400 }
      );
    }

    let renamedCount = 0;

    // Handle rename
    if (newName && newName !== currentName) {
      if (!newName) {
        return NextResponse.json({ error: "Category name is required" }, { status: 400 });
      }
      if (newName.length > 100) {
        return NextResponse.json(
          { error: "Category name must be 100 characters or fewer" },
          { status: 400 }
        );
      }
      if (isSystemCategory(newName)) {
        return NextResponse.json(
          { error: "Cannot rename to a system category name" },
          { status: 400 }
        );
      }

      // Check for duplicate (case-insensitive)
      const allCategories = await databases.listDocuments(
        config.databaseId,
        COLLECTIONS.CATEGORIES,
        [Query.equal("workspace_id", workspaceId), Query.limit(200)]
      );
      const duplicate = allCategories.documents.some(
        (doc: AppwriteDocument) =>
          doc.$id !== id &&
          String(doc.name ?? "").trim().toLowerCase() === newName.toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 }
        );
      }

      // Batch-update all transactions referencing the old name
      let cursor: string | undefined;
      while (true) {
        const queries = [
          Query.equal("workspace_id", workspaceId),
          Query.equal("category_name", currentName),
          Query.limit(BATCH_SIZE),
        ];
        if (cursor) {
          queries.push(Query.cursorAfter(cursor));
        }

        const batch = await databases.listDocuments(
          config.databaseId,
          COLLECTIONS.TRANSACTIONS,
          queries
        );

        for (const doc of batch.documents) {
          await databases.updateDocument(
            config.databaseId,
            COLLECTIONS.TRANSACTIONS,
            doc.$id,
            { category_name: newName }
          );
          renamedCount++;
        }

        if (batch.documents.length < BATCH_SIZE) break;
        cursor = batch.documents[batch.documents.length - 1].$id;
      }
    }

    // Build the update payload
    const updatePayload: Record<string, string> = {};
    if (newName && newName !== currentName) {
      updatePayload.name = newName;
    }
    if (newGroup !== undefined && (newGroup === "income" || newGroup === "expense")) {
      updatePayload.group = newGroup;
    }
    if (newColor !== undefined) {
      updatePayload.color = newColor;
    }

    if (Object.keys(updatePayload).length > 0) {
      await databases.updateDocument(
        config.databaseId,
        COLLECTIONS.CATEGORIES,
        id,
        updatePayload
      );
    }

    return NextResponse.json({
      ok: true,
      renamed_count: renamedCount,
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
    console.error("Categories PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "admin");

    const { id } = await context.params;

    // Fetch the category to delete
    let existingDoc: AppwriteDocument;
    try {
      existingDoc = await databases.getDocument(
        config.databaseId,
        COLLECTIONS.CATEGORIES,
        id
      );
    } catch {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (existingDoc.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const categoryName = String(existingDoc.name ?? "");

    if (isSystemCategory(categoryName)) {
      return NextResponse.json(
        { error: "Cannot delete a system category" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const remapTo = typeof body.remap_to === "string" ? body.remap_to.trim() : "";

    if (!remapTo) {
      return NextResponse.json(
        { error: "remap_to is required — choose a category to reassign transactions to" },
        { status: 400 }
      );
    }

    if (remapTo.toLowerCase() === categoryName.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot remap to the category being deleted" },
        { status: 400 }
      );
    }

    // Verify remap_to exists in this workspace
    const allCategories = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.CATEGORIES,
      [Query.equal("workspace_id", workspaceId), Query.limit(200)]
    );
    const remapTarget = allCategories.documents.find(
      (doc: AppwriteDocument) =>
        String(doc.name ?? "").trim().toLowerCase() === remapTo.toLowerCase()
    );
    if (!remapTarget) {
      return NextResponse.json(
        { error: "remap_to category does not exist in this workspace" },
        { status: 400 }
      );
    }

    const targetName = String(remapTarget.name ?? "").trim();
    const setNeedsReview = targetName === "Uncategorised";

    // Batch-update all transactions from old category to remap target
    let remappedCount = 0;
    let cursor: string | undefined;
    while (true) {
      const queries = [
        Query.equal("workspace_id", workspaceId),
        Query.equal("category_name", categoryName),
        Query.limit(BATCH_SIZE),
      ];
      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }

      const batch = await databases.listDocuments(
        config.databaseId,
        COLLECTIONS.TRANSACTIONS,
        queries
      );

      for (const doc of batch.documents) {
        const updateData: Record<string, string | boolean> = {
          category_name: targetName,
        };
        if (setNeedsReview) {
          updateData.needs_review = true;
        }
        await databases.updateDocument(
          config.databaseId,
          COLLECTIONS.TRANSACTIONS,
          doc.$id,
          updateData
        );
        remappedCount++;
      }

      if (batch.documents.length < BATCH_SIZE) break;
      cursor = batch.documents[batch.documents.length - 1].$id;
    }

    // Delete the category document
    await databases.deleteDocument(
      config.databaseId,
      COLLECTIONS.CATEGORIES,
      id
    );

    return NextResponse.json({
      ok: true,
      remapped_count: remappedCount,
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
    console.error("Categories DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
