const fs = require("fs");
const { parseGameplayInt, parseGameplayNumber } = require("../gameplay/number-utils");

function buildGameplayConfig(parsed, defaults) {
  const src = parsed && typeof parsed === "object" ? parsed : {};
  const map = src.map && typeof src.map === "object" ? src.map : {};
  const player = src.player && typeof src.player === "object" ? src.player : {};
  const projectile = src.projectile && typeof src.projectile === "object" ? src.projectile : {};
  const clusterSpawning =
    src.clusterSpawning && typeof src.clusterSpawning === "object" ? src.clusterSpawning : {};
  const mob = src.mob && typeof src.mob === "object" ? src.mob : {};
  const loot = src.loot && typeof src.loot === "object" ? src.loot : {};
  const inventory = src.inventory && typeof src.inventory === "object" ? src.inventory : {};
  const audio = src.audio && typeof src.audio === "object" ? src.audio : {};

  return {
    map: {
      width: parseGameplayInt(map.width, defaults.map.width, 10, 10000),
      height: parseGameplayInt(map.height, defaults.map.height, 10, 10000),
      visibilityRange: parseGameplayNumber(map.visibilityRange, defaults.map.visibilityRange, 1, 100)
    },
    tickMs: parseGameplayInt(src.tickMs, defaults.tickMs, 10, 1000),
    player: {
      baseSpeed: parseGameplayNumber(player.baseSpeed, defaults.player.baseSpeed, 0.1, 50),
      baseExpToNext: parseGameplayInt(player.baseExpToNext, defaults.player.baseExpToNext, 1, 1000000),
      expGrowthFactor: parseGameplayNumber(player.expGrowthFactor, defaults.player.expGrowthFactor, 1, 10),
      mobMinSeparation: parseGameplayNumber(player.mobMinSeparation, defaults.player.mobMinSeparation, 0, 10),
      mobSeparationIterations: parseGameplayInt(
        player.mobSeparationIterations,
        defaults.player.mobSeparationIterations,
        0,
        20
      )
    },
    projectile: {
      defaultHitRadius: parseGameplayNumber(projectile.defaultHitRadius, defaults.projectile.defaultHitRadius, 0.1, 8)
    },
    clusterSpawning: {
      targetClusters: parseGameplayInt(clusterSpawning.targetClusters, defaults.clusterSpawning.targetClusters, 1, 500),
      clusterAreaSize: parseGameplayNumber(clusterSpawning.clusterAreaSize, defaults.clusterSpawning.clusterAreaSize, 1, 200),
      maxClustersPerArea: parseGameplayInt(
        clusterSpawning.maxClustersPerArea,
        defaults.clusterSpawning.maxClustersPerArea,
        1,
        20
      )
    },
    mob: {
      wanderRadius: parseGameplayNumber(mob.wanderRadius, defaults.mob.wanderRadius, 0, 1000),
      provokedLeashRadius: parseGameplayNumber(mob.provokedLeashRadius, defaults.mob.provokedLeashRadius, 1, 2000),
      provokedChaseMs: parseGameplayInt(mob.provokedChaseMs, defaults.mob.provokedChaseMs, 0, 3600000),
      aggroRange: parseGameplayNumber(mob.aggroRange, defaults.mob.aggroRange, 0, 1000),
      attackRange: parseGameplayNumber(mob.attackRange, defaults.mob.attackRange, 0, 1000),
      attackCooldownMs: parseGameplayInt(mob.attackCooldownMs, defaults.mob.attackCooldownMs, 50, 600000),
      minSeparation: parseGameplayNumber(mob.minSeparation, defaults.mob.minSeparation, 0, 10),
      separationIterations: parseGameplayInt(mob.separationIterations, defaults.mob.separationIterations, 0, 20)
    },
    loot: {
      bagPickupRange: parseGameplayNumber(loot.bagPickupRange, defaults.loot.bagPickupRange, 0, 50),
      bagClickRange: parseGameplayNumber(loot.bagClickRange, defaults.loot.bagClickRange, 0, 50),
      bagDespawnMs: parseGameplayInt(loot.bagDespawnMs, defaults.loot.bagDespawnMs, 0, 86400000),
      copperItemId: String(loot.copperItemId || defaults.loot.copperItemId).trim() || defaults.loot.copperItemId
    },
    inventory: {
      cols: parseGameplayInt(inventory.cols, defaults.inventory.cols, 1, 20),
      rows: parseGameplayInt(inventory.rows, defaults.inventory.rows, 1, 20)
    },
    audio: {
      abilitySpatialMaxDistance: parseGameplayNumber(
        audio.abilitySpatialMaxDistance,
        defaults.audio.abilitySpatialMaxDistance,
        1,
        200
      ),
      abilityPanDistance: parseGameplayNumber(audio.abilityPanDistance, defaults.audio.abilityPanDistance, 1, 200),
      projectileMaxConcurrent: parseGameplayInt(audio.projectileMaxConcurrent, defaults.audio.projectileMaxConcurrent, 1, 64)
    }
  };
}

function loadGameplayConfigFromDisk(configPath, defaults) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("gameplay config root must be an object");
  }
  return buildGameplayConfig(parsed, defaults);
}

module.exports = {
  buildGameplayConfig,
  loadGameplayConfigFromDisk
};
