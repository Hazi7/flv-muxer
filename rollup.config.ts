import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
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
        file: "./dist/flv-muxer.iife.js",
        format: "iife",
        name: "MyBundle",
        sourcemap: true,
      },
    ],
    plugins: [typescript(), resolve(), commonjs()],
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
