import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    testTimeout: 20000,
    fileParallelism: false,
    // Unit fixtures use their own atlases and clocks; never depend on changing market data.
    env: { MUSCLESCOUT_TRAVEL_FILE: "tests/fixtures/no-travel-atlas.json" },
  },
});
