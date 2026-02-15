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
 *
 * NOTE: This module is imported by middleware.ts which runs on Edge runtime.
 * Only use Web Crypto APIs (not Node.js `crypto`) to stay Edge-compatible.
 */

const TOKEN_BYTES = 32;

/** Generate a cryptographically random CSRF token (Edge-compatible). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
 *
 * IMPORTANT: Use exact paths (matched with === or with a trailing slash
 * check) to prevent prefix-based bypasses. For example, a future
 * `/api/auth/login-audit` route must NOT inherit the exemption.
 */
export const CSRF_EXEMPT_ROUTES = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/session",
  "/api/invitations/verify",
  "/api/health",
  "/api/health/appwrite",
]);

/** HTTP methods that require CSRF validation. */
export const CSRF_PROTECTED_METHODS = ["POST", "PATCH", "DELETE"] as const;

/**
 * Check if a route is exempt from CSRF protection.
 * Uses exact matching to prevent prefix-based bypasses.
 */
export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.has(pathname);
}
