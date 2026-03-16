(function initVibeClientCanvasBackgroundCache(globalScope) {
  "use strict";

  function createCanvasBackgroundCache(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    const canvas = deps.canvas;
    const tileSize = Math.max(1, Number(deps.tileSize) || 32);
    const worldToScreen = typeof deps.worldToScreen === "function" ? deps.worldToScreen : null;
    const getTownLayout = typeof deps.getTownLayout === "function" ? deps.getTownLayout : () => null;
    const getTownWallTiles = typeof deps.getTownWallTiles === "function" ? deps.getTownWallTiles : () => [];
    const getTownTileSprite = typeof deps.getTownTileSprite === "function" ? deps.getTownTileSprite : null;
    const isTownGateTileAt = typeof deps.isTownGateTileAt === "function" ? deps.isTownGateTileAt : () => false;
    const getMapWidth = typeof deps.getMapWidth === "function" ? deps.getMapWidth : () => 0;
    const getMapHeight = typeof deps.getMapHeight === "function" ? deps.getMapHeight : () => 0;
    const createCanvas =
      typeof deps.createCanvas === "function"
        ? deps.createCanvas
        : (width, height) => {
            const documentObject = deps.document || globalScope.document;
            if (!documentObject || typeof documentObject.createElement !== "function") {
              return null;
            }
            const surface = documentObject.createElement("canvas");
            surface.width = Math.max(1, Math.ceil(Number(width) || 1));
            surface.height = Math.max(1, Math.ceil(Number(height) || 1));
            return surface;
          };
    if (!ctx || !canvas || !worldToScreen || !getTownTileSprite) {
      return null;
    }

    let cachedTownLayout = null;
    let cachedTownWallTiles = null;
    let cachedTownTileSize = tileSize;
    let townSurface = null;
    let townOriginX = 0;
    let townOriginY = 0;
    let gridPattern = null;
    let cachedGridTileSize = tileSize;

    function ensureTownSurface() {
      const layout = getTownLayout();
      const wallTiles = Array.isArray(getTownWallTiles()) ? getTownWallTiles() : [];
      if (!layout || layout.enabled === false) {
        cachedTownLayout = layout;
        cachedTownWallTiles = wallTiles;
        townSurface = null;
        return null;
      }
      if (townSurface && cachedTownLayout === layout && cachedTownWallTiles === wallTiles && cachedTownTileSize === tileSize) {
        return {
          surface: townSurface,
          originX: townOriginX,
          originY: townOriginY
        };
      }
      const minTileX = Number(layout.minTileX) || 0;
      const minTileY = Number(layout.minTileY) || 0;
      const maxTileX = Number(layout.maxTileX) || minTileX;
      const maxTileY = Number(layout.maxTileY) || minTileY;
      const widthTiles = Math.max(1, maxTileX - minTileX + 1);
      const heightTiles = Math.max(1, maxTileY - minTileY + 1);
      const surface = createCanvas(widthTiles * tileSize, heightTiles * tileSize);
      if (!surface || typeof surface.getContext !== "function") {
        return null;
      }
      const surfaceCtx = surface.getContext("2d");
      if (!surfaceCtx) {
        return null;
      }
      const wallTileSet = new Set(
        wallTiles.map((tile) => `${Number(tile && tile.x) || 0}:${Number(tile && tile.y) || 0}`)
      );
      for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
          const px = (tileX - minTileX) * tileSize;
          const py = (tileY - minTileY) * tileSize;
          const sprite = getTownTileSprite(wallTileSet.has(`${tileX}:${tileY}`) ? "wall" : "floor", tileX, tileY);
          if (sprite) {
            surfaceCtx.drawImage(sprite, px, py, tileSize, tileSize);
          }
          if (isTownGateTileAt(tileX, tileY)) {
            surfaceCtx.fillStyle = "rgba(232, 196, 129, 0.16)";
            surfaceCtx.fillRect(Math.round(px + 4), Math.round(py + 4), tileSize - 8, tileSize - 8);
          }
        }
      }
      cachedTownLayout = layout;
      cachedTownWallTiles = wallTiles;
      cachedTownTileSize = tileSize;
      townSurface = surface;
      townOriginX = minTileX;
      townOriginY = minTileY;
      return {
        surface: townSurface,
        originX: townOriginX,
        originY: townOriginY
      };
    }

    function ensureGridPattern() {
      if (gridPattern && cachedGridTileSize === tileSize) {
        return gridPattern;
      }
      const patternSurface = createCanvas(tileSize, tileSize);
      if (!patternSurface || typeof patternSurface.getContext !== "function") {
        return null;
      }
      const patternCtx = patternSurface.getContext("2d");
      if (!patternCtx || typeof ctx.createPattern !== "function") {
        return null;
      }
      patternCtx.clearRect(0, 0, tileSize, tileSize);
      patternCtx.strokeStyle = "rgba(87, 147, 172, 0.17)";
      patternCtx.lineWidth = 1;
      patternCtx.beginPath();
      patternCtx.moveTo(0.5, 0);
      patternCtx.lineTo(0.5, tileSize);
      patternCtx.moveTo(0, 0.5);
      patternCtx.lineTo(tileSize, 0.5);
      patternCtx.stroke();
      cachedGridTileSize = tileSize;
      gridPattern = ctx.createPattern(patternSurface, "repeat");
      return gridPattern;
    }

    function drawTown(cameraX, cameraY) {
      const cachedTown = ensureTownSurface();
      if (!cachedTown) {
        return;
      }
      const origin = worldToScreen(cachedTown.originX, cachedTown.originY, cameraX, cameraY);
      ctx.drawImage(cachedTown.surface, Math.round(origin.x), Math.round(origin.y));
    }

    function drawGrid(cameraX, cameraY) {
      drawTown(cameraX, cameraY);
      const pattern = ensureGridPattern();
      const mapWidth = Math.max(0, Number(getMapWidth()) || 0);
      const mapHeight = Math.max(0, Number(getMapHeight()) || 0);
      if (!pattern || mapWidth <= 0 || mapHeight <= 0) {
        return;
      }
      const mapOrigin = worldToScreen(0, 0, cameraX, cameraY);
      const left = Math.round(mapOrigin.x);
      const top = Math.round(mapOrigin.y);
      const widthPx = mapWidth * tileSize;
      const heightPx = mapHeight * tileSize;
      const clipLeft = Math.max(0, left);
      const clipTop = Math.max(0, top);
      const clipRight = Math.min(canvas.width, left + widthPx);
      const clipBottom = Math.min(canvas.height, top + heightPx);
      if (clipRight <= clipLeft || clipBottom <= clipTop) {
        return;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipLeft, clipTop, clipRight - clipLeft, clipBottom - clipTop);
      ctx.clip();
      ctx.translate(left, top);
      ctx.fillStyle = pattern;
      ctx.fillRect(-tileSize, -tileSize, widthPx + tileSize * 2, heightPx + tileSize * 2);
      ctx.restore();
    }

    return {
      drawTown,
      drawGrid
    };
  }

  globalScope.VibeClientCanvasBackgroundCache = Object.freeze({
    createCanvasBackgroundCache
  });
})(globalThis);
