import path from "node:path";
import type { NextConfig } from "next";

// Both apps share the .env.local at the repo root. Not @next/env's
// loadEnvConfig: Next has already called it for this folder, and it returns
// that cached result on any later call, so the root file was never read (dev
// only worked thanks to its fallbacks). loadEnvFile only fills in what isn't
// set, so this folder's own .env.local and the host's variables still win.
try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env.local"));
} catch (error) {
  // No root file on a deployed host: its variables come from the platform.
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// The browser only sees NEXT_PUBLIC_ROUTING_MODE, so the two must agree or
// server and client would build different URLs (packages/core/src/urls.ts).
if ((process.env.ROUTING_MODE || "path") !== (process.env.NEXT_PUBLIC_ROUTING_MODE || "path")) {
  throw new Error("ROUTING_MODE and NEXT_PUBLIC_ROUTING_MODE must have the same value.");
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Service header images (up to 5 MB each, a header and up to 8 gallery photos) are uploaded through a server action.
  experimental: { serverActions: { bodySizeLimit: "45mb" } },
  transpilePackages: ["@leadgen/core"],
  // The docs are served on docs.localhost:3001 (see src/proxy.ts), so the dev
  // server must accept that hostname too.
  allowedDevOrigins: ["docs.localhost"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
