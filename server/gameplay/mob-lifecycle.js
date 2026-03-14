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
  townLayout,
  mapWidth,
  mapHeight,
  targetMobClusters,
  clusterAreaSize,
  maxClustersPerArea,
  visibilityRange,
  observedSpawnPadding,
  minSpawnRadiusFromCenter,
  unobservedDespawnMs,
  getMobLevelForDistance,
  applyScaledStatsToMob,
  logger = console
}) {
  const spawnerIdsByCellKey = new Map();
  const initializedCellKeys = new Set();
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;

  function getDistanceFromCenter(x, y) {
    return Math.hypot((Number(x) || 0) - centerX, (Number(y) || 0) - centerY);
  }

  function isPointExcludedByTown(x, y) {
    if (!townLayout || townLayout.enabled === false) {
      return false;
    }
    const padding = Math.max(0, Number(townLayout.mobExclusionPadding) || 0);
    const px = Number(x) || 0;
    const py = Number(y) || 0;
    return (
      px >= townLayout.minTileX - padding &&
      px < townLayout.maxTileX + 1 + padding &&
      py >= townLayout.minTileY - padding &&
      py < townLayout.maxTileY + 1 + padding
    );
  }

  function getSpawnerCellKey(x, y) {
    const cellX = Math.floor((Number(x) || 0) / clusterAreaSize);
    const cellY = Math.floor((Number(y) || 0) / clusterAreaSize);
    return `${cellX},${cellY}`;
  }

  function getCellBounds(cellX, cellY) {
    const minX = Math.max(0, cellX * clusterAreaSize);
    const minY = Math.max(0, cellY * clusterAreaSize);
    return {
      minX,
      minY,
      maxX: Math.min(mapWidth - 0.01, minX + clusterAreaSize),
      maxY: Math.min(mapHeight - 0.01, minY + clusterAreaSize)
    };
  }

  function registerSpawnerCell(spawner) {
    if (!spawner) {
      return;
    }
    const cellKey = String(spawner.cellKey || getSpawnerCellKey(spawner.x, spawner.y));
    spawner.cellKey = cellKey;
    const list = spawnerIdsByCellKey.get(cellKey) || [];
    if (!list.includes(spawner.id)) {
      list.push(spawner.id);
      spawnerIdsByCellKey.set(cellKey, list);
    }
  }

  function unregisterMobFromSpawner(mob) {
    if (!mob) {
      return;
    }
    const spawner = mob.spawnerId ? mobSpawners.get(String(mob.spawnerId)) || null : null;
    if (!spawner || !Array.isArray(spawner.mobIds)) {
      return;
    }
    spawner.mobIds = spawner.mobIds.filter((mobId) => String(mobId) !== String(mob.id));
  }

  function getObservationSources() {
    const sources = [];
    for (const player of players.values()) {
      if (!player || Number(player.hp) <= 0) {
        continue;
      }
      sources.push(player);
    }
    return sources;
  }

  function isPointWithinObservedRange(x, y, extraPadding = 0) {
    const range = Math.max(0, Number(visibilityRange) || 0) + Math.max(0, Number(extraPadding) || 0);
    for (const source of getObservationSources()) {
      if (
        Math.abs((Number(source.x) || 0) - (Number(x) || 0)) <= range &&
        Math.abs((Number(source.y) || 0) - (Number(y) || 0)) <= range
      ) {
        return true;
      }
    }
    return false;
  }

  function isSpawnerObserved(spawnerOrX, y = null) {
    if (spawnerOrX && typeof spawnerOrX === "object") {
      return isPointWithinObservedRange(spawnerOrX.x, spawnerOrX.y, observedSpawnPadding);
    }
    return isPointWithinObservedRange(spawnerOrX, y, observedSpawnPadding);
  }

  function isPointActivelyObserved(x, y) {
    return isPointWithinObservedRange(x, y, 0);
  }

  function createMob(spawner, now = Date.now()) {
    if (!spawner.clusterDef || !spawner.clusterDef.members.length) {
      return null;
    }

    const memberIndex = randomInt(0, spawner.clusterDef.members.length - 1);
    const mobDef = spawner.clusterDef.members[memberIndex];
    const spawnPos = pickMobSpawnPosition(spawner.x, spawner.y);
    const spawnDistanceFromCenter = getDistanceFromCenter(spawnPos.x, spawnPos.y);
    const level = getMobLevelForDistance(spawnDistanceFromCenter);
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
      nextWanderAt: now + randomInt(400, 1200),
      lastAttackAt: 0,
      chaseTargetPlayerId: null,
      chaseUntil: 0,
      stunnedUntil: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      burningUntil: 0,
      activeDots: new Map(),
      returningHome: false,
      abilityCooldowns: new Map(),
      distanceFromCenter: spawnDistanceFromCenter,
      level,
      lastObservedAt: now
    };
    applyScaledStatsToMob(mob, mobDef, level, { keepHpRatio: false });
    mobs.set(mob.id, mob);
    spawner.mobIds.push(mob.id);
    return mob;
  }

  function pickMobSpawnPosition(originX, originY) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomPointInRadius(originX, originY, 1.5);
      if (
        !isPointExcludedByTown(candidate.x, candidate.y) &&
        getDistanceFromCenter(candidate.x, candidate.y) >= minSpawnRadiusFromCenter
      ) {
        return candidate;
      }
    }
    if (getDistanceFromCenter(originX, originY) >= minSpawnRadiusFromCenter) {
      return { x: originX, y: originY };
    }
    const dirX = (Number(originX) || centerX) - centerX;
    const dirY = (Number(originY) || centerY) - centerY;
    const length = Math.hypot(dirX, dirY) || 1;
    return {
      x: clamp(centerX + (dirX / length) * minSpawnRadiusFromCenter, 0, mapWidth - 1),
      y: clamp(centerY + (dirY / length) * minSpawnRadiusFromCenter, 0, mapHeight - 1)
    };
  }

  function estimateObservedCellCapacity() {
    const observedRadius = Math.max(0, Number(visibilityRange) || 0) + Math.max(0, Number(observedSpawnPadding) || 0);
    const cellRadius = Math.max(0, Math.ceil(observedRadius / clusterAreaSize));
    return Math.max(1, Math.pow(cellRadius * 2 + 1, 2));
  }

  function getClusterSlotSpawnChance() {
    const serverConfig = getServerConfig();
    const desiredClusters = Math.max(1, Math.round(targetMobClusters * (Number(serverConfig.mobSpawnMultiplier) || 1)));
    const estimatedCells = estimateObservedCellCapacity();
    return clamp(desiredClusters / Math.max(1, estimatedCells * maxClustersPerArea), 0, 1);
  }

  function pickSpawnerPositionInCell(cellX, cellY) {
    const bounds = getCellBounds(cellX, cellY);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const x = clamp(bounds.minX + Math.random() * Math.max(0.1, bounds.maxX - bounds.minX), 0, mapWidth - 1);
      const y = clamp(bounds.minY + Math.random() * Math.max(0.1, bounds.maxY - bounds.minY), 0, mapHeight - 1);
      const distanceFromCenter = getDistanceFromCenter(x, y);
      if (distanceFromCenter < minSpawnRadiusFromCenter) {
        continue;
      }
      if (isPointExcludedByTown(x, y)) {
        continue;
      }
      return {
        x,
        y,
        distanceFromCenter
      };
    }
    return null;
  }

  function createSpawnerInCell(cellX, cellY, clusterDef, spawnPosition) {
    if (!clusterDef || !spawnPosition) {
      return null;
    }
    const spawner = {
      id: String(allocateSpawnerId()),
      x: spawnPosition.x,
      y: spawnPosition.y,
      clusterName: clusterDef.name,
      clusterDef,
      distanceFromCenter: spawnPosition.distanceFromCenter,
      cellKey: `${cellX},${cellY}`,
      mobIds: []
    };
    mobSpawners.set(spawner.id, spawner);
    registerSpawnerCell(spawner);
    for (let index = 0; index < clusterDef.maxSize; index += 1) {
      createMob(spawner);
    }
    return spawner;
  }

  function initializeCellSpawners(cellX, cellY, now = Date.now()) {
    const cellKey = `${cellX},${cellY}`;
    if (initializedCellKeys.has(cellKey)) {
      return;
    }
    initializedCellKeys.add(cellKey);

    const bounds = getCellBounds(cellX, cellY);
    const cellCenterX = (bounds.minX + bounds.maxX) * 0.5;
    const cellCenterY = (bounds.minY + bounds.maxY) * 0.5;
    const cellDistance = getDistanceFromCenter(cellCenterX, cellCenterY);
    if (cellDistance < minSpawnRadiusFromCenter) {
      return;
    }

    const mobConfig = getMobConfig();
    if (!mobConfig || cellDistance > Math.max(0, Number(mobConfig.maxSpawnRadius) || 0)) {
      return;
    }

    const clusterSlotSpawnChance = getClusterSlotSpawnChance();
    let spawned = 0;
    for (let slotIndex = 0; slotIndex < maxClustersPerArea; slotIndex += 1) {
      if (Math.random() > clusterSlotSpawnChance) {
        continue;
      }
      const spawnPosition = pickSpawnerPositionInCell(cellX, cellY);
      if (!spawnPosition) {
        continue;
      }
      const clusterDef = pickClusterDef(mobConfig, spawnPosition.distanceFromCenter);
      if (!clusterDef) {
        continue;
      }
      createSpawnerInCell(cellX, cellY, clusterDef, spawnPosition, now);
      spawned += 1;
    }

    if (spawned === 0) {
      spawnerIdsByCellKey.set(cellKey, []);
    }
  }

  function ensureObservedSpawnerCoverage(now = Date.now()) {
    const observedRadius = Math.max(0, Number(visibilityRange) || 0) + Math.max(0, Number(observedSpawnPadding) || 0);
    const cellRadius = Math.max(0, Math.ceil(observedRadius / clusterAreaSize));
    const seenCells = new Set();

    for (const source of getObservationSources()) {
      const originCellX = Math.floor((Number(source.x) || 0) / clusterAreaSize);
      const originCellY = Math.floor((Number(source.y) || 0) / clusterAreaSize);
      for (let cellY = originCellY - cellRadius; cellY <= originCellY + cellRadius; cellY += 1) {
        for (let cellX = originCellX - cellRadius; cellX <= originCellX + cellRadius; cellX += 1) {
          if (cellX < 0 || cellY < 0) {
            continue;
          }
          const cellKey = `${cellX},${cellY}`;
          if (seenCells.has(cellKey)) {
            continue;
          }
          const bounds = getCellBounds(cellX, cellY);
          if (
            bounds.minX > Number(source.x) + observedRadius ||
            bounds.maxX < Number(source.x) - observedRadius ||
            bounds.minY > Number(source.y) + observedRadius ||
            bounds.maxY < Number(source.y) - observedRadius
          ) {
            continue;
          }
          seenCells.add(cellKey);
          initializeCellSpawners(cellX, cellY, now);
          const spawnerIds = spawnerIdsByCellKey.get(cellKey) || [];
          for (const spawnerId of spawnerIds) {
            const spawner = mobSpawners.get(String(spawnerId)) || null;
            if (!spawner || !isSpawnerObserved(spawner)) {
              continue;
            }
            spawner.mobIds = Array.isArray(spawner.mobIds) ? spawner.mobIds.filter((mobId) => mobs.has(String(mobId))) : [];
            while (spawner.mobIds.length < spawner.clusterDef.maxSize) {
              createMob(spawner, now);
            }
          }
        }
      }
    }
  }

  function refreshMobObservation(now = Date.now()) {
    for (const mob of mobs.values()) {
      if (mob && isPointActivelyObserved(mob.x, mob.y)) {
        mob.lastObservedAt = now;
      }
    }
  }

  function despawnUnobservedMobs(now = Date.now()) {
    if (unobservedDespawnMs <= 0) {
      return 0;
    }
    let removed = 0;
    for (const mob of Array.from(mobs.values())) {
      const lastObservedAt = Number(mob?.lastObservedAt) || 0;
      if (lastObservedAt > 0 && now - lastObservedAt < unobservedDespawnMs) {
        continue;
      }
      unregisterMobFromSpawner(mob);
      clearMobCast(mob);
      mobs.delete(String(mob.id));
      removed += 1;
    }
    return removed;
  }

  function initializeMobSpawners() {
    mobSpawners.clear();
    spawnerIdsByCellKey.clear();
    initializedCellKeys.clear();
    if (mobs.size > 0) {
      mobs.clear();
    }
    logger.log("[mobs] Using observed-area dynamic spawning.");
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
    mob.lastObservedAt = Date.now();
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
      const lifeOnKill = Math.max(0, Math.floor(Number(killer.lifeOnKill) || 0));
      if (lifeOnKill > 0) {
        killer.hp = clamp(killer.hp + lifeOnKill, 0, killer.maxHp);
      }
      const manaOnKill = Math.max(0, Math.floor(Number(killer.manaOnKill) || 0));
      if (manaOnKill > 0) {
        killer.mana = clamp(killer.mana + manaOnKill, 0, killer.maxMana);
      }
    }
  }

  function respawnMob(mob) {
    if (!mob) {
      return;
    }
    const mobConfig = getMobConfig();
    const mobDef = mobConfig && mobConfig.mobDefs instanceof Map ? mobConfig.mobDefs.get(String(mob.type || "")) : null;
    const spawnPos = pickMobSpawnPosition(mob.spawnX, mob.spawnY);
    mob.x = spawnPos.x;
    mob.y = spawnPos.y;
    mob.distanceFromCenter = getDistanceFromCenter(spawnPos.x, spawnPos.y);
    mob.level = getMobLevelForDistance(mob.distanceFromCenter);
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
    mob.lastObservedAt = Date.now();
    if (mobDef) {
      applyScaledStatsToMob(mob, mobDef, Number(mob.level) || 1, { keepHpRatio: false });
    } else {
      mob.hp = mob.maxHp;
    }
    clearMobCast(mob);
  }

  function getAliveMobCount() {
    let total = 0;
    for (const mob of mobs.values()) {
      if (mob && mob.alive) {
        total += 1;
      }
    }
    return total;
  }

  return {
    createMob,
    initializeMobSpawners,
    ensureObservedSpawnerCoverage,
    refreshMobObservation,
    despawnUnobservedMobs,
    killMob,
    respawnMob,
    isSpawnerObserved,
    getAliveMobCount
  };
}

module.exports = {
  createMobLifecycleTools
};
