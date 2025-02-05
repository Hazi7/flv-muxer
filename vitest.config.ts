import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.{test,spec}.{js,ts}"],
    coverage: {
      provider: "v8",
    },
  },
});
