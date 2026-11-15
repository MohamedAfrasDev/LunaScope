// Copies the static files CesiumJS loads at runtime (web workers, third-party decoders, assets) to public/cesium.
// public/cesium is not committed; this runs before `dev` and `build`.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "cesium", "Build", "Cesium");
const to = join(root, "public", "cesium");

if (!existsSync(from)) {
  console.error("copy-cesium: node_modules/cesium is missing; run npm install");
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const dir of ["Workers", "ThirdParty", "Assets"]) cpSync(join(from, dir), join(to, dir), { recursive: true });
console.log("copy-cesium: copied Workers, ThirdParty and Assets to public/cesium");
