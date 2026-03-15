const fs = require("fs");
const path = require("path");

function createBiomeResolver(options = {}) {
  const biomeDataPath = options.biomeDataPath
    ? path.resolve(String(options.biomeDataPath))
    : path.resolve(__dirname, "../../data/biomes.json");
  const mapWidth = Math.max(64, Math.floor(Number(options.mapWidth) || 1000));
  const mapHeight = Math.max(64, Math.floor(Number(options.mapHeight) || 1000));
  const townLayout = options.townLayout || null;
  let loadedData = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeTags(values) {
    const tags = [];
    for (const value of Array.isArray(values) ? values : []) {
      const tag = normalizeId(value);
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
    return tags;
  }

  function loadBiomeData() {
    if (loadedData) {
      return loadedData;
    }
    try {
      loadedData = JSON.parse(fs.readFileSync(biomeDataPath, "utf8"));
    } catch (error) {
      console.error("[biome-resolver] Failed to load biome data:", error.message);
      loadedData = { bands: [], sectors: [], biomes: [] };
    }
    return loadedData;
  }

  function getOrigin() {
    const origin = loadBiomeData().origin || {};
    if (normalizeId(origin.mode) === "town_center" && townLayout) {
      const townX = Number(townLayout.centerTileX);
      const townY = Number(townLayout.centerTileY);
      if (Number.isFinite(townX) && Number.isFinite(townY)) {
        return { x: townX + 0.5, y: townY + 0.5 };
      }
    }
    return {
      x: Number(origin.x) || mapWidth * 0.5,
      y: Number(origin.y) || mapHeight * 0.5
    };
  }

  function getBands() {
    return Array.isArray(loadBiomeData().bands) ? loadBiomeData().bands : [];
  }

  function getSectors() {
    return Array.isArray(loadBiomeData().sectors) ? loadBiomeData().sectors : [];
  }

  function getBiomeDefs() {
    return Array.isArray(loadBiomeData().biomes) ? loadBiomeData().biomes : [];
  }

  function getBandForDistance(distance) {
    const d = Math.max(0, Number(distance) || 0);
    return getBands().find((band) => d >= Number(band.distanceMin || 0) && d < Number(band.distanceMax || Infinity)) || null;
  }

  function normalizeAngleDeg(angleDeg) {
    let angle = Number(angleDeg) || 0;
    while (angle < 0) {
      angle += 360;
    }
    while (angle >= 360) {
      angle -= 360;
    }
    return angle;
  }

  function angleInSector(angleDeg, sector) {
    const angle = normalizeAngleDeg(angleDeg);
    const min = normalizeAngleDeg(Number(sector.angleMinDeg) || 0);
    const max = normalizeAngleDeg(Number(sector.angleMaxDeg) || 0);
    if (min <= max) {
      return angle >= min && angle < max;
    }
    return angle >= min || angle < max;
  }

  function getSectorForAngle(angleDeg) {
    return getSectors().find((sector) => angleInSector(angleDeg, sector)) || null;
  }

  function resolveBiomeAt(x, y) {
    const pointX = clamp(Number(x) || 0, 0, mapWidth);
    const pointY = clamp(Number(y) || 0, 0, mapHeight);
    const origin = getOrigin();
    const dx = pointX - origin.x;
    const dy = pointY - origin.y;
    const distance = Math.hypot(dx, dy);
    const angleDeg = normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    const band = getBandForDistance(distance);
    const sector = getSectorForAngle(angleDeg);
    const biomeDefMap = new Map(getBiomeDefs().map((entry) => [normalizeId(entry && entry.id), entry]));
    const weights = new Map();
    for (const [biomeId, amount] of Object.entries(band && band.biomeWeights && typeof band.biomeWeights === "object" ? band.biomeWeights : {})) {
      weights.set(normalizeId(biomeId), (weights.get(normalizeId(biomeId)) || 0) + Number(amount || 0));
    }
    for (const [biomeId, amount] of Object.entries(sector && sector.biomeWeights && typeof sector.biomeWeights === "object" ? sector.biomeWeights : {})) {
      weights.set(normalizeId(biomeId), (weights.get(normalizeId(biomeId)) || 0) + Number(amount || 0));
    }
    const total = Array.from(weights.values()).reduce((sum, value) => sum + value, 0);
    const biomeWeights = Array.from(weights.entries())
      .map(([biomeId, amount]) => ({ biomeId, weight: total > 0 ? Number(amount) / total : 0 }))
      .sort((left, right) => right.weight - left.weight);
    const primaryBiome = biomeWeights.length ? biomeDefMap.get(biomeWeights[0].biomeId) || null : null;
    return {
      origin,
      point: { x: pointX, y: pointY },
      distance,
      angleDeg,
      bandId: normalizeId(band && band.id),
      sectorId: normalizeId(sector && sector.id),
      primaryBiomeId: normalizeId(primaryBiome && primaryBiome.id),
      tags: normalizeTags([
        ...(band && band.tags ? band.tags : []),
        ...(sector && sector.tags ? sector.tags : []),
        ...(primaryBiome && primaryBiome.tags ? primaryBiome.tags : []),
        primaryBiome && primaryBiome.id
      ]),
      biomeWeights,
      resourceWeights:
        primaryBiome && primaryBiome.resourceWeights && typeof primaryBiome.resourceWeights === "object"
          ? { ...primaryBiome.resourceWeights }
          : {}
    };
  }

  return {
    loadBiomeData,
    getOrigin,
    getBands,
    getSectors,
    getBiomeDefs,
    getBandForDistance,
    getSectorForAngle,
    resolveBiomeAt
  };
}

module.exports = {
  createBiomeResolver
};
