import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout - Destroy both Appwrite session and server-side session
 *
 * This performs a complete logout:
 * 1. Deletes Appwrite session server-to-server
 * 2. Destroys iron-session (clears HttpOnly cookie)
 * 3. Returns cache control headers to prevent stale auth state
 */
export async function POST() {
  try {
    const session = await getSession();

    // Delete the Appwrite session if it exists
    if (session.appwriteSession) {
      try {
        const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
        const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

        if (endpoint && projectId) {
          const client = new Client()
            .setEndpoint(endpoint)
            .setProject(projectId)
            .setSession(session.appwriteSession);

          const account = new Account(client);
          await account.deleteSession("current");
        }
      } catch {
        // Continue anyway to destroy server session
      }
    }

    // Destroy the server-side session (clears cookie)
    session.destroy();

    // Return success with cache control headers to prevent stale auth state
    const response = NextResponse.json({ success: true });
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch {
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
