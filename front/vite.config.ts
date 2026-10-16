import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isLive = mode === "live";
  // Only the React/Vite development proxy is configured here.
  // The original ASP.NET backend is NOT started or modified.
  const backendTarget =
    process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || "http://127.0.0.1:5067";
  const demoPort = process.env.DEMO_PORT || "5068";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      strictPort: true,
      proxy: {
        // Demo API must never be proxied in live mode.
        ...(!isLive ? {
          "/demo-api": {
            target: `http://127.0.0.1:${demoPort}`,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/demo-api/, ""),
          },
          "/demo-realtime": {
            target: `ws://127.0.0.1:${demoPort}`,
            ws: true,
            rewrite: (path: string) => path.replace(/^\/demo-realtime/, "/ws/restaurants"),
          },
        } : {}),
        "/api": { target: backendTarget, changeOrigin: true },
        "/ws": { target: backendTarget, changeOrigin: true, ws: true },
        "/hubs": { target: backendTarget, changeOrigin: true, ws: true },
      },
    },
  };
});
