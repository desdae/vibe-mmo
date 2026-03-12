const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "node_modules", "pixi.js", "dist", "pixi.min.js");
const targetDir = path.join(projectRoot, "public", "vendor");
const targetPath = path.join(targetDir, "pixi.min.js");

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing Pixi runtime at ${sourcePath}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`[sync] Copied Pixi runtime -> ${path.relative(projectRoot, targetPath)}`);
}

try {
  main();
} catch (error) {
  const reason = error && error.message ? error.message : String(error);
  console.error(`[sync] Failed: ${reason}`);
  process.exit(1);
}
