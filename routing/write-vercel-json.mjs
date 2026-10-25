// npm run routing:vercel — writes vercel.json from the routing env vars
// (ROUTING_MODE, NEXT_PUBLIC_ROUTING_MODE, NEXT_PUBLIC_ROOT_DOMAIN), read from
// the shell or the root .env.local. Run it after changing those, then commit
// vercel.json: Vercel reads the file, and both apps' builds stop if it was
// written for a different mode than ROUTING_MODE says.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { routingMode, vercelConfig } from "./rules.mjs";

const root = path.resolve(import.meta.dirname, "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

writeFileSync(path.join(root, "vercel.json"), `${JSON.stringify(vercelConfig(process.env), null, 2)}\n`);
console.log(`Wrote vercel.json for ${routingMode(process.env)} mode.`);
