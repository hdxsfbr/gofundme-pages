import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  agentRules: false,
  experimental: { inlineCss: true },
  images: { formats: ["image/avif", "image/webp"], qualities: [60, 75] },
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};
export default config;
