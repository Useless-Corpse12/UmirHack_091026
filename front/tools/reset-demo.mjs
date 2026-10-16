import { existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";
const filename = resolve(process.env.DEMO_DATA_FILE || ".demo-data/store.json");
if (existsSync(filename)) {
  const backup = filename + "." + Date.now() + ".bak";
  renameSync(filename, backup);
  console.log("Demo state backed up. Start npm run dev to seed a fresh state.");
} else console.log("Demo state is already empty. Start npm run dev.");
