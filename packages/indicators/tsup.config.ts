import { defineConfig } from "tsup";
import path from "path";

const src = path.resolve("src");

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildOptions(options) {
    // getId() derives an indicator's type from its class name: the bundle must not rename classes
    options.keepNames = true;
    options.alias = {
      $core: `${src}/core`,
      $averages: `${src}/averages`,
      $bollinger: `${src}/bollinger`,
      $numeric: `${src}/numeric`,
      $statistics: `${src}/statistics`,
      $helpers: `${src}/helpers`,
      $indicators: `${src}/indicators`,
      $group: `${src}/group`,
    };
  },
});
