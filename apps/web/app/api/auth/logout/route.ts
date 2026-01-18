import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout - Destroy both Appwrite session and server-side session
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
          console.log("[AUTH] Appwrite session deleted");
        }
      } catch (error) {
        console.error("[AUTH] Error deleting Appwrite session:", error);
        // Continue anyway to destroy server session
      }
    }

    // Destroy the server-side session
    session.destroy();
    console.log("[AUTH] Server session destroyed");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
