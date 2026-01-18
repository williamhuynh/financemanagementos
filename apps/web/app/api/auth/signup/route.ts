import { NextResponse } from "next/server";
import { Client, Account, ID } from "node-appwrite";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup - Create user account and session
 */
export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      return NextResponse.json(
        { error: "Appwrite configuration missing" },
        { status: 500 }
      );
    }

    // Create Appwrite account
    const client = new Client().setEndpoint(endpoint).setProject(projectId);
    const account = new Account(client);

    await account.create(ID.unique(), email, password, name);

    // Create session
    const appwriteSession = await account.createEmailPasswordSession(email, password);

    // Get user info
    client.setSession(appwriteSession.secret);
    const user = await account.get();

    // Store session server-side (encrypted, HttpOnly cookie)
    const session = await getSession();
    session.appwriteSession = appwriteSession.secret;
    session.userId = user.$id;
    session.email = user.email;
    session.name = user.name;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    console.error("[AUTH] Signup error:", error);
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
