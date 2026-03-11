(function initTownLayout(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeTownLayout = rootFactory();
})(function buildTownLayoutModule() {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeTownConfig(source = {}) {
    const size = Math.max(7, Math.floor(Number(source.size) || 15));
    const wallThickness = clamp(Math.floor(Number(source.wallThickness) || 1), 1, Math.max(1, Math.floor(size / 3)));
    const maxExitWidth = Math.max(1, size - wallThickness * 2);
    const exitWidth = clamp(Math.floor(Number(source.exitWidth) || 3), 1, maxExitWidth);
    const vendorInteractRange = Math.max(0.5, Number(source.vendorInteractRange) || 2.25);
    const mobExclusionPadding = Math.max(0, Number(source.mobExclusionPadding) || 1.5);
    return {
      enabled: source.enabled !== false,
      size,
      wallThickness,
      exitWidth,
      vendorId: String(source.vendorId || "starter_vendor"),
      vendorName: String(source.vendorName || "Town Quartermaster"),
      vendorInteractRange,
      mobExclusionPadding
    };
  }

  function computeTownLayout(mapWidth, mapHeight, source = {}) {
    const config = normalizeTownConfig(source);
    const centerTileX = Math.floor(Number(mapWidth) * 0.5);
    const centerTileY = Math.floor(Number(mapHeight) * 0.5);
    const minTileX = centerTileX - Math.floor(config.size / 2);
    const minTileY = centerTileY - Math.floor(config.size / 2);
    const maxTileX = minTileX + config.size - 1;
    const maxTileY = minTileY + config.size - 1;
    const gateHalf = Math.floor(config.exitWidth / 2);
    const northGate = { min: centerTileX - gateHalf, max: centerTileX + gateHalf };
    const southGate = { min: northGate.min, max: northGate.max };
    const westGate = { min: centerTileY - gateHalf, max: centerTileY + gateHalf };
    const eastGate = { min: westGate.min, max: westGate.max };
    return {
      ...config,
      centerTileX,
      centerTileY,
      minTileX,
      minTileY,
      maxTileX,
      maxTileY,
      northGate,
      southGate,
      westGate,
      eastGate,
      vendor: {
        id: config.vendorId,
        name: config.vendorName,
        x: centerTileX,
        y: centerTileY,
        interactRange: config.vendorInteractRange
      }
    };
  }

  function pointToTile(value) {
    return Math.floor(Number(value) || 0);
  }

  function isPointInTown(layout, x, y, padding = 0) {
    if (!layout || layout.enabled === false) {
      return false;
    }
    const px = Number(x) || 0;
    const py = Number(y) || 0;
    const pad = Math.max(0, Number(padding) || 0);
    return (
      px >= layout.minTileX - pad &&
      px < layout.maxTileX + 1 + pad &&
      py >= layout.minTileY - pad &&
      py < layout.maxTileY + 1 + pad
    );
  }

  function isTownGateTile(layout, tileX, tileY) {
    if (!layout || layout.enabled === false) {
      return false;
    }
    if (tileY === layout.minTileY && tileX >= layout.northGate.min && tileX <= layout.northGate.max) {
      return true;
    }
    if (tileY === layout.maxTileY && tileX >= layout.southGate.min && tileX <= layout.southGate.max) {
      return true;
    }
    if (tileX === layout.minTileX && tileY >= layout.westGate.min && tileY <= layout.westGate.max) {
      return true;
    }
    if (tileX === layout.maxTileX && tileY >= layout.eastGate.min && tileY <= layout.eastGate.max) {
      return true;
    }
    return false;
  }

  function isTownWallTile(layout, tileX, tileY) {
    if (!layout || layout.enabled === false) {
      return false;
    }
    if (
      tileX < layout.minTileX ||
      tileX > layout.maxTileX ||
      tileY < layout.minTileY ||
      tileY > layout.maxTileY
    ) {
      return false;
    }
    const onOuterWall =
      tileX - layout.minTileX < layout.wallThickness ||
      layout.maxTileX - tileX < layout.wallThickness ||
      tileY - layout.minTileY < layout.wallThickness ||
      layout.maxTileY - tileY < layout.wallThickness;
    if (!onOuterWall) {
      return false;
    }
    return !isTownGateTile(layout, tileX, tileY);
  }

  function isPointBlockedByTownWall(layout, x, y) {
    return isTownWallTile(layout, pointToTile(x), pointToTile(y));
  }

  function getTownWallTiles(layout) {
    if (!layout || layout.enabled === false) {
      return [];
    }
    const tiles = [];
    for (let y = layout.minTileY; y <= layout.maxTileY; y += 1) {
      for (let x = layout.minTileX; x <= layout.maxTileX; x += 1) {
        if (isTownWallTile(layout, x, y)) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  function serializeTownLayout(layout) {
    if (!layout) {
      return null;
    }
    return {
      enabled: layout.enabled !== false,
      size: layout.size,
      wallThickness: layout.wallThickness,
      exitWidth: layout.exitWidth,
      vendorInteractRange: layout.vendorInteractRange,
      mobExclusionPadding: layout.mobExclusionPadding,
      centerTileX: layout.centerTileX,
      centerTileY: layout.centerTileY,
      minTileX: layout.minTileX,
      minTileY: layout.minTileY,
      maxTileX: layout.maxTileX,
      maxTileY: layout.maxTileY,
      northGate: { ...layout.northGate },
      southGate: { ...layout.southGate },
      westGate: { ...layout.westGate },
      eastGate: { ...layout.eastGate },
      vendor: layout.vendor ? { ...layout.vendor } : null
    };
  }

  return Object.freeze({
    normalizeTownConfig,
    computeTownLayout,
    isPointInTown,
    isTownGateTile,
    isTownWallTile,
    isPointBlockedByTownWall,
    getTownWallTiles,
    serializeTownLayout
  });
});
