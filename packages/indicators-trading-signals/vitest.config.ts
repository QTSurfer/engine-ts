import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // The comparison suites replay a 10,000-point series through both the RT
    // indicator and the trading-signals reference; under CPU contention (e.g.
    // the full parallel monorepo test run) the slowest cases exceed the 5s
    // vitest default and fail as spurious timeouts.
    testTimeout: 30_000,
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
  },
});
