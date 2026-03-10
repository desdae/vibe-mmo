const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { executeAbilityByKind } = require("./server/ability-handlers");
const { createAreaEffectTools } = require("./server/gameplay/area-effects");
const { createGameLoop } = require("./server/runtime/game-loop");
const { createDebouncedFileReloader } = require("./server/runtime/file-reload-watch");
const { createConfigOrchestrator } = require("./server/runtime/config-orchestrator");
const { createProjectileTickSystem } = require("./server/runtime/projectile-tick");
const { createPlayerTickSystem } = require("./server/runtime/player-tick");
const { createMobTickSystem } = require("./server/runtime/mob-tick");
const {
  createAbilityConfigLoader,
  createClassAbilityDefsBroadcaster
} = require("./server/runtime/config-helpers");
const { createRuntimeBootstrap } = require("./server/runtime/runtime-bootstrap");
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
const { loadAbilityConfigFromDisk } = require("./server/config/ability-config");
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
const { createNormalizeItemEntries, createDropRollTools } = require("./server/gameplay/drops");
const { createInventoryTools } = require("./server/gameplay/inventory");
const { createLootBagTools } = require("./server/gameplay/loot-bags");
const { createMobAbilityOverrideResolver } = require("./server/gameplay/mob-ability-overrides");
const { createMobAbilityTools } = require("./server/gameplay/mob-abilities");
const { createMobBehaviorTools } = require("./server/gameplay/mob-behavior");
const { createMobCombatTools } = require("./server/gameplay/mob-combat");
const { createMobLifecycleTools } = require("./server/gameplay/mob-lifecycle");
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
const { createPlayerCommandTools } = require("./server/gameplay/player-commands");
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
const abilityConfigLoader = createAbilityConfigLoader({
  loadAbilityConfigFromDisk,
  abilityConfigPath: ABILITY_CONFIG_PATH,
  defaultAbilityKind: DEFAULT_ABILITY_KIND,
  normalizeAbilityEntry,
  buildEmitProjectilesConfig
});
const loadAbilityConfig = abilityConfigLoader.loadAbilityConfig;

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
const normalizeItemEntries = createNormalizeItemEntries({
  itemDefs: ITEM_CONFIG.itemDefs
});
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
const dropRollTools = createDropRollTools({
  clamp,
  randomInt,
  normalizeItemEntries,
  getServerConfig: () => SERVER_CONFIG,
  getGlobalDropConfig: () => GLOBAL_DROP_CONFIG,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT
});
const rollDropRules = dropRollTools.rollDropRules;
const getDistanceFromCenter = dropRollTools.getDistanceFromCenter;
const rollGlobalDropsForPlayer = dropRollTools.rollGlobalDropsForPlayer;
const rollMobDrops = dropRollTools.rollMobDrops;

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
const classAbilityDefsBroadcaster = createClassAbilityDefsBroadcaster({
  players,
  sendJson,
  classConfigProvider: () => CLASS_CONFIG,
  abilityConfigProvider: () => ABILITY_CONFIG
});
const broadcastClassAndAbilityDefs = classAbilityDefsBroadcaster.broadcastClassAndAbilityDefs;

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
  resolvePlayerMobCollisions: (...args) => resolvePlayerMobCollisions(...args),
  getAbilityInvulnerabilityDurationMs
};

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

const mobLifecycleTools = createMobLifecycleTools({
  clamp,
  randomInt,
  randomPointInRadius,
  pickClusterDef,
  mobSpawners,
  mobs,
  players,
  clearMobCast: (...args) => clearMobCast(...args),
  queueMobDeathEvent,
  rollGlobalDropsForPlayer,
  rollMobDrops,
  createLootBag,
  normalizeItemEntries,
  grantPlayerExp,
  allocateMobId: () => nextMobId++,
  allocateSpawnerId: () => nextSpawnerId++,
  getServerConfig: () => SERVER_CONFIG,
  getMobConfig: () => MOB_CONFIG,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  targetMobClusters: TARGET_MOB_CLUSTERS,
  clusterAreaSize: CLUSTER_AREA_SIZE,
  maxClustersPerArea: MAX_CLUSTERS_PER_AREA
});
const createMob = mobLifecycleTools.createMob;
const initializeMobSpawners = mobLifecycleTools.initializeMobSpawners;
const killMob = mobLifecycleTools.killMob;
const respawnMob = mobLifecycleTools.respawnMob;

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
const playerCommandTools = createPlayerCommandTools({
  abilityDefsProvider: () => ABILITY_CONFIG.abilityDefs,
  executeAbilityByKind,
  abilityHandlerContext,
  getPlayerAbilityLevel,
  getAbilityCooldownPassed,
  normalizeDirection,
  playerHasMovementInput,
  clamp,
  distance,
  lootBags,
  bagPickupRange: BAG_PICKUP_RANGE,
  addItemsToInventory,
  sendInventoryState,
  syncPlayerCopperFromInventory,
  sendJson
});
const tryPickupLootBag = playerCommandTools.tryPickupLootBag;
const usePlayerAbility = playerCommandTools.usePlayerAbility;
const configOrchestrator = createConfigOrchestrator({
  paths: {
    serverConfigPath: SERVER_CONFIG_PATH,
    abilityConfigPath: ABILITY_CONFIG_PATH,
    classConfigPath: CLASS_CONFIG_PATH,
    mobConfigPath: MOB_CONFIG_PATH
  },
  loaders: {
    loadServerConfigFromDisk,
    formatServerConfigForLog,
    loadAbilityConfig,
    loadClassConfigFromDisk,
    loadMobConfigFromDisk
  },
  state: {
    getServerConfig: () => SERVER_CONFIG,
    setServerConfig: (nextConfig) => {
      SERVER_CONFIG = nextConfig;
    },
    getAbilityConfig: () => ABILITY_CONFIG,
    setAbilityConfig: (nextConfig) => {
      ABILITY_CONFIG = nextConfig;
    },
    setClassConfig: (nextConfig) => {
      CLASS_CONFIG = nextConfig;
    },
    setMobConfig: (nextConfig) => {
      MOB_CONFIG = nextConfig;
    }
  },
  constants: {
    basePlayerSpeed: BASE_PLAYER_SPEED,
    itemDefs: ITEM_CONFIG.itemDefs,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    mobCombatDefaults: {
      mobAggroRange: MOB_AGGRO_RANGE,
      mobAttackRange: MOB_ATTACK_RANGE,
      mobWanderRadius: MOB_WANDER_RADIUS,
      mobAttackCooldownMs: MOB_ATTACK_COOLDOWN_MS
    },
    normalizeItemEntries,
    clamp
  },
  runtime: {
    mobSpawners,
    mobs,
    pickClusterDef,
    clearMobCast,
    broadcastClassAndAbilityDefs
  },
  createDebouncedFileReloader
});
const watchServerConfig = configOrchestrator.watchServerConfig;
const watchAbilityConfig = configOrchestrator.watchAbilityConfig;
const watchMobConfig = configOrchestrator.watchMobConfig;
watchServerConfig();
watchAbilityConfig();
watchMobConfig();

const projectileRuntimeTools = createProjectileRuntimeTools({
  clamp,
  players,
  mobs,
  spawnProjectileFromTemplate,
  normalizeProjectileTargetType
});
const emitProjectilesFromEmitter = projectileRuntimeTools.emitProjectilesFromEmitter;
const getNearestProjectileTarget = projectileRuntimeTools.getNearestProjectileTarget;

const projectileTickSystem = createProjectileTickSystem({
  projectiles,
  players,
  mobs,
  tickMs: TICK_MS,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  clamp,
  distance,
  defaultProjectileHitRadius: DEFAULT_PROJECTILE_HIT_RADIUS,
  randomInt,
  queueProjectileHitEvent,
  queueExplosionEvent,
  applyDamageToPlayer,
  applyDamageToMob,
  applyProjectileHitEffectsToPlayer,
  applyProjectileHitEffects,
  emitProjectilesFromEmitter,
  getNearestProjectileTarget,
  normalizeDirection,
  steerDirectionTowards
});
const tickProjectiles = projectileTickSystem.tickProjectiles;

const playerTickSystem = createPlayerTickSystem({
  players,
  mobs,
  tickMs: TICK_MS,
  clamp,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  basePlayerSpeed: BASE_PLAYER_SPEED,
  tickPlayerHealEffects,
  tickPlayerManaEffects,
  tickPlayerDotEffects,
  clearPlayerCast,
  playerHasMovementInput,
  clearPlayerCombatEffects,
  abilityDefsProvider: () => ABILITY_CONFIG.abilityDefs,
  getPlayerAbilityLevel,
  getAbilityCooldownPassed,
  executeAbilityByKind,
  abilityHandlerContext,
  normalizeDirection,
  playerMobMinSeparation: PLAYER_MOB_MIN_SEPARATION,
  playerMobSeparationIterations: PLAYER_MOB_SEPARATION_ITERATIONS
});
const tickPlayers = playerTickSystem.tickPlayers;
const tickPlayerCasts = playerTickSystem.tickPlayerCasts;
const resolvePlayerMobCollisions = playerTickSystem.resolvePlayerMobCollisions;
const resolveAllPlayersAgainstMobs = playerTickSystem.resolveAllPlayersAgainstMobs;

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
const mobTickSystem = createMobTickSystem({
  mobs,
  players,
  tickMs: TICK_MS,
  mobWanderRadius: MOB_WANDER_RADIUS,
  mobProvokedLeashRadius: MOB_PROVOKED_LEASH_RADIUS,
  mobAggroRange: MOB_AGGRO_RANGE,
  mobAttackRange: MOB_ATTACK_RANGE,
  mobMinSeparation: MOB_MIN_SEPARATION,
  mobSeparationIterations: MOB_SEPARATION_ITERATIONS,
  randomInt,
  randomPointInRadius,
  distance,
  normalizeDirection,
  clampToSpawnRadius,
  respawnMob,
  tickMobDotEffects,
  clearMobCast,
  completeMobAbilityCast,
  getMobMoveSpeed,
  getMobDistanceFromSpawn,
  hasActiveProvokedChase,
  startMobReturnToSpawn,
  getMobCombatProfile,
  getNearestAggroPlayer,
  tryMobCastConfiguredAbility,
  tryMobBasicAttack,
  getMobLeashRadius,
  resolveAllPlayersAgainstMobs
});
const tickMobs = mobTickSystem.tickMobs;

const runtimeBootstrap = createRuntimeBootstrap({
  createEntityUpdatePacketBuilder,
  createStateBroadcaster,
  createGameLoop,
  registerWsConnections,
  wss,
  wsDeps: {
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
  },
  entityUpdateDeps: {
    getPendingHealAmount,
    getPendingManaAmount,
    serializeBagItemsForMeta
  },
  stateBroadcastDeps: {
    players,
    projectiles,
    mobs,
    lootBags,
    VISIBILITY_RANGE,
    inVisibilityRange,
    serializePlayer,
    serializeMob,
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
  },
  tickMs: TICK_MS,
  tickHandlers: {
    tickPlayers,
    tickPlayerCasts,
    tickAreaEffects,
    tickMobs,
    tickProjectiles,
    tickLootBags
  },
  initializeMobSpawners,
  server,
  port: PORT,
  onServerListening: () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Initialized ${mobSpawners.size} mob spawners and ${mobs.size} mobs.`);
  }
});
runtimeBootstrap.start();
