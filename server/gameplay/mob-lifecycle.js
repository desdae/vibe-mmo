function createMobLifecycleTools({
  clamp,
  randomInt,
  randomPointInRadius,
  pickClusterDef,
  mobSpawners,
  mobs,
  players,
  clearMobCast,
  queueMobDeathEvent,
  rollGlobalDropsForPlayer,
  rollMobDrops,
  rollEquipmentDropsAt,
  createLootBag,
  normalizeItemEntries,
  grantPlayerExp,
  allocateMobId,
  allocateSpawnerId,
  getServerConfig,
  getMobConfig,
  mapWidth,
  mapHeight,
  targetMobClusters,
  clusterAreaSize,
  maxClustersPerArea,
  logger = console
}) {
  function createMob(spawner) {
    if (!spawner.clusterDef || !spawner.clusterDef.members.length) {
      return null;
    }

    const memberIndex = randomInt(0, spawner.clusterDef.members.length - 1);
    const mobDef = spawner.clusterDef.members[memberIndex];
    const spawnPos = randomPointInRadius(spawner.x, spawner.y, 1.5);
    const mob = {
      id: String(allocateMobId()),
      spawnerId: spawner.id,
      type: mobDef.name,
      spawnX: spawner.x,
      spawnY: spawner.y,
      x: spawnPos.x,
      y: spawnPos.y,
      hp: mobDef.health,
      maxHp: mobDef.health,
      baseSpeed: mobDef.baseSpeed,
      damageMin: mobDef.damageMin,
      damageMax: mobDef.damageMax,
      respawnMinMs: mobDef.respawnMinMs,
      respawnMaxMs: mobDef.respawnMaxMs,
      dropRules: Array.isArray(mobDef.dropRules) ? mobDef.dropRules.map((entry) => ({ ...entry })) : [],
      renderStyle: mobDef.renderStyle ? { ...mobDef.renderStyle } : null,
      combat: mobDef.combat
        ? {
            ...mobDef.combat,
            basicAttack: mobDef.combat.basicAttack ? { ...mobDef.combat.basicAttack } : null,
            abilities: Array.isArray(mobDef.combat.abilities)
              ? mobDef.combat.abilities.map((entry) => ({ ...entry }))
              : []
          }
        : null,
      lastBiteDirection: { dx: 0, dy: -1 },
      lastAttackAbilityId: "",
      biteCounter: 0,
      activeCast: null,
      castStateVersion: 0,
      alive: true,
      respawnAt: 0,
      wanderTarget: null,
      nextWanderAt: Date.now() + randomInt(400, 1200),
      lastAttackAt: 0,
      chaseTargetPlayerId: null,
      chaseUntil: 0,
      stunnedUntil: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      burningUntil: 0,
      activeDots: new Map(),
      returningHome: false,
      abilityCooldowns: new Map()
    };
    mobs.set(mob.id, mob);
    spawner.mobIds.push(mob.id);
    return mob;
  }

  function getSpawnerCellKey(x, y) {
    const cellX = Math.floor(x / clusterAreaSize);
    const cellY = Math.floor(y / clusterAreaSize);
    return `${cellX},${cellY}`;
  }

  function initializeMobSpawners() {
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const serverConfig = getServerConfig();
    const mobConfig = getMobConfig();
    const targetClusters = Math.max(0, Math.round(targetMobClusters * serverConfig.mobSpawnMultiplier));
    const maxSpawnRadius = Math.max(1, Number(mobConfig.maxSpawnRadius) || 1);

    const clustersPerCell = new Map();
    let attempts = 0;
    const maxAttempts = targetClusters * 100;

    while (mobSpawners.size < targetClusters && attempts < maxAttempts) {
      attempts += 1;
      const distanceFromCenter = Math.random() * maxSpawnRadius;
      const clusterDef = pickClusterDef(mobConfig, distanceFromCenter);
      if (!clusterDef) {
        continue;
      }

      const angle = Math.random() * Math.PI * 2;
      const x = clamp(centerX + Math.cos(angle) * distanceFromCenter, 0, mapWidth - 1);
      const y = clamp(centerY + Math.sin(angle) * distanceFromCenter, 0, mapHeight - 1);
      const cellKey = getSpawnerCellKey(x, y);
      const existingInCell = clustersPerCell.get(cellKey) || 0;
      if (existingInCell >= maxClustersPerArea) {
        continue;
      }

      const spawner = {
        id: String(allocateSpawnerId()),
        x,
        y,
        clusterName: clusterDef.name,
        clusterDef,
        mobIds: []
      };

      mobSpawners.set(spawner.id, spawner);
      clustersPerCell.set(cellKey, existingInCell + 1);

      for (let m = 0; m < clusterDef.maxSize; m += 1) {
        createMob(spawner);
      }
    }

    if (targetClusters > 0 && mobSpawners.size < targetClusters) {
      logger.warn(
        `Only initialized ${mobSpawners.size}/${targetClusters} mob clusters with area limit ${maxClustersPerArea} per ${clusterAreaSize}x${clusterAreaSize}.`
      );
    }
  }

  function killMob(mob, killerPlayerId = null) {
    if (!mob.alive) {
      return;
    }

    mob.alive = false;
    mob.hp = 0;
    mob.respawnAt = Date.now() + randomInt(mob.respawnMinMs, mob.respawnMaxMs);
    mob.wanderTarget = null;
    mob.chaseTargetPlayerId = null;
    mob.chaseUntil = 0;
    mob.stunnedUntil = 0;
    mob.slowUntil = 0;
    mob.slowMultiplier = 1;
    mob.burningUntil = 0;
    mob.activeDots = new Map();
    mob.abilityCooldowns = new Map();
    clearMobCast(mob);
    queueMobDeathEvent(mob);
    const killer = killerPlayerId ? players.get(String(killerPlayerId)) : null;
    const globalDrops = rollGlobalDropsForPlayer(killer);
    const mobDrops = rollMobDrops(mob);
    const equipmentDrops = rollEquipmentDropsAt(mob.x, mob.y);
    createLootBag(mob.x, mob.y, normalizeItemEntries([...globalDrops, ...mobDrops, ...equipmentDrops]));

    if (killer) {
      const expGained = Math.floor((Number(mob.maxHp) || 0) / 10);
      grantPlayerExp(killer, expGained);
    }
  }

  function respawnMob(mob) {
    const spawnPos = randomPointInRadius(mob.spawnX, mob.spawnY, 1.5);
    mob.x = spawnPos.x;
    mob.y = spawnPos.y;
    mob.hp = mob.maxHp;
    mob.alive = true;
    mob.lastBiteDirection = { dx: 0, dy: -1 };
    mob.lastAttackAbilityId = "";
    mob.biteCounter = 0;
    mob.respawnAt = 0;
    mob.wanderTarget = null;
    mob.nextWanderAt = Date.now() + randomInt(500, 1800);
    mob.lastAttackAt = 0;
    mob.chaseTargetPlayerId = null;
    mob.chaseUntil = 0;
    mob.stunnedUntil = 0;
    mob.slowUntil = 0;
    mob.slowMultiplier = 1;
    mob.burningUntil = 0;
    mob.activeDots = new Map();
    mob.returningHome = false;
    mob.abilityCooldowns = new Map();
    clearMobCast(mob);
  }

  return {
    createMob,
    initializeMobSpawners,
    killMob,
    respawnMob
  };
}

module.exports = {
  createMobLifecycleTools
};
