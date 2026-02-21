import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { generateCsrfToken } from "../../../../lib/csrf";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/csrf — Return the CSRF token for the current session.
 *
 * If the session doesn't have a CSRF token yet (legacy sessions created
 * before CSRF was implemented), one is generated and saved.
 *
 * The client must include this token as the X-CSRF-Token header on all
 * state-mutating requests (POST, PATCH, DELETE).
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate token if missing (first call or legacy session)
    if (!session.csrfToken) {
      session.csrfToken = generateCsrfToken();
      await session.save();
    }

    return NextResponse.json({ csrfToken: session.csrfToken });
  } catch (error) {
    console.error("CSRF token error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
