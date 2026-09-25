import { defineConfig } from "vitest/config";

// Database/RLS integration tests (npm run test:db): real migrations and the
// development seed in PGlite. Separate from `npm test` because loading the
// seed takes a few seconds.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
