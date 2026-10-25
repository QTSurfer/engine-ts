import { defineConfig } from "vitest/config";
import path from "path";

const src = path.resolve(__dirname, "src");

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
  },
  resolve: {
    alias: {
      $core: `${src}/core`,
      $averages: `${src}/averages`,
      $bollinger: `${src}/bollinger`,
      $numeric: `${src}/numeric`,
      $statistics: `${src}/statistics`,
      $helpers: `${src}/helpers`,
      $indicators: `${src}/indicators`,
      $group: `${src}/group`,
    },
  },
});
