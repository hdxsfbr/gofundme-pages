import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  agentRules: false,
  experimental: {
    // Inlined CSS was emitted three times per document (style tag plus two
    // RSC copies), pushing HTML past one TCP round trip; external CSS is
    // smaller and cacheable. Merging small client chunks means fewer
    // first-load scripts queue for the six HTTP/1.1 connections the lab
    // budget simulates.
    // See docs/performance.md (Watch LCP, 2026-10-17).
    turbopackChunking: { minChunkSize: 200_000 },
  },
  images: { formats: ["image/avif", "image/webp"], qualities: [60, 75] },
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};
export default config;
