import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Mirror the "@/*" path alias from tsconfig.json. Defined explicitly here
  // (rather than via vite-tsconfig-paths) so it keeps working even though test
  // files are excluded from the build tsconfig's `include`.
  resolve: { alias: { "@": resolve(rootDir) } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    css: false,
  },
});
