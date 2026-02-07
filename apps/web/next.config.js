/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: "../../.next",
  transpilePackages: ["@tandemly/ui"]
};

export default nextConfig;
