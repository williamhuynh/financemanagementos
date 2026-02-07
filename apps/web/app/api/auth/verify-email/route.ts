import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email - Send or complete email verification
 *
 * With action=send: Sends a verification email to the logged-in user.
 * With action=confirm: Confirms the verification using userId and secret from the email link.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!endpoint || !projectId || !apiKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (action === "send") {
      // Send verification email - requires a logged-in user session
      const session = await getSession();
      if (!session.isLoggedIn || !session.appwriteSession) {
        return NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 }
        );
      }

      const sessionClient = new Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setSession(session.appwriteSession);
      const sessionAccount = new Account(sessionClient);

      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        request.headers.get("origin") ||
        "http://localhost:3000";
      const verifyUrl = `${origin}/verify-email`;

      await sessionAccount.createVerification(verifyUrl);

      return NextResponse.json({
        success: true,
        message: "Verification email sent. Check your inbox.",
      });
    }

    if (action === "confirm") {
      const { userId, secret } = body;

      if (!userId || !secret) {
        return NextResponse.json(
          { error: "Missing userId or secret" },
          { status: 400 }
        );
      }

      const adminClient = new Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);
      const adminAccount = new Account(adminClient);

      await adminAccount.updateVerification(userId, secret);

      return NextResponse.json({
        success: true,
        message: "Email verified successfully.",
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'send' or 'confirm'." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    if (err.code === 401) {
      return NextResponse.json(
        { error: "Verification link expired or invalid." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
