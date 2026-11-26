import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * The site's Content Security Policy. GitHub Pages cannot send headers, so it is a <meta> tag,
 * added to the built page only (Vite's dev server needs inline scripts). Scripts come only from
 * the site itself, so even HTML that slipped past the README sanitiser could not run code.
 * Images, fonts and data may come from anywhere over https: READMEs show images from any host,
 * and the studio reads GitHub, package registries and weather data.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "readme-studio-csp",
    apply: "build",
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  // relative base works on any GitHub Pages path because routing is hash-based
  base: process.env.BASE_PATH ?? "./",
  plugins: [react(), contentSecurityPolicy()],
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
