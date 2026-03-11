const { loadGameplayConfigFromDisk } = require("./gameplay-config");

const DEFAULT_GAMEPLAY_CONFIG = Object.freeze({
  map: {
    width: 1000,
    height: 1000,
    visibilityRange: 20
  },
  town: {
    enabled: true,
    size: 15,
    wallThickness: 1,
    exitWidth: 3,
    vendorId: "starter_vendor",
    vendorName: "Town Quartermaster",
    vendorInteractRange: 2.25,
    mobExclusionPadding: 1.5
  },
  tickMs: 50,
  player: {
    baseSpeed: 6,
    baseExpToNext: 20,
    expGrowthFactor: 1.25,
    mobMinSeparation: 0.9,
    mobSeparationIterations: 2
  },
  projectile: {
    defaultHitRadius: 0.6
  },
  clusterSpawning: {
    targetClusters: 16,
    clusterAreaSize: 10,
    maxClustersPerArea: 2,
    minSpawnRadiusFromCenter: 20,
    observedSpawnPadding: 10,
    unobservedDespawnMs: 120000
  },
  mob: {
    wanderRadius: 10,
    provokedLeashRadius: 50,
    provokedChaseMs: 60000,
    aggroRange: 5,
    attackRange: 1.25,
    attackCooldownMs: 900,
    minSeparation: 0.85,
    separationIterations: 2,
    levelDistance: 10,
    levelHealthMultiplier: 1.25,
    levelDamageMultiplier: 1.15,
    levelSpeedMultiplier: 1.03
  },
  loot: {
    bagPickupRange: 2.25,
    bagClickRange: 1.8,
    bagDespawnMs: 300000,
    copperItemId: "copperCoin"
  },
  inventory: {
    cols: 5,
    rows: 2
  },
  audio: {
    abilitySpatialMaxDistance: 15,
    abilityPanDistance: 15,
    projectileMaxConcurrent: 10
  }
});

function loadGameplayRuntimeConfig(gameplayConfigPath) {
  const gameplayConfig = loadGameplayConfigFromDisk(gameplayConfigPath, DEFAULT_GAMEPLAY_CONFIG);
  const constants = {
    mapWidth: gameplayConfig.map.width,
    mapHeight: gameplayConfig.map.height,
    visibilityRange: gameplayConfig.map.visibilityRange,
    townConfig: gameplayConfig.town,
    tickMs: gameplayConfig.tickMs,
    basePlayerSpeed: gameplayConfig.player.baseSpeed,
    targetMobClusters: gameplayConfig.clusterSpawning.targetClusters,
    clusterAreaSize: gameplayConfig.clusterSpawning.clusterAreaSize,
    maxClustersPerArea: gameplayConfig.clusterSpawning.maxClustersPerArea,
    minSpawnRadiusFromCenter: gameplayConfig.clusterSpawning.minSpawnRadiusFromCenter,
    observedSpawnPadding: gameplayConfig.clusterSpawning.observedSpawnPadding,
    unobservedDespawnMs: gameplayConfig.clusterSpawning.unobservedDespawnMs,
    mobWanderRadius: gameplayConfig.mob.wanderRadius,
    mobProvokedLeashRadius: gameplayConfig.mob.provokedLeashRadius,
    mobProvokedChaseMs: gameplayConfig.mob.provokedChaseMs,
    mobAggroRange: gameplayConfig.mob.aggroRange,
    mobAttackRange: gameplayConfig.mob.attackRange,
    mobAttackCooldownMs: gameplayConfig.mob.attackCooldownMs,
    mobMinSeparation: gameplayConfig.mob.minSeparation,
    mobSeparationIterations: gameplayConfig.mob.separationIterations,
    mobLevelDistance: gameplayConfig.mob.levelDistance,
    mobLevelHealthMultiplier: gameplayConfig.mob.levelHealthMultiplier,
    mobLevelDamageMultiplier: gameplayConfig.mob.levelDamageMultiplier,
    mobLevelSpeedMultiplier: gameplayConfig.mob.levelSpeedMultiplier,
    playerMobMinSeparation: gameplayConfig.player.mobMinSeparation,
    playerMobSeparationIterations: gameplayConfig.player.mobSeparationIterations,
    baseExpToNext: gameplayConfig.player.baseExpToNext,
    expGrowthFactor: gameplayConfig.player.expGrowthFactor,
    defaultProjectileHitRadius: gameplayConfig.projectile.defaultHitRadius,
    bagPickupRange: gameplayConfig.loot.bagPickupRange,
    bagClickRange: gameplayConfig.loot.bagClickRange,
    bagDespawnMs: gameplayConfig.loot.bagDespawnMs,
    inventoryCols: gameplayConfig.inventory.cols,
    inventoryRows: gameplayConfig.inventory.rows,
    inventorySlotCount: gameplayConfig.inventory.cols * gameplayConfig.inventory.rows,
    copperItemId: gameplayConfig.loot.copperItemId
  };

  return {
    gameplayConfig,
    constants,
    defaultGameplayConfig: DEFAULT_GAMEPLAY_CONFIG
  };
}

module.exports = {
  DEFAULT_GAMEPLAY_CONFIG,
  loadGameplayRuntimeConfig
};
