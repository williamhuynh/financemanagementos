// Next.js instrumentation hook — runs once at server startup before any
// route handlers are loaded.  We use it to install polyfills that must be
// in place before transitive npm dependencies reference browser-only APIs.

export async function register() {
  await import("./lib/extractors/server-polyfills");
}
