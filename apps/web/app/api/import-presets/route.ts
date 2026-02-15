import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../lib/collection-names";
import { validatePresetName, validateHeaderMap, parseHeaderMap } from "../../../lib/import-presets";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, ImportPresetCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/import-presets
 *
 * List all saved import presets for the current workspace.
 */
export async function GET(request: Request) {
  try {
    const blocked = rateLimit(request, DATA_RATE_LIMITS.read);
    if (blocked) return blocked;

    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "read");

    const response = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.IMPORT_PRESETS,
      [
        Query.equal("workspace_id", workspaceId),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]
    );

    const presets = response.documents.flatMap((doc: { $id: string; $createdAt: string; name: string; header_map: string; invert_amount: boolean; created_by: string }) => {
      const headerMap = parseHeaderMap(doc.header_map);
      if (!headerMap) return [];
      return [{
        id: doc.$id,
        name: doc.name,
        headerMap,
        invertAmount: doc.invert_amount,
        createdBy: doc.created_by,
        createdAt: doc.$createdAt,
      }];
    });

    return NextResponse.json({ presets });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    console.error("Import-presets GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/import-presets
 *
 * Save a new import preset for the current workspace.
 *
 * Body (JSON):
 *   name      – string                     display name for the preset
 *   headerMap – Record<string, MappingKey>  column header → mapping type
 *   invertAmount – boolean                  whether to reverse amount sign
 */
export async function POST(request: Request) {
  try {
    const blocked = rateLimit(request, DATA_RATE_LIMITS.write);
    if (blocked) return blocked;

    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "write");

    const body = await request.json();

    const parsed = validateBody(ImportPresetCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { name: rawName, headerMap: validatedHeaderMap, invertAmount: validatedInvert } = parsed.data!;

    const nameError = validatePresetName(rawName);
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }
    const name = rawName.trim();

    const mapError = validateHeaderMap(validatedHeaderMap);
    if (mapError) {
      return NextResponse.json({ error: mapError }, { status: 400 });
    }
    const headerMap = validatedHeaderMap;

    const invertAmount = Boolean(validatedInvert);

    const presetId = ID.unique();
    await databases.createDocument(
      config.databaseId,
      COLLECTIONS.IMPORT_PRESETS,
      presetId,
      {
        workspace_id: workspaceId,
        name,
        header_map: JSON.stringify(headerMap),
        invert_amount: invertAmount,
        created_by: user.$id,
      }
    );

    // Fire-and-forget audit log
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "import_preset",
      resource_id: presetId,
      summary: `Created import preset "${name}"`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      id: presetId,
      name,
      headerMap,
      invertAmount,
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
    console.error("Import-presets POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
