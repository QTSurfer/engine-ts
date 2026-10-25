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
    // the bundle renames a class when two modules declare the same name (BuySignal becomes _BuySignal): keep the
    // names the classes were written with, which their `name` and the strategies built on them show
    options.keepNames = true;
    options.alias = {
      $event: `${src}/event`,
      $signal: `${src}/event/signal`,
      $yield: `${src}/event/yield`,
      $execution: `${src}/execution`,
    };
  },
});
