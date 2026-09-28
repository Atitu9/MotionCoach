import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = join(
  process.cwd(),
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm",
);
const target = join(process.cwd(), "public", "mediapipe", "wasm");
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, force: true });
