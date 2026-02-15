import { randomBytes } from "crypto";

/**
 * CSRF protection using the Synchronizer Token Pattern.
 *
 * Flow:
 * 1. On login/signup, a random CSRF token is generated and stored in the
 *    encrypted iron-session cookie (server-side only).
 * 2. The client fetches the token via GET /api/auth/csrf.
 * 3. On every state-mutating request (POST/PATCH/DELETE), the client sends
 *    the token in the X-CSRF-Token header.
 * 4. The server (middleware) validates the header against the session value.
 */

const TOKEN_BYTES = 32;

/** Generate a cryptographically random CSRF token. */
export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Validate a CSRF token from a request header against the session value.
 * Returns true if valid, false otherwise.
 */
export function validateCsrfToken(
  headerValue: string | null,
  sessionValue: string | undefined
): boolean {
  if (!headerValue || !sessionValue) return false;
  if (headerValue.length !== sessionValue.length) return false;
  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(headerValue, sessionValue);
}

/** Constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Routes exempt from CSRF validation.
 * These are public endpoints that don't have an established session.
 */
export const CSRF_EXEMPT_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/session",
  "/api/invitations/verify",
  "/api/health",
] as const;

/** HTTP methods that require CSRF validation. */
export const CSRF_PROTECTED_METHODS = ["POST", "PATCH", "DELETE"] as const;

/** Check if a route is exempt from CSRF protection. */
export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some((route) => pathname.startsWith(route));
}
