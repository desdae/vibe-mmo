const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const indexDevPath = path.join(publicDir, "index.dev.html");
const bundlePath = path.join(publicDir, "app.bundle.min.js");
const indexProdPath = path.join(publicDir, "index.prod.html");

function extractScriptSources(indexHtml) {
  const sources = [];
  const scriptRegex = /<script\s+src="([^"]+)"\s*><\/script>/gi;
  let match = scriptRegex.exec(indexHtml);
  while (match) {
    const src = String(match[1] || "").trim();
    if (src.toLowerCase().endsWith(".js")) {
      sources.push(src);
    }
    match = scriptRegex.exec(indexHtml);
  }
  return sources;
}

function toLocalScriptPath(src) {
  const withoutQuery = String(src || "").split("?")[0];
  const relative = withoutQuery.replace(/^[/\\]+/, "");
  const abs = path.resolve(publicDir, relative);
  if (abs !== publicDir && !abs.startsWith(publicDir + path.sep)) {
    throw new Error(`Refusing to bundle script outside public directory: ${src}`);
  }
  return abs;
}

function build() {
  if (!fs.existsSync(indexDevPath)) {
    throw new Error(`Missing ${indexDevPath}.`);
  }

  const indexDevHtml = fs.readFileSync(indexDevPath, "utf8");
  const scripts = extractScriptSources(indexDevHtml).filter((src) => src !== "/app.bundle.min.js");
  if (!scripts.length) {
    throw new Error("No JS script tags found in public/index.dev.html.");
  }

  const concatenated = scripts
    .map((src) => {
      const abs = toLocalScriptPath(src);
      if (!fs.existsSync(abs)) {
        throw new Error(`Script referenced in index.dev.html not found: ${src}`);
      }
      const content = fs.readFileSync(abs, "utf8");
      return `/* ${src} */\n${content}\n`;
    })
    .join("\n;\n");

  const transformed = esbuild.transformSync(concatenated, {
    loader: "js",
    minify: true,
    target: "es2018",
    legalComments: "none"
  });

  fs.writeFileSync(bundlePath, transformed.code, "utf8");

  const bundleScriptTag = "    <script src=\"/app.bundle.min.js\"></script>";
  const scriptBlockRegex = /(\s*<script\s+src="[^"]+"\s*><\/script>\s*)+(?=\s*<\/body>)/i;
  let indexProdHtml;
  if (scriptBlockRegex.test(indexDevHtml)) {
    indexProdHtml = indexDevHtml.replace(scriptBlockRegex, `${bundleScriptTag}\n`);
  } else if (indexDevHtml.includes("</body>")) {
    indexProdHtml = indexDevHtml.replace("</body>", `${bundleScriptTag}\n  </body>`);
  } else {
    indexProdHtml = `${indexDevHtml}\n${bundleScriptTag}\n`;
  }
  fs.writeFileSync(indexProdPath, indexProdHtml, "utf8");

  console.log(`[build] Bundled ${scripts.length} scripts -> public/app.bundle.min.js`);
  console.log("[build] Wrote public/index.prod.html");
}

try {
  build();
} catch (error) {
  const reason = error && error.message ? error.message : String(error);
  console.error(`[build] Failed: ${reason}`);
  process.exit(1);
}
