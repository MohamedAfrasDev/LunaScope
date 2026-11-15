import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // The old sidebar pages are gone: every old address opens the Atlas (a run id carries over, a shared analysis stays shared)
  async redirects() {
    return [
      { source: "/runs/:runId", destination: "/atlas?run=:runId", permanent: false },
      { source: "/runs/:runId/:rest*", destination: "/atlas?run=:runId", permanent: false },
      { source: "/analyze", destination: "/atlas", permanent: false },
      { source: "/explore", destination: "/atlas", permanent: false },
      { source: "/why-the-south-pole-is-hard", destination: "/atlas", permanent: false },
    ];
  },
  images: { formats: ["image/avif", "image/webp"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
