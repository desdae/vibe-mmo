const fs = require("fs");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const PROTOCOL = require("./public/shared/protocol");
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
const { createPlayerAbilityTools } = require("./server/gameplay/player-abilities");
const { createPlayerCombatEffectTools } = require("./server/gameplay/player-combat-effects");
const { createMobCombatEffectTools } = require("./server/gameplay/mob-combat-effects");
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

const GAMEPLAY_CONFIG = loadGameplayConfigFromDisk();
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

const {
  POS_SCALE
} = PROTOCOL;

const publicDir = path.join(__dirname, "public");
const buildSoundManifest = createSoundManifestBuilder({ publicDir });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseNumericRange(value, fallbackMin, fallbackMax) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      const low = Math.min(first, second);
      const high = Math.max(first, second);
      return [low, high];
    }
  }
  if (Number.isFinite(Number(value))) {
    const v = Number(value);
    return [v, v];
  }
  return [fallbackMin, fallbackMax];
}

function parseBoolean(value, fallback = undefined) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === "1") {
    return true;
  }
  if (value === 0 || value === "0") {
    return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return fallback;
}

function parseMultiplier(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return clamp(n, 0, 1000);
}

function parseGameplayInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return clamp(Math.round(n), min, max);
}

function parseGameplayNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return clamp(n, min, max);
}

function buildGameplayConfig(parsed) {
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
      width: parseGameplayInt(map.width, DEFAULT_GAMEPLAY_CONFIG.map.width, 10, 10000),
      height: parseGameplayInt(map.height, DEFAULT_GAMEPLAY_CONFIG.map.height, 10, 10000),
      visibilityRange: parseGameplayNumber(
        map.visibilityRange,
        DEFAULT_GAMEPLAY_CONFIG.map.visibilityRange,
        1,
        100
      )
    },
    tickMs: parseGameplayInt(src.tickMs, DEFAULT_GAMEPLAY_CONFIG.tickMs, 10, 1000),
    player: {
      baseSpeed: parseGameplayNumber(player.baseSpeed, DEFAULT_GAMEPLAY_CONFIG.player.baseSpeed, 0.1, 50),
      baseExpToNext: parseGameplayInt(
        player.baseExpToNext,
        DEFAULT_GAMEPLAY_CONFIG.player.baseExpToNext,
        1,
        1000000
      ),
      expGrowthFactor: parseGameplayNumber(
        player.expGrowthFactor,
        DEFAULT_GAMEPLAY_CONFIG.player.expGrowthFactor,
        1,
        5
      ),
      mobMinSeparation: parseGameplayNumber(
        player.mobMinSeparation,
        DEFAULT_GAMEPLAY_CONFIG.player.mobMinSeparation,
        0,
        10
      ),
      mobSeparationIterations: parseGameplayInt(
        player.mobSeparationIterations,
        DEFAULT_GAMEPLAY_CONFIG.player.mobSeparationIterations,
        0,
        20
      )
    },
    projectile: {
      defaultHitRadius: parseGameplayNumber(
        projectile.defaultHitRadius,
        DEFAULT_GAMEPLAY_CONFIG.projectile.defaultHitRadius,
        0,
        20
      )
    },
    clusterSpawning: {
      targetClusters: parseGameplayInt(
        clusterSpawning.targetClusters,
        DEFAULT_GAMEPLAY_CONFIG.clusterSpawning.targetClusters,
        1,
        1000
      ),
      clusterAreaSize: parseGameplayNumber(
        clusterSpawning.clusterAreaSize,
        DEFAULT_GAMEPLAY_CONFIG.clusterSpawning.clusterAreaSize,
        1,
        1000
      ),
      maxClustersPerArea: parseGameplayInt(
        clusterSpawning.maxClustersPerArea,
        DEFAULT_GAMEPLAY_CONFIG.clusterSpawning.maxClustersPerArea,
        1,
        100
      )
    },
    mob: {
      wanderRadius: parseGameplayNumber(mob.wanderRadius, DEFAULT_GAMEPLAY_CONFIG.mob.wanderRadius, 0, 1000),
      provokedLeashRadius: parseGameplayNumber(
        mob.provokedLeashRadius,
        DEFAULT_GAMEPLAY_CONFIG.mob.provokedLeashRadius,
        1,
        5000
      ),
      provokedChaseMs: parseGameplayInt(
        mob.provokedChaseMs,
        DEFAULT_GAMEPLAY_CONFIG.mob.provokedChaseMs,
        0,
        3600000
      ),
      aggroRange: parseGameplayNumber(mob.aggroRange, DEFAULT_GAMEPLAY_CONFIG.mob.aggroRange, 0, 1000),
      attackRange: parseGameplayNumber(mob.attackRange, DEFAULT_GAMEPLAY_CONFIG.mob.attackRange, 0, 1000),
      attackCooldownMs: parseGameplayInt(
        mob.attackCooldownMs,
        DEFAULT_GAMEPLAY_CONFIG.mob.attackCooldownMs,
        50,
        600000
      ),
      minSeparation: parseGameplayNumber(mob.minSeparation, DEFAULT_GAMEPLAY_CONFIG.mob.minSeparation, 0, 10),
      separationIterations: parseGameplayInt(
        mob.separationIterations,
        DEFAULT_GAMEPLAY_CONFIG.mob.separationIterations,
        0,
        20
      )
    },
    loot: {
      bagPickupRange: parseGameplayNumber(loot.bagPickupRange, DEFAULT_GAMEPLAY_CONFIG.loot.bagPickupRange, 0, 50),
      bagClickRange: parseGameplayNumber(loot.bagClickRange, DEFAULT_GAMEPLAY_CONFIG.loot.bagClickRange, 0, 50),
      bagDespawnMs: parseGameplayInt(loot.bagDespawnMs, DEFAULT_GAMEPLAY_CONFIG.loot.bagDespawnMs, 0, 86400000),
      copperItemId: String(loot.copperItemId || DEFAULT_GAMEPLAY_CONFIG.loot.copperItemId).trim() ||
        DEFAULT_GAMEPLAY_CONFIG.loot.copperItemId
    },
    inventory: {
      cols: parseGameplayInt(inventory.cols, DEFAULT_GAMEPLAY_CONFIG.inventory.cols, 1, 20),
      rows: parseGameplayInt(inventory.rows, DEFAULT_GAMEPLAY_CONFIG.inventory.rows, 1, 20)
    },
    audio: {
      abilitySpatialMaxDistance: parseGameplayNumber(
        audio.abilitySpatialMaxDistance,
        DEFAULT_GAMEPLAY_CONFIG.audio.abilitySpatialMaxDistance,
        1,
        200
      ),
      abilityPanDistance: parseGameplayNumber(
        audio.abilityPanDistance,
        DEFAULT_GAMEPLAY_CONFIG.audio.abilityPanDistance,
        1,
        200
      ),
      projectileMaxConcurrent: parseGameplayInt(
        audio.projectileMaxConcurrent,
        DEFAULT_GAMEPLAY_CONFIG.audio.projectileMaxConcurrent,
        1,
        64
      )
    }
  };
}

function loadGameplayConfigFromDisk() {
  const raw = fs.readFileSync(GAMEPLAY_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("gameplay config root must be an object");
  }
  return buildGameplayConfig(parsed);
}

function buildServerConfig(parsed) {
  return {
    expMultiplier: parseMultiplier(parsed?.expMultiplier, 1),
    mobHealthMultiplier: parseMultiplier(parsed?.mobHealthMultiplier, 1),
    mobDamageMultiplier: parseMultiplier(parsed?.mobDamageMultiplier, 1),
    mobSpeedMultiplier: parseMultiplier(parsed?.mobSpeedMultiplier, 1),
    mobRespawnMultiplier: parseMultiplier(parsed?.mobRespawnMultiplier, 1),
    dropChanceMultiplier: parseMultiplier(parsed?.dropChanceMultiplier ?? parsed?.dropchanceMultiplier, 1),
    mobSpawnMultiplier: parseMultiplier(parsed?.mobSpawnMultiplier, 1)
  };
}

function loadServerConfigFromDisk() {
  const raw = fs.readFileSync(SERVER_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("server config root must be an object");
  }
  return buildServerConfig(parsed);
}

function formatServerConfigForLog(config) {
  return [
    `expMultiplier=${config.expMultiplier}`,
    `mobHealthMultiplier=${config.mobHealthMultiplier}`,
    `mobDamageMultiplier=${config.mobDamageMultiplier}`,
    `mobSpeedMultiplier=${config.mobSpeedMultiplier}`,
    `mobRespawnMultiplier=${config.mobRespawnMultiplier}`,
    `dropChanceMultiplier=${config.dropChanceMultiplier}`,
    `mobSpawnMultiplier=${config.mobSpawnMultiplier}`
  ].join(", ");
}

function loadItemConfig() {
  const raw = fs.readFileSync(ITEM_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [];

  const itemDefs = new Map();
  const clientItemDefs = [];

  for (const entry of items) {
    const id = String(entry?.id || "").trim();
    if (!id) {
      continue;
    }
    const name = String(entry?.name || id).trim().slice(0, 48);
    const stackSize = clamp(Math.round(Number(entry?.stackSize) || 1), 1, 65535);
    const description = String(entry?.description || "").slice(0, 240);
    const icon = String(entry?.icon || "").slice(0, 120);
    const effect = entry && typeof entry.effect === "object" ? entry.effect : null;
    let normalizedEffect = null;
    if (effect && typeof effect.type === "string") {
      normalizedEffect = {
        type: String(effect.type),
        value: Number(effect.value) || 0,
        duration: Number(effect.duration) || 0
      };
      for (const [effectKey, effectValue] of Object.entries(effect)) {
        if (effectKey === "type" || effectKey === "value" || effectKey === "duration") {
          continue;
        }
        if (typeof effectValue === "number" && Number.isFinite(effectValue) && effectValue > 0) {
          normalizedEffect[effectKey] = effectValue;
        }
      }
    }

    const def = {
      id,
      name,
      stackSize,
      description,
      icon,
      effect: normalizedEffect
    };
    itemDefs.set(id, def);
    clientItemDefs.push(def);
  }

  if (!itemDefs.size) {
    throw new Error(`No valid item definitions in ${ITEM_CONFIG_PATH}`);
  }

  return {
    itemDefs,
    clientItemDefs
  };
}

const DELIVERY_TYPE_TO_KIND = Object.freeze({
  projectile: "projectile",
  meleecone: "meleeCone",
  areatarget: "area",
  selfarea: "area",
  area: "area",
  beam: "beam",
  teleport: "teleport"
});

function getObjectPath(source, pathValue) {
  if (!source || typeof source !== "object" || !pathValue) {
    return undefined;
  }
  const parts = String(pathValue).split(".");
  let cursor = source;
  for (const part of parts) {
    if (!part || !cursor || typeof cursor !== "object" || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function firstFiniteNumber(values, fallback = 0) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

function findAbilityEffect(effects, type, mode = "") {
  const wantedType = String(type || "").toLowerCase();
  const wantedMode = String(mode || "").toLowerCase();
  for (const effect of Array.isArray(effects) ? effects : []) {
    if (!effect || typeof effect !== "object") {
      continue;
    }
    if (String(effect.type || "").toLowerCase() !== wantedType) {
      continue;
    }
    if (wantedMode && String(effect.mode || "").toLowerCase() !== wantedMode) {
      continue;
    }
    return effect;
  }
  return null;
}

function getProgressionPerLevelValue(entry, key) {
  const perLevel = getObjectPath(entry, "progression.perLevel");
  if (!perLevel || typeof perLevel !== "object") {
    return undefined;
  }
  if (key in perLevel) {
    return perLevel[key];
  }
  return getObjectPath(perLevel, key);
}

function normalizeAbilityEntry(rawId, entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id = String(entry.id || rawId || "").trim();
  if (!id) {
    return null;
  }

  const hasExpandedSchema =
    (entry.delivery && typeof entry.delivery === "object") ||
    (entry.targeting && typeof entry.targeting === "object") ||
    Array.isArray(entry.effects);
  if (!hasExpandedSchema) {
    return {
      ...entry,
      id
    };
  }

  const normalized = {
    id,
    name: String(entry.name || id),
    description: String(entry.description || "")
  };

  const delivery = entry.delivery && typeof entry.delivery === "object" ? entry.delivery : {};
  const targeting = entry.targeting && typeof entry.targeting === "object" ? entry.targeting : {};
  const effects = Array.isArray(entry.effects) ? entry.effects : [];

  const deliveryType = String(delivery.type || "").trim().toLowerCase();
  if (deliveryType && DELIVERY_TYPE_TO_KIND[deliveryType]) {
    normalized.kind = DELIVERY_TYPE_TO_KIND[deliveryType];
  } else if (typeof entry.kind === "string" && entry.kind.trim()) {
    normalized.kind = entry.kind.trim();
  }

  const castTime = firstFiniteNumber([delivery.castTime, entry.castTime], 0);
  if (castTime > 0) {
    normalized.castTime = castTime;
  }

  const cooldown = firstFiniteNumber([delivery.cooldown, entry.cooldown], 0);
  if (cooldown > 0) {
    normalized.cooldown = cooldown;
  }

  const manaCost = firstFiniteNumber([delivery?.resourceCost?.mana, entry.manaCost], 0);
  if (manaCost > 0) {
    normalized.manaCost = manaCost;
  }

  const teleportEffect = findAbilityEffect(effects, "teleport");
  const computedRange = firstFiniteNumber(
    [targeting.range, teleportEffect && teleportEffect.distance, entry.range],
    0
  );
  if (computedRange > 0) {
    normalized.range = computedRange;
  } else if (deliveryType === "selfarea") {
    normalized.range = 0;
  }

  const speed = firstFiniteNumber([targeting.speed, entry.speed], 0);
  if (speed > 0) {
    normalized.speed = speed;
  }

  const coneAngle = firstFiniteNumber([targeting.coneAngle, entry.coneAngle], 0);
  if (coneAngle > 0) {
    normalized.coneAngle = coneAngle;
  }

  const radius = firstFiniteNumber([targeting.radius, entry.radius, entry.areaRadius], 0);
  if (radius > 0) {
    normalized.radius = radius;
  }

  const projectileCount = Math.floor(firstFiniteNumber([targeting.projectileCount, entry.projectileCount], 0));
  if (projectileCount > 0) {
    normalized.projectileCount = projectileCount;
  }

  const directDamageEffect = findAbilityEffect(effects, "damage", "instant");
  const dotDamageEffect = findAbilityEffect(effects, "damage", "overtime");
  const fallbackDamageEffect = findAbilityEffect(effects, "damage");
  const mainDamageEffect = directDamageEffect || dotDamageEffect || fallbackDamageEffect;

  const damageRangeInput =
    (mainDamageEffect && (mainDamageEffect.amount || mainDamageEffect.amountPerSecond)) ||
    entry.damageRange ||
    entry.damagePerSecond;
  if (damageRangeInput !== undefined) {
    normalized.damageRange = damageRangeInput;
  }

  const damagePerLevelInput =
    (mainDamageEffect && (mainDamageEffect.scalingPerLevel || mainDamageEffect.scalingPerSecondPerLevel)) ||
    entry.damageRangePerLevel;
  if (damagePerLevelInput !== undefined) {
    normalized.damageRangePerLevel = damagePerLevelInput;
  }

  const dotDamagePerSecondInput =
    (dotDamageEffect && (dotDamageEffect.amountPerSecond || dotDamageEffect.amount)) || entry.dotDamagePerSecond;
  if (dotDamagePerSecondInput !== undefined) {
    normalized.dotDamagePerSecond = dotDamagePerSecondInput;
  }

  const dotDamagePerLevelInput =
    (dotDamageEffect &&
      (dotDamageEffect.scalingPerSecondPerLevel || dotDamageEffect.scalingPerLevel)) ||
    entry.dotDamagePerSecondPerLevel;
  if (dotDamagePerLevelInput !== undefined) {
    normalized.dotDamagePerSecondPerLevel = dotDamagePerLevelInput;
  }

  const dotDuration = firstFiniteNumber([dotDamageEffect && dotDamageEffect.duration, entry.dotDuration], 0);
  if (dotDuration > 0) {
    normalized.dotDuration = dotDuration;
  }

  const dotSchool = String((dotDamageEffect && dotDamageEffect.school) || entry.dotSchool || "").trim();
  if (dotSchool) {
    normalized.dotSchool = dotSchool.toLowerCase();
  }

  const effectDuration = firstFiniteNumber(
    [
      targeting.duration,
      dotDamageEffect && dotDamageEffect.duration,
      entry.duration,
      entry.durationMs
    ],
    0
  );
  if (effectDuration > 0) {
    normalized.duration = effectDuration;
  }

  const explodeEffect = findAbilityEffect(effects, "explode");
  const explosionRadius = firstFiniteNumber([explodeEffect && explodeEffect.radius, entry.explosionRadius], 0);
  if (explosionRadius > 0) {
    normalized.explosionRadius = explosionRadius;
  }
  const nestedExplosionDamage = findAbilityEffect(explodeEffect && explodeEffect.effects, "damage");
  const explosionDamageMultiplier = firstFiniteNumber(
    [
      nestedExplosionDamage && nestedExplosionDamage.amountMultiplier,
      explodeEffect && explodeEffect.amountMultiplier,
      entry.explosionDamageMultiplier
    ],
    0
  );
  if (explosionDamageMultiplier > 0) {
    normalized.explosionDamageMultiplier = explosionDamageMultiplier;
  }

  const slowEffect = findAbilityEffect(effects, "slow");
  const slowAmount = firstFiniteNumber([slowEffect && slowEffect.amount, entry.slowAmount], 0);
  if (slowAmount > 0) {
    normalized.slowAmount = slowAmount;
  }
  const slowDuration = firstFiniteNumber([slowEffect && slowEffect.duration, entry.slowDuration], 0);
  if (slowDuration > 0) {
    normalized.slowDuration = slowDuration;
  }

  const stunEffect = findAbilityEffect(effects, "stun");
  const stunDuration = firstFiniteNumber([stunEffect && stunEffect.duration, entry.stunDuration], 0);
  if (stunDuration > 0) {
    normalized.stunDuration = stunDuration;
  }

  const invulnerabilityBuff =
    (Array.isArray(effects) ? effects : []).find((effect) => {
      if (!effect || typeof effect !== "object") {
        return false;
      }
      if (String(effect.type || "").toLowerCase() !== "buff") {
        return false;
      }
      return !!(effect.stats && effect.stats.invulnerable);
    }) || null;
  const invulnerabilityDuration = firstFiniteNumber(
    [invulnerabilityBuff && invulnerabilityBuff.duration, entry.invulnerabilityDuration],
    0
  );
  if (invulnerabilityDuration > 0) {
    normalized.invulnerabilityDuration = invulnerabilityDuration;
  }

  const rangePerLevel = firstFiniteNumber([getProgressionPerLevelValue(entry, "targeting.range"), entry.rangePerLevel], 0);
  if (rangePerLevel > 0) {
    normalized.rangePerLevel = rangePerLevel;
  }
  const cooldownPerLevelRaw = Number(getProgressionPerLevelValue(entry, "delivery.cooldown"));
  if (Number.isFinite(cooldownPerLevelRaw)) {
    const reduction = cooldownPerLevelRaw < 0 ? Math.abs(cooldownPerLevelRaw) : 0;
    if (reduction > 0) {
      normalized.cooldownReductionPerLevel = reduction;
    }
  } else if (Number(entry.cooldownReductionPerLevel) > 0) {
    normalized.cooldownReductionPerLevel = Number(entry.cooldownReductionPerLevel);
  }

  const beamWidth = firstFiniteNumber([targeting.width, targeting.beamWidth, entry.beamWidth, entry.width], 0);
  if (beamWidth > 0) {
    normalized.beamWidth = beamWidth;
  }

  const spreadDeg = firstFiniteNumber([targeting.spreadDeg, targeting.spreadAngle, entry.spreadDeg, entry.spreadAngle], 0);
  if (spreadDeg > 0) {
    normalized.spreadDeg = spreadDeg;
  }

  const explodeOnExpire = parseBoolean(
    getObjectPath(targeting, "explodeOnExpire"),
    parseBoolean(entry.explodeOnExpire, undefined)
  );
  if (explodeOnExpire !== undefined) {
    normalized.explodeOnExpire = explodeOnExpire;
  }

  const homingRange = firstFiniteNumber(
    [getObjectPath(targeting, "homing.range"), targeting.homingRange, entry.homingRange],
    0
  );
  if (homingRange > 0) {
    normalized.homingRange = homingRange;
  }
  const homingTurnRate = firstFiniteNumber(
    [
      getObjectPath(targeting, "homing.turnRate"),
      getObjectPath(targeting, "homing.homingTurnRate"),
      targeting.homingTurnRate,
      targeting.turnRate,
      entry.homingTurnRate,
      entry.turnRate
    ],
    0
  );
  if (homingTurnRate > 0) {
    normalized.homingTurnRate = homingTurnRate;
  }

  if (Array.isArray(entry.tags) && entry.tags.length) {
    normalized.tags = entry.tags.map((tag) => String(tag || "").trim()).filter(Boolean);
  }

  normalized.delivery = delivery;
  normalized.targeting = targeting;
  normalized.effects = effects;
  if (entry.progression && typeof entry.progression === "object") {
    normalized.progression = entry.progression;
  }

  return normalized;
}

function buildChildProjectileTemplate(parentAbilityId, rawProjectileEntry) {
  if (!rawProjectileEntry || typeof rawProjectileEntry !== "object") {
    return null;
  }
  const normalized = normalizeAbilityEntry(`${parentAbilityId}_child_projectile`, rawProjectileEntry);
  if (!normalized) {
    return null;
  }

  const speed = Math.max(0.1, Number(normalized.speed) || 0);
  const range = Math.max(0.25, Number(normalized.range) || 0);
  const kind =
    typeof normalized.kind === "string" && normalized.kind.trim()
      ? normalized.kind.trim().toLowerCase()
      : speed > 0
        ? "projectile"
        : "";
  if (kind !== "projectile") {
    return null;
  }

  const damageRangeInput =
    normalized.damageRange !== undefined ? normalized.damageRange : normalized.damagePerSecond;
  const damageRange = parseNumericRange(damageRangeInput, 1, 1);
  const damagePerLevel = parseNumericRange(normalized.damageRangePerLevel, 0, 0);
  const dotDamageRange = parseNumericRange(normalized.dotDamagePerSecond, 0, 0);
  const dotDamagePerLevel = parseNumericRange(normalized.dotDamagePerSecondPerLevel, 0, 0);

  const dotDurationMsRaw = Number(normalized.dotDurationMs);
  const dotDurationSecRaw = Number(normalized.dotDuration);
  const dotDurationMs =
    Number.isFinite(dotDurationMsRaw) && dotDurationMsRaw > 0
      ? Math.round(dotDurationMsRaw)
      : Number.isFinite(dotDurationSecRaw) && dotDurationSecRaw > 0
        ? Math.round(dotDurationSecRaw * 1000)
        : 0;

  const slowDurationMsRaw = Number(normalized.slowDurationMs);
  const slowDurationSecRaw = Number(normalized.slowDuration);
  const slowDurationMs =
    Number.isFinite(slowDurationMsRaw) && slowDurationMsRaw > 0
      ? Math.round(slowDurationMsRaw)
      : Number.isFinite(slowDurationSecRaw) && slowDurationSecRaw > 0
        ? Math.round(slowDurationSecRaw * 1000)
        : 0;
  let slowMultiplier = 1;
  if (Number.isFinite(Number(normalized.slowMultiplier)) && Number(normalized.slowMultiplier) > 0) {
    slowMultiplier = clamp(Number(normalized.slowMultiplier), 0.1, 1);
  } else if (Number.isFinite(Number(normalized.slowAmount)) && Number(normalized.slowAmount) > 0) {
    slowMultiplier = clamp(1 - clamp(Number(normalized.slowAmount), 0, 0.95), 0.1, 1);
  }

  return {
    id: String(normalized.id || `${parentAbilityId}_child_projectile`),
    speed,
    range,
    damageMin: clamp(Math.floor(Math.min(damageRange[0], damageRange[1])), 0, 255),
    damageMax: clamp(Math.ceil(Math.max(damageRange[0], damageRange[1])), 0, 255),
    damagePerLevelMin: Math.max(0, Number(damagePerLevel[0]) || 0),
    damagePerLevelMax: Math.max(0, Number(damagePerLevel[1]) || 0),
    hitRadius: clamp(
      Number(normalized.projectileHitRadius) || Number(normalized.hitRadius) || DEFAULT_PROJECTILE_HIT_RADIUS,
      0.1,
      8
    ),
    explosionRadius: Math.max(0, Number(normalized.explosionRadius) || 0),
    explosionDamageMultiplier: clamp(Number(normalized.explosionDamageMultiplier) || 0, 0, 1),
    slowDurationMs,
    slowMultiplier,
    stunDurationMs: Math.max(0, Math.round((Number(normalized.stunDuration) || 0) * 1000)),
    dotDamageMin: Math.max(0, Number(dotDamageRange[0]) || 0),
    dotDamageMax: Math.max(0, Number(dotDamageRange[1]) || 0),
    dotDamagePerLevelMin: Math.max(0, Number(dotDamagePerLevel[0]) || 0),
    dotDamagePerLevelMax: Math.max(0, Number(dotDamagePerLevel[1]) || 0),
    dotDurationMs,
    dotSchool: String(normalized.dotSchool || "generic").trim().toLowerCase() || "generic",
    explodeOnExpire: normalized.explodeOnExpire !== false,
    homingRange: Math.max(0, Number(normalized.homingRange) || 0),
    homingTurnRate: Math.max(0, Number(normalized.homingTurnRate) || 0)
  };
}

function buildEmitProjectilesConfig(entry, abilityId) {
  const emitEffect = findAbilityEffect(entry && entry.effects, "emitprojectiles");
  if (!emitEffect || typeof emitEffect !== "object") {
    return null;
  }
  const trigger = String(emitEffect.trigger || "whileTraveling").trim().toLowerCase();
  const intervalMsRaw = Number(emitEffect.intervalMs);
  const intervalSecRaw = Number(emitEffect.interval);
  const intervalMs =
    Number.isFinite(intervalMsRaw) && intervalMsRaw > 0
      ? Math.round(intervalMsRaw)
      : Number.isFinite(intervalSecRaw) && intervalSecRaw > 0
        ? Math.round(intervalSecRaw * 1000)
        : 0;
  if (intervalMs <= 0) {
    return null;
  }

  const initialDelayMsRaw = Number(emitEffect.initialDelayMs);
  const initialDelaySecRaw = Number(emitEffect.initialDelay);
  const initialDelayMs =
    Number.isFinite(initialDelayMsRaw) && initialDelayMsRaw >= 0
      ? Math.round(initialDelayMsRaw)
      : Number.isFinite(initialDelaySecRaw) && initialDelaySecRaw >= 0
        ? Math.round(initialDelaySecRaw * 1000)
        : 0;
  const maxEmissions = clamp(Math.floor(Number(emitEffect.maxEmissions) || 1), 1, 1000);
  const patternRaw = emitEffect.pattern && typeof emitEffect.pattern === "object" ? emitEffect.pattern : {};
  const patternType = String(patternRaw.type || "radial").trim().toLowerCase();
  const pattern = {
    type: patternType || "radial",
    count: clamp(Math.floor(Number(patternRaw.count) || 1), 1, 64),
    startAngleDeg: Number(patternRaw.startAngle) || 0,
    angleSpreadDeg: Number(patternRaw.angleSpread) || 360,
    evenSpacing: patternRaw.evenSpacing !== false
  };
  const childProjectile = buildChildProjectileTemplate(abilityId, emitEffect.projectile);
  if (!childProjectile) {
    return null;
  }

  return {
    trigger,
    intervalMs: Math.max(50, intervalMs),
    initialDelayMs: Math.max(0, initialDelayMs),
    maxEmissions,
    pattern,
    childProjectile
  };
}

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

function parseClassStartingItems(rawStartingItems, itemDefs) {
  const result = [];
  for (const block of Array.isArray(rawStartingItems) ? rawStartingItems : []) {
    if (!block || typeof block !== "object") {
      continue;
    }
    for (const [itemId, rawQty] of Object.entries(block)) {
      if (!itemDefs.has(itemId)) {
        continue;
      }
      const qtyRange = parseNumericRange(rawQty, 0, 0);
      const qty = Math.max(0, Math.floor(Math.max(qtyRange[0], qtyRange[1])));
      if (qty <= 0) {
        continue;
      }
      result.push({
        itemId,
        qty
      });
    }
  }
  return normalizeItemEntries(result);
}

function loadClassConfig(abilityDefs, itemDefs) {
  const raw = fs.readFileSync(CLASS_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const entries = parsed && typeof parsed === "object" ? Object.entries(parsed) : [];

  const classDefs = new Map();
  const clientClassDefs = [];

  for (const [rawId, entry] of entries) {
    const id = String(rawId || "").trim();
    if (!id || !entry || typeof entry !== "object") {
      continue;
    }

    const abilities = [];
    const abilityLevels = new Map();
    for (const abilityEntry of Array.isArray(entry.abilities) ? entry.abilities : []) {
      const abilityId = String(abilityEntry?.id || "").trim();
      if (!abilityId || !abilityDefs.has(abilityId)) {
        continue;
      }
      const level = clamp(Math.floor(Number(abilityEntry.level) || 1), 1, 255);
      abilities.push({ id: abilityId, level });
      abilityLevels.set(abilityId, level);
    }

    const baseHealth = clamp(Math.floor(Number(entry.baseHealth) || 10), 1, 255);
    const baseMana = clamp(Math.floor(Number(entry.baseMana) || 0), 0, 65535);
    const manaRegen = Math.max(0, Number(entry.manaRegen) || 0);
    const classSpeedRaw = Number(entry.speed);
    const movementSpeed = clamp(Number.isFinite(classSpeedRaw) ? classSpeedRaw : BASE_PLAYER_SPEED, 0.1, 20);
    const startingItems = parseClassStartingItems(entry.startingItems, itemDefs);
    const def = {
      id,
      name: String(entry.name || id).slice(0, 48),
      description: String(entry.description || "").slice(0, 240),
      baseHealth,
      baseMana,
      manaRegen,
      speed: movementSpeed,
      movementSpeed,
      abilities,
      abilityLevels,
      startingItems
    };

    classDefs.set(id, def);
    clientClassDefs.push({
      id: def.id,
      name: def.name,
      description: def.description,
      baseHealth: def.baseHealth,
      baseMana: def.baseMana,
      manaRegen: def.manaRegen,
      speed: def.speed,
      abilities: def.abilities.map((ability) => ({ ...ability }))
    });
  }

  if (!classDefs.size) {
    throw new Error(`No valid class definitions in ${CLASS_CONFIG_PATH}`);
  }

  return {
    classDefs,
    clientClassDefs
  };
}

function parseMobDropRules(rawDrops, itemDefs) {
  return parseDropRulesFromGroups(rawDrops, itemDefs);
}

function parseDropRulesFromGroups(rawDropGroups, itemDefs) {
  const rules = [];
  if (!Array.isArray(rawDropGroups)) {
    return rules;
  }

  for (const dropGroup of rawDropGroups) {
    if (!dropGroup || typeof dropGroup !== "object") {
      continue;
    }

    for (const [itemId, rawSpec] of Object.entries(dropGroup)) {
      if (!itemDefs.has(itemId)) {
        continue;
      }

      if (Array.isArray(rawSpec) && rawSpec.length >= 2) {
        const a = Number(rawSpec[0]);
        const b = Number(rawSpec[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const min = Math.max(0, Math.floor(Math.min(a, b)));
          const max = Math.max(min, Math.floor(Math.max(a, b)));
          rules.push({
            itemId,
            kind: "range",
            min,
            max
          });
        }
        continue;
      }

      if (Array.isArray(rawSpec) && rawSpec.length === 1) {
        const chance = Number(rawSpec[0]);
        if (Number.isFinite(chance)) {
          rules.push({
            itemId,
            kind: "chance",
            chance: clamp(chance, 0, 1)
          });
        }
        continue;
      }

      if (Number.isFinite(Number(rawSpec))) {
        rules.push({
          itemId,
          kind: "chance",
          chance: clamp(Number(rawSpec), 0, 1)
        });
      }
    }
  }

  return rules;
}

function sanitizeCssColor(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
    return raw;
  }
  if (/^rgba?\(([^)]+)\)$/.test(raw)) {
    return raw;
  }
  if (/^hsla?\(([^)]+)\)$/.test(raw)) {
    return raw;
  }
  return "";
}

function parseMobRenderStyle(rawStyle) {
  if (!rawStyle || typeof rawStyle !== "object") {
    return null;
  }

  const style = {};
  const spriteType = String(rawStyle.spriteType || "").trim().toLowerCase();
  if (spriteType) {
    style.spriteType = spriteType.slice(0, 32);
  }

  const sizeScale = Number(rawStyle.sizeScale);
  if (Number.isFinite(sizeScale) && sizeScale > 0) {
    style.sizeScale = clamp(sizeScale, 0.5, 3);
  }

  const walkCycleSpeed = Number(rawStyle.walkCycleSpeed);
  if (Number.isFinite(walkCycleSpeed) && walkCycleSpeed > 0) {
    style.walkCycleSpeed = clamp(walkCycleSpeed, 0.1, 10);
  }

  const idleCycleSpeed = Number(rawStyle.idleCycleSpeed);
  if (Number.isFinite(idleCycleSpeed) && idleCycleSpeed >= 0) {
    style.idleCycleSpeed = clamp(idleCycleSpeed, 0, 10);
  }

  const moveThreshold = Number(rawStyle.moveThreshold);
  if (Number.isFinite(moveThreshold) && moveThreshold >= 0) {
    style.moveThreshold = clamp(moveThreshold, 0, 2);
  }

  const attackAnimSpeed = Number(rawStyle.attackAnimSpeed);
  if (Number.isFinite(attackAnimSpeed) && attackAnimSpeed > 0) {
    style.attackAnimSpeed = clamp(attackAnimSpeed, 0.1, 4);
  }

  const weaponOffsetX = Number(rawStyle.weaponOffsetX);
  if (Number.isFinite(weaponOffsetX)) {
    style.weaponOffsetX = clamp(weaponOffsetX, -24, 24);
  }

  const weaponOffsetY = Number(rawStyle.weaponOffsetY);
  if (Number.isFinite(weaponOffsetY)) {
    style.weaponOffsetY = clamp(weaponOffsetY, -24, 24);
  }

  const weaponAngleOffsetDeg = Number(rawStyle.weaponAngleOffsetDeg);
  if (Number.isFinite(weaponAngleOffsetDeg)) {
    style.weaponAngleOffsetDeg = clamp(weaponAngleOffsetDeg, -180, 180);
  }

  const biteRadius = Number(rawStyle.biteRadius);
  if (Number.isFinite(biteRadius) && biteRadius > 0) {
    style.biteRadius = clamp(biteRadius, 4, 40);
  }

  const attackVisual = String(rawStyle.attackVisual || "").trim().toLowerCase();
  if (attackVisual) {
    style.attackVisual = attackVisual.slice(0, 32);
  }

  const palette = {};
  const rawPalette = rawStyle.palette && typeof rawStyle.palette === "object" ? rawStyle.palette : null;
  if (rawPalette) {
    for (const [key, rawValue] of Object.entries(rawPalette)) {
      const color = sanitizeCssColor(rawValue);
      if (!color) {
        continue;
      }
      const normalizedKey = String(key || "").trim().slice(0, 48);
      if (!normalizedKey) {
        continue;
      }
      palette[normalizedKey] = color;
    }
  }
  if (Object.keys(palette).length > 0) {
    style.palette = palette;
  }

  return Object.keys(style).length ? style : null;
}

function parseMobCombatConfig(rawCombat, abilityDefs, fallbackDamageMin, fallbackDamageMax) {
  const raw = rawCombat && typeof rawCombat === "object" ? rawCombat : {};
  const behaviorRaw = String(raw.behavior || "").trim().toLowerCase();
  const behavior = behaviorRaw === "ranged" ? "ranged" : "melee";
  const aggroRange = clamp(Number(raw.aggroRange) || MOB_AGGRO_RANGE, 0.5, 100);
  const preferredRange = clamp(
    Number(raw.preferredRange) || (behavior === "ranged" ? Math.max(2, MOB_ATTACK_RANGE * 2) : MOB_ATTACK_RANGE),
    0.2,
    100
  );
  const leashRange = clamp(Number(raw.leashRange) || MOB_WANDER_RADIUS, 1, 500);

  const basicRaw = raw.basicAttack && typeof raw.basicAttack === "object" ? raw.basicAttack : {};
  const [basicDamageMinParsed, basicDamageMaxParsed] = parseNumericRange(
    basicRaw.damage,
    Math.max(0, Number(fallbackDamageMin) || 0),
    Math.max(0, Number(fallbackDamageMax) || Math.max(0, Number(fallbackDamageMin) || 0))
  );
  const basicCooldownMs = Math.max(
    50,
    Math.round(
      (
        Math.max(
          0,
          Number.isFinite(Number(basicRaw.cooldown))
            ? Number(basicRaw.cooldown)
            : Number(getObjectPath(basicRaw, "delivery.cooldown")) || MOB_ATTACK_COOLDOWN_MS / 1000
        )
      ) * 1000
    )
  );
  const basicRange = clamp(
    Number.isFinite(Number(basicRaw.range))
      ? Number(basicRaw.range)
      : Number(getObjectPath(basicRaw, "targeting.range")) || MOB_ATTACK_RANGE,
    0.2,
    30
  );
  const basicAbilityId = String(
    basicRaw.abilityId || basicRaw.id || (abilityDefs && abilityDefs.has("mobMeleeSwing") ? "mobMeleeSwing" : "")
  ).trim();
  const basicAttackTypeRaw = String(basicRaw.type || "").trim().toLowerCase();
  const hasBasicAbility = !!(basicAbilityId && abilityDefs && abilityDefs.has(basicAbilityId));
  const basicAttackType = hasBasicAbility || basicAttackTypeRaw === "ability" ? "ability" : "melee";
  const basicTargeting =
    basicRaw.targeting && typeof basicRaw.targeting === "object"
      ? JSON.parse(JSON.stringify(basicRaw.targeting))
      : null;
  const basicDelivery =
    basicRaw.delivery && typeof basicRaw.delivery === "object"
      ? JSON.parse(JSON.stringify(basicRaw.delivery))
      : null;
  const basicEffects = Array.isArray(basicRaw.effects) ? JSON.parse(JSON.stringify(basicRaw.effects)) : null;
  const basicConfig = JSON.parse(JSON.stringify(basicRaw));

  const abilities = [];
  for (const entry of Array.isArray(raw.abilities) ? raw.abilities : []) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const abilityId = String(entry.abilityId || entry.id || "").trim();
    if (!abilityId || !abilityDefs || !abilityDefs.has(abilityId)) {
      continue;
    }
    const abilityDef = abilityDefs.get(abilityId);
    const configuredRange = firstFiniteNumber(
      [getObjectPath(entry, "targeting.range"), entry.range],
      Number.NaN
    );
    const abilityRangeDefault = Number.isFinite(configuredRange)
      ? Math.max(0.2, configuredRange)
      : Math.max(0.2, Number(abilityDef?.range) || 0.2);
    const minRange = clamp(Number(entry.minRange) || 0, 0, 100);
    const maxRange = clamp(Number(entry.maxRange) || abilityRangeDefault, minRange, 100);
    const weight = clamp(Number(entry.weight) || 1, 0.01, 1000);
    const castChance = clamp(Number(entry.castChance), 0, 1);
    const level = clamp(Math.floor(Number(entry.level) || 1), 1, 255);
    const cooldownMs = Math.max(
      0,
      Math.round(
        (Number.isFinite(Number(entry.cooldown))
          ? Number(entry.cooldown)
          : Number.isFinite(Number(getObjectPath(entry, "delivery.cooldown")))
            ? Number(getObjectPath(entry, "delivery.cooldown"))
          : (Math.max(0, Number(abilityDef?.cooldownMs) || 0) / 1000)) * 1000
      )
    );
    const targeting =
      entry.targeting && typeof entry.targeting === "object"
        ? JSON.parse(JSON.stringify(entry.targeting))
        : null;
    const delivery =
      entry.delivery && typeof entry.delivery === "object"
        ? JSON.parse(JSON.stringify(entry.delivery))
        : null;
    const effects = Array.isArray(entry.effects) ? JSON.parse(JSON.stringify(entry.effects)) : null;
    const config = JSON.parse(JSON.stringify(entry));
    abilities.push({
      abilityId,
      weight,
      minRange,
      maxRange,
      cooldownMs,
      castChance: Number.isFinite(castChance) ? castChance : 1,
      level,
      targeting,
      delivery,
      effects,
      config
    });
  }

  return {
    behavior,
    aggroRange,
    preferredRange,
    leashRange,
    basicAttack: {
      type: basicAttackType,
      abilityId: hasBasicAbility ? basicAbilityId : "",
      damageMin: clamp(Math.floor(Math.min(basicDamageMinParsed, basicDamageMaxParsed)), 0, 255),
      damageMax: clamp(Math.ceil(Math.max(basicDamageMinParsed, basicDamageMaxParsed)), 0, 255),
      cooldownMs: basicCooldownMs,
      range: basicRange,
      targeting: basicTargeting,
      delivery: basicDelivery,
      effects: basicEffects,
      config: basicConfig
    },
    abilities
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

function flattenGlobalDropEntries(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) {
      flattenGlobalDropEntries(item, out);
    }
    return;
  }
  if (node && typeof node === "object") {
    out.push(node);
  }
}

function loadGlobalDropTableConfig(itemDefs) {
  const raw = fs.readFileSync(GLOBAL_DROP_TABLE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const maxMapRadius = Math.hypot(MAP_WIDTH / 2, MAP_HEIGHT / 2);
  const flatEntries = [];
  flattenGlobalDropEntries(parsed, flatEntries);

  const entries = [];
  for (const entry of flatEntries) {
    const [rangeMinRaw, rangeMaxRaw] = parseNumericRange(entry.range, 0, maxMapRadius);
    const rangeMin = clamp(Math.min(rangeMinRaw, rangeMaxRaw), 0, maxMapRadius);
    const rangeMax = clamp(Math.max(rangeMinRaw, rangeMaxRaw), rangeMin, maxMapRadius);
    const itemsGroup = entry && typeof entry.items === "object" ? entry.items : null;
    if (!itemsGroup) {
      continue;
    }
    const rules = parseDropRulesFromGroups([itemsGroup], itemDefs);
    if (!rules.length) {
      continue;
    }
    entries.push({
      rangeMin,
      rangeMax,
      rules
    });
  }

  return {
    entries
  };
}

function loadMobConfig(itemDefs, abilityDefs) {
  const raw = fs.readFileSync(MOB_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const maxMapRadius = Math.hypot(MAP_WIDTH / 2, MAP_HEIGHT / 2);
  const healthMultiplier = SERVER_CONFIG.mobHealthMultiplier;
  const damageMultiplier = SERVER_CONFIG.mobDamageMultiplier;
  const respawnMultiplier = SERVER_CONFIG.mobRespawnMultiplier;

  const mobDefs = new Map();
  for (const mobEntry of Array.isArray(parsed.mobs) ? parsed.mobs : []) {
    const name = String(mobEntry?.name || "").trim();
    if (!name) {
      continue;
    }

    const health = clamp(Math.round((Number(mobEntry.health) || 1) * healthMultiplier), 1, 255);
    const [damageMinRaw, damageMaxRaw] = parseNumericRange(mobEntry.damage, 1, 1);
    const damageMin = clamp(Math.round(damageMinRaw * damageMultiplier), 0, 255);
    const damageMax = clamp(Math.round(damageMaxRaw * damageMultiplier), damageMin, 255);
    const baseSpeed = clamp(Number(mobEntry.speed) || 0.5, 0.05, 20);
    const [respawnMinRaw, respawnMaxRaw] = parseNumericRange(mobEntry.respawnTime, 30, 30);
    const respawnMinMs = Math.max(1000, Math.round(respawnMinRaw * 1000 * respawnMultiplier));
    const respawnMaxMs = Math.max(respawnMinMs, Math.round(respawnMaxRaw * 1000 * respawnMultiplier));
    const dropRules = parseMobDropRules(mobEntry.drops, itemDefs);
    const renderStyle = parseMobRenderStyle(mobEntry.renderStyle);
    const combat = parseMobCombatConfig(mobEntry.combat, abilityDefs, damageMin, damageMax);

    mobDefs.set(name, {
      name,
      health,
      damageMin,
      damageMax,
      baseSpeed,
      respawnMinMs,
      respawnMaxMs,
      dropRules,
      renderStyle,
      combat
    });
  }

  if (!mobDefs.size) {
    throw new Error(`No valid mob definitions in ${MOB_CONFIG_PATH}`);
  }

  const clusterDefs = [];
  for (const clusterEntry of Array.isArray(parsed.mobClusters) ? parsed.mobClusters : []) {
    const name = String(clusterEntry?.name || "").trim() || `cluster_${clusterDefs.length + 1}`;
    const memberMobNames = Array.isArray(clusterEntry?.mobs) ? clusterEntry.mobs : [];
    const members = memberMobNames.map((mobName) => mobDefs.get(String(mobName))).filter(Boolean);
    if (!members.length) {
      continue;
    }

    const maxSize = clamp(Math.round(Number(clusterEntry.maxSize) || 1), 1, 16);

    const rawSpawnRanges = Array.isArray(clusterEntry.spawnRanges)
      ? clusterEntry.spawnRanges
      : Array.isArray(clusterEntry.spawnBands)
        ? clusterEntry.spawnBands
        : [];
    const fallbackLegacyRange = parseNumericRange(clusterEntry.spawnRange, 0, maxMapRadius);
    const fallbackLegacyChance = Math.max(0, Number(clusterEntry.spawnChance) || 0);
    const spawnBandEntries = rawSpawnRanges.length
      ? rawSpawnRanges
      : fallbackLegacyChance > 0
        ? [
            {
              range: fallbackLegacyRange,
              chance: fallbackLegacyChance,
              curve: clusterEntry.spawnCurve || "linear"
            }
          ]
        : [];

    const spawnBands = [];
    for (const bandEntry of spawnBandEntries) {
      if (!bandEntry || typeof bandEntry !== "object") {
        continue;
      }
      const [rangeMinRaw, rangeMaxRaw] = parseNumericRange(
        bandEntry.range || [bandEntry.from, bandEntry.to],
        0,
        maxMapRadius
      );
      const rangeMin = clamp(Math.min(rangeMinRaw, rangeMaxRaw), 0, maxMapRadius);
      const rangeMax = clamp(Math.max(rangeMinRaw, rangeMaxRaw), rangeMin, maxMapRadius);
      const chance = Math.max(
        0,
        Number(
          bandEntry.chance ??
            bandEntry.spawnChance ??
            bandEntry.weight ??
            0
        ) || 0
      );
      if (chance <= 0) {
        continue;
      }
      const curve = String(bandEntry.curve || "linear").trim().toLowerCase() || "linear";
      spawnBands.push({
        rangeMin,
        rangeMax,
        chance,
        curve
      });
    }

    if (!spawnBands.length) {
      continue;
    }

    const spawnRangeMin = Math.min(...spawnBands.map((band) => band.rangeMin));
    const spawnRangeMax = Math.max(...spawnBands.map((band) => band.rangeMax));
    const totalSpawnChance = spawnBands.reduce((sum, band) => sum + band.chance, 0);

    clusterDefs.push({
      name,
      members,
      spawnBands,
      totalSpawnChance,
      maxSize,
      spawnRangeMin,
      spawnRangeMax
    });
  }

  if (!clusterDefs.length) {
    throw new Error(`No valid mob cluster definitions in ${MOB_CONFIG_PATH}`);
  }

  const totalSpawnChance = clusterDefs.reduce((sum, cluster) => sum + cluster.totalSpawnChance, 0);
  const configMaxSpawnRadius = clusterDefs.length
    ? Math.max(...clusterDefs.map((cluster) => cluster.spawnRangeMax))
    : maxMapRadius;
  return {
    mobDefs,
    clusterDefs,
    totalSpawnChance,
    maxSpawnRadius: clamp(configMaxSpawnRadius, 1, maxMapRadius)
  };
}

function getClusterSpawnWeightAtDistance(clusterDef, distanceFromCenter) {
  if (!clusterDef || !Array.isArray(clusterDef.spawnBands)) {
    return 0;
  }
  const distance = Math.max(0, Number(distanceFromCenter) || 0);
  let total = 0;
  for (const band of clusterDef.spawnBands) {
    if (!band || typeof band !== "object") {
      continue;
    }
    const min = Math.max(0, Number(band.rangeMin) || 0);
    const max = Math.max(min, Number(band.rangeMax) || min);
    if (distance < min || distance > max) {
      continue;
    }
    const peakChance = Math.max(0, Number(band.chance) || 0);
    if (peakChance <= 0) {
      continue;
    }
    const curve = String(band.curve || "linear").trim().toLowerCase();
    if (curve === "flat" || curve === "uniform" || max === min) {
      total += peakChance;
      continue;
    }
    const midpoint = (min + max) * 0.5;
    const halfSpan = Math.max(0.0001, (max - min) * 0.5);
    const normalized = clamp(1 - Math.abs(distance - midpoint) / halfSpan, 0, 1);
    total += peakChance * normalized;
  }
  return total;
}

function pickClusterDef(config, distanceFromCenter = null) {
  if (!config.clusterDefs.length) {
    return null;
  }

  const useDistanceWeighting = Number.isFinite(Number(distanceFromCenter));
  if (!useDistanceWeighting && config.totalSpawnChance <= 0) {
    return config.clusterDefs[randomInt(0, config.clusterDefs.length - 1)];
  }

  const weightedClusters = [];
  let totalWeight = 0;
  for (const clusterDef of config.clusterDefs) {
    const weight = useDistanceWeighting
      ? getClusterSpawnWeightAtDistance(clusterDef, distanceFromCenter)
      : Math.max(0, Number(clusterDef.totalSpawnChance) || 0);
    if (weight <= 0) {
      continue;
    }
    totalWeight += weight;
    weightedClusters.push({ clusterDef, weight });
  }

  if (totalWeight <= 0) {
    return null;
  }

  let roll = Math.random() * totalWeight;
  for (const entry of weightedClusters) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.clusterDef;
    }
  }
  return weightedClusters[weightedClusters.length - 1].clusterDef;
}

function quantizePos(value) {
  return clamp(Math.round(value * POS_SCALE), 0, 65535);
}

function randomPointInRadius(cx, cy, radius) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return {
    x: clamp(cx + Math.cos(angle) * r, 0, MAP_WIDTH - 1),
    y: clamp(cy + Math.sin(angle) * r, 0, MAP_HEIGHT - 1)
  };
}

function clampToSpawnRadius(x, y, spawnX, spawnY, radius) {
  const dx = x - spawnX;
  const dy = y - spawnY;
  const len = Math.hypot(dx, dy);
  if (!len || len <= radius) {
    return { x, y };
  }
  const scale = radius / len;
  return {
    x: clamp(spawnX + dx * scale, 0, MAP_WIDTH - 1),
    y: clamp(spawnY + dy * scale, 0, MAP_HEIGHT - 1)
  };
}

function randomSpawn() {
  const centerX = Math.floor(MAP_WIDTH / 2);
  const centerY = Math.floor(MAP_HEIGHT / 2);
  const maxDistance = 10;

  // Rejection sampling to keep spawn inside a radius of 10 tiles from center.
  for (let i = 0; i < 100; i += 1) {
    const dx = Math.floor(Math.random() * (maxDistance * 2 + 1)) - maxDistance;
    const dy = Math.floor(Math.random() * (maxDistance * 2 + 1)) - maxDistance;
    if (dx * dx + dy * dy <= maxDistance * maxDistance) {
      return {
        x: clamp(centerX + dx, 0, MAP_WIDTH - 1),
        y: clamp(centerY + dy, 0, MAP_HEIGHT - 1)
      };
    }
  }

  // Fallback to exact center (should be rare).
  return {
    x: centerX,
    y: centerY
  };
}

function inVisibilityRange(a, b, range) {
  return Math.abs(a.x - b.x) <= range && Math.abs(a.y - b.y) <= range;
}

const ITEM_CONFIG = loadItemConfig();
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
  SERVER_CONFIG = loadServerConfigFromDisk();
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
    const nextConfig = loadServerConfigFromDisk();
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
    const nextClassConfig = loadClassConfig(nextAbilityConfig.abilityDefs, ITEM_CONFIG.itemDefs);
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
    const nextMobConfig = loadMobConfig(ITEM_CONFIG.itemDefs, ABILITY_CONFIG.abilityDefs);
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
let CLASS_CONFIG = loadClassConfig(ABILITY_CONFIG.abilityDefs, ITEM_CONFIG.itemDefs);
let MOB_CONFIG = loadMobConfig(ITEM_CONFIG.itemDefs, ABILITY_CONFIG.abilityDefs);
const GLOBAL_DROP_CONFIG = loadGlobalDropTableConfig(ITEM_CONFIG.itemDefs);
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
