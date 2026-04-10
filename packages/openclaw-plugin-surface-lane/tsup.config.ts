import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: {
    resolve: true,
  },
  noExternal: ["@chieflane/surface-schema", "@sinclair/typebox", "zod"],
  clean: true,
});
