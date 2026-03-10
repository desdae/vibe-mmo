function createWorldState() {
  let nextPlayerId = 1;
  let nextProjectileId = 1;
  let nextSpawnerId = 1;
  let nextMobId = 1;
  let nextLootBagId = 1;
  let nextAreaEffectId = 1;

  const players = new Map();
  const projectiles = new Map();
  const mobSpawners = new Map();
  const mobs = new Map();
  const lootBags = new Map();
  const activeAreaEffects = new Map();

  function allocatePlayerId() {
    return String(nextPlayerId++);
  }

  function allocateProjectileId() {
    return nextProjectileId++;
  }

  function allocateSpawnerId() {
    return nextSpawnerId++;
  }

  function allocateMobId() {
    return nextMobId++;
  }

  function allocateLootBagId() {
    return String(nextLootBagId++);
  }

  function allocateAreaEffectId() {
    return String(nextAreaEffectId++);
  }

  return {
    players,
    projectiles,
    mobSpawners,
    mobs,
    lootBags,
    activeAreaEffects,
    allocatePlayerId,
    allocateProjectileId,
    allocateSpawnerId,
    allocateMobId,
    allocateLootBagId,
    allocateAreaEffectId
  };
}

module.exports = {
  createWorldState
};
