import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // relative base works on any GitHub Pages path because routing is hash-based
  base: process.env.BASE_PATH ?? "./",
  plugins: [react()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        },
      },
    },
  },
  server: { port: 5173, host: true },
});
