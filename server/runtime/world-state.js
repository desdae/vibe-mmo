const { normalizeId, mapGet, mapHas } = require("../utils/id-utils");

function createWorldState() {
  let nextPlayerId = 1;
  let nextProjectileId = 1;
  let nextSpawnerId = 1;
  let nextMobId = 1;
  let nextLootBagId = 1;
  let nextAreaEffectId = 1;
  let nextItemInstanceId = 1;

  const players = new Map();
  const projectiles = new Map();
  const mobSpawners = new Map();
  const mobs = new Map();
  const lootBags = new Map();
  const activeAreaEffects = new Map();

  // Helper functions for type-safe lookups
  function getPlayer(playerId) {
    return mapGet(players, playerId);
  }

  function hasPlayer(playerId) {
    return mapHas(players, playerId);
  }

  function getMob(mobId) {
    return mapGet(mobs, mobId);
  }

  function hasMob(mobId) {
    return mapHas(mobs, mobId);
  }

  function getProjectile(projectileId) {
    return mapGet(projectiles, projectileId);
  }

  function hasProjectile(projectileId) {
    return mapHas(projectiles, projectileId);
  }

  function getLootBag(lootBagId) {
    return mapGet(lootBags, lootBagId);
  }

  function hasLootBag(lootBagId) {
    return mapHas(lootBags, lootBagId);
  }

  function getAreaEffect(areaEffectId) {
    return mapGet(activeAreaEffects, areaEffectId);
  }

  function hasAreaEffect(areaEffectId) {
    return mapHas(activeAreaEffects, areaEffectId);
  }

  function allocatePlayerId() {
    return String(nextPlayerId++);
  }

  function allocateProjectileId() {
    return String(nextProjectileId++);
  }

  function allocateSpawnerId() {
    return String(nextSpawnerId++);
  }

  function allocateMobId() {
    return String(nextMobId++);
  }

  function allocateLootBagId() {
    return String(nextLootBagId++);
  }

  function allocateAreaEffectId() {
    return String(nextAreaEffectId++);
  }

  function allocateItemInstanceId() {
    return String(nextItemInstanceId++);
  }

  return {
    players,
    projectiles,
    mobSpawners,
    mobs,
    lootBags,
    activeAreaEffects,
    // Type-safe lookup helpers
    getPlayer,
    hasPlayer,
    getMob,
    hasMob,
    getProjectile,
    hasProjectile,
    getLootBag,
    hasLootBag,
    getAreaEffect,
    hasAreaEffect,
    // ID allocation
    allocatePlayerId,
    allocateProjectileId,
    allocateSpawnerId,
    allocateMobId,
    allocateLootBagId,
    allocateAreaEffectId,
    allocateItemInstanceId
  };
}

module.exports = {
  createWorldState
};
