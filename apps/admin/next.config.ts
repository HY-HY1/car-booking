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

// vercel.json is written for one mode (npm run routing:vercel). Deploying
// for the other would send requests to the wrong app, so stop instead. Only
// on Vercel: locally the dev router builds its rules from the env itself.
const vercelJson = path.resolve(__dirname, "../../vercel.json");
if (process.env.VERCEL && existsSync(vercelJson)) {
  // Subdomain mode routes app.<root> by host (routing/rules.mjs, modeOf).
  const rules: { has?: { value?: unknown }[] }[] = JSON.parse(readFileSync(vercelJson, "utf8")).rewrites ?? [];
  const appHost = rules.some((r) => r.has?.some((h) => typeof h.value === "string" && h.value.startsWith("app.")));
  const written = appHost ? "subdomain" : "path";
  const mode = process.env.ROUTING_MODE || "path";
  if (written !== mode) {
    throw new Error(`vercel.json is written for ${written} mode but ROUTING_MODE is ${mode}: run npm run routing:vercel and commit it.`);
  }
}

// Sent with every page and file. The dashboard can refund payments and erase
// customers, so no other site may load it in a frame and trick an owner into
// clicking (the booking app, which businesses embed, sets its own).
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  partialPrefetching: true,
  // Images are uploaded through server actions, shrunk in the browser first.
  // Vercel refuses any request over 4.5 MB whatever this says, so it's kept
  // under that here too, so a too-big upload fails locally the same way.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  transpilePackages: ["@leadgen/core"],
  // Serve images as they are. On Vercel this app runs as one of two
  // services (vercel.json) and /_next/image 404s there, which broke every
  // <Image> on the marketing site; the files are small pre-compressed webp
  // and png, so the optimiser gained little anyway.
  images: { unoptimized: true },
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
      // `import text from "./file.ts?raw"` gives the file's source as a string:
      // the API docs show packages/core/src/api/types.ts word for word.
      "*.ts": {
        condition: { query: "?raw" },
        type: "raw",
      },
    },
  },
};

export default nextConfig;
