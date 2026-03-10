const fs = require("fs");
const path = require("path");

const DEFAULT_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function resolveRequestPath(urlPathname, indexFileName = "index.html") {
  const decodedPath = decodeURIComponent(urlPathname);
  const relativePath =
    decodedPath === "/" || decodedPath === "/index.html"
      ? String(indexFileName || "index.html")
      : decodedPath.replace(/^[/\\]+/, "");
  return path.normalize(relativePath);
}

function createGameHttpServer(options = {}) {
  const {
    http,
    publicDir,
    getGameConfigPayload,
    indexFileName = "index.html",
    contentTypes = DEFAULT_CONTENT_TYPES
  } = options;

  if (!http || typeof http.createServer !== "function") {
    throw new Error("createGameHttpServer requires an http module with createServer()");
  }
  if (!publicDir) {
    throw new Error("createGameHttpServer requires publicDir");
  }
  if (typeof getGameConfigPayload !== "function") {
    throw new Error("createGameHttpServer requires getGameConfigPayload()");
  }

  return http.createServer((req, res) => {
    const reqPath = req.url || "/";
    const pathOnly = reqPath.split("?")[0];
    if (pathOnly === "/api/game-config") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(getGameConfigPayload()));
      return;
    }

    let normalizedPath;
    try {
      normalizedPath = resolveRequestPath(pathOnly, indexFileName);
    } catch (_error) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }

    const filePath = path.resolve(publicDir, normalizedPath);
    if (filePath !== publicDir && !filePath.startsWith(publicDir + path.sep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(err.code === "ENOENT" ? 404 : 500, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        res.end(err.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": contentTypes[ext] || "application/octet-stream"
      });
      res.end(data);
    });
  });
}

module.exports = {
  createGameHttpServer,
  DEFAULT_CONTENT_TYPES
};
