/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: "../../.next",
  transpilePackages: ["@financelab/ui"]
};

export default nextConfig;
