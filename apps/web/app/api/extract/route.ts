import { NextResponse } from "next/server";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { resolveExtractor } from "../../../lib/extractors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/extract
 *
 * Accepts a file upload (multipart/form-data) and runs the appropriate
 * extractor based on file type.  Returns normalised transaction rows that
 * can be previewed on the client and then submitted to POST /api/imports.
 *
 * Form fields:
 *   file          – the uploaded file (required)
 *   sourceAccount – optional hint passed to the extractor
 */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "write");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { detail: "No file provided." },
        { status: 400 }
      );
    }

    // Determine file extension
    const fileName = file.name ?? "";
    const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";

    const extractor = resolveExtractor(ext) ?? resolveExtractor(file.type);

    if (!extractor) {
      return NextResponse.json(
        {
          detail: `Unsupported file type: ${ext || file.type}. Supported types: PDF.`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await extractor.extract(buffer, {
      sourceAccount: (formData.get("sourceAccount") as string) ?? undefined,
      openRouterKey: process.env.OPENROUTER_API_KEY,
      openRouterModel: process.env.OPENROUTER_MODEL,
    });

    return NextResponse.json({
      rows: result.rows,
      source: result.source,
      fileName,
      warnings: result.warnings ?? [],
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
      if (error.message.includes("OpenRouter")) {
        return NextResponse.json(
          { detail: error.message },
          { status: 502 }
        );
      }
    }
    console.error("Extract POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
