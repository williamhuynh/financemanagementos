import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { rateLimit, AUTH_RATE_LIMITS } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password - Initiate password recovery
 * Sends a recovery email via Appwrite with a link to the reset page.
 */
export async function POST(request: Request) {
  const blocked = rateLimit(request, AUTH_RATE_LIMITS.forgotPassword);
  if (blocked) return blocked;

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!endpoint || !projectId || !apiKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    const account = new Account(client);

    // Determine the reset URL base from the request origin or env
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      request.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "http://localhost:3000";
    const resetUrl = `${origin}/reset-password`;

    await account.createRecovery(email, resetUrl);

    // Always return success to avoid email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a recovery link has been sent.",
    });
  } catch {
    // Return success even on error to avoid email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a recovery link has been sent.",
    });
  }
}
