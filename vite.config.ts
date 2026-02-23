import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  esbuild: {
    // Strip all console.* calls and debugger statements from production bundles
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
