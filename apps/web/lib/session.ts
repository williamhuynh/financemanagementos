import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  appwriteSession: string; // The Appwrite session secret
  userId: string;
  email: string;
  isLoggedIn: boolean;
}

// Warn if SESSION_SECRET is not set in production
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.warn(
    "WARNING: SESSION_SECRET environment variable is not set. Using default password. " +
    "Please set SESSION_SECRET to a random 32+ character string in production!"
  );
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_production",
  cookieName: "financelab_session",
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
