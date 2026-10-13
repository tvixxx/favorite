import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig({ command: "build", mode: "test" }),
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    },
  })
);
