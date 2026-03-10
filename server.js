const fs = require("fs");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const PROTOCOL = require("./public/shared/protocol");
const { executeAbilityByKind } = require("./server/ability-handlers");

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
    copperItemId: "copperCoin"
  },
  inventory: {
    cols: 5,
    rows: 2
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
const INVENTORY_COLS = GAMEPLAY_CONFIG.inventory.cols;
const INVENTORY_ROWS = GAMEPLAY_CONFIG.inventory.rows;
const INVENTORY_SLOT_COUNT = INVENTORY_COLS * INVENTORY_ROWS;
const ITEM_COPPER_ID = GAMEPLAY_CONFIG.loot.copperItemId;

const {
  ENTITY_PROTO_TYPE,
  ENTITY_PROTO_VERSION,
  MOB_EFFECT_PROTO_TYPE,
  MOB_EFFECT_PROTO_VERSION,
  AREA_EFFECT_PROTO_TYPE,
  AREA_EFFECT_PROTO_VERSION,
  MOB_META_PROTO_TYPE,
  MOB_META_PROTO_VERSION,
  PROJECTILE_META_PROTO_TYPE,
  PROJECTILE_META_PROTO_VERSION,
  DAMAGE_EVENT_PROTO_TYPE,
  DAMAGE_EVENT_PROTO_VERSION,
  DAMAGE_EVENT_FLAG_TARGET_PLAYER,
  DAMAGE_EVENT_FLAG_FROM_SELF,
  MOB_EFFECT_FLAG_STUN,
  MOB_EFFECT_FLAG_SLOW,
  MOB_EFFECT_FLAG_REMOVE,
  MOB_EFFECT_FLAG_BURN,
  AREA_EFFECT_OP_UPSERT,
  AREA_EFFECT_OP_REMOVE,
  AREA_EFFECT_KIND_AREA,
  AREA_EFFECT_KIND_BEAM,
  POS_SCALE,
  MANA_SCALE,
  HEAL_SCALE,
  DELTA_FLAG_HP_CHANGED,
  DELTA_FLAG_MAX_HP_CHANGED,
  DELTA_FLAG_REMOVED,
  DELTA_FLAG_COPPER_CHANGED,
  DELTA_FLAG_PROGRESS_CHANGED,
  DELTA_FLAG_MANA_CHANGED,
  DELTA_FLAG_MAX_MANA_CHANGED,
  DELTA_FLAG_PENDING_HEAL_CHANGED,
  SELF_FLAG_PENDING_MANA_CHANGED,
  SELF_MODE_NONE,
  SELF_MODE_FULL,
  SELF_MODE_DELTA
} = PROTOCOL;

const publicDir = path.join(__dirname, "public");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(ws, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

function sendBinary(ws, buffer) {
  if (ws.readyState === 1) {
    ws.send(buffer);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDirection(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (!length) {
    return null;
  }
  return { dx: dx / length, dy: dy / length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
      copperItemId: String(loot.copperItemId || DEFAULT_GAMEPLAY_CONFIG.loot.copperItemId).trim() ||
        DEFAULT_GAMEPLAY_CONFIG.loot.copperItemId
    },
    inventory: {
      cols: parseGameplayInt(inventory.cols, DEFAULT_GAMEPLAY_CONFIG.inventory.cols, 1, 20),
      rows: parseGameplayInt(inventory.rows, DEFAULT_GAMEPLAY_CONFIG.inventory.rows, 1, 20)
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

function loadMobConfig(itemDefs) {
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
    const [spawnMinRaw, spawnMaxRaw] = parseNumericRange(mobEntry.spawnRange, 0, maxMapRadius);
    const spawnRangeMin = clamp(spawnMinRaw, 0, maxMapRadius);
    const spawnRangeMax = clamp(spawnMaxRaw, spawnRangeMin, maxMapRadius);
    const baseSpeed = clamp(Number(mobEntry.speed) || 0.5, 0.05, 20);
    const [respawnMinRaw, respawnMaxRaw] = parseNumericRange(mobEntry.respawnTime, 30, 30);
    const respawnMinMs = Math.max(1000, Math.round(respawnMinRaw * 1000 * respawnMultiplier));
    const respawnMaxMs = Math.max(respawnMinMs, Math.round(respawnMaxRaw * 1000 * respawnMultiplier));
    const dropRules = parseMobDropRules(mobEntry.drops, itemDefs);
    const renderStyle = parseMobRenderStyle(mobEntry.renderStyle);

    mobDefs.set(name, {
      name,
      health,
      damageMin,
      damageMax,
      spawnRangeMin,
      spawnRangeMax,
      baseSpeed,
      respawnMinMs,
      respawnMaxMs,
      dropRules,
      renderStyle
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

    const spawnChance = Math.max(0, Number(clusterEntry.spawnChance) || 0);
    const maxSize = clamp(Math.round(Number(clusterEntry.maxSize) || 1), 1, 16);
    const spawnRangeMin = Math.max(...members.map((member) => member.spawnRangeMin));
    const spawnRangeMax = Math.min(...members.map((member) => member.spawnRangeMax));
    if (spawnRangeMin > spawnRangeMax) {
      continue;
    }

    clusterDefs.push({
      name,
      members,
      spawnChance,
      maxSize,
      spawnRangeMin,
      spawnRangeMax
    });
  }

  if (!clusterDefs.length) {
    throw new Error(`No valid mob cluster definitions in ${MOB_CONFIG_PATH}`);
  }

  const totalSpawnChance = clusterDefs.reduce((sum, cluster) => sum + cluster.spawnChance, 0);
  return {
    mobDefs,
    clusterDefs,
    totalSpawnChance
  };
}

function pickClusterDef(config) {
  if (!config.clusterDefs.length) {
    return null;
  }

  if (config.totalSpawnChance <= 0) {
    return config.clusterDefs[randomInt(0, config.clusterDefs.length - 1)];
  }

  let roll = Math.random() * config.totalSpawnChance;
  for (const clusterDef of config.clusterDefs) {
    roll -= clusterDef.spawnChance;
    if (roll <= 0) {
      return clusterDef;
    }
  }
  return config.clusterDefs[config.clusterDefs.length - 1];
}

function expNeededForLevel(level) {
  return Math.max(1, Math.ceil(BASE_EXP_TO_NEXT * Math.pow(EXP_GROWTH_FACTOR, level - 1)));
}

function serializePlayerAbilityLevels(player) {
  if (!player || !player.abilityLevels || typeof player.abilityLevels.entries !== "function") {
    return [];
  }
  const result = [];
  for (const [abilityId, rawLevel] of player.abilityLevels.entries()) {
    const id = String(abilityId || "").trim();
    const level = clamp(Math.floor(Number(rawLevel) || 0), 1, 255);
    if (!id || level <= 0) {
      continue;
    }
    result.push({ id, level });
  }
  result.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

function sendSelfProgress(player) {
  if (!player) {
    return;
  }
  sendJson(player.ws, {
    type: "self_progress",
    copper: player.copper,
    level: player.level,
    exp: player.exp,
    expToNext: player.expToNext,
    skillPoints: clamp(Math.floor(Number(player.skillPoints) || 0), 0, 65535),
    abilityLevels: serializePlayerAbilityLevels(player)
  });
}

function grantPlayerExp(player, amount) {
  if (!player || amount <= 0) {
    return;
  }
  const scaledAmount = Math.max(0, Math.floor(Number(amount) * SERVER_CONFIG.expMultiplier));
  if (scaledAmount <= 0) {
    return;
  }

  const beforeLevel = player.level;
  const beforeExp = player.exp;
  const beforeExpToNext = player.expToNext;
  const beforeSkillPoints = Math.max(0, Math.floor(Number(player.skillPoints) || 0));
  let levelsGained = 0;

  player.exp += scaledAmount;
  while (player.exp >= player.expToNext) {
    player.exp -= player.expToNext;
    player.level += 1;
    player.expToNext = expNeededForLevel(player.level);
    levelsGained += 1;
  }
  if (levelsGained > 0) {
    player.skillPoints = clamp(beforeSkillPoints + levelsGained, 0, 65535);
  }

  if (
    player.level !== beforeLevel ||
    player.exp !== beforeExp ||
    player.expToNext !== beforeExpToNext ||
    Math.floor(Number(player.skillPoints) || 0) !== beforeSkillPoints
  ) {
    sendSelfProgress(player);
  }
}

function getPendingHealAmount(player) {
  if (!player || !Array.isArray(player.activeHeals) || !player.activeHeals.length) {
    return 0;
  }
  let total = 0;
  for (const effect of player.activeHeals) {
    if (!effect) {
      continue;
    }
    total += Math.max(0, Number(effect.remainingTotal) || 0);
  }
  return Math.max(0, total);
}

function getPendingManaAmount(player) {
  if (!player || !Array.isArray(player.activeManaRestores) || !player.activeManaRestores.length) {
    return 0;
  }
  let total = 0;
  for (const effect of player.activeManaRestores) {
    if (!effect) {
      continue;
    }
    total += Math.max(0, Number(effect.remainingTotal) || 0);
  }
  return Math.max(0, total);
}

function addHealOverTimeEffect(player, totalValue, durationSec) {
  if (!player) {
    return false;
  }
  const value = Math.max(0, Number(totalValue) || 0);
  const durationMs = Math.max(1, Math.round((Math.max(0, Number(durationSec) || 0)) * 1000));
  if (value <= 0 || durationMs <= 0) {
    return false;
  }
  if (!Array.isArray(player.activeHeals)) {
    player.activeHeals = [];
  }
  player.activeHeals.push({
    remainingTotal: value,
    remainingMs: durationMs,
    ratePerMs: value / durationMs
  });
  return true;
}

function addManaOverTimeEffect(player, totalValue, durationSec) {
  if (!player) {
    return false;
  }
  const value = Math.max(0, Number(totalValue) || 0);
  const durationMs = Math.max(1, Math.round((Math.max(0, Number(durationSec) || 0)) * 1000));
  if (value <= 0 || durationMs <= 0) {
    return false;
  }
  if (!Array.isArray(player.activeManaRestores)) {
    player.activeManaRestores = [];
  }
  player.activeManaRestores.push({
    remainingTotal: value,
    remainingMs: durationMs,
    ratePerMs: value / durationMs
  });
  return true;
}

function tickPlayerHealEffects(player) {
  if (!player || !Array.isArray(player.activeHeals) || !player.activeHeals.length) {
    return;
  }

  const nextEffects = [];
  for (const effect of player.activeHeals) {
    if (!effect) {
      continue;
    }
    let remainingTotal = Math.max(0, Number(effect.remainingTotal) || 0);
    let remainingMs = Math.max(0, Number(effect.remainingMs) || 0);
    const ratePerMs = Math.max(0, Number(effect.ratePerMs) || 0);
    if (remainingTotal <= 0 || remainingMs <= 0 || ratePerMs <= 0) {
      continue;
    }

    const stepMs = Math.min(remainingMs, TICK_MS);
    let healBudget = Math.min(remainingTotal, ratePerMs * stepMs);
    if (healBudget > 0 && player.hp > 0) {
      const healed = Math.min(healBudget, Math.max(0, player.maxHp - player.hp));
      player.hp = clamp(player.hp + healed, 0, player.maxHp);
    }
    remainingTotal = Math.max(0, remainingTotal - healBudget);
    remainingMs = Math.max(0, remainingMs - TICK_MS);

    if (remainingTotal > 0.0001 && remainingMs > 0) {
      nextEffects.push({
        remainingTotal,
        remainingMs,
        ratePerMs
      });
    }
  }

  player.activeHeals = nextEffects;
}

function tickPlayerManaEffects(player) {
  if (!player || !Array.isArray(player.activeManaRestores) || !player.activeManaRestores.length) {
    return;
  }

  const nextEffects = [];
  for (const effect of player.activeManaRestores) {
    if (!effect) {
      continue;
    }
    let remainingTotal = Math.max(0, Number(effect.remainingTotal) || 0);
    let remainingMs = Math.max(0, Number(effect.remainingMs) || 0);
    const ratePerMs = Math.max(0, Number(effect.ratePerMs) || 0);
    if (remainingTotal <= 0 || remainingMs <= 0 || ratePerMs <= 0) {
      continue;
    }

    const stepMs = Math.min(remainingMs, TICK_MS);
    let manaBudget = Math.min(remainingTotal, ratePerMs * stepMs);
    if (manaBudget > 0 && player.hp > 0) {
      const restored = Math.min(manaBudget, Math.max(0, player.maxMana - player.mana));
      player.mana = clamp(player.mana + restored, 0, player.maxMana);
    }
    remainingTotal = Math.max(0, remainingTotal - manaBudget);
    remainingMs = Math.max(0, remainingMs - TICK_MS);

    if (remainingTotal > 0.0001 && remainingMs > 0) {
      nextEffects.push({
        remainingTotal,
        remainingMs,
        ratePerMs
      });
    }
  }

  player.activeManaRestores = nextEffects;
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

function rotateDirection(dir, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    dx: dir.dx * c - dir.dy * s,
    dy: dir.dx * s + dir.dy * c
  };
}

function steerDirectionTowards(currentDir, desiredDir, maxTurnRadians) {
  const current = normalizeDirection(currentDir.dx, currentDir.dy);
  const desired = normalizeDirection(desiredDir.dx, desiredDir.dy);
  if (!current || !desired) {
    return current || desired || null;
  }
  const maxTurn = Math.max(0, Number(maxTurnRadians) || 0);
  if (maxTurn <= 0) {
    return current;
  }
  const dot = clamp(current.dx * desired.dx + current.dy * desired.dy, -1, 1);
  const angle = Math.acos(dot);
  if (!Number.isFinite(angle) || angle <= maxTurn) {
    return desired;
  }
  const t = clamp(maxTurn / Math.max(0.0001, angle), 0, 1);
  return (
    normalizeDirection(
      current.dx + (desired.dx - current.dx) * t,
      current.dy + (desired.dy - current.dy) * t
    ) || current
  );
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

let serverConfigReloadTimer = null;
let abilityConfigReloadTimer = null;
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

watchServerConfig();
watchAbilityConfig();
let ABILITY_CONFIG = loadAbilityConfig();
let CLASS_CONFIG = loadClassConfig(ABILITY_CONFIG.abilityDefs, ITEM_CONFIG.itemDefs);
const MOB_CONFIG = loadMobConfig(ITEM_CONFIG.itemDefs);
const GLOBAL_DROP_CONFIG = loadGlobalDropTableConfig(ITEM_CONFIG.itemDefs);

const server = http.createServer((req, res) => {
  const reqPath = req.url || "/";
  const pathOnly = reqPath.split("?")[0];
  const decodedPath = decodeURIComponent(pathOnly);

  if (decodedPath === "/api/game-config") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(
      JSON.stringify({
        classes: CLASS_CONFIG.clientClassDefs,
        abilities: ABILITY_CONFIG.clientAbilityDefs,
        items: ITEM_CONFIG.clientItemDefs
      })
    );
    return;
  }

  const relativePath = (decodedPath === "/" ? "index.html" : decodedPath).replace(/^[/\\]+/, "");
  const normalizedPath = path.normalize(relativePath);
  const filePath = path.resolve(publicDir, normalizedPath);

  if (filePath !== publicDir && !filePath.startsWith(publicDir + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end(err.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    res.end(data);
  });
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
const pendingDamageEvents = [];
const pendingExplosionEvents = [];
const pendingProjectileHitEvents = [];
const pendingMobDeathEvents = [];

function allocateProjectileId() {
  return nextProjectileId++;
}

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
  markAbilityUsed,
  applyDamageToMob,
  applyAbilityHitEffectsToMob,
  stunMob,
  queueExplosionEvent,
  getAreaAbilityTargetPosition,
  createPersistentAreaEffect,
  createPersistentBeamEffect,
  resolvePlayerMobCollisions,
  getAbilityInvulnerabilityDurationMs
};

function createEmptyInventorySlots() {
  return Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
}

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

function serializeBagItemsForMeta(items) {
  return normalizeItemEntries(items).map((entry) => {
    const itemDef = ITEM_CONFIG.itemDefs.get(entry.itemId);
    return {
      itemId: entry.itemId,
      qty: entry.qty,
      name: itemDef ? itemDef.name : entry.itemId
    };
  });
}

function serializeInventorySlots(player) {
  const slots = Array.isArray(player?.inventorySlots) ? player.inventorySlots : [];
  const serialized = [];
  for (let i = 0; i < INVENTORY_SLOT_COUNT; i += 1) {
    const slot = slots[i];
    if (!slot || !ITEM_CONFIG.itemDefs.has(slot.itemId)) {
      serialized.push(null);
      continue;
    }
    serialized.push({
      itemId: slot.itemId,
      qty: Math.max(0, Math.floor(Number(slot.qty) || 0))
    });
  }
  return serialized;
}

function sendInventoryState(player) {
  if (!player) {
    return;
  }
  sendJson(player.ws, {
    type: "inventory_state",
    cols: INVENTORY_COLS,
    rows: INVENTORY_ROWS,
    slots: serializeInventorySlots(player)
  });
}

function addItemsToInventory(player, entries) {
  const normalizedEntries = normalizeItemEntries(entries);
  if (!normalizedEntries.length || !player || !Array.isArray(player.inventorySlots)) {
    return {
      added: [],
      leftover: normalizedEntries,
      changed: false
    };
  }

  const addedByItem = new Map();
  const leftover = [];
  let changed = false;

  for (const entry of normalizedEntries) {
    const itemDef = ITEM_CONFIG.itemDefs.get(entry.itemId);
    if (!itemDef) {
      continue;
    }

    let remaining = entry.qty;
    const stackSize = itemDef.stackSize;

    for (let i = 0; i < player.inventorySlots.length && remaining > 0; i += 1) {
      const slot = player.inventorySlots[i];
      if (!slot || slot.itemId !== entry.itemId) {
        continue;
      }
      if (slot.qty >= stackSize) {
        continue;
      }

      const canAdd = Math.min(stackSize - slot.qty, remaining);
      if (canAdd <= 0) {
        continue;
      }
      slot.qty += canAdd;
      remaining -= canAdd;
      changed = true;
      addedByItem.set(entry.itemId, (addedByItem.get(entry.itemId) || 0) + canAdd);
    }

    for (let i = 0; i < player.inventorySlots.length && remaining > 0; i += 1) {
      const slot = player.inventorySlots[i];
      if (slot) {
        continue;
      }
      const putQty = Math.min(stackSize, remaining);
      player.inventorySlots[i] = { itemId: entry.itemId, qty: putQty };
      remaining -= putQty;
      changed = true;
      addedByItem.set(entry.itemId, (addedByItem.get(entry.itemId) || 0) + putQty);
    }

    if (remaining > 0) {
      leftover.push({
        itemId: entry.itemId,
        qty: remaining
      });
    }
  }

  const added = Array.from(addedByItem.entries()).map(([itemId, qty]) => ({
    itemId,
    qty,
    name: ITEM_CONFIG.itemDefs.get(itemId)?.name || itemId
  }));

  return {
    added,
    leftover: normalizeItemEntries(leftover),
    changed
  };
}

function mergeOrSwapInventorySlots(player, fromIndex, toIndex) {
  if (!player || !Array.isArray(player.inventorySlots)) {
    return false;
  }
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= player.inventorySlots.length ||
    toIndex >= player.inventorySlots.length ||
    fromIndex === toIndex
  ) {
    return false;
  }

  const slots = player.inventorySlots;
  const from = slots[fromIndex];
  const to = slots[toIndex];

  if (!from && !to) {
    return false;
  }

  if (!from || !to) {
    slots[fromIndex] = to;
    slots[toIndex] = from;
    return true;
  }

  if (from.itemId === to.itemId) {
    const stackSize = ITEM_CONFIG.itemDefs.get(from.itemId)?.stackSize || 1;
    if (to.qty < stackSize) {
      const moveQty = Math.min(from.qty, stackSize - to.qty);
      to.qty += moveQty;
      from.qty -= moveQty;
      if (from.qty <= 0) {
        slots[fromIndex] = null;
      }
      return moveQty > 0;
    }
  }

  slots[fromIndex] = to;
  slots[toIndex] = from;
  return true;
}

function consumeInventoryItem(player, itemId, qty = 1) {
  if (!player || !Array.isArray(player.inventorySlots)) {
    return false;
  }
  const targetId = String(itemId || "").trim();
  let remaining = Math.max(1, Math.floor(Number(qty) || 1));
  if (!targetId) {
    return false;
  }

  for (let i = 0; i < player.inventorySlots.length && remaining > 0; i += 1) {
    const slot = player.inventorySlots[i];
    if (!slot || slot.itemId !== targetId) {
      continue;
    }
    const take = Math.min(slot.qty, remaining);
    slot.qty -= take;
    remaining -= take;
    if (slot.qty <= 0) {
      player.inventorySlots[i] = null;
    }
  }

  return remaining === 0;
}

function getInventoryItemCount(player, itemId) {
  if (!player || !Array.isArray(player.inventorySlots) || !itemId) {
    return 0;
  }
  let total = 0;
  for (const slot of player.inventorySlots) {
    if (!slot || slot.itemId !== itemId) {
      continue;
    }
    total += Math.max(0, Math.floor(Number(slot.qty) || 0));
  }
  return total;
}

function syncPlayerCopperFromInventory(player, shouldNotify = false) {
  if (!player) {
    return false;
  }
  const nextCopper = clamp(getInventoryItemCount(player, ITEM_COPPER_ID), 0, 65535);
  if (nextCopper === player.copper) {
    return false;
  }
  player.copper = nextCopper;
  if (shouldNotify) {
    sendSelfProgress(player);
  }
  return true;
}

function queueDamageEvent(target, amount, targetType, sourcePlayerId = null) {
  const dmg = Math.max(0, Math.round(Number(amount) || 0));
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || dmg <= 0) {
    return;
  }

  pendingDamageEvents.push({
    x: target.x,
    y: target.y,
    amount: dmg,
    targetType: targetType === "player" ? "player" : "mob",
    sourcePlayerId: sourcePlayerId ? String(sourcePlayerId) : null
  });
}

function queueExplosionEvent(x, y, radius, abilityId = "") {
  const eventRadius = Math.max(0, Number(radius) || 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || eventRadius <= 0) {
    return;
  }

  pendingExplosionEvents.push({
    x: clamp(x, 0, MAP_WIDTH - 1),
    y: clamp(y, 0, MAP_HEIGHT - 1),
    radius: eventRadius,
    abilityId: String(abilityId || "").slice(0, 32)
  });
}

function queueProjectileHitEvent(x, y, abilityId = "") {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }
  const normalizedAbilityId = String(abilityId || "").slice(0, 32);
  if (!normalizedAbilityId) {
    return;
  }
  pendingProjectileHitEvents.push({
    x: clamp(x, 0, MAP_WIDTH - 1),
    y: clamp(y, 0, MAP_HEIGHT - 1),
    abilityId: normalizedAbilityId
  });
}

function queueMobDeathEvent(mob) {
  if (!mob || !Number.isFinite(mob.x) || !Number.isFinite(mob.y)) {
    return;
  }
  pendingMobDeathEvents.push({
    x: clamp(mob.x, 0, MAP_WIDTH - 1),
    y: clamp(mob.y, 0, MAP_HEIGHT - 1),
    mobType: String(mob.type || "Mob").slice(0, 48)
  });
}

function markMobProvokedByPlayer(mob, ownerId, now = Date.now()) {
  if (!mob || !ownerId) {
    return;
  }
  const ownerKey = String(ownerId);
  const owner = players.get(ownerKey);
  if (!owner || owner.hp <= 0) {
    return;
  }
  mob.chaseTargetPlayerId = ownerKey;
  mob.chaseUntil = Math.max(Number(mob.chaseUntil) || 0, now + MOB_PROVOKED_CHASE_MS);
  mob.wanderTarget = null;
  mob.returningHome = false;
}

function stunMob(mob, durationMs, now = Date.now()) {
  if (!mob) {
    return;
  }
  const duration = Math.max(0, Math.floor(Number(durationMs) || 0));
  if (duration <= 0) {
    return;
  }
  mob.stunnedUntil = Math.max(Number(mob.stunnedUntil) || 0, now + duration);
  mob.wanderTarget = null;
}

function hasActiveProvokedChase(mob, now = Date.now()) {
  return !!(mob && mob.chaseTargetPlayerId && Number(mob.chaseUntil) > now);
}

function getMobDistanceFromSpawn(mob) {
  if (!mob) {
    return 0;
  }
  return Math.hypot((mob.x || 0) - (mob.spawnX || 0), (mob.y || 0) - (mob.spawnY || 0));
}

function getMobLeashRadius(mob, now = Date.now()) {
  if (hasActiveProvokedChase(mob, now)) {
    return MOB_PROVOKED_LEASH_RADIUS;
  }
  return Math.max(MOB_WANDER_RADIUS, getMobDistanceFromSpawn(mob));
}

function startMobReturnToSpawn(mob) {
  if (!mob) {
    return;
  }
  mob.chaseTargetPlayerId = null;
  mob.chaseUntil = 0;
  mob.wanderTarget = null;
  mob.returningHome = true;
}

function getMobMoveSpeed(mob) {
  const baseSpeed = clamp(Number(mob?.baseSpeed) || Number(mob?.speed) || 0.5, 0.05, 20);
  let slowMultiplier = 1;
  if (mob && Number(mob.slowUntil) > Date.now()) {
    slowMultiplier = clamp(Number(mob.slowMultiplier) || 1, 0.1, 1);
  } else if (mob && (mob.slowUntil || mob.slowMultiplier !== 1)) {
    mob.slowUntil = 0;
    mob.slowMultiplier = 1;
  }
  return clamp(baseSpeed * SERVER_CONFIG.mobSpeedMultiplier * slowMultiplier, 0.05, 20);
}

function applySlowToMob(mob, slowMultiplier, durationMs, now = Date.now()) {
  if (!mob || !mob.alive) {
    return;
  }
  const duration = Math.max(0, Math.round(Number(durationMs) || 0));
  if (duration <= 0) {
    return;
  }
  const multiplier = clamp(Number(slowMultiplier) || 1, 0.1, 1);
  if (multiplier >= 1) {
    return;
  }

  const active = Number(mob.slowUntil) > now;
  if (active) {
    mob.slowUntil = Math.max(Number(mob.slowUntil) || 0, now + duration);
    mob.slowMultiplier = Math.min(clamp(Number(mob.slowMultiplier) || 1, 0.1, 1), multiplier);
  } else {
    mob.slowUntil = now + duration;
    mob.slowMultiplier = multiplier;
  }
}

function applyDotToMob(
  mob,
  ownerId,
  school,
  damageMinPerSecond,
  damageMaxPerSecond,
  durationMs,
  now = Date.now()
) {
  if (!mob || !mob.alive) {
    return;
  }
  const duration = Math.max(0, Math.round(Number(durationMs) || 0));
  if (duration <= 0) {
    return;
  }
  const dotMin = Math.max(0, Number(damageMinPerSecond) || 0);
  const dotMax = Math.max(dotMin, Number(damageMaxPerSecond) || dotMin);
  if (dotMax <= 0) {
    return;
  }
  const schoolKey = String(school || "generic").trim().toLowerCase() || "generic";
  if (!(mob.activeDots instanceof Map)) {
    mob.activeDots = new Map();
  }
  const tickIntervalMs = 1000;
  const nextEndsAt = now + duration;
  const existing = mob.activeDots.get(schoolKey);
  if (existing) {
    existing.ownerId = ownerId ? String(ownerId) : existing.ownerId;
    existing.damageMin = Math.max(Number(existing.damageMin) || 0, dotMin);
    existing.damageMax = Math.max(Number(existing.damageMax) || existing.damageMin, dotMax);
    existing.endsAt = Math.max(Number(existing.endsAt) || 0, nextEndsAt);
    existing.nextTickAt = Math.min(Number(existing.nextTickAt) || now + tickIntervalMs, now + tickIntervalMs);
    mob.activeDots.set(schoolKey, existing);
  } else {
    mob.activeDots.set(schoolKey, {
      school: schoolKey,
      ownerId: ownerId ? String(ownerId) : "",
      damageMin: dotMin,
      damageMax: dotMax,
      tickIntervalMs,
      nextTickAt: now + tickIntervalMs,
      endsAt: nextEndsAt
    });
  }
  if (schoolKey === "fire") {
    mob.burningUntil = Math.max(Number(mob.burningUntil) || 0, nextEndsAt);
  }
}

function tickMobDotEffects(mob, now = Date.now()) {
  if (!mob || !mob.alive) {
    return;
  }
  const dots = mob.activeDots;
  if (!(dots instanceof Map) || dots.size === 0) {
    mob.burningUntil = 0;
    return;
  }

  let fireEndsAt = 0;
  for (const [schoolKey, dot] of Array.from(dots.entries())) {
    const endsAt = Math.max(0, Math.floor(Number(dot.endsAt) || 0));
    if (endsAt <= now) {
      dots.delete(schoolKey);
      continue;
    }
    if (schoolKey === "fire") {
      fireEndsAt = Math.max(fireEndsAt, endsAt);
    }

    const tickIntervalMs = Math.max(100, Math.floor(Number(dot.tickIntervalMs) || 1000));
    while (Number(dot.nextTickAt) <= now && Number(dot.nextTickAt) < endsAt + 5) {
      if (!mob.alive) {
        break;
      }
      const dealt = applyDamageToMob(
        mob,
        randomInt(Math.floor(dot.damageMin), Math.ceil(dot.damageMax)),
        dot.ownerId || null
      );
      dot.nextTickAt += tickIntervalMs;
      if (!mob.alive || dealt <= 0) {
        break;
      }
    }

    if (!mob.alive) {
      break;
    }
    dots.set(schoolKey, dot);
  }

  if (!mob.alive) {
    if (dots instanceof Map) {
      dots.clear();
    }
    mob.burningUntil = 0;
    return;
  }

  if (dots.size <= 0) {
    mob.burningUntil = 0;
  } else if (fireEndsAt > now) {
    mob.burningUntil = fireEndsAt;
  } else {
    mob.burningUntil = 0;
  }
}

function applyAbilityHitEffectsToMob(mob, ownerId, abilityDef, abilityLevel, dealtDamage, now = Date.now()) {
  if (!mob || !mob.alive || dealtDamage <= 0 || !abilityDef) {
    return;
  }
  const slowDurationMs = Math.max(0, Number(abilityDef.slowDurationMs) || 0);
  const slowMultiplier = clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1);
  if (slowDurationMs > 0 && slowMultiplier < 1) {
    applySlowToMob(mob, slowMultiplier, slowDurationMs, now);
  }
  const stunDurationMs = Math.max(0, Number(abilityDef.stunDurationMs) || 0);
  if (stunDurationMs > 0) {
    stunMob(mob, stunDurationMs, now);
  }
  const dotDurationMs = Math.max(0, Number(abilityDef.dotDurationMs) || 0);
  const [dotDamageMin, dotDamageMax] = getAbilityDotDamageRange(abilityDef, abilityLevel);
  if (dotDurationMs > 0 && dotDamageMax > 0) {
    applyDotToMob(
      mob,
      ownerId,
      String(abilityDef.dotSchool || "generic"),
      dotDamageMin,
      dotDamageMax,
      dotDurationMs,
      now
    );
  }
}

function applyDamageToMob(mob, damage, ownerId) {
  if (!mob || !mob.alive) {
    return 0;
  }
  const dmg = Math.max(0, Math.floor(Number(damage) || 0));
  if (dmg <= 0) {
    return 0;
  }

  const beforeHp = mob.hp;
  mob.hp = Math.max(0, mob.hp - dmg);
  const dealt = beforeHp - mob.hp;
  if (dealt > 0) {
    queueDamageEvent(mob, dealt, "mob", ownerId);
    markMobProvokedByPlayer(mob, ownerId);
  }
  if (mob.hp <= 0) {
    killMob(mob, ownerId);
  }
  return dealt;
}

function isPlayerInvulnerable(player, now = Date.now()) {
  if (!player) {
    return false;
  }
  return (Number(player.invulnerableUntil) || 0) > now;
}

function applyDamageToPlayer(player, damage, now = Date.now()) {
  if (!player || player.hp <= 0 || isPlayerInvulnerable(player, now)) {
    return 0;
  }
  const dmg = Math.max(0, Math.floor(Number(damage) || 0));
  if (dmg <= 0) {
    return 0;
  }

  const beforeHp = player.hp;
  player.hp = Math.max(0, player.hp - dmg);
  const dealt = beforeHp - player.hp;
  if (dealt > 0) {
    queueDamageEvent(player, dealt, "player");
  }
  if (player.hp <= 0) {
    player.input = { dx: 0, dy: 0 };
    clearPlayerCast(player);
  }
  return dealt;
}

function getPlayerClassDef(player) {
  if (!player) {
    return null;
  }
  return CLASS_CONFIG.classDefs.get(String(player.classType || "")) || null;
}

function getPlayerAbilityLevel(player, abilityId) {
  if (!player || !player.abilityLevels) {
    return 0;
  }
  const level = Number(player.abilityLevels.get(String(abilityId || "")));
  if (!Number.isFinite(level) || level <= 0) {
    return 0;
  }
  return Math.floor(level);
}

function getAbilityDamageRange(abilityDef, level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const levelOffset = Math.max(0, lvl - 1);
  const min = Math.max(0, Math.floor(abilityDef.damageMin + abilityDef.damagePerLevelMin * levelOffset));
  const max = Math.max(min, Math.ceil(abilityDef.damageMax + abilityDef.damagePerLevelMax * levelOffset));
  return [min, max];
}

function getAbilityDotDamageRange(abilityDef, level) {
  if (!abilityDef) {
    return [0, 0];
  }
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const levelOffset = Math.max(0, lvl - 1);
  const min = Math.max(0, Number(abilityDef.dotDamageMin) + Number(abilityDef.dotDamagePerLevelMin) * levelOffset);
  const max = Math.max(min, Number(abilityDef.dotDamageMax) + Number(abilityDef.dotDamagePerLevelMax) * levelOffset);
  return [min, max];
}

function getAbilityRangeForLevel(abilityDef, level) {
  if (!abilityDef) {
    return 0;
  }
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const levelOffset = Math.max(0, lvl - 1);
  const baseRange = Math.max(0, Number(abilityDef.range) || 0);
  const rangePerLevel = Math.max(0, Number(abilityDef.rangePerLevel) || 0);
  return Math.max(0, baseRange + rangePerLevel * levelOffset);
}

function getAbilityCooldownMsForLevel(abilityDef, level) {
  if (!abilityDef) {
    return 0;
  }
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const levelOffset = Math.max(0, lvl - 1);
  const baseCooldownMs = Math.max(0, Number(abilityDef.cooldownMs) || 0);
  const reductionPerLevelMs = Math.max(0, Number(abilityDef.cooldownReductionPerLevelMs) || 0);
  return Math.max(0, baseCooldownMs - reductionPerLevelMs * levelOffset);
}

function getAbilityInvulnerabilityDurationMs(abilityDef) {
  return Math.max(0, Number(abilityDef?.invulnerabilityDurationMs) || 0);
}

function levelUpPlayerAbility(player, abilityId) {
  if (!player) {
    return false;
  }
  const resolvedAbilityId = String(abilityId || "").trim();
  if (!resolvedAbilityId || !ABILITY_CONFIG.abilityDefs.has(resolvedAbilityId)) {
    return false;
  }
  const classDef = getPlayerClassDef(player);
  if (!classDef || !classDef.abilityLevels || !classDef.abilityLevels.has(resolvedAbilityId)) {
    return false;
  }
  const skillPoints = Math.max(0, Math.floor(Number(player.skillPoints) || 0));
  if (skillPoints <= 0) {
    return false;
  }
  const currentLevel = clamp(getPlayerAbilityLevel(player, resolvedAbilityId), 1, 255);
  if (currentLevel >= 255) {
    return false;
  }
  player.skillPoints = skillPoints - 1;
  player.abilityLevels.set(resolvedAbilityId, currentLevel + 1);
  return true;
}

function getAbilityCooldownPassed(player, abilityDef, level, now) {
  const lastUsed = Number(player.abilityLastUsedAt.get(abilityDef.id) || 0);
  return now - lastUsed >= getAbilityCooldownMsForLevel(abilityDef, level);
}

function markAbilityUsed(player, abilityDef, now) {
  player.abilityLastUsedAt.set(abilityDef.id, now);
}

function playerHasMovementInput(player) {
  if (!player || !player.input) {
    return false;
  }
  return Math.abs(Number(player.input.dx) || 0) > 1e-6 || Math.abs(Number(player.input.dy) || 0) > 1e-6;
}

function clearPlayerCast(player) {
  if (!player || !player.activeCast) {
    return false;
  }
  player.activeCast = null;
  player.castStateVersion = (Number(player.castStateVersion) + 1) & 0xffff;
  return true;
}

function serializePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    classType: player.classType,
    x: player.x,
    y: player.y,
    hp: player.hp,
    maxHp: player.maxHp
  };
}

function serializeMob(mob) {
  return {
    id: mob.id,
    name: mob.type || "Mob",
    renderStyle: mob.renderStyle || null,
    x: mob.x,
    y: mob.y,
    hp: mob.hp,
    maxHp: mob.maxHp
  };
}

function serializeLootBag(bag) {
  return {
    id: bag.id,
    x: bag.x,
    y: bag.y
  };
}

function createLootBag(x, y, items = []) {
  const normalizedItems = normalizeItemEntries(items);
  if (!normalizedItems.length) {
    return null;
  }
  const bag = {
    id: String(nextLootBagId++),
    x: clamp(x, 0, MAP_WIDTH - 1),
    y: clamp(y, 0, MAP_HEIGHT - 1),
    items: normalizedItems,
    metaVersion: 1
  };
  lootBags.set(bag.id, bag);
  return bag;
}

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
    lastBiteDirection: { dx: 0, dy: -1 },
    biteCounter: 0,
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
    returningHome: false
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

  const clustersPerCell = new Map();
  let attempts = 0;
  const maxAttempts = targetMobClusters * 100;

  while (mobSpawners.size < targetMobClusters && attempts < maxAttempts) {
    attempts += 1;
    const clusterDef = pickClusterDef(MOB_CONFIG);
    if (!clusterDef) {
      break;
    }

    const distanceFromCenter =
      clusterDef.spawnRangeMin + Math.random() * (clusterDef.spawnRangeMax - clusterDef.spawnRangeMin);
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
}

function applyProjectileHitEffects(mob, projectile, dealtDamage, now = Date.now()) {
  if (!mob || !mob.alive || dealtDamage <= 0 || !projectile) {
    return;
  }
  const slowDurationMs = Math.max(0, Number(projectile.slowDurationMs) || 0);
  const slowMultiplier = clamp(Number(projectile.slowMultiplier) || 1, 0.1, 1);
  if (slowDurationMs > 0 && slowMultiplier < 1) {
    applySlowToMob(mob, slowMultiplier, slowDurationMs, now);
  }
  const stunDurationMs = Math.max(0, Number(projectile.stunDurationMs) || 0);
  if (stunDurationMs > 0) {
    stunMob(mob, stunDurationMs, now);
  }
  const dotDurationMs = Math.max(0, Number(projectile.dotDurationMs) || 0);
  const dotDamageMin = Math.max(0, Number(projectile.dotDamageMin) || 0);
  const dotDamageMax = Math.max(dotDamageMin, Number(projectile.dotDamageMax) || dotDamageMin);
  if (dotDurationMs > 0 && dotDamageMax > 0) {
    applyDotToMob(
      mob,
      projectile.ownerId || null,
      String(projectile.dotSchool || "generic"),
      dotDamageMin,
      dotDamageMax,
      dotDurationMs,
      now
    );
  }
}

function spawnProjectileFromTemplate(ownerId, sourceX, sourceY, direction, template, abilityLevel, now = Date.now()) {
  if (!template || !direction) {
    return false;
  }
  const dir = normalizeDirection(direction.dx, direction.dy);
  if (!dir) {
    return false;
  }

  const level = Math.max(1, Math.floor(Number(abilityLevel) || 1));
  const levelOffset = Math.max(0, level - 1);
  const speed = Math.max(0.1, Number(template.speed) || 1);
  const range = Math.max(0.25, Number(template.range) || 4);
  const ttlMs = Math.max(120, Math.round((range / speed) * 1000));
  const damageMin = clamp(
    Math.floor((Number(template.damageMin) || 0) + (Number(template.damagePerLevelMin) || 0) * levelOffset),
    0,
    255
  );
  const damageMax = clamp(
    Math.ceil((Number(template.damageMax) || damageMin) + (Number(template.damagePerLevelMax) || 0) * levelOffset),
    damageMin,
    255
  );
  const dotDamageMin = Math.max(
    0,
    Number(template.dotDamageMin) + (Number(template.dotDamagePerLevelMin) || 0) * levelOffset
  );
  const dotDamageMax = Math.max(
    dotDamageMin,
    Number(template.dotDamageMax) + (Number(template.dotDamagePerLevelMax) || 0) * levelOffset
  );

  const projectile = {
    id: String(nextProjectileId++),
    ownerId: String(ownerId || ""),
    x: clamp(Number(sourceX) + dir.dx * 0.35, 0, MAP_WIDTH - 1),
    y: clamp(Number(sourceY) + dir.dy * 0.35, 0, MAP_HEIGHT - 1),
    dx: dir.dx,
    dy: dir.dy,
    speed,
    ttlMs,
    createdAt: now,
    damageMin,
    damageMax,
    hitRadius: clamp(Number(template.hitRadius) || DEFAULT_PROJECTILE_HIT_RADIUS, 0.1, 8),
    explosionRadius: Math.max(0, Number(template.explosionRadius) || 0),
    explosionDamageMultiplier: clamp(Number(template.explosionDamageMultiplier) || 0, 0, 1),
    slowDurationMs: Math.max(0, Number(template.slowDurationMs) || 0),
    slowMultiplier: clamp(Number(template.slowMultiplier) || 1, 0.1, 1),
    stunDurationMs: Math.max(0, Number(template.stunDurationMs) || 0),
    dotDamageMin,
    dotDamageMax,
    dotDurationMs: Math.max(0, Number(template.dotDurationMs) || 0),
    dotSchool: String(template.dotSchool || "generic"),
    homingRange: Math.max(0, Number(template.homingRange) || 0),
    homingTurnRate: Math.max(0, Number(template.homingTurnRate) || 0),
    abilityId: String(template.id || "child_projectile"),
    emitProjectiles: null
  };
  projectiles.set(projectile.id, projectile);
  return true;
}

function emitProjectilesFromEmitter(projectile, now = Date.now()) {
  const emitter = projectile && projectile.emitProjectiles;
  if (!emitter || String(emitter.trigger || "").toLowerCase() !== "whiletraveling") {
    return;
  }
  const intervalMs = Math.max(50, Math.floor(Number(emitter.intervalMs) || 0));
  const maxEmissions = clamp(Math.floor(Number(emitter.maxEmissions) || 0), 0, 1000);
  if (intervalMs <= 0 || maxEmissions <= 0 || !emitter.childProjectile) {
    projectile.emitProjectiles = null;
    return;
  }
  if (Number(emitter.emissionsDone) >= maxEmissions) {
    projectile.emitProjectiles = null;
    return;
  }

  const pattern = emitter.pattern && typeof emitter.pattern === "object" ? emitter.pattern : {};
  const count = clamp(Math.floor(Number(pattern.count) || 1), 1, 64);
  const startAngleRad = (Number(pattern.startAngleDeg) || 0) * (Math.PI / 180);
  const angleSpreadRad = (Number(pattern.angleSpreadDeg) || 360) * (Math.PI / 180);
  const evenSpacing = pattern.evenSpacing !== false;
  const baseAngle = Math.atan2(Number(projectile.dy) || 0, Number(projectile.dx) || 1);
  const level = Math.max(1, Math.floor(Number(emitter.abilityLevel) || 1));

  let burstsThisTick = 0;
  while (now >= Number(emitter.nextEmissionAt) && Number(emitter.emissionsDone) < maxEmissions) {
    for (let i = 0; i < count; i += 1) {
      let t = 0;
      if (count > 1) {
        t = evenSpacing ? i / count : i / (count - 1);
      }
      const angle = baseAngle + startAngleRad + (count === 1 ? 0 : t * angleSpreadRad);
      spawnProjectileFromTemplate(
        projectile.ownerId,
        projectile.x,
        projectile.y,
        { dx: Math.cos(angle), dy: Math.sin(angle) },
        emitter.childProjectile,
        level,
        now
      );
    }

    emitter.emissionsDone = Math.floor(Number(emitter.emissionsDone) || 0) + 1;
    emitter.nextEmissionAt = Number(emitter.nextEmissionAt) + intervalMs;
    burstsThisTick += 1;
    if (burstsThisTick >= 4) {
      emitter.nextEmissionAt = now + intervalMs;
      break;
    }
  }

  if (Number(emitter.emissionsDone) >= maxEmissions) {
    projectile.emitProjectiles = null;
  }
}

function getNearestProjectileTarget(projectile, maxRange) {
  if (!projectile || maxRange <= 0) {
    return null;
  }
  let best = null;
  let bestDistSq = maxRange * maxRange;
  for (const mob of mobs.values()) {
    if (!mob.alive) {
      continue;
    }
    const dx = mob.x - projectile.x;
    const dy = mob.y - projectile.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > bestDistSq) {
      continue;
    }
    best = mob;
    bestDistSq = distSq;
  }
  return best;
}

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

    let hitMob = null;
    for (const mob of mobs.values()) {
      if (!mob.alive) {
        continue;
      }
      const hitRadius = clamp(Number(projectile.hitRadius) || DEFAULT_PROJECTILE_HIT_RADIUS, 0.1, 8);
      if (distance(projectile, mob) > hitRadius) {
        continue;
      }
      hitMob = mob;
      break;
    }

    const expired = now - projectile.createdAt > projectile.ttlMs;
    const outOfMap =
      projectile.x < 0 ||
      projectile.x > MAP_WIDTH - 1 ||
      projectile.y < 0 ||
      projectile.y > MAP_HEIGHT - 1;

    if (hitMob) {
      queueProjectileHitEvent(hitMob.x, hitMob.y, projectile.abilityId);
      const damageMin = clamp(Math.floor(Number(projectile.damageMin) || 0), 0, 255);
      const damageMax = clamp(Math.floor(Number(projectile.damageMax) || damageMin), damageMin, 255);
      const baseDamage = randomInt(damageMin, damageMax);
      const explosionRadius = Math.max(0, Number(projectile.explosionRadius) || 0);
      const minMultiplier = clamp(Number(projectile.explosionDamageMultiplier) || 0, 0, 1);

      if (explosionRadius > 0) {
        queueExplosionEvent(hitMob.x, hitMob.y, explosionRadius, projectile.abilityId);
        for (const mob of mobs.values()) {
          if (!mob.alive) {
            continue;
          }
          const dist = Math.hypot(mob.x - hitMob.x, mob.y - hitMob.y);
          if (dist > explosionRadius) {
            continue;
          }
          const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
          const scale = 1 - t * (1 - minMultiplier);
          const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
          const dealt = applyDamageToMob(mob, scaledDamage, projectile.ownerId);
          applyProjectileHitEffects(mob, projectile, dealt, now);
        }
      } else {
        const dealt = applyDamageToMob(hitMob, baseDamage, projectile.ownerId);
        applyProjectileHitEffects(hitMob, projectile, dealt, now);
      }
    } else if (
      (expired || outOfMap) &&
      (Number(projectile.explosionRadius) || 0) > 0 &&
      String(projectile.abilityId || "").toLowerCase() !== "fireball"
    ) {
      const explosionRadius = Math.max(0, Number(projectile.explosionRadius) || 0);
      const minMultiplier = clamp(Number(projectile.explosionDamageMultiplier) || 0, 0, 1);
      const damageMin = clamp(Math.floor(Number(projectile.damageMin) || 0), 0, 255);
      const damageMax = clamp(Math.floor(Number(projectile.damageMax) || damageMin), damageMin, 255);
      const baseDamage = randomInt(damageMin, damageMax);
      queueExplosionEvent(projectile.x, projectile.y, explosionRadius, projectile.abilityId);
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

    if (expired || outOfMap || hitMob) {
      toDelete.push(projectile.id);
    }
  }

  for (const id of toDelete) {
    projectiles.delete(id);
  }
}

function tickAreaEffects(now = Date.now()) {
  for (const [effectId, effect] of activeAreaEffects.entries()) {
    if (!effect || now >= Number(effect.endsAt) || Number(effect.durationMs) <= 0) {
      activeAreaEffects.delete(effectId);
      continue;
    }

    const tickIntervalMs = Math.max(50, Number(effect.tickIntervalMs) || 1000);
    while (Number(effect.nextTickAt) <= now && Number(effect.nextTickAt) < Number(effect.endsAt) + 5) {
      if (String(effect.kind || "") === "beam") {
        for (const mob of mobs.values()) {
          if (!isMobInsideBeamEffect(mob, effect)) {
            continue;
          }
          const tickDamage = rollScaledTickDamage(effect.damageMin, effect.damageMax, tickIntervalMs);
          if (tickDamage > 0) {
            const dealt = applyDamageToMob(mob, tickDamage, effect.ownerId);
            if (mob.alive && dealt > 0 && effect.dotDurationMs > 0 && effect.dotDamageMax > 0) {
              applyDotToMob(
                mob,
                effect.ownerId || null,
                String(effect.dotSchool || "generic"),
                effect.dotDamageMin,
                effect.dotDamageMax,
                effect.dotDurationMs,
                now
              );
            }
          }
        }
      } else {
        for (const mob of mobs.values()) {
          if (!mob.alive) {
            continue;
          }
          const dist = Math.hypot(mob.x - effect.x, mob.y - effect.y);
          if (dist > effect.radius) {
            continue;
          }
          if (effect.damageMax > 0) {
            const dealt = applyDamageToMob(mob, randomInt(effect.damageMin, effect.damageMax), effect.ownerId);
            if (mob.alive && dealt > 0 && effect.dotDurationMs > 0 && effect.dotDamageMax > 0) {
              applyDotToMob(
                mob,
                effect.ownerId || null,
                String(effect.dotSchool || "generic"),
                effect.dotDamageMin,
                effect.dotDamageMax,
                effect.dotDurationMs,
                now
              );
            }
          }
          if (mob.alive && effect.slowMultiplier < 1 && effect.slowDurationMs > 0) {
            applySlowToMob(mob, effect.slowMultiplier, effect.slowDurationMs, now);
          }
        }
      }
      effect.nextTickAt += tickIntervalMs;
    }
  }
}

function tickPlayers() {
  const dt = TICK_MS / 1000;

  for (const player of players.values()) {
    if (player.hp > 0 && player.mana < player.maxMana && player.manaRegen > 0) {
      player.mana = clamp(player.mana + player.manaRegen * dt, 0, player.maxMana);
    }
    tickPlayerHealEffects(player);
    tickPlayerManaEffects(player);

    if (player.activeCast && playerHasMovementInput(player)) {
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
      continue;
    }

    if (!player.input || (!player.input.dx && !player.input.dy)) {
      continue;
    }

    const moveSpeed = Math.max(0.1, Number(player.moveSpeed) || BASE_PLAYER_SPEED);
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

function buildPlayerSwingEventsForRecipient(recipient, nearbyPlayerObjects) {
  const sync = recipient.entitySync;
  const events = [];

  for (const other of nearbyPlayerObjects) {
    const realId = toEntityRealId(other.id);
    if (!realId) {
      continue;
    }

    const slot = sync.playerSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }

    const currentSwingCounter = other.swingCounter & 0xff;
    const previousSwingCounter = sync.playerSwingBySlot.get(slot);
    if (previousSwingCounter === undefined) {
      sync.playerSwingBySlot.set(slot, currentSwingCounter);
      continue;
    }
    if (previousSwingCounter === currentSwingCounter) {
      continue;
    }

    sync.playerSwingBySlot.set(slot, currentSwingCounter);
    events.push({
      id: slot,
      dx: Number(other.lastSwingDirection.dx.toFixed(2)),
      dy: Number(other.lastSwingDirection.dy.toFixed(2))
    });
  }

  for (const slot of Array.from(sync.playerSwingBySlot.keys())) {
    if (!sync.playerRealIdBySlot.has(slot)) {
      sync.playerSwingBySlot.delete(slot);
    }
  }

  return events;
}

function buildPlayerCastEventsForRecipient(recipient, nearbyPlayerObjects, now) {
  const sync = recipient.entitySync;
  const casts = [];

  for (const other of nearbyPlayerObjects) {
    const realId = toEntityRealId(other.id);
    if (!realId) {
      continue;
    }
    const slot = sync.playerSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }

    const currentVersion = Number(other.castStateVersion) & 0xffff;
    const previousVersion = sync.playerCastVersionBySlot.get(slot);
    const activeCast = other.activeCast && now < other.activeCast.endsAt ? other.activeCast : null;

    if (previousVersion === undefined) {
      sync.playerCastVersionBySlot.set(slot, currentVersion);
      if (activeCast) {
        casts.push({
          id: slot,
          active: true,
          abilityId: String(activeCast.abilityId || ""),
          durationMs: Math.max(1, Math.floor(Number(activeCast.durationMs) || 0)),
          elapsedMs: clamp(now - activeCast.startedAt, 0, activeCast.durationMs)
        });
      }
      continue;
    }

    if (previousVersion !== currentVersion) {
      sync.playerCastVersionBySlot.set(slot, currentVersion);
      if (activeCast) {
        casts.push({
          id: slot,
          active: true,
          abilityId: String(activeCast.abilityId || ""),
          durationMs: Math.max(1, Math.floor(Number(activeCast.durationMs) || 0)),
          elapsedMs: clamp(now - activeCast.startedAt, 0, activeCast.durationMs)
        });
      } else {
        casts.push({
          id: slot,
          active: false
        });
      }
    }
  }

  for (const slot of Array.from(sync.playerCastVersionBySlot.keys())) {
    if (!sync.playerRealIdBySlot.has(slot)) {
      sync.playerCastVersionBySlot.delete(slot);
    }
  }

  const selfCast = recipient.activeCast && now < recipient.activeCast.endsAt ? recipient.activeCast : null;
  const currentSelfVersion = Number(recipient.castStateVersion) & 0xffff;
  let self = null;
  if (sync.selfCastVersion === null || sync.selfCastVersion === undefined) {
    sync.selfCastVersion = currentSelfVersion;
    if (selfCast) {
      self = {
        active: true,
        abilityId: String(selfCast.abilityId || ""),
        durationMs: Math.max(1, Math.floor(Number(selfCast.durationMs) || 0)),
        elapsedMs: clamp(now - selfCast.startedAt, 0, selfCast.durationMs)
      };
    }
  } else if (sync.selfCastVersion !== currentSelfVersion) {
    sync.selfCastVersion = currentSelfVersion;
    if (selfCast) {
      self = {
        active: true,
        abilityId: String(selfCast.abilityId || ""),
        durationMs: Math.max(1, Math.floor(Number(selfCast.durationMs) || 0)),
        elapsedMs: clamp(now - selfCast.startedAt, 0, selfCast.durationMs)
      };
    } else {
      self = {
        active: false
      };
    }
  }

  return { casts, self };
}

function buildMobBiteEventsForRecipient(recipient, nearbyMobObjects) {
  const sync = recipient.entitySync;
  const events = [];

  for (const mob of nearbyMobObjects) {
    const realId = toEntityRealId(mob.id);
    if (!realId) {
      continue;
    }

    const slot = sync.mobSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }

    const currentBiteCounter = mob.biteCounter & 0xff;
    const previousBiteCounter = sync.mobBiteBySlot.get(slot);
    if (previousBiteCounter === undefined) {
      sync.mobBiteBySlot.set(slot, currentBiteCounter);
      continue;
    }
    if (previousBiteCounter === currentBiteCounter) {
      continue;
    }

    sync.mobBiteBySlot.set(slot, currentBiteCounter);
    events.push({
      id: slot,
      dx: Number(mob.lastBiteDirection.dx.toFixed(2)),
      dy: Number(mob.lastBiteDirection.dy.toFixed(2))
    });
  }

  for (const slot of Array.from(sync.mobBiteBySlot.keys())) {
    if (!sync.mobRealIdBySlot.has(slot)) {
      sync.mobBiteBySlot.delete(slot);
    }
  }

  return events;
}

function buildMobEffectEventsForRecipient(recipient, nearbyMobObjects, now = Date.now()) {
  const events = [];
  const sync = recipient.entitySync;
  const visibleSlots = new Set();

  for (const mob of nearbyMobObjects) {
    if (!mob.alive) {
      continue;
    }
    const realId = toEntityRealId(mob.id);
    if (!realId) {
      continue;
    }
    const slot = sync.mobSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }
    visibleSlots.add(slot);

    const stunnedUntil = Math.max(0, Math.floor(Number(mob.stunnedUntil) || 0));
    const slowUntil = Math.max(0, Math.floor(Number(mob.slowUntil) || 0));
    const burningUntil = Math.max(0, Math.floor(Number(mob.burningUntil) || 0));
    const hasStun = stunnedUntil > now;
    const hasSlow = slowUntil > now;
    const hasBurn = burningUntil > now;
    const slowMultiplierQ = clamp(Math.round(clamp(Number(mob.slowMultiplier) || 1, 0.1, 1) * 1000), 1, 1000);
    const previous = sync.mobEffectStatesBySlot.get(slot);

    if (!hasStun && !hasSlow && !hasBurn) {
      if (previous) {
        events.push({
          id: slot,
          flags: MOB_EFFECT_FLAG_REMOVE
        });
        sync.mobEffectStatesBySlot.delete(slot);
      }
      continue;
    }

    const nextState = {
      stunnedUntil: hasStun ? stunnedUntil : 0,
      slowUntil: hasSlow ? slowUntil : 0,
      burningUntil: hasBurn ? burningUntil : 0,
      slowMultiplierQ: hasSlow ? slowMultiplierQ : 1000
    };

    const changed =
      !previous ||
      previous.stunnedUntil !== nextState.stunnedUntil ||
      previous.slowUntil !== nextState.slowUntil ||
      previous.burningUntil !== nextState.burningUntil ||
      previous.slowMultiplierQ !== nextState.slowMultiplierQ;

    if (changed) {
      let flags = 0;
      if (hasStun) {
        flags |= MOB_EFFECT_FLAG_STUN;
      }
      if (hasSlow) {
        flags |= MOB_EFFECT_FLAG_SLOW;
      }
      if (hasBurn) {
        flags |= MOB_EFFECT_FLAG_BURN;
      }
      events.push({
        id: slot,
        flags,
        stunnedMs: hasStun ? clamp(stunnedUntil - now, 1, 65535) : 0,
        slowedMs: hasSlow ? clamp(slowUntil - now, 1, 65535) : 0,
        burningMs: hasBurn ? clamp(burningUntil - now, 1, 65535) : 0,
        slowMultiplierQ: hasSlow ? slowMultiplierQ : 1000
      });
    }
    sync.mobEffectStatesBySlot.set(slot, nextState);
  }

  for (const [slot] of Array.from(sync.mobEffectStatesBySlot.entries())) {
    if (!sync.mobRealIdBySlot.has(slot) || !visibleSlots.has(slot)) {
      events.push({
        id: slot,
        flags: MOB_EFFECT_FLAG_REMOVE
      });
      sync.mobEffectStatesBySlot.delete(slot);
    }
  }

  return events;
}

function toAreaEffectState(effect) {
  const id = Number(effect && effect.id);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  const kindRaw = String((effect && effect.kind) || "area").toLowerCase();
  const kind = kindRaw === "beam" ? AREA_EFFECT_KIND_BEAM : AREA_EFFECT_KIND_AREA;
  const state = {
    id: Math.floor(id),
    kind,
    abilityId: String((effect && effect.abilityId) || "").trim().toLowerCase().slice(0, 64),
    xQ: quantizePos(effect && effect.x),
    yQ: quantizePos(effect && effect.y),
    radiusQ: quantizePos(Math.max(0.1, Number(effect && effect.radius) || 0.1)),
    durationMs: clamp(Math.floor(Number(effect && effect.durationMs) || 0), 1, 65535),
    endsAt: Math.max(0, Math.floor(Number(effect && effect.endsAt) || 0))
  };
  if (kind === AREA_EFFECT_KIND_BEAM) {
    state.startXQ = quantizePos(effect && effect.startX);
    state.startYQ = quantizePos(effect && effect.startY);
    state.dxQ = clamp(Math.round((Number(effect && effect.dx) || 0) * 1000), -32767, 32767);
    state.dyQ = clamp(Math.round((Number(effect && effect.dy) || 0) * 1000), -32767, 32767);
    state.lengthQ = quantizePos(Math.max(0.1, Number(effect && effect.length) || 0.1));
    state.widthQ = quantizePos(Math.max(0.1, Number(effect && effect.width) || 0.1));
  }
  return state;
}

function areaEffectStateEquals(a, b) {
  if (!a || !b) {
    return false;
  }
  if (
    a.kind !== b.kind ||
    a.abilityId !== b.abilityId ||
    a.xQ !== b.xQ ||
    a.yQ !== b.yQ ||
    a.radiusQ !== b.radiusQ ||
    a.durationMs !== b.durationMs ||
    a.endsAt !== b.endsAt
  ) {
    return false;
  }
  if (a.kind === AREA_EFFECT_KIND_BEAM) {
    return (
      a.startXQ === b.startXQ &&
      a.startYQ === b.startYQ &&
      a.dxQ === b.dxQ &&
      a.dyQ === b.dyQ &&
      a.lengthQ === b.lengthQ &&
      a.widthQ === b.widthQ
    );
  }
  return true;
}

function buildAreaEffectEventsForRecipient(recipient, now = Date.now()) {
  const events = [];
  const sync = recipient.entitySync;
  const visibleIds = new Set();

  for (const effect of activeAreaEffects.values()) {
    if (!effect || now >= Number(effect.endsAt)) {
      continue;
    }
    const visibility = VISIBILITY_RANGE + Math.max(0, Number(effect.radius) || 0);
    if (!inVisibilityRange(recipient, effect, visibility)) {
      continue;
    }

    const state = toAreaEffectState(effect);
    if (!state) {
      continue;
    }
    visibleIds.add(state.id);

    const previous = sync.areaEffectStatesById.get(state.id);
    if (!areaEffectStateEquals(previous, state)) {
      events.push({
        op: AREA_EFFECT_OP_UPSERT,
        ...state,
        remainingMs: clamp(state.endsAt - now, 1, 65535)
      });
      sync.areaEffectStatesById.set(state.id, state);
    }
  }

  for (const [id] of Array.from(sync.areaEffectStatesById.entries())) {
    if (!visibleIds.has(id)) {
      events.push({
        op: AREA_EFFECT_OP_REMOVE,
        id
      });
      sync.areaEffectStatesById.delete(id);
    }
  }

  return events;
}

function getAreaAbilityTargetPosition(player, castRange, targetDx, targetDy, targetDistance) {
  const targetDir =
    normalizeDirection(targetDx, targetDy) ||
    normalizeDirection(player.lastDirection.dx, player.lastDirection.dy) ||
    { dx: 0, dy: 1 };
  const requestedDistance = Number.isFinite(Number(targetDistance)) ? Number(targetDistance) : castRange;
  const distanceFromCaster = castRange > 0 ? clamp(requestedDistance, 0, castRange) : 0;
  const x = clamp(player.x + targetDir.dx * distanceFromCaster, 0, MAP_WIDTH - 1);
  const y = clamp(player.y + targetDir.dy * distanceFromCaster, 0, MAP_HEIGHT - 1);
  return {
    x,
    y,
    castRange,
    distanceFromCaster,
    targetDir
  };
}

function createPersistentAreaEffect(
  ownerId,
  abilityDef,
  centerX,
  centerY,
  radius,
  durationMs,
  damageMin,
  damageMax,
  statusPayload = null,
  now
) {
  const tickIntervalMs = 1000;
  const payload = statusPayload && typeof statusPayload === "object" ? statusPayload : {};
  const effect = {
    id: String(nextAreaEffectId++),
    ownerId: String(ownerId || ""),
    abilityId: String(abilityDef.id || ""),
    kind: "area",
    x: clamp(centerX, 0, MAP_WIDTH - 1),
    y: clamp(centerY, 0, MAP_HEIGHT - 1),
    radius: Math.max(0.1, Number(radius) || 0.1),
    damageMin: clamp(Math.floor(Number(damageMin) || 0), 0, 255),
    damageMax: clamp(Math.floor(Number(damageMax) || 0), 0, 255),
    dotDamageMin: Math.max(0, Number(payload.dotDamageMin) || 0),
    dotDamageMax: Math.max(0, Number(payload.dotDamageMax) || 0),
    dotDurationMs: Math.max(0, Math.floor(Number(payload.dotDurationMs) || 0)),
    dotSchool: String(payload.dotSchool || "generic").trim().toLowerCase() || "generic",
    slowMultiplier: clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1),
    slowDurationMs: Math.max(
      0,
      Number(abilityDef.slowDurationMs) || (clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1) < 1 ? 1200 : 0)
    ),
    createdAt: now,
    endsAt: now + durationMs,
    durationMs,
    tickIntervalMs,
    nextTickAt: now
  };
  activeAreaEffects.set(effect.id, effect);
  queueExplosionEvent(effect.x, effect.y, effect.radius, effect.abilityId);
  return effect;
}

function createPersistentBeamEffect(
  ownerId,
  abilityDef,
  startX,
  startY,
  dir,
  length,
  width,
  durationMs,
  damageMin,
  damageMax,
  statusPayload = null,
  now
) {
  const beamLength = Math.max(0.2, Number(length) || 0.2);
  const beamWidth = Math.max(0.2, Number(width) || 0.8);
  const normalizedDir = normalizeDirection(dir?.dx, dir?.dy) || { dx: 0, dy: 1 };
  const clampedStartX = clamp(startX, 0, MAP_WIDTH - 1);
  const clampedStartY = clamp(startY, 0, MAP_HEIGHT - 1);
  const clampedEndX = clamp(clampedStartX + normalizedDir.dx * beamLength, 0, MAP_WIDTH - 1);
  const clampedEndY = clamp(clampedStartY + normalizedDir.dy * beamLength, 0, MAP_HEIGHT - 1);
  const tickIntervalMs = 250;
  const payload = statusPayload && typeof statusPayload === "object" ? statusPayload : {};

  const effect = {
    id: String(nextAreaEffectId++),
    ownerId: String(ownerId || ""),
    abilityId: String(abilityDef.id || ""),
    kind: "beam",
    x: (clampedStartX + clampedEndX) * 0.5,
    y: (clampedStartY + clampedEndY) * 0.5,
    radius: Math.max(beamWidth, beamLength * 0.55),
    startX: clampedStartX,
    startY: clampedStartY,
    dx: normalizedDir.dx,
    dy: normalizedDir.dy,
    length: beamLength,
    width: beamWidth,
    damageMin: clamp(Math.floor(Number(damageMin) || 0), 0, 255),
    damageMax: clamp(Math.floor(Number(damageMax) || 0), 0, 255),
    dotDamageMin: Math.max(0, Number(payload.dotDamageMin) || 0),
    dotDamageMax: Math.max(0, Number(payload.dotDamageMax) || 0),
    dotDurationMs: Math.max(0, Math.floor(Number(payload.dotDurationMs) || 0)),
    dotSchool: String(payload.dotSchool || "generic").trim().toLowerCase() || "generic",
    createdAt: now,
    endsAt: now + durationMs,
    durationMs,
    tickIntervalMs,
    nextTickAt: now
  };
  activeAreaEffects.set(effect.id, effect);
  return effect;
}

function rollScaledTickDamage(minPerSecond, maxPerSecond, tickIntervalMs) {
  const minBase = Math.max(0, Number(minPerSecond) || 0);
  const maxBase = Math.max(minBase, Number(maxPerSecond) || minBase);
  if (maxBase <= 0 || tickIntervalMs <= 0) {
    return 0;
  }
  const scale = tickIntervalMs / 1000;
  const minTick = minBase * scale;
  const maxTick = maxBase * scale;
  const sampled = minTick + Math.random() * Math.max(0, maxTick - minTick);
  let dealt = Math.floor(sampled);
  const fractional = sampled - dealt;
  if (Math.random() < fractional) {
    dealt += 1;
  }
  return Math.max(0, dealt);
}

function isMobInsideBeamEffect(mob, effect) {
  if (!mob || !effect || !mob.alive) {
    return false;
  }
  const dir = normalizeDirection(effect.dx, effect.dy);
  if (!dir) {
    return false;
  }
  const startX = Number(effect.startX);
  const startY = Number(effect.startY);
  const beamLength = Math.max(0.2, Number(effect.length) || 0);
  const halfWidth = Math.max(0.1, Number(effect.width) || 0.8) * 0.5;
  const relX = mob.x - startX;
  const relY = mob.y - startY;
  const along = relX * dir.dx + relY * dir.dy;
  if (along < 0 || along > beamLength) {
    return false;
  }
  const perpendicular = Math.abs(relX * dir.dy - relY * dir.dx);
  return perpendicular <= halfWidth;
}

function usePlayerAbility(player, abilityId, targetDx, targetDy, targetDistance = null) {
  if (!player || player.hp <= 0) {
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

function getNearestAggroPlayer(mob) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const player of players.values()) {
    if (player.hp <= 0) {
      continue;
    }
    const d = distance(mob, player);
    if (d <= MOB_AGGRO_RANGE && d < nearestDistance) {
      nearest = player;
      nearestDistance = d;
    }
  }

  return { player: nearest, dist: nearestDistance };
}

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

    const nearestAggro = forcedTarget ? null : getNearestAggroPlayer(mob);
    const aggroPlayer = forcedTarget || (nearestAggro ? nearestAggro.player : null);
    const dist = aggroPlayer ? distance(mob, aggroPlayer) : Infinity;

    if (aggroPlayer) {
      if (dist > MOB_ATTACK_RANGE) {
        const dir = normalizeDirection(aggroPlayer.x - mob.x, aggroPlayer.y - mob.y);
        if (dir) {
          const leashRadius = forcedTarget ? MOB_PROVOKED_LEASH_RADIUS : getMobLeashRadius(mob, now);
          const nextPos = clampToSpawnRadius(
            mob.x + dir.dx * mobSpeed * dt,
            mob.y + dir.dy * mobSpeed * dt,
            mob.spawnX,
            mob.spawnY,
            leashRadius
          );
          mob.x = nextPos.x;
          mob.y = nextPos.y;
        }
      } else if (now - mob.lastAttackAt >= MOB_ATTACK_COOLDOWN_MS) {
        mob.lastAttackAt = now;
        const biteDir = normalizeDirection(aggroPlayer.x - mob.x, aggroPlayer.y - mob.y);
        if (biteDir) {
          mob.lastBiteDirection = biteDir;
        }
        mob.biteCounter = (mob.biteCounter + 1) & 0xff;
        applyDamageToPlayer(aggroPlayer, randomInt(mob.damageMin, mob.damageMax), now);
        if (aggroPlayer.hp <= 0) {
          startMobReturnToSpawn(mob);
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

function toEntityRealId(entityId) {
  const numericId = Number(entityId);
  if (!Number.isFinite(numericId)) {
    return 0;
  }
  return numericId;
}

function buildMobMetaSignature(name, renderStyle) {
  let styleJson = "";
  if (renderStyle && typeof renderStyle === "object") {
    try {
      styleJson = JSON.stringify(renderStyle);
    } catch (_error) {
      styleJson = "";
    }
  }
  return `${String(name || "Mob")}|${styleJson}`;
}

function getEntitySyncStore(sync, kind) {
  if (kind === "player") {
    return {
      slotsByRealId: sync.playerSlotsByRealId,
      realIdBySlot: sync.playerRealIdBySlot,
      statesBySlot: sync.playerStatesBySlot,
      freeSlots: sync.freePlayerSlots,
      nextSlotKey: "nextPlayerSlot"
    };
  }
  if (kind === "projectile") {
    return {
      slotsByRealId: sync.projectileSlotsByRealId,
      realIdBySlot: sync.projectileRealIdBySlot,
      statesBySlot: sync.projectileStatesBySlot,
      freeSlots: sync.freeProjectileSlots,
      nextSlotKey: "nextProjectileSlot"
    };
  }
  if (kind === "lootbag") {
    return {
      slotsByRealId: sync.lootBagSlotsByRealId,
      realIdBySlot: sync.lootBagRealIdBySlot,
      statesBySlot: sync.lootBagStatesBySlot,
      freeSlots: sync.freeLootBagSlots,
      nextSlotKey: "nextLootBagSlot"
    };
  }
  return {
    slotsByRealId: sync.mobSlotsByRealId,
    realIdBySlot: sync.mobRealIdBySlot,
    statesBySlot: sync.mobStatesBySlot,
    freeSlots: sync.freeMobSlots,
    nextSlotKey: "nextMobSlot"
  };
}

function allocateEntitySlot(sync, store) {
  if (store.freeSlots.length) {
    return store.freeSlots.pop();
  }

  const nextSlot = sync[store.nextSlotKey];
  if (nextSlot > 255) {
    return null;
  }
  sync[store.nextSlotKey] += 1;
  return nextSlot;
}

function processVisibleEntities(sync, kind, entities) {
  const store = getEntitySyncStore(sync, kind);
  const full = [];
  const delta = [];
  const meta = [];
  const visibleRealIds = new Set();

  for (const entity of entities) {
    const realId = toEntityRealId(entity.id);
    if (!realId) {
      continue;
    }
    visibleRealIds.add(realId);

    let slot = store.slotsByRealId.get(realId);
    if (!slot) {
      slot = allocateEntitySlot(sync, store);
      if (!slot) {
        continue;
      }
      store.slotsByRealId.set(realId, slot);
      store.realIdBySlot.set(slot, realId);
    }

    const state = {
      x: quantizePos(entity.x),
      y: quantizePos(entity.y),
      hp: clamp(entity.hp, 0, 255),
      maxHp: clamp(entity.maxHp, 0, 255)
    };

    const previous = store.statesBySlot.get(slot);
    if (!previous) {
      full.push({ id: slot, ...state });
      store.statesBySlot.set(slot, state);
      if (kind === "player") {
        meta.push({
          id: slot,
          name: entity.name,
          classType: entity.classType
        });
      } else if (kind === "mob") {
        const mobName = entity.name || "Mob";
        const mobStyle = entity.renderStyle || null;
        const signature = buildMobMetaSignature(mobName, mobStyle);
        const previousSignature = sync.mobMetaSignatureBySlot.get(slot);
        if (previousSignature !== signature) {
          meta.push({
            id: slot,
            name: mobName,
            renderStyle: mobStyle
          });
          sync.mobMetaSignatureBySlot.set(slot, signature);
        }
      }
      continue;
    }

    const dx = state.x - previous.x;
    const dy = state.y - previous.y;
    let flags = 0;
    if (state.hp !== previous.hp) {
      flags |= DELTA_FLAG_HP_CHANGED;
    }
    if (state.maxHp !== previous.maxHp) {
      flags |= DELTA_FLAG_MAX_HP_CHANGED;
    }

    const canDelta = slot <= 255 && Math.abs(dx) <= 127 && Math.abs(dy) <= 127;
    const changed = dx !== 0 || dy !== 0 || flags !== 0;

    if (changed) {
      if (canDelta) {
        delta.push({
          id: slot,
          dx,
          dy,
          flags,
          hp: state.hp,
          maxHp: state.maxHp
        });
      } else {
        full.push({ id: slot, ...state });
      }
    }

    store.statesBySlot.set(slot, state);
  }

  const toRemove = [];
  for (const [realId, slot] of store.slotsByRealId.entries()) {
    if (!visibleRealIds.has(realId)) {
      toRemove.push({ realId, slot });
    }
  }

  for (const entry of toRemove) {
    if (entry.slot <= 255) {
      delta.push({
        id: entry.slot,
        dx: 0,
        dy: 0,
        flags: DELTA_FLAG_REMOVED
      });
    }
    store.slotsByRealId.delete(entry.realId);
    store.realIdBySlot.delete(entry.slot);
    store.statesBySlot.delete(entry.slot);
    store.freeSlots.push(entry.slot);
  }

  return { full, delta, meta };
}

function processVisibleProjectiles(sync, entities) {
  const store = getEntitySyncStore(sync, "projectile");
  const full = [];
  const delta = [];
  const meta = [];
  const visibleRealIds = new Set();

  for (const entity of entities) {
    const realId = toEntityRealId(entity.id);
    if (!realId) {
      continue;
    }
    visibleRealIds.add(realId);

    let slot = store.slotsByRealId.get(realId);
    if (!slot) {
      slot = allocateEntitySlot(sync, store);
      if (!slot) {
        continue;
      }
      store.slotsByRealId.set(realId, slot);
      store.realIdBySlot.set(slot, realId);
    }

    const state = {
      x: quantizePos(entity.x),
      y: quantizePos(entity.y)
    };

    const previous = store.statesBySlot.get(slot);
    if (!previous) {
      full.push({ id: slot, ...state });
      store.statesBySlot.set(slot, state);
      const abilityId = String(entity.abilityId || "");
      const previousAbilityId = sync.projectileMetaBySlot.get(slot);
      if (previousAbilityId !== abilityId) {
        sync.projectileMetaBySlot.set(slot, abilityId);
        meta.push({
          id: slot,
          abilityId
        });
      }
      continue;
    }

    const dx = state.x - previous.x;
    const dy = state.y - previous.y;
    const changed = dx !== 0 || dy !== 0;
    const canDelta = slot <= 255 && Math.abs(dx) <= 127 && Math.abs(dy) <= 127;

    if (changed) {
      if (canDelta) {
        delta.push({
          id: slot,
          dx,
          dy,
          flags: 0
        });
      } else {
        full.push({ id: slot, ...state });
      }
    }

    store.statesBySlot.set(slot, state);
    const abilityId = String(entity.abilityId || "");
    const previousAbilityId = sync.projectileMetaBySlot.get(slot);
    if (previousAbilityId !== abilityId) {
      sync.projectileMetaBySlot.set(slot, abilityId);
      meta.push({
        id: slot,
        abilityId
      });
    }
  }

  const toRemove = [];
  for (const [realId, slot] of store.slotsByRealId.entries()) {
    if (!visibleRealIds.has(realId)) {
      toRemove.push({ realId, slot });
    }
  }

  for (const entry of toRemove) {
    if (entry.slot <= 255) {
      delta.push({
        id: entry.slot,
        dx: 0,
        dy: 0,
        flags: DELTA_FLAG_REMOVED
      });
    }
    store.slotsByRealId.delete(entry.realId);
    store.realIdBySlot.delete(entry.slot);
    store.statesBySlot.delete(entry.slot);
    store.freeSlots.push(entry.slot);
  }

  return { full, delta, meta };
}

function processVisibleLootBags(sync, entities) {
  const store = getEntitySyncStore(sync, "lootbag");
  const full = [];
  const delta = [];
  const meta = [];
  const visibleRealIds = new Set();

  for (const entity of entities) {
    const realId = toEntityRealId(entity.id);
    if (!realId) {
      continue;
    }
    visibleRealIds.add(realId);

    let slot = store.slotsByRealId.get(realId);
    if (!slot) {
      slot = allocateEntitySlot(sync, store);
      if (!slot) {
        continue;
      }
      store.slotsByRealId.set(realId, slot);
      store.realIdBySlot.set(slot, realId);
    }

    const state = {
      x: quantizePos(entity.x),
      y: quantizePos(entity.y)
    };

    const previous = store.statesBySlot.get(slot);
    const currentMetaVersion = Math.max(0, Math.floor(Number(entity.metaVersion) || 0));
    const previousMetaVersion = sync.lootBagMetaVersionBySlot.get(slot);
    if (!previous) {
      full.push({ id: slot, ...state });
      store.statesBySlot.set(slot, state);
      sync.lootBagMetaVersionBySlot.set(slot, currentMetaVersion);
      meta.push({
        id: slot,
        items: serializeBagItemsForMeta(entity.items)
      });
      continue;
    }

    const dx = state.x - previous.x;
    const dy = state.y - previous.y;
    const changed = dx !== 0 || dy !== 0;
    const canDelta = slot <= 255 && Math.abs(dx) <= 127 && Math.abs(dy) <= 127;

    if (changed) {
      if (canDelta) {
        delta.push({
          id: slot,
          dx,
          dy,
          flags: 0
        });
      } else {
        full.push({ id: slot, ...state });
      }
    }

    store.statesBySlot.set(slot, state);
    if (previousMetaVersion !== currentMetaVersion) {
      sync.lootBagMetaVersionBySlot.set(slot, currentMetaVersion);
      meta.push({
        id: slot,
        items: serializeBagItemsForMeta(entity.items)
      });
    }
  }

  const toRemove = [];
  for (const [realId, slot] of store.slotsByRealId.entries()) {
    if (!visibleRealIds.has(realId)) {
      toRemove.push({ realId, slot });
    }
  }

  for (const entry of toRemove) {
    if (entry.slot <= 255) {
      delta.push({
        id: entry.slot,
        dx: 0,
        dy: 0,
        flags: DELTA_FLAG_REMOVED
      });
    }
    store.slotsByRealId.delete(entry.realId);
    store.realIdBySlot.delete(entry.slot);
    store.statesBySlot.delete(entry.slot);
    store.freeSlots.push(entry.slot);
    sync.lootBagMetaVersionBySlot.delete(entry.slot);
  }

  return { full, delta, meta };
}

function encodeFullRecords(records) {
  const buffer = Buffer.alloc(records.length * 8);
  let offset = 0;
  for (const record of records) {
    buffer.writeUInt16LE(record.id, offset);
    buffer.writeUInt16LE(record.x, offset + 2);
    buffer.writeUInt16LE(record.y, offset + 4);
    buffer.writeUInt8(record.hp, offset + 6);
    buffer.writeUInt8(record.maxHp, offset + 7);
    offset += 8;
  }
  return buffer;
}

function encodeDeltaRecords(records) {
  const bytes = [];

  for (const record of records) {
    bytes.push(record.id & 0xff);
    bytes.push(record.dx & 0xff);
    bytes.push(record.dy & 0xff);
    bytes.push(record.flags & 0xff);

    if (record.flags & DELTA_FLAG_HP_CHANGED) {
      bytes.push(record.hp & 0xff);
    }
    if (record.flags & DELTA_FLAG_MAX_HP_CHANGED) {
      bytes.push(record.maxHp & 0xff);
    }
  }

  return Buffer.from(bytes);
}

function encodeProjectileFullRecords(records) {
  const buffer = Buffer.alloc(records.length * 6);
  let offset = 0;
  for (const record of records) {
    buffer.writeUInt16LE(record.id, offset);
    buffer.writeUInt16LE(record.x, offset + 2);
    buffer.writeUInt16LE(record.y, offset + 4);
    offset += 6;
  }
  return buffer;
}

function encodeProjectileDeltaRecords(records) {
  const bytes = [];
  for (const record of records) {
    bytes.push(record.id & 0xff);
    bytes.push(record.dx & 0xff);
    bytes.push(record.dy & 0xff);
    bytes.push(record.flags & 0xff);
  }
  return Buffer.from(bytes);
}

function encodeMobEffectEventPacket(events) {
  const bytes = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(MOB_EFFECT_PROTO_TYPE, 0);
  header.writeUInt8(MOB_EFFECT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  for (const event of events) {
    const id = clamp(Math.floor(Number(event.id) || 0), 0, 255);
    const flags = clamp(Math.floor(Number(event.flags) || 0), 0, 255);
    bytes.push(id & 0xff);
    bytes.push(flags & 0xff);

    if (flags & MOB_EFFECT_FLAG_STUN) {
      const stunnedMs = clamp(Math.floor(Number(event.stunnedMs) || 0), 1, 65535);
      bytes.push(stunnedMs & 0xff, (stunnedMs >> 8) & 0xff);
    }
    if (flags & MOB_EFFECT_FLAG_SLOW) {
      const slowedMs = clamp(Math.floor(Number(event.slowedMs) || 0), 1, 65535);
      const slowMultiplierQ = clamp(Math.floor(Number(event.slowMultiplierQ) || 1000), 1, 1000);
      bytes.push(slowedMs & 0xff, (slowedMs >> 8) & 0xff);
      bytes.push(slowMultiplierQ & 0xff, (slowMultiplierQ >> 8) & 0xff);
    }
    if (flags & MOB_EFFECT_FLAG_BURN) {
      const burningMs = clamp(Math.floor(Number(event.burningMs) || 0), 1, 65535);
      bytes.push(burningMs & 0xff, (burningMs >> 8) & 0xff);
    }
  }

  return Buffer.concat([header, Buffer.from(bytes)]);
}

function encodeAreaEffectEventPacket(events) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(AREA_EFFECT_PROTO_TYPE, 0);
  header.writeUInt8(AREA_EFFECT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);
  parts.push(header);

  for (const event of events) {
    const op = Number(event.op) === AREA_EFFECT_OP_REMOVE ? AREA_EFFECT_OP_REMOVE : AREA_EFFECT_OP_UPSERT;
    const id = clamp(Math.floor(Number(event.id) || 0), 0, 0xffffffff);
    const base = Buffer.alloc(5);
    base.writeUInt8(op, 0);
    base.writeUInt32LE(id, 1);
    parts.push(base);
    if (op !== AREA_EFFECT_OP_UPSERT) {
      continue;
    }

    const abilityBytes = Buffer.from(String(event.abilityId || "").slice(0, 64), "utf8");
    const details = Buffer.alloc(12);
    details.writeUInt8(Number(event.kind) === AREA_EFFECT_KIND_BEAM ? AREA_EFFECT_KIND_BEAM : AREA_EFFECT_KIND_AREA, 0);
    details.writeUInt16LE(clamp(Math.floor(Number(event.xQ) || 0), 0, 65535), 1);
    details.writeUInt16LE(clamp(Math.floor(Number(event.yQ) || 0), 0, 65535), 3);
    details.writeUInt16LE(clamp(Math.floor(Number(event.radiusQ) || 0), 1, 65535), 5);
    details.writeUInt16LE(clamp(Math.floor(Number(event.remainingMs) || 0), 1, 65535), 7);
    details.writeUInt16LE(clamp(Math.floor(Number(event.durationMs) || 0), 1, 65535), 9);
    details.writeUInt8(abilityBytes.length, 11);
    parts.push(details);
    if (abilityBytes.length) {
      parts.push(abilityBytes);
    }

    if (Number(event.kind) === AREA_EFFECT_KIND_BEAM) {
      const beam = Buffer.alloc(12);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.startXQ) || 0), 0, 65535), 0);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.startYQ) || 0), 0, 65535), 2);
      beam.writeInt16LE(clamp(Math.floor(Number(event.dxQ) || 0), -32767, 32767), 4);
      beam.writeInt16LE(clamp(Math.floor(Number(event.dyQ) || 0), -32767, 32767), 6);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.lengthQ) || 0), 1, 65535), 8);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.widthQ) || 0), 1, 65535), 10);
      parts.push(beam);
    }
  }

  return Buffer.concat(parts);
}

function encodeMobMetaPacket(mobsMeta) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(MOB_META_PROTO_TYPE, 0);
  header.writeUInt8(MOB_META_PROTO_VERSION, 1);
  header.writeUInt16LE(mobsMeta.length, 2);
  parts.push(header);

  for (const meta of mobsMeta) {
    const id = clamp(Math.floor(Number(meta && meta.id) || 0), 0, 255);
    const nameBytesRaw = Buffer.from(String((meta && meta.name) || "Mob"), "utf8");
    const nameBytes = nameBytesRaw.length > 255 ? nameBytesRaw.subarray(0, 255) : nameBytesRaw;

    let styleString = "";
    if (meta && meta.renderStyle && typeof meta.renderStyle === "object") {
      try {
        styleString = JSON.stringify(meta.renderStyle);
      } catch (_error) {
        styleString = "";
      }
    }
    const styleBytesRaw = Buffer.from(styleString, "utf8");
    const styleBytes = styleBytesRaw.length > 65535 ? styleBytesRaw.subarray(0, 65535) : styleBytesRaw;

    const recordHeader = Buffer.alloc(4);
    recordHeader.writeUInt8(id, 0);
    recordHeader.writeUInt8(nameBytes.length, 1);
    recordHeader.writeUInt16LE(styleBytes.length, 2);
    parts.push(recordHeader);
    if (nameBytes.length) {
      parts.push(nameBytes);
    }
    if (styleBytes.length) {
      parts.push(styleBytes);
    }
  }

  return Buffer.concat(parts);
}

function encodeProjectileMetaPacket(projectileMeta) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(PROJECTILE_META_PROTO_TYPE, 0);
  header.writeUInt8(PROJECTILE_META_PROTO_VERSION, 1);
  header.writeUInt16LE(projectileMeta.length, 2);
  parts.push(header);

  for (const meta of projectileMeta) {
    const id = clamp(Math.floor(Number(meta && meta.id) || 0), 0, 255);
    const abilityBytesRaw = Buffer.from(String((meta && meta.abilityId) || ""), "utf8");
    const abilityBytes = abilityBytesRaw.length > 255 ? abilityBytesRaw.subarray(0, 255) : abilityBytesRaw;
    const recordHeader = Buffer.alloc(2);
    recordHeader.writeUInt8(id, 0);
    recordHeader.writeUInt8(abilityBytes.length, 1);
    parts.push(recordHeader);
    if (abilityBytes.length) {
      parts.push(abilityBytes);
    }
  }

  return Buffer.concat(parts);
}

function encodeDamageEventPacket(events) {
  const header = Buffer.alloc(4);
  header.writeUInt8(DAMAGE_EVENT_PROTO_TYPE, 0);
  header.writeUInt8(DAMAGE_EVENT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  const recordSize = 6;
  const body = Buffer.alloc(events.length * recordSize);
  let offset = 0;
  for (const event of events) {
    const xQ = quantizePos(Number(event && event.x));
    const yQ = quantizePos(Number(event && event.y));
    const amount = clamp(Math.floor(Number(event && event.amount) || 0), 0, 255);
    let flags = 0;
    if (String(event && event.targetType || "").toLowerCase() === "player") {
      flags |= DAMAGE_EVENT_FLAG_TARGET_PLAYER;
    }
    if (event && event.fromSelf) {
      flags |= DAMAGE_EVENT_FLAG_FROM_SELF;
    }

    body.writeUInt16LE(xQ, offset);
    body.writeUInt16LE(yQ, offset + 2);
    body.writeUInt8(amount, offset + 4);
    body.writeUInt8(flags, offset + 5);
    offset += recordSize;
  }

  return Buffer.concat([header, body]);
}

function processSelfUpdate(sync, player) {
  const state = {
    x: quantizePos(player.x),
    y: quantizePos(player.y),
    hp: clamp(player.hp, 0, 255),
    maxHp: clamp(player.maxHp, 0, 255),
    mana: clamp(Math.round((Number(player.mana) || 0) * MANA_SCALE), 0, 65535),
    maxMana: clamp(Math.round((Number(player.maxMana) || 0) * MANA_SCALE), 0, 65535),
    pendingHeal: clamp(Math.round(getPendingHealAmount(player) * HEAL_SCALE), 0, 65535),
    pendingMana: clamp(Math.round(getPendingManaAmount(player) * MANA_SCALE), 0, 65535),
    copper: clamp(player.copper, 0, 65535),
    level: clamp(player.level, 1, 65535),
    exp: clamp(player.exp, 0, 4294967295),
    expToNext: clamp(player.expToNext, 1, 4294967295)
  };

  const previous = sync.selfState;
  if (!previous) {
    sync.selfState = state;
    return {
      mode: SELF_MODE_FULL,
      flags: 0,
      ...state
    };
  }

  const dx = state.x - previous.x;
  const dy = state.y - previous.y;
  let flags = 0;
  if (state.hp !== previous.hp) {
    flags |= DELTA_FLAG_HP_CHANGED;
  }
  if (state.maxHp !== previous.maxHp) {
    flags |= DELTA_FLAG_MAX_HP_CHANGED;
  }
  if (state.mana !== previous.mana) {
    flags |= DELTA_FLAG_MANA_CHANGED;
  }
  if (state.maxMana !== previous.maxMana) {
    flags |= DELTA_FLAG_MAX_MANA_CHANGED;
  }
  if (state.pendingHeal !== previous.pendingHeal) {
    flags |= DELTA_FLAG_PENDING_HEAL_CHANGED;
  }
  if (state.pendingMana !== previous.pendingMana) {
    flags |= SELF_FLAG_PENDING_MANA_CHANGED;
  }
  if (state.copper !== previous.copper) {
    flags |= DELTA_FLAG_COPPER_CHANGED;
  }
  if (state.level !== previous.level || state.exp !== previous.exp || state.expToNext !== previous.expToNext) {
    flags |= DELTA_FLAG_PROGRESS_CHANGED;
  }

  const changed = dx !== 0 || dy !== 0 || flags !== 0;
  if (!changed) {
    return { mode: SELF_MODE_NONE, flags: 0 };
  }

  sync.selfState = state;
  if (Math.abs(dx) <= 127 && Math.abs(dy) <= 127) {
    return {
      mode: SELF_MODE_DELTA,
      flags,
      dx,
      dy,
      hp: state.hp,
      maxHp: state.maxHp,
      mana: state.mana,
      maxMana: state.maxMana,
      pendingHeal: state.pendingHeal,
      pendingMana: state.pendingMana
    };
  }

  return {
    mode: SELF_MODE_FULL,
    flags: 0,
    ...state
  };
}

function encodeSelfUpdate(update) {
  if (update.mode === SELF_MODE_NONE) {
    return Buffer.alloc(0);
  }

  if (update.mode === SELF_MODE_FULL) {
    const buffer = Buffer.alloc(26);
    buffer.writeUInt16LE(update.x, 0);
    buffer.writeUInt16LE(update.y, 2);
    buffer.writeUInt8(update.hp, 4);
    buffer.writeUInt8(update.maxHp, 5);
    buffer.writeUInt16LE(update.mana, 6);
    buffer.writeUInt16LE(update.maxMana, 8);
    buffer.writeUInt16LE(update.pendingHeal, 10);
    buffer.writeUInt16LE(update.pendingMana, 12);
    buffer.writeUInt16LE(update.copper, 14);
    buffer.writeUInt16LE(update.level, 16);
    buffer.writeUInt32LE(update.exp, 18);
    buffer.writeUInt32LE(update.expToNext, 22);
    return buffer;
  }

  const bytes = [update.dx & 0xff, update.dy & 0xff];
  if (update.flags & DELTA_FLAG_HP_CHANGED) {
    bytes.push(update.hp & 0xff);
  }
  if (update.flags & DELTA_FLAG_MAX_HP_CHANGED) {
    bytes.push(update.maxHp & 0xff);
  }
  if (update.flags & DELTA_FLAG_MANA_CHANGED) {
    bytes.push(update.mana & 0xff, (update.mana >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_MAX_MANA_CHANGED) {
    bytes.push(update.maxMana & 0xff, (update.maxMana >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_PENDING_HEAL_CHANGED) {
    bytes.push(update.pendingHeal & 0xff, (update.pendingHeal >> 8) & 0xff);
  }
  if (update.flags & SELF_FLAG_PENDING_MANA_CHANGED) {
    bytes.push(update.pendingMana & 0xff, (update.pendingMana >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_COPPER_CHANGED) {
    bytes.push(update.copper & 0xff, (update.copper >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_PROGRESS_CHANGED) {
    bytes.push(update.level & 0xff, (update.level >> 8) & 0xff);
    bytes.push(update.exp & 0xff, (update.exp >> 8) & 0xff, (update.exp >> 16) & 0xff, (update.exp >> 24) & 0xff);
    bytes.push(
      update.expToNext & 0xff,
      (update.expToNext >> 8) & 0xff,
      (update.expToNext >> 16) & 0xff,
      (update.expToNext >> 24) & 0xff
    );
  }
  return Buffer.from(bytes);
}

function buildEntityUpdatePacket(player, visiblePlayers, visibleMobs, visibleProjectiles, visibleLootBags) {
  const sync = player.entitySync;
  const selfUpdate = processSelfUpdate(sync, player);
  const playerUpdates = processVisibleEntities(sync, "player", visiblePlayers);
  const mobUpdates = processVisibleEntities(sync, "mob", visibleMobs);
  const projectileUpdates = processVisibleProjectiles(sync, visibleProjectiles);
  const lootBagUpdates = processVisibleLootBags(sync, visibleLootBags);

  const selfBuffer = encodeSelfUpdate(selfUpdate);
  const fullPlayersBuffer = encodeFullRecords(playerUpdates.full);
  const deltaPlayersBuffer = encodeDeltaRecords(playerUpdates.delta);
  const fullMobsBuffer = encodeFullRecords(mobUpdates.full);
  const deltaMobsBuffer = encodeDeltaRecords(mobUpdates.delta);
  const fullProjectilesBuffer = encodeProjectileFullRecords(projectileUpdates.full);
  const deltaProjectilesBuffer = encodeProjectileDeltaRecords(projectileUpdates.delta);
  const fullLootBagsBuffer = encodeProjectileFullRecords(lootBagUpdates.full);
  const deltaLootBagsBuffer = encodeProjectileDeltaRecords(lootBagUpdates.delta);

  const header = Buffer.alloc(20);
  header.writeUInt8(ENTITY_PROTO_TYPE, 0);
  header.writeUInt8(ENTITY_PROTO_VERSION, 1);
  header.writeUInt8(selfUpdate.mode, 2);
  header.writeUInt8(selfUpdate.flags, 3);
  header.writeUInt16LE(playerUpdates.full.length, 4);
  header.writeUInt16LE(playerUpdates.delta.length, 6);
  header.writeUInt16LE(mobUpdates.full.length, 8);
  header.writeUInt16LE(mobUpdates.delta.length, 10);
  header.writeUInt16LE(projectileUpdates.full.length, 12);
  header.writeUInt16LE(projectileUpdates.delta.length, 14);
  header.writeUInt16LE(lootBagUpdates.full.length, 16);
  header.writeUInt16LE(lootBagUpdates.delta.length, 18);

  const hasAnyUpdate =
    selfUpdate.mode !== SELF_MODE_NONE ||
    playerUpdates.full.length > 0 ||
    playerUpdates.delta.length > 0 ||
    mobUpdates.full.length > 0 ||
    mobUpdates.delta.length > 0 ||
    projectileUpdates.full.length > 0 ||
    projectileUpdates.delta.length > 0 ||
    lootBagUpdates.full.length > 0 ||
    lootBagUpdates.delta.length > 0;

  return {
    packet: hasAnyUpdate
      ? Buffer.concat([
          header,
          selfBuffer,
          fullPlayersBuffer,
          deltaPlayersBuffer,
          fullMobsBuffer,
          deltaMobsBuffer,
          fullProjectilesBuffer,
          deltaProjectilesBuffer,
          fullLootBagsBuffer,
          deltaLootBagsBuffer
        ])
      : null,
    playerMeta: playerUpdates.meta,
    mobMeta: mobUpdates.meta,
    projectileMeta: projectileUpdates.meta,
    lootBagMeta: lootBagUpdates.meta
  };
}

function broadcastState() {
  for (const player of players.values()) {
    const now = Date.now();
    const nearbyPlayers = [];
    const nearbyPlayerObjects = [];
    const nearbyMobs = [];
    const nearbyMobObjects = [];
    const nearbyProjectiles = [];
    const nearbyLootBags = [];

    for (const other of players.values()) {
      if (other.id === player.id) {
        continue;
      }
      if (inVisibilityRange(player, other, VISIBILITY_RANGE)) {
        nearbyPlayers.push(serializePlayer(other));
        nearbyPlayerObjects.push(other);
      }
    }

    for (const projectile of projectiles.values()) {
      if (inVisibilityRange(player, projectile, VISIBILITY_RANGE)) {
        nearbyProjectiles.push({
          id: projectile.id,
          ownerId: projectile.ownerId,
          abilityId: projectile.abilityId,
          x: projectile.x,
          y: projectile.y
        });
      }
    }

    for (const mob of mobs.values()) {
      if (!mob.alive) {
        continue;
      }
      if (inVisibilityRange(player, mob, VISIBILITY_RANGE)) {
        nearbyMobs.push(serializeMob(mob));
        nearbyMobObjects.push(mob);
      }
    }

    for (const bag of lootBags.values()) {
      if (inVisibilityRange(player, bag, VISIBILITY_RANGE)) {
        nearbyLootBags.push(bag);
      }
    }

    const entityUpdate = buildEntityUpdatePacket(player, nearbyPlayers, nearbyMobs, nearbyProjectiles, nearbyLootBags);

    if (entityUpdate.playerMeta.length) {
      sendJson(player.ws, {
        type: "player_meta",
        players: entityUpdate.playerMeta
      });
    }
    if (entityUpdate.mobMeta.length) {
      sendBinary(player.ws, encodeMobMetaPacket(entityUpdate.mobMeta));
    }
    if (entityUpdate.projectileMeta.length) {
      sendBinary(player.ws, encodeProjectileMetaPacket(entityUpdate.projectileMeta));
    }
    if (entityUpdate.lootBagMeta.length) {
      sendJson(player.ws, {
        type: "lootbag_meta",
        bags: entityUpdate.lootBagMeta
      });
    }

    const swingEvents = buildPlayerSwingEventsForRecipient(player, nearbyPlayerObjects);
    if (swingEvents.length) {
      sendJson(player.ws, {
        type: "player_swings",
        swings: swingEvents
      });
    }

    const castEvents = buildPlayerCastEventsForRecipient(player, nearbyPlayerObjects, now);
    if (castEvents.casts.length || castEvents.self) {
      sendJson(player.ws, {
        type: "player_casts",
        casts: castEvents.casts,
        self: castEvents.self
      });
    }

    const biteEvents = buildMobBiteEventsForRecipient(player, nearbyMobObjects);
    if (biteEvents.length) {
      sendJson(player.ws, {
        type: "mob_bites",
        bites: biteEvents
      });
    }

    const mobEffectEvents = buildMobEffectEventsForRecipient(player, nearbyMobObjects, now);
    if (mobEffectEvents.length) {
      sendBinary(player.ws, encodeMobEffectEventPacket(mobEffectEvents));
    }

    const areaEffectEvents = buildAreaEffectEventsForRecipient(player, now);
    if (areaEffectEvents.length) {
      sendBinary(player.ws, encodeAreaEffectEventPacket(areaEffectEvents));
    }

    if (pendingDamageEvents.length) {
      const visibleDamageEvents = [];
      for (const event of pendingDamageEvents) {
        if (inVisibilityRange(player, event, VISIBILITY_RANGE)) {
          visibleDamageEvents.push({
            x: event.x,
            y: event.y,
            amount: event.amount,
            targetType: event.targetType,
            fromSelf: !!(event.sourcePlayerId && event.sourcePlayerId === player.id)
          });
        }
      }
      if (visibleDamageEvents.length) {
        sendBinary(player.ws, encodeDamageEventPacket(visibleDamageEvents));
      }
    }

    if (pendingExplosionEvents.length) {
      const visibleExplosionEvents = [];
      for (const event of pendingExplosionEvents) {
        const range = VISIBILITY_RANGE + Math.max(0, Number(event.radius) || 0);
        if (inVisibilityRange(player, event, range)) {
          visibleExplosionEvents.push(event);
        }
      }
      if (visibleExplosionEvents.length) {
        sendJson(player.ws, {
          type: "explosion_events",
          events: visibleExplosionEvents
        });
      }
    }

    if (pendingProjectileHitEvents.length) {
      const visibleProjectileHitEvents = [];
      for (const event of pendingProjectileHitEvents) {
        if (inVisibilityRange(player, event, VISIBILITY_RANGE + 2)) {
          visibleProjectileHitEvents.push(event);
        }
      }
      if (visibleProjectileHitEvents.length) {
        sendJson(player.ws, {
          type: "projectile_hit_events",
          events: visibleProjectileHitEvents
        });
      }
    }

    if (pendingMobDeathEvents.length) {
      const visibleMobDeathEvents = [];
      for (const event of pendingMobDeathEvents) {
        if (inVisibilityRange(player, event, VISIBILITY_RANGE + 2)) {
          visibleMobDeathEvents.push(event);
        }
      }
      if (visibleMobDeathEvents.length) {
        sendJson(player.ws, {
          type: "mob_death_events",
          events: visibleMobDeathEvents
        });
      }
    }

    if (entityUpdate.packet) {
      sendBinary(player.ws, entityUpdate.packet);
    }
  }

  pendingDamageEvents.length = 0;
  pendingExplosionEvents.length = 0;
  pendingProjectileHitEvents.length = 0;
  pendingMobDeathEvents.length = 0;
}

wss.on("connection", (ws) => {
  let player = null;

  sendJson(ws, {
    type: "hello",
    message: "Send join message with name and classType.",
    classes: CLASS_CONFIG.clientClassDefs,
    abilities: ABILITY_CONFIG.clientAbilityDefs
  });

  ws.on("message", (rawMessage) => {
    let msg;
    try {
      msg = JSON.parse(String(rawMessage));
    } catch (_error) {
      sendJson(ws, { type: "error", message: "Invalid JSON." });
      return;
    }

    if (!msg || typeof msg.type !== "string") {
      sendJson(ws, { type: "error", message: "Invalid message shape." });
      return;
    }

    if (msg.type === "join") {
      if (player) {
        sendJson(ws, { type: "error", message: "Already joined." });
        return;
      }

      const name = String(msg.name || "").trim().slice(0, 24);
      const classType = String(msg.classType || "").trim();
      const classDef = CLASS_CONFIG.classDefs.get(classType) || null;

      if (!name || !classDef) {
        sendJson(ws, {
          type: "error",
          message: "Join requires non-empty name and a valid classType from class config."
        });
        return;
      }

      const spawn = randomSpawn();
      player = {
        id: String(nextPlayerId++),
        ws,
        name,
        classType,
        x: spawn.x,
        y: spawn.y,
        hp: classDef.baseHealth,
        maxHp: classDef.baseHealth,
        mana: classDef.baseMana,
        maxMana: classDef.baseMana,
        manaRegen: classDef.manaRegen,
        moveSpeed: classDef.movementSpeed,
        activeHeals: [],
        activeManaRestores: [],
        copper: 0,
        level: 1,
        exp: 0,
        expToNext: expNeededForLevel(1),
        skillPoints: 0,
        abilityLevels: new Map(classDef.abilities.map((entry) => [entry.id, entry.level])),
        abilityLastUsedAt: new Map(),
        activeCast: null,
        castStateVersion: 0,
        invulnerableUntil: 0,
        inventorySlots: createEmptyInventorySlots(),
        input: { dx: 0, dy: 0 },
        lastDirection: { dx: 0, dy: 1 },
        lastSwingDirection: { dx: 0, dy: 1 },
        swingCounter: 0,
        entitySync: {
          playerSlotsByRealId: new Map(),
          playerRealIdBySlot: new Map(),
          playerStatesBySlot: new Map(),
          playerSwingBySlot: new Map(),
          playerCastVersionBySlot: new Map(),
          selfCastVersion: null,
          freePlayerSlots: [],
          nextPlayerSlot: 1,
          mobSlotsByRealId: new Map(),
          mobRealIdBySlot: new Map(),
          mobStatesBySlot: new Map(),
          mobBiteBySlot: new Map(),
          mobMetaSignatureBySlot: new Map(),
          mobEffectStatesBySlot: new Map(),
          freeMobSlots: [],
          nextMobSlot: 1,
          projectileSlotsByRealId: new Map(),
          projectileRealIdBySlot: new Map(),
          projectileStatesBySlot: new Map(),
          projectileMetaBySlot: new Map(),
          freeProjectileSlots: [],
          nextProjectileSlot: 1,
          lootBagSlotsByRealId: new Map(),
          lootBagRealIdBySlot: new Map(),
          lootBagStatesBySlot: new Map(),
          lootBagMetaVersionBySlot: new Map(),
          freeLootBagSlots: [],
          nextLootBagSlot: 1,
          selfState: null,
          areaEffectStatesById: new Map()
        }
      };

      const starterItems = normalizeItemEntries(classDef.startingItems);
      if (starterItems.length) {
        addItemsToInventory(player, starterItems);
      }
      syncPlayerCopperFromInventory(player, false);
      players.set(player.id, player);

      sendJson(ws, {
        type: "welcome",
        id: player.id,
        selfStatic: {
          id: player.id,
          name: player.name,
          classType: player.classType,
          mana: player.mana,
          maxMana: player.maxMana
        },
        map: { width: MAP_WIDTH, height: MAP_HEIGHT },
        visibilityRange: VISIBILITY_RANGE
      });
      sendJson(ws, {
        type: "class_defs",
        classes: CLASS_CONFIG.clientClassDefs,
        abilities: ABILITY_CONFIG.clientAbilityDefs
      });
      sendJson(ws, {
        type: "item_defs",
        items: ITEM_CONFIG.clientItemDefs
      });
      sendInventoryState(player);
      sendSelfProgress(player);
      return;
    }

    if (!player) {
      sendJson(ws, { type: "error", message: "Must join first." });
      return;
    }

    if (msg.type === "move") {
      if (player.hp <= 0) {
        player.input = { dx: 0, dy: 0 };
        return;
      }

      const dx = Number(msg.dx);
      const dy = Number(msg.dy);

      if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        sendJson(ws, { type: "error", message: "Move requires numeric dx, dy." });
        return;
      }

      const moveX = clamp(dx, -1, 1);
      const moveY = clamp(dy, -1, 1);
      const normalized = normalizeDirection(moveX, moveY);

      if (!normalized) {
        player.input = { dx: 0, dy: 0 };
        return;
      }

      if (player.activeCast) {
        clearPlayerCast(player);
      }
      player.input = normalized;
      player.lastDirection = normalized;
      return;
    }

    if (msg.type === "use_ability") {
      const abilityId = String(msg.abilityId || "").trim();
      const dx = Number(msg.dx);
      const dy = Number(msg.dy);
      const distance = Number(msg.distance);
      if (!abilityId || !Number.isFinite(dx) || !Number.isFinite(dy)) {
        return;
      }
      usePlayerAbility(player, abilityId, dx, dy, Number.isFinite(distance) ? distance : null);
      return;
    }

    if (msg.type === "level_up_ability") {
      const abilityId = String(msg.abilityId || "").trim();
      if (!abilityId) {
        return;
      }
      if (levelUpPlayerAbility(player, abilityId)) {
        sendSelfProgress(player);
      }
      return;
    }

    if (msg.type === "cast") {
      const dx = Number(msg.dx);
      const dy = Number(msg.dy);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return;
      }
      usePlayerAbility(player, "fireball", dx, dy);
      return;
    }

    if (msg.type === "melee_attack") {
      const dx = Number(msg.dx);
      const dy = Number(msg.dy);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return;
      }
      usePlayerAbility(player, "slash", dx, dy);
      return;
    }

    if (msg.type === "pickup_bag") {
      if (player.hp <= 0) {
        return;
      }
      const targetX = Number(msg.x);
      const targetY = Number(msg.y);
      tryPickupLootBag(player, targetX, targetY);
      return;
    }

    if (msg.type === "inventory_move") {
      const from = Math.floor(Number(msg.from));
      const to = Math.floor(Number(msg.to));
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        return;
      }
      if (mergeOrSwapInventorySlots(player, from, to)) {
        sendInventoryState(player);
      }
      return;
    }

    if (msg.type === "use_item") {
      if (player.hp <= 0) {
        return;
      }

      const itemId = String(msg.itemId || "").trim();
      if (!itemId) {
        return;
      }
      const itemDef = ITEM_CONFIG.itemDefs.get(itemId);
      if (!itemDef || !itemDef.effect || typeof itemDef.effect.type !== "string") {
        return;
      }
      const effectType = String(itemDef.effect.type).trim().toLowerCase();
      if (effectType !== "heal" && effectType !== "mana") {
        return;
      }
      const effectValue = Math.max(0, Number(itemDef.effect.value) || 0);
      const effectDuration = Math.max(0, Number(itemDef.effect.duration) || 0);
      if (effectValue <= 0) {
        return;
      }
      if (!consumeInventoryItem(player, itemId, 1)) {
        return;
      }

      let healedNow = 0;
      let restoredManaNow = 0;
      let overTime = false;
      if (effectType === "heal") {
        if (effectDuration > 0) {
          overTime = addHealOverTimeEffect(player, effectValue, effectDuration);
        } else {
          const beforeHp = player.hp;
          player.hp = clamp(player.hp + effectValue, 0, player.maxHp);
          healedNow = Math.max(0, player.hp - beforeHp);
        }
      } else {
        if (effectDuration > 0) {
          overTime = addManaOverTimeEffect(player, effectValue, effectDuration);
        } else {
          const beforeMana = player.mana;
          player.mana = clamp(player.mana + effectValue, 0, player.maxMana);
          restoredManaNow = Math.max(0, player.mana - beforeMana);
        }
      }

      sendInventoryState(player);
      syncPlayerCopperFromInventory(player, true);
      sendJson(player.ws, {
        type: "item_used",
        itemId,
        hp: player.hp,
        mana: player.mana,
        effectType,
        healed: healedNow,
        restoredMana: restoredManaNow,
        overTime,
        effectValue,
        effectDuration
      });
      return;
    }
  });

  ws.on("close", () => {
    if (player) {
      players.delete(player.id);
    }
  });
});

setInterval(() => {
  tickPlayers();
  tickPlayerCasts(Date.now());
  tickAreaEffects(Date.now());
  tickMobs();
  tickProjectiles();
  broadcastState();
}, TICK_MS);

initializeMobSpawners();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Initialized ${mobSpawners.size} mob spawners and ${mobs.size} mobs.`);
});
