import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Optional development proxy: the browser talks to Vite on :5173 and Vite
  // forwards API and WebSocket traffic to the separately running backend.
  // Backend is never started or modified by this configuration.
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/demo-api": {
          target: "http://127.0.0.1:" + (process.env.DEMO_PORT || 5068),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/demo-api/, ""),
        },
        "/demo-realtime": {
          target: "ws://127.0.0.1:" + (process.env.DEMO_PORT || 5068),
          ws: true,
          rewrite: (path) => path.replace(/^\/demo-realtime/, "/ws/restaurants"),
        },
        ...(backendTarget
          ? {
              "/api": { target: backendTarget, changeOrigin: true },
              "/ws": { target: backendTarget, changeOrigin: true, ws: true },
              "/hubs": { target: backendTarget, changeOrigin: true, ws: true },
            }
          : {}),
      },
    },
  };
});
