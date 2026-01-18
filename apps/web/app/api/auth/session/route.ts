import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session - Verify server-side session and return user data
 *
 * This endpoint is the single source of truth for authentication state.
 * It reads from iron-session (encrypted HttpOnly cookie) without calling Appwrite.
 *
 * Returns:
 * - 200 with user data if session is valid
 * - 401 if no session or session is invalid
 */
export async function GET() {
  try {
    const session = await getSession();

    // Check if session exists and is valid
    if (!session.isLoggedIn || !session.userId || !session.email) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Return user data from session (no Appwrite call needed)
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
      },
    });
  } catch (error) {
    console.error("[AUTH] Session check error:", error);
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }
}
