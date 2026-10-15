/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Big libraries in their own files: cached separately, and the
        // app's own code (which changes every update) stays small
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
            },
            {
              name: "charts",
              test: /node_modules[\\/](recharts|d3-[a-z-]+|victory-vendor|es-toolkit|decimal\.js-light|immer|reselect|@reduxjs|redux|react-redux|use-sync-external-store)[\\/]/,
            },
            {
              name: "ui",
              test: /node_modules[\\/](@base-ui|@floating-ui|lucide-react|sonner)[\\/]/,
            },
            {
              name: "i18n",
              test: /node_modules[\\/](i18next|react-i18next)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    // Pure logic + stores — no DOM needed
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
