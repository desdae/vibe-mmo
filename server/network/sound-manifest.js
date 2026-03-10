const fs = require("fs");
const path = require("path");

const DEFAULT_SOUND_EXTENSIONS = [".mp3", ".ogg", ".wav", ".m4a"];

function toPublicUrlPath(absolutePath, publicDir) {
  const relative = path.relative(publicDir, absolutePath);
  if (!relative || relative.startsWith("..")) {
    return "";
  }
  const normalized = relative
    .split(path.sep)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return normalized ? `/${normalized}` : "";
}

function collectSoundUrlPaths(rootDir, publicDir, extensionSet) {
  const urls = [];
  if (!fs.existsSync(rootDir)) {
    return urls;
  }

  const stack = [rootDir];
  while (stack.length) {
    const currentDir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_error) {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!extensionSet.has(ext)) {
        continue;
      }
      const urlPath = toPublicUrlPath(absolutePath, publicDir);
      if (urlPath) {
        urls.push(urlPath);
      }
    }
  }

  urls.sort();
  return urls;
}

function createSoundManifestBuilder(options = {}) {
  const publicDir = options.publicDir;
  if (!publicDir) {
    throw new Error("createSoundManifestBuilder requires publicDir");
  }
  const soundsSubdir = String(options.soundsSubdir || "sounds").trim() || "sounds";
  const rootDir = path.join(publicDir, soundsSubdir);
  const extensionSet = new Set(
    Array.isArray(options.extensions) && options.extensions.length
      ? options.extensions.map((ext) => String(ext).toLowerCase())
      : DEFAULT_SOUND_EXTENSIONS
  );

  return function buildSoundManifest() {
    return {
      availableUrls: collectSoundUrlPaths(rootDir, publicDir, extensionSet)
    };
  };
}

module.exports = {
  createSoundManifestBuilder,
  DEFAULT_SOUND_EXTENSIONS
};
