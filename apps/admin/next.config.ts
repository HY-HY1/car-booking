import { existsSync, readFileSync } from "node:fs";
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

// vercel.json is written for one mode (npm run routing:vercel). Building for
// the other would send requests to the wrong app, so stop instead.
const vercelJson = path.resolve(__dirname, "../../vercel.json");
if (existsSync(vercelJson)) {
  const rules: { has?: unknown[] }[] = JSON.parse(readFileSync(vercelJson, "utf8")).rewrites ?? [];
  const written = rules.some((r) => r.has?.length) ? "subdomain" : "path";
  const mode = process.env.ROUTING_MODE || "path";
  if (written !== mode) {
    throw new Error(`vercel.json is written for ${written} mode but ROUTING_MODE is ${mode}: run npm run routing:vercel and commit it.`);
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Service header images (up to 5 MB each, a header and up to 8 gallery photos) are uploaded through a server action.
  experimental: { serverActions: { bodySizeLimit: "45mb" } },
  transpilePackages: ["@leadgen/core"],
  // Requests arrive on localhost:3000 through the dev router, or on
  // app.localhost:3000 and admin.localhost:3000 in subdomain mode.
  allowedDevOrigins: ["localhost", "*.localhost"],
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
