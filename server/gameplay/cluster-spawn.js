const { clamp, randomInt } = require("./number-utils");

function getClusterSpawnWeightAtDistance(clusterDef, distanceFromCenter) {
  if (!clusterDef || !Array.isArray(clusterDef.spawnBands)) {
    return 0;
  }
  const distance = Math.max(0, Number(distanceFromCenter) || 0);
  let total = 0;
  for (const band of clusterDef.spawnBands) {
    if (!band || typeof band !== "object") {
      continue;
    }
    const min = Math.max(0, Number(band.rangeMin) || 0);
    const max = Math.max(min, Number(band.rangeMax) || min);
    if (distance < min || distance > max) {
      continue;
    }
    const peakChance = Math.max(0, Number(band.chance) || 0);
    if (peakChance <= 0) {
      continue;
    }
    const curve = String(band.curve || "linear").trim().toLowerCase();
    if (curve === "flat" || curve === "uniform" || max === min) {
      total += peakChance;
      continue;
    }
    const midpoint = (min + max) * 0.5;
    const halfSpan = Math.max(0.0001, (max - min) * 0.5);
    const normalized = clamp(1 - Math.abs(distance - midpoint) / halfSpan, 0, 1);
    total += peakChance * normalized;
  }
  return total;
}

function pickClusterDef(config, distanceFromCenter = null) {
  if (!config.clusterDefs.length) {
    return null;
  }

  const useDistanceWeighting = Number.isFinite(Number(distanceFromCenter));
  if (!useDistanceWeighting && config.totalSpawnChance <= 0) {
    return config.clusterDefs[randomInt(0, config.clusterDefs.length - 1)];
  }

  const weightedClusters = [];
  let totalWeight = 0;
  for (const clusterDef of config.clusterDefs) {
    const weight = useDistanceWeighting
      ? getClusterSpawnWeightAtDistance(clusterDef, distanceFromCenter)
      : Math.max(0, Number(clusterDef.totalSpawnChance) || 0);
    if (weight <= 0) {
      continue;
    }
    totalWeight += weight;
    weightedClusters.push({ clusterDef, weight });
  }

  if (totalWeight <= 0) {
    return null;
  }

  let roll = Math.random() * totalWeight;
  for (const entry of weightedClusters) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.clusterDef;
    }
  }
  return weightedClusters[weightedClusters.length - 1].clusterDef;
}

module.exports = {
  getClusterSpawnWeightAtDistance,
  pickClusterDef
};
