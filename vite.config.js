import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "production-content-policy",
      transformIndexHtml(html, context) {
        if (context.server) return html;
        return html.replace(
          "<head>",
          `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'">`,
        );
      },
    },
  ],
  base: "./",
  server: { host: "0.0.0.0" },
});
