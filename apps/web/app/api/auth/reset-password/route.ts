import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { rateLimit, AUTH_RATE_LIMITS } from "../../../../lib/rate-limit";
import { validateBody, ResetPasswordSchema } from "../../../../lib/validations";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password - Complete password recovery
 * Accepts the userId, secret (from recovery email link), and new password.
 */
export async function POST(request: Request) {
  const blocked = rateLimit(request, AUTH_RATE_LIMITS.resetPassword);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const parsed = validateBody(ResetPasswordSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { userId, secret, password } = parsed.data;

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

    await account.updateRecovery(userId, secret, password);

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully.",
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    if (err.code === 401 || err.message?.includes("expired")) {
      return NextResponse.json(
        { error: "This recovery link has expired or is invalid. Please request a new one." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
