import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    coverage: { reporter: ["text", "json"] }
  },
  resolve: {
    alias: {
      "@agent-md/schema": new URL("./packages/schema/src/index.ts", import.meta.url).pathname,
      "@agent-md/parser": new URL("./packages/parser/src/index.ts", import.meta.url).pathname,
      "@agent-md/resolver": new URL("./packages/resolver/src/index.ts", import.meta.url).pathname,
      "@agent-md/skill": new URL("./packages/skill/src/index.ts", import.meta.url).pathname
    }
  }
});
