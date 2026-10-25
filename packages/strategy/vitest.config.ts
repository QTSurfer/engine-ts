import { defineConfig } from "vitest/config";
import path from "path";

const src = path.resolve(__dirname, "src");

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      $event: `${src}/event`,
      $signal: `${src}/event/signal`,
      $yield: `${src}/event/yield`,
      $execution: `${src}/execution`,
    },
  },
});
