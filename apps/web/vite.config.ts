import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import desktopPkg from "../desktop/package.json";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __DESKTOP_VERSION__: JSON.stringify(desktopPkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8000",
      "/uploads": "http://localhost:8000",
      "/collab": { target: "ws://localhost:8001", ws: true },
    },
  },
});
