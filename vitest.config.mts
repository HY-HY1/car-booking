import { defineConfig } from "vitest/config";

// Unit tests for the pure booking logic (pricing, availability, time zones).
export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "routing/**/*.test.ts"],
  },
});
