import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { getSession } from "../../../../lib/session";
import { rateLimit, AUTH_RATE_LIMITS } from "../../../../lib/rate-limit";
import { generateCsrfToken } from "../../../../lib/csrf";
import { validateBody, LoginSchema } from "../../../../lib/validations";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login - Create session with Appwrite and store server-side
 */
export async function POST(request: Request) {
  const blocked = await rateLimit(request, AUTH_RATE_LIMITS.login);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const parsed = validateBody(LoginSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { email, password } = parsed.data;

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

    let appwriteSession;
    try {
      appwriteSession = await adminAccount.createEmailPasswordSession(email, password);
    } catch (sessionError: unknown) {
      const err = sessionError as { code?: number; type?: string; message?: string };
      return NextResponse.json(
        { error: "Invalid credentials", detail: err.message },
        { status: 401 }
      );
    }

    // Create a session client to fetch user info
    const sessionClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setSession(appwriteSession.secret);

    const sessionAccount = new Account(sessionClient);
    const user = await sessionAccount.get();

    // Store session server-side (encrypted, HttpOnly cookie)
    const session = await getSession();
    session.appwriteSession = appwriteSession.secret;
    session.userId = user.$id;
    session.email = user.email;
    session.name = user.name;
    session.isLoggedIn = true;
    session.csrfToken = generateCsrfToken();
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: number; type?: string; message?: string };
    return NextResponse.json(
      { error: "Invalid credentials", detail: err.message },
      { status: 401 }
    );
  }
}
