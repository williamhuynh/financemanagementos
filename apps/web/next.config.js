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

export default nextConfig;
