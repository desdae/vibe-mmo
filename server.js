const fs = require("fs");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const townLayoutTools = require("./public/shared/town-layout");
const { executeAbilityByKind } = require("./server/ability-handlers");
const { createAbilityHandlerContext } = require("./server/ability-handlers/context");
const { createAreaEffectTools } = require("./server/gameplay/area-effects");
const { createGameLoop } = require("./server/runtime/game-loop");
const { createDebouncedFileReloader } = require("./server/runtime/file-reload-watch");
const { createConfigOrchestrator } = require("./server/runtime/config-orchestrator");
const { startConfigWatchers } = require("./server/runtime/config-watch");
const { createProjectileTickSystem } = require("./server/runtime/projectile-tick");
const { createPlayerTickSystem } = require("./server/runtime/player-tick");
const { createMobTickSystem } = require("./server/runtime/mob-tick");
const { createWorldState } = require("./server/runtime/world-state");
const {
  createAbilityConfigLoader,
  createClassAbilityDefsBroadcaster
} = require("./server/runtime/config-helpers");
const { createRuntimeBootstrap } = require("./server/runtime/runtime-bootstrap");
const { createBenchmarkSceneTools } = require("./server/runtime/benchmark-scene");
const { sendJson, sendBinary } = require("./server/network/transport");
const { registerWsConnections } = require("./server/network/ws-connections");
const { createStateBroadcaster } = require("./server/network/state-broadcast");
const { createGameHttpServer } = require("./server/network/http-server");
const { createSoundManifestBuilder } = require("./server/network/sound-manifest");
const { createPlayerVisibilityTools } = require("./server/network/player-visibility");
const { createEntityUpdatePacketBuilder } = require("./server/network/entity-update-packet");
const { serializePlayer, serializeMob, serializeLootBag } = require("./server/network/entity-serializers");
const { createEventBuilders } = require("./server/network/event-builders");
const { createAreaEffectEventBuilder } = require("./server/network/area-effect-events");
const { createWsConnectionDeps } = require("./server/network/ws-deps");
const { createWorldEventQueues } = require("./server/network/world-events");
const {
  buildServerConfig,
  loadServerConfigFromDisk,
  formatServerConfigForLog
} = require("./server/config/server-config");
const { loadGameplayRuntimeConfig } = require("./server/config/gameplay-runtime");
const { loadItemConfigFromDisk } = require("./server/config/item-config");
const { loadEquipmentConfigFromDisk } = require("./server/config/equipment-config");
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
const { createLootBagTools } = require("./server/gameplay/loot-bags");
const { createMobAbilityOverrideResolver } = require("./server/gameplay/mob-ability-overrides");
const { createMobAbilityTools } = require("./server/gameplay/mob-abilities");
const { createMobBehaviorTools } = require("./server/gameplay/mob-behavior");
const { createMobCombatTools } = require("./server/gameplay/mob-combat");
const { createMobLifecycleTools } = require("./server/gameplay/mob-lifecycle");
const { createMobScalingTools } = require("./server/gameplay/mob-scaling");
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
const { createPlayerFactory } = require("./server/gameplay/player-factory");
const { createEquipmentTools } = require("./server/gameplay/equipment");
const { createPlayerBuffTools } = require("./server/gameplay/player-buffs");
const { createVendorTools } = require("./server/gameplay/vendor");
const { createNormalizeItemEntries } = require("./server/gameplay/drops");
const { createCoreServices } = require("./server/runtime/core-services");
const { createBotTickSystem } = require("./server/runtime/bot-tick");
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
  encodePlayerMetaPacket,
  encodeLootBagMetaPacket,
  encodePlayerSwingPacket,
  encodeCastEventPacket,
  encodePlayerEffectPacket,
  encodeMobBitePacket,
  encodeExplosionEventPacket,
  encodeProjectileHitEventPacket,
  encodeMobDeathEventPacket,
  encodeDamageEventPacket
} = require("./server/network/packet-encoders");

const PORT = process.env.PORT || 3000;
const APP_MODE = String(process.env.APP_MODE || process.env.NODE_ENV || "development").trim().toLowerCase();
const IS_PROD_MODE = APP_MODE === "prod" || APP_MODE === "production";
const MOB_CONFIG_PATH = path.join(__dirname, "data", "mobs.json");
const ITEM_CONFIG_PATH = path.join(__dirname, "data", "items.json");
const GLOBAL_DROP_TABLE_PATH = path.join(__dirname, "data", "drop-tables.json");
const SERVER_CONFIG_PATH = path.join(__dirname, "config", "server.json");
const GAMEPLAY_CONFIG_PATH = path.join(__dirname, "config", "gameplay.json");
const CLASS_CONFIG_PATH = path.join(__dirname, "data", "classes.json");
const ABILITY_CONFIG_PATH = path.join(__dirname, "data", "abilities.json");
const EQUIPMENT_CONFIG_PATH = path.join(__dirname, "data", "equipment.json");
const TALENT_CONFIG_PATH = path.join(__dirname, "data", "talents.json");

const gameplayRuntime = loadGameplayRuntimeConfig(GAMEPLAY_CONFIG_PATH);
const GAMEPLAY_CONFIG = gameplayRuntime.gameplayConfig;
const {
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  visibilityRange: VISIBILITY_RANGE,
  maxViewportWidth: MAX_VIEWPORT_WIDTH,
  maxViewportHeight: MAX_VIEWPORT_HEIGHT,
  visibilityPaddingTiles: VISIBILITY_PADDING_TILES,
  townConfig: TOWN_CONFIG,
  tickMs: TICK_MS,
  basePlayerSpeed: BASE_PLAYER_SPEED,
  targetMobClusters: TARGET_MOB_CLUSTERS,
  clusterAreaSize: CLUSTER_AREA_SIZE,
  maxClustersPerArea: MAX_CLUSTERS_PER_AREA,
  mobWanderRadius: MOB_WANDER_RADIUS,
  mobProvokedLeashRadius: MOB_PROVOKED_LEASH_RADIUS,
  mobProvokedChaseMs: MOB_PROVOKED_CHASE_MS,
  mobAggroRange: MOB_AGGRO_RANGE,
  mobAttackRange: MOB_ATTACK_RANGE,
  mobAttackCooldownMs: MOB_ATTACK_COOLDOWN_MS,
  mobMinSeparation: MOB_MIN_SEPARATION,
  mobSeparationIterations: MOB_SEPARATION_ITERATIONS,
  playerMobMinSeparation: PLAYER_MOB_MIN_SEPARATION,
  playerMobSeparationIterations: PLAYER_MOB_SEPARATION_ITERATIONS,
  baseExpToNext: BASE_EXP_TO_NEXT,
  expGrowthFactor: EXP_GROWTH_FACTOR,
  defaultProjectileHitRadius: DEFAULT_PROJECTILE_HIT_RADIUS,
  bagPickupRange: BAG_PICKUP_RANGE,
  bagClickRange: BAG_CLICK_RANGE,
  bagDespawnMs: BAG_DESPAWN_MS,
  inventoryCols: INVENTORY_COLS,
  inventoryRows: INVENTORY_ROWS,
  inventorySlotCount: INVENTORY_SLOT_COUNT,
  copperItemId: ITEM_COPPER_ID,
  minSpawnRadiusFromCenter: MIN_SPAWN_RADIUS_FROM_CENTER,
  observedSpawnPadding: OBSERVED_SPAWN_PADDING,
  unobservedDespawnMs: UNOBSERVED_DESPAWN_MS,
  mobBaseLevel: MOB_BASE_LEVEL,
  mobLevelStartDistance: MOB_LEVEL_START_DISTANCE,
  mobLevelDistance: MOB_LEVEL_DISTANCE,
  mobLevelDistanceStep: MOB_LEVEL_DISTANCE_STEP,
  mobLevelHealthMultiplier: MOB_LEVEL_HEALTH_MULTIPLIER,
  mobLevelDamageMultiplier: MOB_LEVEL_DAMAGE_MULTIPLIER,
  mobLevelSpeedMultiplier: MOB_LEVEL_SPEED_MULTIPLIER
} = gameplayRuntime.constants;
const DEFAULT_ABILITY_KIND = "meleeCone";

const publicDir = path.join(__dirname, "public");
const computeTownLayout =
  typeof townLayoutTools.computeTownLayout === "function" ? townLayoutTools.computeTownLayout : () => null;
const serializeTownLayout =
  typeof townLayoutTools.serializeTownLayout === "function" ? townLayoutTools.serializeTownLayout : () => null;
const isPointInTown =
  typeof townLayoutTools.isPointInTown === "function" ? townLayoutTools.isPointInTown : () => false;
const isPointBlockedByTownWall =
  typeof townLayoutTools.isPointBlockedByTownWall === "function"
    ? townLayoutTools.isPointBlockedByTownWall
    : () => false;
const TOWN_LAYOUT = computeTownLayout(MAP_WIDTH, MAP_HEIGHT, TOWN_CONFIG);

function randomTownInteriorSpawn() {
  if (!TOWN_LAYOUT || TOWN_LAYOUT.enabled === false) {
    return null;
  }
  const inset = Math.max(1, Math.floor(Number(TOWN_LAYOUT.wallThickness) || 1));
  const minTileX = Math.min(TOWN_LAYOUT.maxTileX, TOWN_LAYOUT.minTileX + inset);
  const maxTileX = Math.max(minTileX, TOWN_LAYOUT.maxTileX - inset);
  const minTileY = Math.min(TOWN_LAYOUT.maxTileY, TOWN_LAYOUT.minTileY + inset);
  const maxTileY = Math.max(minTileY, TOWN_LAYOUT.maxTileY - inset);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const tileX = minTileX + Math.floor(Math.random() * (maxTileX - minTileX + 1));
    const tileY = minTileY + Math.floor(Math.random() * (maxTileY - minTileY + 1));
    const spawn = {
      x: clamp(tileX + 0.5, 0, MAP_WIDTH - 1),
      y: clamp(tileY + 0.5, 0, MAP_HEIGHT - 1)
    };
    if (!isPointBlockedByTownWall(TOWN_LAYOUT, spawn.x, spawn.y)) {
      return spawn;
    }
  }
  const vendor = TOWN_LAYOUT.vendor || null;
  return vendor
    ? {
        x: clamp(Number(vendor.x) + 0.5, 0, MAP_WIDTH - 1),
        y: clamp(Number(vendor.y) + 0.5, 0, MAP_HEIGHT - 1)
      }
    : null;
}

function mergeEquipmentItemDefsIntoItemConfig(itemConfig, equipmentConfig) {
  if (!itemConfig || !equipmentConfig) {
    return;
  }
  for (const entry of Array.isArray(equipmentConfig.equipmentItemDefs) ? equipmentConfig.equipmentItemDefs : []) {
    if (!entry || !entry.id || itemConfig.itemDefs.has(entry.id)) {
      continue;
    }
    itemConfig.itemDefs.set(entry.id, entry);
    itemConfig.clientItemDefs.push(entry);
  }
  itemConfig.clientEquipmentConfig = equipmentConfig.clientEquipmentConfig;
}
const preferredIndexFileName = IS_PROD_MODE ? "index.prod.html" : "index.dev.html";
const selectedIndexFileName = fs.existsSync(path.join(publicDir, preferredIndexFileName))
  ? preferredIndexFileName
  : "index.dev.html";
if (IS_PROD_MODE && selectedIndexFileName !== preferredIndexFileName) {
  console.warn("[server] Missing public/index.prod.html, falling back to index.dev.html");
}
const buildSoundManifest = createSoundManifestBuilder({ publicDir });
const playerVisibilityTools = createPlayerVisibilityTools({
  defaultVisibilityRange: VISIBILITY_RANGE,
  maxViewportWidth: MAX_VIEWPORT_WIDTH,
  maxViewportHeight: MAX_VIEWPORT_HEIGHT,
  visibilityPaddingTiles: VISIBILITY_PADDING_TILES,
  tileSize: 32
});
const getPlayerVisibilityExtents = playerVisibilityTools.getPlayerVisibilityExtents;
const updatePlayerViewport = playerVisibilityTools.updatePlayerViewport;

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
const randomSpawn = () => randomTownInteriorSpawn() || spatialTools.randomSpawn();
const inVisibilityRange = spatialTools.inVisibilityRange;

const ITEM_CONFIG = loadItemConfigFromDisk(ITEM_CONFIG_PATH);
const EQUIPMENT_CONFIG = loadEquipmentConfigFromDisk(EQUIPMENT_CONFIG_PATH);
mergeEquipmentItemDefsIntoItemConfig(ITEM_CONFIG, EQUIPMENT_CONFIG);
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
let GLOBAL_DROP_CONFIG = { entries: [] };
let ABILITY_CONFIG = loadAbilityConfig();
const normalizeItemEntries = createNormalizeItemEntries({ itemDefs: ITEM_CONFIG.itemDefs });
let CLASS_CONFIG = loadClassConfigFromDisk(
  CLASS_CONFIG_PATH,
  ABILITY_CONFIG.abilityDefs,
  ITEM_CONFIG.itemDefs,
  BASE_PLAYER_SPEED,
  normalizeItemEntries
);
const coreServices = createCoreServices({
  sendJson,
  itemDefs: ITEM_CONFIG.itemDefs,
  equipmentSlotIds: EQUIPMENT_CONFIG.equipmentSlotIds,
  inventoryCols: INVENTORY_COLS,
  inventoryRows: INVENTORY_ROWS,
  inventorySlotCount: INVENTORY_SLOT_COUNT,
  copperItemId: ITEM_COPPER_ID,
  baseExpToNext: BASE_EXP_TO_NEXT,
  expGrowthFactor: EXP_GROWTH_FACTOR,
  getExpMultiplier: () => Number(SERVER_CONFIG?.expMultiplier) || 1,
  tickMs: TICK_MS,
  clamp,
  randomInt,
  getServerConfig: () => SERVER_CONFIG,
  getGlobalDropConfig: () => GLOBAL_DROP_CONFIG,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  talentConfigPath: TALENT_CONFIG_PATH,
  classConfig: CLASS_CONFIG.classDefs
});
const sendSelfProgress = coreServices.sendSelfProgress;
const sendInventoryState = coreServices.sendInventoryState;
const sendEquipmentState = coreServices.sendEquipmentState;
const serializeBagItemsForMeta = coreServices.serializeBagItemsForMeta;
const createEmptyInventorySlots = coreServices.createEmptyInventorySlots;
const addItemsToInventory = coreServices.addItemsToInventory;
const mergeOrSwapInventorySlots = coreServices.mergeOrSwapInventorySlots;
const consumeInventoryItem = coreServices.consumeInventoryItem;
const syncPlayerCopperFromInventory = coreServices.syncPlayerCopperFromInventory;
const expNeededForLevel = coreServices.expNeededForLevel;
const grantPlayerExp = coreServices.grantPlayerExp;
const getPendingHealAmount = coreServices.getPendingHealAmount;
const getPendingManaAmount = coreServices.getPendingManaAmount;
const addHealOverTimeEffect = coreServices.addHealOverTimeEffect;
const addManaOverTimeEffect = coreServices.addManaOverTimeEffect;
const tickPlayerHealEffects = coreServices.tickPlayerHealEffects;
const tickPlayerManaEffects = coreServices.tickPlayerManaEffects;
const rollDropRules = coreServices.rollDropRules;
const getDistanceFromCenter = coreServices.getDistanceFromCenter;
const rollGlobalDropsForPlayer = coreServices.rollGlobalDropsForPlayer;
const rollMobDrops = coreServices.rollMobDrops;

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
GLOBAL_DROP_CONFIG = loadGlobalDropTableConfigFromDisk(
  GLOBAL_DROP_TABLE_PATH,
  ITEM_CONFIG.itemDefs,
  MAP_WIDTH,
  MAP_HEIGHT
);

const server = createGameHttpServer({
  http,
  publicDir,
  indexFileName: selectedIndexFileName,
  getGameConfigPayload: () => ({
    classes: CLASS_CONFIG.clientClassDefs,
    abilities: ABILITY_CONFIG.clientAbilityDefs,
    items: ITEM_CONFIG.clientItemDefs,
    equipment: ITEM_CONFIG.clientEquipmentConfig,
    gameplay: {
      audio: GAMEPLAY_CONFIG.audio,
      loot: GAMEPLAY_CONFIG.loot,
      town: serializeTownLayout(TOWN_LAYOUT)
    },
    sounds: buildSoundManifest()
  })
});

const wss = new WebSocketServer({ server });

const worldState = createWorldState();
const players = worldState.players;
const projectiles = worldState.projectiles;
const mobSpawners = worldState.mobSpawners;
const mobs = worldState.mobs;
const lootBags = worldState.lootBags;
const activeAreaEffects = worldState.activeAreaEffects;
const allocatePlayerId = worldState.allocatePlayerId;
const allocateProjectileId = worldState.allocateProjectileId;
const allocateSpawnerId = worldState.allocateSpawnerId;
const allocateMobId = worldState.allocateMobId;
const allocateLootBagId = worldState.allocateLootBagId;
const allocateAreaEffectId = worldState.allocateAreaEffectId;
const allocateItemInstanceId = worldState.allocateItemInstanceId;
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

const equipmentTools = createEquipmentTools({
  equipmentConfigProvider: () => EQUIPMENT_CONFIG,
  getServerConfig: () => SERVER_CONFIG,
  getTalentStats: (player) => coreServices.talentSystem?.calculateTalentStats(player.classType, player.talents) || {},
  getTalentBuffStats: () => ({}),  // Will be updated after talentEffectTools created
  allocateItemInstanceId,
  randomInt,
  clamp,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  getAbilityDamageRange,
  getAbilityDotDamageRange
});
const createEmptyEquipmentSlots = equipmentTools.createEmptyEquipmentSlots;
const rollEquipmentItemAt = equipmentTools.rollEquipmentItemAt;
const rollEquipmentDropsAt = equipmentTools.rollEquipmentDropsAt;
const getPlayerModifiedAbilityDamageRange = equipmentTools.getPlayerModifiedAbilityDamageRange;
const getPlayerModifiedAbilityDotDamageRange = equipmentTools.getPlayerModifiedAbilityDotDamageRange;
const getPlayerModifiedAbilityChainStats = equipmentTools.getPlayerModifiedAbilityChainStats;
const getPlayerModifiedAbilityRangeForLevel = equipmentTools.getPlayerModifiedAbilityRangeForLevel;
const getPlayerModifiedAbilityCooldownMs = equipmentTools.getPlayerModifiedAbilityCooldownMs;
const getPlayerModifiedAbilityCastMs = equipmentTools.getPlayerModifiedAbilityCastMs;
const createEquipmentEntryFromBaseItem = equipmentTools.createEquipmentEntryFromBaseItem;
const equipInventoryItem = equipmentTools.equipInventoryItem;
const unequipEquipmentItem = equipmentTools.unequipEquipmentItem;
const vendorTools = createVendorTools({
  townLayout: TOWN_LAYOUT,
  itemDefs: ITEM_CONFIG.itemDefs,
  equipmentConfigProvider: () => EQUIPMENT_CONFIG,
  addItemsToInventory,
  sendInventoryState,
  syncPlayerCopperFromInventory,
  sendSelfProgress,
  sendJson,
  copperItemId: ITEM_COPPER_ID
});
const getVendorNpc = vendorTools.getVendorNpc;
const isPlayerNearVendor = vendorTools.isPlayerNearVendor;
const getInventoryEntrySellValue = vendorTools.getInventoryEntrySellValue;
const sellInventoryItemToVendor = vendorTools.sellInventoryItemToVendor;
const playerFactory = createPlayerFactory({
  classConfigProvider: () => CLASS_CONFIG,
  allocatePlayerId,
  createEmptyInventorySlots,
  createEmptyEquipmentSlots,
  normalizeItemEntries,
  addItemsToInventory,
  createEquipmentEntryFromBaseItem,
  recomputePlayerDerivedStats: equipmentTools.recomputePlayerDerivedStats,
  syncPlayerCopperFromInventory,
  expNeededForLevel,
  sanitizeSpawn: (spawn) => {
    if (!isPointBlockedByTownWall(TOWN_LAYOUT, spawn && spawn.x, spawn && spawn.y)) {
      return spawn;
    }
    const vendor = getVendorNpc();
    return vendor ? { x: vendor.x, y: vendor.y } : spawn;
  },
  defaultVisibilityRange: VISIBILITY_RANGE,
  players
});
const createPlayer = playerFactory.createPlayer;

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

function getPlayerTalentAbilityMods(player) {
  if (!player || !player.classType || !coreServices.talentSystem) {
    return null;
  }
  const stats = coreServices.talentSystem.calculateTalentStats(player.classType, player.talents);
  const mods = stats && typeof stats === "object" ? stats.abilityMods : null;
  return mods && typeof mods === "object" ? mods : null;
}

function getAbilityModNumber(mods, key, abilityId) {
  if (!mods || typeof mods !== "object") {
    return 0;
  }
  const bucket = mods[key] && typeof mods[key] === "object" ? mods[key] : null;
  if (!bucket) {
    return 0;
  }
  const id = String(abilityId || "").trim();
  if (!id) {
    return 0;
  }
  const value = Number(bucket[id]) || 0;
  return Number.isFinite(value) ? value : 0;
}

function getAbilityModStatMap(mods, abilityId) {
  if (!mods || typeof mods !== "object") {
    return null;
  }
  const bucket = mods.statBonus && typeof mods.statBonus === "object" ? mods.statBonus : null;
  if (!bucket) {
    return null;
  }
  const id = String(abilityId || "").trim();
  if (!id) {
    return null;
  }
  const statMap = bucket[id];
  return statMap && typeof statMap === "object" ? statMap : null;
}

function buildAbilityDefForPlayer(player, abilityDef, abilityLevel) {
  if (!player || !abilityDef) {
    return abilityDef;
  }
  const mods = getPlayerTalentAbilityMods(player);
  if (!mods) {
    return abilityDef;
  }

  const abilityId = String(abilityDef.id || "").trim();
  if (!abilityId) {
    return abilityDef;
  }

  const stunBonusMs = getAbilityModNumber(mods, "stunDurationBonusMs", abilityId);
  const statBonus = getAbilityModStatMap(mods, abilityId);
  const ccImmunityMs = getAbilityModNumber(mods, "crowdControlImmunityMs", abilityId);
  const damageBonusPercent = getAbilityModNumber(mods, "damageBonusPercent", abilityId);

  const kind = String(abilityDef.kind || "").trim().toLowerCase();
  const isSelfBuff = kind === "selfbuff";

  const needsStunOverride = stunBonusMs !== 0;
  const needsBuffOverride =
    isSelfBuff && ((statBonus && Object.keys(statBonus).length > 0) || ccImmunityMs > 0 || damageBonusPercent !== 0);
  if (!needsStunOverride && !needsBuffOverride) {
    return abilityDef;
  }

  const overrides = {};
  if (needsStunOverride) {
    overrides.stunDurationMs = Math.max(0, Math.floor((Number(abilityDef.stunDurationMs) || 0) + stunBonusMs));
  }

  if (needsBuffOverride) {
    const baseBuffEffects = Array.isArray(abilityDef.buffEffects) ? abilityDef.buffEffects : [];
    const nextBuffEffects = baseBuffEffects.map((effect) => {
      const safe = effect && typeof effect === "object" ? effect : {};
      const nextStats = safe.stats && typeof safe.stats === "object" ? { ...safe.stats } : {};

      if (statBonus) {
        for (const [statKey, value] of Object.entries(statBonus)) {
          const key = String(statKey || "").trim();
          const delta = Number(value) || 0;
          if (!key || !Number.isFinite(delta) || delta === 0) {
            continue;
          }
          nextStats[key] = (Number(nextStats[key]) || 0) + delta;
        }
      }

      // For self-buff abilities, interpret ability damage bonuses as a temporary global damage bonus for the buff duration.
      if (damageBonusPercent !== 0) {
        nextStats["damage.global.percent"] = (Number(nextStats["damage.global.percent"]) || 0) + damageBonusPercent;
      }

      return {
        ...safe,
        stats: nextStats
      };
    });

    if (ccImmunityMs > 0) {
      nextBuffEffects.push({
        id: `${abilityId}:ccImmunity`,
        name: "Crowd Control Immunity",
        label: "IMM",
        color: "rgba(245, 224, 161, 0.96)",
        durationMs: Math.max(1, Math.floor(ccImmunityMs)),
        stats: {
          crowdControlImmune: true
        }
      });
    }

    overrides.buffEffects = nextBuffEffects;
  }

  return {
    ...abilityDef,
    ...overrides
  };
}

const abilityHandlerContext = createAbilityHandlerContext({
  players,
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
  getAbilityRangeForEntity: (entity, abilityDef, abilityLevel) =>
    entity && entity.entityType === "player"
      ? getPlayerModifiedAbilityRangeForLevel(entity, abilityDef, abilityLevel, getAbilityRangeForLevel)
      : getAbilityRangeForLevel(abilityDef, abilityLevel),
  getAbilityDamageRange,
  getAbilityDamageRangeForEntity: (entity, abilityDef, abilityLevel) =>
    entity && entity.entityType === "player"
      ? getPlayerModifiedAbilityDamageRange(entity, abilityDef, abilityLevel)
      : getAbilityDamageRange(abilityDef, abilityLevel),
  getAbilityDotDamageRange,
  getAbilityDotDamageRangeForEntity: (entity, abilityDef, abilityLevel) =>
    entity && entity.entityType === "player"
      ? getPlayerModifiedAbilityDotDamageRange(entity, abilityDef, abilityLevel)
      : getAbilityDotDamageRange(abilityDef, abilityLevel),
  getAbilityChainStatsForEntity: (entity, abilityDef, abilityLevel) =>
    entity && entity.entityType === "player"
      ? getPlayerModifiedAbilityChainStats(entity, abilityDef, abilityLevel)
      : { jumpCountBonus: 0, jumpDamageReductionPercent: 0 },
  getAbilityDefForEntity: (entity, abilityDef, abilityLevel) =>
    entity && entity.entityType === "player" ? buildAbilityDefForPlayer(entity, abilityDef, abilityLevel) : abilityDef,
  markAbilityUsed: (...args) => markAbilityUsed(...args),
  applyDamageToMob: (...args) => applyDamageToMob(...args),
  applyAbilityHitEffectsToMob: (...args) => applyAbilityHitEffectsToMob(...args),
  applyDamageToPlayer: (...args) => applyDamageToPlayer(...args),
  stunMob: (...args) => stunMob(...args),
  stunPlayer: (...args) => stunPlayer(...args),
  queueExplosionEvent,
  getAreaAbilityTargetPosition: (...args) => getAreaAbilityTargetPosition(...args),
  createPersistentAreaEffect: (...args) => createPersistentAreaEffect(...args),
  createPersistentBeamEffect: (...args) => createPersistentBeamEffect(...args),
  createPersistentSummonEffect: (...args) => createPersistentSummonEffect(...args),
  resolvePlayerMobCollisions: (...args) => resolvePlayerMobCollisions(...args),
  applySelfBuffs: (...args) => applyAbilityBuffsToPlayer(...args),
  getAbilityInvulnerabilityDurationMs,
  isPlayerEnemy: (...args) => isPlayerEnemy(...args)
});

const lootBagTools = createLootBagTools({
  normalizeItemEntries,
  clamp,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  bagDespawnMs: BAG_DESPAWN_MS,
  lootBags,
  allocateLootBagId
});
const createLootBag = lootBagTools.createLootBag;
const tickLootBags = lootBagTools.tickLootBags;

const mobScalingTools = createMobScalingTools({
  baseLevel: MOB_BASE_LEVEL,
  levelStartDistance: MOB_LEVEL_START_DISTANCE,
  levelDistance: MOB_LEVEL_DISTANCE,
  levelDistanceStep: MOB_LEVEL_DISTANCE_STEP,
  healthMultiplierPerLevel: MOB_LEVEL_HEALTH_MULTIPLIER,
  damageMultiplierPerLevel: MOB_LEVEL_DAMAGE_MULTIPLIER,
  speedMultiplierPerLevel: MOB_LEVEL_SPEED_MULTIPLIER
});
const getMobLevelForDistance = mobScalingTools.getMobLevelForDistance;
const applyScaledStatsToMob = mobScalingTools.applyScaledStatsToMob;
const scaleDamageRangeForMob = mobScalingTools.scaleDamageRangeForMob;

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
  rollEquipmentDropsAt,
  createLootBag,
  normalizeItemEntries,
  grantPlayerExp,
  allocateMobId,
  allocateSpawnerId,
  getServerConfig: () => SERVER_CONFIG,
  getMobConfig: () => MOB_CONFIG,
  townLayout: TOWN_LAYOUT,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  targetMobClusters: TARGET_MOB_CLUSTERS,
  clusterAreaSize: CLUSTER_AREA_SIZE,
  maxClustersPerArea: MAX_CLUSTERS_PER_AREA,
  visibilityRange: VISIBILITY_RANGE,
  observedSpawnPadding: OBSERVED_SPAWN_PADDING,
  minSpawnRadiusFromCenter: MIN_SPAWN_RADIUS_FROM_CENTER,
  unobservedDespawnMs: UNOBSERVED_DESPAWN_MS,
  getMobLevelForDistance,
  applyScaledStatsToMob
});
const createMob = mobLifecycleTools.createMob;
const initializeMobSpawners = mobLifecycleTools.initializeMobSpawners;
const ensureObservedSpawnerCoverage = mobLifecycleTools.ensureObservedSpawnerCoverage;
const refreshMobObservation = mobLifecycleTools.refreshMobObservation;
const despawnUnobservedMobs = mobLifecycleTools.despawnUnobservedMobs;
const killMob = mobLifecycleTools.killMob;
const respawnMob = mobLifecycleTools.respawnMob;
const isSpawnerObserved = mobLifecycleTools.isSpawnerObserved;
const getAliveMobCount = mobLifecycleTools.getAliveMobCount;

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
  clearPlayerCombatEffects: (...args) => clearPlayerCombatEffects(...args),
  getPlayerById: (playerId) => players.get(String(playerId || "")) || null,
  clamp
});
const applyDamageToMob = damageTools.applyDamageToMob;
const applyDamageToPlayer = damageTools.applyDamageToPlayer;
const mobCombatEffectTools = createMobCombatEffectTools({
  clamp,
  randomInt,
  applyDamageToMob,
  getAbilityDotDamageRange,
  getPlayerById: (playerId) => players.get(String(playerId || "")) || null
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
  applyDotToMob,
  getPlayerById: (playerId) => players.get(String(playerId || "")) || null
});
const applyProjectileHitEffects = projectileEffectTools.applyProjectileHitEffects;
const areaEffectTools = createAreaEffectTools({
  clamp,
  normalizeDirection,
  queueExplosionEvent,
  allocateAreaEffectId,
  activeAreaEffects,
  mobs,
  randomInt,
  applyDamageToMob,
  applyDotToMob,
  applySlowToMob,
  spawnProjectileFromTemplate,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT
});
const getAreaAbilityTargetPosition = areaEffectTools.getAreaAbilityTargetPosition;
const createPersistentAreaEffect = areaEffectTools.createPersistentAreaEffect;
const createPersistentBeamEffect = areaEffectTools.createPersistentBeamEffect;
const createPersistentSummonEffect = areaEffectTools.createPersistentSummonEffect;
const tickAreaEffects = areaEffectTools.tickAreaEffects;

const playerAbilityTools = createPlayerAbilityTools({
  clamp,
  getClassDefs: () => CLASS_CONFIG.classDefs,
  getAbilityDefs: () => ABILITY_CONFIG.abilityDefs
});
const getPlayerClassDef = playerAbilityTools.getPlayerClassDef;
const getPlayerAbilityLevel = playerAbilityTools.getPlayerAbilityLevel;
const levelUpPlayerAbility = playerAbilityTools.levelUpPlayerAbility;
const playerBuffTools = createPlayerBuffTools({
  clamp,
  recomputePlayerDerivedStats: equipmentTools.recomputePlayerDerivedStats
});
const applyAbilityBuffsToPlayer = playerBuffTools.applyAbilityBuffsToPlayer;
const tickPlayerBuffs = playerBuffTools.tickPlayerBuffs;
const clearPlayerBuffs = playerBuffTools.clearPlayerBuffs;

const playerCombatEffectTools = createPlayerCombatEffectTools({
  clamp,
  randomInt,
  applyDamageToPlayer,
  getAbilityDotDamageRange,
  getPlayerById: (playerId) => players.get(String(playerId || "")) || null
});
const clearPlayerCombatEffects = playerCombatEffectTools.clearPlayerCombatEffects;
const tickPlayerDotEffects = playerCombatEffectTools.tickPlayerDotEffects;
const applyAbilityHitEffectsToPlayer = playerCombatEffectTools.applyAbilityHitEffectsToPlayer;
const applyProjectileHitEffectsToPlayer = playerCombatEffectTools.applyProjectileHitEffectsToPlayer;
const stunPlayer = playerCombatEffectTools.stunPlayer;
const applySlowToPlayer = playerCombatEffectTools.applySlowToPlayer;

// Create talent effect tools after combat tools are available
const { createTalentEffectTools } = require("./server/gameplay/talent-effects");
const talentEffectTools = createTalentEffectTools({
  randomInt,
  clamp,
  talentSystem: coreServices.talentSystem,
  stunMob,
  stunPlayer,
  applySlowToMob,
  applySlowToPlayer,
  recomputePlayerDerivedStats: equipmentTools.recomputePlayerDerivedStats
});
const onTalentSpellHit = talentEffectTools.onTalentSpellHit;
const onTalentKill = talentEffectTools.onTalentKill;
const onTalentDamageDealt = talentEffectTools.onTalentDamageDealt;
const tickTalentBuffs = talentEffectTools.tickTalentBuffs;
const getTalentBuffStats = talentEffectTools.getTalentBuffStats;

// Update equipment tools with actual getTalentBuffStats
equipmentTools.getTalentBuffStats = getTalentBuffStats;

// Wire up talent effects in damage and combat tools
damageTools.onTalentSpellHit = onTalentSpellHit;
damageTools.onTalentKill = onTalentKill;
damageTools.onTalentDamageDealt = onTalentDamageDealt;
mobCombatEffectTools.onTalentSpellHit = onTalentSpellHit;
playerCombatEffectTools.onTalentSpellHit = onTalentSpellHit;
projectileEffectTools.onTalentSpellHit = onTalentSpellHit;
const notifyAbilityUsed = (player, abilityDef, now = Date.now()) => {
  if (!player || !player.ws || typeof sendJson !== "function" || !abilityDef) {
    return;
  }
  sendJson(player.ws, {
    type: "ability_used",
    abilityId: String(abilityDef.id || ""),
    usedAt: Math.max(0, Math.floor(Number(now) || Date.now()))
  });
};
const castingTools = createCastingTools({
  getAbilityCooldownMsForLevel
});
const markAbilityUsed = castingTools.markAbilityUsed;
const playerHasMovementInput = castingTools.playerHasMovementInput;
const clearPlayerCast = castingTools.clearPlayerCast;
const clearMobCast = castingTools.clearMobCast;
const getAbilityCooldownPassed = (player, abilityDef, abilityLevel, now) => {
  if (!player || !abilityDef) {
    return false;
  }
  const lastUsed = Number(player.abilityLastUsedAt.get(abilityDef.id) || 0);
  return now - lastUsed >= getPlayerModifiedAbilityCooldownMs(player, abilityDef, abilityLevel, getAbilityCooldownMsForLevel);
};
const playerCommandTools = createPlayerCommandTools({
  abilityDefsProvider: () => ABILITY_CONFIG.abilityDefs,
  executeAbilityByKind,
  abilityHandlerContext,
  getPlayerAbilityLevel,
  getAbilityCooldownPassed,
  getAbilityCastMsForEntity: (player, abilityDef, abilityLevel) =>
    getPlayerModifiedAbilityCastMs(player, abilityDef, abilityLevel),
  normalizeDirection,
  playerHasMovementInput,
  clamp,
  distance,
  lootBags,
  bagPickupRange: BAG_PICKUP_RANGE,
  addItemsToInventory,
  sendInventoryState,
  syncPlayerCopperFromInventory,
  sendJson,
  notifyAbilityUsed
});
const tryPickupLootBag = playerCommandTools.tryPickupLootBag;
const usePlayerAbility = playerCommandTools.usePlayerAbility;
const updatePlayerCastTarget = playerCommandTools.updatePlayerCastTarget;

const { createTalentCommandTools } = require("./server/gameplay/talent-commands");
let getTalentTreeData = null;
let spendTalentPoint = null;

const sendTalentUpdateWrapper = (player) => {
  if (getTalentTreeData) {
    sendJson(player.ws, {
      type: "talent_update",
      talentTree: getTalentTreeData(player)
    });
  }
};

const talentCommandTools = createTalentCommandTools({
  talentSystem: coreServices.talentSystem,
  sendJson,
  sendSelfProgress,
  sendTalentUpdate: sendTalentUpdateWrapper,
  recomputePlayerDerivedStats: equipmentTools.recomputePlayerDerivedStats
});

spendTalentPoint = talentCommandTools.spendTalentPoint;
getTalentTreeData = talentCommandTools.getTalentTreeData;
const botTickSystem = createBotTickSystem({
  players,
  mobs,
  lootBags,
  activeAreaEffects,
  projectiles,
  itemDefs: ITEM_CONFIG.itemDefs,
  createPlayer,
  classConfigProvider: () => CLASS_CONFIG,
  abilityDefsProvider: () => ABILITY_CONFIG.abilityDefs,
  levelUpPlayerAbility,
  getAbilityRangeForLevel,
  usePlayerAbility,
  tryPickupLootBag,
  equipInventoryItem,
  getInventoryEntrySellValue,
  sellInventoryItemToVendor,
  townLayout: TOWN_LAYOUT,
  randomPointInRadius,
  distance,
  normalizeDirection,
  centerX: MAP_WIDTH * 0.5,
  centerY: MAP_HEIGHT * 0.5,
  spawnRadius: 6,
  bagPickupRange: BAG_PICKUP_RANGE,
  visibilityRange: VISIBILITY_RANGE
});
const createBotPlayer = botTickSystem.createBotPlayer;
const tickBots = botTickSystem.tickBots;
const listBots = botTickSystem.listBots;
const inspectBot = botTickSystem.inspectBot;
const destroyBot = botTickSystem.destroyBot;
const setBotFollow = botTickSystem.setBotFollow;
const clearBotFollow = botTickSystem.clearBotFollow;
const benchmarkSceneTools = createBenchmarkSceneTools({
  players,
  mobs,
  mobSpawners,
  lootBags,
  activeAreaEffects,
  projectiles,
  createBotPlayer,
  destroyBot,
  getMobConfig: () => MOB_CONFIG,
  createMob,
  clearMobCast,
  centerX: MAP_WIDTH * 0.5,
  centerY: MAP_HEIGHT * 0.5
});
const createBenchmarkScene = benchmarkSceneTools.createBenchmarkScene;
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
    broadcastClassAndAbilityDefs,
    applyScaledStatsToMob,
    getMobLevelForDistance
  },
  createDebouncedFileReloader
});
startConfigWatchers(configOrchestrator);

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
  steerDirectionTowards,
  isProjectileBlockedAt: (x, y) => isPointBlockedByTownWall(TOWN_LAYOUT, x, y)
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
  tickPlayerBuffs,
  tickPlayerDotEffects,
  tickTalentBuffs,
  clearPlayerCast,
  playerHasMovementInput,
  clearPlayerBuffs,
  clearPlayerCombatEffects,
  abilityDefsProvider: () => ABILITY_CONFIG.abilityDefs,
  getPlayerAbilityLevel,
  getAbilityCooldownPassed,
  executeAbilityByKind,
  notifyAbilityUsed,
  abilityHandlerContext,
  normalizeDirection,
  isBlockedPoint: (x, y) => isPointBlockedByTownWall(TOWN_LAYOUT, x, y),
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
  visibilityRange: VISIBILITY_RANGE,
  getPlayerVisibilityExtents
});

const mobCombatTools = createMobCombatTools({
  players,
  clamp,
  normalizeDirection,
  distance,
  isSafePlayerPoint: (x, y) => isPointInTown(TOWN_LAYOUT, x, y),
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
  scaleDamageRangeForMob,
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
  townLayout: TOWN_LAYOUT,
  ensureObservedSpawnerCoverage,
  refreshMobObservation,
  despawnUnobservedMobs,
  respawnMob,
  isSpawnerObserved,
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
  wsDeps: createWsConnectionDeps({
    getClassConfig: () => CLASS_CONFIG,
    getAbilityConfig: () => ABILITY_CONFIG,
    getItemConfig: () => ITEM_CONFIG,
    allocatePlayerId,
    createPlayer,
    createBotPlayer,
    createBenchmarkScene,
    listBots,
    inspectBot,
    destroyBot,
    setBotFollow,
    clearBotFollow,
    sendJson,
    players,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    visibilityRange: VISIBILITY_RANGE,
    buildSoundManifest,
    randomSpawn,
    expNeededForLevel,
    createEmptyInventorySlots,
    createEmptyEquipmentSlots,
    normalizeItemEntries,
    addItemsToInventory,
    syncPlayerCopperFromInventory,
    sendInventoryState,
    sendEquipmentState,
    sendSelfProgress,
    updatePlayerViewport,
    clamp,
    normalizeDirection,
    clearPlayerCast,
    usePlayerAbility,
    updatePlayerCastTarget,
    levelUpPlayerAbility,
    spendTalentPoint,
    getTalentTreeData,
    tryPickupLootBag,
    getVendorNpc,
    isPlayerNearVendor,
    getInventoryEntrySellValue,
    sellInventoryItemToVendor,
    mergeOrSwapInventorySlots,
    equipInventoryItem,
    unequipEquipmentItem,
    rollEquipmentItemAt,
    consumeInventoryItem,
    addHealOverTimeEffect,
    addManaOverTimeEffect
  }),
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
    getPlayerVisibilityExtents,
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
    encodePlayerMetaPacket,
    encodeLootBagMetaPacket,
    encodePlayerSwingPacket,
    encodeCastEventPacket,
    encodePlayerEffectPacket,
    encodeMobBitePacket,
    encodeMobEffectEventPacket,
    encodeAreaEffectEventPacket,
    encodeExplosionEventPacket,
    encodeProjectileHitEventPacket,
    encodeMobDeathEventPacket,
    encodeDamageEventPacket,
    pendingDamageEvents,
    pendingExplosionEvents,
    pendingProjectileHitEvents,
    pendingMobDeathEvents,
    getAliveMobCount,
    sendJson,
    sendBinary
  },
  tickMs: TICK_MS,
  tickHandlers: {
    tickBots,
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
    console.log(`Server running at http://localhost:${PORT} (${IS_PROD_MODE ? "prod" : "dev"} mode)`);
    console.log("[mobs] Dynamic observed-area spawning enabled.");
  }
});
runtimeBootstrap.start();
