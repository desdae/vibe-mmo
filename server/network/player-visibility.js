function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createPlayerVisibilityTools(options = {}) {
  const defaultVisibilityRange = Math.max(1, Number(options.defaultVisibilityRange) || 20);
  const maxViewportWidth = Math.max(320, Math.floor(Number(options.maxViewportWidth) || 2560));
  const maxViewportHeight = Math.max(240, Math.floor(Number(options.maxViewportHeight) || 1440));
  const visibilityPaddingTiles = Math.max(0, Number(options.visibilityPaddingTiles) || 0);
  const tileSize = Math.max(1, Number(options.tileSize) || 32);

  function buildDefaultExtents() {
    return {
      x: defaultVisibilityRange,
      y: defaultVisibilityRange
    };
  }

  function computeVisibilityExtents(viewportWidth, viewportHeight) {
    const width = Math.floor(Number(viewportWidth) || 0);
    const height = Math.floor(Number(viewportHeight) || 0);
    if (width <= 0 || height <= 0) {
      return {
        width: 0,
        height: 0,
        ...buildDefaultExtents()
      };
    }

    const clampedWidth = clamp(width, 1, maxViewportWidth);
    const clampedHeight = clamp(height, 1, maxViewportHeight);
    return {
      width: clampedWidth,
      height: clampedHeight,
      x: Math.max(1, Math.ceil(clampedWidth / (tileSize * 2)) + visibilityPaddingTiles),
      y: Math.max(1, Math.ceil(clampedHeight / (tileSize * 2)) + visibilityPaddingTiles)
    };
  }

  function getPlayerVisibilityExtents(player) {
    if (!player) {
      return buildDefaultExtents();
    }
    const rangeX = Math.max(1, Number(player.visibilityRangeX) || 0);
    const rangeY = Math.max(1, Number(player.visibilityRangeY) || 0);
    if (!Number.isFinite(rangeX) || !Number.isFinite(rangeY) || rangeX <= 0 || rangeY <= 0) {
      return buildDefaultExtents();
    }
    return {
      x: rangeX,
      y: rangeY
    };
  }

  function updatePlayerViewport(player, viewportWidth, viewportHeight) {
    if (!player) {
      return null;
    }
    const next = computeVisibilityExtents(viewportWidth, viewportHeight);
    const changed =
      Math.floor(Number(player.clientViewportWidth) || 0) !== next.width ||
      Math.floor(Number(player.clientViewportHeight) || 0) !== next.height ||
      Math.floor(Number(player.visibilityRangeX) || 0) !== next.x ||
      Math.floor(Number(player.visibilityRangeY) || 0) !== next.y;
    player.clientViewportWidth = next.width;
    player.clientViewportHeight = next.height;
    player.visibilityRangeX = next.x;
    player.visibilityRangeY = next.y;
    return {
      ...next,
      changed
    };
  }

  return {
    computeVisibilityExtents,
    getPlayerVisibilityExtents,
    updatePlayerViewport
  };
}

module.exports = {
  createPlayerVisibilityTools
};
