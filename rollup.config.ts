import typescript from "@rollup/plugin-typescript";
import { readFileSync } from "fs";
import { defineConfig } from "rollup";
import { dts } from "rollup-plugin-dts";

const pkg = JSON.parse(readFileSync("./package.json", { encoding: "utf-8" }));

export default defineConfig([
  {
    input: "src/main.ts",
    output: [
      {
        file: pkg.exports.import,
        format: "es",
      },
      {
        file: pkg.exports.require,
        format: "cjs",
      },
      {
        file: "./dist/flv-muxer.umd.js",
        format: "umd",
        name: "my umd",
      },
    ],
    plugins: [typescript()],
  },
  {
    input: "dist/main.d.ts",
    output: [
      {
        file: pkg.exports.import.replace(/\.js$/, ".d.ts"),
        format: "es",
      },
    ],
    plugins: [dts()],
  },
]);
