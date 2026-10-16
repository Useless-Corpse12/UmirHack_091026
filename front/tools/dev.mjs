import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const children = [
  spawn(process.execPath, ["demo/server.mjs"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "localhost",
      "--port",
      "5173",
      "--strictPort",
    ],
    // Always use the demo API for `npm run dev` even if an external
    // VITE_DATA_MODE=live was inherited from the user's terminal.
    { cwd: root, stdio: "inherit", env: { ...process.env, VITE_DATA_MODE: "mock" } },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 150);
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code || 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
