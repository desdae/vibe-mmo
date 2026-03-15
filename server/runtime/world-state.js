const { normalizeId, mapGet, mapHas } = require("../utils/id-utils");
const { createQuadtree } = require("../utils/quadtree");

// Default world size for spatial indexing
const DEFAULT_WORLD_SIZE = 2000;

function createWorldState(options = {}) {
  const worldSize = options.worldSize || DEFAULT_WORLD_SIZE;
  
  let nextPlayerId = 1;
  let nextProjectileId = 1;
  let nextSpawnerId = 1;
  let nextMobId = 1;
  let nextLootBagId = 1;
  let nextResourceNodeId = 1;
  let nextAreaEffectId = 1;
  let nextItemInstanceId = 1;

  const players = new Map();
  const projectiles = new Map();
  const mobSpawners = new Map();
  const mobs = new Map();
  const lootBags = new Map();
  const resourceNodes = new Map();
  const activeAreaEffects = new Map();

  // Spatial indexes for efficient range queries
  const playerQuadTree = createQuadtree({ worldSize, maxObjects: 8, maxLevels: 6 });
  const mobQuadTree = createQuadtree({ worldSize, maxObjects: 8, maxLevels: 6 });
  const lootBagQuadTree = createQuadtree({ worldSize, maxObjects: 8, maxLevels: 6 });
  const projectileQuadTree = createQuadtree({ worldSize, maxObjects: 8, maxLevels: 6 });

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

  function getResourceNode(resourceNodeId) {
    return mapGet(resourceNodes, resourceNodeId);
  }

  function hasResourceNode(resourceNodeId) {
    return mapHas(resourceNodes, resourceNodeId);
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

  function allocateResourceNodeId() {
    return String(nextResourceNodeId++);
  }

  function allocateItemInstanceId() {
    return String(nextItemInstanceId++);
  }

  // ============ SPATIAL QUERY FUNCTIONS ============

  /**
   * Get players within radius of a point
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Search radius
   * @returns {Array} Array of players within range
   */
  function getPlayersInRadius(x, y, radius) {
    const candidates = playerQuadTree.queryRadius(x, y, radius);
    return candidates.map(p => mapGet(players, p.id)).filter(Boolean);
  }

  /**
   * Get mobs within radius of a point
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Search radius
   * @returns {Array} Array of mobs within range
   */
  function getMobsInRadius(x, y, radius) {
    const candidates = mobQuadTree.queryRadius(x, y, radius);
    return candidates.map(m => mapGet(mobs, m.id)).filter(Boolean);
  }

  /**
   * Get loot bags within radius of a point
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Search radius
   * @returns {Array} Array of loot bags within range
   */
  function getLootBagsInRadius(x, y, radius) {
    const candidates = lootBagQuadTree.queryRadius(x, y, radius);
    return candidates.map(b => mapGet(lootBags, b.id)).filter(Boolean);
  }

  /**
   * Get projectiles within radius of a point
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Search radius
   * @returns {Array} Array of projectiles within range
   */
  function getProjectilesInRadius(x, y, radius) {
    const candidates = projectileQuadTree.queryRadius(x, y, radius);
    return candidates.map(p => mapGet(projectiles, p.id)).filter(Boolean);
  }

  /**
   * Find nearest player within radius
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} maxRadius - Maximum search radius
   * @returns {Object|null} Nearest player or null
   */
  function findNearestPlayer(x, y, maxRadius) {
    const nearest = playerQuadTree.findNearest(x, y, maxRadius);
    return nearest ? mapGet(players, nearest.id) : null;
  }

  /**
   * Find nearest mob within radius
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} maxRadius - Maximum search radius
   * @param {Function} filterFn - Optional filter function
   * @returns {Object|null} Nearest mob or null
   */
  function findNearestMob(x, y, maxRadius, filterFn = null) {
    const nearest = mobQuadTree.findNearest(x, y, maxRadius, filterFn);
    return nearest ? mapGet(mobs, nearest.id) : null;
  }

  /**
   * Find nearest loot bag within radius
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} maxRadius - Maximum search radius
   * @returns {Object|null} Nearest loot bag or null
   */
  function findNearestLootBag(x, y, maxRadius) {
    const nearest = lootBagQuadTree.findNearest(x, y, maxRadius);
    return nearest ? mapGet(lootBags, nearest.id) : null;
  }

  /**
   * Rebuild spatial indexes - call after bulk operations
   */
  function rebuildSpatialIndexes() {
    playerQuadTree.clear();
    mobQuadTree.clear();
    lootBagQuadTree.clear();
    projectileQuadTree.clear();

    for (const [id, player] of players) {
      if (player.x !== undefined && player.y !== undefined) {
        playerQuadTree.insert({ id, x: player.x, y: player.y });
      }
    }

    for (const [id, mob] of mobs) {
      if (mob.x !== undefined && mob.y !== undefined) {
        mobQuadTree.insert({ id, x: mob.x, y: mob.y });
      }
    }

    for (const [id, bag] of lootBags) {
      if (bag.x !== undefined && bag.y !== undefined) {
        lootBagQuadTree.insert({ id, x: bag.x, y: bag.y });
      }
    }

    for (const [id, proj] of projectiles) {
      if (proj.x !== undefined && proj.y !== undefined) {
        projectileQuadTree.insert({ id, x: proj.x, y: proj.y });
      }
    }
  }

  /**
   * Update a player's position in the spatial index
   * @param {Object} player - The player object
   * @param {number} oldX - Previous X position
   * @param {number} oldY - Previous Y position
   */
  function updatePlayerPosition(player, oldX, oldY) {
    if (oldX !== undefined && oldY !== undefined) {
      playerQuadTree.remove({ id: player.id, x: oldX, y: oldY });
    }
    if (player.x !== undefined && player.y !== undefined) {
      playerQuadTree.insert({ id: player.id, x: player.x, y: player.y });
    }
  }

  /**
   * Update a mob's position in the spatial index
   * @param {Object} mob - The mob object
   * @param {number} oldX - Previous X position
   * @param {number} oldY - Previous Y position
   */
  function updateMobPosition(mob, oldX, oldY) {
    if (oldX !== undefined && oldY !== undefined) {
      mobQuadTree.remove({ id: mob.id, x: oldX, y: oldY });
    }
    if (mob.x !== undefined && mob.y !== undefined) {
      mobQuadTree.insert({ id: mob.id, x: mob.x, y: mob.y });
    }
  }

  return {
    players,
    projectiles,
    mobSpawners,
    mobs,
    lootBags,
    resourceNodes,
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
    getResourceNode,
    hasResourceNode,
    getAreaEffect,
    hasAreaEffect,
    // ID allocation
    allocatePlayerId,
    allocateProjectileId,
    allocateSpawnerId,
    allocateMobId,
    allocateLootBagId,
    allocateResourceNodeId,
    allocateAreaEffectId,
    allocateItemInstanceId,
    // Spatial query functions
    getPlayersInRadius,
    getMobsInRadius,
    getLootBagsInRadius,
    getProjectilesInRadius,
    findNearestPlayer,
    findNearestMob,
    findNearestLootBag,
    rebuildSpatialIndexes,
    updatePlayerPosition,
    updateMobPosition
  };
}

module.exports = {
  createWorldState
};
