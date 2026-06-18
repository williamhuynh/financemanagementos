import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  appwriteSession: string; // The Appwrite session secret
  userId: string;
  email: string;
  name: string;
  isLoggedIn: boolean;
  csrfToken: string; // CSRF synchronizer token
}

// Fail-fast if SESSION_SECRET is not set in any environment
if (!process.env.SESSION_SECRET) {
  throw new Error(
    "FATAL: SESSION_SECRET environment variable is not set. " +
    "Set SESSION_SECRET to a random 32+ character string before running."
  );
}

const SESSION_PASSWORD = process.env.SESSION_SECRET;

export const sessionOptions: SessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: "tandemly_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
