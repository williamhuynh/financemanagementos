import { NextResponse } from "next/server";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../../lib/collection-names";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * DELETE /api/import-presets/:id
 *
 * Delete a saved import preset. Requires write permission on the workspace.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "write");

    const { id } = await params;

    // Verify the preset belongs to this workspace
    const doc = await databases.getDocument(
      config.databaseId,
      COLLECTIONS.IMPORT_PRESETS,
      id
    );

    if (doc.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "Preset not found." },
        { status: 404 }
      );
    }

    await databases.deleteDocument(
      config.databaseId,
      COLLECTIONS.IMPORT_PRESETS,
      id
    );

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      if (error.message.includes("Document with the requested ID could not be found")) {
        return NextResponse.json({ error: "Preset not found." }, { status: 404 });
      }
    }
    console.error("Import-presets DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
