function createSpatialTools({ mapWidth, mapHeight, clamp, spawnMaxDistance = 10 }) {
  function randomPointInRadius(cx, cy, radius) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    return {
      x: clamp(cx + Math.cos(angle) * r, 0, mapWidth - 1),
      y: clamp(cy + Math.sin(angle) * r, 0, mapHeight - 1)
    };
  }

  function clampToSpawnRadius(x, y, spawnX, spawnY, radius) {
    const dx = x - spawnX;
    const dy = y - spawnY;
    const len = Math.hypot(dx, dy);
    if (!len || len <= radius) {
      return { x, y };
    }
    const scale = radius / len;
    return {
      x: clamp(spawnX + dx * scale, 0, mapWidth - 1),
      y: clamp(spawnY + dy * scale, 0, mapHeight - 1)
    };
  }

  function randomSpawn() {
    const centerX = Math.floor(mapWidth / 2);
    const centerY = Math.floor(mapHeight / 2);
    const maxDistance = Math.max(1, Number(spawnMaxDistance) || 10);

    for (let i = 0; i < 100; i += 1) {
      const dx = Math.floor(Math.random() * (maxDistance * 2 + 1)) - maxDistance;
      const dy = Math.floor(Math.random() * (maxDistance * 2 + 1)) - maxDistance;
      if (dx * dx + dy * dy <= maxDistance * maxDistance) {
        return {
          x: clamp(centerX + dx, 0, mapWidth - 1),
          y: clamp(centerY + dy, 0, mapHeight - 1)
        };
      }
    }

    return {
      x: centerX,
      y: centerY
    };
  }

  function inVisibilityRange(a, b, range) {
    return Math.abs(a.x - b.x) <= range && Math.abs(a.y - b.y) <= range;
  }

  return {
    randomPointInRadius,
    clampToSpawnRadius,
    randomSpawn,
    inVisibilityRange
  };
}

module.exports = {
  createSpatialTools
};
