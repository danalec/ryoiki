import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,ts}"],
    setupFiles: ["src/setupTests.ts"],
    alias: {
      "@cc/analyzer": "cc-analyzer",
    },
  },
  resolve: {
    conditions: ["browser"],
  },
});
