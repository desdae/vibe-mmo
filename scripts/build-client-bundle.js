const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const indexDevPath = path.join(publicDir, "index.dev.html");
const clientEntryPath = path.join(publicDir, "client-entry.js");
const bundlePath = path.join(publicDir, "app.bundle.min.js");
const indexProdPath = path.join(publicDir, "index.prod.html");

function build() {
  if (!fs.existsSync(indexDevPath)) {
    throw new Error(`Missing ${indexDevPath}.`);
  }
  if (!fs.existsSync(clientEntryPath)) {
    throw new Error(`Missing ${clientEntryPath}.`);
  }

  const indexDevHtml = fs.readFileSync(indexDevPath, "utf8");

  const result = esbuild.buildSync({
    entryPoints: [clientEntryPath],
    outfile: bundlePath,
    bundle: true,
    platform: "browser",
    format: "iife",
    minify: true,
    target: "es2018",
    legalComments: "none",
    logLevel: "silent"
  });
  void result;

  const bundleScriptTag = "    <script src=\"/app.bundle.min.js\"></script>";
  const moduleEntryRegex = /\s*<script\s+type="module"\s+src="\/client-entry\.js"\s*><\/script>\s*/i;
  let indexProdHtml;
  if (moduleEntryRegex.test(indexDevHtml)) {
    indexProdHtml = indexDevHtml.replace(moduleEntryRegex, `${bundleScriptTag}\n`);
  } else if (indexDevHtml.includes("</body>")) {
    indexProdHtml = indexDevHtml.replace("</body>", `${bundleScriptTag}\n  </body>`);
  } else {
    indexProdHtml = `${indexDevHtml}\n${bundleScriptTag}\n`;
  }
  fs.writeFileSync(indexProdPath, indexProdHtml, "utf8");

  console.log("[build] Bundled public/client-entry.js -> public/app.bundle.min.js");
  console.log("[build] Wrote public/index.prod.html");
}

try {
  build();
} catch (error) {
  const reason = error && error.message ? error.message : String(error);
  console.error(`[build] Failed: ${reason}`);
  process.exit(1);
}
