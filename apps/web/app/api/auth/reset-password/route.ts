import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password - Complete password recovery
 * Accepts the userId, secret (from recovery email link), and new password.
 */
export async function POST(request: Request) {
  try {
    const { userId, secret, password } = await request.json();

    if (!userId || !secret || !password) {
      return NextResponse.json(
        { error: "User ID, secret, and new password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
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
