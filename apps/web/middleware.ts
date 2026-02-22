import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./lib/session";
import {
  validateCsrfToken,
  isCsrfExempt,
  CSRF_PROTECTED_METHODS,
} from "./lib/csrf";

/**
 * Next.js Middleware - Runs on edge before pages load
 *
 * This protects routes by verifying the server-side session
 * BEFORE the page renders, preventing:
 * - Flash of unauthenticated content
 * - Client-side auth race conditions
 * - Auto-login bugs
 *
 * It also enforces CSRF protection on state-mutating API requests.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];
  const isPublicRoute = publicRoutes.includes(pathname);
  const isApiAuthRoute = pathname.startsWith("/api/auth/");
  const isPublicAsset = pathname.startsWith("/_next") || pathname.startsWith("/static");
  const isPwaAsset =
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/");
  const isPublicApi =
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/invitations/verify");

  // Allow public routes and auth API endpoints
  if (isPublicRoute || isApiAuthRoute || isPublicAsset || isPwaAsset || isPublicApi) {
    return NextResponse.next();
  }

  // Check session for protected routes
  try {
    const response = NextResponse.next();
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    // If no valid session, redirect to login (pages) or return 401 (API)
    if (!session.isLoggedIn || !session.userId) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      // Preserve the intended destination
      if (pathname !== "/") {
        loginUrl.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    // ── CSRF validation for state-mutating API requests ──────
    if (
      pathname.startsWith("/api/") &&
      (CSRF_PROTECTED_METHODS as readonly string[]).includes(request.method) &&
      !isCsrfExempt(pathname)
    ) {
      const csrfHeader = request.headers.get("x-csrf-token");
      if (!validateCsrfToken(csrfHeader, session.csrfToken)) {
        return NextResponse.json(
          { error: "Invalid or missing CSRF token" },
          { status: 403 }
        );
      }
    }

    // Session is valid, allow access
    return response;
  } catch (error) {
    console.error("[MIDDLEWARE] Session check error:", error);
    // On error, redirect to login to be safe
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

/**
 * Configure which routes this middleware runs on
 *
 * Runs on all routes except:
 * - Static files (_next/static)
 * - Images and fonts
 * - favicon
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
