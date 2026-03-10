const fs = require("fs");

function createDebouncedFileReloader({
  filePath,
  reloadFn,
  debounceMs = 120,
  watchIntervalMs = 1000,
  watchReason = "file change",
  logger = console
}) {
  let reloadTimer = null;

  function schedule(reason) {
    if (reloadTimer !== null) {
      clearTimeout(reloadTimer);
    }
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      reloadFn(reason);
    }, debounceMs);
  }

  function watch() {
    fs.watchFile(filePath, { interval: watchIntervalMs }, (curr, prev) => {
      if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) {
        return;
      }
      schedule(watchReason);
    });
    logger.log(`[config] Watching ${filePath} for changes (poll ${watchIntervalMs}ms)`);
  }

  return {
    schedule,
    watch
  };
}

module.exports = {
  createDebouncedFileReloader
};
