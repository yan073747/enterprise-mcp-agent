import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@enterprise/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@enterprise/mcp-server/src/tools.js": path.resolve(__dirname, "../mcp-server/src/tools.ts")
    }
  }
});
