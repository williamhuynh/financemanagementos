import { NextResponse } from "next/server";
import { Client, Account, ID } from "node-appwrite";
import { getSession } from "../../../../lib/session";
import { rateLimit, AUTH_RATE_LIMITS } from "../../../../lib/rate-limit";
import { generateCsrfToken } from "../../../../lib/csrf";
import { validateBody, SignupSchema } from "../../../../lib/validations";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup - Create user account and session
 */
export async function POST(request: Request) {
  const blocked = await rateLimit(request, AUTH_RATE_LIMITS.signup);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const parsed = validateBody(SignupSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { name, email, password } = parsed.data;

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      return NextResponse.json(
        { error: "Appwrite configuration missing" },
        { status: 500 }
      );
    }

    const apiKey = process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create admin client with API key - required to get session secret
    const adminClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    const adminAccount = new Account(adminClient);

    // Create user account
    await adminAccount.create(ID.unique(), email, password, name);

    // Create session using admin client
    const appwriteSession = await adminAccount.createEmailPasswordSession(email, password);

    // Create session client to get user info
    const sessionClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setSession(appwriteSession.secret);
    const sessionAccount = new Account(sessionClient);
    const user = await sessionAccount.get();

    // Note: Workspace creation is handled by the onboarding flow after signup
    // This allows users to choose their own workspace name and currency

    // Store session server-side (encrypted, HttpOnly cookie)
    const session = await getSession();
    session.appwriteSession = appwriteSession.secret;
    session.userId = user.$id;
    session.email = user.email;
    session.name = user.name;
    session.isLoggedIn = true;
    session.csrfToken = generateCsrfToken();
    await session.save();

    // Send verification email (non-blocking — don't fail signup if this fails)
    try {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        request.headers.get("origin") ||
        "http://localhost:3000";
      const verifyUrl = `${origin}/verify-email`;
      await sessionAccount.createVerification(verifyUrl);
    } catch {
      // Verification email is best-effort; user can request again later
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
