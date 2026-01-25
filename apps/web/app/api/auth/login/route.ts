import { NextResponse } from "next/server";
import { Client, Account } from "node-appwrite";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login - Create session with Appwrite and store server-side
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    console.log("[AUTH] Login attempt for:", email);
    console.log("[AUTH] Appwrite endpoint:", endpoint);
    console.log("[AUTH] Appwrite project:", projectId);

    if (!endpoint || !projectId) {
      return NextResponse.json(
        { error: "Appwrite configuration missing" },
        { status: 500 }
      );
    }

    // Create Appwrite session
    const client = new Client().setEndpoint(endpoint).setProject(projectId);
    const account = new Account(client);

    console.log("[AUTH] Attempting to create session...");
    let appwriteSession;
    try {
      appwriteSession = await account.createEmailPasswordSession(email, password);
      console.log("[AUTH] Session created successfully, session ID:", appwriteSession.$id);
      console.log("[AUTH] Session object keys:", Object.keys(appwriteSession));
      console.log("[AUTH] Session secret exists:", !!appwriteSession.secret);
      console.log("[AUTH] Session secret length:", appwriteSession.secret?.length);
    } catch (sessionError: unknown) {
      const err = sessionError as { code?: number; type?: string; message?: string };
      console.error("[AUTH] Session creation failed:", err.message);
      console.error("[AUTH] Error code:", err.code);
      console.error("[AUTH] Error type:", err.type);
      return NextResponse.json(
        { error: "Invalid credentials", detail: err.message },
        { status: 401 }
      );
    }

    // In node-appwrite, we need to create a new client with the session explicitly set
    console.log("[AUTH] Creating client with session...");
    const sessionClient = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);

    console.log("[AUTH] Setting session on client...");
    sessionClient.setSession(appwriteSession.secret);

    const sessionAccount = new Account(sessionClient);

    console.log("[AUTH] Fetching user info with authenticated client...");
    const user = await sessionAccount.get();
    console.log("[AUTH] User fetched:", user.$id);

    // Store session server-side (encrypted, HttpOnly cookie)
    const session = await getSession();
    session.appwriteSession = appwriteSession.secret;
    session.userId = user.$id;
    session.email = user.email;
    session.name = user.name;
    session.isLoggedIn = true;
    await session.save();

    console.log("[AUTH] Login successful for:", user.email);

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
    console.error("[AUTH] Login error:", err.message);
    console.error("[AUTH] Error code:", err.code);
    console.error("[AUTH] Error type:", err.type);
    console.error("[AUTH] Full error:", error);
    return NextResponse.json(
      { error: "Invalid credentials", detail: err.message },
      { status: 401 }
    );
  }
}
