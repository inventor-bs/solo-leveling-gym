import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Only measure code that carries logic. UI and Next routes are covered
      // by Playwright, and adapters are thin wrappers over external libraries.
      include: ["src/core/**", "src/server/**", "src/app-services/**"],
      exclude: ["**/*.test.ts", "src/core/shared/events.ts"],
      // core/ holds every game rule, so it gets the strictest bar.
      // Raise these as coverage grows; never lower them to make CI pass.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
        "src/core/**": {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
