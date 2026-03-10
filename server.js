const fs = require("fs");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { executeAbilityByKind } = require("./server/ability-handlers");
const { createAreaEffectTools } = require("./server/gameplay/area-effects");
const { createGameLoop } = require("./server/runtime/game-loop");
const { sendJson, sendBinary } = require("./server/network/transport");
const { registerWsConnections } = require("./server/network/ws-connections");
const { createStateBroadcaster } = require("./server/network/state-broadcast");
const { createGameHttpServer } = require("./server/network/http-server");
const { createSoundManifestBuilder } = require("./server/network/sound-manifest");
const { createEntityUpdatePacketBuilder } = require("./server/network/entity-update-packet");
const { serializePlayer, serializeMob, serializeLootBag } = require("./server/network/entity-serializers");
const { createEventBuilders } = require("./server/network/event-builders");
const { createAreaEffectEventBuilder } = require("./server/network/area-effect-events");
const { createPlayerMessageTools } = require("./server/network/player-messages");
const { createWorldEventQueues } = require("./server/network/world-events");
const {
  buildServerConfig,
  loadServerConfigFromDisk,
  formatServerConfigForLog
} = require("./server/config/server-config");
const { loadGameplayConfigFromDisk } = require("./server/config/gameplay-config");
const { loadItemConfigFromDisk } = require("./server/config/item-config");
const { loadClassConfigFromDisk } = require("./server/config/class-config");
const { loadMobConfigFromDisk } = require("./server/config/mob-config");
const { createAbilityNormalizationTools } = require("./server/config/ability-normalization");
const { loadGlobalDropTableConfigFromDisk } = require("./server/config/drop-config");
const {
  getAbilityDamageRange,
  getAbilityDotDamageRange,
  getAbilityRangeForLevel,
  getAbilityCooldownMsForLevel,
  getAbilityInvulnerabilityDurationMs
} = require("./server/gameplay/ability-stats");
const { createCastingTools } = require("./server/gameplay/casting");
const { createDamageTools } = require("./server/gameplay/damage");
const { createInventoryTools } = require("./server/gameplay/inventory");
const { createLootBagTools } = require("./server/gameplay/loot-bags");
const { createMobAbilityOverrideResolver } = require("./server/gameplay/mob-ability-overrides");
const { createMobAbilityTools } = require("./server/gameplay/mob-abilities");
const { createMobBehaviorTools } = require("./server/gameplay/mob-behavior");
const { createMobCombatTools } = require("./server/gameplay/mob-combat");
const { pickClusterDef } = require("./server/gameplay/cluster-spawn");
const { createSpatialTools } = require("./server/gameplay/spatial-tools");
const { createPlayerAbilityTools } = require("./server/gameplay/player-abilities");
const { createPlayerCombatEffectTools } = require("./server/gameplay/player-combat-effects");
const { createMobCombatEffectTools } = require("./server/gameplay/mob-combat-effects");
const {
  getObjectPath,
  findAbilityEffect
} = require("./server/gameplay/object-utils");
const { createProjectileEffectTools } = require("./server/gameplay/projectile-effects");
const { createProjectileRuntimeTools } = require("./server/gameplay/projectile-runtime");
const { createProjectileSpawnTools } = require("./server/gameplay/projectile-spawn");
const { createPlayerResourceTools } = require("./server/gameplay/player-resources");
const { createProgressionTools } = require("./server/gameplay/progression");
const {
  normalizeDirection,
  distance,
  rotateDirection,
  steerDirectionTowards
} = require("./server/gameplay/vector-utils");
const {
  clamp,
  randomInt,
  parseNumericRange,
  parseBoolean
} = require("./server/gameplay/number-utils");
const {
  encodeMobEffectEventPacket,
  encodeAreaEffectEventPacket,
  encodeMobMetaPacket,
  encodeProjectileMetaPacket,
  encodeDamageEventPacket
} = require("./server/network/packet-encoders");

const PORT = process.env.PORT || 3000;
const MOB_CONFIG_PATH = path.join(__dirname, "data", "mobs.json");
const ITEM_CONFIG_PATH = path.join(__dirname, "data", "items.json");
const GLOBAL_DROP_TABLE_PATH = path.join(__dirname, "data", "drop-tables.json");
const SERVER_CONFIG_PATH = path.join(__dirname, "config", "server.json");
const GAMEPLAY_CONFIG_PATH = path.join(__dirname, "config", "gameplay.json");
const CLASS_CONFIG_PATH = path.join(__dirname, "data", "classes.json");
const ABILITY_CONFIG_PATH = path.join(__dirname, "data", "abilities.json");

const DEFAULT_GAMEPLAY_CONFIG = Object.freeze({
  map: {
    width: 1000,
    height: 1000,
    visibilityRange: 20
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
    maxClustersPerArea: 2
  },
  mob: {
    wanderRadius: 10,
    provokedLeashRadius: 50,
    provokedChaseMs: 60000,
    aggroRange: 5,
    attackRange: 1.25,
    attackCooldownMs: 900,
    minSeparation: 0.85,
    separationIterations: 2
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

const GAMEPLAY_CONFIG = loadGameplayConfigFromDisk(GAMEPLAY_CONFIG_PATH, DEFAULT_GAMEPLAY_CONFIG);
const MAP_WIDTH = GAMEPLAY_CONFIG.map.width;
const MAP_HEIGHT = GAMEPLAY_CONFIG.map.height;
const VISIBILITY_RANGE = GAMEPLAY_CONFIG.map.visibilityRange;
const TICK_MS = GAMEPLAY_CONFIG.tickMs;
const BASE_PLAYER_SPEED = GAMEPLAY_CONFIG.player.baseSpeed;
const TARGET_MOB_CLUSTERS = GAMEPLAY_CONFIG.clusterSpawning.targetClusters;
const CLUSTER_AREA_SIZE = GAMEPLAY_CONFIG.clusterSpawning.clusterAreaSize;
const MAX_CLUSTERS_PER_AREA = GAMEPLAY_CONFIG.clusterSpawning.maxClustersPerArea;
const MOB_WANDER_RADIUS = GAMEPLAY_CONFIG.mob.wanderRadius;
const MOB_PROVOKED_LEASH_RADIUS = GAMEPLAY_CONFIG.mob.provokedLeashRadius;
const MOB_PROVOKED_CHASE_MS = GAMEPLAY_CONFIG.mob.provokedChaseMs;
const MOB_AGGRO_RANGE = GAMEPLAY_CONFIG.mob.aggroRange;
const MOB_ATTACK_RANGE = GAMEPLAY_CONFIG.mob.attackRange;
const MOB_ATTACK_COOLDOWN_MS = GAMEPLAY_CONFIG.mob.attackCooldownMs;
const MOB_MIN_SEPARATION = GAMEPLAY_CONFIG.mob.minSeparation;
const MOB_SEPARATION_ITERATIONS = GAMEPLAY_CONFIG.mob.separationIterations;
const PLAYER_MOB_MIN_SEPARATION = GAMEPLAY_CONFIG.player.mobMinSeparation;
const PLAYER_MOB_SEPARATION_ITERATIONS = GAMEPLAY_CONFIG.player.mobSeparationIterations;

const DEFAULT_ABILITY_KIND = "meleeCone";
const BASE_EXP_TO_NEXT = GAMEPLAY_CONFIG.player.baseExpToNext;
const EXP_GROWTH_FACTOR = GAMEPLAY_CONFIG.player.expGrowthFactor;
const DEFAULT_PROJECTILE_HIT_RADIUS = GAMEPLAY_CONFIG.projectile.defaultHitRadius;
const BAG_PICKUP_RANGE = GAMEPLAY_CONFIG.loot.bagPickupRange;
const BAG_CLICK_RANGE = GAMEPLAY_CONFIG.loot.bagClickRange;
const BAG_DESPAWN_MS = GAMEPLAY_CONFIG.loot.bagDespawnMs;
const INVENTORY_COLS = GAMEPLAY_CONFIG.inventory.cols;
const INVENTORY_ROWS = GAMEPLAY_CONFIG.inventory.rows;
const INVENTORY_SLOT_COUNT = INVENTORY_COLS * INVENTORY_ROWS;
const ITEM_COPPER_ID = GAMEPLAY_CONFIG.loot.copperItemId;

const publicDir = path.join(__dirname, "public");
const buildSoundManifest = createSoundManifestBuilder({ publicDir });

const abilityNormalizationTools = createAbilityNormalizationTools({
  defaultProjectileHitRadius: DEFAULT_PROJECTILE_HIT_RADIUS
});
const normalizeAbilityEntry = abilityNormalizationTools.normalizeAbilityEntry;
const buildEmitProjectilesConfig = abilityNormalizationTools.buildEmitProjectilesConfig;

function loadAbilityConfig() {
  const raw = fs.readFileSync(ABILITY_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const entries = parsed && typeof parsed === "object" ? Object.entries(parsed) : [];

  const abilityDefs = new Map();
  const clientAbilityDefs = [];

  for (const [rawId, rawEntry] of entries) {
    const entry = normalizeAbilityEntry(rawId, rawEntry);
    const id = String(entry?.id || rawId || "").trim();
    if (!id || !entry || typeof entry !== "object") {
      continue;
    }

    const damageRangeInput = entry.damageRange !== undefined ? entry.damageRange : entry.damagePerSecond;
    const damageRange = parseNumericRange(damageRangeInput, 1, 1);
    const damagePerLevel = parseNumericRange(entry.damageRangePerLevel, 0, 0);
    const dotDamageRange = parseNumericRange(entry.dotDamagePerSecond, 0, 0);
    const dotDamagePerLevel = parseNumericRange(entry.dotDamagePerSecondPerLevel, 0, 0);
    const cooldownMs = Math.max(0, Math.round((Number(entry.cooldown) || 0) * 1000));
    const range = Math.max(0, Number(entry.range) || 0);
    const speed = Math.max(0, Number(entry.speed) || 0);
    const coneAngleDeg = clamp(Number(entry.coneAngle) || 60, 5, 180);
    const coneCos = Math.cos((coneAngleDeg * Math.PI) / 360);
    const kind =
      typeof entry.kind === "string" && entry.kind.trim()
        ? entry.kind.trim()
        : speed > 0
          ? "projectile"
          : coneAngleDeg > 0
            ? "meleeCone"
            : DEFAULT_ABILITY_KIND;

    const castMsRaw = Number(entry.castMs);
    const castTimeRaw = Number(entry.castTime);
    let castMs = 0;
    if (Number.isFinite(castMsRaw) && castMsRaw > 0) {
      castMs = Math.round(castMsRaw);
    } else if (Number.isFinite(castTimeRaw) && castTimeRaw > 0) {
      castMs = Math.round(castTimeRaw * 1000);
    }

    const projectileHitRadius = clamp(
      Number(entry.projectileHitRadius) ||
        Number(entry.hitRadius) ||
        DEFAULT_PROJECTILE_HIT_RADIUS,
      0.1,
      8
    );
    const explosionRadius = Math.max(0, Number(entry.explosionRadius) || 0);
    const explosionDamageMultiplier = clamp(
      Number(entry.explosionDamageMultiplier) || 0,
      0,
      1
    );
    const areaRadius = Math.max(0, Number(entry.radius) || Number(entry.areaRadius) || range);
    const durationMsRaw = Number(entry.durationMs);
    const durationSecRaw = Number(entry.duration);
    const durationMs =
      Number.isFinite(durationMsRaw) && durationMsRaw > 0
        ? Math.round(durationMsRaw)
        : Number.isFinite(durationSecRaw) && durationSecRaw > 0
          ? Math.round(durationSecRaw * 1000)
          : 0;
    const dotDurationMsRaw = Number(entry.dotDurationMs);
    const dotDurationSecRaw = Number(entry.dotDuration);
    const dotDurationMs =
      Number.isFinite(dotDurationMsRaw) && dotDurationMsRaw > 0
        ? Math.round(dotDurationMsRaw)
        : Number.isFinite(dotDurationSecRaw) && dotDurationSecRaw > 0
          ? Math.round(dotDurationSecRaw * 1000)
          : 0;
    const dotSchool = String(entry.dotSchool || "").trim().toLowerCase();
    const invulnerabilityDurationMs = Math.max(
      0,
      Math.round((Number(entry.invulnerabilityDuration) || 0) * 1000)
    );
    const rangePerLevel = Math.max(0, Number(entry.rangePerLevel) || 0);
    const cooldownReductionPerLevelMs = Math.max(
      0,
      Math.round((Number(entry.cooldownReductionPerLevel) || 0) * 1000)
    );
    const beamWidth =
      kind === "beam"
        ? Math.max(0.2, Number(entry.beamWidth) || Number(entry.width) || 0.8)
        : 0;
    const stunDurationMs = Math.max(0, Math.round((Number(entry.stunDuration) || 0) * 1000));
    const slowDurationMsRaw = Number(entry.slowDurationMs);
    const slowDurationSecRaw = Number(entry.slowDuration);
    const slowDurationMs =
      Number.isFinite(slowDurationMsRaw) && slowDurationMsRaw > 0
        ? Math.round(slowDurationMsRaw)
        : Number.isFinite(slowDurationSecRaw) && slowDurationSecRaw > 0
          ? Math.round(slowDurationSecRaw * 1000)
          : 0;
    let slowMultiplier = 1;
    if (Number.isFinite(Number(entry.slowMultiplier)) && Number(entry.slowMultiplier) > 0) {
      slowMultiplier = clamp(Number(entry.slowMultiplier), 0.1, 1);
    } else if (Number.isFinite(Number(entry.slowAmount)) && Number(entry.slowAmount) > 0) {
      const slowAmount = Number(entry.slowAmount);
      slowMultiplier = clamp(1 - clamp(slowAmount, 0, 0.95), 0.1, 1);
    }
    const projectileCount = clamp(Math.floor(Number(entry.projectileCount) || 1), 1, 12);
    const spreadDeg = Math.max(0, Number(entry.spreadDeg) || Number(entry.spreadAngle) || 0);
    const homingRangeDefault = id.toLowerCase() === "arcanemissiles" ? Math.max(6, range) : 0;
    const homingTurnRateDefault = id.toLowerCase() === "arcanemissiles" ? 6.5 : 0;
    const homingRange = Math.max(0, Number(entry.homingRange) || homingRangeDefault);
    const homingTurnRate = Math.max(
      0,
      Number(entry.homingTurnRate ?? entry.turnRate) || homingTurnRateDefault
    );
    const emitProjectiles = buildEmitProjectilesConfig(entry, id);

    const def = {
      id,
      name: String(entry.name || id).slice(0, 48),
      description: String(entry.description || "").slice(0, 240),
      kind,
      cooldownMs,
      manaCost: Math.max(0, Number(entry.manaCost) || 0),
      range,
      speed,
      damageMin: clamp(Math.floor(Math.min(damageRange[0], damageRange[1])), 0, 255),
      damageMax: clamp(Math.ceil(Math.max(damageRange[0], damageRange[1])), 0, 255),
      damagePerLevelMin: Math.max(0, Number(damagePerLevel[0]) || 0),
      damagePerLevelMax: Math.max(0, Number(damagePerLevel[1]) || 0),
      dotDamageMin: Math.max(0, Number(dotDamageRange[0]) || 0),
      dotDamageMax: Math.max(0, Number(dotDamageRange[1]) || 0),
      dotDamagePerLevelMin: Math.max(0, Number(dotDamagePerLevel[0]) || 0),
      dotDamagePerLevelMax: Math.max(0, Number(dotDamagePerLevel[1]) || 0),
      dotDurationMs,
      dotSchool,
      coneAngleDeg,
      coneCos,
      projectileHitRadius,
      explosionRadius,
      explosionDamageMultiplier,
      areaRadius,
      durationMs,
      castMs,
      invulnerabilityDurationMs,
      rangePerLevel,
      cooldownReductionPerLevelMs,
      beamWidth,
      stunDurationMs,
      slowDurationMs,
      slowMultiplier,
      projectileCount,
      spreadDeg,
      explodeOnExpire: entry.explodeOnExpire !== false,
      homingRange,
      homingTurnRate,
      emitProjectiles
    };

    const extraClientFields = {};
    for (const [fieldKey, fieldValue] of Object.entries(entry)) {
      if (
        fieldKey === "name" ||
        fieldKey === "description" ||
        fieldKey === "kind" ||
        fieldKey === "cooldown" ||
        fieldKey === "cooldownMs" ||
        fieldKey === "castMs" ||
        fieldKey === "castTime" ||
        fieldKey === "manaCost" ||
        fieldKey === "range" ||
        fieldKey === "speed" ||
        fieldKey === "damageRange" ||
        fieldKey === "damageRangePerLevel" ||
        fieldKey === "coneAngle" ||
        fieldKey === "hitRadius" ||
        fieldKey === "projectileHitRadius" ||
        fieldKey === "explosionRadius" ||
        fieldKey === "explosionDamageMultiplier" ||
        fieldKey === "radius" ||
        fieldKey === "areaRadius" ||
        fieldKey === "duration" ||
        fieldKey === "durationMs" ||
        fieldKey === "damagePerSecond" ||
        fieldKey === "dotDamagePerSecond" ||
        fieldKey === "dotDamagePerSecondPerLevel" ||
        fieldKey === "dotDuration" ||
        fieldKey === "dotDurationMs" ||
        fieldKey === "dotSchool" ||
        fieldKey === "beamWidth" ||
        fieldKey === "width" ||
        fieldKey === "stunDuration" ||
        fieldKey === "slowDuration" ||
        fieldKey === "slowDurationMs" ||
        fieldKey === "slowAmount" ||
        fieldKey === "slowMultiplier" ||
        fieldKey === "homingRange" ||
        fieldKey === "homingTurnRate" ||
        fieldKey === "turnRate"
      ) {
        continue;
      }
      if (typeof fieldValue === "number" && Number.isFinite(fieldValue) && fieldValue > 0) {
        extraClientFields[fieldKey] = fieldValue;
      } else if (
        Array.isArray(fieldValue) &&
        fieldValue.length &&
        fieldValue.every((v) => Number.isFinite(Number(v)))
      ) {
        const normalizedArray = fieldValue.map((v) => Number(v));
        if (normalizedArray.some((v) => v > 0)) {
          extraClientFields[fieldKey] = normalizedArray;
        }
      }
    }

    abilityDefs.set(id, def);
    clientAbilityDefs.push({
      id: def.id,
      name: def.name,
      description: def.description,
      kind: def.kind,
      cooldownMs: def.cooldownMs,
      range: def.range,
      speed: def.speed,
      castMs: def.castMs,
      manaCost: def.manaCost,
      damageMin: def.damageMin,
      damageMax: def.damageMax,
      damagePerLevelMin: def.damagePerLevelMin,
      damagePerLevelMax: def.damagePerLevelMax,
      dotDamageMin: def.dotDamageMin,
      dotDamageMax: def.dotDamageMax,
      dotDamagePerLevelMin: def.dotDamagePerLevelMin,
      dotDamagePerLevelMax: def.dotDamagePerLevelMax,
      dotDurationMs: def.dotDurationMs,
      dotSchool: def.dotSchool,
      coneAngleDeg: def.coneAngleDeg,
      projectileHitRadius: def.projectileHitRadius,
      explosionRadius: def.explosionRadius,
      explosionDamageMultiplier: def.explosionDamageMultiplier,
      areaRadius: def.areaRadius,
      beamWidth: def.beamWidth,
      durationMs: def.durationMs,
      stunDurationMs: def.stunDurationMs,
      slowDurationMs: def.slowDurationMs,
      slowMultiplier: def.slowMultiplier,
      projectileCount: def.projectileCount,
      spreadDeg: def.spreadDeg,
      homingRange: def.homingRange,
      homingTurnRate: def.homingTurnRate,
      damageRange: [def.damageMin, def.damageMax],
      damageRangePerLevel: [def.damagePerLevelMin, def.damagePerLevelMax],
      ...extraClientFields
    });
  }

  if (!abilityDefs.size) {
    throw new Error(`No valid ability definitions in ${ABILITY_CONFIG_PATH}`);
  }

  return {
    abilityDefs,
    clientAbilityDefs
  };
}

const mobAbilityOverrideTools = createMobAbilityOverrideResolver({
  clamp,
  parseNumericRange,
  parseBoolean,
  getObjectPath,
  findAbilityEffect
});
const resolveMobAbilityOverrideDef = mobAbilityOverrideTools.resolveMobAbilityOverrideDef;
const spatialTools = createSpatialTools({
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  clamp,
  spawnMaxDistance: 10
});
const randomPointInRadius = spatialTools.randomPointInRadius;
const clampToSpawnRadius = spatialTools.clampToSpawnRadius;
const randomSpawn = spatialTools.randomSpawn;
const inVisibilityRange = spatialTools.inVisibilityRange;

const ITEM_CONFIG = loadItemConfigFromDisk(ITEM_CONFIG_PATH);
const playerMessageTools = createPlayerMessageTools({
  sendJson,
  itemDefs: ITEM_CONFIG.itemDefs,
  inventoryCols: INVENTORY_COLS,
  inventoryRows: INVENTORY_ROWS,
  inventorySlotCount: INVENTORY_SLOT_COUNT
});
const sendSelfProgress = playerMessageTools.sendSelfProgress;
const sendInventoryState = playerMessageTools.sendInventoryState;
const serializeBagItemsForMeta = (items) => playerMessageTools.serializeBagItemsForMeta(items, normalizeItemEntries);
const inventoryTools = createInventoryTools({
  itemDefs: ITEM_CONFIG.itemDefs,
  inventorySlotCount: INVENTORY_SLOT_COUNT,
  copperItemId: ITEM_COPPER_ID,
  normalizeItemEntries,
  sendSelfProgress
});
const createEmptyInventorySlots = inventoryTools.createEmptyInventorySlots;
const addItemsToInventory = inventoryTools.addItemsToInventory;
const mergeOrSwapInventorySlots = inventoryTools.mergeOrSwapInventorySlots;
const consumeInventoryItem = inventoryTools.consumeInventoryItem;
const syncPlayerCopperFromInventory = inventoryTools.syncPlayerCopperFromInventory;
let SERVER_CONFIG;
try {
  SERVER_CONFIG = loadServerConfigFromDisk(SERVER_CONFIG_PATH);
  console.log(`[config] Loaded ${SERVER_CONFIG_PATH}: ${formatServerConfigForLog(SERVER_CONFIG)}`);
} catch (error) {
  SERVER_CONFIG = buildServerConfig({});
  const reason = error && error.message ? error.message : String(error);
  console.warn(
    `[config] Failed to load ${SERVER_CONFIG_PATH}, using defaults. Reason: ${reason}`
  );
}
const progressionTools = createProgressionTools({
  baseExpToNext: BASE_EXP_TO_NEXT,
  expGrowthFactor: EXP_GROWTH_FACTOR,
  getExpMultiplier: () => Number(SERVER_CONFIG?.expMultiplier) || 1,
  sendSelfProgress
});
const expNeededForLevel = progressionTools.expNeededForLevel;
const grantPlayerExp = progressionTools.grantPlayerExp;
const playerResourceTools = createPlayerResourceTools({
  tickMs: TICK_MS,
  clamp
});
const getPendingHealAmount = playerResourceTools.getPendingHealAmount;
const getPendingManaAmount = playerResourceTools.getPendingManaAmount;
const addHealOverTimeEffect = playerResourceTools.addHealOverTimeEffect;
const addManaOverTimeEffect = playerResourceTools.addManaOverTimeEffect;
const tickPlayerHealEffects = playerResourceTools.tickPlayerHealEffects;
const tickPlayerManaEffects = playerResourceTools.tickPlayerManaEffects;

let serverConfigReloadTimer = null;
let abilityConfigReloadTimer = null;
let mobConfigReloadTimer = null;
function reloadServerConfig(reason) {
  try {
    const nextConfig = loadServerConfigFromDisk(SERVER_CONFIG_PATH);
    SERVER_CONFIG = nextConfig;
    console.log(`[config] Reloaded ${SERVER_CONFIG_PATH} (${reason}): ${formatServerConfigForLog(nextConfig)}`);
  } catch (error) {
    const details = error && error.message ? error.message : String(error);
    console.error(
      `[config] Failed to reload ${SERVER_CONFIG_PATH} (${reason}). Keeping previous config. Reason: ${details}`
    );
  }
}

function scheduleServerConfigReload(reason) {
  if (serverConfigReloadTimer !== null) {
    clearTimeout(serverConfigReloadTimer);
  }
  serverConfigReloadTimer = setTimeout(() => {
    serverConfigReloadTimer = null;
    reloadServerConfig(reason);
  }, 120);
}

function watchServerConfig() {
  const watchIntervalMs = 1000;
  fs.watchFile(SERVER_CONFIG_PATH, { interval: watchIntervalMs }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) {
      return;
    }
    scheduleServerConfigReload("file change");
  });
  console.log(`[config] Watching ${SERVER_CONFIG_PATH} for changes (poll ${watchIntervalMs}ms)`);
}

function broadcastClassAndAbilityDefs() {
  for (const player of players.values()) {
    sendJson(player.ws, {
      type: "class_defs",
      classes: CLASS_CONFIG.clientClassDefs,
      abilities: ABILITY_CONFIG.clientAbilityDefs
    });
  }
}

function reloadAbilityAndClassConfig(reason) {
  try {
    const nextAbilityConfig = loadAbilityConfig();
    const nextClassConfig = loadClassConfigFromDisk(
      CLASS_CONFIG_PATH,
      nextAbilityConfig.abilityDefs,
      ITEM_CONFIG.itemDefs,
      BASE_PLAYER_SPEED,
      normalizeItemEntries
    );
    ABILITY_CONFIG = nextAbilityConfig;
    CLASS_CONFIG = nextClassConfig;
    console.log(`[config] Reloaded ${ABILITY_CONFIG_PATH} (${reason})`);
    broadcastClassAndAbilityDefs();
    reloadMobConfig(`ability dependency reload (${reason})`);
  } catch (error) {
    const details = error && error.message ? error.message : String(error);
    console.error(
      `[config] Failed to reload ${ABILITY_CONFIG_PATH} (${reason}). Keeping previous config. Reason: ${details}`
    );
  }
}

function scheduleAbilityConfigReload(reason) {
  if (abilityConfigReloadTimer !== null) {
    clearTimeout(abilityConfigReloadTimer);
  }
  abilityConfigReloadTimer = setTimeout(() => {
    abilityConfigReloadTimer = null;
    reloadAbilityAndClassConfig(reason);
  }, 120);
}

function watchAbilityConfig() {
  const watchIntervalMs = 1000;
  fs.watchFile(ABILITY_CONFIG_PATH, { interval: watchIntervalMs }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) {
      return;
    }
    scheduleAbilityConfigReload("file change");
  });
  console.log(`[config] Watching ${ABILITY_CONFIG_PATH} for changes (poll ${watchIntervalMs}ms)`);
}

function applyRuntimeMobDefinition(mob, mobDef) {
  if (!mob || !mobDef) {
    return false;
  }
  const wasAlive = !!mob.alive;
  const oldMaxHp = Math.max(1, Math.floor(Number(mob.maxHp) || 1));
  const oldHp = Math.max(0, Number(mob.hp) || 0);
  const hpRatio = oldMaxHp > 0 ? clamp(oldHp / oldMaxHp, 0, 1) : 1;

  mob.maxHp = clamp(Math.floor(Number(mobDef.health) || 1), 1, 255);
  if (wasAlive) {
    const scaledHp = Math.round(hpRatio * mob.maxHp);
    mob.hp = clamp(scaledHp, 1, mob.maxHp);
  } else {
    mob.hp = 0;
  }

  mob.baseSpeed = clamp(Number(mobDef.baseSpeed) || 0.5, 0.05, 20);
  mob.damageMin = clamp(Math.floor(Number(mobDef.damageMin) || 0), 0, 255);
  mob.damageMax = clamp(Math.floor(Number(mobDef.damageMax) || mob.damageMin), mob.damageMin, 255);
  mob.respawnMinMs = Math.max(1000, Math.floor(Number(mobDef.respawnMinMs) || 1000));
  mob.respawnMaxMs = Math.max(mob.respawnMinMs, Math.floor(Number(mobDef.respawnMaxMs) || mob.respawnMinMs));
  mob.dropRules = Array.isArray(mobDef.dropRules) ? mobDef.dropRules.map((entry) => ({ ...entry })) : [];
  mob.renderStyle = mobDef.renderStyle ? JSON.parse(JSON.stringify(mobDef.renderStyle)) : null;
  mob.combat = mobDef.combat ? JSON.parse(JSON.stringify(mobDef.combat)) : null;

  if (!(mob.abilityCooldowns instanceof Map)) {
    mob.abilityCooldowns = new Map();
  } else {
    mob.abilityCooldowns.clear();
  }

  if (mob.activeCast) {
    clearMobCast(mob);
  }
  return true;
}

function applyRuntimeMobConfig(nextMobConfig) {
  if (!nextMobConfig || typeof nextMobConfig !== "object") {
    return { updatedMobs: 0, updatedSpawners: 0 };
  }

  let updatedSpawners = 0;
  for (const spawner of mobSpawners.values()) {
    if (!spawner) {
      continue;
    }
    const existingClusterName = String(spawner.clusterName || "");
    let nextCluster = nextMobConfig.clusterDefs.find((entry) => String(entry?.name || "") === existingClusterName);
    if (!nextCluster) {
      const centerX = MAP_WIDTH / 2;
      const centerY = MAP_HEIGHT / 2;
      const spawnerDistance = Math.hypot(
        (Number(spawner.x) || centerX) - centerX,
        (Number(spawner.y) || centerY) - centerY
      );
      nextCluster = pickClusterDef(nextMobConfig, spawnerDistance);
      if (!nextCluster) {
        nextCluster = pickClusterDef(nextMobConfig);
      }
      if (!nextCluster) {
        continue;
      }
      spawner.clusterName = nextCluster.name;
    }
    spawner.clusterDef = nextCluster;
    if (!Array.isArray(spawner.mobIds)) {
      spawner.mobIds = [];
    } else {
      spawner.mobIds = spawner.mobIds.filter((mobId) => mobs.has(mobId));
    }
    updatedSpawners += 1;
  }

  let updatedMobs = 0;
  for (const mob of mobs.values()) {
    const mobType = String(mob.type || "");
    if (!mobType) {
      continue;
    }
    const nextDef = nextMobConfig.mobDefs.get(mobType);
    if (!nextDef) {
      continue;
    }
    if (applyRuntimeMobDefinition(mob, nextDef)) {
      updatedMobs += 1;
    }
  }

  return { updatedMobs, updatedSpawners };
}

function reloadMobConfig(reason) {
  try {
    const nextMobConfig = loadMobConfigFromDisk(
      MOB_CONFIG_PATH,
      ITEM_CONFIG.itemDefs,
      ABILITY_CONFIG.abilityDefs,
      { width: MAP_WIDTH, height: MAP_HEIGHT },
      SERVER_CONFIG,
      {
        mobAggroRange: MOB_AGGRO_RANGE,
        mobAttackRange: MOB_ATTACK_RANGE,
        mobWanderRadius: MOB_WANDER_RADIUS,
        mobAttackCooldownMs: MOB_ATTACK_COOLDOWN_MS
      }
    );
    MOB_CONFIG = nextMobConfig;
    const { updatedMobs, updatedSpawners } = applyRuntimeMobConfig(nextMobConfig);
    console.log(
      `[config] Reloaded ${MOB_CONFIG_PATH} (${reason}): updated ${updatedMobs} mobs, ${updatedSpawners} spawners`
    );
  } catch (error) {
    const details = error && error.message ? error.message : String(error);
    console.error(
      `[config] Failed to reload ${MOB_CONFIG_PATH} (${reason}). Keeping previous config. Reason: ${details}`
    );
  }
}

function scheduleMobConfigReload(reason) {
  if (mobConfigReloadTimer !== null) {
    clearTimeout(mobConfigReloadTimer);
  }
  mobConfigReloadTimer = setTimeout(() => {
    mobConfigReloadTimer = null;
    reloadMobConfig(reason);
  }, 120);
}

function watchMobConfig() {
  const watchIntervalMs = 1000;
  fs.watchFile(MOB_CONFIG_PATH, { interval: watchIntervalMs }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) {
      return;
    }
    scheduleMobConfigReload("file change");
  });
  console.log(`[config] Watching ${MOB_CONFIG_PATH} for changes (poll ${watchIntervalMs}ms)`);
}

let ABILITY_CONFIG = loadAbilityConfig();
let CLASS_CONFIG = loadClassConfigFromDisk(
  CLASS_CONFIG_PATH,
  ABILITY_CONFIG.abilityDefs,
  ITEM_CONFIG.itemDefs,
  BASE_PLAYER_SPEED,
  normalizeItemEntries
);
let MOB_CONFIG = loadMobConfigFromDisk(
  MOB_CONFIG_PATH,
  ITEM_CONFIG.itemDefs,
  ABILITY_CONFIG.abilityDefs,
  { width: MAP_WIDTH, height: MAP_HEIGHT },
  SERVER_CONFIG,
  {
    mobAggroRange: MOB_AGGRO_RANGE,
    mobAttackRange: MOB_ATTACK_RANGE,
    mobWanderRadius: MOB_WANDER_RADIUS,
    mobAttackCooldownMs: MOB_ATTACK_COOLDOWN_MS
  }
);
const GLOBAL_DROP_CONFIG = loadGlobalDropTableConfigFromDisk(
  GLOBAL_DROP_TABLE_PATH,
  ITEM_CONFIG.itemDefs,
  MAP_WIDTH,
  MAP_HEIGHT
);
watchServerConfig();
watchAbilityConfig();
watchMobConfig();

const server = createGameHttpServer({
  http,
  publicDir,
  getGameConfigPayload: () => ({
    classes: CLASS_CONFIG.clientClassDefs,
    abilities: ABILITY_CONFIG.clientAbilityDefs,
    items: ITEM_CONFIG.clientItemDefs,
    gameplay: {
      audio: GAMEPLAY_CONFIG.audio
    },
    sounds: buildSoundManifest()
  })
});

const wss = new WebSocketServer({ server });

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
const worldEventQueues = createWorldEventQueues({
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT
});
const {
  pendingDamageEvents,
  pendingExplosionEvents,
  pendingProjectileHitEvents,
  pendingMobDeathEvents,
  queueDamageEvent,
  queueExplosionEvent,
  queueProjectileHitEvent,
  queueMobDeathEvent
} = worldEventQueues;

function allocateProjectileId() {
  return nextProjectileId++;
}

const projectileSpawnTools = createProjectileSpawnTools({
  normalizeDirection,
  clamp,
  allocateProjectileId,
  projectiles,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  defaultProjectileHitRadius: DEFAULT_PROJECTILE_HIT_RADIUS
});
const normalizeProjectileTargetType = projectileSpawnTools.normalizeProjectileTargetType;
const inferProjectileTargetTypeFromOwner = projectileSpawnTools.inferProjectileTargetTypeFromOwner;
const spawnProjectileFromTemplate = projectileSpawnTools.spawnProjectileFromTemplate;

const abilityHandlerContext = {
  mobs,
  projectiles,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  defaultProjectileHitRadius: DEFAULT_PROJECTILE_HIT_RADIUS,
  allocateProjectileId,
  clamp,
  normalizeDirection,
  randomInt,
  rotateDirection,
  getAbilityRangeForLevel,
  getAbilityDamageRange,
  getAbilityDotDamageRange,
  markAbilityUsed: (...args) => markAbilityUsed(...args),
  applyDamageToMob: (...args) => applyDamageToMob(...args),
  applyAbilityHitEffectsToMob: (...args) => applyAbilityHitEffectsToMob(...args),
  stunMob: (...args) => stunMob(...args),
  queueExplosionEvent,
  getAreaAbilityTargetPosition: (...args) => getAreaAbilityTargetPosition(...args),
  createPersistentAreaEffect: (...args) => createPersistentAreaEffect(...args),
  createPersistentBeamEffect: (...args) => createPersistentBeamEffect(...args),
  resolvePlayerMobCollisions,
  getAbilityInvulnerabilityDurationMs
};

function normalizeItemEntries(entries) {
  const merged = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry) {
      continue;
    }
    const itemId = String(entry.itemId || "").trim();
    const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
    if (!itemId || qty <= 0) {
      continue;
    }
    if (!ITEM_CONFIG.itemDefs.has(itemId)) {
      continue;
    }
    merged.set(itemId, (merged.get(itemId) || 0) + qty);
  }

  return Array.from(merged.entries()).map(([itemId, qty]) => ({ itemId, qty }));
}

const lootBagTools = createLootBagTools({
  normalizeItemEntries,
  clamp,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  bagDespawnMs: BAG_DESPAWN_MS,
  lootBags,
  allocateLootBagId: () => String(nextLootBagId++)
});
const createLootBag = lootBagTools.createLootBag;
const tickLootBags = lootBagTools.tickLootBags;

function rollDropRules(rules) {
  const drops = [];
  const chanceMultiplier = SERVER_CONFIG.dropChanceMultiplier;
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule || !ITEM_CONFIG.itemDefs.has(rule.itemId)) {
      continue;
    }

    if (rule.kind === "range") {
      const qty = randomInt(Math.max(0, rule.min || 0), Math.max(0, rule.max || 0));
      if (qty > 0) {
        drops.push({ itemId: rule.itemId, qty });
      }
      continue;
    }

    if (rule.kind === "chance") {
      const chance = clamp((Number(rule.chance) || 0) * chanceMultiplier, 0, 1);
      if (Math.random() < chance) {
        drops.push({ itemId: rule.itemId, qty: 1 });
      }
    }
  }

  return normalizeItemEntries(drops);
}

function getDistanceFromCenter(x, y) {
  const centerX = MAP_WIDTH / 2;
  const centerY = MAP_HEIGHT / 2;
  return Math.hypot((Number(x) || 0) - centerX, (Number(y) || 0) - centerY);
}

function rollGlobalDropsForPlayer(player) {
  if (!player) {
    return [];
  }

  const dist = getDistanceFromCenter(player.x, player.y);
  const allDrops = [];
  for (const entry of GLOBAL_DROP_CONFIG.entries) {
    if (!entry || dist < entry.rangeMin || dist > entry.rangeMax) {
      continue;
    }
    const rolled = rollDropRules(entry.rules);
    if (rolled.length) {
      allDrops.push(...rolled);
    }
  }
  return normalizeItemEntries(allDrops);
}

function rollMobDrops(mob) {
  const rules = Array.isArray(mob?.dropRules) ? mob.dropRules : [];
  return rollDropRules(rules);
}

const mobBehaviorTools = createMobBehaviorTools({
  players,
  clamp,
  getMobCombatProfile: (...args) => getMobCombatProfile(...args),
  getMobSpeedMultiplier: () => Number(SERVER_CONFIG.mobSpeedMultiplier) || 1,
  mobProvokedChaseMs: MOB_PROVOKED_CHASE_MS,
  mobProvokedLeashRadius: MOB_PROVOKED_LEASH_RADIUS,
  mobWanderRadius: MOB_WANDER_RADIUS
});
const markMobProvokedByPlayer = mobBehaviorTools.markMobProvokedByPlayer;
const hasActiveProvokedChase = mobBehaviorTools.hasActiveProvokedChase;
const getMobDistanceFromSpawn = mobBehaviorTools.getMobDistanceFromSpawn;
const getMobLeashRadius = mobBehaviorTools.getMobLeashRadius;
const startMobReturnToSpawn = mobBehaviorTools.startMobReturnToSpawn;
const getMobMoveSpeed = mobBehaviorTools.getMobMoveSpeed;

const damageTools = createDamageTools({
  queueDamageEvent,
  markMobProvokedByPlayer,
  killMob,
  clearPlayerCast: (...args) => clearPlayerCast(...args),
  clearPlayerCombatEffects: (...args) => clearPlayerCombatEffects(...args)
});
const applyDamageToMob = damageTools.applyDamageToMob;
const applyDamageToPlayer = damageTools.applyDamageToPlayer;
const mobCombatEffectTools = createMobCombatEffectTools({
  clamp,
  randomInt,
  applyDamageToMob,
  getAbilityDotDamageRange
});
const stunMob = mobCombatEffectTools.stunMob;
const applySlowToMob = mobCombatEffectTools.applySlowToMob;
const applyDotToMob = mobCombatEffectTools.applyDotToMob;
const tickMobDotEffects = mobCombatEffectTools.tickMobDotEffects;
const applyAbilityHitEffectsToMob = mobCombatEffectTools.applyAbilityHitEffectsToMob;
const projectileEffectTools = createProjectileEffectTools({
  clamp,
  applySlowToMob,
  stunMob,
  applyDotToMob
});
const applyProjectileHitEffects = projectileEffectTools.applyProjectileHitEffects;
const areaEffectTools = createAreaEffectTools({
  clamp,
  normalizeDirection,
  queueExplosionEvent,
  allocateAreaEffectId: () => String(nextAreaEffectId++),
  activeAreaEffects,
  mobs,
  randomInt,
  applyDamageToMob,
  applyDotToMob,
  applySlowToMob,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT
});
const getAreaAbilityTargetPosition = areaEffectTools.getAreaAbilityTargetPosition;
const createPersistentAreaEffect = areaEffectTools.createPersistentAreaEffect;
const createPersistentBeamEffect = areaEffectTools.createPersistentBeamEffect;
const tickAreaEffects = areaEffectTools.tickAreaEffects;

const playerAbilityTools = createPlayerAbilityTools({
  clamp,
  getClassDefs: () => CLASS_CONFIG.classDefs,
  getAbilityDefs: () => ABILITY_CONFIG.abilityDefs
});
const getPlayerClassDef = playerAbilityTools.getPlayerClassDef;
const getPlayerAbilityLevel = playerAbilityTools.getPlayerAbilityLevel;
const levelUpPlayerAbility = playerAbilityTools.levelUpPlayerAbility;

const playerCombatEffectTools = createPlayerCombatEffectTools({
  clamp,
  randomInt,
  applyDamageToPlayer,
  getAbilityDotDamageRange
});
const clearPlayerCombatEffects = playerCombatEffectTools.clearPlayerCombatEffects;
const tickPlayerDotEffects = playerCombatEffectTools.tickPlayerDotEffects;
const applyAbilityHitEffectsToPlayer = playerCombatEffectTools.applyAbilityHitEffectsToPlayer;
const applyProjectileHitEffectsToPlayer = playerCombatEffectTools.applyProjectileHitEffectsToPlayer;
const castingTools = createCastingTools({
  getAbilityCooldownMsForLevel
});
const getAbilityCooldownPassed = castingTools.getAbilityCooldownPassed;
const markAbilityUsed = castingTools.markAbilityUsed;
const playerHasMovementInput = castingTools.playerHasMovementInput;
const clearPlayerCast = castingTools.clearPlayerCast;
const clearMobCast = castingTools.clearMobCast;

function createMob(spawner) {
  if (!spawner.clusterDef || !spawner.clusterDef.members.length) {
    return null;
  }

  const memberIndex = randomInt(0, spawner.clusterDef.members.length - 1);
  const mobDef = spawner.clusterDef.members[memberIndex];
  const spawnPos = randomPointInRadius(spawner.x, spawner.y, 1.5);
  const mob = {
    id: String(nextMobId++),
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
  const cellX = Math.floor(x / CLUSTER_AREA_SIZE);
  const cellY = Math.floor(y / CLUSTER_AREA_SIZE);
  return `${cellX},${cellY}`;
}

function initializeMobSpawners() {
  const centerX = MAP_WIDTH / 2;
  const centerY = MAP_HEIGHT / 2;
  const targetMobClusters = Math.max(0, Math.round(TARGET_MOB_CLUSTERS * SERVER_CONFIG.mobSpawnMultiplier));
  const maxSpawnRadius = Math.max(1, Number(MOB_CONFIG.maxSpawnRadius) || 1);

  const clustersPerCell = new Map();
  let attempts = 0;
  const maxAttempts = targetMobClusters * 100;

  while (mobSpawners.size < targetMobClusters && attempts < maxAttempts) {
    attempts += 1;
    const distanceFromCenter = Math.random() * maxSpawnRadius;
    const clusterDef = pickClusterDef(MOB_CONFIG, distanceFromCenter);
    if (!clusterDef) {
      continue;
    }

    const angle = Math.random() * Math.PI * 2;
    const x = clamp(centerX + Math.cos(angle) * distanceFromCenter, 0, MAP_WIDTH - 1);
    const y = clamp(centerY + Math.sin(angle) * distanceFromCenter, 0, MAP_HEIGHT - 1);
    const cellKey = getSpawnerCellKey(x, y);
    const existingInCell = clustersPerCell.get(cellKey) || 0;
    if (existingInCell >= MAX_CLUSTERS_PER_AREA) {
      continue;
    }

    const spawner = {
      id: String(nextSpawnerId++),
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

  if (targetMobClusters > 0 && mobSpawners.size < targetMobClusters) {
    console.warn(
      `Only initialized ${mobSpawners.size}/${targetMobClusters} mob clusters with area limit ${MAX_CLUSTERS_PER_AREA} per ${CLUSTER_AREA_SIZE}x${CLUSTER_AREA_SIZE}.`
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
  createLootBag(mob.x, mob.y, normalizeItemEntries([...globalDrops, ...mobDrops]));

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

const projectileRuntimeTools = createProjectileRuntimeTools({
  clamp,
  players,
  mobs,
  spawnProjectileFromTemplate,
  normalizeProjectileTargetType
});
const emitProjectilesFromEmitter = projectileRuntimeTools.emitProjectilesFromEmitter;
const getNearestProjectileTarget = projectileRuntimeTools.getNearestProjectileTarget;

function tickProjectiles() {
  const now = Date.now();
  const toDelete = [];

  for (const projectile of projectiles.values()) {
    const dt = TICK_MS / 1000;
    emitProjectilesFromEmitter(projectile, now);
    const homingRange = Math.max(0, Number(projectile.homingRange) || 0);
    const homingTurnRate = Math.max(0, Number(projectile.homingTurnRate) || 0);
    if (homingRange > 0 && homingTurnRate > 0) {
      const target = getNearestProjectileTarget(projectile, homingRange);
      if (target) {
        const desiredDir = normalizeDirection(target.x - projectile.x, target.y - projectile.y);
        const nextDir = desiredDir
          ? steerDirectionTowards(projectile, desiredDir, homingTurnRate * dt)
          : null;
        if (nextDir) {
          projectile.dx = nextDir.dx;
          projectile.dy = nextDir.dy;
        }
      }
    }
    projectile.x += projectile.dx * projectile.speed * dt;
    projectile.y += projectile.dy * projectile.speed * dt;

    const projectileTargetType =
      String(projectile.targetType || "").trim().toLowerCase() === "player" ? "player" : "mob";
    let hitMob = null;
    let hitPlayer = null;
    const hitRadius = clamp(Number(projectile.hitRadius) || DEFAULT_PROJECTILE_HIT_RADIUS, 0.1, 8);
    if (projectileTargetType === "player") {
      for (const player of players.values()) {
        if (!player || player.hp <= 0) {
          continue;
        }
        if (distance(projectile, player) > hitRadius) {
          continue;
        }
        hitPlayer = player;
        break;
      }
    } else {
      for (const mob of mobs.values()) {
        if (!mob.alive) {
          continue;
        }
        if (distance(projectile, mob) > hitRadius) {
          continue;
        }
        hitMob = mob;
        break;
      }
    }

    const expired = now - projectile.createdAt > projectile.ttlMs;
    const outOfMap =
      projectile.x < 0 ||
      projectile.x > MAP_WIDTH - 1 ||
      projectile.y < 0 ||
      projectile.y > MAP_HEIGHT - 1;

    if (hitMob || hitPlayer) {
      const impactX = hitMob ? hitMob.x : hitPlayer.x;
      const impactY = hitMob ? hitMob.y : hitPlayer.y;
      queueProjectileHitEvent(impactX, impactY, projectile.abilityId);
      const damageMin = clamp(Math.floor(Number(projectile.damageMin) || 0), 0, 255);
      const damageMax = clamp(Math.floor(Number(projectile.damageMax) || damageMin), damageMin, 255);
      const baseDamage = randomInt(damageMin, damageMax);
      const explosionRadius = Math.max(0, Number(projectile.explosionRadius) || 0);
      const minMultiplier = clamp(Number(projectile.explosionDamageMultiplier) || 0, 0, 1);

      if (explosionRadius > 0) {
        queueExplosionEvent(impactX, impactY, explosionRadius, projectile.abilityId);
        if (projectileTargetType === "player") {
          for (const player of players.values()) {
            if (!player || player.hp <= 0) {
              continue;
            }
            const dist = Math.hypot(player.x - impactX, player.y - impactY);
            if (dist > explosionRadius) {
              continue;
            }
            const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
            const scale = 1 - t * (1 - minMultiplier);
            const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
            const dealt = applyDamageToPlayer(player, scaledDamage, now);
            applyProjectileHitEffectsToPlayer(player, projectile, dealt, now);
          }
        } else {
          for (const mob of mobs.values()) {
            if (!mob.alive) {
              continue;
            }
            const dist = Math.hypot(mob.x - impactX, mob.y - impactY);
            if (dist > explosionRadius) {
              continue;
            }
            const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
            const scale = 1 - t * (1 - minMultiplier);
            const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
            const dealt = applyDamageToMob(mob, scaledDamage, projectile.ownerId);
            applyProjectileHitEffects(mob, projectile, dealt, now);
          }
        }
      } else {
        if (projectileTargetType === "player") {
          const dealt = applyDamageToPlayer(hitPlayer, baseDamage, now);
          applyProjectileHitEffectsToPlayer(hitPlayer, projectile, dealt, now);
        } else {
          const dealt = applyDamageToMob(hitMob, baseDamage, projectile.ownerId);
          applyProjectileHitEffects(hitMob, projectile, dealt, now);
        }
      }
    } else if (
      (expired || outOfMap) &&
      (Number(projectile.explosionRadius) || 0) > 0 &&
      projectile.explodeOnExpire !== false
    ) {
      const explosionRadius = Math.max(0, Number(projectile.explosionRadius) || 0);
      const minMultiplier = clamp(Number(projectile.explosionDamageMultiplier) || 0, 0, 1);
      const damageMin = clamp(Math.floor(Number(projectile.damageMin) || 0), 0, 255);
      const damageMax = clamp(Math.floor(Number(projectile.damageMax) || damageMin), damageMin, 255);
      const baseDamage = randomInt(damageMin, damageMax);
      queueExplosionEvent(projectile.x, projectile.y, explosionRadius, projectile.abilityId);
      if (projectileTargetType === "player") {
        for (const player of players.values()) {
          if (!player || player.hp <= 0) {
            continue;
          }
          const dist = Math.hypot(player.x - projectile.x, player.y - projectile.y);
          if (dist > explosionRadius) {
            continue;
          }
          const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
          const scale = 1 - t * (1 - minMultiplier);
          const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
          const dealt = applyDamageToPlayer(player, scaledDamage, now);
          applyProjectileHitEffectsToPlayer(player, projectile, dealt, now);
        }
      } else {
        for (const mob of mobs.values()) {
          if (!mob.alive) {
            continue;
          }
          const dist = Math.hypot(mob.x - projectile.x, mob.y - projectile.y);
          if (dist > explosionRadius) {
            continue;
          }
          const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
          const scale = 1 - t * (1 - minMultiplier);
          const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
          const dealt = applyDamageToMob(mob, scaledDamage, projectile.ownerId);
          applyProjectileHitEffects(mob, projectile, dealt, now);
        }
      }
    }

    if (expired || outOfMap || hitMob || hitPlayer) {
      toDelete.push(projectile.id);
    }
  }

  for (const id of toDelete) {
    projectiles.delete(id);
  }
}

function tickPlayers() {
  const dt = TICK_MS / 1000;
  const now = Date.now();

  for (const player of players.values()) {
    if (player.hp > 0 && player.mana < player.maxMana && player.manaRegen > 0) {
      player.mana = clamp(player.mana + player.manaRegen * dt, 0, player.maxMana);
    }
    tickPlayerHealEffects(player);
    tickPlayerManaEffects(player);
    tickPlayerDotEffects(player, now);

    const stunned = (Number(player.stunnedUntil) || 0) > now;
    if (stunned && player.activeCast) {
      clearPlayerCast(player);
    } else if (player.activeCast && playerHasMovementInput(player)) {
      const activeDef = ABILITY_CONFIG.abilityDefs.get(String(player.activeCast.abilityId || ""));
      if (!activeDef || activeDef.kind !== "teleport") {
        clearPlayerCast(player);
      }
    }

    if (player.hp <= 0) {
      player.input = { dx: 0, dy: 0 };
      clearPlayerCast(player);
      player.activeHeals = [];
      player.activeManaRestores = [];
      clearPlayerCombatEffects(player);
      continue;
    }

    if (!stunned && (player.stunnedUntil || player.stunDurationMs)) {
      player.stunnedUntil = 0;
      player.stunDurationMs = 0;
    }
    if ((Number(player.slowUntil) || 0) <= now && (player.slowUntil || player.slowMultiplier !== 1)) {
      player.slowUntil = 0;
      player.slowMultiplier = 1;
      player.slowDurationMs = 0;
    }
    if ((Number(player.burningUntil) || 0) <= now && player.burningUntil) {
      player.burningUntil = 0;
      player.burnDurationMs = 0;
    }

    if (stunned) {
      player.input = { dx: 0, dy: 0 };
      continue;
    }

    if (!player.input || (!player.input.dx && !player.input.dy)) {
      continue;
    }

    const slowMultiplier = (Number(player.slowUntil) || 0) > now ? clamp(Number(player.slowMultiplier) || 1, 0.1, 1) : 1;
    const moveSpeed = Math.max(0.1, Number(player.moveSpeed) || BASE_PLAYER_SPEED) * slowMultiplier;
    player.x = clamp(player.x + player.input.dx * moveSpeed * dt, 0, MAP_WIDTH - 1);
    player.y = clamp(player.y + player.input.dy * moveSpeed * dt, 0, MAP_HEIGHT - 1);
    resolvePlayerMobCollisions(player);
  }
}

function resolvePlayerMobCollisions(player) {
  if (!player || player.hp <= 0) {
    return;
  }

  for (let iter = 0; iter < PLAYER_MOB_SEPARATION_ITERATIONS; iter += 1) {
    for (const mob of mobs.values()) {
      if (!mob.alive) {
        continue;
      }
      let dx = player.x - mob.x;
      let dy = player.y - mob.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= PLAYER_MOB_MIN_SEPARATION) {
        continue;
      }

      if (dist < 0.0001) {
        const fallback =
          normalizeDirection(player.input && player.input.dx, player.input && player.input.dy) ||
          normalizeDirection(player.lastDirection && player.lastDirection.dx, player.lastDirection && player.lastDirection.dy) ||
          { dx: 1, dy: 0 };
        dx = fallback.dx;
        dy = fallback.dy;
        dist = 1;
      }

      const overlap = PLAYER_MOB_MIN_SEPARATION - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      player.x = clamp(player.x + nx * overlap, 0, MAP_WIDTH - 1);
      player.y = clamp(player.y + ny * overlap, 0, MAP_HEIGHT - 1);
    }
  }
}

function resolveAllPlayersAgainstMobs() {
  for (const player of players.values()) {
    resolvePlayerMobCollisions(player);
  }
}

function tryPickupLootBag(player, targetX, targetY) {
  let pickedBag = null;
  let bestScore = Infinity;
  const hasTarget = Number.isFinite(targetX) && Number.isFinite(targetY);

  for (const bag of lootBags.values()) {
    const playerDist = distance(player, bag);
    if (playerDist > BAG_PICKUP_RANGE) {
      continue;
    }

    // Prefer bag near click point when provided, but do not require exact click precision.
    const clickDist = hasTarget ? Math.hypot(bag.x - targetX, bag.y - targetY) : 0;
    const score = hasTarget ? clickDist + playerDist * 0.15 : playerDist;
    if (score < bestScore) {
      bestScore = score;
      pickedBag = bag;
    }
  }

  if (!pickedBag) {
    return false;
  }

  const transfer = addItemsToInventory(player, pickedBag.items);
  if (!transfer.added.length) {
    sendJson(player.ws, {
      type: "loot_picked",
      itemsGained: [],
      inventoryFull: true
    });
    return false;
  }

  if (transfer.leftover.length) {
    pickedBag.items = transfer.leftover;
    pickedBag.metaVersion += 1;
  } else {
    lootBags.delete(pickedBag.id);
  }

  if (transfer.changed) {
    sendInventoryState(player);
  }
  syncPlayerCopperFromInventory(player, true);

  sendJson(player.ws, {
    type: "loot_picked",
    itemsGained: transfer.added,
    inventoryFull: transfer.leftover.length > 0
  });
  return true;
}

const {
  buildPlayerSwingEventsForRecipient,
  buildPlayerCastEventsForRecipient,
  buildMobCastEventsForRecipient,
  buildMobBiteEventsForRecipient,
  buildMobEffectEventsForRecipient,
  buildSelfPlayerEffectUpdate,
  buildPlayerEffectEventsForRecipient
} = createEventBuilders();

const buildAreaEffectEventsForRecipient = createAreaEffectEventBuilder({
  activeAreaEffects,
  inVisibilityRange,
  visibilityRange: VISIBILITY_RANGE
});

function usePlayerAbility(player, abilityId, targetDx, targetDy, targetDistance = null) {
  if (!player || player.hp <= 0) {
    return false;
  }
  if ((Number(player.stunnedUntil) || 0) > Date.now()) {
    return false;
  }

  if (player.activeCast) {
    return false;
  }

  const resolvedAbilityId = String(abilityId || "").trim();
  if (!resolvedAbilityId) {
    return false;
  }
  const abilityDef = ABILITY_CONFIG.abilityDefs.get(resolvedAbilityId);
  if (!abilityDef) {
    return false;
  }

  const abilityLevel = getPlayerAbilityLevel(player, resolvedAbilityId);
  if (abilityLevel <= 0) {
    return false;
  }

  const now = Date.now();
  const manaCost = Math.max(0, Number(abilityDef.manaCost) || 0);
  if (player.mana + 1e-6 < manaCost) {
    return false;
  }
  if (!getAbilityCooldownPassed(player, abilityDef, abilityLevel, now)) {
    return false;
  }

  const aimDirection =
    normalizeDirection(targetDx, targetDy) || normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
  if (!aimDirection) {
    return false;
  }

  const castMs = Math.max(0, Number(abilityDef.castMs) || 0);
  if (castMs > 0) {
    if (abilityDef.kind !== "teleport" && playerHasMovementInput(player)) {
      return false;
    }
    player.activeCast = {
      abilityId: resolvedAbilityId,
      dx: aimDirection.dx,
      dy: aimDirection.dy,
      targetDistance: Number.isFinite(Number(targetDistance)) ? Number(targetDistance) : null,
      durationMs: castMs,
      startedAt: now,
      endsAt: now + castMs
    };
    player.lastDirection = aimDirection;
    player.castStateVersion = (Number(player.castStateVersion) + 1) & 0xffff;
    return true;
  }

  const used = executeAbilityByKind({
    player,
    abilityDef,
    abilityLevel,
    targetDx: aimDirection.dx,
    targetDy: aimDirection.dy,
    targetDistance,
    now,
    ctx: abilityHandlerContext
  });
  if (used && manaCost > 0) {
    player.mana = clamp(player.mana - manaCost, 0, player.maxMana);
  }
  return used;
}

function tickPlayerCasts(now) {
  for (const player of players.values()) {
    const cast = player.activeCast;
    if (!cast) {
      continue;
    }

    const abilityDef = ABILITY_CONFIG.abilityDefs.get(String(cast.abilityId || ""));
    if (!abilityDef) {
      clearPlayerCast(player);
      continue;
    }

    if (player.hp <= 0 || (abilityDef.kind !== "teleport" && playerHasMovementInput(player))) {
      clearPlayerCast(player);
      continue;
    }

    if (now < cast.endsAt) {
      continue;
    }

    const abilityLevel = getPlayerAbilityLevel(player, abilityDef.id);
    if (abilityLevel <= 0) {
      clearPlayerCast(player);
      continue;
    }

    const manaCost = Math.max(0, Number(abilityDef.manaCost) || 0);
    if (player.mana + 1e-6 < manaCost) {
      clearPlayerCast(player);
      continue;
    }
    if (!getAbilityCooldownPassed(player, abilityDef, abilityLevel, now)) {
      clearPlayerCast(player);
      continue;
    }

    const used = executeAbilityByKind({
      player,
      abilityDef,
      abilityLevel,
      targetDx: cast.dx,
      targetDy: cast.dy,
      targetDistance: cast.targetDistance,
      now,
      ctx: abilityHandlerContext
    });
    if (used && manaCost > 0) {
      player.mana = clamp(player.mana - manaCost, 0, player.maxMana);
    }
    clearPlayerCast(player);
  }
}

const mobCombatTools = createMobCombatTools({
  players,
  clamp,
  normalizeDirection,
  distance,
  defaultAggroRange: MOB_AGGRO_RANGE,
  defaultAttackRange: MOB_ATTACK_RANGE,
  defaultWanderRadius: MOB_WANDER_RADIUS,
  defaultAttackCooldownMs: MOB_ATTACK_COOLDOWN_MS
});
const getMobCombatProfile = mobCombatTools.getMobCombatProfile;
const getNearestAggroPlayer = mobCombatTools.getNearestAggroPlayer;
const triggerMobAttackAnimation = mobCombatTools.triggerMobAttackAnimation;

const mobAbilityTools = createMobAbilityTools({
  players,
  projectiles,
  getAbilityDefs: () => ABILITY_CONFIG.abilityDefs,
  resolveMobAbilityOverrideDef,
  normalizeDirection,
  rotateDirection,
  distance,
  clamp,
  randomInt,
  getAbilityRangeForLevel,
  getAbilityDamageRange,
  getAbilityDotDamageRange,
  applyDamageToPlayer,
  applyAbilityHitEffectsToPlayer,
  triggerMobAttackAnimation,
  queueExplosionEvent,
  clearMobCast: (...args) => clearMobCast(...args),
  getMobCombatProfile: (...args) => getMobCombatProfile(...args),
  allocateProjectileId,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  defaultProjectileHitRadius: DEFAULT_PROJECTILE_HIT_RADIUS,
  defaultMobAttackRange: MOB_ATTACK_RANGE,
  defaultMobAttackCooldownMs: MOB_ATTACK_COOLDOWN_MS
});
const completeMobAbilityCast = mobAbilityTools.completeMobAbilityCast;
const tryMobCastConfiguredAbility = mobAbilityTools.tryMobCastConfiguredAbility;
const tryMobBasicAttack = mobAbilityTools.tryMobBasicAttack;

function tickMobs() {
  const now = Date.now();
  const dt = TICK_MS / 1000;

  for (const mob of mobs.values()) {
    if (!mob.alive) {
      if (now >= mob.respawnAt) {
        respawnMob(mob);
      }
      continue;
    }

    tickMobDotEffects(mob, now);
    if (!mob.alive) {
      continue;
    }

    if (mob.activeCast) {
      if ((Number(mob.stunnedUntil) || 0) > now) {
        clearMobCast(mob);
        continue;
      }
      if (now >= (Number(mob.activeCast.endsAt) || 0)) {
        completeMobAbilityCast(mob, now);
        continue;
      } else {
        continue;
      }
    }

    if ((Number(mob.stunnedUntil) || 0) > now) {
      continue;
    }

    const mobSpeed = getMobMoveSpeed(mob);
    if (mob.returningHome) {
      const distFromSpawn = getMobDistanceFromSpawn(mob);
      if (distFromSpawn <= MOB_WANDER_RADIUS + 0.05) {
        mob.returningHome = false;
        mob.wanderTarget = null;
        mob.nextWanderAt = now + randomInt(450, 1300);
      } else {
        const homeDir = normalizeDirection(mob.spawnX - mob.x, mob.spawnY - mob.y);
        if (homeDir) {
          const returnRadius = Math.max(MOB_WANDER_RADIUS, distFromSpawn);
          const nextPos = clampToSpawnRadius(
            mob.x + homeDir.dx * mobSpeed * 0.8 * dt,
            mob.y + homeDir.dy * mobSpeed * 0.8 * dt,
            mob.spawnX,
            mob.spawnY,
            returnRadius
          );
          mob.x = nextPos.x;
          mob.y = nextPos.y;
        }
        continue;
      }
    }

    let forcedTarget = null;
    if (hasActiveProvokedChase(mob, now)) {
      const candidate = players.get(String(mob.chaseTargetPlayerId));
      if (candidate && candidate.hp > 0) {
        forcedTarget = candidate;
      } else {
        startMobReturnToSpawn(mob);
        continue;
      }
    } else {
      mob.chaseTargetPlayerId = null;
      mob.chaseUntil = 0;
    }

    if (forcedTarget && getMobDistanceFromSpawn(mob) >= MOB_PROVOKED_LEASH_RADIUS - 0.05) {
      startMobReturnToSpawn(mob);
      continue;
    }

    const combat = getMobCombatProfile(mob);
    const behavior = String(combat.behavior || "melee").toLowerCase() === "ranged" ? "ranged" : "melee";
    const aggroRange = Math.max(0.5, Number(combat.aggroRange) || MOB_AGGRO_RANGE);
    const nearestAggro = forcedTarget ? null : getNearestAggroPlayer(mob, aggroRange);
    const aggroPlayer = forcedTarget || (nearestAggro ? nearestAggro.player : null);
    const dist = aggroPlayer ? distance(mob, aggroPlayer) : Infinity;

    if (aggroPlayer) {
      const castedAbility = tryMobCastConfiguredAbility(mob, aggroPlayer, dist, now);
      if (castedAbility) {
        if (aggroPlayer.hp <= 0) {
          startMobReturnToSpawn(mob);
        }
        continue;
      }

      const basicAttack = combat.basicAttack && typeof combat.basicAttack === "object" ? combat.basicAttack : null;
      const basicRange = Math.max(0.2, Number(basicAttack?.range) || MOB_ATTACK_RANGE);
      const preferredRange =
        behavior === "ranged"
          ? Math.max(basicRange, Number(combat.preferredRange) || basicRange)
          : basicRange;
      const rangeBand = Math.max(0.3, preferredRange * 0.14);
      const shouldMoveCloser =
        behavior === "ranged" ? dist > preferredRange + rangeBand : dist > basicRange;
      const shouldRetreat = behavior === "ranged" ? dist < Math.max(0.2, preferredRange - rangeBand) : false;

      if (tryMobBasicAttack(mob, aggroPlayer, dist, now)) {
        if (aggroPlayer.hp <= 0) {
          startMobReturnToSpawn(mob);
        }
        continue;
      }

      if (shouldMoveCloser || shouldRetreat) {
        const chaseDir = normalizeDirection(aggroPlayer.x - mob.x, aggroPlayer.y - mob.y);
        if (chaseDir) {
          const moveDir = shouldRetreat ? { dx: -chaseDir.dx, dy: -chaseDir.dy } : chaseDir;
          const leashRadius = forcedTarget ? MOB_PROVOKED_LEASH_RADIUS : getMobLeashRadius(mob, now);
          const speedScale = shouldRetreat ? 0.92 : 1;
          const nextPos = clampToSpawnRadius(
            mob.x + moveDir.dx * mobSpeed * speedScale * dt,
            mob.y + moveDir.dy * mobSpeed * speedScale * dt,
            mob.spawnX,
            mob.spawnY,
            leashRadius
          );
          mob.x = nextPos.x;
          mob.y = nextPos.y;
        }
      }
      continue;
    }

    if (!mob.wanderTarget || now >= mob.nextWanderAt || distance(mob, mob.wanderTarget) < 0.35) {
      mob.wanderTarget = randomPointInRadius(mob.spawnX, mob.spawnY, MOB_WANDER_RADIUS);
      mob.nextWanderAt = now + randomInt(900, 2600);
    }

    const dir = normalizeDirection(mob.wanderTarget.x - mob.x, mob.wanderTarget.y - mob.y);
    if (!dir) {
      continue;
    }

    const nextPos = clampToSpawnRadius(
      mob.x + dir.dx * mobSpeed * 0.7 * dt,
      mob.y + dir.dy * mobSpeed * 0.7 * dt,
      mob.spawnX,
      mob.spawnY,
      getMobLeashRadius(mob, now)
    );
    mob.x = nextPos.x;
    mob.y = nextPos.y;
  }

  resolveMobOverlaps(now);
  resolveAllPlayersAgainstMobs();
}

function resolveMobOverlaps(now = Date.now()) {
  const aliveMobs = [];
  for (const mob of mobs.values()) {
    if (mob.alive) {
      aliveMobs.push(mob);
    }
  }

  for (let iter = 0; iter < MOB_SEPARATION_ITERATIONS; iter += 1) {
    for (let i = 0; i < aliveMobs.length; i += 1) {
      for (let j = i + 1; j < aliveMobs.length; j += 1) {
        const a = aliveMobs[i];
        const b = aliveMobs[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist >= MOB_MIN_SEPARATION) {
          continue;
        }

        if (dist < 0.0001) {
          const angle = Math.random() * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }

        const overlap = (MOB_MIN_SEPARATION - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;

        const nextA = clampToSpawnRadius(
          a.x - nx * overlap,
          a.y - ny * overlap,
          a.spawnX,
          a.spawnY,
          getMobLeashRadius(a, now)
        );
        const nextB = clampToSpawnRadius(
          b.x + nx * overlap,
          b.y + ny * overlap,
          b.spawnX,
          b.spawnY,
          getMobLeashRadius(b, now)
        );

        a.x = nextA.x;
        a.y = nextA.y;
        b.x = nextB.x;
        b.y = nextB.y;
      }
    }
  }
}

const buildEntityUpdatePacket = createEntityUpdatePacketBuilder({
  getPendingHealAmount,
  getPendingManaAmount,
  serializeBagItemsForMeta
});

const broadcastState = createStateBroadcaster({
  players,
  projectiles,
  mobs,
  lootBags,
  VISIBILITY_RANGE,
  inVisibilityRange,
  serializePlayer,
  serializeMob,
  buildEntityUpdatePacket,
  buildPlayerSwingEventsForRecipient,
  buildPlayerCastEventsForRecipient,
  buildPlayerEffectEventsForRecipient,
  buildMobCastEventsForRecipient,
  buildMobBiteEventsForRecipient,
  buildMobEffectEventsForRecipient,
  buildSelfPlayerEffectUpdate,
  buildAreaEffectEventsForRecipient,
  encodeMobMetaPacket,
  encodeProjectileMetaPacket,
  encodeMobEffectEventPacket,
  encodeAreaEffectEventPacket,
  encodeDamageEventPacket,
  pendingDamageEvents,
  pendingExplosionEvents,
  pendingProjectileHitEvents,
  pendingMobDeathEvents,
  sendJson,
  sendBinary
});

registerWsConnections({
  wss,
  deps: {
    sendJson,
    players,
    CLASS_CONFIG,
    ABILITY_CONFIG,
    ITEM_CONFIG,
    MAP_WIDTH,
    MAP_HEIGHT,
    VISIBILITY_RANGE,
    buildSoundManifest,
    randomSpawn,
    expNeededForLevel,
    createEmptyInventorySlots,
    normalizeItemEntries,
    addItemsToInventory,
    syncPlayerCopperFromInventory,
    sendInventoryState,
    sendSelfProgress,
    clamp,
    normalizeDirection,
    clearPlayerCast,
    usePlayerAbility,
    levelUpPlayerAbility,
    tryPickupLootBag,
    mergeOrSwapInventorySlots,
    consumeInventoryItem,
    addHealOverTimeEffect,
    addManaOverTimeEffect,
    allocatePlayerId: () => String(nextPlayerId++)
  }
});

const gameLoop = createGameLoop({
  tickMs: TICK_MS,
  runTick: (now) => {
  tickPlayers();
  tickPlayerCasts(now);
  tickAreaEffects(now);
  tickMobs();
  tickProjectiles();
  tickLootBags(now);
  broadcastState(now);
  }
});
gameLoop.start();

initializeMobSpawners();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Initialized ${mobSpawners.size} mob spawners and ${mobs.size} mobs.`);
});
