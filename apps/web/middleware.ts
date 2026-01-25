import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./lib/session";

/**
 * Next.js Middleware - Runs on edge before pages load
 *
 * This protects routes by verifying the server-side session
 * BEFORE the page renders, preventing:
 * - Flash of unauthenticated content
 * - Client-side auth race conditions
 * - Auto-login bugs
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/signup"];
  const isPublicRoute = publicRoutes.includes(pathname);
  const isApiAuthRoute = pathname.startsWith("/api/auth/");
  const isPublicAsset = pathname.startsWith("/_next") || pathname.startsWith("/static");

  // Allow public routes and auth API endpoints
  if (isPublicRoute || isApiAuthRoute || isPublicAsset) {
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

    // If no valid session, redirect to login
    if (!session.isLoggedIn || !session.userId) {
      const loginUrl = new URL("/login", request.url);
      // Preserve the intended destination
      if (pathname !== "/") {
        loginUrl.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    // Session is valid, allow access
    return response;
  } catch (error) {
    console.error("[MIDDLEWARE] Session check error:", error);
    // On error, redirect to login to be safe
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
