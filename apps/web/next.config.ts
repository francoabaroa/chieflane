import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@chieflane/shared",
    "@chieflane/surface-schema",
    "@chieflane/surface-catalog",
    "@chieflane/surface-renderer-web",
  ],
  serverExternalPackages: ["better-sqlite3"],
  headers: async () => [
    {
      source: "/api/stream",
      headers: [
        { key: "Content-Type", value: "text/event-stream" },
        { key: "Cache-Control", value: "no-cache, no-transform" },
        { key: "Connection", value: "keep-alive" },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    },
  ],
};

export default nextConfig;
