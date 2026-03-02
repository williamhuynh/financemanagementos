// Next.js instrumentation hook — runs once at server startup before any
// route handlers are loaded.  We use it to install polyfills that must be
// in place before transitive npm dependencies reference browser-only APIs.

export async function register() {
  await import("./lib/extractors/server-polyfills");

  // Initialize Sentry for server and edge runtimes
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
