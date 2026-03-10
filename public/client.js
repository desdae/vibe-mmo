const joinScreen = document.getElementById("join-screen");
const joinForm = document.getElementById("join-form");
const gameUI = document.getElementById("game-ui");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hudName = document.getElementById("hud-name");
const hudClass = document.getElementById("hud-class");
const hudPos = document.getElementById("hud-pos");
const classTypeSelect = document.getElementById("classType");
const actionUi = document.getElementById("action-ui");
const resourceBars = document.getElementById("resource-bars");
const debuffIcons = document.getElementById("debuff-icons");
const hpPredictFill = document.getElementById("hp-predict-fill");
const hpFill = document.getElementById("hp-fill");
const hpText = document.getElementById("hp-text");
const manaPredictFill = document.getElementById("mana-predict-fill");
const manaFill = document.getElementById("mana-fill");
const manaText = document.getElementById("mana-text");
const expFill = document.getElementById("exp-fill");
const expText = document.getElementById("exp-text");
const spellbookPanel = document.getElementById("spellbook-panel");
const spellbookGrid = document.getElementById("spellbook-grid");
const actionBar = document.getElementById("action-bar");
const inventoryPanel = document.getElementById("inventory-panel");
const inventoryGrid = document.getElementById("inventory-grid");
const debugPanel = document.getElementById("debug-panel");
const debugNet = document.getElementById("debug-net");
const dpsPanel = document.getElementById("dps-panel");
const dpsTabs = document.getElementById("dps-tabs");
const dpsValue = document.getElementById("dps-value");

const TILE_SIZE = 32;
const INTERPOLATION_DELAY_MS = 100;
const MAX_SNAPSHOTS = 120;
const TRAFFIC_WINDOW_MS = 10000;
const MOB_RENDER_RADIUS = 12;
const MOB_SPRITE_SIZE = 36;
const DAMAGE_FLOAT_DURATION_MS = 850;
const INVENTORY_SLOT_SIZE_PX = 50;
const INVENTORY_SLOT_GAP_PX = 6;
const INVENTORY_PANEL_PADDING_PX = 10;
const INVENTORY_PANEL_BORDER_PX = 1;
const sharedAbilityNormalization = globalThis.VibeAbilityNormalization || null;
const sharedCreateAbilityNormalizationTools =
  sharedAbilityNormalization && typeof sharedAbilityNormalization.createAbilityNormalizationTools === "function"
    ? sharedAbilityNormalization.createAbilityNormalizationTools
    : null;
const sharedAbilityStats = globalThis.VibeAbilityStats || null;
const sharedGetAbilityDamageRange =
  sharedAbilityStats && typeof sharedAbilityStats.getAbilityDamageRange === "function"
    ? sharedAbilityStats.getAbilityDamageRange
    : null;
const sharedGetAbilityRangeForLevel =
  sharedAbilityStats && typeof sharedAbilityStats.getAbilityRangeForLevel === "function"
    ? sharedAbilityStats.getAbilityRangeForLevel
    : null;
const sharedGetAbilityCooldownMsForLevel =
  sharedAbilityStats && typeof sharedAbilityStats.getAbilityCooldownMsForLevel === "function"
    ? sharedAbilityStats.getAbilityCooldownMsForLevel
    : null;
const clientAbilityNormalizationTools = sharedCreateAbilityNormalizationTools
  ? sharedCreateAbilityNormalizationTools({ defaultProjectileHitRadius: 0.6 })
  : null;
const sharedMobRenderStyle = globalThis.VibeMobRenderStyle || null;
const sharedParseMobRenderStyle =
  sharedMobRenderStyle && typeof sharedMobRenderStyle.parseMobRenderStyle === "function"
    ? sharedMobRenderStyle.parseMobRenderStyle
    : null;
const sharedNumberUtils = globalThis.VibeNumberUtils || null;
const sharedClamp =
  sharedNumberUtils && typeof sharedNumberUtils.clamp === "function" ? sharedNumberUtils.clamp : null;
const sharedVectorUtils = globalThis.VibeVectorUtils || null;
const sharedNormalizeDirection =
  sharedVectorUtils && typeof sharedVectorUtils.normalizeDirection === "function"
    ? sharedVectorUtils.normalizeDirection
    : null;
const protocol = globalThis.VibeProtocol || {
  ENTITY_PROTO_TYPE: 1,
  ENTITY_PROTO_VERSION: 7,
  MOB_EFFECT_PROTO_TYPE: 2,
  MOB_EFFECT_PROTO_VERSION: 1,
  AREA_EFFECT_PROTO_TYPE: 3,
  AREA_EFFECT_PROTO_VERSION: 1,
  MOB_META_PROTO_TYPE: 4,
  MOB_META_PROTO_VERSION: 1,
  PROJECTILE_META_PROTO_TYPE: 5,
  PROJECTILE_META_PROTO_VERSION: 1,
  DAMAGE_EVENT_PROTO_TYPE: 6,
  DAMAGE_EVENT_PROTO_VERSION: 1,
  DAMAGE_EVENT_FLAG_TARGET_PLAYER: 1 << 0,
  DAMAGE_EVENT_FLAG_FROM_SELF: 1 << 1,
  MOB_EFFECT_FLAG_STUN: 1 << 0,
  MOB_EFFECT_FLAG_SLOW: 1 << 1,
  MOB_EFFECT_FLAG_REMOVE: 1 << 2,
  MOB_EFFECT_FLAG_BURN: 1 << 3,
  AREA_EFFECT_OP_UPSERT: 1,
  AREA_EFFECT_OP_REMOVE: 2,
  AREA_EFFECT_KIND_AREA: 0,
  AREA_EFFECT_KIND_BEAM: 1,
  POS_SCALE: 64,
  MANA_SCALE: 10,
  HEAL_SCALE: 10,
  DELTA_FLAG_HP_CHANGED: 1 << 0,
  DELTA_FLAG_MAX_HP_CHANGED: 1 << 1,
  DELTA_FLAG_REMOVED: 1 << 2,
  DELTA_FLAG_COPPER_CHANGED: 1 << 3,
  DELTA_FLAG_PROGRESS_CHANGED: 1 << 4,
  DELTA_FLAG_MANA_CHANGED: 1 << 5,
  DELTA_FLAG_MAX_MANA_CHANGED: 1 << 6,
  DELTA_FLAG_PENDING_HEAL_CHANGED: 1 << 7,
  SELF_FLAG_PENDING_MANA_CHANGED: 1 << 2,
  SELF_MODE_NONE: 0,
  SELF_MODE_FULL: 1,
  SELF_MODE_DELTA: 2
};
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
} = protocol;
const sharedProtocolCodecs = globalThis.VibeProtocolCodecs || null;
const dequantizePos =
  sharedProtocolCodecs && typeof sharedProtocolCodecs.dequantizePos === "function"
    ? sharedProtocolCodecs.dequantizePos
    : (valueQ) => (Number(valueQ) || 0) / POS_SCALE;
const decodeDamageEventFlags =
  sharedProtocolCodecs && typeof sharedProtocolCodecs.decodeDamageEventFlags === "function"
    ? sharedProtocolCodecs.decodeDamageEventFlags
    : (flags) => ({
        targetType: flags & DAMAGE_EVENT_FLAG_TARGET_PLAYER ? "player" : "mob",
        fromSelf: !!(flags & DAMAGE_EVENT_FLAG_FROM_SELF)
      });

let socket = null;
let myId = null;
let lastRenderState = null;
let selfStatic = null;
let pendingJoinInfo = null;
let nextDamageFloatId = 1;
let nextExplosionFxId = 1;

const gameState = {
  map: { width: 1000, height: 1000 },
  visibilityRange: 20,
  self: null,
  players: [],
  projectiles: [],
  mobs: [],
  lootBags: []
};

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false
};

const movementSync = {
  lastDx: 0,
  lastDy: 0,
  lastSentAt: 0
};
const ABILITY_AUDIO_EVENTS = ["channel", "cast", "hit"];
const ABILITY_SPATIAL_LEGACY_FLYING = Object.freeze({
  arcanemissiles: "arcane_missile_flying",
  frostbolt: "frostbolt_flying"
});
const DEFAULT_SPATIAL_AUDIO_CONFIG = Object.freeze({
  abilitySpatialMaxDistance: 15,
  abilityPanDistance: 15,
  projectileMaxConcurrent: 10
});
const SPATIAL_AUDIO_MISSING_RETRY_MS = 2500;
const spatialAudioConfig = {
  ...DEFAULT_SPATIAL_AUDIO_CONFIG
};
const abilityAudioRegistry = new Map();
const availableSoundUrls = new Set();
let soundManifestLoaded = false;
const mobEventAudioState = {
  resolvedUrlByEvent: new Map(),
  lastPlayedAtByEventKey: new Map()
};
const spatialAudioState = {
  context: null,
  masterGain: null,
  resolvedUrlByEvent: new Map(),
  oneShotCache: new Map(),
  loopSources: new Map(),
  loopPending: new Set(),
  loopSlotSet: new Set(),
  lastEventAtByKey: new Map()
};
const swordSwing = {
  activeUntil: 0,
  durationMs: 170,
  angle: 0
};
const abilityChannel = {
  active: false,
  abilityId: "",
  startedAt: 0,
  durationMs: 0,
  targetX: 0,
  targetY: 0
};
const mouseState = {
  leftDown: false,
  sx: 0,
  sy: 0
};
const remotePlayerSwings = new Map();
const remotePlayerCasts = new Map();
const remoteMobBites = new Map();
const remoteMobCasts = new Map();
const remoteMobStuns = new Map();
const remoteMobSlows = new Map();
const remoteMobBurns = new Map();
const mobSpriteCache = new Map();
const projectileVisualRuntime = new Map();
const zombieWalkFramesCache = new Map();
const zombieWalkRuntime = new Map();
const creeperWalkFramesCache = new Map();
const creeperWalkRuntime = new Map();
const spiderWalkFramesCache = new Map();
const spiderWalkRuntime = new Map();
const orcWalkFramesCache = new Map();
const orcNoAxesWalkFramesCache = new Map();
const orcWalkRuntime = new Map();
const skeletonWalkFramesCache = new Map();
const skeletonNoSwordWalkFramesCache = new Map();
const skeletonWalkRuntime = new Map();
const skeletonArcherWalkFramesCache = new Map();
const skeletonArcherNoBowWalkFramesCache = new Map();
const skeletonArcherWalkRuntime = new Map();
const warriorAnimRuntime = new Map();
const snapshots = [];
const floatingDamageNumbers = [];
const activeExplosions = [];
const activeAreaEffectsById = new Map();
const actionSlotEls = new Map();
const actionBindings = new Map();
let actionBindingsClassType = null;
const classDefsById = new Map();
const abilityDefsById = new Map();
const abilityRuntime = new Map();
const itemDefsById = new Map();
const iconUrlCache = new Map();
const dragState = {
  source: "",
  inventoryFrom: null,
  fromActionSlot: "",
  itemId: "",
  actionBinding: ""
};
const inventoryState = {
  cols: 5,
  rows: 2,
  slots: []
};
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const debugState = {
  enabled: false,
  upEvents: [],
  downEvents: [],
  upBytesWindow: 0,
  downBytesWindow: 0
};
const dpsState = {
  enabled: false,
  selectedWindowSec: 60,
  samples: []
};
const selfNegativeEffects = {
  stun: null,
  slow: null,
  burn: null
};
const remotePlayerStuns = new Map();
const remotePlayerSlows = new Map();
const remotePlayerBurns = new Map();
const entityRuntime = {
  self: null,
  players: new Map(),
  mobMeta: new Map(),
  mobs: new Map(),
  projectileMeta: new Map(),
  projectiles: new Map(),
  lootBags: new Map(),
  lootBagMeta: new Map(),
  playerMeta: new Map()
};

const spellbookState = {
  signature: ""
};

function clamp(value, min, max) {
  if (sharedClamp) {
    return sharedClamp(value, min, max);
  }
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function normalizeDirection(dx, dy) {
  if (sharedNormalizeDirection) {
    return sharedNormalizeDirection(dx, dy);
  }
  const len = Math.hypot(dx, dy);
  if (!len) {
    return null;
  }
  return {
    dx: dx / len,
    dy: dy / len
  };
}

function normalizeMobAudioId(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function normalizeMobRenderStyle(rawStyle) {
  if (sharedParseMobRenderStyle) {
    return sharedParseMobRenderStyle(rawStyle);
  }
  if (!rawStyle || typeof rawStyle !== "object") {
    return null;
  }

  const style = {};
  const spriteType = String(rawStyle.spriteType || "").trim().toLowerCase();
  if (spriteType) {
    style.spriteType = spriteType.slice(0, 32);
  }

  const numericFields = [
    ["sizeScale", 0.5, 3],
    ["walkCycleSpeed", 0.1, 10],
    ["idleCycleSpeed", 0, 10],
    ["moveThreshold", 0, 2],
    ["attackAnimSpeed", 0.1, 4],
    ["weaponOffsetX", -24, 24],
    ["weaponOffsetY", -24, 24],
    ["weaponAngleOffsetDeg", -180, 180],
    ["biteRadius", 4, 40]
  ];
  for (const [field, min, max] of numericFields) {
    const n = Number(rawStyle[field]);
    if (Number.isFinite(n)) {
      style[field] = clamp(n, min, max);
    }
  }

  const attackVisual = String(rawStyle.attackVisual || "").trim().toLowerCase();
  if (attackVisual) {
    style.attackVisual = attackVisual.slice(0, 32);
  }

  const rawPalette = rawStyle.palette && typeof rawStyle.palette === "object" ? rawStyle.palette : null;
  if (rawPalette) {
    const palette = {};
    for (const [rawKey, rawValue] of Object.entries(rawPalette)) {
      const key = String(rawKey || "").trim().slice(0, 48);
      const color = sanitizeCssColor(rawValue);
      if (!key || !color) {
        continue;
      }
      palette[key] = color;
    }
    if (Object.keys(palette).length > 0) {
      style.palette = palette;
    }
  }

  return Object.keys(style).length > 0 ? style : null;
}

function detectMobSpriteTypeFromName(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("skeleton") && lower.includes("archer")) {
    return "skeleton_archer";
  }
  if (lower.includes("skeleton")) {
    return "skeleton";
  }
  if (lower.includes("creeper")) {
    return "creeper";
  }
  if (lower.includes("spider")) {
    return "spider";
  }
  if (lower.includes("zombie")) {
    return "zombie";
  }
  if (lower.includes("orc") || lower.includes("berserker")) {
    return "orc";
  }
  return "basic";
}

function getMobRenderStyle(mob) {
  if (mob && mob.renderStyle && typeof mob.renderStyle === "object") {
    return mob.renderStyle;
  }
  const meta = entityRuntime.mobMeta.get(mob && mob.id);
  if (meta && meta.renderStyle && typeof meta.renderStyle === "object") {
    return meta.renderStyle;
  }
  return null;
}

function getMobSpriteType(mob) {
  const style = getMobRenderStyle(mob);
  const configured = String((style && style.spriteType) || "").toLowerCase();
  const normalized =
    configured === "orcberserker" || configured === "orc_berserker" ? "orc" : configured;
  if (
    normalized === "zombie" ||
    normalized === "skeleton" ||
    normalized === "skeleton_archer" ||
    normalized === "creeper" ||
    normalized === "spider" ||
    normalized === "orc" ||
    normalized === "basic"
  ) {
    return normalized;
  }
  return detectMobSpriteTypeFromName(mob && mob.name);
}

function getMobAttackVisualType(mob) {
  const style = getMobRenderStyle(mob);
  const configured = String((style && style.attackVisual) || "").toLowerCase();
  if (
    configured === "bite" ||
    configured === "sword" ||
    configured === "dual_axes" ||
    configured === "ignition" ||
    configured === "bow" ||
    configured === "none"
  ) {
    return configured;
  }
  const spriteType = getMobSpriteType(mob);
  if (spriteType === "skeleton_archer") {
    return "bow";
  }
  if (spriteType === "skeleton") {
    return "sword";
  }
  if (spriteType === "creeper") {
    return "ignition";
  }
  if (spriteType === "orc") {
    return "dual_axes";
  }
  return "bite";
}

function getMobStyleNumber(style, key, fallback, min, max) {
  const n = Number(style && style[key]);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return clamp(n, min, max);
}

function getMobStyleCacheKey(style) {
  if (!style || typeof style !== "object") {
    return "";
  }
  try {
    return JSON.stringify(style);
  } catch {
    return "";
  }
}

function applyMobPaletteOverrides(basePalette, style) {
  const palette = { ...basePalette };
  const source = style && style.palette && typeof style.palette === "object" ? style.palette : null;
  if (!source) {
    return palette;
  }
  for (const [key, value] of Object.entries(source)) {
    if (!(key in palette)) {
      continue;
    }
    const color = sanitizeCssColor(value);
    if (!color) {
      continue;
    }
    palette[key] = color;
  }
  return palette;
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

function clearDragState() {
  dragState.source = "";
  dragState.inventoryFrom = null;
  dragState.fromActionSlot = "";
  dragState.itemId = "";
  dragState.actionBinding = "";
}

const ACTION_SLOT_ORDER = ["mouse_left", "mouse_right", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTION_SLOT_LABELS = {
  mouse_left: "LMB",
  mouse_right: "RMB",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9"
};
const BUILTIN_ACTION_DEFS = {
  pickup_bag: {
    id: "pickup_bag",
    name: "Loot",
    description: "Pick up nearby loot bag.",
    kind: "utility",
    cooldownMs: 0,
    castMs: 0
  },
  none: {
    id: "none",
    name: "Empty",
    description: "No action bound.",
    kind: "none",
    cooldownMs: 0,
    castMs: 0
  }
};
const abilityVisualRegistry = globalThis.VibeAbilityVisualRegistry || {
  defaultVisuals: {},
  byKind: {},
  byId: {}
};

function toAbilityVisualKey(value) {
  return String(value || "").trim().toLowerCase();
}

function getAbilityVisualHooks(actionId, actionDef = null, kindOverride = "") {
  const idKey = toAbilityVisualKey(actionId);
  const def = actionDef || getActionDefById(actionId);
  const kindKey = toAbilityVisualKey(kindOverride || def?.kind || "");
  const defaultVisuals = abilityVisualRegistry.defaultVisuals || {};
  const kindVisuals = (abilityVisualRegistry.byKind && abilityVisualRegistry.byKind[kindKey]) || {};
  const idVisuals = (abilityVisualRegistry.byId && abilityVisualRegistry.byId[idKey]) || {};
  return {
    ...defaultVisuals,
    ...kindVisuals,
    ...idVisuals
  };
}

function getAbilityVisualHook(actionId, actionDef, hookName, fallback = "", kindOverride = "") {
  const hooks = getAbilityVisualHooks(actionId, actionDef, kindOverride);
  const hook = hooks[hookName];
  if (typeof hook === "string" && hook.trim()) {
    return hook.trim();
  }
  return fallback;
}

const sharedClientUiActions = globalThis.VibeClientUiActions || null;
const sharedCreateUiActionTools =
  sharedClientUiActions && typeof sharedClientUiActions.createUiActionTools === "function"
    ? sharedClientUiActions.createUiActionTools
    : null;
const uiActionTools = sharedCreateUiActionTools
  ? sharedCreateUiActionTools({
      clamp,
      actionBindings,
      abilityRuntime,
      abilityChannel,
      mouseState,
      getPrimaryClassAbilityId,
      getCurrentSelf,
      screenToWorld,
      sendUseItem,
      sendPickupBag,
      useAbilityAt,
      getActionDefById,
      getAbilityEffectiveCooldownMsForSelf,
      getCastProgress,
      resetAbilityChanneling
    })
  : null;

function makeActionBinding(actionId) {
  if (!uiActionTools) {
    return `action:${String(actionId || "none")}`;
  }
  return uiActionTools.makeActionBinding(actionId);
}

function makeItemBinding(itemId) {
  if (!uiActionTools) {
    return `item:${String(itemId || "")}`;
  }
  return uiActionTools.makeItemBinding(itemId);
}

function parseActionBinding(binding) {
  if (!uiActionTools) {
    return {
      kind: "action",
      id: String(binding || "") || "none"
    };
  }
  return uiActionTools.parseActionBinding(binding);
}

function toAbilityAudioId(abilityId) {
  return String(abilityId || "").trim().toLowerCase();
}

function getAbilityAudioBundle(abilityId, createIfMissing = true) {
  const id = toAbilityAudioId(abilityId);
  if (!id) {
    return null;
  }
  let bundle = abilityAudioRegistry.get(id);
  if (!bundle && createIfMissing) {
    bundle = {};
    abilityAudioRegistry.set(id, bundle);
  }
  return bundle || null;
}

function getAbilityAudioState(abilityId, eventType, createIfMissing = true) {
  const eventName = String(eventType || "").trim().toLowerCase();
  if (!ABILITY_AUDIO_EVENTS.includes(eventName)) {
    return null;
  }
  const bundle = getAbilityAudioBundle(abilityId, createIfMissing);
  if (!bundle) {
    return null;
  }
  if (!bundle[eventName] && createIfMissing) {
    bundle[eventName] = {
      audio: null,
      status: "idle",
      playing: false,
      lastPlayedAt: 0,
      missingAt: 0
    };
  }
  return bundle[eventName] || null;
}

function getAbilityAudioUrl(abilityId, eventType) {
  return `/sounds/abilities/${encodeURIComponent(String(abilityId || "").trim())}/${eventType}.mp3`;
}

function normalizeSoundUrlKey(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return "";
  }
  const withoutQuery = raw.split("?")[0];
  const withoutOrigin = withoutQuery.replace(/^https?:\/\/[^/]+/i, "");
  return withoutOrigin.toLowerCase();
}

function isSoundUrlAvailable(url) {
  const key = normalizeSoundUrlKey(url);
  if (!key) {
    return false;
  }
  if (!soundManifestLoaded) {
    return true;
  }
  return availableSoundUrls.has(key);
}

function filterAvailableSoundUrls(candidates) {
  const filtered = [];
  const seen = new Set();
  for (const url of Array.isArray(candidates) ? candidates : []) {
    const key = normalizeSoundUrlKey(url);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!isSoundUrlAvailable(url)) {
      continue;
    }
    filtered.push(url);
  }
  return filtered;
}

function applySoundManifest(payload) {
  if (!payload || !Array.isArray(payload.availableUrls)) {
    return;
  }
  const urls = payload.availableUrls;
  soundManifestLoaded = true;
  availableSoundUrls.clear();
  for (const url of urls) {
    const key = normalizeSoundUrlKey(url);
    if (!key) {
      continue;
    }
    availableSoundUrls.add(key);
  }
  spatialAudioState.resolvedUrlByEvent.clear();
  mobEventAudioState.resolvedUrlByEvent.clear();
  for (const bundle of abilityAudioRegistry.values()) {
    if (!bundle || typeof bundle !== "object") {
      continue;
    }
    for (const eventName of ABILITY_AUDIO_EVENTS) {
      const state = bundle[eventName];
      if (!state || typeof state !== "object") {
        continue;
      }
      if (state.status === "missing") {
        state.status = "idle";
      }
      state.missingAt = 0;
    }
  }
}

function applyAbilityAudioDefaults(audio, eventType) {
  if (!audio) {
    return;
  }
  audio.preload = "auto";
  if (eventType === "channel") {
    audio.loop = true;
    audio.volume = 0.44;
  } else if (eventType === "cast") {
    audio.volume = 0.54;
  } else if (eventType === "hit") {
    audio.volume = 0.58;
  }
}

function applyGameplayClientConfig(payload) {
  const gameplay = payload && typeof payload === "object" ? payload : {};
  const audio = gameplay.audio && typeof gameplay.audio === "object" ? gameplay.audio : {};
  spatialAudioConfig.abilitySpatialMaxDistance = clamp(
    Number(audio.abilitySpatialMaxDistance) || DEFAULT_SPATIAL_AUDIO_CONFIG.abilitySpatialMaxDistance,
    1,
    200
  );
  spatialAudioConfig.abilityPanDistance = clamp(
    Number(audio.abilityPanDistance) || DEFAULT_SPATIAL_AUDIO_CONFIG.abilityPanDistance,
    1,
    200
  );
  spatialAudioConfig.projectileMaxConcurrent = clamp(
    Math.floor(Number(audio.projectileMaxConcurrent) || DEFAULT_SPATIAL_AUDIO_CONFIG.projectileMaxConcurrent),
    1,
    64
  );
}

const sharedClientSpatialAudio = globalThis.VibeClientSpatialAudio || null;
const sharedCreateSpatialAudioTools =
  sharedClientSpatialAudio && typeof sharedClientSpatialAudio.createSpatialAudioTools === "function"
    ? sharedClientSpatialAudio.createSpatialAudioTools
    : null;
const spatialAudioTools = sharedCreateSpatialAudioTools
  ? sharedCreateSpatialAudioTools({
      spatialAudioState,
      spatialAudioConfig,
      clamp,
      getCurrentSelf,
      missingRetryMs: SPATIAL_AUDIO_MISSING_RETRY_MS
    })
  : null;

function ensureSpatialAudioContext() {
  if (!spatialAudioTools) {
    return null;
  }
  return spatialAudioTools.ensureSpatialAudioContext();
}

function resumeSpatialAudioContext() {
  if (!spatialAudioTools) {
    return;
  }
  spatialAudioTools.resumeSpatialAudioContext();
}

function getSpatialListenerPosition() {
  if (!spatialAudioTools) {
    return null;
  }
  return spatialAudioTools.getSpatialListenerPosition();
}

function computeSpatialMix(sourceX, sourceY) {
  if (!spatialAudioTools) {
    return null;
  }
  return spatialAudioTools.computeSpatialMix(sourceX, sourceY);
}

function getSpatialAudioBufferRecord(url, createIfMissing = true) {
  if (!spatialAudioTools) {
    return null;
  }
  return spatialAudioTools.getSpatialAudioBufferRecord(url, createIfMissing);
}

function loadSpatialAudioBuffer(url) {
  if (!spatialAudioTools) {
    return Promise.resolve(null);
  }
  return spatialAudioTools.loadSpatialAudioBuffer(url);
}

function setSpatialNodeMix(runtime, mix, baseGain) {
  if (!spatialAudioTools) {
    return;
  }
  spatialAudioTools.setSpatialNodeMix(runtime, mix, baseGain);
}

function stopSpatialLoop(loopKey) {
  if (!spatialAudioTools) {
    return;
  }
  spatialAudioTools.stopSpatialLoop(loopKey);
}

function stopAllSpatialLoops() {
  if (!spatialAudioTools) {
    return;
  }
  spatialAudioTools.stopAllSpatialLoops();
}

function getAbilityAudioUrlCandidates(abilityId, eventType) {
  const id = toAbilityAudioId(abilityId);
  const eventName = String(eventType || "").trim().toLowerCase();
  if (!id) {
    return [];
  }
  let candidates = [];
  if (eventName === "flying") {
    candidates = [`/sounds/abilities/${encodeURIComponent(id)}/flying.mp3`];
    const legacy = ABILITY_SPATIAL_LEGACY_FLYING[id];
    if (legacy) {
      candidates.push(`/sounds/${encodeURIComponent(legacy)}.mp3`);
    }
    candidates.push(`/sounds/abilities/${encodeURIComponent(id)}/cast.mp3`);
    return filterAvailableSoundUrls(candidates);
  }
  candidates = [getAbilityAudioUrl(id, eventName)];
  if (eventName === "hit") {
    // Some instant abilities only provide cast audio; allow hit->cast fallback.
    candidates.push(getAbilityAudioUrl(id, "cast"));
  }
  return filterAvailableSoundUrls(candidates);
}

async function resolveAbilityAudioUrl(abilityId, eventType) {
  const id = toAbilityAudioId(abilityId);
  const eventName = String(eventType || "").trim().toLowerCase();
  if (!id || !eventName) {
    return null;
  }
  const cacheKey = `${id}:${eventName}`;
  if (spatialAudioState.resolvedUrlByEvent.has(cacheKey)) {
    return spatialAudioState.resolvedUrlByEvent.get(cacheKey);
  }

  const candidates = getAbilityAudioUrlCandidates(id, eventName);
  for (const url of candidates) {
    const buffer = await loadSpatialAudioBuffer(url);
    if (buffer) {
      spatialAudioState.resolvedUrlByEvent.set(cacheKey, url);
      return url;
    }
  }

  spatialAudioState.resolvedUrlByEvent.set(cacheKey, null);
  return null;
}

function playSpatialAbilityAudioEvent(
  abilityId,
  eventType,
  sourceX,
  sourceY,
  now = performance.now(),
  baseGain = 1,
  throttleKey = "",
  throttleMs = 0
) {
  const mix = computeSpatialMix(sourceX, sourceY);
  if (!mix) {
    return;
  }

  const key = String(throttleKey || "");
  if (key && throttleMs > 0) {
    const last = Number(spatialAudioState.lastEventAtByKey.get(key) || 0);
    if (now - last < throttleMs) {
      return;
    }
    spatialAudioState.lastEventAtByKey.set(key, now);
  }

  resumeSpatialAudioContext();
  const context = ensureSpatialAudioContext();
  if (!context || !spatialAudioState.masterGain) {
    return;
  }

  resolveAbilityAudioUrl(abilityId, eventType).then((url) => {
    if (!url) {
      return;
    }
    const record = getSpatialAudioBufferRecord(url, false);
    const buffer = record && record.buffer;
    if (!buffer) {
      return;
    }
    const currentMix = computeSpatialMix(sourceX, sourceY);
    if (!currentMix) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    const gainNode = context.createGain();
    gainNode.gain.value = Math.max(0, Number(baseGain) || 1) * currentMix.gain;

    if (typeof context.createStereoPanner === "function") {
      const pannerNode = context.createStereoPanner();
      pannerNode.pan.value = currentMix.pan;
      source.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(spatialAudioState.masterGain);
    } else {
      source.connect(gainNode);
      gainNode.connect(spatialAudioState.masterGain);
    }

    try {
      source.start();
    } catch (_error) {
      // Ignore aborted starts.
    }
  });
}

function ensureSpatialAbilityLoop(loopKey, abilityId, eventType, sourceX, sourceY, baseGain, frameNow) {
  const key = String(loopKey || "");
  if (!key) {
    return;
  }

  const mix = computeSpatialMix(sourceX, sourceY);
  if (!mix) {
    stopSpatialLoop(key);
    return;
  }

  const existing = spatialAudioState.loopSources.get(key);
  if (existing) {
    const normalizedAbilityId = toAbilityAudioId(abilityId);
    const normalizedEvent = String(eventType || "").toLowerCase();
    if (existing.abilityId !== normalizedAbilityId || existing.eventType !== normalizedEvent) {
      stopSpatialLoop(key);
    } else {
      existing.worldX = sourceX;
      existing.worldY = sourceY;
      existing.lastSeenAt = frameNow;
      setSpatialNodeMix(existing, mix, baseGain);
      return;
    }
  }
  if (spatialAudioState.loopPending.has(key)) {
    return;
  }

  spatialAudioState.loopPending.add(key);
  resumeSpatialAudioContext();
  const context = ensureSpatialAudioContext();
  if (!context || !spatialAudioState.masterGain) {
    spatialAudioState.loopPending.delete(key);
    return;
  }

  resolveAbilityAudioUrl(abilityId, eventType).then((url) => {
    spatialAudioState.loopPending.delete(key);
    if (!url || spatialAudioState.loopSources.has(key)) {
      return;
    }
    const record = getSpatialAudioBufferRecord(url, false);
    const buffer = record && record.buffer;
    if (!buffer) {
      return;
    }
    const currentMix = computeSpatialMix(sourceX, sourceY);
    if (!currentMix) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gainNode = context.createGain();
    let pannerNode = null;
    if (typeof context.createStereoPanner === "function") {
      pannerNode = context.createStereoPanner();
      source.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(spatialAudioState.masterGain);
    } else {
      source.connect(gainNode);
      gainNode.connect(spatialAudioState.masterGain);
    }
    const runtime = {
      key,
      abilityId: toAbilityAudioId(abilityId),
      eventType: String(eventType || "").toLowerCase(),
      url,
      source,
      gainNode,
      pannerNode,
      baseGain: Math.max(0, Number(baseGain) || 1),
      worldX: sourceX,
      worldY: sourceY,
      lastSeenAt: frameNow
    };
    setSpatialNodeMix(runtime, currentMix, runtime.baseGain);
    spatialAudioState.loopSources.set(key, runtime);
    source.onended = () => {
      const active = spatialAudioState.loopSources.get(key);
      if (active && active.source === source) {
        spatialAudioState.loopSources.delete(key);
      }
    };
    try {
      source.start();
    } catch (_error) {
      spatialAudioState.loopSources.delete(key);
    }
  });
}

function updateSpatialAbilityLoop(loopKey, sourceX, sourceY, baseGain, frameNow) {
  const runtime = spatialAudioState.loopSources.get(String(loopKey || ""));
  if (!runtime) {
    return;
  }
  runtime.worldX = sourceX;
  runtime.worldY = sourceY;
  runtime.lastSeenAt = frameNow;
  setSpatialNodeMix(runtime, computeSpatialMix(sourceX, sourceY), baseGain);
}

function getMobCastLoopKey(mobId) {
  return `mobcast:${String(mobId || "")}`;
}

function getProjectileFlightLoopKey(projectileId) {
  return `projectile:${String(projectileId || "")}`;
}

function stopMobCastSpatialLoop(mobId) {
  stopSpatialLoop(getMobCastLoopKey(mobId));
}

function stopProjectileFlightSpatialLoop(projectileId) {
  stopSpatialLoop(getProjectileFlightLoopKey(projectileId));
}

function getRuntimeMobPosition(mobId) {
  const mob = entityRuntime.mobs.get(Number(mobId));
  if (!mob) {
    return null;
  }
  return { x: Number(mob.x), y: Number(mob.y) };
}

function ensureAbilityAudioClip(abilityId, eventType) {
  const state = getAbilityAudioState(abilityId, eventType, true);
  if (!state || state.status === "ready" || state.status === "loading") {
    return state;
  }
  if (state.status === "missing") {
    const now = performance.now();
    if (now - Number(state.missingAt || 0) < SPATIAL_AUDIO_MISSING_RETRY_MS) {
      return state;
    }
    state.status = "idle";
  }

  const normalizedAbilityId = toAbilityAudioId(abilityId);
  const candidates = getAbilityAudioUrlCandidates(normalizedAbilityId, eventType);
  const audioUrl = candidates.length ? candidates[0] : "";
  if (!isSoundUrlAvailable(audioUrl)) {
    state.status = "missing";
    state.playing = false;
    return state;
  }
  const audio = new Audio(audioUrl);
  applyAbilityAudioDefaults(audio, eventType);
  state.audio = audio;
  state.status = "loading";
  state.playing = false;

  const markReady = () => {
    if (state.status !== "missing") {
      state.status = "ready";
      state.missingAt = 0;
    }
  };
  const markMissing = () => {
    state.status = "missing";
    state.playing = false;
    state.missingAt = performance.now();
  };

  audio.addEventListener("canplaythrough", markReady, { once: true });
  audio.addEventListener("loadeddata", markReady, { once: true });
  audio.addEventListener("error", markMissing, { once: true });
  try {
    audio.load();
  } catch (_error) {
    markMissing();
  }
  return state;
}

function preloadAbilityAudioById(abilityId) {
  const normalizedAbilityId = toAbilityAudioId(abilityId);
  if (!normalizedAbilityId) {
    return;
  }
  for (const eventType of ABILITY_AUDIO_EVENTS) {
    ensureAbilityAudioClip(normalizedAbilityId, eventType);
  }
}

function preloadAllAbilityAudio() {
  for (const abilityId of abilityDefsById.keys()) {
    preloadAbilityAudioById(abilityId);
  }
}

function getMobEventAudioUrlCandidates(mobType, eventType) {
  const mobId = normalizeMobAudioId(mobType);
  const eventId = normalizeMobAudioId(eventType);
  if (!mobId || !eventId) {
    return [];
  }
  return filterAvailableSoundUrls([
    `/sounds/mobs/${encodeURIComponent(mobId)}/${encodeURIComponent(eventId)}.mp3`
  ]);
}

async function resolveMobEventAudioUrl(mobType, eventType) {
  const mobId = normalizeMobAudioId(mobType);
  const eventId = normalizeMobAudioId(eventType);
  if (!mobId || !eventId) {
    return null;
  }
  const cacheKey = `${mobId}:${eventId}`;
  if (mobEventAudioState.resolvedUrlByEvent.has(cacheKey)) {
    const cached = mobEventAudioState.resolvedUrlByEvent.get(cacheKey);
    if (cached) {
      return cached;
    }
    mobEventAudioState.resolvedUrlByEvent.delete(cacheKey);
  }
  const candidates = getMobEventAudioUrlCandidates(mobType, eventType);
  for (const url of candidates) {
    const buffer = await loadSpatialAudioBuffer(url);
    if (buffer) {
      mobEventAudioState.resolvedUrlByEvent.set(cacheKey, url);
      return url;
    }
  }
  return null;
}

function playSpatialAudioByUrl(
  url,
  sourceX,
  sourceY,
  now = performance.now(),
  baseGain = 1,
  throttleKey = "",
  throttleMs = 0
) {
  if (!spatialAudioTools) {
    return;
  }
  spatialAudioTools.playSpatialAudioByUrl(url, sourceX, sourceY, now, baseGain, throttleKey, throttleMs);
}

function playMobEventSound(mobType, eventType, sourceX, sourceY, now = performance.now(), baseGain = 0.7, throttleMs = 90) {
  resolveMobEventAudioUrl(mobType, eventType).then((url) => {
    if (!url) {
      return;
    }
    const key = `mob:${normalizeMobAudioId(mobType)}:${normalizeMobAudioId(eventType)}:${Math.round(sourceX * 4)}:${Math.round(sourceY * 4)}`;
    playSpatialAudioByUrl(url, sourceX, sourceY, now, baseGain, key, throttleMs);
  });
}

function getAbilityAudioMinIntervalMs(eventType) {
  if (eventType === "cast") {
    return 90;
  }
  if (eventType === "hit") {
    return 60;
  }
  return 0;
}

function playAbilityAudioEvent(abilityId, eventType, now = performance.now()) {
  const normalizedAbilityId = toAbilityAudioId(abilityId);
  const state = ensureAbilityAudioClip(normalizedAbilityId, eventType);
  if (!state || state.status === "missing" || !state.audio) {
    return;
  }

  const minIntervalMs = getAbilityAudioMinIntervalMs(eventType);
  if (minIntervalMs > 0 && now - Number(state.lastPlayedAt || 0) < minIntervalMs) {
    return;
  }
  state.lastPlayedAt = now;

  if (eventType === "channel") {
    if (state.playing) {
      return;
    }
    state.playing = true;
    state.audio.currentTime = 0;
    const playback = state.audio.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {
        state.playing = false;
      });
    }
    return;
  }

  const clip = state.audio.cloneNode();
  clip.volume = state.audio.volume;
  const playback = clip.play();
  if (playback && typeof playback.catch === "function") {
    playback.catch(() => {});
  }
}

function stopAbilityChannelAudio(abilityId) {
  const normalizedAbilityId = toAbilityAudioId(abilityId);
  const state = getAbilityAudioState(normalizedAbilityId, "channel", false);
  if (!state || !state.audio) {
    return;
  }
  state.audio.pause();
  state.audio.currentTime = 0;
  state.playing = false;
}

function stopAllAbilityChannelAudio() {
  for (const abilityId of abilityAudioRegistry.keys()) {
    stopAbilityChannelAudio(abilityId);
  }
}

const sharedClientAbilityRuntime = globalThis.VibeClientAbilityRuntime || null;
const sharedCreateAbilityRuntimeTools =
  sharedClientAbilityRuntime && typeof sharedClientAbilityRuntime.createAbilityRuntimeTools === "function"
    ? sharedClientAbilityRuntime.createAbilityRuntimeTools
    : null;
const abilityRuntimeTools = sharedCreateAbilityRuntimeTools
  ? sharedCreateAbilityRuntimeTools({
      abilityRuntime,
      abilityChannel,
      clamp,
      getCurrentSelf,
      getActionDefById,
      sendAbilityUse,
      getAbilityEffectiveCooldownMsForSelf,
      getAbilityEffectiveRangeForSelf,
      playAbilityAudioEvent,
      triggerSwordSwing,
      stopAbilityChannelAudio,
      stopAllAbilityChannelAudio
    })
  : null;

function captureCastStateSnapshot(castState) {
  if (!abilityRuntimeTools) {
    return {
      active: false,
      abilityId: "",
      startedAt: 0,
      durationMs: 0
    };
  }
  return abilityRuntimeTools.captureCastStateSnapshot(castState);
}

function syncLocalCastAudio(previousCast, nextCast) {
  if (!abilityRuntimeTools) {
    return;
  }
  abilityRuntimeTools.syncLocalCastAudio(previousCast, nextCast);
}

function resetAbilityChanneling() {
  if (!abilityRuntimeTools) {
    return;
  }
  abilityRuntimeTools.resetAbilityChanneling();
}

function applyServerCastState(targetState, payload) {
  if (!abilityRuntimeTools) {
    return;
  }
  abilityRuntimeTools.applyServerCastState(targetState, payload);
}

function getCastProgress(castState, now) {
  if (!abilityRuntimeTools) {
    return null;
  }
  return abilityRuntimeTools.getCastProgress(castState, now);
}

function findAbilityDefById(abilityId) {
  const id = String(abilityId || "");
  if (!id) {
    return null;
  }
  let ability = abilityDefsById.get(id);
  if (ability) {
    return ability;
  }
  const lowered = id.toLowerCase();
  for (const [key, value] of abilityDefsById.entries()) {
    if (String(key).toLowerCase() === lowered) {
      ability = value;
      break;
    }
  }
  return ability || null;
}

function getActionDefById(actionId) {
  const id = String(actionId || "none");
  if (BUILTIN_ACTION_DEFS[id]) {
    return BUILTIN_ACTION_DEFS[id];
  }
  const ability = findAbilityDefById(id);
  if (!ability) {
    return BUILTIN_ACTION_DEFS.none;
  }
  return {
    id,
    name: ability.name || id,
    description: ability.description || "",
    kind: ability.kind || "meleeCone",
    cooldownMs: Math.max(0, Math.floor(Number(ability.cooldownMs) || 0)),
    castMs: Math.max(0, Math.floor(Number(ability.castMs) || 0)),
    range: Math.max(0, Number(ability.range) || 0)
  };
}

function toTitleCaseWords(text) {
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function humanizeKey(key) {
  return toTitleCaseWords(
    String(key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim()
  );
}

function appendTooltipNumber(lines, label, value, formatter = null) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return;
  }
  const rendered = formatter ? formatter(n) : (Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : n.toFixed(2));
  lines.push(`${label}: ${rendered}`);
}

function formatMsAsSeconds(ms) {
  const seconds = Math.max(0, Number(ms) || 0) / 1000;
  return `${seconds.toFixed(seconds >= 10 || Number.isInteger(seconds) ? 0 : 1)}s`;
}

function buildAbilityTooltip(abilityId) {
  const action = getActionDefById(abilityId);
  const abilityIdKey = String(abilityId || "");
  const ability = abilityDefsById.get(abilityIdKey);
  const lines = [action.name || String(abilityId || "Ability")];

  if (action.description) {
    lines.push(String(action.description));
  }

  if (!ability) {
    if (action.kind && action.kind !== "none") {
      lines.push(`Kind: ${String(action.kind)}`);
    }
    appendTooltipNumber(lines, "Mana Cost", action.manaCost);
    appendTooltipNumber(lines, "Cooldown", action.cooldownMs, formatMsAsSeconds);
    appendTooltipNumber(lines, "Cast Time", action.castMs, formatMsAsSeconds);
    appendTooltipNumber(lines, "Range", action.range);
    return lines.join("\n");
  }

  const self = getCurrentSelf();
  const kind = String(ability.kind || action.kind || "meleeCone");
  const level = getSelfAbilityLevel(self, ability.id, 1);
  const cooldownMs = getAbilityEffectiveCooldownMsForSelf(ability.id, self);
  const castMs = Math.max(0, Number(ability.castMs) || 0);
  const effectiveRange = getAbilityEffectiveRangeForSelf(ability.id, self);
  const manaCost = Math.max(0, Number(ability.manaCost) || 0);
  const totalDamageRange = sharedGetAbilityDamageRange
    ? sharedGetAbilityDamageRange(ability, level)
    : [Math.max(0, Number(ability.damageMin) || 0), Math.max(0, Number(ability.damageMax) || 0)];
  const totalDamageMin = Math.max(0, Number(totalDamageRange[0]) || 0);
  const totalDamageMax = Math.max(totalDamageMin, Number(totalDamageRange[1]) || 0);
  const durationMs = Math.max(0, Number(ability.durationMs) || 0);
  const stunDurationMs = Math.max(0, Number(ability.stunDurationMs) || 0);
  const slowDurationMs = Math.max(0, Number(ability.slowDurationMs) || 0);
  const rawSlowMultiplier = Number(ability.slowMultiplier);
  const slowMultiplier = Number.isFinite(rawSlowMultiplier)
    ? clamp(rawSlowMultiplier, 0.1, 1)
    : Number.isFinite(Number(ability.slowAmount))
      ? clamp(1 - clamp(Number(ability.slowAmount), 0, 0.95), 0.1, 1)
      : 1;
  const slowPercent = Math.round((1 - slowMultiplier) * 100);
  const invulnerabilityDurationMs = Math.max(
    0,
    Number(ability.invulnerabilityDurationMs || 0) || Math.round((Number(ability.invulnerabilityDuration) || 0) * 1000)
  );

  if (kind && kind !== "none") {
    lines.push(`Kind: ${kind}`);
  }
  appendTooltipNumber(lines, "Mana Cost", manaCost);
  appendTooltipNumber(lines, "Cooldown", cooldownMs, formatMsAsSeconds);
  appendTooltipNumber(lines, "Cast Time", castMs, formatMsAsSeconds);
  appendTooltipNumber(lines, "Range", effectiveRange);

  if (totalDamageMax > 0) {
    const damageLabel = (kind === "area" || kind === "beam") && durationMs > 0 ? "Damage / Second" : "Damage";
    lines.push(`${damageLabel}: ${totalDamageMin} - ${totalDamageMax}`);
  }

  if (kind === "meleeCone") {
    appendTooltipNumber(lines, "Cone Angle", ability.coneAngleDeg, (v) => `${Math.round(v)} deg`);
  }

  if (kind === "projectile") {
    appendTooltipNumber(lines, "Speed", ability.speed);
    const projectileCount = Math.max(0, Number(ability.projectileCount) || 0);
    if (projectileCount > 1) {
      lines.push(`Projectiles: ${Math.floor(projectileCount)}`);
    }
    appendTooltipNumber(lines, "Hit Radius", ability.projectileHitRadius);
    appendTooltipNumber(lines, "Homing Range", ability.homingRange);
    appendTooltipNumber(lines, "Homing Turn Rate", ability.homingTurnRate);
    appendTooltipNumber(lines, "Explosion Radius", ability.explosionRadius);
    appendTooltipNumber(lines, "Explosion Multiplier", ability.explosionDamageMultiplier, (v) => `${Math.round(v * 100)}%`);
  }

  if (kind === "area") {
    appendTooltipNumber(lines, "Area Radius", ability.areaRadius);
    appendTooltipNumber(lines, "Duration", durationMs, formatMsAsSeconds);
  }

  if (kind === "beam") {
    appendTooltipNumber(lines, "Beam Width", ability.beamWidth);
    appendTooltipNumber(lines, "Duration", durationMs, formatMsAsSeconds);
  }

  if (kind === "teleport") {
    appendTooltipNumber(lines, "Invulnerability", invulnerabilityDurationMs, formatMsAsSeconds);
  }

  appendTooltipNumber(lines, "Stun Duration", stunDurationMs, formatMsAsSeconds);
  if (slowPercent > 0) {
    if (slowDurationMs > 0) {
      lines.push(`Slow: ${slowPercent}% for ${formatMsAsSeconds(slowDurationMs)}`);
    } else {
      lines.push(`Slow: ${slowPercent}%`);
    }
  }

  return lines.join("\n");
}

function buildItemTooltip(itemId, qty = null) {
  const def = itemDefsById.get(String(itemId || ""));
  if (!def) {
    return String(itemId || "Item");
  }

  const lines = [qty && qty > 0 ? `${def.name} x${Math.floor(qty)}` : def.name];
  if (def.description) {
    lines.push(String(def.description));
  }
  appendTooltipNumber(lines, "Stack Size", def.stackSize);

  const effect = def.effect && typeof def.effect === "object" ? def.effect : null;
  if (effect && effect.type) {
    lines.push(`Effect: ${toTitleCaseWords(String(effect.type))}`);
    for (const [key, value] of Object.entries(effect)) {
      if (key === "type") {
        continue;
      }
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        if (key === "duration") {
          lines.push(`Duration: ${value}s`);
        } else if (key === "value") {
          lines.push(`Value: ${Math.abs(value - Math.round(value)) < 0.001 ? Math.round(value) : value.toFixed(2)}`);
        } else {
          lines.push(`${humanizeKey(key)}: ${Math.abs(value - Math.round(value)) < 0.001 ? Math.round(value) : value.toFixed(2)}`);
        }
      }
    }
  }

  const knownItemKeys = new Set(["id", "name", "description", "stackSize", "icon", "effect"]);
  for (const [key, value] of Object.entries(def)) {
    if (knownItemKeys.has(key)) {
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      lines.push(`${humanizeKey(key)}: ${Math.abs(value - Math.round(value)) < 0.001 ? Math.round(value) : value.toFixed(2)}`);
    }
  }

  return lines.join("\n");
}

function getPrimaryClassAbilityId(classType) {
  const classDef = classDefsById.get(String(classType || ""));
  if (!classDef || !Array.isArray(classDef.abilities) || !classDef.abilities.length) {
    return "none";
  }
  const first = classDef.abilities[0];
  const abilityId = first && String(first.id || "").trim();
  return abilityId && abilityDefsById.has(abilityId) ? abilityId : "none";
}

function getDefaultClassId() {
  if (classDefsById.size) {
    return classDefsById.keys().next().value;
  }
  return "warrior";
}

function clearSelfNegativeEffects() {
  selfNegativeEffects.stun = null;
  selfNegativeEffects.slow = null;
  selfNegativeEffects.burn = null;
  if (debuffIcons) {
    debuffIcons.innerHTML = "";
    debuffIcons.classList.add("hidden");
  }
}

function setSelfNegativeEffectState(key, remainingMs, durationMs, now, extra = {}) {
  const remaining = Math.max(0, Math.floor(Number(remainingMs) || 0));
  if (remaining <= 0) {
    selfNegativeEffects[key] = null;
    return;
  }
  const duration = Math.max(1, Math.floor(Number(durationMs) || remaining));
  selfNegativeEffects[key] = {
    startedAt: now - Math.max(0, duration - remaining),
    endsAt: now + remaining,
    durationMs: duration,
    ...extra
  };
}

function applyPlayerEffects(msg) {
  const now = performance.now();
  setSelfNegativeEffectState("stun", msg && msg.stunnedMs, msg && msg.stunDurationMs, now);
  setSelfNegativeEffectState("slow", msg && msg.slowedMs, msg && msg.slowDurationMs, now, {
    multiplierQ: Math.max(1, Math.floor(Number(msg && msg.slowMultiplierQ) || 1000))
  });
  setSelfNegativeEffectState("burn", msg && msg.burningMs, msg && msg.burnDurationMs, now);
}

function applyNearbyPlayerEffects(msg) {
  if (!Array.isArray(msg && msg.effects)) {
    return;
  }
  const now = performance.now();
  for (const effect of msg.effects) {
    if (!effect || typeof effect.id !== "number") {
      continue;
    }
    const id = effect.id;
    const stunnedMs = Math.max(0, Number(effect.stunnedMs) || 0);
    const slowedMs = Math.max(0, Number(effect.slowedMs) || 0);
    const burningMs = Math.max(0, Number(effect.burningMs) || 0);
    const slowMultiplierQ = Math.max(1, Math.floor(Number(effect.slowMultiplierQ) || 1000));

    if (stunnedMs > 0) {
      remotePlayerStuns.set(id, { endsAt: now + stunnedMs });
    } else {
      remotePlayerStuns.delete(id);
    }
    if (slowedMs > 0) {
      remotePlayerSlows.set(id, {
        endsAt: now + slowedMs,
        multiplier: clamp(slowMultiplierQ / 1000, 0.1, 1)
      });
    } else {
      remotePlayerSlows.delete(id);
    }
    if (burningMs > 0) {
      remotePlayerBurns.set(id, { endsAt: now + burningMs });
    } else {
      remotePlayerBurns.delete(id);
    }
  }
}

function updateNegativeEffectIcons(now = performance.now()) {
  if (!debuffIcons) {
    return;
  }
  const defs = [
    {
      key: "stun",
      label: "ST",
      color: "rgba(252, 219, 95, 0.95)",
      title: "Stunned"
    },
    {
      key: "slow",
      label: "SL",
      color: "rgba(114, 196, 255, 0.95)",
      title: "Slowed"
    },
    {
      key: "burn",
      label: "BR",
      color: "rgba(255, 136, 69, 0.95)",
      title: "Burning"
    }
  ];
  const entries = [];

  for (const def of defs) {
    const state = selfNegativeEffects[def.key];
    if (!state) {
      continue;
    }
    const remainingMs = Math.max(0, Number(state.endsAt) - now);
    if (remainingMs <= 0) {
      selfNegativeEffects[def.key] = null;
      continue;
    }
    const durationMs = Math.max(1, Number(state.durationMs) || remainingMs);
    const ratio = clamp(remainingMs / durationMs, 0, 1);
    let title = `${def.title} (${(remainingMs / 1000).toFixed(1)}s)`;
    if (def.key === "slow") {
      const multiplier = clamp((Number(state.multiplierQ) || 1000) / 1000, 0.1, 1);
      const slowPct = Math.round((1 - multiplier) * 100);
      title = `${def.title} ${slowPct}% (${(remainingMs / 1000).toFixed(1)}s)`;
    }
    entries.push({
      ...def,
      ratio,
      title
    });
  }

  if (!entries.length) {
    debuffIcons.innerHTML = "";
    debuffIcons.classList.add("hidden");
    return;
  }

  debuffIcons.classList.remove("hidden");
  debuffIcons.innerHTML = "";
  for (const entry of entries) {
    const node = document.createElement("div");
    node.className = "debuff-icon";
    node.title = entry.title;
    const ring = document.createElement("div");
    ring.className = "debuff-ring";
    ring.style.setProperty("--ratio", entry.ratio.toFixed(4));
    ring.style.setProperty("--ring-color", entry.color);
    const core = document.createElement("div");
    core.className = "debuff-core";
    core.textContent = entry.label;
    node.appendChild(ring);
    node.appendChild(core);
    debuffIcons.appendChild(node);
  }
}

function updateResourceBars(self) {
  if (!actionUi || !resourceBars || !hpFill || !manaFill || !expFill || !hpText || !manaText || !expText) {
    return;
  }

  if (!self) {
    resourceBars.classList.add("hidden");
    if (hpPredictFill) {
      hpPredictFill.style.transform = "scaleX(0)";
    }
    if (manaPredictFill) {
      manaPredictFill.style.transform = "scaleX(0)";
    }
    hpFill.style.transform = "scaleX(0)";
    manaFill.style.transform = "scaleX(0)";
    expFill.style.transform = "scaleX(0)";
    hpText.textContent = "";
    manaText.textContent = "";
    expText.textContent = "";
    clearSelfNegativeEffects();
    return;
  }

  resourceBars.classList.remove("hidden");
  const hp = Math.max(0, Number(self.hp) || 0);
  const maxHp = Math.max(1, Number(self.maxHp) || 1);
  const hpRatio = clamp(hp / maxHp, 0, 1);
  const pendingHeal = Math.max(0, Number(self.pendingHeal) || 0);
  const predictedHp = clamp(hp + pendingHeal, 0, maxHp);
  const predictedRatio = clamp(predictedHp / maxHp, 0, 1);
  if (hpPredictFill) {
    hpPredictFill.style.transform = `scaleX(${predictedRatio})`;
  }
  hpFill.style.transform = `scaleX(${hpRatio})`;
  hpText.textContent = `HP ${Math.floor(hp)}/${Math.floor(maxHp)}`;

  const classDef = classDefsById.get(String(self.classType || ""));
  const maxMana = Math.max(0, Number(self.maxMana ?? classDef?.baseMana ?? 0) || 0);
  const mana = Math.max(0, Number(self.mana ?? maxMana) || 0);
  const pendingMana = Math.max(0, Number(self.pendingMana) || 0);
  const predictedMana = clamp(mana + pendingMana, 0, maxMana);
  const predictedManaRatio = maxMana > 0 ? clamp(predictedMana / maxMana, 0, 1) : 0;
  const manaRatio = maxMana > 0 ? clamp(mana / maxMana, 0, 1) : 0;
  if (manaPredictFill) {
    manaPredictFill.style.transform = `scaleX(${predictedManaRatio})`;
  }
  manaFill.style.transform = `scaleX(${manaRatio})`;
  manaText.textContent = maxMana > 0 ? `MP ${Math.floor(mana)}/${Math.floor(maxMana)}` : "MP 0/0";

  const exp = Math.max(0, Number(self.exp) || 0);
  const expToNext = Math.max(1, Number(self.expToNext) || 1);
  const expRatio = clamp(exp / expToNext, 0, 1);
  expFill.style.transform = `scaleX(${expRatio})`;
  expText.textContent = `EXP ${Math.floor(exp)}/${Math.floor(expToNext)} (Lv ${Math.max(1, Math.floor(Number(self.level) || 1))})`;
  updateNegativeEffectIcons(performance.now());
}

function getSelfAbilityLevel(self, abilityId, fallbackLevel = 1) {
  const safeFallback = Math.max(1, Math.floor(Number(fallbackLevel) || 1));
  if (!self || !self.abilityLevels || typeof self.abilityLevels !== "object") {
    return safeFallback;
  }
  const raw = self.abilityLevels[String(abilityId || "")];
  const level = Math.floor(Number(raw) || 0);
  if (!Number.isFinite(level) || level <= 0) {
    return safeFallback;
  }
  return level;
}

function getAbilityEffectiveRangeForSelf(abilityId, self) {
  const ability = abilityDefsById.get(String(abilityId || ""));
  if (!ability) {
    return Math.max(0, Number(getActionDefById(abilityId).range) || 0);
  }
  const level = getSelfAbilityLevel(self, ability.id, 1);
  if (sharedGetAbilityRangeForLevel) {
    return Math.max(0, Number(sharedGetAbilityRangeForLevel(ability, level)) || 0);
  }
  const levelOffset = Math.max(0, level - 1);
  return Math.max(0, Math.max(0, Number(ability.range) || 0) + Math.max(0, Number(ability.rangePerLevel) || 0) * levelOffset);
}

function getAbilityEffectiveCooldownMsForSelf(abilityId, self) {
  const ability = abilityDefsById.get(String(abilityId || ""));
  const baseCooldownMs = Math.max(
    0,
    Number(ability ? ability.cooldownMs : getActionDefById(abilityId).cooldownMs) || 0
  );
  if (!ability) {
    return baseCooldownMs;
  }
  const level = getSelfAbilityLevel(self, ability.id, 1);
  if (sharedGetAbilityCooldownMsForLevel) {
    return Math.max(0, Number(sharedGetAbilityCooldownMsForLevel(ability, level)) || 0);
  }
  const levelOffset = Math.max(0, level - 1);
  return Math.max(0, baseCooldownMs - Math.max(0, Number(ability.cooldownReductionPerLevel) || 0) * 1000 * levelOffset);
}

function parseAbilityLevelsPayload(rawLevels) {
  const result = {};
  if (Array.isArray(rawLevels)) {
    for (const entry of rawLevels) {
      if (!entry) {
        continue;
      }
      const abilityId = String(entry.id || "").trim();
      const level = Math.max(1, Math.floor(Number(entry.level) || 0));
      if (!abilityId || level <= 0) {
        continue;
      }
      result[abilityId] = level;
    }
    return result;
  }
  if (rawLevels && typeof rawLevels === "object") {
    for (const [rawId, rawLevel] of Object.entries(rawLevels)) {
      const abilityId = String(rawId || "").trim();
      const level = Math.max(1, Math.floor(Number(rawLevel) || 0));
      if (!abilityId || level <= 0) {
        continue;
      }
      result[abilityId] = level;
    }
  }
  return result;
}

function buildSpellbookSignature(self) {
  if (!self) {
    return "";
  }
  const classDef = classDefsById.get(String(self.classType || ""));
  if (!classDef) {
    return "";
  }
  const skillPoints = Math.max(0, Math.floor(Number(self.skillPoints) || 0));
  const parts = [String(self.classType || ""), `sp:${skillPoints}`];
  for (const entry of Array.isArray(classDef.abilities) ? classDef.abilities : []) {
    if (!entry) {
      continue;
    }
    const abilityId = String(entry.id || "");
    const fallbackLevel = Math.max(1, Math.floor(Number(entry.level) || 1));
    parts.push(`${abilityId}:${getSelfAbilityLevel(self, abilityId, fallbackLevel)}`);
  }
  return parts.join("|");
}

function updateSpellbookUI(self) {
  if (!spellbookGrid || !spellbookPanel) {
    return;
  }
  if (!self) {
    spellbookGrid.innerHTML = "";
    spellbookState.signature = "";
    return;
  }

  const signature = buildSpellbookSignature(self);
  if (signature === spellbookState.signature) {
    return;
  }

  spellbookGrid.innerHTML = "";
  spellbookState.signature = signature;

  const classDef = classDefsById.get(String(self.classType || ""));
  const abilities = Array.isArray(classDef?.abilities) ? classDef.abilities : [];
  const skillPoints = Math.max(0, Math.floor(Number(self.skillPoints) || 0));

  for (const entry of abilities) {
    const abilityId = String(entry?.id || "").trim();
    if (!abilityId || !abilityDefsById.has(abilityId)) {
      continue;
    }
    const fallbackLevel = Math.max(1, Math.floor(Number(entry?.level) || 1));
    const currentLevel = getSelfAbilityLevel(self, abilityId, fallbackLevel);
    const canLevelUp = skillPoints > 0;

    const cell = document.createElement("div");
    cell.className = "spellbook-cell";

    const node = document.createElement("div");
    node.className = "spellbook-entry";
    node.style.backgroundImage = `url(${getActionIconUrl(abilityId)})`;
    node.title = `${buildAbilityTooltip(abilityId)}\nCurrent Level: ${currentLevel}\nDrag to action slot.`;
    node.draggable = true;
    node.addEventListener("dragstart", (event) => {
      dragState.source = "spellbook";
      dragState.actionBinding = makeActionBinding(abilityId);
      dragState.inventoryFrom = null;
      dragState.fromActionSlot = "";
      dragState.itemId = "";
      event.dataTransfer.effectAllowed = "copyMove";
    });
    node.addEventListener("dragend", () => {
      clearDragState();
    });
    cell.appendChild(node);

    const controls = document.createElement("div");
    controls.className = "spellbook-controls";
    const levelLabel = document.createElement("div");
    levelLabel.className = "spellbook-level";
    levelLabel.textContent = `Lv ${currentLevel}`;
    controls.appendChild(levelLabel);

    const plusButton = document.createElement("button");
    plusButton.type = "button";
    plusButton.className = "spellbook-plus";
    plusButton.textContent = "+";
    plusButton.disabled = !canLevelUp;
    plusButton.title = canLevelUp
      ? `Spend 1 skill point to level ${abilityId}.`
      : "No skill points available.";
    plusButton.addEventListener("click", () => {
      if (!canLevelUp) {
        return;
      }
      sendJsonMessage({
        type: "level_up_ability",
        abilityId
      });
    });
    controls.appendChild(plusButton);

    cell.appendChild(controls);
    spellbookGrid.appendChild(cell);
  }
}

function createIconUrl(cacheKey, drawFn) {
  const cached = iconUrlCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const size = 48;
  const iconCanvas = document.createElement("canvas");
  iconCanvas.width = size;
  iconCanvas.height = size;
  const iconCtx = iconCanvas.getContext("2d");
  iconCtx.clearRect(0, 0, size, size);
  drawFn(iconCtx, size);
  const url = iconCanvas.toDataURL("image/png");
  iconUrlCache.set(cacheKey, url);
  return url;
}

function drawMeleeSlashActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.strokeStyle = "#d7e4f3";
  iconCtx.lineWidth = 4;
  iconCtx.lineCap = "round";
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 10, mid + 9);
  iconCtx.lineTo(mid + 11, mid - 12);
  iconCtx.stroke();

  iconCtx.strokeStyle = "#8294ad";
  iconCtx.lineWidth = 3;
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 5, mid + 3);
  iconCtx.lineTo(mid - 12, mid + 10);
  iconCtx.stroke();
}

function drawFrostboltActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.save();
  iconCtx.translate(mid, mid);
  iconCtx.rotate(-Math.PI / 4);
  iconCtx.fillStyle = "#b9f2ff";
  iconCtx.strokeStyle = "#6bb8e8";
  iconCtx.lineWidth = 2;
  iconCtx.beginPath();
  iconCtx.moveTo(-13, 0);
  iconCtx.lineTo(9, -4.5);
  iconCtx.lineTo(13, 0);
  iconCtx.lineTo(9, 4.5);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(189, 236, 255, 0.92)";
  iconCtx.lineWidth = 1.4;
  iconCtx.beginPath();
  iconCtx.moveTo(-14, 0);
  iconCtx.lineTo(-20, 0);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(141, 214, 255, 0.78)";
  for (let i = 0; i < 3; i += 1) {
    const y = -6 + i * 6;
    iconCtx.beginPath();
    iconCtx.moveTo(-12 - i * 3, y);
    iconCtx.lineTo(-17 - i * 3, y);
    iconCtx.stroke();
  }
  iconCtx.restore();
}

function drawArcaneMissilesActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.save();
  iconCtx.translate(mid, mid);
  iconCtx.rotate(-Math.PI / 4.2);

  iconCtx.fillStyle = "#f4ecff";
  iconCtx.strokeStyle = "#9e84dc";
  iconCtx.lineWidth = 1.8;
  iconCtx.beginPath();
  iconCtx.moveTo(14, 0);
  iconCtx.lineTo(-7, -5.5);
  iconCtx.lineTo(-10, 0);
  iconCtx.lineTo(-7, 5.5);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(208, 182, 255, 0.9)";
  iconCtx.lineWidth = 2.2;
  iconCtx.beginPath();
  iconCtx.arc(2, 0, 8.4, 0.2, Math.PI * 1.7);
  iconCtx.stroke();
  iconCtx.beginPath();
  iconCtx.arc(-4, 0, 10.2, Math.PI * 0.4, Math.PI * 2.1);
  iconCtx.stroke();

  iconCtx.fillStyle = "rgba(233, 223, 255, 0.92)";
  for (let i = 0; i < 4; i += 1) {
    const a = i * ((Math.PI * 2) / 4) + 0.35;
    iconCtx.beginPath();
    iconCtx.arc(-9 + Math.cos(a) * 7, Math.sin(a) * 7, 1.2, 0, Math.PI * 2);
    iconCtx.fill();
  }
  iconCtx.restore();
}

function drawBlizzardActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.fillStyle = "rgba(171, 223, 255, 0.2)";
  iconCtx.beginPath();
  iconCtx.arc(mid, mid, 12, 0, Math.PI * 2);
  iconCtx.fill();

  iconCtx.strokeStyle = "#d5f0ff";
  iconCtx.lineWidth = 1.8;
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    const x0 = mid + Math.cos(a) * 3;
    const y0 = mid + Math.sin(a) * 3;
    const x1 = mid + Math.cos(a) * 11;
    const y1 = mid + Math.sin(a) * 11;
    iconCtx.beginPath();
    iconCtx.moveTo(x0, y0);
    iconCtx.lineTo(x1, y1);
    iconCtx.stroke();
  }
  iconCtx.strokeStyle = "rgba(203, 235, 255, 0.82)";
  iconCtx.lineWidth = 1.2;
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 12, mid - 10);
  iconCtx.lineTo(mid - 6, mid - 2);
  iconCtx.moveTo(mid - 4, mid - 11);
  iconCtx.lineTo(mid + 2, mid - 3);
  iconCtx.moveTo(mid + 4, mid - 10);
  iconCtx.lineTo(mid + 10, mid - 2);
  iconCtx.stroke();
}

function drawArcaneBeamActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.save();
  iconCtx.translate(mid, mid);
  iconCtx.rotate(-Math.PI / 3.2);

  iconCtx.strokeStyle = "rgba(191, 170, 255, 0.92)";
  iconCtx.lineWidth = 8;
  iconCtx.lineCap = "round";
  iconCtx.beginPath();
  iconCtx.moveTo(-13, 0);
  iconCtx.lineTo(13, 0);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(241, 233, 255, 0.98)";
  iconCtx.lineWidth = 3.2;
  iconCtx.beginPath();
  iconCtx.moveTo(-13, 0);
  iconCtx.lineTo(13, 0);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(210, 194, 255, 0.84)";
  iconCtx.lineWidth = 1.8;
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const x = -13 + t * 26;
    const y = Math.sin(t * Math.PI * 4.2) * 3.5;
    if (i === 0) {
      iconCtx.beginPath();
      iconCtx.moveTo(x, y);
    } else {
      iconCtx.lineTo(x, y);
    }
  }
  iconCtx.stroke();
  iconCtx.restore();
}

function drawBlinkActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.save();
  iconCtx.translate(mid, mid);
  iconCtx.rotate(-Math.PI / 6);

  iconCtx.strokeStyle = "rgba(197, 169, 255, 0.9)";
  iconCtx.lineWidth = 2.1;
  iconCtx.beginPath();
  iconCtx.arc(0, 0, 10.5, 0.35, Math.PI * 1.78);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(128, 99, 232, 0.95)";
  iconCtx.lineWidth = 2.6;
  iconCtx.beginPath();
  iconCtx.moveTo(-12, 0);
  iconCtx.lineTo(12, 0);
  iconCtx.stroke();

  iconCtx.fillStyle = "rgba(230, 220, 255, 0.92)";
  for (let i = 0; i < 5; i += 1) {
    const a = i * ((Math.PI * 2) / 5) + 0.2;
    iconCtx.beginPath();
    iconCtx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.3, 0, Math.PI * 2);
    iconCtx.fill();
  }
  iconCtx.restore();
}

function drawFireballActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.fillStyle = "#ff8b42";
  iconCtx.beginPath();
  iconCtx.arc(mid, mid, 10, 0, Math.PI * 2);
  iconCtx.fill();
  iconCtx.fillStyle = "#ffd285";
  iconCtx.beginPath();
  iconCtx.arc(mid + 3, mid - 3, 4.2, 0, Math.PI * 2);
  iconCtx.fill();

  iconCtx.strokeStyle = "rgba(255, 165, 87, 0.8)";
  iconCtx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const a = (Math.PI * 2 * i) / 5;
    iconCtx.beginPath();
    iconCtx.moveTo(mid + Math.cos(a) * 12, mid + Math.sin(a) * 12);
    iconCtx.lineTo(mid + Math.cos(a) * 16, mid + Math.sin(a) * 16);
    iconCtx.stroke();
  }
}

function drawWarstompActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.strokeStyle = "#d6ecff";
  iconCtx.lineWidth = 2.4;
  iconCtx.beginPath();
  iconCtx.arc(mid, mid, 10, 0, Math.PI * 2);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(146, 204, 255, 0.9)";
  iconCtx.lineWidth = 1.8;
  iconCtx.beginPath();
  iconCtx.arc(mid, mid, 6.2, 0, Math.PI * 2);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(210, 236, 255, 0.8)";
  iconCtx.lineWidth = 1.3;
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    iconCtx.beginPath();
    iconCtx.moveTo(mid + Math.cos(a) * 2, mid + Math.sin(a) * 2);
    iconCtx.lineTo(mid + Math.cos(a) * 13, mid + Math.sin(a) * 13);
    iconCtx.stroke();
  }
}

function drawPickupBagActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.fillStyle = "#8e6335";
  iconCtx.fillRect(mid - 11, mid - 8, 22, 16);
  iconCtx.strokeStyle = "#deb474";
  iconCtx.lineWidth = 3;
  iconCtx.strokeRect(mid - 11, mid - 8, 22, 16);
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 4, mid - 8);
  iconCtx.lineTo(mid + 4, mid - 8);
  iconCtx.stroke();
}

function drawUnknownActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.fillStyle = "#88a0b8";
  iconCtx.font = "700 18px Segoe UI";
  iconCtx.textAlign = "center";
  iconCtx.textBaseline = "middle";
  iconCtx.fillText("?", mid, mid);
}

const ABILITY_ICON_RENDERERS = Object.freeze({
  unknown: drawUnknownActionIcon,
  melee_slash: drawMeleeSlashActionIcon,
  frostbolt: drawFrostboltActionIcon,
  arcane_missiles: drawArcaneMissilesActionIcon,
  blizzard: drawBlizzardActionIcon,
  arcane_beam: drawArcaneBeamActionIcon,
  blink: drawBlinkActionIcon,
  fireball: drawFireballActionIcon,
  warstomp: drawWarstompActionIcon,
  pickup_bag: drawPickupBagActionIcon
});

function getActionIconUrl(actionId) {
  const key = `action_icon:${actionId}`;
  return createIconUrl(key, (iconCtx, size) => {
    iconCtx.fillStyle = "rgba(18, 29, 42, 0.95)";
    iconCtx.fillRect(0, 0, size, size);
    const actionDef = getActionDefById(actionId);
    const iconHook = getAbilityVisualHook(actionId, actionDef, "iconRenderer", "unknown");
    const renderIcon = ABILITY_ICON_RENDERERS[iconHook] || ABILITY_ICON_RENDERERS.unknown;
    renderIcon(iconCtx, size, { actionId, actionDef });
  });
}

function getItemIconUrl(itemId) {
  const key = `item_icon:${itemId}`;
  return createIconUrl(key, (iconCtx, size) => {
    const mid = size / 2;
    iconCtx.fillStyle = "rgba(18, 29, 42, 0.95)";
    iconCtx.fillRect(0, 0, size, size);

    if (itemId === "copperCoin") {
      iconCtx.fillStyle = "#b86a2d";
      iconCtx.beginPath();
      iconCtx.arc(mid, mid, 12, 0, Math.PI * 2);
      iconCtx.fill();
      iconCtx.strokeStyle = "#e4a563";
      iconCtx.lineWidth = 3;
      iconCtx.stroke();
      iconCtx.fillStyle = "#f0c78a";
      iconCtx.font = "700 14px Segoe UI";
      iconCtx.textAlign = "center";
      iconCtx.textBaseline = "middle";
      iconCtx.fillText("C", mid, mid + 0.5);
      return;
    }

    if (itemId === "healthPotion01") {
      iconCtx.strokeStyle = "#d6e4f5";
      iconCtx.fillStyle = "#8b1e1e";
      iconCtx.lineWidth = 2.8;
      iconCtx.beginPath();
      iconCtx.moveTo(mid - 8, mid - 9);
      iconCtx.lineTo(mid + 8, mid - 9);
      iconCtx.lineTo(mid + 6, mid + 11);
      iconCtx.lineTo(mid - 6, mid + 11);
      iconCtx.closePath();
      iconCtx.fill();
      iconCtx.stroke();

      iconCtx.fillStyle = "#dce6f3";
      iconCtx.fillRect(mid - 4.5, mid - 14, 9, 5);
      return;
    }

    if (itemId === "manaPotion01") {
      iconCtx.strokeStyle = "#d6e4f5";
      iconCtx.fillStyle = "#185d9c";
      iconCtx.lineWidth = 2.8;
      iconCtx.beginPath();
      iconCtx.moveTo(mid - 8, mid - 9);
      iconCtx.lineTo(mid + 8, mid - 9);
      iconCtx.lineTo(mid + 6, mid + 11);
      iconCtx.lineTo(mid - 6, mid + 11);
      iconCtx.closePath();
      iconCtx.fill();
      iconCtx.stroke();

      iconCtx.fillStyle = "#dce6f3";
      iconCtx.fillRect(mid - 4.5, mid - 14, 9, 5);
      return;
    }

    iconCtx.fillStyle = "#8fa3b8";
    iconCtx.beginPath();
    iconCtx.arc(mid, mid, 10, 0, Math.PI * 2);
    iconCtx.fill();
  });
}

function getBindingDisplay(binding) {
  const parsed = parseActionBinding(binding);
  if (parsed.kind === "item") {
    const itemDef = itemDefsById.get(parsed.id);
    return {
      kind: "item",
      id: parsed.id,
      iconUrl: getItemIconUrl(parsed.id),
      name: (itemDef && itemDef.name) || parsed.id || "Item",
      bound: !!parsed.id,
      tooltip: buildItemTooltip(parsed.id)
    };
  }

  const actionId = parsed.id || "none";
  const def = getActionDefById(actionId);
  return {
    kind: "action",
    id: actionId,
    iconUrl: actionId === "none" ? "" : getActionIconUrl(actionId),
    name: def.name || "Action",
    bound: actionId !== "none",
    tooltip: buildAbilityTooltip(actionId)
  };
}

function ensureInventorySlotsLength() {
  const targetLength = Math.max(1, Math.floor(inventoryState.cols * inventoryState.rows));
  while (inventoryState.slots.length < targetLength) {
    inventoryState.slots.push(null);
  }
  if (inventoryState.slots.length > targetLength) {
    inventoryState.slots.length = targetLength;
  }
}

function updateInventoryUI() {
  if (!inventoryGrid || !inventoryPanel) {
    return;
  }

  ensureInventorySlotsLength();
  const gridWidth =
    inventoryState.cols * INVENTORY_SLOT_SIZE_PX + Math.max(0, inventoryState.cols - 1) * INVENTORY_SLOT_GAP_PX;
  const requiredPanelWidth = gridWidth + INVENTORY_PANEL_PADDING_PX * 2 + INVENTORY_PANEL_BORDER_PX * 2;
  const maxPanelWidth = Math.max(180, window.innerWidth - 24);
  const panelWidth = Math.min(requiredPanelWidth, maxPanelWidth);
  inventoryPanel.style.width = `${panelWidth}px`;
  inventoryPanel.style.overflowX = requiredPanelWidth > panelWidth ? "auto" : "visible";
  inventoryGrid.style.gridTemplateColumns = `repeat(${inventoryState.cols}, ${INVENTORY_SLOT_SIZE_PX}px)`;
  inventoryGrid.innerHTML = "";

  for (let i = 0; i < inventoryState.slots.length; i += 1) {
    const slotData = inventoryState.slots[i];
    const slotEl = document.createElement("div");
    slotEl.className = "inventory-slot";
    slotEl.dataset.index = String(i);
    slotEl.addEventListener("dragover", (event) => {
      if (dragState.inventoryFrom === null) {
        return;
      }
      event.preventDefault();
      slotEl.classList.add("drag-hover");
    });
    slotEl.addEventListener("dragleave", () => {
      slotEl.classList.remove("drag-hover");
    });
    slotEl.addEventListener("drop", (event) => {
      event.preventDefault();
      slotEl.classList.remove("drag-hover");
      if (dragState.inventoryFrom === null) {
        return;
      }
      const from = dragState.inventoryFrom;
      const to = i;
      clearDragState();
      if (from === to) {
        return;
      }
      sendJsonMessage({
        type: "inventory_move",
        from,
        to
      });
    });

    if (slotData && slotData.itemId) {
      slotEl.classList.add("has-item");
      slotEl.draggable = true;
      slotEl.title = buildItemTooltip(slotData.itemId, slotData.qty);
      slotEl.addEventListener("dragstart", (event) => {
        dragState.source = "inventory";
        dragState.inventoryFrom = i;
        dragState.fromActionSlot = "";
        dragState.itemId = slotData.itemId;
        dragState.actionBinding = "";
        event.dataTransfer.effectAllowed = "move";
      });
      slotEl.addEventListener("dragend", () => {
        clearDragState();
      });

      const iconEl = document.createElement("div");
      iconEl.className = "inv-icon";
      iconEl.style.backgroundImage = `url(${getItemIconUrl(slotData.itemId)})`;
      slotEl.appendChild(iconEl);

      const qtyEl = document.createElement("div");
      qtyEl.className = "inv-qty";
      qtyEl.textContent = String(slotData.qty || 0);
      slotEl.appendChild(qtyEl);
    }

    inventoryGrid.appendChild(slotEl);
  }
}

const sharedClientUiPanels = globalThis.VibeClientUiPanels || null;
const sharedCreateUiPanelTools =
  sharedClientUiPanels && typeof sharedClientUiPanels.createUiPanelTools === "function"
    ? sharedClientUiPanels.createUiPanelTools
    : null;
const uiPanelTools = sharedCreateUiPanelTools
  ? sharedCreateUiPanelTools({
      inventoryPanel,
      spellbookPanel,
      dpsPanel,
      dpsTabs,
      dpsValue,
      debugPanel,
      debugNet,
      debugState,
      dpsState,
      trafficWindowMs: TRAFFIC_WINDOW_MS,
      updateInventoryUI,
      updateSpellbookUI,
      getCurrentSelf
    })
  : null;

function setInventoryVisible(visible) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.setInventoryVisible(visible);
}

function toggleInventoryPanel() {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.toggleInventoryPanel();
}

function setSpellbookVisible(visible) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.setSpellbookVisible(visible);
}

function toggleSpellbookPanel() {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.toggleSpellbookPanel();
}

function ensureActionBarInitialized() {
  if (!actionBar || actionSlotEls.size) {
    return;
  }

  actionBar.innerHTML = "";
  for (const slotId of ACTION_SLOT_ORDER) {
    const slot = document.createElement("div");
    slot.className = "action-slot empty";
    slot.dataset.slot = slotId;

    const progress = document.createElement("div");
    progress.className = "slot-progress cooldown";

    const key = document.createElement("div");
    key.className = "slot-key";
    key.textContent = ACTION_SLOT_LABELS[slotId] || slotId;

    const icon = document.createElement("div");
    icon.className = "slot-icon";

    const name = document.createElement("div");
    name.className = "slot-name";

    slot.appendChild(progress);
    slot.appendChild(key);
    slot.appendChild(icon);
    slot.appendChild(name);

    slot.addEventListener("dragover", (event) => {
      const canDropActionBinding = !!dragState.actionBinding;
      const canDropItemBinding =
        !!dragState.itemId &&
        (() => {
          const itemDef = itemDefsById.get(dragState.itemId);
          return !!(itemDef && itemDef.effect && itemDef.effect.type);
        })();
      if (!canDropActionBinding && !canDropItemBinding) {
        return;
      }
      event.preventDefault();
      slot.classList.add("drag-hover");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drag-hover");
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drag-hover");
      if (dragState.actionBinding) {
        const fromSlot = dragState.fromActionSlot;
        if (dragState.source === "action_slot" && fromSlot) {
          if (fromSlot !== slotId) {
            const fromBinding = actionBindings.get(fromSlot) || makeActionBinding("none");
            const toBinding = actionBindings.get(slotId) || makeActionBinding("none");
            actionBindings.set(slotId, fromBinding);
            actionBindings.set(fromSlot, toBinding);
          }
        } else {
          actionBindings.set(slotId, dragState.actionBinding);
        }
        clearDragState();
        updateActionBarUI(getCurrentSelf());
        return;
      }

      if (dragState.itemId) {
        const itemDef = itemDefsById.get(dragState.itemId);
        if (!itemDef || !itemDef.effect || !itemDef.effect.type) {
          clearDragState();
          return;
        }
        actionBindings.set(slotId, makeItemBinding(dragState.itemId));
        clearDragState();
        updateActionBarUI(getCurrentSelf());
      }
    });
    slot.addEventListener("dragstart", (event) => {
      const binding = actionBindings.get(slotId) || makeActionBinding("none");
      const parsed = parseActionBinding(binding);
      if (parsed.kind === "action" && parsed.id === "none") {
        event.preventDefault();
        return;
      }
      dragState.source = "action_slot";
      dragState.fromActionSlot = slotId;
      dragState.actionBinding = binding;
      dragState.inventoryFrom = null;
      dragState.itemId = "";
      event.dataTransfer.effectAllowed = "move";
    });
    slot.addEventListener("dragend", () => {
      clearDragState();
    });

    actionBar.appendChild(slot);

    actionSlotEls.set(slotId, {
      root: slot,
      progress,
      icon,
      name
    });
  }
}

function applyDefaultActionBindings(classType) {
  if (!uiActionTools) {
    actionBindingsClassType = String(classType || "").trim();
    return;
  }
  actionBindingsClassType = uiActionTools.applyDefaultActionBindings(classType);
}

function ensureActionBindingsForClass(classType) {
  if (!uiActionTools) {
    return;
  }
  actionBindingsClassType = uiActionTools.ensureActionBindingsForClass(classType, actionBindingsClassType);
}

function getActionVisualState(binding, self, now) {
  if (!uiActionTools) {
    return { type: "cooldown", ratio: 0 };
  }
  return uiActionTools.getActionVisualState(binding, self, now);
}

function updateActionBarUI(self) {
  ensureActionBarInitialized();
  if (!actionBar || !actionUi) {
    return;
  }
  if (!self) {
    actionUi.classList.add("hidden");
    updateResourceBars(null);
    updateSpellbookUI(null);
    return;
  }

  actionUi.classList.remove("hidden");
  ensureActionBindingsForClass(self.classType);
  updateSpellbookUI(self);
  updateResourceBars(self);
  const now = performance.now();

  for (const slotId of ACTION_SLOT_ORDER) {
    const slot = actionSlotEls.get(slotId);
    if (!slot) {
      continue;
    }

    const binding = actionBindings.get(slotId) || makeActionBinding("none");
    const display = getBindingDisplay(binding);
    slot.icon.style.backgroundImage = display.iconUrl ? `url(${display.iconUrl})` : "";
    slot.name.textContent = display.name;
    slot.root.classList.toggle("empty", !display.bound);
    slot.root.classList.toggle("bound", display.bound);
    slot.root.title = display.tooltip || display.name;
    slot.root.draggable = display.bound;

    const visual = getActionVisualState(binding, self, now);
    slot.progress.className = `slot-progress ${visual.type}`;
    slot.progress.style.transform = `scaleX(${clamp(visual.ratio, 0, 1)})`;
  }
}

function byteLengthOfWsData(data) {
  if (typeof data === "string") {
    return textEncoder.encode(data).length;
  }
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  if (ArrayBuffer.isView(data)) {
    return data.byteLength;
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.size;
  }
  return 0;
}

function pruneTraffic(now) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.pruneTraffic(now);
}

function addTrafficEvent(direction, bytes) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.addTrafficEvent(direction, bytes);
}

function formatKbps(bytesInWindow) {
  if (!uiPanelTools) {
    return "0.00";
  }
  return uiPanelTools.formatKbps(bytesInWindow);
}

function updateDebugPanel() {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.updateDebugPanel();
}

function setDebugEnabled(enabled) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.setDebugEnabled(enabled);
}

function toggleDebugPanel() {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.toggleDebugPanel();
}

function pruneDpsSamples(now) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.pruneDpsSamples(now);
}

function addDpsSample(amount, now = performance.now()) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.addDpsSample(amount, now);
}

function getDpsAverage(windowSec, now = performance.now()) {
  if (!uiPanelTools) {
    return 0;
  }
  return uiPanelTools.getDpsAverage(windowSec, now);
}

function setDpsWindow(windowSec) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.setDpsWindow(windowSec);
}

function updateDpsPanel() {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.updateDpsPanel();
}

function setDpsVisible(visible) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.setDpsVisible(visible);
}

function toggleDpsPanel() {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.toggleDpsPanel();
}

function initializeDpsPanel() {
  if (!dpsTabs) {
    return;
  }
  for (const node of dpsTabs.querySelectorAll(".dps-tab")) {
    node.addEventListener("click", () => {
      const windowSec = Number(node.getAttribute("data-window") || 0);
      setDpsWindow(windowSec);
    });
  }
  setDpsWindow(dpsState.selectedWindowSec);
}

function sendJsonMessage(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  const serialized = JSON.stringify(payload);
  addTrafficEvent("up", byteLengthOfWsData(serialized));
  socket.send(serialized);
  return true;
}

function triggerRemotePlayerSwing(playerId, dx, dy) {
  const angle = Math.atan2(dy, dx);
  remotePlayerSwings.set(playerId, {
    activeUntil: performance.now() + 170,
    durationMs: 170,
    angle: Number.isFinite(angle) ? angle : 0
  });
}

function triggerRemoteMobBite(mobId, dx, dy, abilityId = "") {
  const angle = Math.atan2(dy, dx);
  const previous = remoteMobBites.get(mobId);
  const sequence = previous ? (((Number(previous.sequence) || 0) + 1) & 0xff) : 0;
  remoteMobBites.set(mobId, {
    activeUntil: performance.now() + 160,
    durationMs: 160,
    angle: Number.isFinite(angle) ? angle : 0,
    sequence
  });
  const mob = entityRuntime.mobs.get(mobId);
  const meta = entityRuntime.mobMeta.get(mobId);
  const mobName = (mob && mob.name) || (meta && meta.name) || "";
  const mobX = Number((mob && mob.x) ?? 0);
  const mobY = Number((mob && mob.y) ?? 0);
  const resolvedAbilityId = toAbilityAudioId(abilityId);
  if (resolvedAbilityId) {
    const abilityDef = getActionDefById(resolvedAbilityId);
    if (Math.max(0, Number(abilityDef.castMs) || 0) <= 0) {
      playSpatialAbilityAudioEvent(
        resolvedAbilityId,
        "cast",
        mobX,
        mobY,
        performance.now(),
        0.64,
        `mob-attack:${mobId}:${resolvedAbilityId}`,
        80
      );
    }
  } else if (mobName) {
    playMobEventSound(mobName, "attack", mobX, mobY, performance.now(), 0.66, 100);
  }
}

function pushSnapshot(msg) {
  snapshots.push({
    t: performance.now(),
    self: msg.self ? { ...msg.self } : null,
    players: Array.isArray(msg.players) ? msg.players.map((entity) => ({ ...entity })) : [],
    projectiles: Array.isArray(msg.projectiles) ? msg.projectiles.map((entity) => ({ ...entity })) : [],
    mobs: Array.isArray(msg.mobs) ? msg.mobs.map((entity) => ({ ...entity })) : [],
    lootBags: Array.isArray(msg.lootBags) ? msg.lootBags.map((entity) => ({ ...entity })) : []
  });

  while (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.shift();
  }
}

function clearEntityRuntime() {
  entityRuntime.self = null;
  entityRuntime.players.clear();
  entityRuntime.mobMeta.clear();
  entityRuntime.mobs.clear();
  entityRuntime.projectileMeta.clear();
  entityRuntime.projectiles.clear();
  entityRuntime.lootBags.clear();
  entityRuntime.lootBagMeta.clear();
  entityRuntime.playerMeta.clear();
  remoteMobCasts.clear();
  stopAllSpatialLoops();
  clearSelfNegativeEffects();
  remotePlayerStuns.clear();
  remotePlayerSlows.clear();
  remotePlayerBurns.clear();
}

function syncEntityArraysToGameState() {
  gameState.players = Array.from(entityRuntime.players.values()).map((entity) => ({ ...entity }));
  gameState.mobs = Array.from(entityRuntime.mobs.values()).map((entity) => ({ ...entity }));
  gameState.projectiles = Array.from(entityRuntime.projectiles.values()).map((entity) => ({ ...entity }));
  gameState.lootBags = Array.from(entityRuntime.lootBags.values()).map((entity) => {
    const meta = entityRuntime.lootBagMeta.get(entity.id);
    return {
      ...entity,
      items: meta ? meta.items : []
    };
  });
}

function syncSelfToGameState() {
  if (!entityRuntime.self) {
    gameState.self = null;
    return;
  }
  const prev = gameState.self || {};
  const abilityLevels =
    entityRuntime.self.abilityLevels && typeof entityRuntime.self.abilityLevels === "object"
      ? { ...entityRuntime.self.abilityLevels }
      : prev.abilityLevels && typeof prev.abilityLevels === "object"
        ? { ...prev.abilityLevels }
        : {};
  gameState.self = {
    ...(selfStatic || {}),
    ...(myId ? { id: myId } : {}),
    x: entityRuntime.self.x ?? prev.x ?? 0,
    y: entityRuntime.self.y ?? prev.y ?? 0,
    hp: entityRuntime.self.hp ?? prev.hp ?? 0,
    maxHp: entityRuntime.self.maxHp ?? prev.maxHp ?? 0,
    pendingHeal: entityRuntime.self.pendingHeal ?? prev.pendingHeal ?? 0,
    pendingMana: entityRuntime.self.pendingMana ?? prev.pendingMana ?? 0,
    mana: entityRuntime.self.mana ?? prev.mana ?? 0,
    maxMana: entityRuntime.self.maxMana ?? prev.maxMana ?? 0,
    copper: entityRuntime.self.copper ?? prev.copper ?? 0,
    level: entityRuntime.self.level ?? prev.level ?? 1,
    exp: entityRuntime.self.exp ?? prev.exp ?? 0,
    expToNext: entityRuntime.self.expToNext ?? prev.expToNext ?? 20,
    skillPoints: entityRuntime.self.skillPoints ?? prev.skillPoints ?? 0,
    abilityLevels
  };
}

function applyPlayerCastStates(msg) {
  if (msg && msg.self && typeof msg.self === "object") {
    const previousSelfCast = captureCastStateSnapshot(abilityChannel);
    applyServerCastState(abilityChannel, msg.self);
    syncLocalCastAudio(previousSelfCast, abilityChannel);
  }

  if (!Array.isArray(msg && msg.casts)) {
    return;
  }

  for (const cast of msg.casts) {
    if (!cast || typeof cast.id !== "number") {
      continue;
    }
    if (!cast.active) {
      remotePlayerCasts.delete(cast.id);
      continue;
    }
    const existing = remotePlayerCasts.get(cast.id) || {
      active: false,
      abilityId: "",
      startedAt: 0,
      durationMs: 0
    };
    applyServerCastState(existing, cast);
    remotePlayerCasts.set(cast.id, existing);
  }
}

function applyMobCastStates(msg) {
  if (!Array.isArray(msg && msg.casts)) {
    return;
  }
  const now = performance.now();

  for (const cast of msg.casts) {
    if (!cast || typeof cast.id !== "number") {
      continue;
    }
    const previous = remoteMobCasts.get(cast.id) || null;
    if (!cast.active) {
      if (previous && previous.active) {
        const completion =
          previous.durationMs > 0 ? clamp((now - previous.startedAt) / previous.durationMs, 0, 1) : 0;
        if (completion >= 0.85 && previous.abilityId) {
          const pos = getRuntimeMobPosition(cast.id);
          if (pos) {
            playSpatialAbilityAudioEvent(
              previous.abilityId,
              "cast",
              pos.x,
              pos.y,
              now,
              0.9,
              `mobcast-finish:${cast.id}`,
              40
            );
            playSpatialAbilityAudioEvent(
              previous.abilityId,
              "flying",
              pos.x,
              pos.y,
              now,
              0.52,
              `mobcast-flying:${cast.id}`,
              60
            );
          }
        }
      }
      stopMobCastSpatialLoop(cast.id);
      remoteMobCasts.delete(cast.id);
      continue;
    }
    const existing = previous || {
      active: false,
      abilityId: "",
      startedAt: 0,
      durationMs: 0
    };
    const previousAbilityId = String(existing.abilityId || "");
    const previousActive = !!existing.active;
    applyServerCastState(existing, cast);
    if (previousActive && previousAbilityId && previousAbilityId !== String(existing.abilityId || "")) {
      stopMobCastSpatialLoop(cast.id);
    }
    remoteMobCasts.set(cast.id, existing);
  }
}

function applyMobEffects(msg) {
  const now = performance.now();
  remoteMobStuns.clear();
  remoteMobSlows.clear();
  remoteMobBurns.clear();
  if (!Array.isArray(msg && msg.effects)) {
    return;
  }
  for (const effect of msg.effects) {
    if (!effect || typeof effect.id !== "number") {
      continue;
    }
    const stunnedMs = Math.max(0, Number(effect.stunnedMs) || 0);
    if (stunnedMs <= 0) {
      // Keep parsing slow-only effects below.
    } else {
      remoteMobStuns.set(effect.id, {
        endsAt: now + stunnedMs
      });
    }
    const slowedMs = Math.max(0, Number(effect.slowedMs) || 0);
    if (slowedMs > 0) {
      const slowMultiplierQ = Math.max(1, Math.floor(Number(effect.slowMultiplierQ) || 1000));
      remoteMobSlows.set(effect.id, {
        endsAt: now + slowedMs,
        multiplier: clamp(slowMultiplierQ / 1000, 0.1, 1)
      });
    }
    const burningMs = Math.max(0, Number(effect.burningMs) || 0);
    if (burningMs > 0) {
      remoteMobBurns.set(effect.id, {
        endsAt: now + burningMs
      });
    }
  }
}

function applyPlayerMeta(metaPlayers) {
  if (!Array.isArray(metaPlayers)) {
    return;
  }
  for (const meta of metaPlayers) {
    if (!meta || typeof meta.id !== "number") {
      continue;
    }
    entityRuntime.playerMeta.set(meta.id, {
      name: String(meta.name || `P${meta.id}`),
      classType: String(meta.classType || getDefaultClassId())
    });

    const existing = entityRuntime.players.get(meta.id);
    if (existing) {
      existing.name = String(meta.name || existing.name || `P${meta.id}`);
      existing.classType = String(meta.classType || existing.classType || getDefaultClassId());
      entityRuntime.players.set(meta.id, existing);
    }
  }
}

function applyMobMeta(metaMobs) {
  if (!Array.isArray(metaMobs)) {
    return;
  }
  for (const meta of metaMobs) {
    if (!meta || typeof meta.id !== "number") {
      continue;
    }
    const name = String(meta.name || `Mob ${meta.id}`).slice(0, 32);
    const renderStyle = normalizeMobRenderStyle(meta.renderStyle);
    entityRuntime.mobMeta.set(meta.id, { name, renderStyle });

    const existing = entityRuntime.mobs.get(meta.id);
    if (existing) {
      existing.name = name;
      existing.renderStyle = renderStyle;
      entityRuntime.mobs.set(meta.id, existing);
    }
  }
}

function applyProjectileMeta(metaProjectiles) {
  if (!Array.isArray(metaProjectiles)) {
    return;
  }
  for (const meta of metaProjectiles) {
    if (!meta || typeof meta.id !== "number") {
      continue;
    }
    const abilityId = String(meta.abilityId || "").trim().toLowerCase();
    entityRuntime.projectileMeta.set(meta.id, { abilityId });
    const existing = entityRuntime.projectiles.get(meta.id);
    if (existing) {
      existing.abilityId = abilityId;
      entityRuntime.projectiles.set(meta.id, existing);
    }
  }
}

function applyLootBagMeta(metaBags) {
  if (!Array.isArray(metaBags)) {
    return;
  }
  for (const meta of metaBags) {
    if (!meta || typeof meta.id !== "number") {
      continue;
    }
    const items = Array.isArray(meta.items)
      ? meta.items
          .map((entry) => {
            if (!entry) {
              return null;
            }
            const itemId = String(entry.itemId || "").trim();
            const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
            if (!itemId || qty <= 0) {
              return null;
            }
            const itemDef = itemDefsById.get(itemId);
            return {
              itemId,
              qty,
              name: (itemDef && itemDef.name) || String(entry.name || itemId)
            };
          })
          .filter(Boolean)
      : [];

    entityRuntime.lootBagMeta.set(meta.id, { items });
    const existing = entityRuntime.lootBags.get(meta.id);
    if (existing) {
      existing.items = items;
      entityRuntime.lootBags.set(meta.id, existing);
    }
  }
}

function applyItemDefs(items) {
  itemDefsById.clear();
  for (const entry of Array.isArray(items) ? items : []) {
    if (!entry) {
      continue;
    }
    const id = String(entry.id || "").trim();
    if (!id) {
      continue;
    }
    itemDefsById.set(id, {
      id,
      name: String(entry.name || id),
      stackSize: Math.max(1, Math.floor(Number(entry.stackSize) || 1)),
      description: String(entry.description || ""),
      icon: String(entry.icon || ""),
      effect: entry.effect && typeof entry.effect === "object" ? entry.effect : null
    });
  }
  updateInventoryUI();
  updateActionBarUI(getCurrentSelf());
}

function applyClassAndAbilityDefs(classes, abilities) {
  stopAllAbilityChannelAudio();
  abilityAudioRegistry.clear();
  abilityDefsById.clear();
  classDefsById.clear();

  for (const ability of Array.isArray(abilities) ? abilities : []) {
    if (!ability) {
      continue;
    }
    const normalizedEntryRaw =
      clientAbilityNormalizationTools && typeof clientAbilityNormalizationTools.normalizeAbilityEntry === "function"
        ? clientAbilityNormalizationTools.normalizeAbilityEntry(ability.id, ability)
        : ability;
    const normalizedEntry =
      normalizedEntryRaw && typeof normalizedEntryRaw === "object" ? normalizedEntryRaw : ability;
    const id = String(normalizedEntry && normalizedEntry.id ? normalizedEntry.id : ability.id || "").trim();
    if (!id) {
      continue;
    }
    const normalizedAbility = {
      id,
      name: String(normalizedEntry.name || id),
      description: String(normalizedEntry.description || ""),
      kind: String(normalizedEntry.kind || "meleeCone"),
      cooldownMs: Math.max(0, Math.floor(Number(normalizedEntry.cooldownMs) || 0)),
      range: Math.max(0, Number(normalizedEntry.range) || 0),
      speed: Math.max(0, Number(normalizedEntry.speed) || 0),
      castMs: Math.max(0, Math.floor(Number(normalizedEntry.castMs) || 0)),
      manaCost: Math.max(0, Number(normalizedEntry.manaCost) || 0),
      damageMin: Math.max(0, Number(normalizedEntry.damageMin) || 0),
      damageMax: Math.max(0, Number(normalizedEntry.damageMax) || 0),
      damagePerLevelMin: Math.max(0, Number(normalizedEntry.damagePerLevelMin) || 0),
      damagePerLevelMax: Math.max(0, Number(normalizedEntry.damagePerLevelMax) || 0),
      coneAngleDeg: Math.max(0, Number(normalizedEntry.coneAngleDeg) || 0),
      projectileHitRadius: Math.max(0, Number(normalizedEntry.projectileHitRadius) || 0),
      explosionRadius: Math.max(0, Number(normalizedEntry.explosionRadius) || 0),
      explosionDamageMultiplier: Math.max(0, Number(normalizedEntry.explosionDamageMultiplier) || 0),
      beamWidth: Math.max(0, Number(normalizedEntry.beamWidth) || 0),
      stunDurationMs: Math.max(0, Math.floor(Number(normalizedEntry.stunDurationMs) || 0)),
      slowDurationMs: Math.max(0, Math.floor(Number(normalizedEntry.slowDurationMs) || 0)),
      slowMultiplier: clamp(Number(normalizedEntry.slowMultiplier) || 1, 0.1, 1)
    };

    for (const [key, value] of Object.entries(normalizedEntry)) {
      if (key in normalizedAbility || key === "id") {
        continue;
      }
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        normalizedAbility[key] = value;
      } else if (
        Array.isArray(value) &&
        value.length &&
        value.every((v) => Number.isFinite(Number(v)))
      ) {
        const arr = value.map((v) => Number(v));
        if (arr.some((v) => v > 0)) {
          normalizedAbility[key] = arr;
        }
      }
    }

    abilityDefsById.set(id, normalizedAbility);
  }

  const classOptions = [];
  for (const classDef of Array.isArray(classes) ? classes : []) {
    if (!classDef) {
      continue;
    }
    const id = String(classDef.id || "").trim();
    if (!id) {
      continue;
    }
    const abilitiesList = Array.isArray(classDef.abilities)
      ? classDef.abilities
          .map((entry) => {
            const abilityId = String(entry?.id || "").trim();
            const level = Math.max(1, Math.floor(Number(entry?.level) || 1));
            if (!abilityId) {
              return null;
            }
            return { id: abilityId, level };
          })
          .filter(Boolean)
      : [];

    classDefsById.set(id, {
      id,
      name: String(classDef.name || id),
      description: String(classDef.description || ""),
      baseHealth: Math.max(1, Math.floor(Number(classDef.baseHealth) || 1)),
      baseMana: Math.max(0, Math.floor(Number(classDef.baseMana) || 0)),
      manaRegen: Math.max(0, Number(classDef.manaRegen) || 0),
      abilities: abilitiesList
    });
    classOptions.push({
      id,
      name: String(classDef.name || id)
    });
  }

  if (classTypeSelect) {
    const prevValue = String(classTypeSelect.value || "");
    classTypeSelect.innerHTML = "";
    for (const optionDef of classOptions) {
      const option = document.createElement("option");
      option.value = optionDef.id;
      option.textContent = optionDef.name;
      classTypeSelect.appendChild(option);
    }
    if (prevValue && classDefsById.has(prevValue)) {
      classTypeSelect.value = prevValue;
    } else if (classOptions.length) {
      classTypeSelect.value = classOptions[0].id;
    }
  }

  if (selfStatic && selfStatic.classType) {
    ensureActionBindingsForClass(selfStatic.classType);
  }
  preloadAllAbilityAudio();
  spellbookState.signature = "";
  updateActionBarUI(getCurrentSelf());
}

async function loadInitialGameConfig() {
  try {
    const response = await fetch("/api/game-config", {
      cache: "no-store"
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    if (payload && typeof payload === "object" && payload.sounds) {
      applySoundManifest(payload.sounds);
    }
    applyClassAndAbilityDefs(payload.classes, payload.abilities);
    if (payload && typeof payload === "object" && payload.gameplay) {
      applyGameplayClientConfig(payload.gameplay);
    }
    if (Array.isArray(payload.items)) {
      applyItemDefs(payload.items);
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function applyInventoryState(msg) {
  const cols = Math.max(1, Math.min(12, Math.floor(Number(msg.cols) || 5)));
  const rows = Math.max(1, Math.min(12, Math.floor(Number(msg.rows) || 2)));
  const targetLength = cols * rows;
  const nextSlots = [];

  for (let i = 0; i < targetLength; i += 1) {
    const raw = Array.isArray(msg.slots) ? msg.slots[i] : null;
    if (!raw) {
      nextSlots.push(null);
      continue;
    }
    const itemId = String(raw.itemId || "").trim();
    const qty = Math.max(0, Math.floor(Number(raw.qty) || 0));
    if (!itemId || qty <= 0) {
      nextSlots.push(null);
      continue;
    }
    nextSlots.push({ itemId, qty });
  }

  inventoryState.cols = cols;
  inventoryState.rows = rows;
  inventoryState.slots = nextSlots;
  updateInventoryUI();
}

const sharedClientNetworkPackets = globalThis.VibeClientNetworkPackets || null;
const sharedCreateNetworkPacketParsers =
  sharedClientNetworkPackets && typeof sharedClientNetworkPackets.createNetworkPacketParsers === "function"
    ? sharedClientNetworkPackets.createNetworkPacketParsers
    : null;
const networkPacketParsers = sharedCreateNetworkPacketParsers
  ? sharedCreateNetworkPacketParsers({
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
      MOB_EFFECT_FLAG_STUN,
      MOB_EFFECT_FLAG_SLOW,
      MOB_EFFECT_FLAG_REMOVE,
      MOB_EFFECT_FLAG_BURN,
      AREA_EFFECT_OP_UPSERT,
      AREA_EFFECT_OP_REMOVE,
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
      SELF_MODE_FULL,
      SELF_MODE_DELTA,
      textDecoder,
      normalizeMobRenderStyle,
      clamp,
      getDefaultClassId,
      dequantizePos,
      decodeDamageEventFlags,
      entityRuntime,
      gameState,
      remotePlayerCasts,
      remotePlayerStuns,
      remotePlayerSlows,
      remotePlayerBurns,
      remoteMobCasts,
      remoteMobStuns,
      remoteMobSlows,
      remoteMobBurns,
      activeAreaEffectsById,
      stopMobCastSpatialLoop,
      stopProjectileFlightSpatialLoop,
      syncEntityArraysToGameState,
      syncSelfToGameState,
      pushSnapshot,
      upsertAreaEffectState,
      addFloatingDamageEvents
    })
  : null;

function parseEntityBinaryPacket(arrayBuffer) {
  if (!networkPacketParsers) {
    return;
  }
  networkPacketParsers.parseEntityBinaryPacket(arrayBuffer);
}

function parseMobEffectBinaryPacket(arrayBuffer) {
  if (!networkPacketParsers) {
    return;
  }
  networkPacketParsers.parseMobEffectBinaryPacket(arrayBuffer);
}

function parseAreaEffectBinaryPacket(arrayBuffer) {
  if (!networkPacketParsers) {
    return;
  }
  networkPacketParsers.parseAreaEffectBinaryPacket(arrayBuffer);
}

function parseMobMetaBinaryPacket(arrayBuffer) {
  if (!networkPacketParsers) {
    return;
  }
  networkPacketParsers.parseMobMetaBinaryPacket(arrayBuffer);
}

function parseProjectileMetaBinaryPacket(arrayBuffer) {
  if (!networkPacketParsers) {
    return;
  }
  networkPacketParsers.parseProjectileMetaBinaryPacket(arrayBuffer);
}

function parseDamageEventBinaryPacket(arrayBuffer) {
  if (!networkPacketParsers) {
    return;
  }
  networkPacketParsers.parseDamageEventBinaryPacket(arrayBuffer);
}

function parseBinaryPacket(arrayBuffer) {
  if (!networkPacketParsers) {
    return;
  }
  networkPacketParsers.parseBinaryPacket(arrayBuffer);
}

const sharedClientRenderState = globalThis.VibeClientRenderState || null;
const sharedCreateRenderStateInterpolator =
  sharedClientRenderState && typeof sharedClientRenderState.createRenderStateInterpolator === "function"
    ? sharedClientRenderState.createRenderStateInterpolator
    : null;
const renderStateInterpolator = sharedCreateRenderStateInterpolator
  ? sharedCreateRenderStateInterpolator({
      snapshots,
      clamp,
      lerp,
      interpolationDelayMs: INTERPOLATION_DELAY_MS
    })
  : null;

function blendEntityList(previousList, currentList, alpha) {
  if (!renderStateInterpolator) {
    return Array.isArray(currentList) ? currentList : [];
  }
  return renderStateInterpolator.blendEntityList(previousList, currentList, alpha);
}

function getInterpolatedState() {
  if (!renderStateInterpolator) {
    return null;
  }
  return renderStateInterpolator.getInterpolatedState(performance.now());
}

function resetClientSessionState() {
  gameState.self = null;
  gameState.players = [];
  gameState.projectiles = [];
  gameState.mobs = [];
  gameState.lootBags = [];
  inventoryState.slots = [];
  entityRuntime.lootBagMeta.clear();
  setInventoryVisible(false);
  setSpellbookVisible(false);
  updateInventoryUI();
  remotePlayerSwings.clear();
  remotePlayerCasts.clear();
  remotePlayerStuns.clear();
  remotePlayerSlows.clear();
  remotePlayerBurns.clear();
  remoteMobCasts.clear();
  remoteMobBites.clear();
  remoteMobStuns.clear();
  remoteMobSlows.clear();
  remoteMobBurns.clear();
  zombieWalkRuntime.clear();
  creeperWalkRuntime.clear();
  spiderWalkRuntime.clear();
  orcWalkRuntime.clear();
  skeletonWalkRuntime.clear();
  skeletonArcherWalkRuntime.clear();
  warriorAnimRuntime.clear();
  floatingDamageNumbers.length = 0;
  activeExplosions.length = 0;
  activeAreaEffectsById.clear();
  abilityRuntime.clear();
  dpsState.samples.length = 0;
  setDpsVisible(false);
  spellbookState.signature = "";
  resetAbilityChanneling();
  clearEntityRuntime();
  snapshots.length = 0;
  lastRenderState = null;
}

function handleServerSelfProgress(msg) {
  if (!entityRuntime.self) {
    const classDef = classDefsById.get(String((selfStatic && selfStatic.classType) || ""));
    const fallbackMaxMana = Math.max(0, Number(classDef?.baseMana) || 0);
    entityRuntime.self = {
      x: gameState.self ? gameState.self.x : 0,
      y: gameState.self ? gameState.self.y : 0,
      hp: gameState.self ? gameState.self.hp : 0,
      maxHp: gameState.self ? gameState.self.maxHp : 0,
      pendingHeal: gameState.self ? gameState.self.pendingHeal ?? 0 : 0,
      pendingMana: gameState.self ? gameState.self.pendingMana ?? 0 : 0,
      mana: gameState.self ? gameState.self.mana ?? fallbackMaxMana : fallbackMaxMana,
      maxMana: gameState.self ? gameState.self.maxMana ?? fallbackMaxMana : fallbackMaxMana,
      copper: 0,
      level: 1,
      exp: 0,
      expToNext: 20,
      skillPoints: 0,
      abilityLevels: {},
      _xq: gameState.self ? Math.round(gameState.self.x * POS_SCALE) : 0,
      _yq: gameState.self ? Math.round(gameState.self.y * POS_SCALE) : 0
    };
  }
  const copper = Number(msg.copper);
  const level = Number(msg.level);
  const exp = Number(msg.exp);
  const expToNext = Number(msg.expToNext);
  const skillPoints = Number(msg.skillPoints);
  const abilityLevels = parseAbilityLevelsPayload(msg.abilityLevels);
  if (Number.isFinite(copper) && copper >= 0) {
    entityRuntime.self.copper = copper;
  }
  if (Number.isFinite(level) && level >= 1) {
    entityRuntime.self.level = level;
  }
  if (Number.isFinite(exp) && exp >= 0) {
    entityRuntime.self.exp = exp;
  }
  if (Number.isFinite(expToNext) && expToNext >= 1) {
    entityRuntime.self.expToNext = expToNext;
  }
  if (Number.isFinite(skillPoints) && skillPoints >= 0) {
    entityRuntime.self.skillPoints = Math.floor(skillPoints);
  }
  if (msg.abilityLevels !== undefined) {
    entityRuntime.self.abilityLevels = abilityLevels;
  }
  syncSelfToGameState();
}

function handleServerLootPicked(msg) {
  if (Array.isArray(msg.itemsGained) && msg.itemsGained.length) {
    const summary = msg.itemsGained
      .map((entry) => {
        const itemId = String(entry.itemId || "");
        const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
        const itemDef = itemDefsById.get(itemId);
        return `${(itemDef && itemDef.name) || String(entry.name || itemId)} x${qty}`;
      })
      .join(", ");
    if (summary) {
      setStatus(`Looted: ${summary}${msg.inventoryFull ? " (bag still has leftovers)" : ""}`);
    }
  } else if (msg.inventoryFull) {
    setStatus("Inventory is full.");
  }
}

function handleServerItemUsed(msg) {
  const itemId = String(msg.itemId || "");
  const itemDef = itemDefsById.get(itemId);
  const effectType = String(msg.effectType || "").toLowerCase();
  const healed = Math.max(0, Math.floor(Number(msg.healed) || 0));
  const restoredMana = Math.max(0, Number(msg.restoredMana) || 0);
  const overTime = !!msg.overTime;
  const effectValue = Math.max(0, Number(msg.effectValue) || 0);
  const effectDuration = Math.max(0, Number(msg.effectDuration) || 0);
  if (effectType === "mana") {
    if (overTime && effectValue > 0 && effectDuration > 0) {
      setStatus(
        `Used ${(itemDef && itemDef.name) || itemId} (+${Math.floor(effectValue)} MP over ${effectDuration.toFixed(1)}s)`
      );
    } else {
      setStatus(
        `Used ${(itemDef && itemDef.name) || itemId}${restoredMana > 0 ? ` (+${Math.floor(restoredMana)} MP)` : ""}`
      );
    }
  } else if (overTime && effectValue > 0 && effectDuration > 0) {
    setStatus(
      `Used ${(itemDef && itemDef.name) || itemId} (+${Math.floor(effectValue)} HP over ${effectDuration.toFixed(1)}s)`
    );
  } else {
    setStatus(`Used ${(itemDef && itemDef.name) || itemId}${healed > 0 ? ` (+${healed} HP)` : ""}`);
  }
}

const serverMessageHandlers = {
  __open: ({ name, classType }) => {
    sendJsonMessage({
      type: "join",
      name,
      classType
    });
  },
  __close: () => {
    setStatus("Disconnected from server.");
    joinScreen.classList.remove("hidden");
    gameUI.classList.add("hidden");
    selfStatic = null;
    resetClientSessionState();
  },
  error: (msg) => {
    setStatus(msg.message || "Server error.");
  },
  hello: (msg) => {
    if (msg && typeof msg === "object" && msg.sounds) {
      applySoundManifest(msg.sounds);
    }
    applyClassAndAbilityDefs(msg.classes, msg.abilities);
  },
  welcome: (msg) => {
    myId = msg.id;
    selfStatic = msg.selfStatic || {
      id: msg.id,
      name: (pendingJoinInfo && pendingJoinInfo.name) || "You",
      classType: (pendingJoinInfo && pendingJoinInfo.classType) || getDefaultClassId()
    };
    if (msg && typeof msg === "object" && msg.sounds) {
      applySoundManifest(msg.sounds);
    }
    gameState.map = msg.map || gameState.map;
    gameState.visibilityRange = msg.visibilityRange || gameState.visibilityRange;
    resetClientSessionState();
    joinScreen.classList.add("hidden");
    gameUI.classList.remove("hidden");
    ensureActionBindingsForClass(selfStatic.classType);
    setStatus("");
  },
  class_defs: (msg) => applyClassAndAbilityDefs(msg.classes, msg.abilities),
  item_defs: (msg) => applyItemDefs(msg.items),
  inventory_state: (msg) => applyInventoryState(msg),
  player_meta: (msg) => {
    applyPlayerMeta(msg.players);
    syncEntityArraysToGameState();
  },
  lootbag_meta: (msg) => {
    applyLootBagMeta(msg.bags);
    syncEntityArraysToGameState();
  },
  mob_meta: (msg) => {
    applyMobMeta(msg.mobs);
    syncEntityArraysToGameState();
  },
  projectile_meta: (msg) => {
    applyProjectileMeta(msg.projectiles);
    syncEntityArraysToGameState();
  },
  player_swings: (msg) => {
    if (!Array.isArray(msg.swings)) {
      return;
    }
    for (const swing of msg.swings) {
      if (!swing || typeof swing.id !== "number") {
        continue;
      }
      triggerRemotePlayerSwing(swing.id, Number(swing.dx) || 0, Number(swing.dy) || 0);
    }
  },
  player_casts: (msg) => applyPlayerCastStates(msg),
  mob_casts: (msg) => applyMobCastStates(msg),
  player_effects: (msg) => applyPlayerEffects(msg),
  player_effects_nearby: (msg) => applyNearbyPlayerEffects(msg),
  mob_bites: (msg) => {
    if (!Array.isArray(msg.bites)) {
      return;
    }
    for (const bite of msg.bites) {
      if (!bite || typeof bite.id !== "number") {
        continue;
      }
      triggerRemoteMobBite(
        bite.id,
        Number(bite.dx) || 0,
        Number(bite.dy) || 0,
        String(bite.abilityId || "")
      );
    }
  },
  mob_effects: (msg) => applyMobEffects(msg),
  damage_events: (msg) => addFloatingDamageEvents(msg.events),
  explosion_events: (msg) => addExplosionEvents(msg.events),
  area_effects: (msg) => applyAreaEffects(msg.effects),
  projectile_hit_events: (msg) => addProjectileHitEvents(msg.events),
  mob_death_events: (msg) => addMobDeathEvents(msg.events),
  self_progress: (msg) => handleServerSelfProgress(msg),
  loot_picked: (msg) => handleServerLootPicked(msg),
  item_used: (msg) => handleServerItemUsed(msg)
};

const sharedClientNetworkSession = globalThis.VibeClientNetworkSession || null;
const sharedCreateNetworkSessionTools =
  sharedClientNetworkSession && typeof sharedClientNetworkSession.createNetworkSessionTools === "function"
    ? sharedClientNetworkSession.createNetworkSessionTools
    : null;
const networkSessionTools = sharedCreateNetworkSessionTools
  ? sharedCreateNetworkSessionTools({
      addTrafficEvent,
      byteLengthOfWsData,
      parseBinaryPacket,
      messageHandlers: serverMessageHandlers,
      onSocketReady: (nextSocket) => {
        socket = nextSocket;
      }
    })
  : null;

function connectAndJoin(name, classType) {
  pendingJoinInfo = { name, classType };
  if (!networkSessionTools) {
    return;
  }
  socket = networkSessionTools.createSocketSession(name, classType);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  updateInventoryUI();
}

const sharedClientPlayerControls = globalThis.VibeClientPlayerControls || null;
const sharedCreatePlayerControlTools =
  sharedClientPlayerControls && typeof sharedClientPlayerControls.createPlayerControlTools === "function"
    ? sharedClientPlayerControls.createPlayerControlTools
    : null;
const playerControlTools = sharedCreatePlayerControlTools
  ? sharedCreatePlayerControlTools({
      keys,
      movementSync,
      mouseState,
      gameState,
      canvas,
      tileSize: TILE_SIZE,
      sendJsonMessage
    })
  : null;

function getCurrentInputVector() {
  if (!playerControlTools) {
    return { dx: 0, dy: 0 };
  }
  return playerControlTools.getCurrentInputVector();
}

function sendMove() {
  if (!playerControlTools) {
    return;
  }
  playerControlTools.sendMove(socket);
}

function triggerSwordSwing(worldX, worldY) {
  const self = (lastRenderState && lastRenderState.self) || gameState.self;
  if (!self) {
    return;
  }
  swordSwing.angle = Math.atan2(worldY - self.y, worldX - self.x);
  swordSwing.activeUntil = performance.now() + swordSwing.durationMs;
}

function sendPickupBag(worldX, worldY) {
  const self = (lastRenderState && lastRenderState.self) || gameState.self;
  if (!socket || socket.readyState !== WebSocket.OPEN || !self) {
    return;
  }

  sendJsonMessage({
    type: "pickup_bag",
    x: worldX,
    y: worldY
  });
}

function sendUseItem(itemId) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  const resolvedId = String(itemId || "").trim();
  if (!resolvedId) {
    return;
  }
  sendJsonMessage({
    type: "use_item",
    itemId: resolvedId
  });
}

function updateMouseScreenPosition(event) {
  if (!playerControlTools) {
    return;
  }
  playerControlTools.updateMouseScreenPosition(event);
}

function screenToWorld(sx, sy, self) {
  if (!playerControlTools) {
    return { x: 0, y: 0 };
  }
  return playerControlTools.screenToWorld(sx, sy, self);
}

function getCurrentSelf() {
  return (lastRenderState && lastRenderState.self) || gameState.self;
}

function sendAbilityUse(abilityId, worldX, worldY) {
  const self = getCurrentSelf();
  if (!socket || socket.readyState !== WebSocket.OPEN || !self) {
    return false;
  }
  const resolvedAbilityId = String(abilityId || "").trim();
  if (!resolvedAbilityId) {
    return false;
  }

  const dx = worldX - self.x;
  const dy = worldY - self.y;
  const len = Math.hypot(dx, dy);
  if (!len) {
    return false;
  }

  return sendJsonMessage({
    type: "use_ability",
    abilityId: resolvedAbilityId,
    dx: dx / len,
    dy: dy / len,
    distance: len
  });
}

function getAbilityRuntimeKey(abilityId) {
  if (!abilityRuntimeTools) {
    return String(abilityId || "").trim().toLowerCase();
  }
  return abilityRuntimeTools.getAbilityRuntimeKey(abilityId);
}

function canUseAbilityNow(abilityId, now, self = null) {
  if (!abilityRuntimeTools) {
    return true;
  }
  return abilityRuntimeTools.canUseAbilityNow(abilityId, now, self);
}

function markAbilityUsedClient(abilityId, now) {
  if (!abilityRuntimeTools) {
    return;
  }
  abilityRuntimeTools.markAbilityUsedClient(abilityId, now);
}

function hasEnoughManaForAbility(self, abilityId) {
  if (!abilityRuntimeTools) {
    return true;
  }
  return abilityRuntimeTools.hasEnoughManaForAbility(self, abilityId);
}

function useAbilityAt(abilityId, worldX, worldY) {
  if (!abilityRuntimeTools) {
    return false;
  }
  return abilityRuntimeTools.useAbilityAt(abilityId, worldX, worldY);
}

function updateAbilityChannel(now) {
  if (!abilityRuntimeTools) {
    return;
  }
  abilityRuntimeTools.updateAbilityChannel(now);
}

function getActionTargetWorld() {
  if (!uiActionTools) {
    return null;
  }
  return uiActionTools.getActionTargetWorld();
}

function executeBoundAction(slotId) {
  if (!uiActionTools) {
    return false;
  }
  return uiActionTools.executeBoundAction(slotId);
}

function tryPrimaryAutoAction(force = false) {
  if (!uiActionTools) {
    return;
  }
  uiActionTools.tryPrimaryAutoAction(force);
}

function worldToScreen(worldX, worldY, cameraX, cameraY) {
  return {
    x: (worldX - cameraX) * TILE_SIZE + canvas.width / 2,
    y: (worldY - cameraY) * TILE_SIZE + canvas.height / 2
  };
}

function addFloatingDamageEvents(events) {
  if (!Array.isArray(events) || !events.length) {
    return;
  }

  const now = performance.now();
  for (const event of events) {
    if (!event) {
      continue;
    }
    const x = Number(event.x);
    const y = Number(event.y);
    const amount = Math.max(0, Math.round(Number(event.amount) || 0));
    if (!Number.isFinite(x) || !Number.isFinite(y) || amount <= 0) {
      continue;
    }
    if (event.fromSelf) {
      addDpsSample(amount, now);
    }

    floatingDamageNumbers.push({
      id: nextDamageFloatId++,
      x,
      y,
      amount,
      targetType: event.targetType === "player" ? "player" : "mob",
      createdAt: now,
      durationMs: DAMAGE_FLOAT_DURATION_MS,
      jitterX: (Math.random() - 0.5) * 0.34,
      riseOffset: Math.random() * 0.25
    });
  }
}

function addExplosionEvents(events) {
  if (!Array.isArray(events) || !events.length) {
    return;
  }

  const now = performance.now();
  const abilitiesToPlay = new Set();
  for (const event of events) {
    if (!event) {
      continue;
    }
    const x = Number(event.x);
    const y = Number(event.y);
    const radius = Math.max(0, Number(event.radius) || 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || radius <= 0) {
      continue;
    }

    activeExplosions.push({
      id: nextExplosionFxId++,
      x,
      y,
      radius,
      abilityId: String(event.abilityId || ""),
      createdAt: now,
      durationMs: 380
    });
    const abilityId = toAbilityAudioId(event.abilityId);
    if (abilityId) {
      abilitiesToPlay.add(abilityId);
    }
  }

  for (const abilityId of abilitiesToPlay) {
    playAbilityAudioEvent(abilityId, "hit", now);
  }
}

function upsertAreaEffectState(raw, now = performance.now()) {
  if (!raw) {
    return;
  }
  const id = String(raw.id || "").trim();
  const x = Number(raw.x);
  const y = Number(raw.y);
  const radius = Math.max(0, Number(raw.radius) || 0);
  const remainingMs = Math.max(1, Math.floor(Number(raw.remainingMs) || 0));
  const durationMs = Math.max(1, Math.floor(Number(raw.durationMs) || remainingMs));
  const abilityId = String(raw.abilityId || "").toLowerCase();
  const kind = String(raw.kind || (abilityId === "arcanebeam" ? "beam" : "area")).toLowerCase();
  if (!id || !Number.isFinite(x) || !Number.isFinite(y) || radius <= 0) {
    return;
  }
  const existing = activeAreaEffectsById.get(id);
  const parsedDx = Number(raw.dx);
  const parsedDy = Number(raw.dy);
  const parsedLength = Math.max(0, Number(raw.length) || 0);
  const parsedWidth = Math.max(0, Number(raw.width) || 0);
  const normalizedDir = normalizeDirection(parsedDx, parsedDy);
  activeAreaEffectsById.set(id, {
    id,
    x,
    y,
    radius,
    kind,
    abilityId,
    durationMs,
    startedAt: existing ? existing.startedAt : now - Math.max(0, durationMs - remainingMs),
    endsAt: now + remainingMs,
    seed: existing ? existing.seed : hashString(`area:${id}`),
    startX: Number.isFinite(Number(raw.startX))
      ? Number(raw.startX)
      : existing && Number.isFinite(existing.startX)
        ? existing.startX
        : x,
    startY: Number.isFinite(Number(raw.startY))
      ? Number(raw.startY)
      : existing && Number.isFinite(existing.startY)
        ? existing.startY
        : y,
    dx: normalizedDir ? normalizedDir.dx : existing && Number.isFinite(existing.dx) ? existing.dx : 0,
    dy: normalizedDir ? normalizedDir.dy : existing && Number.isFinite(existing.dy) ? existing.dy : 1,
    length: parsedLength > 0 ? parsedLength : existing && Number.isFinite(existing.length) ? existing.length : 0,
    width: parsedWidth > 0 ? parsedWidth : existing && Number.isFinite(existing.width) ? existing.width : 0
  });
}

function applyAreaEffects(events) {
  if (!Array.isArray(events)) {
    return;
  }
  const now = performance.now();
  for (const raw of events) {
    upsertAreaEffectState(raw, now);
  }
}

function addProjectileHitEvents(events) {
  if (!Array.isArray(events) || !events.length) {
    return;
  }
  const now = performance.now();
  const abilitiesToPlay = new Set();
  for (const event of events) {
    if (!event) {
      continue;
    }
    const abilityId = toAbilityAudioId(event.abilityId);
    if (abilityId) {
      abilitiesToPlay.add(abilityId);
    }
  }
  for (const abilityId of abilitiesToPlay) {
    playAbilityAudioEvent(abilityId, "hit", now);
  }
}

function addMobDeathEvents(events) {
  if (!Array.isArray(events) || !events.length) {
    return;
  }
  const now = performance.now();
  for (const event of events) {
    if (!event) {
      continue;
    }
    const mobType = String(event.mobType || "").trim();
    const x = Number(event.x);
    const y = Number(event.y);
    if (!mobType || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    playMobEventSound(mobType, "death", x, y, now, 0.8, 60);
  }
}

function updateMobCastSpatialAudio(mobs, frameNow) {
  const activeMobKeys = new Set();
  const mobsById = new Map();
  for (const mob of Array.isArray(mobs) ? mobs : []) {
    mobsById.set(Number(mob.id), mob);
  }

  for (const [mobId, castState] of remoteMobCasts.entries()) {
    const cast = getCastProgress(castState, frameNow);
    if (!cast) {
      stopMobCastSpatialLoop(mobId);
      continue;
    }
    const mob = mobsById.get(Number(mobId));
    if (!mob) {
      continue;
    }
    const abilityId = String(castState.abilityId || "");
    if (!abilityId) {
      continue;
    }
    const loopKey = getMobCastLoopKey(mobId);
    activeMobKeys.add(loopKey);
    ensureSpatialAbilityLoop(loopKey, abilityId, "channel", mob.x, mob.y, 0.55, frameNow);
    updateSpatialAbilityLoop(loopKey, mob.x, mob.y, 0.55, frameNow);
  }

  for (const key of Array.from(spatialAudioState.loopSources.keys())) {
    if (key.startsWith("mobcast:") && !activeMobKeys.has(key)) {
      stopSpatialLoop(key);
    }
  }
}

function updateProjectileSpatialAudio(projectiles, frameNow) {
  const candidates = [];
  for (const projectile of Array.isArray(projectiles) ? projectiles : []) {
    const abilityId = toAbilityAudioId(projectile.abilityId);
    if (!abilityId) {
      continue;
    }
    const mix = computeSpatialMix(projectile.x, projectile.y);
    if (!mix || mix.gain <= 0) {
      continue;
    }
    candidates.push({
      projectile,
      abilityId,
      mix
    });
  }

  candidates.sort((a, b) => b.mix.gain - a.mix.gain);
  const maxConcurrent = Math.max(1, Number(spatialAudioConfig.projectileMaxConcurrent) || 10);
  const selected = candidates.slice(0, maxConcurrent);
  const activeProjectileKeys = new Set();

  for (const candidate of selected) {
    const projectile = candidate.projectile;
    const loopKey = getProjectileFlightLoopKey(projectile.id);
    activeProjectileKeys.add(loopKey);
    ensureSpatialAbilityLoop(loopKey, candidate.abilityId, "flying", projectile.x, projectile.y, 0.58, frameNow);
    updateSpatialAbilityLoop(loopKey, projectile.x, projectile.y, 0.58, frameNow);
  }

  for (const key of Array.from(spatialAudioState.loopSources.keys())) {
    if (key.startsWith("projectile:") && !activeProjectileKeys.has(key)) {
      stopSpatialLoop(key);
    }
  }
}

function drawFloatingDamageNumbers(cameraX, cameraY) {
  if (!floatingDamageNumbers.length) {
    return;
  }

  const now = performance.now();
  const active = [];
  for (const entry of floatingDamageNumbers) {
    const age = now - entry.createdAt;
    if (age >= entry.durationMs) {
      continue;
    }
    active.push(entry);

    const progress = clamp(age / entry.durationMs, 0, 1);
    const rise = 0.9 * progress + entry.riseOffset;
    const wobble = Math.sin((entry.id % 7) + progress * Math.PI * 2) * 0.08;
    const p = worldToScreen(entry.x + 0.5 + entry.jitterX + wobble, entry.y + 0.35 - rise, cameraX, cameraY);
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 15px Segoe UI";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(14, 18, 27, 0.92)";
    const text = `-${entry.amount}`;
    ctx.strokeText(text, p.x, p.y);
    ctx.fillStyle = entry.targetType === "player" ? "#ff7a7a" : "#ffd36b";
    ctx.fillText(text, p.x, p.y);
    ctx.restore();
  }

  floatingDamageNumbers.length = 0;
  for (const entry of active) {
    floatingDamageNumbers.push(entry);
  }
}

function drawExplosionEffects(cameraX, cameraY) {
  if (!activeExplosions.length) {
    return;
  }

  const now = performance.now();
  const kept = [];
  for (const fx of activeExplosions) {
    const age = now - fx.createdAt;
    if (age >= fx.durationMs) {
      continue;
    }
    kept.push(fx);

    const progress = clamp(age / fx.durationMs, 0, 1);
    const screen = worldToScreen(fx.x + 0.5, fx.y + 0.5, cameraX, cameraY);
    const maxRadiusPx = Math.max(6, fx.radius * TILE_SIZE);
    const ringRadius = maxRadiusPx * (0.25 + progress * 0.85);
    const alpha = 1 - progress;

    if (String(fx.abilityId || "").toLowerCase() === "warstomp") {
      ctx.save();
      ctx.globalAlpha = 0.9 * alpha;
      ctx.strokeStyle = "rgba(222, 243, 255, 0.92)";
      ctx.lineWidth = Math.max(1.4, 3.6 * (1 - progress));
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.42 * alpha;
      ctx.strokeStyle = "rgba(112, 193, 248, 0.85)";
      ctx.lineWidth = Math.max(1, 2.4 * (1 - progress));
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, ringRadius * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 10; i += 1) {
        const a = (Math.PI * 2 * i) / 10 + progress * 0.8;
        const inner = ringRadius * 0.15;
        const outer = ringRadius * 0.95;
        ctx.globalAlpha = 0.5 * alpha;
        ctx.strokeStyle = "rgba(180, 225, 255, 0.72)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(screen.x + Math.cos(a) * inner, screen.y + Math.sin(a) * inner);
        ctx.lineTo(screen.x + Math.cos(a) * outer, screen.y + Math.sin(a) * outer);
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }

    if (String(fx.abilityId || "").toLowerCase() === "blink") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const blinkGradient = ctx.createRadialGradient(
        screen.x,
        screen.y,
        ringRadius * 0.12,
        screen.x,
        screen.y,
        ringRadius
      );
      blinkGradient.addColorStop(0, `rgba(240, 226, 255, ${(0.75 * alpha).toFixed(3)})`);
      blinkGradient.addColorStop(0.55, `rgba(170, 126, 255, ${(0.46 * alpha).toFixed(3)})`);
      blinkGradient.addColorStop(1, "rgba(118, 75, 245, 0)");
      ctx.fillStyle = blinkGradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, ringRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.78 * alpha;
      ctx.strokeStyle = "rgba(209, 188, 255, 0.94)";
      ctx.lineWidth = Math.max(1.1, 2.8 * (1 - progress));
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, ringRadius * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5 * alpha;
    const gradient = ctx.createRadialGradient(screen.x, screen.y, ringRadius * 0.2, screen.x, screen.y, ringRadius);
    gradient.addColorStop(0, "rgba(255, 230, 140, 0.95)");
    gradient.addColorStop(0.45, "rgba(255, 132, 56, 0.82)");
    gradient.addColorStop(1, "rgba(255, 52, 28, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, ringRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.85 * alpha;
    ctx.strokeStyle = "rgba(255, 240, 190, 0.9)";
    ctx.lineWidth = Math.max(1.2, 3.2 * (1 - progress));
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  activeExplosions.length = 0;
  for (const fx of kept) {
    activeExplosions.push(fx);
  }
}

function drawArcaneBeamAreaEffect(effect, cameraX, cameraY, now) {
  const dir = normalizeDirection(effect.dx, effect.dy) || { dx: 0, dy: -1 };
  const lengthTiles = Math.max(0.2, Number(effect.length) || Number(effect.radius) || 1);
  const widthTiles = Math.max(0.2, Number(effect.width) || 0.8);
  const startX = Number.isFinite(Number(effect.startX)) ? Number(effect.startX) : effect.x;
  const startY = Number.isFinite(Number(effect.startY)) ? Number(effect.startY) : effect.y;
  const endX = startX + dir.dx * lengthTiles;
  const endY = startY + dir.dy * lengthTiles;
  const start = worldToScreen(startX + 0.5, startY + 0.5, cameraX, cameraY);
  const end = worldToScreen(endX + 0.5, endY + 0.5, cameraX, cameraY);
  const beamLengthPx = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
  const beamWidthPx = Math.max(3, widthTiles * TILE_SIZE);
  const lifeT = clamp((now - effect.startedAt) / Math.max(1, effect.durationMs), 0, 1);
  const fadeOut = 1 - clamp((now - effect.endsAt + 300) / 300, 0, 1);
  const alpha = clamp((0.82 - lifeT * 0.2) * fadeOut, 0, 1);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Outer glow.
  ctx.strokeStyle = `rgba(165, 132, 255, ${(0.45 * alpha).toFixed(3)})`;
  ctx.lineCap = "round";
  ctx.lineWidth = beamWidthPx * 1.9;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Core beam.
  const beamGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  beamGradient.addColorStop(0, `rgba(206, 176, 255, ${(0.88 * alpha).toFixed(3)})`);
  beamGradient.addColorStop(0.5, `rgba(245, 236, 255, ${(0.98 * alpha).toFixed(3)})`);
  beamGradient.addColorStop(1, `rgba(196, 168, 255, ${(0.9 * alpha).toFixed(3)})`);
  ctx.strokeStyle = beamGradient;
  ctx.lineWidth = beamWidthPx * 0.9;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Inner hot line.
  ctx.strokeStyle = `rgba(255, 252, 255, ${(0.95 * alpha).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.5, beamWidthPx * 0.22);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Spiral arcane ribbons around the beam.
  const perpX = -dir.dy;
  const perpY = dir.dx;
  for (let strand = 0; strand < 2; strand += 1) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(233, 220, 255, ${(0.56 * alpha).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, beamWidthPx * 0.18);
    for (let i = 0; i <= 32; i += 1) {
      const t = i / 32;
      const phase = now * 0.008 + strand * Math.PI + t * Math.PI * 6;
      const wobble = Math.sin(phase) * beamWidthPx * 0.55;
      const px = start.x + (end.x - start.x) * t + perpX * wobble;
      const py = start.y + (end.y - start.y) * t + perpY * wobble;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }

  // Small spark particles along beam.
  for (let i = 0; i < 20; i += 1) {
    const t = (seededUnit(effect.seed, i * 23 + 11) + now * 0.00035) % 1;
    const baseX = start.x + (end.x - start.x) * t;
    const baseY = start.y + (end.y - start.y) * t;
    const wiggle = (seededUnit(effect.seed, i * 31 + 7) - 0.5) * beamWidthPx * 1.7;
    const px = baseX + perpX * wiggle;
    const py = baseY + perpY * wiggle;
    const radius = 0.8 + seededUnit(effect.seed, i * 19 + 3) * 1.8;
    ctx.beginPath();
    ctx.fillStyle = `rgba(244, 238, 255, ${(0.38 + seededUnit(effect.seed, i * 13 + 5) * 0.4 * alpha).toFixed(3)})`;
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // End-point bursts.
  const burstRadius = Math.max(6, beamWidthPx * 1.1);
  for (const p of [start, end]) {
    const burst = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, burstRadius);
    burst.addColorStop(0, `rgba(250, 243, 255, ${(0.9 * alpha).toFixed(3)})`);
    burst.addColorStop(0.5, `rgba(196, 159, 255, ${(0.45 * alpha).toFixed(3)})`);
    burst.addColorStop(1, "rgba(124, 90, 220, 0)");
    ctx.fillStyle = burst;
    ctx.beginPath();
    ctx.arc(p.x, p.y, burstRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBlizzardAreaEffect(effect, cameraX, cameraY, now) {
  const center = worldToScreen(effect.x + 0.5, effect.y + 0.5, cameraX, cameraY);
  const radiusPx = Math.max(8, effect.radius * TILE_SIZE);
  const lifeT = clamp((now - effect.startedAt) / Math.max(1, effect.durationMs), 0, 1);
  const fadeOut = 1 - clamp((now - effect.endsAt + 420) / 420, 0, 1);
  const alpha = (0.72 - lifeT * 0.18) * fadeOut;

  ctx.save();
  const zoneGlow = ctx.createRadialGradient(center.x, center.y, radiusPx * 0.15, center.x, center.y, radiusPx * 1.08);
  zoneGlow.addColorStop(0, `rgba(196, 230, 255, ${(0.34 * alpha).toFixed(3)})`);
  zoneGlow.addColorStop(0.6, `rgba(103, 165, 218, ${(0.21 * alpha).toFixed(3)})`);
  zoneGlow.addColorStop(1, "rgba(61, 104, 168, 0)");
  ctx.fillStyle = zoneGlow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx * 1.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.clip();

  ctx.lineCap = "round";
  for (let i = 0; i < 42; i += 1) {
    const driftSpeed = 0.00022 + seededUnit(effect.seed, i * 17 + 9) * 0.0002;
    const u = (seededUnit(effect.seed, i * 31 + 5) + now * driftSpeed * 1.7) % 1;
    const v = (seededUnit(effect.seed, i * 29 + 11) + now * driftSpeed * 2.3) % 1;
    const px = center.x + (u * 2 - 1) * radiusPx * 0.95;
    const py = center.y + (v * 2 - 1) * radiusPx * 0.95;
    if ((px - center.x) ** 2 + (py - center.y) ** 2 > radiusPx * radiusPx) {
      continue;
    }
    const len = 7 + seededUnit(effect.seed, i * 13 + 3) * 9;
    ctx.strokeStyle = `rgba(225, 245, 255, ${(0.28 + seededUnit(effect.seed, i * 19 + 4) * 0.34 * alpha).toFixed(3)})`;
    ctx.lineWidth = 0.8 + seededUnit(effect.seed, i * 7 + 2) * 1.2;
    ctx.beginPath();
    ctx.moveTo(px - len * 0.45, py - len * 0.75);
    ctx.lineTo(px + len * 0.12, py + len * 0.2);
    ctx.stroke();

    if (i % 8 === 0) {
      ctx.strokeStyle = `rgba(239, 250, 255, ${(0.35 * alpha).toFixed(3)})`;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(px - 2.1, py);
      ctx.lineTo(px + 2.1, py);
      ctx.moveTo(px, py - 2.1);
      ctx.lineTo(px, py + 2.1);
      ctx.stroke();
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const baseA = now * 0.0012 + i * 0.57 + effect.seed * 0.0001;
    const r = radiusPx * (0.35 + (i % 5) * 0.13);
    const x0 = center.x + Math.cos(baseA) * (r * 0.5);
    const y0 = center.y + Math.sin(baseA * 1.1) * (r * 0.35);
    ctx.strokeStyle = `rgba(205, 236, 255, ${(0.14 * alpha).toFixed(3)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x0 - 12, y0 - 6);
    ctx.quadraticCurveTo(x0, y0 + 4, x0 + 12, y0 + 10);
    ctx.stroke();
  }

  ctx.restore();

  ctx.beginPath();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = `rgba(167, 224, 255, ${(0.45 * alpha).toFixed(3)})`;
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAreaEffects(cameraX, cameraY, now) {
  for (const [id, effect] of activeAreaEffectsById.entries()) {
    if (!effect || now >= effect.endsAt + 420) {
      activeAreaEffectsById.delete(id);
      continue;
    }
    const actionDef = getActionDefById(effect.abilityId);
    const areaHook = getAbilityVisualHook(
      effect.abilityId,
      actionDef,
      "areaEffectRenderer",
      "",
      String(effect.kind || "")
    );
    const drawAreaEffect = ABILITY_AREA_EFFECT_RENDERERS[areaHook];
    if (drawAreaEffect) {
      drawAreaEffect(effect, cameraX, cameraY, now);
    }
  }
}

function drawBlizzardCastPreview(self, cameraX, cameraY, now) {
  if (!self || !abilityChannel.active) {
    return;
  }
  const targetX = Number(abilityChannel.targetX);
  const targetY = Number(abilityChannel.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return;
  }
  const activeAbilityId = String(abilityChannel.abilityId || "");
  const abilityDef = findAbilityDefById(activeAbilityId) || findAbilityDefById("blizzard");
  const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(activeAbilityId, self));
  const areaRadius = Math.max(0.2, Number(abilityDef?.areaRadius || abilityDef?.radius || 3));
  const center = worldToScreen(targetX + 0.5, targetY + 0.5, cameraX, cameraY);
  const radiusPx = Math.max(8, areaRadius * TILE_SIZE);
  const dist = Math.hypot(targetX - self.x, targetY - self.y);
  const inRange = castRange <= 0 || dist <= castRange + 0.001;
  const pulse = 0.65 + Math.sin(now * 0.01) * 0.12;

  const selfP = worldToScreen(self.x + 0.5, self.y + 0.5, cameraX, cameraY);
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = inRange ? "rgba(168, 222, 255, 0.5)" : "rgba(255, 145, 145, 0.52)";
  ctx.beginPath();
  ctx.moveTo(selfP.x, selfP.y);
  ctx.lineTo(center.x, center.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.fillStyle = inRange ? `rgba(122, 191, 238, ${(0.15 * pulse).toFixed(3)})` : `rgba(214, 104, 104, ${(0.15 * pulse).toFixed(3)})`;
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = inRange ? "rgba(195, 234, 255, 0.72)" : "rgba(255, 164, 164, 0.72)";
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const ABILITY_AREA_EFFECT_RENDERERS = Object.freeze({
  blizzard: drawBlizzardAreaEffect,
  arcane_beam: drawArcaneBeamAreaEffect
});

const ABILITY_CAST_PREVIEW_RENDERERS = Object.freeze({
  blizzard: drawBlizzardCastPreview
});

function drawAbilityCastPreview(self, cameraX, cameraY, now) {
  if (!self || !abilityChannel.active) {
    return;
  }
  const actionDef = getActionDefById(abilityChannel.abilityId);
  const castHook = getAbilityVisualHook(abilityChannel.abilityId, actionDef, "castPreviewRenderer", "");
  const drawCastPreview = ABILITY_CAST_PREVIEW_RENDERERS[castHook];
  if (drawCastPreview) {
    drawCastPreview(self, cameraX, cameraY, now);
  }
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function drawRoundedRect(targetCtx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  targetCtx.beginPath();
  targetCtx.moveTo(x + r, y);
  targetCtx.lineTo(x + width - r, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + r);
  targetCtx.lineTo(x + width, y + height - r);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  targetCtx.lineTo(x + r, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - r);
  targetCtx.lineTo(x, y + r);
  targetCtx.quadraticCurveTo(x, y, x + r, y);
  targetCtx.closePath();
}

function drawZombieSpriteFrame(targetCtx, palette, pose) {
  const sway = pose * 1.6;
  const bob = Math.abs(pose) * 0.7;
  const headX = sway * 0.22;
  const headY = -4 + bob * 0.22;
  const bodyY = bob * 0.28;

  // Outstretched arms and claws.
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 3;
  targetCtx.lineCap = "round";
  targetCtx.beginPath();
  targetCtx.moveTo(-5, 3 + bodyY);
  targetCtx.lineTo(-14, -1 + sway + bodyY);
  targetCtx.moveTo(5, 4 + bodyY);
  targetCtx.lineTo(14, 1 - sway + bodyY);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.skinDark;
  targetCtx.beginPath();
  targetCtx.arc(-15, sway + bodyY, 3.8, 0, Math.PI * 2);
  targetCtx.arc(15, 1 - sway + bodyY, 3.8, 0, Math.PI * 2);
  targetCtx.fill();

  // Torso + torn shirt.
  targetCtx.fillStyle = palette.cloth;
  targetCtx.beginPath();
  targetCtx.moveTo(-7, 3 + bodyY);
  targetCtx.lineTo(7, 3 + bodyY);
  targetCtx.lineTo(8, 13 + bodyY);
  targetCtx.lineTo(3, 15 + bodyY);
  targetCtx.lineTo(0, 13 + bodyY);
  targetCtx.lineTo(-3, 15 + bodyY);
  targetCtx.lineTo(-8, 13 + bodyY);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = palette.clothDark;
  targetCtx.beginPath();
  targetCtx.moveTo(-3, 7 + bodyY);
  targetCtx.lineTo(3, 7 + bodyY);
  targetCtx.lineTo(2, 12 + bodyY);
  targetCtx.lineTo(-2, 12 + bodyY);
  targetCtx.closePath();
  targetCtx.fill();

  // Legs step opposite directions.
  targetCtx.beginPath();
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.7;
  targetCtx.moveTo(-2, 14 + bodyY);
  targetCtx.lineTo(-5 - sway * 0.75, 18 + bodyY);
  targetCtx.moveTo(2, 14 + bodyY);
  targetCtx.lineTo(5 + sway * 0.75, 18 + bodyY);
  targetCtx.stroke();

  // Head.
  targetCtx.fillStyle = palette.skin;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.4;
  targetCtx.beginPath();
  targetCtx.arc(headX, headY, 10.5, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  // Exposed brain lumps.
  targetCtx.fillStyle = palette.brain;
  targetCtx.beginPath();
  targetCtx.arc(headX - 4.8, headY - 8.2, 3, 0, Math.PI * 2);
  targetCtx.arc(headX - 1.4, headY - 9.3, 2.8, 0, Math.PI * 2);
  targetCtx.arc(headX + 2.3, headY - 8.6, 2.9, 0, Math.PI * 2);
  targetCtx.arc(headX + 5.4, headY - 7.3, 2.5, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  // Eyes with crossed glints.
  targetCtx.fillStyle = palette.eye;
  targetCtx.beginPath();
  targetCtx.arc(headX - 3.7, headY - 1.2, 2.8, 0, Math.PI * 2);
  targetCtx.arc(headX + 3.8, headY - 0.4, 2.9, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.strokeStyle = "#d7dfc5";
  targetCtx.lineWidth = 1.2;
  targetCtx.beginPath();
  targetCtx.moveTo(headX - 5.1, headY - 2.6);
  targetCtx.lineTo(headX - 2.3, headY + 0.2);
  targetCtx.moveTo(headX - 5.1, headY + 0.2);
  targetCtx.lineTo(headX - 2.3, headY - 2.6);
  targetCtx.moveTo(headX + 2.5, headY - 1.9);
  targetCtx.lineTo(headX + 5.3, headY + 0.9);
  targetCtx.moveTo(headX + 2.5, headY + 0.9);
  targetCtx.lineTo(headX + 5.3, headY - 1.9);
  targetCtx.stroke();

  // Mouth with teeth.
  targetCtx.fillStyle = "#1f2318";
  targetCtx.beginPath();
  targetCtx.ellipse(headX, headY + 6.2, 4.2, 2.6, 0, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = "#e8edd7";
  targetCtx.beginPath();
  targetCtx.arc(headX - 1.8, headY + 5.6, 0.8, 0, Math.PI * 2);
  targetCtx.arc(headX + 0.4, headY + 5.4, 0.7, 0, Math.PI * 2);
  targetCtx.arc(headX + 2.2, headY + 6.2, 0.7, 0, Math.PI * 2);
  targetCtx.fill();

  // Small fly dots for undead vibe.
  targetCtx.fillStyle = "rgba(30, 38, 23, 0.75)";
  targetCtx.beginPath();
  targetCtx.arc(-12, -10, 0.8, 0, Math.PI * 2);
  targetCtx.arc(12, -8, 0.8, 0, Math.PI * 2);
  targetCtx.arc(-13, 8, 0.7, 0, Math.PI * 2);
  targetCtx.arc(11, 10, 0.7, 0, Math.PI * 2);
  targetCtx.fill();
}

function getZombieWalkFrames(typeName, style = null) {
  const styleKey = getMobStyleCacheKey(style);
  const key = `${String(typeName || "Zombie")}|${styleKey}`;
  const cached = zombieWalkFramesCache.get(key);
  if (cached) {
    return cached;
  }

  const seed = hashString(String(typeName || "Zombie"));
  const palettes = [
    {
      skin: "#7d9f5d",
      skinDark: "#5c7741",
      cloth: "#6f5a3e",
      clothDark: "#4e3f2c",
      brain: "#9fb37e",
      outline: "#1d2516",
      eye: "#11140f"
    },
    {
      skin: "#88a96a",
      skinDark: "#657f49",
      cloth: "#745f44",
      clothDark: "#52422f",
      brain: "#a8bd8a",
      outline: "#222b18",
      eye: "#131710"
    },
    {
      skin: "#6f9150",
      skinDark: "#4f6d38",
      cloth: "#655139",
      clothDark: "#463926",
      brain: "#97ad78",
      outline: "#1a2214",
      eye: "#10130d"
    }
  ];
  const palette = applyMobPaletteOverrides(palettes[(seed >>> 4) % palettes.length], style);
  const frames = [];

  for (let i = 0; i < 4; i += 1) {
    const phase = (i / 4) * Math.PI * 2;
    const pose = Math.sin(phase);
    const frame = document.createElement("canvas");
    frame.width = MOB_SPRITE_SIZE;
    frame.height = MOB_SPRITE_SIZE;
    const fctx = frame.getContext("2d");
    fctx.translate(MOB_SPRITE_SIZE / 2, MOB_SPRITE_SIZE / 2);
    drawZombieSpriteFrame(fctx, palette, pose);
    frames.push(frame);
  }

  zombieWalkFramesCache.set(key, frames);
  return frames;
}

function getZombieWalkSprite(mob) {
  const style = getMobRenderStyle(mob);
  const mobName = String(mob.name || "Zombie");
  const frames = getZombieWalkFrames(mobName, style);
  const now = performance.now();
  const existing = zombieWalkRuntime.get(mob.id);
  const state =
    existing ||
    {
      lastX: mob.x,
      lastY: mob.y,
      lastT: now,
      phase: ((Number(mob.id) || hashString(mobName)) % 628) / 100,
      lastSeenAt: now
    };

  const dt = Math.max(0.001, (now - state.lastT) / 1000);
  const moved = Math.hypot(mob.x - state.lastX, mob.y - state.lastY);
  const speed = moved / dt;
  const moving = speed > getMobStyleNumber(style, "moveThreshold", 0.025, 0, 2);
  const walkCycleSpeed = getMobStyleNumber(style, "walkCycleSpeed", 2.2, 0.1, 10);

  if (moving) {
    state.phase = (state.phase + dt * walkCycleSpeed) % (Math.PI * 2);
  }

  state.lastX = mob.x;
  state.lastY = mob.y;
  state.lastT = now;
  state.lastSeenAt = now;
  zombieWalkRuntime.set(mob.id, state);

  if (!moving) {
    return frames[0];
  }

  const cycle = state.phase / (Math.PI * 2);
  const index = clamp(Math.floor(cycle * frames.length), 0, frames.length - 1);
  return frames[index];
}

function pruneZombieWalkRuntime() {
  const now = performance.now();
  for (const [mobId, state] of zombieWalkRuntime.entries()) {
    if (now - state.lastSeenAt > 3000) {
      zombieWalkRuntime.delete(mobId);
    }
  }
}

function drawCreeperSpriteFrame(targetCtx, palette, pose) {
  const bob = Math.abs(pose) * 0.8;
  const step = pose * 1.5;

  // Legs.
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 3;
  targetCtx.lineCap = "round";
  targetCtx.beginPath();
  targetCtx.moveTo(-5, 8 + bob);
  targetCtx.lineTo(-6.5 - step * 0.45, 14 + bob);
  targetCtx.moveTo(-1.5, 8 + bob);
  targetCtx.lineTo(-0.7 + step * 0.35, 14 + bob);
  targetCtx.moveTo(1.5, 8 + bob);
  targetCtx.lineTo(0.7 - step * 0.35, 14 + bob);
  targetCtx.moveTo(5, 8 + bob);
  targetCtx.lineTo(6.5 + step * 0.45, 14 + bob);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.bodyShade;
  targetCtx.beginPath();
  targetCtx.ellipse(-6.4 - step * 0.45, 14.2 + bob, 1.6, 1.2, -0.2, 0, Math.PI * 2);
  targetCtx.ellipse(-0.6 + step * 0.35, 14.2 + bob, 1.6, 1.2, 0.1, 0, Math.PI * 2);
  targetCtx.ellipse(0.6 - step * 0.35, 14.2 + bob, 1.6, 1.2, -0.1, 0, Math.PI * 2);
  targetCtx.ellipse(6.4 + step * 0.45, 14.2 + bob, 1.6, 1.2, 0.2, 0, Math.PI * 2);
  targetCtx.fill();

  // Torso.
  targetCtx.fillStyle = palette.body;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.2;
  drawRoundedRect(targetCtx, -8.6, -2.2 + bob, 17.2, 11.5, 2.4);
  targetCtx.fill();
  targetCtx.stroke();

  // Head cube.
  targetCtx.fillStyle = palette.body;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.4;
  drawRoundedRect(targetCtx, -9.8, -14.6 + bob * 0.35, 19.6, 14.2, 2.2);
  targetCtx.fill();
  targetCtx.stroke();

  // Light texture.
  targetCtx.strokeStyle = palette.bodyShade;
  targetCtx.lineWidth = 1.1;
  targetCtx.beginPath();
  targetCtx.moveTo(-8.3, -11.2 + bob * 0.35);
  targetCtx.lineTo(-5.2, -10.0 + bob * 0.35);
  targetCtx.moveTo(2.0, -12.2 + bob * 0.35);
  targetCtx.lineTo(5.5, -11.0 + bob * 0.35);
  targetCtx.moveTo(-6.4, 2.1 + bob * 0.2);
  targetCtx.lineTo(-3.8, 3.3 + bob * 0.2);
  targetCtx.stroke();

  // Creeper face.
  targetCtx.fillStyle = palette.face;
  targetCtx.beginPath();
  drawRoundedRect(targetCtx, -6.5, -10.1 + bob * 0.35, 4.1, 3.6, 0.8);
  targetCtx.fill();
  targetCtx.beginPath();
  drawRoundedRect(targetCtx, 2.4, -10.1 + bob * 0.35, 4.1, 3.6, 0.8);
  targetCtx.fill();
  targetCtx.beginPath();
  drawRoundedRect(targetCtx, -2.6, -6.8 + bob * 0.35, 5.2, 5.6, 1.0);
  targetCtx.fill();
  targetCtx.beginPath();
  drawRoundedRect(targetCtx, -5.1, -4.8 + bob * 0.35, 2.6, 3.8, 0.9);
  targetCtx.fill();
  targetCtx.beginPath();
  drawRoundedRect(targetCtx, 2.5, -4.8 + bob * 0.35, 2.6, 3.8, 0.9);
  targetCtx.fill();

  // Explosive satchel (red).
  const satchelX = -10.8;
  const satchelY = -0.6 + bob * 0.2;
  targetCtx.fillStyle = palette.explosive;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2;
  drawRoundedRect(targetCtx, satchelX, satchelY, 8.2, 7.0, 1.8);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.strokeStyle = palette.strap;
  targetCtx.lineWidth = 1.5;
  targetCtx.beginPath();
  targetCtx.moveTo(satchelX + 4.1, satchelY + 0.5);
  targetCtx.lineTo(satchelX + 4.1, satchelY + 6.5);
  targetCtx.moveTo(satchelX + 0.6, satchelY + 3.5);
  targetCtx.lineTo(satchelX + 7.6, satchelY + 3.5);
  targetCtx.stroke();

  // Fuse base.
  targetCtx.strokeStyle = palette.fuse;
  targetCtx.lineWidth = 1.5;
  targetCtx.beginPath();
  targetCtx.moveTo(satchelX + 3.9, satchelY);
  targetCtx.lineTo(satchelX + 3.0, satchelY - 3.2);
  targetCtx.stroke();
}

function getCreeperWalkFrames(typeName, style = null) {
  const styleKey = getMobStyleCacheKey(style);
  const key = `${String(typeName || "Creeper")}|${styleKey}`;
  const cached = creeperWalkFramesCache.get(key);
  if (cached) {
    return cached;
  }

  const seed = hashString(String(typeName || "Creeper"));
  const palettes = [
    {
      body: "#f3f5f8",
      bodyShade: "#cfd6df",
      outline: "#1d2430",
      face: "#111824",
      explosive: "#ca3b3b",
      strap: "#7a1f1f",
      fuse: "#42352b"
    },
    {
      body: "#eceff4",
      bodyShade: "#c7cdd8",
      outline: "#212835",
      face: "#0f1521",
      explosive: "#d44545",
      strap: "#7f2323",
      fuse: "#46392d"
    },
    {
      body: "#f7f8fa",
      bodyShade: "#d4d9e1",
      outline: "#1b222e",
      face: "#101722",
      explosive: "#bf3434",
      strap: "#731d1d",
      fuse: "#3d3026"
    }
  ];
  const palette = applyMobPaletteOverrides(palettes[(seed >>> 5) % palettes.length], style);
  const frames = [];

  for (let i = 0; i < 6; i += 1) {
    const phase = (i / 6) * Math.PI * 2;
    const pose = Math.sin(phase);
    const frame = document.createElement("canvas");
    frame.width = MOB_SPRITE_SIZE;
    frame.height = MOB_SPRITE_SIZE;
    const fctx = frame.getContext("2d");
    fctx.translate(MOB_SPRITE_SIZE / 2, MOB_SPRITE_SIZE / 2);
    drawCreeperSpriteFrame(fctx, palette, pose);
    frames.push(frame);
  }

  creeperWalkFramesCache.set(key, frames);
  return frames;
}

function getCreeperWalkSprite(mob) {
  const style = getMobRenderStyle(mob);
  const mobName = String(mob.name || "Creeper");
  const frames = getCreeperWalkFrames(mobName, style);
  const now = performance.now();
  const existing = creeperWalkRuntime.get(mob.id);
  const state =
    existing ||
    {
      lastX: mob.x,
      lastY: mob.y,
      lastT: now,
      phase: ((Number(mob.id) || hashString(mobName)) % 628) / 100,
      lastSeenAt: now
    };

  const dt = Math.max(0.001, (now - state.lastT) / 1000);
  const moved = Math.hypot(mob.x - state.lastX, mob.y - state.lastY);
  const speed = moved / dt;
  const moving = speed > getMobStyleNumber(style, "moveThreshold", 0.025, 0, 2);
  const walkCycleSpeed = getMobStyleNumber(style, "walkCycleSpeed", 2.4, 0.1, 10);

  if (moving) {
    state.phase = (state.phase + dt * walkCycleSpeed) % (Math.PI * 2);
  }

  state.lastX = mob.x;
  state.lastY = mob.y;
  state.lastT = now;
  state.lastSeenAt = now;
  creeperWalkRuntime.set(mob.id, state);

  if (!moving) {
    return frames[0];
  }

  const cycle = state.phase / (Math.PI * 2);
  const index = clamp(Math.floor(cycle * frames.length), 0, frames.length - 1);
  return frames[index];
}

function pruneCreeperWalkRuntime() {
  const now = performance.now();
  for (const [mobId, state] of creeperWalkRuntime.entries()) {
    if (now - state.lastSeenAt > 3000) {
      creeperWalkRuntime.delete(mobId);
    }
  }
}

function drawSpiderSpriteFrame(targetCtx, palette, pose) {
  const legSwing = pose * 1.3;

  // Web hints behind the spider.
  targetCtx.strokeStyle = palette.web;
  targetCtx.lineWidth = 1;
  targetCtx.beginPath();
  targetCtx.moveTo(-7, -14);
  targetCtx.lineTo(0, -18);
  targetCtx.lineTo(7, -14);
  targetCtx.moveTo(-6, 13);
  targetCtx.lineTo(0, 17);
  targetCtx.lineTo(6, 13);
  targetCtx.stroke();

  // Legs (4 each side), two-segment for a chitin look.
  for (let i = 0; i < 4; i += 1) {
    const y = -8 + i * 5.2;
    const dir = i % 2 === 0 ? 1 : -1;
    const swing = legSwing * dir;

    const leftBaseX = -9;
    const leftKneeX = -14 - i * 2.5 - swing;
    const leftKneeY = y - 1.5 + swing * 0.55;
    const leftTipX = -19 - i * 2.6 - swing * 0.65;
    const leftTipY = y + 1.5 - swing * 0.5;

    const rightBaseX = 9;
    const rightKneeX = 14 + i * 2.5 + swing;
    const rightKneeY = y - 1.5 - swing * 0.55;
    const rightTipX = 19 + i * 2.6 + swing * 0.65;
    const rightTipY = y + 1.5 + swing * 0.5;

    targetCtx.strokeStyle = palette.outline;
    targetCtx.lineCap = "round";
    targetCtx.lineWidth = 3;
    targetCtx.beginPath();
    targetCtx.moveTo(leftBaseX, y);
    targetCtx.lineTo(leftKneeX, leftKneeY);
    targetCtx.lineTo(leftTipX, leftTipY);
    targetCtx.stroke();

    targetCtx.beginPath();
    targetCtx.moveTo(rightBaseX, y);
    targetCtx.lineTo(rightKneeX, rightKneeY);
    targetCtx.lineTo(rightTipX, rightTipY);
    targetCtx.stroke();

    targetCtx.fillStyle = palette.joint;
    targetCtx.beginPath();
    targetCtx.arc(leftKneeX, leftKneeY, 1.4, 0, Math.PI * 2);
    targetCtx.arc(rightKneeX, rightKneeY, 1.4, 0, Math.PI * 2);
    targetCtx.fill();
  }

  // Body shell.
  targetCtx.fillStyle = palette.shell;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.4;
  targetCtx.beginPath();
  targetCtx.arc(0, 0, 11.6, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  // Skull-like center.
  targetCtx.fillStyle = palette.skull;
  targetCtx.beginPath();
  targetCtx.arc(0, 0.4, 7.8, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = palette.eye;
  targetCtx.beginPath();
  targetCtx.arc(-3.1, -0.8, 2.6, 0, Math.PI * 2);
  targetCtx.arc(3.4, -0.9, 2.6, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = palette.eyeGlow;
  targetCtx.beginPath();
  targetCtx.arc(-2.4, -1.5, 0.8, 0, Math.PI * 2);
  targetCtx.arc(4.1, -1.5, 0.8, 0, Math.PI * 2);
  targetCtx.fill();

  // Nose and fangs.
  targetCtx.fillStyle = palette.eye;
  targetCtx.beginPath();
  targetCtx.moveTo(0, 1.3);
  targetCtx.lineTo(-1.1, 2.9);
  targetCtx.lineTo(1.1, 2.9);
  targetCtx.closePath();
  targetCtx.fill();

  targetCtx.fillStyle = palette.fang;
  targetCtx.beginPath();
  targetCtx.moveTo(-2.3, 5.6);
  targetCtx.lineTo(-1.2, 3.6);
  targetCtx.lineTo(-0.1, 5.6);
  targetCtx.moveTo(0.2, 5.6);
  targetCtx.lineTo(1.4, 3.6);
  targetCtx.lineTo(2.5, 5.6);
  targetCtx.fill();
}

function getSpiderWalkFrames(typeName, style = null) {
  const styleKey = getMobStyleCacheKey(style);
  const key = `${String(typeName || "Spider")}|${styleKey}`;
  const cached = spiderWalkFramesCache.get(key);
  if (cached) {
    return cached;
  }

  const seed = hashString(String(typeName || "Spider"));
  const palettes = [
    {
      shell: "#2d4f9e",
      skull: "#d5def6",
      outline: "#1a2442",
      eye: "#1a1020",
      eyeGlow: "#df6b7f",
      fang: "#e8edf8",
      joint: "#88a6e2",
      web: "rgba(143, 164, 222, 0.45)"
    },
    {
      shell: "#553a8f",
      skull: "#e3ddf2",
      outline: "#23193a",
      eye: "#1b1224",
      eyeGlow: "#df586e",
      fang: "#f1edf9",
      joint: "#9b86d4",
      web: "rgba(171, 152, 226, 0.42)"
    },
    {
      shell: "#3f4f7c",
      skull: "#d8deee",
      outline: "#1e2538",
      eye: "#171322",
      eyeGlow: "#cc4f6b",
      fang: "#ebeff8",
      joint: "#7f95c9",
      web: "rgba(154, 168, 209, 0.4)"
    }
  ];
  const palette = applyMobPaletteOverrides(palettes[(seed >>> 5) % palettes.length], style);
  const frames = [];

  for (let i = 0; i < 6; i += 1) {
    const phase = (i / 6) * Math.PI * 2;
    const pose = Math.sin(phase);
    const frame = document.createElement("canvas");
    frame.width = MOB_SPRITE_SIZE;
    frame.height = MOB_SPRITE_SIZE;
    const fctx = frame.getContext("2d");
    fctx.translate(MOB_SPRITE_SIZE / 2, MOB_SPRITE_SIZE / 2);
    drawSpiderSpriteFrame(fctx, palette, pose);
    frames.push(frame);
  }

  spiderWalkFramesCache.set(key, frames);
  return frames;
}

function getSpiderWalkSprite(mob) {
  const style = getMobRenderStyle(mob);
  const mobName = String(mob.name || "Spider");
  const frames = getSpiderWalkFrames(mobName, style);
  const now = performance.now();
  const existing = spiderWalkRuntime.get(mob.id);
  const state =
    existing ||
    {
      lastX: mob.x,
      lastY: mob.y,
      lastT: now,
      phase: ((Number(mob.id) || hashString(mobName)) % 628) / 100,
      lastSeenAt: now
    };

  const dt = Math.max(0.001, (now - state.lastT) / 1000);
  const moved = Math.hypot(mob.x - state.lastX, mob.y - state.lastY);
  const speed = moved / dt;
  const moving = speed > getMobStyleNumber(style, "moveThreshold", 0.025, 0, 2);
  const walkCycleSpeed = getMobStyleNumber(style, "walkCycleSpeed", 3.2, 0.1, 12);

  if (moving) {
    state.phase = (state.phase + dt * walkCycleSpeed) % (Math.PI * 2);
  }

  state.lastX = mob.x;
  state.lastY = mob.y;
  state.lastT = now;
  state.lastSeenAt = now;
  spiderWalkRuntime.set(mob.id, state);

  if (!moving) {
    return frames[0];
  }

  const cycle = state.phase / (Math.PI * 2);
  const index = clamp(Math.floor(cycle * frames.length), 0, frames.length - 1);
  return frames[index];
}

function pruneSpiderWalkRuntime() {
  const now = performance.now();
  for (const [mobId, state] of spiderWalkRuntime.entries()) {
    if (now - state.lastSeenAt > 3000) {
      spiderWalkRuntime.delete(mobId);
    }
  }
}

function drawOrcBerserkerSpriteFrame(targetCtx, palette, pose, options = {}) {
  const drawAxes = options.drawAxes !== false;
  const bob = Math.abs(pose) * 0.9;
  const step = pose * 1.9;
  const shoulderSway = pose * 0.5;
  const headY = -6 + bob * 0.3;
  const torsoY = 3 + bob * 0.35;
  const armY = torsoY - 4;

  // Legs.
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 3.4;
  targetCtx.lineCap = "round";
  targetCtx.beginPath();
  targetCtx.moveTo(-3.6, 9 + bob);
  targetCtx.lineTo(-5.8 - step * 0.5, 15.8 + bob);
  targetCtx.moveTo(3.6, 9 + bob);
  targetCtx.lineTo(5.8 + step * 0.5, 15.8 + bob);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.boot;
  targetCtx.beginPath();
  targetCtx.ellipse(-5.9 - step * 0.5, 16.1 + bob, 2.2, 1.6, -0.2, 0, Math.PI * 2);
  targetCtx.ellipse(5.9 + step * 0.5, 16.1 + bob, 2.2, 1.6, 0.2, 0, Math.PI * 2);
  targetCtx.fill();

  // Torso.
  targetCtx.fillStyle = palette.skin;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.3;
  targetCtx.beginPath();
  targetCtx.ellipse(0, torsoY, 8.9, 7.7, 0, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = palette.skinDark;
  targetCtx.beginPath();
  targetCtx.ellipse(0, torsoY + 3.2, 7.1, 2.7, 0, 0, Math.PI * 2);
  targetCtx.fill();

  // Ragged belt.
  targetCtx.strokeStyle = palette.leather;
  targetCtx.lineWidth = 2.4;
  targetCtx.beginPath();
  targetCtx.moveTo(-6.6, torsoY + 4.8);
  targetCtx.lineTo(6.6, torsoY + 4.8);
  targetCtx.stroke();

  // Arms.
  const leftShoulderX = -6.9;
  const rightShoulderX = 6.9;
  const leftHandX = -12.4 - shoulderSway * 0.85;
  const leftHandY = armY - 0.2 + shoulderSway * 0.7;
  const rightHandX = 12.4 + shoulderSway * 0.85;
  const rightHandY = armY + 0.2 - shoulderSway * 0.7;

  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 3.2;
  targetCtx.lineCap = "round";
  targetCtx.beginPath();
  targetCtx.moveTo(leftShoulderX, armY);
  targetCtx.lineTo(leftHandX, leftHandY);
  targetCtx.moveTo(rightShoulderX, armY);
  targetCtx.lineTo(rightHandX, rightHandY);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.skin;
  targetCtx.beginPath();
  targetCtx.arc(leftHandX, leftHandY, 2.2, 0, Math.PI * 2);
  targetCtx.arc(rightHandX, rightHandY, 2.2, 0, Math.PI * 2);
  targetCtx.fill();

  // Head.
  targetCtx.fillStyle = palette.skin;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.6;
  targetCtx.beginPath();
  targetCtx.arc(0, headY, 9.8, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  // Ears.
  targetCtx.fillStyle = palette.skinDark;
  targetCtx.beginPath();
  targetCtx.moveTo(-9.2, headY - 0.8);
  targetCtx.lineTo(-13.6, headY - 3.2);
  targetCtx.lineTo(-11.4, headY + 1.6);
  targetCtx.closePath();
  targetCtx.moveTo(9.2, headY - 0.8);
  targetCtx.lineTo(13.6, headY - 3.2);
  targetCtx.lineTo(11.4, headY + 1.6);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.stroke();

  // Skull spikes.
  targetCtx.fillStyle = palette.spike;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 1.6;
  for (let i = 0; i < 4; i += 1) {
    const x = -5.8 + i * 3.9;
    const y = headY - 8.8 - Math.abs(1.5 - i) * 0.35;
    targetCtx.beginPath();
    targetCtx.moveTo(x - 1.0, y + 1.1);
    targetCtx.lineTo(x, y - 2.4);
    targetCtx.lineTo(x + 1.0, y + 1.1);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();
  }

  // Eyes and mouth.
  targetCtx.fillStyle = palette.eye;
  targetCtx.beginPath();
  targetCtx.ellipse(-3.8, headY - 1.5, 2.7, 1.6, -0.2, 0, Math.PI * 2);
  targetCtx.ellipse(3.8, headY - 1.5, 2.7, 1.6, 0.2, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = palette.mouth;
  targetCtx.beginPath();
  targetCtx.ellipse(0, headY + 3.7, 4.4, 3.1, 0, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = palette.tusk;
  targetCtx.beginPath();
  targetCtx.moveTo(-2.7, headY + 3.4);
  targetCtx.lineTo(-1.6, headY + 6.9);
  targetCtx.lineTo(-0.8, headY + 3.7);
  targetCtx.closePath();
  targetCtx.moveTo(2.7, headY + 3.4);
  targetCtx.lineTo(1.6, headY + 6.9);
  targetCtx.lineTo(0.8, headY + 3.7);
  targetCtx.closePath();
  targetCtx.fill();

  if (!drawAxes) {
    return;
  }

  // Dual axes in idle/walk pose.
  const drawAxe = (hx, hy, baseAngle, bladeTint) => {
    const shaftLen = 12.7;
    const shaftTipX = hx + Math.cos(baseAngle) * shaftLen;
    const shaftTipY = hy + Math.sin(baseAngle) * shaftLen;

    targetCtx.strokeStyle = palette.handle;
    targetCtx.lineWidth = 2.6;
    targetCtx.beginPath();
    targetCtx.moveTo(hx, hy);
    targetCtx.lineTo(shaftTipX, shaftTipY);
    targetCtx.stroke();

    targetCtx.fillStyle = bladeTint;
    targetCtx.strokeStyle = palette.outline;
    targetCtx.lineWidth = 1.8;
    const bladeAngle = baseAngle - Math.PI / 2;
    const bx = shaftTipX + Math.cos(baseAngle) * 0.7;
    const by = shaftTipY + Math.sin(baseAngle) * 0.7;
    targetCtx.beginPath();
    targetCtx.moveTo(bx, by);
    targetCtx.lineTo(bx + Math.cos(bladeAngle - 0.2) * 5.8, by + Math.sin(bladeAngle - 0.2) * 5.8);
    targetCtx.lineTo(bx + Math.cos(bladeAngle - 1.0) * 8.1, by + Math.sin(bladeAngle - 1.0) * 8.1);
    targetCtx.lineTo(bx + Math.cos(bladeAngle + 1.0) * 8.1, by + Math.sin(bladeAngle + 1.0) * 8.1);
    targetCtx.lineTo(bx + Math.cos(bladeAngle + 0.2) * 5.8, by + Math.sin(bladeAngle + 0.2) * 5.8);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();
  };

  drawAxe(leftHandX, leftHandY, -Math.PI / 2 - 0.23 + shoulderSway * 0.04, palette.axeBladeA);
  drawAxe(rightHandX, rightHandY, -Math.PI / 2 + 0.23 - shoulderSway * 0.04, palette.axeBladeB);
}

function getOrcWalkFrames(typeName, style = null, includeAxes = true) {
  const styleKey = getMobStyleCacheKey(style);
  const key = `${String(typeName || "Orc Berserker")}|${styleKey}`;
  const cache = includeAxes ? orcWalkFramesCache : orcNoAxesWalkFramesCache;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const seed = hashString(String(typeName || "Orc Berserker"));
  const palettes = [
    {
      skin: "#8fbf63",
      skinDark: "#5f8242",
      outline: "#1b2416",
      eye: "#150e0f",
      mouth: "#2a1413",
      tusk: "#ece5cf",
      spike: "#d9c4a4",
      handle: "#6f4c33",
      axeBladeA: "#d98272",
      axeBladeB: "#e17f66",
      leather: "#7b4b3f",
      boot: "#352520"
    },
    {
      skin: "#83b75b",
      skinDark: "#597a3f",
      outline: "#1a2215",
      eye: "#170f0f",
      mouth: "#2d1514",
      tusk: "#efe7d3",
      spike: "#d8c2a2",
      handle: "#744e35",
      axeBladeA: "#db7869",
      axeBladeB: "#cf6f63",
      leather: "#804f42",
      boot: "#31231e"
    },
    {
      skin: "#94c16a",
      skinDark: "#668749",
      outline: "#1f2819",
      eye: "#151011",
      mouth: "#2b1513",
      tusk: "#e8dfc7",
      spike: "#d3bc9b",
      handle: "#6a4933",
      axeBladeA: "#d67063",
      axeBladeB: "#e18370",
      leather: "#875444",
      boot: "#37261f"
    }
  ];
  const palette = applyMobPaletteOverrides(palettes[(seed >>> 7) % palettes.length], style);
  const frames = [];

  for (let i = 0; i < 6; i += 1) {
    const phase = (i / 6) * Math.PI * 2;
    const pose = Math.sin(phase);
    const frame = document.createElement("canvas");
    frame.width = MOB_SPRITE_SIZE;
    frame.height = MOB_SPRITE_SIZE;
    const fctx = frame.getContext("2d");
    fctx.translate(MOB_SPRITE_SIZE / 2, MOB_SPRITE_SIZE / 2);
    drawOrcBerserkerSpriteFrame(fctx, palette, pose, { drawAxes: includeAxes });
    frames.push(frame);
  }

  cache.set(key, frames);
  return frames;
}

function getOrcWalkSprite(mob, includeAxes = true) {
  const style = getMobRenderStyle(mob);
  const mobName = String(mob.name || "Orc Berserker");
  const frames = getOrcWalkFrames(mobName, style, includeAxes);
  const now = performance.now();
  const existing = orcWalkRuntime.get(mob.id);
  const state =
    existing ||
    {
      lastX: mob.x,
      lastY: mob.y,
      lastT: now,
      phase: ((Number(mob.id) || hashString(mobName)) % 628) / 100,
      lastSeenAt: now
    };

  const dt = Math.max(0.001, (now - state.lastT) / 1000);
  const moved = Math.hypot(mob.x - state.lastX, mob.y - state.lastY);
  const speed = moved / dt;
  const moving = speed > getMobStyleNumber(style, "moveThreshold", 0.022, 0, 2);
  const walkCycleSpeed = getMobStyleNumber(style, "walkCycleSpeed", 2.5, 0.1, 10);
  const idleCycleSpeed = getMobStyleNumber(style, "idleCycleSpeed", 0.9, 0, 10);

  if (moving) {
    state.phase = (state.phase + dt * walkCycleSpeed) % (Math.PI * 2);
  } else {
    state.phase = (state.phase + dt * idleCycleSpeed) % (Math.PI * 2);
  }

  state.lastX = mob.x;
  state.lastY = mob.y;
  state.lastT = now;
  state.lastSeenAt = now;
  orcWalkRuntime.set(mob.id, state);

  const cycle = state.phase / (Math.PI * 2);
  if (!moving) {
    const idlePulse = (Math.sin(state.phase * 0.65) + 1) * 0.5;
    const index = clamp(Math.floor(idlePulse * (frames.length - 1)), 0, frames.length - 1);
    return frames[index];
  }

  const index = clamp(Math.floor(cycle * frames.length), 0, frames.length - 1);
  return frames[index];
}

function pruneOrcWalkRuntime() {
  const now = performance.now();
  for (const [mobId, state] of orcWalkRuntime.entries()) {
    if (now - state.lastSeenAt > 3000) {
      orcWalkRuntime.delete(mobId);
    }
  }
}

function drawSkeletonSpriteFrame(targetCtx, palette, pose, options = {}) {
  const drawSwordArm = options.drawSwordArm !== false;
  const drawSword = options.drawSword !== false;
  const bob = Math.abs(pose) * 0.8;
  const legSwing = pose * 2.2;
  const armSwing = pose * 1.5;

  // Legs.
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.7;
  targetCtx.lineCap = "round";
  targetCtx.beginPath();
  targetCtx.moveTo(-2, 10 + bob);
  targetCtx.lineTo(-4.8 - legSwing * 0.55, 16 + bob);
  targetCtx.moveTo(2, 10 + bob);
  targetCtx.lineTo(4.8 + legSwing * 0.55, 16 + bob);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.boneDark;
  targetCtx.beginPath();
  targetCtx.arc(-4.8 - legSwing * 0.55, 16 + bob, 1.9, 0, Math.PI * 2);
  targetCtx.arc(4.8 + legSwing * 0.55, 16 + bob, 1.9, 0, Math.PI * 2);
  targetCtx.fill();

  // Rib cage and spine.
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2;
  targetCtx.beginPath();
  targetCtx.moveTo(0, 1 + bob);
  targetCtx.lineTo(0, 10 + bob);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.bone;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.2;
  targetCtx.beginPath();
  targetCtx.ellipse(0, 5 + bob, 7.2, 6.4, 0, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.strokeStyle = palette.boneDark;
  targetCtx.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) {
    const y = 2.3 + i * 2.3 + bob;
    targetCtx.beginPath();
    targetCtx.moveTo(-4.5, y);
    targetCtx.lineTo(4.5, y);
    targetCtx.stroke();
  }

  if (drawSwordArm) {
    // Sword arm (left).
    const leftShoulderY = -1 + bob;
    const leftElbowX = -9 - armSwing;
    const leftElbowY = -2.4 + bob - armSwing * 0.3;
    const leftHandX = -12.3 - armSwing * 0.9;
    const leftHandY = -4.2 + bob - armSwing * 0.45;

    targetCtx.strokeStyle = palette.outline;
    targetCtx.lineWidth = 2.4;
    targetCtx.beginPath();
    targetCtx.moveTo(-5.2, leftShoulderY);
    targetCtx.lineTo(leftElbowX, leftElbowY);
    targetCtx.lineTo(leftHandX, leftHandY);
    targetCtx.stroke();

    targetCtx.fillStyle = palette.boneDark;
    targetCtx.beginPath();
    targetCtx.arc(leftElbowX, leftElbowY, 1.6, 0, Math.PI * 2);
    targetCtx.arc(leftHandX, leftHandY, 1.7, 0, Math.PI * 2);
    targetCtx.fill();

    if (drawSword) {
      targetCtx.strokeStyle = palette.metalDark;
      targetCtx.lineWidth = 3;
      targetCtx.beginPath();
      targetCtx.moveTo(leftHandX - 1.2, leftHandY - 1.2);
      targetCtx.lineTo(leftHandX - 2.2, leftHandY - 14.5);
      targetCtx.stroke();

      targetCtx.strokeStyle = palette.metal;
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.moveTo(leftHandX - 2.2, leftHandY - 14.5);
      targetCtx.lineTo(leftHandX + 0.1, leftHandY - 18.8);
      targetCtx.lineTo(leftHandX + 2.1, leftHandY - 14.5);
      targetCtx.stroke();

      targetCtx.strokeStyle = palette.metalDark;
      targetCtx.lineWidth = 2.2;
      targetCtx.beginPath();
      targetCtx.moveTo(leftHandX - 3.4, leftHandY - 1.9);
      targetCtx.lineTo(leftHandX + 1.0, leftHandY - 1.9);
      targetCtx.stroke();
    }
  }

  // Shield arm (right).
  const rightShoulderY = -1 + bob;
  const rightElbowX = 6.9 + armSwing * 0.65;
  const rightElbowY = -0.9 + bob + armSwing * 0.16;
  const rightHandX = 8.6 + armSwing * 0.8;
  const rightHandY = 0.9 + bob + armSwing * 0.2;

  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.4;
  targetCtx.beginPath();
  targetCtx.moveTo(5.1, rightShoulderY);
  targetCtx.lineTo(rightElbowX, rightElbowY);
  targetCtx.lineTo(rightHandX, rightHandY);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.boneDark;
  targetCtx.beginPath();
  targetCtx.arc(rightElbowX, rightElbowY, 1.6, 0, Math.PI * 2);
  targetCtx.arc(rightHandX, rightHandY, 1.7, 0, Math.PI * 2);
  targetCtx.fill();

  // Shield.
  const shieldRadius = 4.35;
  const shieldX = clamp(rightHandX + 2.6, 6.8, 10.8);
  const shieldY = rightHandY + 1.25;
  targetCtx.fillStyle = palette.shield;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 1.9;
  targetCtx.beginPath();
  targetCtx.arc(shieldX, shieldY, shieldRadius, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.strokeStyle = palette.metalDark;
  targetCtx.lineWidth = 1.1;
  targetCtx.beginPath();
  targetCtx.arc(shieldX, shieldY, shieldRadius - 0.95, 0, Math.PI * 2);
  targetCtx.stroke();

  targetCtx.strokeStyle = palette.shieldCrack;
  targetCtx.lineWidth = 1.2;
  targetCtx.beginPath();
  targetCtx.moveTo(shieldX - 1.6, shieldY - 1.3);
  targetCtx.lineTo(shieldX - 0.5, shieldY - 0.2);
  targetCtx.lineTo(shieldX - 1.1, shieldY + 1.1);
  targetCtx.lineTo(shieldX + 0.2, shieldY + 2.1);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.metalDark;
  targetCtx.beginPath();
  targetCtx.arc(shieldX, shieldY, 1.15, 0, Math.PI * 2);
  targetCtx.fill();

  // Skull.
  targetCtx.fillStyle = palette.bone;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.4;
  targetCtx.beginPath();
  targetCtx.arc(0, -5 + bob * 0.25, 9.2, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  // Helmet strap and spike.
  targetCtx.strokeStyle = palette.metalDark;
  targetCtx.lineWidth = 2.2;
  targetCtx.beginPath();
  targetCtx.arc(0, -6 + bob * 0.25, 8.6, Math.PI * 0.15, Math.PI * 0.95);
  targetCtx.stroke();
  targetCtx.beginPath();
  targetCtx.moveTo(0, -15.2 + bob * 0.25);
  targetCtx.lineTo(-1.4, -11.7 + bob * 0.25);
  targetCtx.lineTo(1.4, -11.7 + bob * 0.25);
  targetCtx.closePath();
  targetCtx.fillStyle = palette.metal;
  targetCtx.fill();
  targetCtx.stroke();

  // Eyes and nose.
  targetCtx.fillStyle = palette.eye;
  targetCtx.beginPath();
  targetCtx.arc(-3.4, -6 + bob * 0.25, 2.5, 0, Math.PI * 2);
  targetCtx.arc(3.6, -5.8 + bob * 0.25, 2.5, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.beginPath();
  targetCtx.moveTo(0, -2.2 + bob * 0.25);
  targetCtx.lineTo(-1.1, -0.2 + bob * 0.25);
  targetCtx.lineTo(1.1, -0.2 + bob * 0.25);
  targetCtx.closePath();
  targetCtx.fill();

  // Teeth.
  targetCtx.strokeStyle = palette.boneDark;
  targetCtx.lineWidth = 1.3;
  targetCtx.beginPath();
  targetCtx.moveTo(-3.8, -0.1 + bob * 0.25);
  targetCtx.lineTo(3.8, -0.1 + bob * 0.25);
  targetCtx.stroke();
  for (let i = 0; i < 4; i += 1) {
    const x = -3 + i * 2;
    targetCtx.beginPath();
    targetCtx.moveTo(x, -0.2 + bob * 0.25);
    targetCtx.lineTo(x, 1.4 + bob * 0.25);
    targetCtx.stroke();
  }
}

function getSkeletonWalkFrames(typeName, style = null, includeSword = true) {
  const styleKey = getMobStyleCacheKey(style);
  const key = `${String(typeName || "Skeleton")}|${styleKey}`;
  const cache = includeSword ? skeletonWalkFramesCache : skeletonNoSwordWalkFramesCache;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const seed = hashString(String(typeName || "Skeleton"));
  const palettes = [
    {
      bone: "#f0f2f5",
      boneDark: "#c9ced7",
      outline: "#1d2129",
      eye: "#101116",
      metal: "#d8dce4",
      metalDark: "#8f97a7",
      shield: "#e7ebf2",
      shieldCrack: "#a4adbc"
    },
    {
      bone: "#eceef1",
      boneDark: "#c3c8d0",
      outline: "#1a1f26",
      eye: "#111219",
      metal: "#d4dae2",
      metalDark: "#8791a2",
      shield: "#dde3ec",
      shieldCrack: "#9ea8b8"
    },
    {
      bone: "#f6f7f9",
      boneDark: "#cfd3db",
      outline: "#232730",
      eye: "#12131a",
      metal: "#dee2e9",
      metalDark: "#939bac",
      shield: "#ebeff5",
      shieldCrack: "#aab2bf"
    }
  ];
  const palette = applyMobPaletteOverrides(palettes[(seed >>> 6) % palettes.length], style);
  const frames = [];

  for (let i = 0; i < 6; i += 1) {
    const phase = (i / 6) * Math.PI * 2;
    const pose = Math.sin(phase);
    const frame = document.createElement("canvas");
    frame.width = MOB_SPRITE_SIZE;
    frame.height = MOB_SPRITE_SIZE;
    const fctx = frame.getContext("2d");
    fctx.translate(MOB_SPRITE_SIZE / 2, MOB_SPRITE_SIZE / 2);
    drawSkeletonSpriteFrame(fctx, palette, pose, {
      drawSwordArm: includeSword,
      drawSword: includeSword
    });
    frames.push(frame);
  }

  cache.set(key, frames);
  return frames;
}

function getSkeletonWalkSprite(mob, includeSword = true) {
  const style = getMobRenderStyle(mob);
  const mobName = String(mob.name || "Skeleton");
  const frames = getSkeletonWalkFrames(mobName, style, includeSword);
  const now = performance.now();
  const existing = skeletonWalkRuntime.get(mob.id);
  const state =
    existing ||
    {
      lastX: mob.x,
      lastY: mob.y,
      lastT: now,
      phase: ((Number(mob.id) || hashString(mobName)) % 628) / 100,
      lastSeenAt: now
    };

  const dt = Math.max(0.001, (now - state.lastT) / 1000);
  const moved = Math.hypot(mob.x - state.lastX, mob.y - state.lastY);
  const speed = moved / dt;
  const moving = speed > getMobStyleNumber(style, "moveThreshold", 0.025, 0, 2);
  const walkCycleSpeed = getMobStyleNumber(style, "walkCycleSpeed", 2.8, 0.1, 10);

  if (moving) {
    state.phase = (state.phase + dt * walkCycleSpeed) % (Math.PI * 2);
  }

  state.lastX = mob.x;
  state.lastY = mob.y;
  state.lastT = now;
  state.lastSeenAt = now;
  skeletonWalkRuntime.set(mob.id, state);

  if (!moving) {
    return frames[0];
  }

  const cycle = state.phase / (Math.PI * 2);
  const index = clamp(Math.floor(cycle * frames.length), 0, frames.length - 1);
  return frames[index];
}

function pruneSkeletonWalkRuntime() {
  const now = performance.now();
  for (const [mobId, state] of skeletonWalkRuntime.entries()) {
    if (now - state.lastSeenAt > 3000) {
      skeletonWalkRuntime.delete(mobId);
    }
  }
}

function drawSkeletonArcherSpriteFrame(targetCtx, palette, pose, options = {}) {
  const drawBow = options.drawBow !== false;
  const bob = Math.abs(pose) * 0.8;
  const legSwing = pose * 2.1;
  const armSwing = pose * 1.35;
  const hoodShift = Math.sin(pose * 0.9) * 0.4;

  // Legs.
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.6;
  targetCtx.lineCap = "round";
  targetCtx.beginPath();
  targetCtx.moveTo(-2.1, 9.7 + bob);
  targetCtx.lineTo(-5.3 - legSwing * 0.5, 16 + bob);
  targetCtx.moveTo(2.1, 9.7 + bob);
  targetCtx.lineTo(5.3 + legSwing * 0.5, 16 + bob);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.boneDark;
  targetCtx.beginPath();
  targetCtx.arc(-5.3 - legSwing * 0.5, 16 + bob, 1.8, 0, Math.PI * 2);
  targetCtx.arc(5.3 + legSwing * 0.5, 16 + bob, 1.8, 0, Math.PI * 2);
  targetCtx.fill();

  // Cloak and torso.
  targetCtx.fillStyle = palette.cloak;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.1;
  targetCtx.beginPath();
  targetCtx.ellipse(0, 5 + bob, 8.6, 7.3, 0, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = palette.hoodDark;
  targetCtx.beginPath();
  targetCtx.ellipse(0, 9 + bob, 5.8, 2.4, 0, 0, Math.PI * 2);
  targetCtx.fill();

  // Hood.
  targetCtx.fillStyle = palette.hood;
  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.2;
  targetCtx.beginPath();
  targetCtx.moveTo(-8.8, -3.5 + hoodShift);
  targetCtx.quadraticCurveTo(0, -15.6 + hoodShift, 8.8, -3.5 + hoodShift);
  targetCtx.lineTo(6.1, 4.1 + hoodShift);
  targetCtx.quadraticCurveTo(0, 8.4 + hoodShift, -6.1, 4.1 + hoodShift);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.stroke();

  // Skull face.
  targetCtx.fillStyle = palette.bone;
  targetCtx.beginPath();
  targetCtx.arc(0, -3.9 + hoodShift, 6.5, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = palette.eye;
  targetCtx.beginPath();
  targetCtx.ellipse(-2.4, -4.8 + hoodShift, 1.8, 1.2, -0.2, 0, Math.PI * 2);
  targetCtx.ellipse(2.4, -4.8 + hoodShift, 1.8, 1.2, 0.2, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.beginPath();
  targetCtx.moveTo(0, -2.5 + hoodShift);
  targetCtx.lineTo(-0.9, -0.9 + hoodShift);
  targetCtx.lineTo(0.9, -0.9 + hoodShift);
  targetCtx.closePath();
  targetCtx.fill();

  targetCtx.strokeStyle = palette.boneDark;
  targetCtx.lineWidth = 1.1;
  targetCtx.beginPath();
  targetCtx.moveTo(-2.8, 0.2 + hoodShift);
  targetCtx.lineTo(2.8, 0.2 + hoodShift);
  targetCtx.stroke();

  // Arms.
  const leftShoulderX = -5.4;
  const rightShoulderX = 5.4;
  const armY = 0.2 + bob * 0.4;
  const leftHandX = -11.5 - armSwing * 0.65;
  const leftHandY = 0 + bob - armSwing * 0.3;
  const rightHandX = 11.7 + armSwing * 0.72;
  const rightHandY = 1.2 + bob + armSwing * 0.24;

  targetCtx.strokeStyle = palette.outline;
  targetCtx.lineWidth = 2.3;
  targetCtx.beginPath();
  targetCtx.moveTo(leftShoulderX, armY);
  targetCtx.lineTo(leftHandX, leftHandY);
  targetCtx.moveTo(rightShoulderX, armY + 0.1);
  targetCtx.lineTo(rightHandX, rightHandY);
  targetCtx.stroke();

  targetCtx.fillStyle = palette.boneDark;
  targetCtx.beginPath();
  targetCtx.arc(leftHandX, leftHandY, 1.5, 0, Math.PI * 2);
  targetCtx.arc(rightHandX, rightHandY, 1.5, 0, Math.PI * 2);
  targetCtx.fill();

  if (drawBow) {
    // Bow.
    const bowCx = leftHandX - 0.3;
    const bowCy = leftHandY - 0.6;
    targetCtx.strokeStyle = palette.bowDark;
    targetCtx.lineWidth = 2.1;
    targetCtx.beginPath();
    targetCtx.moveTo(bowCx - 0.6, bowCy - 10.2);
    targetCtx.quadraticCurveTo(bowCx - 6.4, bowCy, bowCx - 0.6, bowCy + 10.2);
    targetCtx.stroke();

    targetCtx.strokeStyle = palette.bow;
    targetCtx.lineWidth = 1.4;
    targetCtx.beginPath();
    targetCtx.moveTo(bowCx - 0.4, bowCy - 9.5);
    targetCtx.quadraticCurveTo(bowCx - 4.7, bowCy, bowCx - 0.4, bowCy + 9.5);
    targetCtx.stroke();

    targetCtx.strokeStyle = "rgba(228, 232, 238, 0.88)";
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();
    targetCtx.moveTo(bowCx - 0.6, bowCy - 9.4);
    targetCtx.lineTo(bowCx - 0.6, bowCy + 9.4);
    targetCtx.stroke();

    // Arrow nocked.
    targetCtx.strokeStyle = palette.arrowShaft;
    targetCtx.lineWidth = 1.2;
    targetCtx.beginPath();
    targetCtx.moveTo(rightHandX - 1.8, rightHandY - 0.1);
    targetCtx.lineTo(leftHandX - 2.9, leftHandY + 0.2);
    targetCtx.stroke();

    targetCtx.fillStyle = palette.arrowHead;
    targetCtx.beginPath();
    targetCtx.moveTo(leftHandX - 3.9, leftHandY + 0.2);
    targetCtx.lineTo(leftHandX - 2.5, leftHandY - 0.9);
    targetCtx.lineTo(leftHandX - 2.6, leftHandY + 1.3);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.fillStyle = palette.fletch;
    targetCtx.beginPath();
    targetCtx.moveTo(rightHandX - 0.8, rightHandY - 0.4);
    targetCtx.lineTo(rightHandX + 0.8, rightHandY - 1.2);
    targetCtx.lineTo(rightHandX + 0.3, rightHandY + 0.3);
    targetCtx.closePath();
    targetCtx.moveTo(rightHandX - 0.8, rightHandY + 0.4);
    targetCtx.lineTo(rightHandX + 0.8, rightHandY + 1.2);
    targetCtx.lineTo(rightHandX + 0.3, rightHandY - 0.3);
    targetCtx.closePath();
    targetCtx.fill();
  }
}

function getSkeletonArcherWalkFrames(typeName, style = null, includeBow = true) {
  const styleKey = getMobStyleCacheKey(style);
  const key = `${String(typeName || "Skeleton Archer")}|${styleKey}`;
  const cache = includeBow ? skeletonArcherWalkFramesCache : skeletonArcherNoBowWalkFramesCache;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const seed = hashString(String(typeName || "Skeleton Archer"));
  const palettes = [
    {
      bone: "#eceff3",
      boneDark: "#c5ccd7",
      outline: "#1a1f28",
      eye: "#0f1015",
      hood: "#3a3f46",
      hoodDark: "#242a31",
      cloak: "#2a2e35",
      bow: "#916f49",
      bowDark: "#624a31",
      arrowShaft: "#d8dde6",
      arrowHead: "#c4ccd8",
      fletch: "#6f7786"
    },
    {
      bone: "#edf0f4",
      boneDark: "#c4cbd6",
      outline: "#1b2029",
      eye: "#11131b",
      hood: "#414751",
      hoodDark: "#2a3039",
      cloak: "#2f3540",
      bow: "#8b6a46",
      bowDark: "#5a432c",
      arrowShaft: "#d7dce3",
      arrowHead: "#bdc6d3",
      fletch: "#707886"
    },
    {
      bone: "#f2f4f7",
      boneDark: "#ccd2dd",
      outline: "#1e242d",
      eye: "#12141c",
      hood: "#363b44",
      hoodDark: "#222831",
      cloak: "#262b33",
      bow: "#866744",
      bowDark: "#5a422c",
      arrowShaft: "#d4d9e1",
      arrowHead: "#bac3d0",
      fletch: "#6b7382"
    }
  ];
  const palette = applyMobPaletteOverrides(palettes[(seed >>> 6) % palettes.length], style);
  const frames = [];

  for (let i = 0; i < 6; i += 1) {
    const phase = (i / 6) * Math.PI * 2;
    const pose = Math.sin(phase);
    const frame = document.createElement("canvas");
    frame.width = MOB_SPRITE_SIZE;
    frame.height = MOB_SPRITE_SIZE;
    const fctx = frame.getContext("2d");
    fctx.translate(MOB_SPRITE_SIZE / 2, MOB_SPRITE_SIZE / 2);
    drawSkeletonArcherSpriteFrame(fctx, palette, pose, { drawBow: includeBow });
    frames.push(frame);
  }

  cache.set(key, frames);
  return frames;
}

function getSkeletonArcherWalkSprite(mob, includeBow = true) {
  const style = getMobRenderStyle(mob);
  const mobName = String(mob.name || "Skeleton Archer");
  const frames = getSkeletonArcherWalkFrames(mobName, style, includeBow);
  const now = performance.now();
  const existing = skeletonArcherWalkRuntime.get(mob.id);
  const state =
    existing ||
    {
      lastX: mob.x,
      lastY: mob.y,
      lastT: now,
      phase: ((Number(mob.id) || hashString(mobName)) % 628) / 100,
      lastSeenAt: now
    };

  const dt = Math.max(0.001, (now - state.lastT) / 1000);
  const moved = Math.hypot(mob.x - state.lastX, mob.y - state.lastY);
  const speed = moved / dt;
  const moving = speed > getMobStyleNumber(style, "moveThreshold", 0.022, 0, 2);
  const walkCycleSpeed = getMobStyleNumber(style, "walkCycleSpeed", 2.7, 0.1, 10);

  if (moving) {
    state.phase = (state.phase + dt * walkCycleSpeed) % (Math.PI * 2);
  }

  state.lastX = mob.x;
  state.lastY = mob.y;
  state.lastT = now;
  state.lastSeenAt = now;
  skeletonArcherWalkRuntime.set(mob.id, state);

  if (!moving) {
    return frames[0];
  }

  const cycle = state.phase / (Math.PI * 2);
  const index = clamp(Math.floor(cycle * frames.length), 0, frames.length - 1);
  return frames[index];
}

function pruneSkeletonArcherWalkRuntime() {
  const now = performance.now();
  for (const [mobId, state] of skeletonArcherWalkRuntime.entries()) {
    if (now - state.lastSeenAt > 3000) {
      skeletonArcherWalkRuntime.delete(mobId);
    }
  }
}

function createMobSprite(typeName, style = null) {
  const styleKey = getMobStyleCacheKey(style);
  const key = `${String(typeName || "Mob")}|${styleKey}`;
  const cached = mobSpriteCache.get(key);
  if (cached) {
    return cached;
  }

  const sprite = document.createElement("canvas");
  sprite.width = MOB_SPRITE_SIZE;
  sprite.height = MOB_SPRITE_SIZE;
  const sctx = sprite.getContext("2d");
  const keyLower = String(typeName || "Mob").toLowerCase();
  const seed = hashString(String(typeName || "Mob"));
  const variant = seed % 4;
  const palettes = [
    { body: "#6ab04a", accent: "#b8e994", outline: "#1a2f16", eye: "#171717" },
    { body: "#c86b3c", accent: "#f7b267", outline: "#3d1d11", eye: "#120b08" },
    { body: "#5577cc", accent: "#a9c3ff", outline: "#1a2442", eye: "#0b1022" },
    { body: "#9b59b6", accent: "#d7b4ec", outline: "#2c1738", eye: "#14091b" }
  ];
  const palette = applyMobPaletteOverrides(palettes[(seed >>> 3) % palettes.length], style);
  const cx = MOB_SPRITE_SIZE / 2;
  const cy = MOB_SPRITE_SIZE / 2;

  sctx.translate(cx, cy);

  if (keyLower.includes("skeleton")) {
    if (keyLower.includes("archer")) {
      const frames = getSkeletonArcherWalkFrames(typeName, style);
      const idle = frames[0];
      mobSpriteCache.set(key, idle);
      return idle;
    }
    const frames = getSkeletonWalkFrames(typeName, style);
    const idle = frames[0];
    mobSpriteCache.set(key, idle);
    return idle;
  }

  if (keyLower.includes("creeper")) {
    const frames = getCreeperWalkFrames(typeName, style);
    const idle = frames[0];
    mobSpriteCache.set(key, idle);
    return idle;
  }

  if (keyLower.includes("spider")) {
    const frames = getSpiderWalkFrames(typeName, style);
    const idle = frames[0];
    mobSpriteCache.set(key, idle);
    return idle;
  }

  if (keyLower.includes("orc") || keyLower.includes("berserker")) {
    const frames = getOrcWalkFrames(typeName, style);
    const idle = frames[0];
    mobSpriteCache.set(key, idle);
    return idle;
  }

  if (keyLower.includes("zombie")) {
    const frames = getZombieWalkFrames(typeName, style);
    const idle = frames[0];
    mobSpriteCache.set(key, idle);
    return idle;
  }

  sctx.strokeStyle = palette.outline;
  sctx.fillStyle = palette.body;
  sctx.lineWidth = 2;

  if (variant === 0) {
    sctx.beginPath();
    sctx.arc(0, 1, 10, 0, Math.PI * 2);
    sctx.fill();
    sctx.stroke();

    sctx.fillStyle = palette.accent;
    sctx.beginPath();
    sctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
    sctx.arc(3, 2, 2.3, 0, Math.PI * 2);
    sctx.fill();
  } else if (variant === 1) {
    drawRoundedRect(sctx, -10, -10, 20, 20, 6);
    sctx.fill();
    sctx.stroke();

    sctx.strokeStyle = palette.accent;
    sctx.lineWidth = 1.5;
    sctx.beginPath();
    sctx.moveTo(-6, -4);
    sctx.lineTo(6, -1);
    sctx.moveTo(-7, 3);
    sctx.lineTo(5, 6);
    sctx.stroke();
    sctx.strokeStyle = palette.outline;
    sctx.lineWidth = 2;
  } else if (variant === 2) {
    sctx.beginPath();
    sctx.moveTo(0, -12);
    sctx.lineTo(10, -4);
    sctx.lineTo(9, 8);
    sctx.lineTo(0, 12);
    sctx.lineTo(-9, 8);
    sctx.lineTo(-10, -4);
    sctx.closePath();
    sctx.fill();
    sctx.stroke();

    sctx.fillStyle = palette.accent;
    sctx.beginPath();
    sctx.arc(0, 5, 3, 0, Math.PI * 2);
    sctx.fill();
  } else {
    sctx.beginPath();
    sctx.ellipse(0, 1, 11, 9, 0, 0, Math.PI * 2);
    sctx.fill();
    sctx.stroke();

    sctx.fillStyle = palette.accent;
    sctx.beginPath();
    sctx.moveTo(-7, -2);
    sctx.lineTo(-2, -6);
    sctx.lineTo(2, -6);
    sctx.lineTo(7, -2);
    sctx.lineTo(2, 0);
    sctx.lineTo(-2, 0);
    sctx.closePath();
    sctx.fill();
  }

  sctx.fillStyle = "#ffffff";
  sctx.beginPath();
  sctx.arc(-3.2, -1.8, 2.4, 0, Math.PI * 2);
  sctx.arc(3.2, -1.8, 2.4, 0, Math.PI * 2);
  sctx.fill();
  sctx.fillStyle = palette.eye;
  sctx.beginPath();
  sctx.arc(-3.2, -1.8, 0.9, 0, Math.PI * 2);
  sctx.arc(3.2, -1.8, 0.9, 0, Math.PI * 2);
  sctx.fill();

  mobSpriteCache.set(key, sprite);
  return sprite;
}

function drawMobHpBar(mob, p) {
  if (!Number.isFinite(mob.maxHp) || mob.maxHp <= 0 || mob.hp >= mob.maxHp) {
    return;
  }

  const ratio = clamp(mob.hp / mob.maxHp, 0, 1);
  const barWidth = 26;
  const barHeight = 5;
  const x = Math.round(p.x - barWidth / 2);
  const y = Math.round(p.y - MOB_RENDER_RADIUS - 12);

  ctx.fillStyle = "rgba(12, 18, 28, 0.85)";
  ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);
  ctx.fillStyle = "rgba(77, 17, 17, 0.95)";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = ratio > 0.45 ? "#79e06f" : ratio > 0.2 ? "#f3d860" : "#f26a6a";
  ctx.fillRect(x, y, Math.round(barWidth * ratio), barHeight);
}

function getHoveredMob(mobs, cameraX, cameraY) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const mob of mobs) {
    const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
    const dist = Math.hypot(mouseState.sx - p.x, mouseState.sy - p.y);
    if (dist <= MOB_RENDER_RADIUS + 4 && dist < nearestDist) {
      nearest = { mob, p };
      nearestDist = dist;
    }
  }

  return nearest;
}

function getHoveredLootBag(lootBags, cameraX, cameraY) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const bag of lootBags) {
    const p = worldToScreen(bag.x + 0.5, bag.y + 0.5, cameraX, cameraY);
    const dist = Math.hypot(mouseState.sx - p.x, mouseState.sy - p.y);
    if (dist <= MOB_RENDER_RADIUS + 2 && dist < nearestDist) {
      nearest = { bag, p };
      nearestDist = dist;
    }
  }

  return nearest;
}

function drawMobTooltip(mob, p) {
  const label = String(mob.name || "Mob");
  ctx.font = "12px Segoe UI";
  ctx.textAlign = "center";
  const paddingX = 8;
  const height = 22;
  const width = Math.ceil(ctx.measureText(label).width) + paddingX * 2;
  const centerX = clamp(Math.round(p.x), width / 2 + 4, canvas.width - width / 2 - 4);
  const x = Math.round(centerX - width / 2);
  const y = Math.max(4, Math.round(p.y - MOB_RENDER_RADIUS - 38));

  ctx.fillStyle = "rgba(8, 12, 18, 0.88)";
  drawRoundedRect(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(184, 212, 236, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#eaf6ff";
  ctx.fillText(label, centerX, y + 15);
}

function drawLootBagTooltip(bag, p) {
  const lines = ["Loot Bag"];
  const items = Array.isArray(bag.items) ? bag.items : [];
  if (!items.length) {
    lines.push("(empty)");
  } else {
    for (const entry of items) {
      if (!entry) {
        continue;
      }
      const itemId = String(entry.itemId || "");
      const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
      if (!itemId || qty <= 0) {
        continue;
      }
      const itemDef = itemDefsById.get(itemId);
      lines.push(`${(itemDef && itemDef.name) || String(entry.name || itemId)} x${qty}`);
    }
  }

  ctx.font = "12px Segoe UI";
  ctx.textAlign = "left";
  const paddingX = 8;
  const lineHeight = 15;
  let width = 90;
  for (const line of lines) {
    width = Math.max(width, Math.ceil(ctx.measureText(line).width) + paddingX * 2);
  }

  const height = 8 + lines.length * lineHeight;
  const x = clamp(Math.round(p.x + 12), 4, Math.max(4, canvas.width - width - 4));
  const y = clamp(Math.round(p.y - height - 8), 4, Math.max(4, canvas.height - height - 4));

  ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
  drawRoundedRect(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(184, 212, 236, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillStyle = i === 0 ? "#f6e8be" : "#eaf6ff";
    ctx.fillText(lines[i], x + paddingX, y + 14 + i * lineHeight);
  }
}

function drawGrid(cameraX, cameraY) {
  const tilesX = Math.ceil(canvas.width / TILE_SIZE) + 2;
  const tilesY = Math.ceil(canvas.height / TILE_SIZE) + 2;
  const startX = Math.floor(cameraX - tilesX / 2);
  const startY = Math.floor(cameraY - tilesY / 2);

  ctx.strokeStyle = "rgba(87, 147, 172, 0.17)";
  ctx.lineWidth = 1;

  for (let x = 0; x < tilesX; x += 1) {
    for (let y = 0; y < tilesY; y += 1) {
      const wx = startX + x;
      const wy = startY + y;

      if (wx < 0 || wy < 0 || wx >= gameState.map.width || wy >= gameState.map.height) {
        continue;
      }

      const p = worldToScreen(wx, wy, cameraX, cameraY);
      ctx.strokeRect(Math.round(p.x), Math.round(p.y), TILE_SIZE, TILE_SIZE);
    }
  }
}

function drawPlayer(player, cameraX, cameraY, isSelf) {
  const p = worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);

  if (player.classType === "warrior") {
    drawWarriorPlayer(player, p, isSelf);
  } else {
    drawMagePlayer(player, p, isSelf);
  }

  ctx.fillStyle = "#f5f7fa";
  ctx.font = "12px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(player.name, p.x, p.y - (isSelf ? 21 : 19) - 7);
}

function drawPlayerCastBar(player, cameraX, cameraY, isSelf, frameNow) {
  const castState = isSelf ? abilityChannel : remotePlayerCasts.get(player.id);
  const cast = getCastProgress(castState, frameNow);
  if (!cast) {
    if (!isSelf && castState && castState.active) {
      remotePlayerCasts.delete(player.id);
    }
    return;
  }

  const p = worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
  const width = 34;
  const height = 5;
  const x = Math.round(p.x - width / 2);
  const y = Math.round(p.y + 20);
  const fillWidth = Math.round(width * cast.ratio);

  ctx.fillStyle = "rgba(4, 10, 18, 0.9)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "rgba(63, 173, 255, 0.95)";
  ctx.fillRect(x, y, fillWidth, height);
  ctx.strokeStyle = "rgba(166, 218, 255, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
}

function getSelfVisualEffectState(effectKey, frameNow) {
  const state = selfNegativeEffects[effectKey];
  if (!state) {
    return null;
  }
  if ((Number(state.endsAt) || 0) <= frameNow) {
    selfNegativeEffects[effectKey] = null;
    return null;
  }
  return state;
}

function drawPlayerStunEffect(player, cameraX, cameraY, isSelf, frameNow) {
  const state = isSelf ? getSelfVisualEffectState("stun", frameNow) : remotePlayerStuns.get(player.id);
  if (!state) {
    return;
  }
  if ((Number(state.endsAt) || 0) <= frameNow) {
    if (!isSelf) {
      remotePlayerStuns.delete(player.id);
    }
    return;
  }

  const p = worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
  const centerX = p.x;
  const centerY = p.y - 18;
  const t = frameNow * 0.0065;

  ctx.save();
  ctx.strokeStyle = "rgba(243, 252, 255, 0.92)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    const a = t + i * ((Math.PI * 2) / 3);
    const baseX = centerX + Math.cos(a) * 7;
    const baseY = centerY + Math.sin(a) * 3.2;
    ctx.beginPath();
    for (let s = 0; s <= 20; s += 1) {
      const u = s / 20;
      const ang = a + u * Math.PI * 2.2;
      const r = 2.2 * (1 - u);
      const x = baseX + Math.cos(ang) * r;
      const y = baseY + Math.sin(ang) * r;
      if (s === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayerSlowTint(player, cameraX, cameraY, isSelf, frameNow) {
  const state = isSelf ? getSelfVisualEffectState("slow", frameNow) : remotePlayerSlows.get(player.id);
  if (!state) {
    return;
  }
  if ((Number(state.endsAt) || 0) <= frameNow) {
    if (!isSelf) {
      remotePlayerSlows.delete(player.id);
    }
    return;
  }

  const p = worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
  const multiplier = isSelf
    ? clamp((Number(state.multiplierQ) || 1000) / 1000, 0.1, 1)
    : clamp(Number(state.multiplier) || 1, 0.1, 1);
  const strength = clamp(1 - multiplier, 0, 1);
  const phaseSeed = Number.isFinite(Number(player.id)) ? Number(player.id) : 0;
  const pulse = 0.6 + Math.sin(frameNow * 0.016 + (phaseSeed % 7)) * 0.4;
  const alpha = clamp(0.16 + strength * 0.28, 0.12, 0.42) * (0.75 + pulse * 0.25);
  const radius = 14 + strength * 3;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, radius);
  grad.addColorStop(0, "rgba(214, 247, 255, 0.86)");
  grad.addColorStop(0.52, "rgba(118, 194, 255, 0.56)");
  grad.addColorStop(1, "rgba(78, 155, 235, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayerBurnEffect(player, cameraX, cameraY, isSelf, frameNow) {
  const state = isSelf ? getSelfVisualEffectState("burn", frameNow) : remotePlayerBurns.get(player.id);
  if (!state) {
    return;
  }
  if ((Number(state.endsAt) || 0) <= frameNow) {
    if (!isSelf) {
      remotePlayerBurns.delete(player.id);
    }
    return;
  }

  const p = worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
  const phaseSeed = Number.isFinite(Number(player.id)) ? Number(player.id) : 0;
  const pulse = 0.58 + Math.sin(frameNow * 0.019 + (phaseSeed % 9)) * 0.42;
  const alpha = 0.24 + pulse * 0.2;
  const radius = 12 + pulse * 2.2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(p.x, p.y + 1, 1.8, p.x, p.y + 1, radius);
  grad.addColorStop(0, "rgba(255, 244, 170, 0.95)");
  grad.addColorStop(0.4, "rgba(255, 153, 69, 0.68)");
  grad.addColorStop(0.78, "rgba(255, 77, 34, 0.48)");
  grad.addColorStop(1, "rgba(255, 45, 22, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 1, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayerEffectAnimations(player, cameraX, cameraY, isSelf, frameNow) {
  drawPlayerSlowTint(player, cameraX, cameraY, isSelf, frameNow);
  drawPlayerBurnEffect(player, cameraX, cameraY, isSelf, frameNow);
  drawPlayerStunEffect(player, cameraX, cameraY, isSelf, frameNow);
}

function drawMobCastBar(mob, cameraX, cameraY, frameNow) {
  const castState = remoteMobCasts.get(mob.id);
  const cast = getCastProgress(castState, frameNow);
  if (!cast) {
    if (castState && castState.active) {
      remoteMobCasts.delete(mob.id);
    }
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const width = 30;
  const height = 4;
  const x = Math.round(p.x - width / 2);
  const y = Math.round(p.y + 17);
  const fillWidth = Math.round(width * cast.ratio);

  ctx.fillStyle = "rgba(5, 12, 19, 0.9)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "rgba(117, 204, 255, 0.95)";
  ctx.fillRect(x, y, fillWidth, height);
  ctx.strokeStyle = "rgba(181, 228, 255, 0.76)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
}

function drawMobBiteAnimation(mob, cameraX, cameraY) {
  const attack = getActiveMobAttackState(mob.id);
  if (!attack) {
    return;
  }
  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const style = getMobRenderStyle(mob);
  const speedMul = getMobStyleNumber(style, "attackAnimSpeed", 1, 0.1, 4);
  const progress = clamp(attack.progress * speedMul, 0, 1);
  const open = 0.25 + progress * 0.35;
  const radius = getMobStyleNumber(style, "biteRadius", 15, 4, 40);

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 179, 179, 0.84)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.arc(p.x, p.y, radius, attack.angle - open, attack.angle - 0.02);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, attack.angle + 0.02, attack.angle + open);
  ctx.stroke();
}

function drawMobStunEffect(mob, cameraX, cameraY, frameNow) {
  const state = remoteMobStuns.get(mob.id);
  if (!state) {
    return;
  }
  if (state.endsAt <= frameNow) {
    remoteMobStuns.delete(mob.id);
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const centerX = p.x;
  const centerY = p.y - 22;
  const t = frameNow * 0.0065;

  ctx.save();
  ctx.strokeStyle = "rgba(243, 252, 255, 0.92)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    const a = t + i * ((Math.PI * 2) / 3);
    const baseX = centerX + Math.cos(a) * 8;
    const baseY = centerY + Math.sin(a) * 3.5;
    ctx.beginPath();
    for (let s = 0; s <= 20; s += 1) {
      const u = s / 20;
      const ang = a + u * Math.PI * 2.2;
      const r = 2.6 * (1 - u);
      const x = baseX + Math.cos(ang) * r;
      const y = baseY + Math.sin(ang) * r;
      if (s === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawMobSlowTint(mob, cameraX, cameraY, frameNow) {
  const state = remoteMobSlows.get(mob.id);
  if (!state) {
    return;
  }
  if (state.endsAt <= frameNow) {
    remoteMobSlows.delete(mob.id);
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const timeLeft = state.endsAt - frameNow;
  const strength = clamp(1 - state.multiplier, 0, 1);
  const pulse = 0.6 + Math.sin(frameNow * 0.016 + (mob.id % 7)) * 0.4;
  const alpha = clamp(0.16 + strength * 0.28, 0.12, 0.42) * (0.75 + pulse * 0.25);
  const radius = 16.5 + strength * 3.5;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, radius);
  grad.addColorStop(0, "rgba(214, 247, 255, 0.86)");
  grad.addColorStop(0.52, "rgba(118, 194, 255, 0.56)");
  grad.addColorStop(1, "rgba(78, 155, 235, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = clamp(0.2 + strength * 0.25, 0.18, 0.45);
  ctx.strokeStyle = "rgba(154, 221, 255, 0.9)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i += 1) {
    const a0 = frameNow * 0.005 + i * ((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 + i * 3.4, a0, a0 + Math.PI * 0.65);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMobBurnEffect(mob, cameraX, cameraY, frameNow) {
  const state = remoteMobBurns.get(mob.id);
  if (!state) {
    return;
  }
  if (state.endsAt <= frameNow) {
    remoteMobBurns.delete(mob.id);
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const pulse = 0.58 + Math.sin(frameNow * 0.019 + (mob.id % 9)) * 0.42;
  const alpha = 0.26 + pulse * 0.2;
  const radius = 14 + pulse * 2.5;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(p.x, p.y + 1, 1.8, p.x, p.y + 1, radius);
  grad.addColorStop(0, "rgba(255, 244, 170, 0.95)");
  grad.addColorStop(0.4, "rgba(255, 153, 69, 0.68)");
  grad.addColorStop(0.78, "rgba(255, 77, 34, 0.48)");
  grad.addColorStop(1, "rgba(255, 45, 22, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 1, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "rgba(255, 190, 98, 0.9)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 5; i += 1) {
    const a = frameNow * 0.006 + i * ((Math.PI * 2) / 5) + (mob.id % 5) * 0.3;
    const up = 9 + (i % 2) * 3;
    const fx = p.x + Math.cos(a) * (5 + i * 0.7);
    const fy = p.y - 2 - Math.sin(a * 1.3) * 2.4;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 4);
    ctx.quadraticCurveTo(fx + 1.6, fy - up * 0.3, fx, fy - up);
    ctx.quadraticCurveTo(fx - 1.4, fy - up * 0.35, fx, fy + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCreeperIgnitionAnimation(mob, cameraX, cameraY, attackState = null) {
  const attack = attackState || getActiveMobAttackState(mob.id);
  if (!attack) {
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const style = getMobRenderStyle(mob);
  const speedMul = getMobStyleNumber(style, "attackAnimSpeed", 1, 0.1, 4);
  const progress = clamp(attack.progress * speedMul, 0, 1);
  const baseX = p.x - 8.2 + getMobStyleNumber(style, "weaponOffsetX", 0, -24, 24);
  const baseY = p.y - 2.1 + getMobStyleNumber(style, "weaponOffsetY", 0, -24, 24);
  const pulse = 0.6 + Math.sin(progress * Math.PI * 8 + (mob.id % 5)) * 0.4;
  const radius = 2.3 + pulse * 1.2;
  const alpha = 0.65 + pulse * 0.35;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255, 82, 82, 0.94)";
  ctx.beginPath();
  ctx.arc(baseX, baseY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 216, 96, 0.92)";
  ctx.beginPath();
  ctx.arc(baseX + 0.45, baseY - 0.4, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 150, 98, 0.85)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI * 2 * i) / 5 + progress * 3.2;
    const r0 = radius + 0.8;
    const r1 = radius + 2.4 + pulse * 0.9;
    ctx.beginPath();
    ctx.moveTo(baseX + Math.cos(angle) * r0, baseY + Math.sin(angle) * r0);
    ctx.lineTo(baseX + Math.cos(angle) * r1, baseY + Math.sin(angle) * r1);
    ctx.stroke();
  }
}

function getActiveMobAttackState(mobId) {
  const bite = remoteMobBites.get(mobId);
  if (!bite) {
    return null;
  }

  const now = performance.now();
  const timeLeft = bite.activeUntil - now;
  if (timeLeft <= 0) {
    remoteMobBites.delete(mobId);
    return null;
  }

  return {
    angle: bite.angle,
    progress: 1 - timeLeft / bite.durationMs,
    sequence: Number(bite.sequence) || 0
  };
}

function drawSkeletonSwordSwing(mob, cameraX, cameraY, attackState = null) {
  const attack = attackState || getActiveMobAttackState(mob.id);
  if (!attack) {
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const style = getMobRenderStyle(mob);
  const speedMul = getMobStyleNumber(style, "attackAnimSpeed", 1, 0.1, 4);
  const progress = clamp(attack.progress * speedMul, 0, 1);
  const shoulderX = p.x - 4.6 + getMobStyleNumber(style, "weaponOffsetX", 0, -24, 24);
  const shoulderY = p.y - 1.2 + getMobStyleNumber(style, "weaponOffsetY", 0, -24, 24);
  const angleOffset = (getMobStyleNumber(style, "weaponAngleOffsetDeg", 0, -180, 180) * Math.PI) / 180;

  const startAngle = attack.angle - 1.0 + angleOffset;
  const endAngle = attack.angle + 0.5 + angleOffset;
  const swingAngle = lerp(startAngle, endAngle, progress);

  const armLength = 7.8;
  const handX = shoulderX + Math.cos(swingAngle) * armLength;
  const handY = shoulderY + Math.sin(swingAngle) * armLength;

  ctx.beginPath();
  ctx.strokeStyle = "rgba(31, 35, 44, 0.96)";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  const trailStart = swingAngle - 0.42;
  const trailEnd = swingAngle + 0.09;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(221, 228, 240, 0.34)";
  ctx.lineWidth = 2.8;
  ctx.arc(shoulderX, shoulderY, 11.8, trailStart, trailEnd);
  ctx.stroke();

  const bladeLength = 12.4;
  const tipX = handX + Math.cos(swingAngle) * bladeLength;
  const tipY = handY + Math.sin(swingAngle) * bladeLength;

  ctx.beginPath();
  ctx.strokeStyle = "rgba(92, 102, 118, 0.96)";
  ctx.lineWidth = 3.2;
  ctx.moveTo(handX, handY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(233, 238, 246, 0.94)";
  ctx.lineWidth = 1.5;
  ctx.moveTo(handX + Math.cos(swingAngle + 0.05), handY + Math.sin(swingAngle + 0.05));
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  const guardAngle = swingAngle + Math.PI / 2;
  const guardHalf = 2.5;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(125, 133, 146, 0.95)";
  ctx.lineWidth = 2;
  ctx.moveTo(handX + Math.cos(guardAngle) * guardHalf, handY + Math.sin(guardAngle) * guardHalf);
  ctx.lineTo(handX - Math.cos(guardAngle) * guardHalf, handY - Math.sin(guardAngle) * guardHalf);
  ctx.stroke();
}

function drawSkeletonArcherBowShot(mob, cameraX, cameraY, attackState = null) {
  const attack = attackState || getActiveMobAttackState(mob.id);
  if (!attack) {
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const style = getMobRenderStyle(mob);
  const speedMul = getMobStyleNumber(style, "attackAnimSpeed", 1, 0.1, 4);
  const progress = clamp(attack.progress * speedMul, 0, 1);
  const releasePhase = clamp((progress - 0.55) / 0.45, 0, 1);
  const pullPhase = progress < 0.55 ? progress / 0.55 : 1;

  const angle = attack.angle;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const perpX = -dirY;
  const perpY = dirX;

  const shoulderX = p.x - dirX * 2.1;
  const shoulderY = p.y - dirY * 1.9;
  const bowX = shoulderX + dirX * (4.8 + pullPhase * 0.9);
  const bowY = shoulderY + dirY * (4.8 + pullPhase * 0.9);
  const bowSpan = 8.6;
  const bowCurve = 4.9 + Math.sin(progress * Math.PI) * 1.2;
  const drawPull = 4.8 + pullPhase * 5.6 - releasePhase * 4.9;

  // Rear arm pulling string.
  const handPullX = shoulderX - dirX * drawPull + perpX * 0.5;
  const handPullY = shoulderY - dirY * drawPull + perpY * 0.5;
  ctx.strokeStyle = "rgba(33, 38, 46, 0.96)";
  ctx.lineWidth = 2.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(handPullX, handPullY);
  ctx.stroke();

  // Front arm.
  const handFrontX = bowX - dirX * 1 + perpX * 0.2;
  const handFrontY = bowY - dirY * 1 + perpY * 0.2;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(handFrontX, handFrontY);
  ctx.stroke();

  // Bow arc.
  const bowTopX = bowX + perpX * bowSpan;
  const bowTopY = bowY + perpY * bowSpan;
  const bowBotX = bowX - perpX * bowSpan;
  const bowBotY = bowY - perpY * bowSpan;
  const bowCtrlX = bowX + dirX * bowCurve;
  const bowCtrlY = bowY + dirY * bowCurve;
  ctx.strokeStyle = "rgba(93, 72, 49, 0.98)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(bowTopX, bowTopY);
  ctx.quadraticCurveTo(bowCtrlX, bowCtrlY, bowBotX, bowBotY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(218, 223, 232, 0.9)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bowTopX, bowTopY);
  ctx.lineTo(handPullX, handPullY);
  ctx.lineTo(bowBotX, bowBotY);
  ctx.stroke();

  // Nocked arrow.
  const arrowLen = 12.4;
  const arrowBackX = handPullX;
  const arrowBackY = handPullY;
  const arrowTipX = arrowBackX + dirX * arrowLen;
  const arrowTipY = arrowBackY + dirY * arrowLen;
  ctx.strokeStyle = "rgba(221, 226, 236, 0.96)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(arrowBackX, arrowBackY);
  ctx.lineTo(arrowTipX, arrowTipY);
  ctx.stroke();

  ctx.fillStyle = "rgba(189, 198, 211, 0.96)";
  ctx.beginPath();
  ctx.moveTo(arrowTipX + dirX * 2.1, arrowTipY + dirY * 2.1);
  ctx.lineTo(arrowTipX - perpX * 1.3, arrowTipY - perpY * 1.3);
  ctx.lineTo(arrowTipX + perpX * 1.3, arrowTipY + perpY * 1.3);
  ctx.closePath();
  ctx.fill();

  if (releasePhase > 0) {
    const streakLen = 10 + releasePhase * 9;
    const startX = arrowTipX + dirX * 2.4;
    const startY = arrowTipY + dirY * 2.4;
    ctx.strokeStyle = `rgba(231, 236, 246, ${(0.42 * (1 - releasePhase)).toFixed(3)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + dirX * streakLen, startY + dirY * streakLen);
    ctx.stroke();
  }
}

function drawOrcDualAxeSwing(mob, cameraX, cameraY, attackState = null) {
  const attack = attackState || getActiveMobAttackState(mob.id);
  if (!attack) {
    return;
  }

  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const style = getMobRenderStyle(mob);
  const speedMul = getMobStyleNumber(style, "attackAnimSpeed", 1, 0.1, 4);
  const progress = clamp(attack.progress * speedMul, 0, 1);
  const leadLeft = ((Number(attack.sequence) || 0) & 1) === 0;
  const offsetX = getMobStyleNumber(style, "weaponOffsetX", 0, -24, 24);
  const offsetY = getMobStyleNumber(style, "weaponOffsetY", 0, -24, 24);
  const angleOffset = (getMobStyleNumber(style, "weaponAngleOffsetDeg", 0, -180, 180) * Math.PI) / 180;

  const easing = progress < 0.6
    ? 1 - Math.pow(1 - progress / 0.6, 3)
    : 1 - ((progress - 0.6) / 0.4) * 0.18;

  const base = attack.angle + angleOffset;
  const leftStart = base - (leadLeft ? 1.7 : 1.15);
  const leftEnd = base + (leadLeft ? 0.42 : 0.08);
  const rightStart = base + (leadLeft ? 1.15 : 1.7);
  const rightEnd = base - (leadLeft ? 0.08 : 0.42);

  const leftAngle = lerp(leftStart, leftEnd, easing);
  const rightAngle = lerp(rightStart, rightEnd, easing);
  const pulse = 0.8 + Math.sin(progress * Math.PI) * 0.35;

  const drawSwing = (shoulderX, shoulderY, angle, options) => {
    const armLength = 8.2;
    const handX = shoulderX + Math.cos(angle) * armLength;
    const handY = shoulderY + Math.sin(angle) * armLength;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(29, 35, 29, 0.98)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    const trailStart = angle - options.trailSpan * 0.88;
    const trailEnd = angle + options.trailSpan * 0.16;
    ctx.beginPath();
    ctx.strokeStyle = options.trailColor;
    ctx.lineWidth = options.trailWidth;
    ctx.arc(shoulderX, shoulderY, options.trailRadius, trailStart, trailEnd);
    ctx.stroke();

    const handleLen = 11.2;
    const shaftTipX = handX + Math.cos(angle) * handleLen;
    const shaftTipY = handY + Math.sin(angle) * handleLen;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(110, 74, 47, 0.98)";
    ctx.lineWidth = 2.8;
    ctx.moveTo(handX, handY);
    ctx.lineTo(shaftTipX, shaftTipY);
    ctx.stroke();

    const bladeAngle = angle - Math.PI / 2;
    const b0x = shaftTipX + Math.cos(angle) * 0.6;
    const b0y = shaftTipY + Math.sin(angle) * 0.6;
    ctx.beginPath();
    ctx.fillStyle = options.bladeColor;
    ctx.strokeStyle = "rgba(33, 24, 20, 0.95)";
    ctx.lineWidth = 1.7;
    ctx.moveTo(b0x, b0y);
    ctx.lineTo(b0x + Math.cos(bladeAngle - 0.2) * 6.0, b0y + Math.sin(bladeAngle - 0.2) * 6.0);
    ctx.lineTo(b0x + Math.cos(bladeAngle - 1.03) * 8.6, b0y + Math.sin(bladeAngle - 1.03) * 8.6);
    ctx.lineTo(b0x + Math.cos(bladeAngle + 1.03) * 8.6, b0y + Math.sin(bladeAngle + 1.03) * 8.6);
    ctx.lineTo(b0x + Math.cos(bladeAngle + 0.2) * 6.0, b0y + Math.sin(bladeAngle + 0.2) * 6.0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  drawSwing(p.x - 6.8 + offsetX, p.y - 2.1 + offsetY, leftAngle, {
    trailSpan: 0.55 + pulse * 0.11,
    trailRadius: 12.4,
    trailWidth: 2.8,
    trailColor: "rgba(232, 126, 104, 0.35)",
    bladeColor: "rgba(228, 128, 108, 0.96)"
  });
  drawSwing(p.x + 6.8 + offsetX, p.y - 2.1 + offsetY, rightAngle, {
    trailSpan: 0.55 + pulse * 0.11,
    trailRadius: 12.2,
    trailWidth: 2.6,
    trailColor: "rgba(226, 102, 92, 0.3)",
    bladeColor: "rgba(215, 112, 102, 0.95)"
  });
}

function getWarriorSwingState(player, isSelf) {
  const now = performance.now();
  if (isSelf) {
    const timeLeft = swordSwing.activeUntil - now;
    if (timeLeft <= 0) {
      return null;
    }
    return {
      angle: swordSwing.angle,
      progress: 1 - timeLeft / swordSwing.durationMs
    };
  }

  const swing = remotePlayerSwings.get(player.id);
  if (!swing) {
    return null;
  }
  const timeLeft = swing.activeUntil - now;
  if (timeLeft <= 0) {
    remotePlayerSwings.delete(player.id);
    return null;
  }
  return {
    angle: swing.angle,
    progress: 1 - timeLeft / swing.durationMs
  };
}

function getWarriorMotionState(player, isSelf) {
  const now = performance.now();
  const key = `${isSelf ? "self" : "player"}:${String(player.id ?? "0")}`;
  const existing = warriorAnimRuntime.get(key);
  const seed = ((Number(player.id) || hashString(key)) % 628) / 100;
  const state =
    existing ||
    {
      lastX: player.x,
      lastY: player.y,
      lastT: now,
      phase: seed,
      idlePhase: seed,
      lastSeenAt: now
    };

  const dt = Math.max(0.001, (now - state.lastT) / 1000);
  const moved = Math.hypot(player.x - state.lastX, player.y - state.lastY);
  const speed = moved / dt;
  const moving = speed > 0.035;

  if (moving) {
    state.phase = (state.phase + dt * 7.4) % (Math.PI * 2);
  } else {
    state.idlePhase = (state.idlePhase + dt * 2.1) % (Math.PI * 2);
  }

  state.lastX = player.x;
  state.lastY = player.y;
  state.lastT = now;
  state.lastSeenAt = now;
  warriorAnimRuntime.set(key, state);

  const walk = Math.sin(state.phase);
  const idle = Math.sin(state.idlePhase);
  return {
    moving,
    walk,
    bob: moving ? Math.abs(Math.sin(state.phase)) * 1.05 : idle * 0.35,
    sway: moving ? walk * 0.9 : idle * 0.22,
    shieldBob: moving ? Math.sin(state.phase + Math.PI / 2) * 0.45 : idle * 0.12
  };
}

function pruneWarriorAnimRuntime() {
  const now = performance.now();
  for (const [key, state] of warriorAnimRuntime.entries()) {
    if (now - state.lastSeenAt > 3000) {
      warriorAnimRuntime.delete(key);
    }
  }
}

function drawWarriorPlayer(player, p, isSelf) {
  const motion = getWarriorMotionState(player, isSelf);
  const swing = getWarriorSwingState(player, isSelf);
  const outline = "#111822";
  const armor = isSelf ? "#edf2f8" : "#e5ebf3";
  const armorDark = isSelf ? "#a2aec0" : "#98a4b8";
  const cloth = isSelf ? "#566a8f" : "#4f6080";
  const leather = "#86613f";
  const boot = "#222831";
  const skin = "#d9b18f";

  const cx = p.x + motion.sway * 0.08;
  const cy = p.y + motion.bob * 0.18;

  // Legs.
  const legBaseY = cy + 8.8;
  const legStep = motion.moving ? motion.walk * 1.7 : 0;
  ctx.strokeStyle = cloth;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 2.6, legBaseY - 0.5);
  ctx.lineTo(cx - 4.2 - legStep * 0.45, legBaseY + 7.1);
  ctx.moveTo(cx + 2.6, legBaseY - 0.5);
  ctx.lineTo(cx + 4.2 + legStep * 0.45, legBaseY + 7.1);
  ctx.stroke();

  ctx.fillStyle = boot;
  ctx.beginPath();
  ctx.ellipse(cx - 4.2 - legStep * 0.45, legBaseY + 8.2, 2.2, 1.8, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 4.2 + legStep * 0.45, legBaseY + 8.2, 2.2, 1.8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Torso.
  ctx.fillStyle = armor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3.3, 8.7, 7.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belt.
  ctx.strokeStyle = leather;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 6.1, cy + 6.2);
  ctx.lineTo(cx + 6.1, cy + 6.2);
  ctx.stroke();

  // Head + helmet dome.
  ctx.fillStyle = armor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 6.0, 9.0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Visor.
  ctx.fillStyle = "#0f131c";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3.6, 6.2, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Helmet straps.
  ctx.strokeStyle = armorDark;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(cx - 7.8, cy - 5.6);
  ctx.lineTo(cx + 7.8, cy - 5.6);
  ctx.moveTo(cx, cy - 14.5);
  ctx.lineTo(cx, cy + 0.8);
  ctx.stroke();

  // Rivets.
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(cx - 4.8, cy - 5.6, 0.8, 0, Math.PI * 2);
  ctx.arc(cx, cy - 5.6, 0.8, 0, Math.PI * 2);
  ctx.arc(cx + 4.8, cy - 5.6, 0.8, 0, Math.PI * 2);
  ctx.arc(cx, cy - 9.9, 0.8, 0, Math.PI * 2);
  ctx.arc(cx, cy - 1.5, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Left arm (sword arm).
  const leftShoulderX = cx - 5.8;
  const leftShoulderY = cy - 1.7;
  let armAngle = -2.05 - motion.walk * 0.12;
  if (swing) {
    const start = swing.angle - 1.0;
    const end = swing.angle + 0.45;
    armAngle = lerp(start, end, swing.progress);
  }
  const armLength = 8.6;
  const handX = leftShoulderX + Math.cos(armAngle) * armLength;
  const handY = leftShoulderY + Math.sin(armAngle) * armLength;

  ctx.beginPath();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.8;
  ctx.lineCap = "round";
  ctx.moveTo(leftShoulderX, leftShoulderY);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(handX, handY, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Sword.
  const swordAngle = armAngle + 0.12;
  const bladeLength = swing ? 15.2 : 13.0;
  const bladeX = handX + Math.cos(swordAngle) * bladeLength;
  const bladeY = handY + Math.sin(swordAngle) * bladeLength;

  ctx.beginPath();
  ctx.strokeStyle = "#7f8b9e";
  ctx.lineWidth = 3.4;
  ctx.moveTo(handX, handY);
  ctx.lineTo(bladeX, bladeY);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#edf2fb";
  ctx.lineWidth = 1.3;
  ctx.moveTo(handX + Math.cos(swordAngle + 0.05), handY + Math.sin(swordAngle + 0.05));
  ctx.lineTo(bladeX, bladeY);
  ctx.stroke();

  const guardAngle = swordAngle + Math.PI / 2;
  const guardHalf = 2.9;
  ctx.beginPath();
  ctx.strokeStyle = "#606a78";
  ctx.lineWidth = 2;
  ctx.moveTo(handX + Math.cos(guardAngle) * guardHalf, handY + Math.sin(guardAngle) * guardHalf);
  ctx.lineTo(handX - Math.cos(guardAngle) * guardHalf, handY - Math.sin(guardAngle) * guardHalf);
  ctx.stroke();

  // Right arm and shield.
  const rightShoulderX = cx + 5.5;
  const rightShoulderY = cy - 1.1;
  const rightArmAngle = 0.45 + motion.walk * 0.08;
  const rightHandX = rightShoulderX + Math.cos(rightArmAngle) * 6.4;
  const rightHandY = rightShoulderY + Math.sin(rightArmAngle) * 6.4;

  ctx.beginPath();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.8;
  ctx.moveTo(rightShoulderX, rightShoulderY);
  ctx.lineTo(rightHandX, rightHandY);
  ctx.stroke();

  const shieldX = rightHandX + 2.9;
  const shieldY = rightHandY + 1.4 + motion.shieldBob;
  const shieldRadius = 6.1;
  ctx.fillStyle = armor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(shieldX, shieldY, shieldRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = armorDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(shieldX, shieldY, shieldRadius - 1.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#8f99aa";
  ctx.beginPath();
  ctx.arc(shieldX, shieldY, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawMagePlayer(_player, p, isSelf) {
  const bodyFill = isSelf ? "#f0f7ff" : "#ecf2fa";
  const hatFill = isSelf ? "#1d2f5f" : "#17264d";
  const capeFill = isSelf ? "#1e2743" : "#191f36";
  const staffColor = "#443628";
  const outline = "#0f1322";

  const headRadius = isSelf ? 10.5 : 9.5;
  const bodyRadiusX = isSelf ? 11 : 10;
  const bodyRadiusY = isSelf ? 12.5 : 11.5;

  // Back cape wings.
  ctx.beginPath();
  ctx.fillStyle = capeFill;
  ctx.moveTo(p.x - 2, p.y + 6);
  ctx.quadraticCurveTo(p.x - 20, p.y + 5, p.x - 17, p.y + 20);
  ctx.quadraticCurveTo(p.x - 10, p.y + 17, p.x - 2, p.y + 8);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(p.x + 1, p.y + 6);
  ctx.quadraticCurveTo(p.x + 23, p.y + 8, p.x + 21, p.y + 23);
  ctx.quadraticCurveTo(p.x + 10, p.y + 19, p.x + 1, p.y + 8);
  ctx.fill();

  // Staff arm.
  const shoulderY = p.y + 1;
  const leftShoulderX = p.x - 9;
  ctx.beginPath();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.moveTo(leftShoulderX, shoulderY);
  ctx.lineTo(leftShoulderX - 10, shoulderY - 6);
  ctx.stroke();

  // Staff.
  ctx.beginPath();
  ctx.strokeStyle = staffColor;
  ctx.lineWidth = 4;
  ctx.moveTo(p.x - 18, p.y - 4);
  ctx.lineTo(p.x - 26, p.y + 31);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = outline;
  ctx.arc(p.x - 18, p.y - 4, 3.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "#d9e9ff";
  ctx.lineWidth = 2;
  ctx.arc(p.x - 18, p.y - 17, 6.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = "rgba(168, 210, 255, 0.35)";
  ctx.arc(p.x - 18, p.y - 17, 5.2, 0, Math.PI * 2);
  ctx.fill();

  // Head and body.
  ctx.beginPath();
  ctx.fillStyle = bodyFill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;
  ctx.arc(p.x, p.y, headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 13, bodyRadiusX, bodyRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hat brim and cone with star dots.
  ctx.beginPath();
  ctx.fillStyle = hatFill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.6;
  ctx.ellipse(p.x + 1, p.y - 8, 18, 7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(p.x - 10, p.y - 8);
  ctx.lineTo(p.x + 2, p.y - 28);
  ctx.lineTo(p.x + 14, p.y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f5f8ff";
  ctx.beginPath();
  ctx.arc(p.x + 3, p.y - 18, 1.1, 0, Math.PI * 2);
  ctx.arc(p.x + 7, p.y - 14, 1, 0, Math.PI * 2);
  ctx.arc(p.x - 1, p.y - 13, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Small star on hat.
  ctx.beginPath();
  ctx.strokeStyle = "#f5f8ff";
  ctx.lineWidth = 1.5;
  ctx.moveTo(p.x + 8, p.y - 22);
  ctx.lineTo(p.x + 8, p.y - 18);
  ctx.moveTo(p.x + 6, p.y - 20);
  ctx.lineTo(p.x + 10, p.y - 20);
  ctx.stroke();

  // Casting arm and fire orb.
  ctx.beginPath();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.moveTo(p.x + 8, p.y + 2);
  ctx.lineTo(p.x + 21, p.y + 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = outline;
  ctx.arc(p.x + 21, p.y + 8, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 149, 64, 0.9)";
  ctx.arc(p.x + 28, p.y + 6, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 220, 120, 0.88)";
  ctx.arc(p.x + 29.5, p.y + 4.8, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Legs.
  ctx.beginPath();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.moveTo(p.x - 3, p.y + 23);
  ctx.lineTo(p.x - 9, p.y + 31);
  ctx.moveTo(p.x + 3, p.y + 23);
  ctx.lineTo(p.x + 10, p.y + 31);
  ctx.stroke();
}

function seededUnit(seed, n) {
  const x = Math.sin((seed + n * 374761393) * 0.000001) * 43758.5453;
  return x - Math.floor(x);
}

function getProjectileVisualState(projectile, now) {
  const key = String(projectile.id ?? "");
  let state = projectileVisualRuntime.get(key);
  if (!state) {
    state = {
      seed: hashString(key || `${Math.random()}`),
      lastX: projectile.x,
      lastY: projectile.y,
      dirX: 0,
      dirY: -1,
      lastSeenAt: now
    };
  }

  const motion = normalizeDirection(projectile.x - state.lastX, projectile.y - state.lastY);
  if (motion) {
    const blendX = state.dirX * 0.68 + motion.dx * 0.32;
    const blendY = state.dirY * 0.68 + motion.dy * 0.32;
    const blended = normalizeDirection(blendX, blendY);
    if (blended) {
      state.dirX = blended.dx;
      state.dirY = blended.dy;
    }
  }

  state.lastX = projectile.x;
  state.lastY = projectile.y;
  state.lastSeenAt = now;
  projectileVisualRuntime.set(key, state);
  return state;
}

function pruneProjectileVisualRuntime(now = performance.now()) {
  for (const [key, state] of projectileVisualRuntime.entries()) {
    if (now - state.lastSeenAt > 1400) {
      projectileVisualRuntime.delete(key);
    }
  }
}

function drawFireballProjectile(p, runtime, now) {
  const dirX = runtime.dirX;
  const dirY = runtime.dirY;
  const perpX = -dirY;
  const perpY = dirX;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 8; i += 1) {
    const t = (i + 1) / 8;
    const wobble =
      (seededUnit(runtime.seed, i * 13 + 2) - 0.5) * 3.8 +
      Math.sin(now * 0.012 + i * 1.37 + runtime.seed * 0.0007) * (1.25 - t * 0.9);
    const dist = 7 + t * 20 + seededUnit(runtime.seed, i * 11 + 5) * 2.4;
    const px = p.x - dirX * dist + perpX * wobble;
    const py = p.y - dirY * dist + perpY * wobble;
    const pr = Math.max(0.9, 2.7 - t * 2.0);
    const alpha = 0.42 * (1 - t) + 0.08;

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 166, 72, ${alpha.toFixed(3)})`;
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(p.x, p.y, 1.5, p.x, p.y, 14);
  glow.addColorStop(0, "rgba(255, 252, 200, 0.98)");
  glow.addColorStop(0.28, "rgba(255, 154, 64, 0.95)");
  glow.addColorStop(0.68, "rgba(255, 70, 38, 0.64)");
  glow.addColorStop(1, "rgba(255, 70, 38, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const pulse = 1 + Math.sin(now * 0.02 + runtime.seed * 0.0008) * 0.06;
  const coreR = 4.9 * pulse;
  ctx.beginPath();
  ctx.fillStyle = "#b9241d";
  ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 226, 148, 0.78)";
  ctx.lineWidth = 1.4;
  ctx.arc(p.x - 0.7, p.y + 0.15, 2.45, -1.1, 1.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 115, 70, 0.8)";
  ctx.lineWidth = 1.1;
  ctx.arc(p.x + 0.9, p.y - 0.45, 1.7, 1.5, 4.3);
  ctx.stroke();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(dirY, dirX) + Math.PI / 2);
  ctx.strokeStyle = "rgba(255, 168, 60, 0.96)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.7;
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    const flicker = 1 + Math.sin(now * 0.022 + i * 1.31 + runtime.seed * 0.0004) * 0.18;
    const r0 = 5.2 + (i % 2) * 0.6;
    const r1 = (6.8 + (i % 2 ? 1.8 : 2.6)) * flicker;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFireSparkProjectile(p, runtime, now) {
  const dirX = runtime.dirX;
  const dirY = runtime.dirY;
  const perpX = -dirY;
  const perpY = dirX;
  const heading = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 10; i += 1) {
    const t = (i + 1) / 10;
    const jitter =
      (seededUnit(runtime.seed, i * 31 + 7) - 0.5) * 2.8 +
      Math.sin(now * 0.02 + i * 0.7 + runtime.seed * 0.0009) * (1.4 - t);
    const dist = 4 + t * 20;
    const px = p.x - dirX * dist + perpX * jitter;
    const py = p.y - dirY * dist + perpY * jitter;
    const r = Math.max(0.55, 1.8 - t * 1.25);
    const alpha = 0.42 * (1 - t) + 0.08;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 143, 54, ${alpha.toFixed(3)})`;
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 9.5);
  glow.addColorStop(0, "rgba(255, 250, 195, 0.96)");
  glow.addColorStop(0.4, "rgba(255, 176, 81, 0.92)");
  glow.addColorStop(0.72, "rgba(255, 97, 39, 0.62)");
  glow.addColorStop(1, "rgba(255, 69, 32, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(heading);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(5.2, 0);
  ctx.lineTo(-4.4, -2.6);
  ctx.lineTo(-2.2, 0);
  ctx.lineTo(-4.4, 2.6);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 131, 48, 0.95)";
  ctx.strokeStyle = "rgba(255, 213, 134, 0.9)";
  ctx.lineWidth = 1.1;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(1.6, 0, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 247, 194, 0.96)";
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 92, 42, 0.78)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i += 1) {
    const y = -2.4 + i * 1.6;
    const len = 4.4 + (i % 2) * 1.3;
    ctx.moveTo(-2.5, y);
    ctx.lineTo(-2.5 - len, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFrostboltProjectile(p, runtime, now) {
  const dirX = runtime.dirX;
  const dirY = runtime.dirY;
  const perpX = -dirY;
  const perpY = dirX;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 9; i += 1) {
    const t = (i + 1) / 9;
    const wobble =
      (seededUnit(runtime.seed, i * 17 + 3) - 0.5) * 3.2 +
      Math.sin(now * 0.01 + i * 1.2 + runtime.seed * 0.0005) * (1.1 - t * 0.7);
    const dist = 6 + t * 24 + seededUnit(runtime.seed, i * 19 + 7) * 2;
    const px = p.x - dirX * dist + perpX * wobble;
    const py = p.y - dirY * dist + perpY * wobble;
    const pr = Math.max(0.8, 2.4 - t * 1.7);
    const alpha = 0.36 * (1 - t) + 0.1;
    ctx.beginPath();
    ctx.fillStyle = `rgba(156, 223, 255, ${alpha.toFixed(3)})`;
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(p.x, p.y, 1.2, p.x, p.y, 13.8);
  glow.addColorStop(0, "rgba(242, 253, 255, 0.97)");
  glow.addColorStop(0.35, "rgba(171, 233, 255, 0.9)");
  glow.addColorStop(0.7, "rgba(103, 185, 242, 0.48)");
  glow.addColorStop(1, "rgba(75, 157, 224, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const spearLength = 17;
  const spearWidth = 4.6;
  const tipX = p.x + dirX * spearLength;
  const tipY = p.y + dirY * spearLength;
  const backX = p.x - dirX * 5.2;
  const backY = p.y - dirY * 5.2;
  const leftX = p.x + perpX * spearWidth;
  const leftY = p.y + perpY * spearWidth;
  const rightX = p.x - perpX * spearWidth;
  const rightY = p.y - perpY * spearWidth;

  ctx.beginPath();
  ctx.fillStyle = "rgba(198, 244, 255, 0.95)";
  ctx.strokeStyle = "rgba(107, 180, 231, 0.95)";
  ctx.lineWidth = 1.8;
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(backX, backY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(236, 253, 255, 0.9)";
  ctx.lineWidth = 1.2;
  ctx.moveTo(backX + dirX * 1.4, backY + dirY * 1.4);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Sparkle flakes around the bolt.
  ctx.strokeStyle = "rgba(209, 244, 255, 0.85)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 5; i += 1) {
    const a = now * 0.004 + i * ((Math.PI * 2) / 5);
    const r = 7 + (i % 2) * 2 + Math.sin(now * 0.01 + i) * 0.8;
    const sx = p.x + Math.cos(a) * r;
    const sy = p.y + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(sx - 1.4, sy);
    ctx.lineTo(sx + 1.4, sy);
    ctx.moveTo(sx, sy - 1.4);
    ctx.lineTo(sx, sy + 1.4);
    ctx.stroke();
  }
}

function drawArcaneMissileProjectile(p, runtime, now) {
  const dirX = runtime.dirX;
  const dirY = runtime.dirY;
  const perpX = -dirY;
  const perpY = dirX;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 11; i += 1) {
    const t = (i + 1) / 11;
    const dist = 6 + t * 22;
    const wobble =
      Math.sin(now * 0.015 + runtime.seed * 0.0011 + i * 0.9) * (2.6 - t * 1.5) +
      (seededUnit(runtime.seed, i * 29 + 11) - 0.5) * 1.3;
    const px = p.x - dirX * dist + perpX * wobble;
    const py = p.y - dirY * dist + perpY * wobble;
    const radius = Math.max(0.7, 2.2 - t * 1.6);
    const alpha = 0.35 * (1 - t) + 0.08;
    ctx.beginPath();
    ctx.fillStyle = `rgba(207, 176, 255, ${alpha.toFixed(3)})`;
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(p.x, p.y, 1.2, p.x, p.y, 14.5);
  glow.addColorStop(0, "rgba(255, 246, 255, 0.98)");
  glow.addColorStop(0.35, "rgba(212, 186, 255, 0.9)");
  glow.addColorStop(0.7, "rgba(145, 100, 222, 0.5)");
  glow.addColorStop(1, "rgba(91, 63, 173, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tipX = p.x + dirX * 15.5;
  const tipY = p.y + dirY * 15.5;
  const backX = p.x - dirX * 6.2;
  const backY = p.y - dirY * 6.2;
  const wing = 4.8;
  ctx.beginPath();
  ctx.fillStyle = "rgba(242, 231, 255, 0.96)";
  ctx.strokeStyle = "rgba(146, 117, 214, 0.95)";
  ctx.lineWidth = 1.7;
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(p.x + perpX * wing, p.y + perpY * wing);
  ctx.lineTo(backX, backY);
  ctx.lineTo(p.x - perpX * wing, p.y - perpY * wing);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const coreGrad = ctx.createLinearGradient(backX, backY, tipX, tipY);
  coreGrad.addColorStop(0, "rgba(128, 93, 205, 0.55)");
  coreGrad.addColorStop(0.5, "rgba(252, 240, 255, 0.98)");
  coreGrad.addColorStop(1, "rgba(178, 140, 236, 0.78)");
  ctx.strokeStyle = coreGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(backX + dirX * 1.2, backY + dirY * 1.2);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.lineCap = "round";
  for (let band = 0; band < 3; band += 1) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(232, 214, 255, ${(0.7 - band * 0.14).toFixed(3)})`;
    ctx.lineWidth = 1.2 + (2 - band) * 0.35;
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      const dist = -8 + t * 30;
      const phase = now * 0.016 + runtime.seed * 0.0013 + band * 2.0 + t * 11.5;
      const radius = (1 - Math.abs(t - 0.5) * 1.15) * (5.6 - band * 1.15);
      const swirl = Math.sin(phase) * radius;
      const x = p.x - dirX * dist + perpX * swirl;
      const y = p.y - dirY * dist + perpY * swirl;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(244, 236, 255, 0.88)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i += 1) {
    const a = now * 0.0048 + i * ((Math.PI * 2) / 6) + runtime.seed * 0.0008;
    const r = 7 + (i % 2) * 2 + Math.sin(now * 0.01 + i) * 0.6;
    const sx = p.x + Math.cos(a) * r;
    const sy = p.y + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(sx - 1.4, sy);
    ctx.lineTo(sx + 1.4, sy);
    ctx.moveTo(sx, sy - 1.4);
    ctx.lineTo(sx, sy + 1.4);
    ctx.stroke();
  }
}

function drawBoneArrowProjectile(p, runtime, now) {
  const dirX = runtime.dirX;
  const dirY = runtime.dirY;
  const perpX = -dirY;
  const perpY = dirX;
  const heading = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i += 1) {
    const t = (i + 1) / 5;
    const dist = 4 + t * 14;
    const wobble = Math.sin(now * 0.012 + i * 1.1 + runtime.seed * 0.0007) * (1.2 - t * 0.7);
    const px = p.x - dirX * dist + perpX * wobble;
    const py = p.y - dirY * dist + perpY * wobble;
    const r = Math.max(0.45, 1.5 - t * 1.1);
    const alpha = 0.2 * (1 - t) + 0.06;
    ctx.beginPath();
    ctx.fillStyle = `rgba(226, 233, 242, ${alpha.toFixed(3)})`;
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(heading);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Shaft.
  ctx.strokeStyle = "rgba(216, 221, 230, 0.98)";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(-11.5, 0);
  ctx.lineTo(11, 0);
  ctx.stroke();

  // Head.
  ctx.fillStyle = "rgba(189, 199, 212, 0.98)";
  ctx.strokeStyle = "rgba(128, 138, 154, 0.95)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(13.8, 0);
  ctx.lineTo(9.2, -2.7);
  ctx.lineTo(10.2, 0);
  ctx.lineTo(9.2, 2.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fletching.
  ctx.fillStyle = "rgba(109, 117, 129, 0.95)";
  ctx.beginPath();
  ctx.moveTo(-11.3, 0);
  ctx.lineTo(-15.1, -2.5);
  ctx.lineTo(-13.3, -0.2);
  ctx.closePath();
  ctx.moveTo(-11.3, 0);
  ctx.lineTo(-15.1, 2.5);
  ctx.lineTo(-13.3, 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const ABILITY_PROJECTILE_RENDERERS = Object.freeze({
  fireball: drawFireballProjectile,
  fire_spark: drawFireSparkProjectile,
  frostbolt: drawFrostboltProjectile,
  arcane_missiles: drawArcaneMissileProjectile,
  bone_arrow: drawBoneArrowProjectile
});

function drawProjectile(projectile, cameraX, cameraY, frameNow) {
  const p = worldToScreen(projectile.x + 0.5, projectile.y + 0.5, cameraX, cameraY);
  const now = Number.isFinite(frameNow) ? frameNow : performance.now();
  const runtime = getProjectileVisualState(projectile, now);
  const abilityId = String(projectile.abilityId || "");
  const actionDef = getActionDefById(abilityId);
  const projectileHook = getAbilityVisualHook(abilityId, actionDef, "projectileRenderer", "default");
  const drawProjectileEffect = ABILITY_PROJECTILE_RENDERERS[projectileHook];

  if (drawProjectileEffect) {
    drawProjectileEffect(p, runtime, now);
    return;
  }

  ctx.beginPath();
  ctx.fillStyle = "#c8d9ee";
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawMob(mob, cameraX, cameraY, attackState = null) {
  const p = worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
  const mobStyle = getMobRenderStyle(mob);
  const mobName = String(mob.name || "Mob");
  const spriteType = getMobSpriteType(mob);
  const skeletonArcherIncludeBow = !attackState;
  const skeletonIncludeSword = !attackState;
  const orcIncludeAxes = !attackState;
  const sprite = spriteType === "skeleton_archer"
    ? getSkeletonArcherWalkSprite(mob, skeletonArcherIncludeBow)
    : spriteType === "skeleton"
      ? getSkeletonWalkSprite(mob, skeletonIncludeSword)
    : spriteType === "creeper"
      ? getCreeperWalkSprite(mob)
      : spriteType === "spider"
        ? getSpiderWalkSprite(mob)
        : spriteType === "zombie"
          ? getZombieWalkSprite(mob)
          : spriteType === "orc"
            ? getOrcWalkSprite(mob, orcIncludeAxes)
            : createMobSprite(mobName, mobStyle);

  const sizeScale = getMobStyleNumber(mobStyle, "sizeScale", 1, 0.5, 3);
  const drawSize = Math.round(MOB_SPRITE_SIZE * sizeScale);
  const half = drawSize / 2;
  ctx.drawImage(sprite, Math.round(p.x - half), Math.round(p.y - half), drawSize, drawSize);
  drawMobHpBar(mob, p);
}

function drawLootBag(bag, cameraX, cameraY) {
  const p = worldToScreen(bag.x + 0.5, bag.y + 0.5, cameraX, cameraY);
  const size = 11;

  ctx.fillStyle = "#7d5a30";
  ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  ctx.strokeStyle = "#d4aa67";
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
}

function render() {
  requestAnimationFrame(render);
  const frameNow = performance.now();
  updateAbilityChannel(frameNow);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0a1621";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const interpolatedState =
    getInterpolatedState() ||
    (gameState.self
      ? {
          self: gameState.self,
          players: gameState.players,
          projectiles: gameState.projectiles,
          mobs: gameState.mobs,
          lootBags: gameState.lootBags
        }
      : null);

  if (!interpolatedState || !interpolatedState.self) {
    updateActionBarUI(null);
    return;
  }
  lastRenderState = interpolatedState;

  const cameraX = interpolatedState.self.x + 0.5;
  const cameraY = interpolatedState.self.y + 0.5;
  updateMobCastSpatialAudio(interpolatedState.mobs, frameNow);
  updateProjectileSpatialAudio(interpolatedState.projectiles, frameNow);

  drawGrid(cameraX, cameraY);
  drawAbilityCastPreview(interpolatedState.self, cameraX, cameraY, frameNow);
  const hoveredMob = getHoveredMob(interpolatedState.mobs, cameraX, cameraY);
  const hoveredBag = getHoveredLootBag(interpolatedState.lootBags, cameraX, cameraY);

  for (const projectile of interpolatedState.projectiles) {
    drawProjectile(projectile, cameraX, cameraY, frameNow);
  }
  drawExplosionEffects(cameraX, cameraY);
  drawAreaEffects(cameraX, cameraY, frameNow);

  for (const bag of interpolatedState.lootBags) {
    drawLootBag(bag, cameraX, cameraY);
  }

  for (const mob of interpolatedState.mobs) {
    const attackState = getActiveMobAttackState(mob.id);
    const attackVisual = getMobAttackVisualType(mob);
    if (attackVisual === "sword") {
      drawMob(mob, cameraX, cameraY, attackState);
      drawSkeletonSwordSwing(mob, cameraX, cameraY, attackState);
    } else if (attackVisual === "bow") {
      drawMob(mob, cameraX, cameraY, attackState);
      drawSkeletonArcherBowShot(mob, cameraX, cameraY, attackState);
    } else if (attackVisual === "ignition") {
      drawMob(mob, cameraX, cameraY, attackState);
      drawCreeperIgnitionAnimation(mob, cameraX, cameraY, attackState);
    } else if (attackVisual === "dual_axes") {
      drawMob(mob, cameraX, cameraY, attackState);
      drawOrcDualAxeSwing(mob, cameraX, cameraY, attackState);
    } else if (attackVisual === "none") {
      drawMob(mob, cameraX, cameraY, attackState);
    } else {
      drawMob(mob, cameraX, cameraY, attackState);
      drawMobBiteAnimation(mob, cameraX, cameraY);
    }
    drawMobCastBar(mob, cameraX, cameraY, frameNow);
    drawMobSlowTint(mob, cameraX, cameraY, frameNow);
    drawMobBurnEffect(mob, cameraX, cameraY, frameNow);
    drawMobStunEffect(mob, cameraX, cameraY, frameNow);
  }
  drawFloatingDamageNumbers(cameraX, cameraY);
  pruneSkeletonWalkRuntime();
  pruneCreeperWalkRuntime();
  pruneZombieWalkRuntime();
  pruneSpiderWalkRuntime();
  pruneOrcWalkRuntime();
  pruneSkeletonArcherWalkRuntime();
  pruneWarriorAnimRuntime();
  pruneProjectileVisualRuntime(frameNow);

  for (const other of interpolatedState.players) {
    drawPlayer(other, cameraX, cameraY, false);
    drawPlayerEffectAnimations(other, cameraX, cameraY, false, frameNow);
    drawPlayerCastBar(other, cameraX, cameraY, false, frameNow);
  }

  drawPlayer(interpolatedState.self, cameraX, cameraY, true);
  drawPlayerEffectAnimations(interpolatedState.self, cameraX, cameraY, true, frameNow);
  drawPlayerCastBar(interpolatedState.self, cameraX, cameraY, true, frameNow);

  if (hoveredMob) {
    drawMobTooltip(hoveredMob.mob, hoveredMob.p);
  }
  if (hoveredBag) {
    drawLootBagTooltip(hoveredBag.bag, hoveredBag.p);
  }

  const latestSelf = gameState.self || interpolatedState.self;
  updateActionBarUI(latestSelf);
  hudName.textContent = `Player: ${latestSelf.name} (${myId || "?"})`;
  hudClass.textContent = `Class: ${latestSelf.classType} | HP: ${latestSelf.hp}/${latestSelf.maxHp} | Copper: ${latestSelf.copper ?? 0} | Lvl: ${latestSelf.level ?? 1} EXP: ${latestSelf.exp ?? 0}/${latestSelf.expToNext ?? 20} | SP: ${latestSelf.skillPoints ?? 0}`;
  hudPos.textContent = `Pos: ${interpolatedState.self.x.toFixed(1)}, ${interpolatedState.self.y.toFixed(1)}`;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

document.addEventListener("keydown", (event) => {
  resumeSpatialAudioContext();
  if (event.code === "F3") {
    toggleDebugPanel();
    event.preventDefault();
    return;
  }

  if (event.code === "KeyI" && !gameUI.classList.contains("hidden")) {
    toggleInventoryPanel();
    event.preventDefault();
    return;
  }

  if (event.code === "KeyP" && !gameUI.classList.contains("hidden")) {
    toggleSpellbookPanel();
    event.preventDefault();
    return;
  }

  if (event.code === "KeyK" && !gameUI.classList.contains("hidden")) {
    toggleDpsPanel();
    event.preventDefault();
    return;
  }

  if (event.code.startsWith("Digit")) {
    const slot = event.code.replace("Digit", "");
    if (slot >= "1" && slot <= "9" && !gameUI.classList.contains("hidden")) {
      executeBoundAction(slot);
      event.preventDefault();
      return;
    }
  }

  if (event.code in keys) {
    keys[event.code] = true;
    sendMove();
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code in keys) {
    keys[event.code] = false;
    sendMove();
    event.preventDefault();
  }
});

window.addEventListener("blur", () => {
  let changed = false;
  for (const key in keys) {
    if (keys[key]) {
      keys[key] = false;
      changed = true;
    }
  }
  if (changed) {
    sendMove();
  }
  mouseState.leftDown = false;
  clearDragState();
  resetAbilityChanneling();
  stopAllSpatialLoops();
});

canvas.addEventListener("mousemove", (event) => {
  updateMouseScreenPosition(event);
});

canvas.addEventListener("mousedown", (event) => {
  resumeSpatialAudioContext();
  if (event.button !== 0) {
    return;
  }

  updateMouseScreenPosition(event);
  mouseState.leftDown = true;
  tryPrimaryAutoAction(true);
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    mouseState.leftDown = false;
  }
});

canvas.addEventListener("contextmenu", (event) => {
  resumeSpatialAudioContext();
  event.preventDefault();
  updateMouseScreenPosition(event);
  executeBoundAction("mouse_right");
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  resumeSpatialAudioContext();
  const formData = new FormData(joinForm);
  const name = String(formData.get("name") || "").trim();
  const selectedClass = String(formData.get("classType") || "").trim();
  const firstClassId = classDefsById.size ? classDefsById.keys().next().value : "";
  const classType = selectedClass || firstClassId;

  if (!name) {
    setStatus("Please enter a name.");
    return;
  }
  if (!classType) {
    setStatus("Class data is not loaded yet.");
    return;
  }

  setStatus("Connecting...");
  connectAndJoin(name, classType);
});

setInterval(updateDebugPanel, 250);
setInterval(updateDpsPanel, 250);
setInterval(tryPrimaryAutoAction, 50);
initializeDpsPanel();
loadInitialGameConfig();
requestAnimationFrame(render);
