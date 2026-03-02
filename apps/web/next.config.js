import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: "../../.next",
  transpilePackages: ["@tandemly/ui"],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // Ensure pdfjs-dist worker file is included in Vercel Lambda bundles.
  // The worker is loaded via a /*webpackIgnore*/ dynamic import inside
  // pdfjs-dist, so file tracers miss it.  We also pre-load it in
  // server-polyfills.ts, but this serves as a safety net.
  outputFileTracingIncludes: {
    "/api/extract": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "william-huynh",
  project: "tandemly-app",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the Sentry project is configured to accept traffic from the rewrite domain.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
