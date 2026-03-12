const joinScreen = document.getElementById("join-screen");
const joinForm = document.getElementById("join-form");
const gameUI = document.getElementById("game-ui");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("game");
const mobileJoystick = document.getElementById("mobile-joystick");
const mobileJoystickBase = document.getElementById("mobile-joystick-base");
const mobileJoystickKnob = document.getElementById("mobile-joystick-knob");
const mobileJoystickArrow = document.getElementById("mobile-joystick-arrow");
const ctx = canvas.getContext("2d");
const hudName = document.getElementById("hud-name");
const hudClass = document.getElementById("hud-class");
const hudPos = document.getElementById("hud-pos");
const classTypeSelect = document.getElementById("classType");
const actionUi = document.getElementById("action-ui");
const resourceBars = document.getElementById("resource-bars");
const buffIcons = document.getElementById("buff-icons");
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
const vendorPanel = document.getElementById("vendor-panel");
const vendorTitle = document.getElementById("vendor-title");
const vendorSubtitle = document.getElementById("vendor-subtitle");
const vendorItemList = document.getElementById("vendor-item-list");
const vendorCloseButton = document.getElementById("vendor-close");
const equipmentPanel = document.getElementById("equipment-panel");
const equipmentGrid = document.getElementById("equipment-grid");
const debugPanel = document.getElementById("debug-panel");
const debugNet = document.getElementById("debug-net");
const debugRendererSelect = document.getElementById("debug-renderer-select");
const debugRendererApplyButton = document.getElementById("debug-renderer-apply");
const debugAdminControls = document.getElementById("debug-admin-controls");
const debugBotClassSelect = document.getElementById("debug-bot-class");
const debugCreateBotButton = document.getElementById("debug-create-bot");
const debugToggleBotListButton = document.getElementById("debug-toggle-bot-list");
const debugToggleGearLabButton = document.getElementById("debug-toggle-gear-lab");
const debugGearPanel = document.getElementById("debug-gear-panel");
const debugGearPreviewLayout = document.getElementById("debug-gear-preview-layout");
const debugGearPreviewCanvas = document.getElementById("debug-gear-preview-canvas");
const debugGearControls = document.getElementById("debug-gear-controls");
const debugGearRerollAffixesButton = document.getElementById("debug-gear-reroll-affixes");
const debugGearCloseButton = document.getElementById("debug-gear-close");
const botListPanel = document.getElementById("bot-list-panel");
const botListEntries = document.getElementById("bot-list-entries");
const botInspectDetails = document.getElementById("bot-inspect-details");
const botContextMenu = document.getElementById("bot-context-menu");
const dpsPanel = document.getElementById("dps-panel");
const dpsTabs = document.getElementById("dps-tabs");
const dpsValue = document.getElementById("dps-value");
const mobileUiElements = (() => {
  const utilityBar = document.createElement("div");
  utilityBar.id = "mobile-utility-bar";

  const lootButton = document.createElement("button");
  lootButton.id = "mobile-loot-button";
  lootButton.type = "button";
  lootButton.className = "mobile-utility-button hidden";
  lootButton.textContent = "Loot";

  const bagButton = document.createElement("button");
  bagButton.id = "mobile-bag-button";
  bagButton.type = "button";
  bagButton.className = "mobile-utility-button";
  bagButton.textContent = "Bag";

  utilityBar.appendChild(lootButton);
  utilityBar.appendChild(bagButton);
  if (actionUi) {
    actionUi.insertBefore(utilityBar, actionUi.firstChild);
  }

  const panelTabs = document.createElement("div");
  panelTabs.id = "mobile-panel-tabs";
  panelTabs.className = "hidden";

  const inventoryTabButton = document.createElement("button");
  inventoryTabButton.type = "button";
  inventoryTabButton.className = "mobile-panel-tab";
  inventoryTabButton.dataset.tab = "inventory";
  inventoryTabButton.textContent = "Inventory";

  const equipmentTabButton = document.createElement("button");
  equipmentTabButton.type = "button";
  equipmentTabButton.className = "mobile-panel-tab";
  equipmentTabButton.dataset.tab = "equipment";
  equipmentTabButton.textContent = "Character";

  const spellbookTabButton = document.createElement("button");
  spellbookTabButton.type = "button";
  spellbookTabButton.className = "mobile-panel-tab";
  spellbookTabButton.dataset.tab = "spellbook";
  spellbookTabButton.textContent = "Skills";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "mobile-panel-close";
  closeButton.textContent = "Close";

  panelTabs.appendChild(inventoryTabButton);
  panelTabs.appendChild(equipmentTabButton);
  panelTabs.appendChild(spellbookTabButton);
  panelTabs.appendChild(closeButton);

  return {
    utilityBar,
    lootButton,
    bagButton,
    panelTabs,
    inventoryTabButton,
    equipmentTabButton,
    spellbookTabButton,
    closeButton
  };
})();
const mobileUtilityBar = mobileUiElements.utilityBar;
const mobileLootButton = mobileUiElements.lootButton;
const mobileBagButton = mobileUiElements.bagButton;
const mobilePanelTabs = mobileUiElements.panelTabs;
const mobileInventoryTabButton = mobileUiElements.inventoryTabButton;
const mobileEquipmentTabButton = mobileUiElements.equipmentTabButton;
const mobileSpellbookTabButton = mobileUiElements.spellbookTabButton;
const mobilePanelCloseButton = mobileUiElements.closeButton;

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
const sharedSummonLayout = globalThis.VibeSummonLayout || null;
const sharedGetSummonCountForLevel =
  sharedSummonLayout && typeof sharedSummonLayout.getSummonCountForLevel === "function"
    ? sharedSummonLayout.getSummonCountForLevel
    : (baseCount, countPerLevel, level, options = {}) => {
        const base = Math.max(1, Math.round(Number(baseCount) || 1));
        const perLevel = Math.max(0, Number(countPerLevel) || 0);
        const lvl = Math.max(1, Math.floor(Number(level) || 1));
        const everyLevels = Math.max(0, Math.floor(Number(options.everyLevels) || 0));
        const maxCount = Math.max(0, Math.floor(Number(options.maxCount) || 0));
        const scaled =
          everyLevels > 0
            ? base + Math.floor(Math.max(0, lvl - 1) / everyLevels)
            : base + perLevel * Math.max(0, lvl - 1);
        const rounded = Math.max(1, Math.round(scaled));
        return maxCount > 0 ? Math.min(maxCount, rounded) : rounded;
      };
const sharedComputeSummonFormationPositions =
  sharedSummonLayout && typeof sharedSummonLayout.computeSummonFormationPositions === "function"
    ? sharedSummonLayout.computeSummonFormationPositions
    : (centerX, centerY, count, formationRadius = 0.9, startAngle = -Math.PI * 0.5) => {
        const total = Math.max(1, Math.round(Number(count) || 1));
        const radius = Math.max(0, Number(formationRadius) || 0);
        if (total <= 1 || radius <= 0.001) {
          return [{ x: Number(centerX) || 0, y: Number(centerY) || 0, angle: startAngle, index: 0 }];
        }
        const positions = [];
        for (let index = 0; index < total; index += 1) {
          const angle = startAngle + (index / total) * Math.PI * 2;
          positions.push({
            x: (Number(centerX) || 0) + Math.cos(angle) * radius,
            y: (Number(centerY) || 0) + Math.sin(angle) * radius,
            angle,
            index
          });
        }
        return positions;
      };
const sharedTownLayout = globalThis.VibeTownLayout || null;
const sharedIsTownWallTile =
  sharedTownLayout && typeof sharedTownLayout.isTownWallTile === "function" ? sharedTownLayout.isTownWallTile : null;
const sharedIsTownGateTile =
  sharedTownLayout && typeof sharedTownLayout.isTownGateTile === "function" ? sharedTownLayout.isTownGateTile : null;
const sharedGetTownWallTiles =
  sharedTownLayout && typeof sharedTownLayout.getTownWallTiles === "function" ? sharedTownLayout.getTownWallTiles : null;
const sharedItemValue = globalThis.VibeItemValue || null;
const sharedGetItemCopperValue =
  sharedItemValue && typeof sharedItemValue.getItemCopperValue === "function" ? sharedItemValue.getItemCopperValue : null;
const clientAbilityNormalizationTools = sharedCreateAbilityNormalizationTools
  ? sharedCreateAbilityNormalizationTools({ defaultProjectileHitRadius: 0.6 })
  : null;
const sharedMobRenderStyle = globalThis.VibeMobRenderStyle || null;
const sharedParseMobRenderStyle =
  sharedMobRenderStyle && typeof sharedMobRenderStyle.parseMobRenderStyle === "function"
    ? sharedMobRenderStyle.parseMobRenderStyle
    : null;
const sharedHumanoidStyle = globalThis.VibeHumanoidStyle || null;
const sharedParseHumanoidRenderStyle =
  sharedHumanoidStyle && typeof sharedHumanoidStyle.parseHumanoidRenderStyle === "function"
    ? sharedHumanoidStyle.parseHumanoidRenderStyle
    : null;
const sharedNumberUtils = globalThis.VibeNumberUtils || null;
const sharedClamp =
  sharedNumberUtils && typeof sharedNumberUtils.clamp === "function" ? sharedNumberUtils.clamp : null;
const sharedVectorUtils = globalThis.VibeVectorUtils || null;
const sharedNormalizeDirection =
  sharedVectorUtils && typeof sharedVectorUtils.normalizeDirection === "function"
    ? sharedVectorUtils.normalizeDirection
    : null;
const sharedClientParticleSystem = globalThis.VibeClientParticleSystem || null;
const sharedCreateParticleSystemTools =
  sharedClientParticleSystem && typeof sharedClientParticleSystem.createParticleSystemTools === "function"
    ? sharedClientParticleSystem.createParticleSystemTools
    : null;
const protocol = globalThis.VibeProtocol || {
  ENTITY_PROTO_TYPE: 1,
  ENTITY_PROTO_VERSION: 8,
  MOB_EFFECT_PROTO_TYPE: 2,
  MOB_EFFECT_PROTO_VERSION: 1,
  AREA_EFFECT_PROTO_TYPE: 3,
  AREA_EFFECT_PROTO_VERSION: 2,
  MOB_META_PROTO_TYPE: 4,
  MOB_META_PROTO_VERSION: 2,
  PROJECTILE_META_PROTO_TYPE: 5,
  PROJECTILE_META_PROTO_VERSION: 3,
  DAMAGE_EVENT_PROTO_TYPE: 6,
  DAMAGE_EVENT_PROTO_VERSION: 2,
  PLAYER_META_PROTO_TYPE: 7,
  PLAYER_META_PROTO_VERSION: 2,
  LOOTBAG_META_PROTO_TYPE: 8,
  LOOTBAG_META_PROTO_VERSION: 1,
  PLAYER_SWING_PROTO_TYPE: 9,
  PLAYER_SWING_PROTO_VERSION: 1,
  CAST_EVENT_PROTO_TYPE: 10,
  CAST_EVENT_PROTO_VERSION: 1,
  PLAYER_EFFECT_PROTO_TYPE: 11,
  PLAYER_EFFECT_PROTO_VERSION: 2,
  MOB_BITE_PROTO_TYPE: 12,
  MOB_BITE_PROTO_VERSION: 1,
  EXPLOSION_EVENT_PROTO_TYPE: 13,
  EXPLOSION_EVENT_PROTO_VERSION: 1,
  PROJECTILE_HIT_EVENT_PROTO_TYPE: 14,
  PROJECTILE_HIT_EVENT_PROTO_VERSION: 1,
  MOB_DEATH_EVENT_PROTO_TYPE: 15,
  MOB_DEATH_EVENT_PROTO_VERSION: 1,
  CAST_EVENT_KIND_PLAYER: 0,
  CAST_EVENT_KIND_MOB: 1,
  CAST_EVENT_KIND_SELF: 2,
  CAST_EVENT_FLAG_ACTIVE: 1 << 0,
  DAMAGE_EVENT_FLAG_TARGET_PLAYER: 1 << 0,
  DAMAGE_EVENT_FLAG_FROM_SELF: 1 << 1,
  MOB_EFFECT_FLAG_STUN: 1 << 0,
  MOB_EFFECT_FLAG_SLOW: 1 << 1,
  MOB_EFFECT_FLAG_REMOVE: 1 << 2,
  MOB_EFFECT_FLAG_BURN: 1 << 3,
  MOB_EFFECT_FLAG_BLOOD_WRATH: 1 << 4,
  AREA_EFFECT_OP_UPSERT: 1,
  AREA_EFFECT_OP_REMOVE: 2,
  AREA_EFFECT_KIND_AREA: 0,
  AREA_EFFECT_KIND_BEAM: 1,
  AREA_EFFECT_KIND_SUMMON: 2,
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
  PLAYER_META_PROTO_TYPE,
  PLAYER_META_PROTO_VERSION,
  LOOTBAG_META_PROTO_TYPE,
  LOOTBAG_META_PROTO_VERSION,
  PLAYER_SWING_PROTO_TYPE,
  PLAYER_SWING_PROTO_VERSION,
  CAST_EVENT_PROTO_TYPE,
  CAST_EVENT_PROTO_VERSION,
  PLAYER_EFFECT_PROTO_TYPE,
  PLAYER_EFFECT_PROTO_VERSION,
  MOB_BITE_PROTO_TYPE,
  MOB_BITE_PROTO_VERSION,
  EXPLOSION_EVENT_PROTO_TYPE,
  EXPLOSION_EVENT_PROTO_VERSION,
  PROJECTILE_HIT_EVENT_PROTO_TYPE,
  PROJECTILE_HIT_EVENT_PROTO_VERSION,
  MOB_DEATH_EVENT_PROTO_TYPE,
  MOB_DEATH_EVENT_PROTO_VERSION,
  CAST_EVENT_KIND_PLAYER,
  CAST_EVENT_KIND_MOB,
  CAST_EVENT_KIND_SELF,
  CAST_EVENT_FLAG_ACTIVE,
  DAMAGE_EVENT_FLAG_TARGET_PLAYER,
  DAMAGE_EVENT_FLAG_FROM_SELF,
  MOB_EFFECT_FLAG_STUN,
  MOB_EFFECT_FLAG_SLOW,
  MOB_EFFECT_FLAG_REMOVE,
  MOB_EFFECT_FLAG_BURN,
  MOB_EFFECT_FLAG_BLOOD_WRATH,
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
const decodeUnitDirectionComponent =
  sharedProtocolCodecs && typeof sharedProtocolCodecs.decodeUnitDirectionComponent === "function"
    ? sharedProtocolCodecs.decodeUnitDirectionComponent
    : (value) => clamp((Number(value) || 0) / 127, -1, 1);
const hashString32 =
  sharedProtocolCodecs && typeof sharedProtocolCodecs.hashString32 === "function"
    ? sharedProtocolCodecs.hashString32
    : (value) => {
        const input = String(value || "");
        let hash = 2166136261;
        for (let index = 0; index < input.length; index += 1) {
          hash ^= input.charCodeAt(index) & 0xff;
          hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
      };

let socket = null;
let myId = null;
let lastRenderState = null;
let selfStatic = null;
let pendingJoinInfo = null;
const vfxIdState = {
  nextDamageFloatId: 1,
  nextExplosionFxId: 1
};

const gameState = {
  map: { width: 1000, height: 1000 },
  visibilityRange: 20,
  visibilityRangeX: 20,
  visibilityRangeY: 20,
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
const autoMoveTarget = {
  active: false,
  x: 0,
  y: 0,
  stopDistance: 0.1
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
const DEFAULT_LOOT_CLIENT_CONFIG = Object.freeze({
  bagPickupRange: 2.25
});
const SPATIAL_AUDIO_MISSING_RETRY_MS = 2500;
const spatialAudioConfig = {
  ...DEFAULT_SPATIAL_AUDIO_CONFIG
};
const lootClientConfig = {
  ...DEFAULT_LOOT_CLIENT_CONFIG
};
const townClientState = {
  layout: null,
  wallTiles: []
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
  targetY: 0,
  lastRetargetSentAt: 0,
  lastSentTargetX: NaN,
  lastSentTargetY: NaN,
  trackPointer: false
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
const rangerAnimRuntime = new Map();
const snapshots = [];
const floatingDamageNumbers = [];
const activeExplosions = [];
const activeAreaEffectsById = new Map();
const ambientParticleEmitters = new Map();
const actionSlotEls = new Map();
const actionBindings = new Map();
let actionBindingsClassType = null;
let suppressActionBarClickUntil = 0;
let actionBarTouchListenersBound = false;
const classDefsById = new Map();
const abilityDefsById = new Map();
const abilityIdsByHash = new Map();
const abilityRuntime = new Map();
const itemDefsById = new Map();
const iconUrlCache = new Map();
const townTileSpriteCache = new Map();
let vendorNpcSprite = null;
const dragState = {
  source: "",
  inventoryFrom: null,
  equipmentSlot: "",
  fromActionSlot: "",
  itemId: "",
  actionBinding: ""
};
const inventoryState = {
  cols: 5,
  rows: 2,
  slots: []
};
const equipmentConfigState = {
  itemSlots: [],
  itemRarities: {},
  debugBaseItems: [],
  debugPrefixes: [],
  debugSuffixes: [],
  debugRarities: [],
  maxItemLevel: 1
};
const equipmentState = {
  slots: {}
};
const DEFAULT_ITEM_RARITY_COLORS = Object.freeze({
  normal: "#b8c5d1",
  magic: "#58a6ff",
  rare: "#f3d26b",
  epic: "#be7dff",
  legendary: "#ff9747",
  mythic: "#ff5fc8",
  divine: "#fff1b5"
});
const DEFAULT_DEBUG_RARITY_RULES = Object.freeze({
  normal: Object.freeze({ prefixMin: 0, prefixMax: 0, suffixMin: 0, suffixMax: 0 }),
  magic: Object.freeze({ prefixMin: 0, prefixMax: 1, suffixMin: 1, suffixMax: 1 }),
  rare: Object.freeze({ prefixMin: 1, prefixMax: 2, suffixMin: 1, suffixMax: 2 }),
  epic: Object.freeze({ prefixMin: 2, prefixMax: 3, suffixMin: 2, suffixMax: 3 }),
  legendary: Object.freeze({ prefixMin: 3, prefixMax: 4, suffixMin: 3, suffixMax: 4 }),
  mythic: Object.freeze({ prefixMin: 4, prefixMax: 5, suffixMin: 4, suffixMax: 5 }),
  divine: Object.freeze({ prefixMin: 5, prefixMax: 6, suffixMin: 5, suffixMax: 6 })
});
const DEBUG_GEAR_FALLBACK_PREFIXES = Object.freeze([
  { id: "debug_savage", name: "Savage", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "gloves", "ring", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "damage.global.percent", rollMin: 3, rollMax: 12 }] },
  { id: "debug_emberforged", name: "Emberforged", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "damageSchool.fire.percent", rollMin: 4, rollMax: 16 }] },
  { id: "debug_frozen", name: "Frozen", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "head", "necklace"], requiredItemTagsAny: [], modifiers: [{ stat: "damageSchool.frost.percent", rollMin: 4, rollMax: 16 }] },
  { id: "debug_stormbound", name: "Stormbound", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "ring", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "damageSchool.lightning.percent", rollMin: 4, rollMax: 16 }] },
  { id: "debug_arcane", name: "Arcane", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "head", "chest", "ring", "necklace"], requiredItemTagsAny: [], modifiers: [{ stat: "damageSchool.arcane.percent", rollMin: 4, rollMax: 16 }] },
  { id: "debug_guarded", name: "Guarded", minItemLevel: 1, allowedSlots: ["head", "chest", "shoulders", "bracers", "gloves", "pants", "boots", "belt", "offHand"], requiredItemTagsAny: [], modifiers: [{ stat: "armor.percent", rollMin: 4, rollMax: 18 }] },
  { id: "debug_vigorous", name: "Vigorous", minItemLevel: 1, allowedSlots: ["head", "chest", "shoulders", "pants", "boots", "belt", "ring", "necklace"], requiredItemTagsAny: [], modifiers: [{ stat: "maxHealth.flat", rollMin: 8, rollMax: 40 }] },
  { id: "debug_mystic", name: "Mystic", minItemLevel: 1, allowedSlots: ["head", "chest", "shoulders", "pants", "boots", "belt", "ring", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "maxMana.flat", rollMin: 8, rollMax: 40 }] },
  { id: "debug_swift", name: "Swift", minItemLevel: 1, allowedSlots: ["boots", "belt", "ring", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "moveSpeed.percent", rollMin: 2, rollMax: 10 }] },
  { id: "debug_precise", name: "Precise", minItemLevel: 1, allowedSlots: ["mainHand", "gloves", "ring", "necklace"], requiredItemTagsAny: [], modifiers: [{ stat: "critChance.percent", rollMin: 2, rollMax: 9 }] }
]);
const DEBUG_GEAR_FALLBACK_SUFFIXES = Object.freeze([
  { id: "debug_of_mending", name: "of Mending", minItemLevel: 1, allowedSlots: ["head", "chest", "shoulders", "gloves", "bracers", "pants", "boots", "belt", "ring", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "healthRegen.flat", rollMin: 1, rollMax: 6 }] },
  { id: "debug_of_insight", name: "of Insight", minItemLevel: 1, allowedSlots: ["head", "chest", "ring", "necklace", "trinket", "mainHand", "offHand"], requiredItemTagsAny: [], modifiers: [{ stat: "manaRegen.flat", rollMin: 1, rollMax: 6 }] },
  { id: "debug_of_striking", name: "of Striking", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "gloves", "ring"], requiredItemTagsAny: [], modifiers: [{ stat: "damage.global.percent", rollMin: 2, rollMax: 10 }] },
  { id: "debug_of_flames", name: "of Flames", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "damageSchool.fire.percent", rollMin: 3, rollMax: 14 }] },
  { id: "debug_of_the_glacier", name: "of the Glacier", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "damageSchool.frost.percent", rollMin: 3, rollMax: 14 }] },
  { id: "debug_of_storms", name: "of Storms", minItemLevel: 1, allowedSlots: ["mainHand", "offHand", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "damageSchool.lightning.percent", rollMin: 3, rollMax: 14 }] },
  { id: "debug_of_the_fox", name: "of the Fox", minItemLevel: 1, allowedSlots: ["boots", "belt", "pants", "gloves", "ring"], requiredItemTagsAny: [], modifiers: [{ stat: "moveSpeed.percent", rollMin: 2, rollMax: 8 }] },
  { id: "debug_of_the_barricade", name: "of the Barricade", minItemLevel: 1, allowedSlots: ["head", "chest", "shoulders", "bracers", "gloves", "pants", "boots", "belt", "offHand"], requiredItemTagsAny: [], modifiers: [{ stat: "blockChance.percent", rollMin: 1, rollMax: 6 }] },
  { id: "debug_of_echoes", name: "of Echoes", minItemLevel: 1, allowedSlots: ["mainHand", "ring", "necklace", "trinket"], requiredItemTagsAny: [], modifiers: [{ stat: "castSpeed.percent", rollMin: 2, rollMax: 10 }] },
  { id: "debug_of_haste", name: "of Haste", minItemLevel: 1, allowedSlots: ["mainHand", "gloves", "ring", "necklace"], requiredItemTagsAny: [], modifiers: [{ stat: "attackSpeed.percent", rollMin: 2, rollMax: 10 }] }
]);
const EQUIPMENT_SLOT_LAYOUT = Object.freeze({
  head: { x: 50, y: 6, label: "Helm" },
  shoulders: { x: 10, y: 16, label: "Shoulder" },
  necklace: { x: 90, y: 16, label: "Amulet" },
  chest: { x: 50, y: 34, label: "Chest" },
  gloves: { x: 10, y: 38, label: "Gloves" },
  bracers: { x: 90, y: 38, label: "Bracer" },
  belt: { x: 50, y: 52, label: "Belt", kind: "belt" },
  ring1: { x: 10, y: 57, label: "Ring 1" },
  ring2: { x: 90, y: 57, label: "Ring 2" },
  mainHand: { x: 10, y: 76, label: "Main Hand" },
  offHand: { x: 90, y: 76, label: "Off Hand" },
  pants: { x: 50, y: 73, label: "Pants" },
  trinket1: { x: 10, y: 92, label: "Trinket 1" },
  trinket2: { x: 90, y: 92, label: "Trinket 2" },
  boots: { x: 50, y: 92, label: "Boots" }
});
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const hoverTooltipEl = document.createElement("div");
hoverTooltipEl.id = "hover-tooltip";
hoverTooltipEl.className = "hidden";
document.body.appendChild(hoverTooltipEl);
const debugState = {
  enabled: false,
  upEvents: [],
  downEvents: [],
  upBytesWindow: 0,
  downBytesWindow: 0,
  frameSamples: [],
  totalMobCount: 0
};
const dpsState = {
  enabled: false,
  selectedWindowSec: 60,
  samples: []
};
const adminBotState = {
  bots: [],
  inspectBot: null,
  selectedBotId: "",
  panelVisible: false,
  contextBotId: "",
  lastListRequestAt: 0
};
const vendorInteractionState = {
  active: false,
  npcId: "",
  x: 0,
  y: 0,
  nextAttemptAt: 0,
  panelOpen: false
};
const touchJoystickState = {
  active: false,
  touchId: null,
  originX: 0,
  originY: 0,
  currentX: 0,
  currentY: 0,
  vectorDx: 0,
  vectorDy: 0,
  radiusPx: 68,
  deadzonePx: 10
};
const mobileAbilityAimState = {
  active: false,
  touchId: null,
  slotId: "",
  abilityId: "",
  currentClientX: 0,
  currentClientY: 0,
  startClientX: 0,
  startClientY: 0,
  targetX: 0,
  targetY: 0,
  snappedTargetId: null,
  snappedTargetKind: "",
  radiusPx: 128,
  deadzonePx: 14
};
const debugGearState = {
  visible: false,
  slotStates: {},
  previewClassType: "warrior"
};
const selfNegativeEffects = {
  stun: null,
  slow: null,
  burn: null
};
const selfPositiveEffects = {
  bloodWrath: null
};
let selfPositiveBuffs = [];
const remotePlayerStuns = new Map();
const remotePlayerSlows = new Map();
const remotePlayerBurns = new Map();
const remotePlayerBloodWraths = new Map();
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
const lootPickupState = {
  active: false,
  bagId: "",
  x: 0,
  y: 0,
  nextAttemptAt: 0
};
const mobilePanelState = {
  open: false,
  activeTab: "inventory",
  tooltipHideTimer: 0,
  lootHoldTimer: 0,
  lootHoldTriggered: false,
  suppressLootClickUntil: 0
};
const LOOT_BAG_SPARKLE_PARTICLE_CONFIG = Object.freeze({
  maxParticles: 10,
  spawnRate: 6.4,
  burstCount: 6,
  idleTimeoutMs: 1600,
  spawnBox: Object.freeze({
    minX: -0.18,
    maxX: 0.18,
    minY: -0.48,
    maxY: -0.14
  }),
  velocity: Object.freeze({
    minX: -0.018,
    maxX: 0.018,
    minY: -0.16,
    maxY: -0.05
  }),
  acceleration: Object.freeze({
    minX: 0,
    maxX: 0,
    minY: 0.025,
    maxY: 0.07
  }),
  lifeMs: Object.freeze([800, 1400]),
  sizePx: Object.freeze([3.1, 7.2]),
  alpha: Object.freeze([0.62, 1]),
  twinkle: Object.freeze([0.75, 1.3]),
  rotation: Object.freeze([0, Math.PI * 2]),
  spin: Object.freeze([-1.15, 1.15]),
  phase: Object.freeze([0, Math.PI * 2]),
  shapes: Object.freeze(["sparkle", "sparkle", "sparkle", "sparkle", "dot"]),
  colors: Object.freeze(["#fff8dc", "#ffefbb", "#ffd978"]),
  glowColors: Object.freeze([
    "rgba(255, 247, 218, 0.52)",
    "rgba(255, 226, 144, 0.44)",
    "rgba(255, 210, 110, 0.38)"
  ])
});
const lootBagSpriteCache = new Map();

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

function normalizeHumanoidRenderStyle(rawStyle) {
  if (sharedParseHumanoidRenderStyle) {
    return sharedParseHumanoidRenderStyle(rawStyle);
  }
  if (!rawStyle || typeof rawStyle !== "object") {
    return null;
  }

  const style = {};
  const stringFields = ["rigType", "species", "archetype", "spriteType", "attackVisual"];
  for (const field of stringFields) {
    const value = String(rawStyle[field] || "").trim().toLowerCase();
    if (value) {
      style[field] = value.slice(0, 32);
    }
  }

  const numericFields = [
    ["sizeScale", 0.5, 3],
    ["walkCycleSpeed", 0.1, 10],
    ["idleCycleSpeed", 0, 10],
    ["moveThreshold", 0, 2],
    ["attackAnimSpeed", 0.1, 4]
  ];
  for (const [field, min, max] of numericFields) {
    const n = Number(rawStyle[field]);
    if (Number.isFinite(n)) {
      style[field] = clamp(n, min, max);
    }
  }

  const defaults = {};
  const rawDefaults = rawStyle.defaults && typeof rawStyle.defaults === "object" ? rawStyle.defaults : null;
  if (rawDefaults) {
    for (const key of ["head", "chest", "shoulders", "gloves", "bracers", "belt", "pants", "boots", "mainHand", "offHand"]) {
      const value = String(rawDefaults[key] || "").trim().toLowerCase();
      if (value) {
        defaults[key] = value.slice(0, 32);
      }
    }
  }
  if (Object.keys(defaults).length) {
    style.defaults = defaults;
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
    if (Object.keys(palette).length) {
      style.palette = palette;
    }
  }

  return Object.keys(style).length ? style : null;
}

function getClassRenderStyle(classType) {
  const classDef = classDefsById.get(String(classType || "").trim());
  return classDef && classDef.renderStyle && typeof classDef.renderStyle === "object" ? classDef.renderStyle : null;
}

function getPlayerVisualEquipment(player, isSelf) {
  if (isSelf) {
    return equipmentState.slots && typeof equipmentState.slots === "object" ? equipmentState.slots : {};
  }
  const meta = entityRuntime.playerMeta.get(Number(player && player.id));
  if (meta && meta.appearance && typeof meta.appearance === "object") {
    return meta.appearance;
  }
  return player && player.appearance && typeof player.appearance === "object" ? player.appearance : {};
}

const sharedClientRenderHumanoids = globalThis.VibeClientRenderHumanoids || null;
const sharedCreateHumanoidRenderTools =
  sharedClientRenderHumanoids && typeof sharedClientRenderHumanoids.createHumanoidRenderTools === "function"
    ? sharedClientRenderHumanoids.createHumanoidRenderTools
    : null;
const humanoidRenderTools = sharedCreateHumanoidRenderTools
  ? sharedCreateHumanoidRenderTools({
      ctx,
      clamp,
      lerp,
      hashString,
      sanitizeCssColor
    })
  : null;

const sharedClientRenderMobs = globalThis.VibeClientRenderMobs || null;
const sharedCreateMobRenderTools =
  sharedClientRenderMobs && typeof sharedClientRenderMobs.createMobRenderTools === "function"
    ? sharedClientRenderMobs.createMobRenderTools
    : null;
const mobRenderTools = sharedCreateMobRenderTools
  ? sharedCreateMobRenderTools({
      clamp,
      ctx,
      mouseState,
      entityRuntime,
      mobSpriteCache,
      MOB_SPRITE_SIZE,
      sanitizeCssColor,
      drawRoundedRect,
      worldToScreen,
      getZombieWalkSprite,
      getCreeperWalkSprite,
      getSpiderWalkSprite,
      getOrcWalkSprite,
      getSkeletonWalkSprite,
      getSkeletonArcherWalkSprite,
      humanoidRenderTools,
      remoteMobCasts,
      getCastProgress,
      getCurrentSelf
    })
  : null;
const sharedClientRenderPlayers = globalThis.VibeClientRenderPlayers || null;
const sharedCreatePlayerRenderTools =
  sharedClientRenderPlayers && typeof sharedClientRenderPlayers.createPlayerRenderTools === "function"
    ? sharedClientRenderPlayers.createPlayerRenderTools
    : null;
const playerRenderTools = sharedCreatePlayerRenderTools
  ? sharedCreatePlayerRenderTools({
      ctx,
      clamp,
      lerp,
      hashString,
      worldToScreen,
      abilityChannel,
      remotePlayerCasts,
      getCastProgress,
      selfNegativeEffects,
      selfPositiveEffects,
      remotePlayerStuns,
      remotePlayerSlows,
      remotePlayerBurns,
      remotePlayerBloodWraths,
      swordSwing,
      remotePlayerSwings,
      warriorAnimRuntime,
      rangerAnimRuntime,
      humanoidRenderTools,
      getClassRenderStyle,
      getPlayerVisualEquipment,
      mouseState,
      screenToWorld,
      getCurrentSelf
    })
  : null;
const sharedClientRenderProjectiles = globalThis.VibeClientRenderProjectiles || null;
const sharedCreateProjectileRenderTools =
  sharedClientRenderProjectiles && typeof sharedClientRenderProjectiles.createProjectileRenderTools === "function"
    ? sharedClientRenderProjectiles.createProjectileRenderTools
    : null;
const projectileRenderTools = sharedCreateProjectileRenderTools
  ? sharedCreateProjectileRenderTools({
      ctx,
      seededUnit,
      hashString,
      normalizeDirection,
      projectileVisualRuntime,
      worldToScreen,
      getActionDefById,
      getAbilityVisualHook
    })
  : null;
const sharedClientUiPresentation = globalThis.VibeClientUiPresentation || null;
const sharedCreateUiPresentationTools =
  sharedClientUiPresentation && typeof sharedClientUiPresentation.createUiPresentationTools === "function"
    ? sharedClientUiPresentation.createUiPresentationTools
    : null;
const uiPresentationTools = sharedCreateUiPresentationTools
  ? sharedCreateUiPresentationTools({
      ctx,
      canvas,
      clamp,
      drawRoundedRect,
      mobRenderRadius: MOB_RENDER_RADIUS,
      itemDefsById
    })
  : null;

function detectMobSpriteTypeFromName(name) {
  if (!mobRenderTools) {
    return "basic";
  }
  return mobRenderTools.detectMobSpriteTypeFromName(name);
}

function getMobRenderStyle(mob) {
  if (!mobRenderTools) {
    return null;
  }
  return mobRenderTools.getMobRenderStyle(mob);
}

function getMobSpriteType(mob) {
  if (!mobRenderTools) {
    return "basic";
  }
  return mobRenderTools.getMobSpriteType(mob);
}

function getMobAttackVisualType(mob) {
  if (!mobRenderTools) {
    return "bite";
  }
  return mobRenderTools.getMobAttackVisualType(mob);
}

function getMobStyleNumber(style, key, fallback, min, max) {
  if (!mobRenderTools) {
    return fallback;
  }
  return mobRenderTools.getMobStyleNumber(style, key, fallback, min, max);
}

function getMobStyleCacheKey(style) {
  if (!mobRenderTools) {
    return "";
  }
  return mobRenderTools.getMobStyleCacheKey(style);
}

function applyMobPaletteOverrides(basePalette, style) {
  if (!mobRenderTools) {
    return { ...(basePalette || {}) };
  }
  return mobRenderTools.applyMobPaletteOverrides(basePalette, style);
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

function populateAdminBotClassOptions(preferredClassType = "") {
  if (!debugBotClassSelect) {
    return;
  }
  const previousValue = String(preferredClassType || debugBotClassSelect.value || "").trim();
  debugBotClassSelect.innerHTML = "";
  for (const classDef of classDefsById.values()) {
    const option = document.createElement("option");
    option.value = classDef.id;
    option.textContent = classDef.name;
    debugBotClassSelect.appendChild(option);
  }
  if (previousValue && classDefsById.has(previousValue)) {
    debugBotClassSelect.value = previousValue;
  } else if (selfStatic && selfStatic.classType && classDefsById.has(selfStatic.classType)) {
    debugBotClassSelect.value = selfStatic.classType;
  } else if (debugBotClassSelect.options.length) {
    debugBotClassSelect.value = debugBotClassSelect.options[0].value;
  }
}

function updateAdminDebugControls() {
  if (!debugAdminControls) {
    return;
  }
  const isAdmin = !!(selfStatic && selfStatic.isAdmin);
  debugAdminControls.classList.toggle("hidden", !isAdmin);
  if (isAdmin) {
    populateAdminBotClassOptions();
  }
  if (!isAdmin) {
    setBotListVisible(false);
    setDebugGearVisible(false);
  }
  if (debugToggleBotListButton) {
    debugToggleBotListButton.classList.toggle("hidden", !isAdmin);
  }
  if (debugToggleGearLabButton) {
    debugToggleGearLabButton.classList.toggle("hidden", !isAdmin);
  }
}

function updateRendererDebugControls() {
  if (!debugRendererSelect) {
    return;
  }
  const mode = rendererBootstrap ? rendererBootstrap.getRendererMode() : "canvas";
  debugRendererSelect.value = mode === "pixi" ? "pixi" : "canvas";
}

function applyRendererModeFromDebugControls() {
  if (!debugRendererSelect || !rendererBootstrap) {
    return;
  }
  rendererBootstrap.setRendererMode(debugRendererSelect.value);
  updateRendererDebugControls();
}

function handleCreateBotPlayer() {
  if (!selfStatic || !selfStatic.isAdmin || !debugBotClassSelect) {
    return;
  }
  const classType = String(debugBotClassSelect.value || "").trim() || getDefaultClassId();
  if (!classType) {
    setStatus("No class available for bot creation.");
    return;
  }
  sendJsonMessage({
    type: "create_bot_player",
    classType
  });
}

function getAbilityDisplayName(abilityId) {
  const id = String(abilityId || "").trim();
  if (!id) {
    return "";
  }
  const abilityDef = abilityDefsById.get(id);
  return abilityDef ? String(abilityDef.name || id) : humanizeKey(id);
}

function hideBotContextMenu() {
  if (!botContextMenu) {
    return;
  }
  botContextMenu.classList.add("hidden");
  botContextMenu.innerHTML = "";
  adminBotState.contextBotId = "";
}

function createBotInspectItemNode(item, prefixText = "", suffixText = "") {
  const itemData = item && typeof item === "object" ? item : null;
  const line = document.createElement("div");
  line.className = "bot-detail-line";
  if (!itemData) {
    line.textContent = `${prefixText}${suffixText}`.trim();
    return line;
  }

  const wrapper = document.createElement("span");
  wrapper.className = "bot-detail-item";
  applyItemRarityChrome(wrapper, itemData);

  const iconShell = document.createElement("span");
  iconShell.className = "bot-detail-item-icon";
  applyItemRarityChrome(iconShell, itemData);
  const icon = document.createElement("span");
  icon.className = "inv-icon";
  icon.style.backgroundImage = `url(${getItemIconUrl(itemData)})`;
  iconShell.appendChild(icon);

  const label = document.createElement("span");
  label.className = "bot-detail-item-label";
  const qtyText = Math.max(0, Math.floor(Number(itemData.qty) || 0)) > 1 ? ` x${Math.floor(Number(itemData.qty) || 0)}` : "";
  label.textContent = `${prefixText}${itemData.name || itemData.itemId || "Unknown item"}${qtyText}${suffixText}`;

  wrapper.appendChild(iconShell);
  wrapper.appendChild(label);
  line.appendChild(wrapper);
  bindItemTooltip(wrapper, itemData);
  return line;
}

function renderBotInspectDetails() {
  if (!botInspectDetails) {
    return;
  }
  const bot = adminBotState.inspectBot;
  botInspectDetails.innerHTML = "";
  if (!bot) {
    const empty = document.createElement("div");
    empty.className = "bot-inspect-empty";
    empty.textContent = "Select or inspect a bot to see its inventory, equipment, and skill assignment.";
    botInspectDetails.appendChild(empty);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "bot-detail-block";
  const summaryTitle = document.createElement("div");
  summaryTitle.className = "bot-detail-title";
  summaryTitle.textContent = "Overview";
  summary.appendChild(summaryTitle);
  const summaryLines = [
    `${bot.name} | ${humanizeKey(bot.classType)} | Lvl ${bot.level}`,
    `HP ${Math.floor(bot.hp)}/${Math.floor(bot.maxHp)} | Copper ${Math.floor(bot.copper || 0)}`,
    `EXP ${Math.floor(bot.exp || 0)}/${Math.floor(bot.expToNext || 0)} | Skill Points ${Math.floor(bot.skillPoints || 0)}`,
    bot.followTargetName
      ? `Following ${bot.followTargetName} at ${Number(bot.followDistance || 0).toFixed(1)} tiles`
      : "Not following a player"
  ];
  for (const text of summaryLines) {
    const line = document.createElement("div");
    line.className = "bot-detail-line";
    line.textContent = text;
    summary.appendChild(line);
  }
  botInspectDetails.appendChild(summary);

  const abilityBlock = document.createElement("div");
  abilityBlock.className = "bot-detail-block";
  const abilityTitle = document.createElement("div");
  abilityTitle.className = "bot-detail-title";
  abilityTitle.textContent = "Abilities";
  abilityBlock.appendChild(abilityTitle);
  const abilities = Array.isArray(bot.abilityLevels) ? bot.abilityLevels : [];
  if (!abilities.length) {
    const line = document.createElement("div");
    line.className = "bot-detail-line";
    line.textContent = "No abilities assigned.";
    abilityBlock.appendChild(line);
  } else {
    for (const entry of abilities) {
      const line = document.createElement("div");
      line.className = "bot-detail-line";
      line.textContent = `${getAbilityDisplayName(entry.id)}: level ${Math.max(1, Math.floor(Number(entry.level) || 1))}`;
      abilityBlock.appendChild(line);
    }
  }
  botInspectDetails.appendChild(abilityBlock);

  const equipmentBlock = document.createElement("div");
  equipmentBlock.className = "bot-detail-block";
  const equipmentTitle = document.createElement("div");
  equipmentTitle.className = "bot-detail-title";
  equipmentTitle.textContent = "Equipment";
  equipmentBlock.appendChild(equipmentTitle);
  const equippedItems = Array.isArray(bot.equipment) ? bot.equipment : [];
  if (!equippedItems.length) {
    const line = document.createElement("div");
    line.className = "bot-detail-line";
    line.textContent = "No items equipped.";
    equipmentBlock.appendChild(line);
  } else {
    for (const entry of equippedItems) {
      const item = entry.item || {};
      const line = createBotInspectItemNode(item, `${humanizeKey(entry.slotId)}: `);
      equipmentBlock.appendChild(line);
    }
  }
  botInspectDetails.appendChild(equipmentBlock);

  const inventoryBlock = document.createElement("div");
  inventoryBlock.className = "bot-detail-block";
  const inventoryTitle = document.createElement("div");
  inventoryTitle.className = "bot-detail-title";
  inventoryTitle.textContent = "Inventory";
  inventoryBlock.appendChild(inventoryTitle);
  const inventoryItems = Array.isArray(bot.inventory) ? bot.inventory : [];
  if (!inventoryItems.length) {
    const line = document.createElement("div");
    line.className = "bot-detail-line";
    line.textContent = "Inventory is empty.";
    inventoryBlock.appendChild(line);
  } else {
    for (const entry of inventoryItems) {
      const levelText = Number(entry.itemLevel) > 0 ? ` (ilvl ${Math.floor(Number(entry.itemLevel) || 0)})` : "";
      const line = createBotInspectItemNode(entry, "", levelText);
      inventoryBlock.appendChild(line);
    }
  }
  botInspectDetails.appendChild(inventoryBlock);
}

function showBotContextMenu(clientX, clientY, botId) {
  if (!botContextMenu) {
    return;
  }
  const bot = adminBotState.bots.find((entry) => String(entry.id || "") === String(botId || ""));
  if (!bot) {
    hideBotContextMenu();
    return;
  }
  adminBotState.contextBotId = String(bot.id || "");
  botContextMenu.innerHTML = "";
  const actions = [
    {
      label: "Inspect",
      handler: () => {
        requestAdminBotInspect(bot.id);
      }
    },
    {
      label: "Destroy Bot",
      handler: () => {
        sendJsonMessage({
          type: "admin_destroy_bot",
          botId: bot.id
        });
      }
    },
    {
      label: "Follow 3 Tiles",
      handler: () => {
        sendJsonMessage({
          type: "admin_command_bot_follow",
          botId: bot.id,
          range: 3
        });
      }
    },
    {
      label: "Follow 4 Tiles",
      handler: () => {
        sendJsonMessage({
          type: "admin_command_bot_follow",
          botId: bot.id,
          range: 4
        });
      }
    },
    {
      label: "Stop Following",
      handler: () => {
        sendJsonMessage({
          type: "admin_command_bot_follow",
          botId: bot.id,
          range: 0
        });
      }
    }
  ];
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bot-context-button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      action.handler();
      hideBotContextMenu();
    });
    botContextMenu.appendChild(button);
  }
  botContextMenu.style.left = `${Math.max(8, Math.floor(clientX))}px`;
  botContextMenu.style.top = `${Math.max(8, Math.floor(clientY))}px`;
  botContextMenu.classList.remove("hidden");
}

function renderAdminBotList() {
  if (!botListEntries) {
    return;
  }
  botListEntries.innerHTML = "";
  if (!adminBotState.bots.length) {
    const empty = document.createElement("div");
    empty.className = "bot-inspect-empty";
    empty.textContent = "No active bots.";
    botListEntries.appendChild(empty);
    renderBotInspectDetails();
    return;
  }
  for (const bot of adminBotState.bots) {
    const entry = document.createElement("div");
    entry.className = "bot-list-entry";
    if (String(adminBotState.selectedBotId || "") === String(bot.id || "")) {
      entry.classList.add("active");
    }
    const title = document.createElement("div");
    title.className = "bot-entry-title";
    title.textContent = bot.name;
    const meta = document.createElement("div");
    meta.className = "bot-entry-meta";
    meta.textContent = `${humanizeKey(bot.classType)} | Lvl ${bot.level}${
      bot.followTargetName ? ` | Following ${bot.followTargetName} (${Number(bot.followDistance || 0).toFixed(1)})` : ""
    }`;
    entry.appendChild(title);
    entry.appendChild(meta);
    entry.addEventListener("click", () => {
      requestAdminBotInspect(bot.id);
    });
    entry.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      adminBotState.selectedBotId = String(bot.id || "");
      renderAdminBotList();
      showBotContextMenu(event.clientX, event.clientY, bot.id);
    });
    botListEntries.appendChild(entry);
  }
  renderBotInspectDetails();
}

function requestAdminBotList(force = false) {
  if (!selfStatic || !selfStatic.isAdmin || !adminBotState.panelVisible) {
    return false;
  }
  const now = performance.now();
  if (!force && now - Number(adminBotState.lastListRequestAt || 0) < 800) {
    return false;
  }
  adminBotState.lastListRequestAt = now;
  return sendJsonMessage({ type: "admin_list_bots" });
}

function requestAdminBotInspect(botId) {
  const normalizedBotId = String(botId || "").trim();
  if (!normalizedBotId || !selfStatic || !selfStatic.isAdmin) {
    return false;
  }
  adminBotState.selectedBotId = normalizedBotId;
  renderAdminBotList();
  return sendJsonMessage({
    type: "admin_inspect_bot",
    botId: normalizedBotId
  });
}

function setBotListVisible(visible) {
  adminBotState.panelVisible = !!visible;
  if (botListPanel) {
    botListPanel.classList.toggle("hidden", !adminBotState.panelVisible);
  }
  if (!adminBotState.panelVisible) {
    hideBotContextMenu();
    return;
  }
  requestAdminBotList(true);
}

function toggleBotListPanel() {
  setBotListVisible(!adminBotState.panelVisible);
}

function clearDragState() {
  dragState.source = "";
  dragState.inventoryFrom = null;
  dragState.equipmentSlot = "";
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

function registerStaticAbilityHashMappings() {
  const byId = abilityVisualRegistry && abilityVisualRegistry.byId ? abilityVisualRegistry.byId : {};
  for (const key of Object.keys(byId)) {
    const id = toAbilityVisualKey(key);
    if (!id) {
      continue;
    }
    const hash = hashString32(id);
    if (!abilityIdsByHash.has(hash)) {
      abilityIdsByHash.set(hash, id);
    }
  }
}

registerStaticAbilityHashMappings();

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
      getDefaultClassAbilityIds,
      getCurrentSelf,
      screenToWorld,
      sendUseItem,
      sendPickupBag,
      useAbilityAt,
      getActionDefById,
      getAbilityEffectiveCooldownMsForSelf,
      getCastProgress,
      resetAbilityChanneling,
      isTouchJoystickEnabled
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
      url: "",
      source: null,
      gainNode: null,
      status: "idle",
      playing: false,
      lastPlayedAt: 0,
      missingAt: 0,
      loadPromise: null
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

function getAbilityAudioBaseGain(eventType) {
  if (eventType === "channel") {
    return 0.44;
  }
  if (eventType === "cast") {
    return 0.54;
  }
  if (eventType === "hit") {
    return 0.58;
  }
  return 0.5;
}

function applyGameplayClientConfig(payload) {
  const gameplay = payload && typeof payload === "object" ? payload : {};
  const audio = gameplay.audio && typeof gameplay.audio === "object" ? gameplay.audio : {};
  const loot = gameplay.loot && typeof gameplay.loot === "object" ? gameplay.loot : {};
  const town = gameplay.town && typeof gameplay.town === "object" ? gameplay.town : null;
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
  lootClientConfig.bagPickupRange = clamp(
    Number(loot.bagPickupRange) || DEFAULT_LOOT_CLIENT_CONFIG.bagPickupRange,
    0.1,
    50
  );
  townClientState.layout = town ? { ...town, vendor: town.vendor ? { ...town.vendor } : null } : null;
  townClientState.wallTiles =
    townClientState.layout && sharedGetTownWallTiles ? sharedGetTownWallTiles(townClientState.layout) : [];
  updateVendorPanelUI();
}

function getTownVendor() {
  return townClientState.layout && townClientState.layout.vendor ? townClientState.layout.vendor : null;
}

function isTownWallTileAt(tileX, tileY) {
  if (!townClientState.layout || !sharedIsTownWallTile) {
    return false;
  }
  return sharedIsTownWallTile(townClientState.layout, tileX, tileY);
}

function isTownGateTileAt(tileX, tileY) {
  if (!townClientState.layout || !sharedIsTownGateTile) {
    return false;
  }
  return sharedIsTownGateTile(townClientState.layout, tileX, tileY);
}

function getItemCopperValueClient(itemInput) {
  if (!sharedGetItemCopperValue) {
    return 0;
  }
  const itemData = itemInput && typeof itemInput === "object" ? itemInput : null;
  const itemId = itemData ? String(itemData.itemId || "") : String(itemInput || "");
  const itemDef = itemDefsById.get(itemId) || null;
  return Math.max(
    0,
    Math.round(
      sharedGetItemCopperValue(itemData || { itemId, qty: 1 }, {
        itemDef,
        itemRarities: equipmentConfigState.itemRarities || {}
      })
    )
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
  state.url = audioUrl;
  state.status = "loading";
  state.playing = false;
  state.loadPromise = loadSpatialAudioBuffer(audioUrl)
    .then((buffer) => {
      if (buffer) {
        state.status = "ready";
        state.missingAt = 0;
        return buffer;
      }
      state.status = "missing";
      state.playing = false;
      state.missingAt = performance.now();
      return null;
    })
    .catch(() => {
      state.status = "missing";
      state.playing = false;
      state.missingAt = performance.now();
      return null;
    })
    .finally(() => {
      state.loadPromise = null;
    });
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
  if (!state || state.status === "missing" || !state.url) {
    return;
  }

  const minIntervalMs = getAbilityAudioMinIntervalMs(eventType);
  if (minIntervalMs > 0 && now - Number(state.lastPlayedAt || 0) < minIntervalMs) {
    return;
  }
  state.lastPlayedAt = now;

  resumeSpatialAudioContext();
  const context = ensureSpatialAudioContext();
  if (!context || !spatialAudioState.masterGain) {
    return;
  }
  const record = getSpatialAudioBufferRecord(state.url, false);
  const buffer = record && record.buffer;
  if (!buffer) {
    return;
  }
  const baseGain = getAbilityAudioBaseGain(eventType);

  if (eventType === "channel") {
    if (state.playing) {
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gainNode = context.createGain();
    gainNode.gain.value = baseGain;
    source.connect(gainNode);
    gainNode.connect(spatialAudioState.masterGain);
    state.playing = true;
    state.source = source;
    state.gainNode = gainNode;
    source.onended = () => {
      if (state.source === source) {
        state.source = null;
        state.gainNode = null;
        state.playing = false;
      }
    };
    try {
      source.start();
    } catch (_error) {
      state.source = null;
      state.gainNode = null;
      state.playing = false;
    }
    return;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = false;
  const gainNode = context.createGain();
  gainNode.gain.value = baseGain;
  source.connect(gainNode);
  gainNode.connect(spatialAudioState.masterGain);
  try {
    source.start();
  } catch (_error) {
    // Ignore aborted starts.
  }
}

function stopAbilityChannelAudio(abilityId) {
  const normalizedAbilityId = toAbilityAudioId(abilityId);
  const state = getAbilityAudioState(normalizedAbilityId, "channel", false);
  if (!state || !state.source) {
    return;
  }
  try {
    state.source.stop();
  } catch (_error) {
    // Ignore stop race conditions.
  }
  try {
    state.source.disconnect();
  } catch (_error) {
    // Ignore disconnect race conditions.
  }
  if (state.gainNode) {
    try {
      state.gainNode.disconnect();
    } catch (_error) {
      // Ignore disconnect race conditions.
    }
  }
  state.source = null;
  state.gainNode = null;
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
      sendCastTargetUpdate,
      getAbilityEffectiveCooldownMsForSelf,
      getAbilityEffectiveRangeForSelf,
      resolveAbilityUseTarget,
      mouseState,
      screenToWorld,
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

function toLowerWord(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getItemRarityColor(rarityId) {
  const key = String(rarityId || "").trim().toLowerCase();
  const configColor = equipmentConfigState.itemRarities[key] && equipmentConfigState.itemRarities[key].color;
  return sanitizeCssColor(configColor) || DEFAULT_ITEM_RARITY_COLORS[key] || DEFAULT_ITEM_RARITY_COLORS.normal;
}

function hexToRgba(hex, alpha = 1) {
  const raw = String(hex || "").trim().replace("#", "");
  if (!(raw.length === 3 || raw.length === 6)) {
    return `rgba(184, 197, 209, ${clamp(alpha, 0, 1)})`;
  }
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
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

function formatTooltipNumber(value, fallbackDecimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "0";
  }
  if (Math.abs(n - Math.round(n)) < 0.001) {
    return String(Math.round(n));
  }
  return n.toFixed(fallbackDecimals);
}

function normalizeAffixModifierEntries(modifiers) {
  if (Array.isArray(modifiers)) {
    return modifiers
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const stat = String(entry.stat || entry.key || "").trim();
        if (!stat) {
          return null;
        }
        const rawValue =
          entry.value !== undefined
            ? entry.value
            : entry.amount !== undefined
              ? entry.amount
              : entry.roll !== undefined
                ? entry.roll
                : null;
        const value = Number(rawValue);
        if (!Number.isFinite(value) || value === 0) {
          return null;
        }
        return { stat, value };
      })
      .filter(Boolean);
  }

  if (!modifiers || typeof modifiers !== "object") {
    return [];
  }

  const entries = [];
  for (const [stat, rawValue] of Object.entries(modifiers)) {
    const value = Number(rawValue);
    if (!stat || !Number.isFinite(value) || value === 0) {
      continue;
    }
    entries.push({ stat, value });
  }
  return entries;
}

function humanizeModifierStat(statPath) {
  const stat = String(statPath || "").trim();
  if (!stat) {
    return "Modifier";
  }
  const lower = stat.toLowerCase();
  const damageSchoolMatch = lower.match(/^damageschool\.([a-z0-9_]+)\.percent$/);
  if (damageSchoolMatch) {
    return `${toTitleCaseWords(damageSchoolMatch[1].replace(/[_-]+/g, " "))} Damage`;
  }
  const spellTagMatch = lower.match(/^spelltag\.([a-z0-9_]+)\.damagepercent$/);
  if (spellTagMatch) {
    return `${toTitleCaseWords(spellTagMatch[1].replace(/[_-]+/g, " "))} Ability Damage`;
  }
  if (lower === "damage.global.percent") {
    return "Global Damage";
  }
  const cleaned = stat
    .replace(/\.percent$/i, "")
    .replace(/\.flat(min|max)?$/i, "")
    .replace(/\.damagepercent$/i, "")
    .replace(/\./g, " ");
  return humanizeKey(cleaned);
}

function formatAffixModifier(modifier) {
  if (!modifier || typeof modifier !== "object") {
    return "";
  }
  const stat = String(modifier.stat || "").trim();
  if (!stat) {
    return "";
  }
  const value = Number(modifier.value);
  if (!Number.isFinite(value) || value === 0) {
    return "";
  }
  const sign = value > 0 ? "+" : "-";
  const absValue = Math.abs(value);
  const isPercent = /\.percent$/i.test(stat) || /\.damagepercent$/i.test(stat);
  const valueText = `${sign}${formatTooltipNumber(absValue)}${isPercent ? "%" : ""}`;
  return `${valueText} ${humanizeModifierStat(stat)}`;
}

function getItemInstanceAffixes(itemData) {
  if (!itemData || typeof itemData !== "object") {
    return [];
  }
  const result = [];
  const seen = new Set();
  const pushAffixArray = (list) => {
    for (const affix of Array.isArray(list) ? list : []) {
      if (!affix || typeof affix !== "object") {
        continue;
      }
      const name = String(affix.name || affix.id || "").trim();
      const modifiers = normalizeAffixModifierEntries(affix.modifiers || affix.stats || affix.values);
      if (!name && !modifiers.length) {
        continue;
      }
      const key = `${String(affix.id || name)}|${JSON.stringify(modifiers)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({
        name,
        modifiers
      });
    }
  };

  if (Array.isArray(itemData.affixes) && itemData.affixes.length) {
    pushAffixArray(itemData.affixes);
  } else {
    pushAffixArray(itemData.prefixes);
    pushAffixArray(itemData.suffixes);
  }
  return result;
}

function getItemAffixThemes(itemData) {
  const affixes = getItemInstanceAffixes(itemData);
  const themes = [];
  const seen = new Set();
  const pushTheme = (theme) => {
    if (!theme || seen.has(theme)) {
      return;
    }
    seen.add(theme);
    themes.push(theme);
  };

  for (const affix of affixes) {
    for (const modifier of affix.modifiers) {
      const stat = String(modifier.stat || "").toLowerCase();
      if (!stat) {
        continue;
      }
      if (stat.includes("lightning")) {
        pushTheme("lightning");
      } else if (stat.includes("fire")) {
        pushTheme("fire");
      } else if (stat.includes("poison")) {
        pushTheme("poison");
      } else if (stat.includes("frost")) {
        pushTheme("frost");
      } else if (stat.includes("arcane")) {
        pushTheme("arcane");
      } else if (stat.includes("physical")) {
        pushTheme("physical");
      } else if (stat.includes("bow") || stat.includes("projectile") || stat.includes("piercing")) {
        pushTheme("precision");
      } else if (stat.includes("grenade") || stat.includes("explosive")) {
        pushTheme("fire");
      } else if (stat.includes("trap")) {
        pushTheme("guard");
      } else if (stat.includes("summon")) {
        pushTheme("arcane");
      } else if (stat.includes("chain")) {
        pushTheme("lightning");
      } else if (stat.includes("healthregen") || stat.includes("lifesteal") || stat.includes("lifeonkill")) {
        pushTheme("vitality");
      } else if (stat.includes("manaregen") || stat.includes("manasteal") || stat.includes("manaonkill")) {
        pushTheme("mana");
      } else if (stat.includes("movespeed")) {
        pushTheme("wind");
      } else if (stat.includes("armor") || stat.includes("blockchance") || stat.includes("thorns")) {
        pushTheme("guard");
      } else if (stat.includes("crit")) {
        pushTheme("precision");
      } else if (stat.includes("castspeed") || stat.includes("attackspeed")) {
        pushTheme("swift");
      }
      if (themes.length >= 3) {
        return themes;
      }
    }
  }
  return themes;
}

function getItemPresentationData(itemInput) {
  const itemData = itemInput && typeof itemInput === "object" ? itemInput : null;
  const itemId = String(itemData ? itemData.itemId || "" : itemInput || "").trim();
  const itemDef = itemDefsById.get(itemId) || null;
  const slot = String((itemData && itemData.slot) || (itemDef && itemDef.slot) || "").trim();
  const rarity = String((itemData && itemData.rarity) || "normal").trim().toLowerCase() || "normal";
  const weaponClass = String((itemData && itemData.weaponClass) || (itemDef && itemDef.weaponClass) || "")
    .trim()
    .toLowerCase();
  return {
    itemId,
    itemData,
    itemDef,
    slot,
    rarity,
    weaponClass,
    rarityColor: getItemRarityColor(rarity),
    affixThemes: getItemAffixThemes(itemData)
  };
}

function formatEquipmentBaseStatLine(statKey, value) {
  const key = String(statKey || "").trim();
  const n = Number(value);
  if (!key || !Number.isFinite(n) || n === 0) {
    return "";
  }
  const labelMap = {
    armor: "Armor",
    blockChance: "Block Chance",
    attackSpeed: "Attack Speed",
    baseDamageMin: "Base Damage Min",
    baseDamageMax: "Base Damage Max",
    spellPower: "Spell Power"
  };
  const label = labelMap[key] || humanizeKey(key);
  const isPercent = /chance$/i.test(key);
  return `${label}: ${formatTooltipNumber(n)}${isPercent ? "%" : ""}`;
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
  let totalDamageMin = Math.max(0, Number(totalDamageRange[0]) || 0);
  let totalDamageMax = Math.max(totalDamageMin, Number(totalDamageRange[1]) || 0);
  let tooltipDamagePercentBonus = 0;
  if (String(kind).toLowerCase() === "meleecone") {
    tooltipDamagePercentBonus += getActiveSelfBuffStatTotal("meleeDamagePercent");
  }
  if (tooltipDamagePercentBonus !== 0 && totalDamageMax > 0) {
    const damageScale = Math.max(0, 1 + tooltipDamagePercentBonus / 100);
    totalDamageMin = Math.max(0, Math.floor(totalDamageMin * damageScale));
    totalDamageMax = Math.max(totalDamageMin, Math.ceil(totalDamageMax * damageScale));
  }
  const durationMs = Math.max(0, Number(ability.durationMs) || 0);
  const durationPerLevelMs = Math.max(0, Number(ability.durationPerLevelMs) || 0);
  const totalDurationMs = durationMs + durationPerLevelMs * Math.max(0, level - 1);
  const stunDurationMs = Math.max(0, Number(ability.stunDurationMs) || 0);
  const slowDurationMs = Math.max(0, Number(ability.slowDurationMs) || 0);
  const rawSlowMultiplier = Number(ability.slowMultiplier);
  const slowMultiplier = Number.isFinite(rawSlowMultiplier)
    ? clamp(rawSlowMultiplier, 0.1, 1)
    : Number.isFinite(Number(ability.slowAmount))
      ? clamp(1 - clamp(Number(ability.slowAmount), 0, 0.95), 0.1, 1)
      : 1;
  const slowPercent = Math.round((1 - slowMultiplier) * 100);
  const summonCount = sharedGetSummonCountForLevel(
    Number(ability.summonCount) || 1,
    Number(ability.summonCountPerLevel) || 0,
    level,
    {
      everyLevels: Number(ability.summonCountEveryLevels) || 0,
      maxCount: Number(ability.maxSummonCount) || 0
    }
  );
  const invulnerabilityDurationMs = Math.max(
    0,
    Number(ability.invulnerabilityDurationMs || 0) || Math.round((Number(ability.invulnerabilityDuration) || 0) * 1000)
  );
  const summonKind = String(ability.summonKind || "").trim().toLowerCase();

  if (kind && kind !== "none") {
    lines.push(`Kind: ${kind}`);
  }
  appendTooltipNumber(lines, "Mana Cost", manaCost);
  appendTooltipNumber(lines, "Cooldown", cooldownMs, formatMsAsSeconds);
  appendTooltipNumber(lines, "Cast Time", castMs, formatMsAsSeconds);
  appendTooltipNumber(lines, "Range", effectiveRange);

  if (totalDamageMax > 0) {
    const damageLabel =
      ((kind === "area") || (kind === "beam" && String(ability.damageMode || "").toLowerCase() === "overTime")) &&
      durationMs > 0
        ? "Damage / Second"
        : "Damage";
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
    appendTooltipNumber(lines, "Duration", totalDurationMs || durationMs, formatMsAsSeconds);
  }

  if (kind === "chain") {
    appendTooltipNumber(lines, "Beam Width", ability.beamWidth);
    appendTooltipNumber(lines, "Jump Range", ability.jumpRange);
    appendTooltipNumber(lines, "Jumps", ability.jumpCount, (v) => `${Math.round(v)}`);
    appendTooltipNumber(lines, "Jump Damage Loss", ability.jumpDamageReduction, (v) => `${Math.round(v * 100)}%`);
  }

  if (kind === "summon") {
    const summonLabel =
      summonKind === "ballista" ? "Ballistae" : summonKind === "turret" ? "Turrets" : "Summons";
    appendTooltipNumber(lines, summonLabel, summonCount, (v) => `${Math.round(v)}`);
    appendTooltipNumber(lines, "Summon Range", effectiveRange);
    appendTooltipNumber(lines, "Attack Range", ability.summonAttackRange);
    appendTooltipNumber(lines, "Attack Interval", ability.summonAttackIntervalMs, formatMsAsSeconds);
    appendTooltipNumber(lines, "Duration", totalDurationMs || durationMs, formatMsAsSeconds);
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

function buildItemTooltip(itemInput, qty = null) {
  const itemData = itemInput && typeof itemInput === "object" ? itemInput : null;
  const itemId = itemData ? String(itemData.itemId || "") : String(itemInput || "");
  const def = itemDefsById.get(itemId);
  if (!def) {
    return itemId || "Item";
  }

  const resolvedQty = qty !== null ? qty : itemData ? itemData.qty : null;
  const displayName = String((itemData && itemData.name) || def.name || itemId || "Item");
  const lines = [resolvedQty && resolvedQty > 0 ? `${displayName} x${Math.floor(resolvedQty)}` : displayName];
  if (itemData && typeof itemData.rarity === "string" && itemData.rarity.trim()) {
    lines.push(`Rarity: ${toTitleCaseWords(itemData.rarity.trim())}`);
  }
  if (itemData && Number.isFinite(Number(itemData.itemLevel))) {
    lines.push(`Item Level: ${Math.max(1, Math.floor(Number(itemData.itemLevel)))}`);
  }
  if (itemData && typeof itemData.slot === "string" && itemData.slot.trim()) {
    lines.push(`Slot: ${humanizeKey(itemData.slot.trim())}`);
  } else if (def && typeof def.slot === "string" && def.slot.trim()) {
    lines.push(`Slot: ${humanizeKey(def.slot.trim())}`);
  }
  if (def.description) {
    lines.push(String(def.description));
  }
  appendTooltipNumber(lines, "Stack Size", def.stackSize);
  const copperValue = getItemCopperValueClient(itemData || { itemId, qty: resolvedQty || 1 });
  if (copperValue > 0) {
    lines.push(`Vendor Value: ${copperValue} copper`);
  }
  if (def && def.isEquipment && def.baseStats && typeof def.baseStats === "object") {
    for (const [statKey, statValue] of Object.entries(def.baseStats)) {
      const rendered = formatEquipmentBaseStatLine(statKey, statValue);
      if (rendered) {
        lines.push(rendered);
      }
    }
  }

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
      lines.push(`${humanizeKey(key)}: ${formatTooltipNumber(value)}`);
    }
  }

  const affixes = getItemInstanceAffixes(itemData);
  if (affixes.length) {
    lines.push("Affixes:");
    for (const affix of affixes) {
      const prefix = affix.name ? `${affix.name}: ` : "";
      const modifierText = affix.modifiers.map(formatAffixModifier).filter(Boolean).join(", ");
      if (prefix || modifierText) {
        lines.push(`- ${prefix}${modifierText || "No modifiers"}`);
      }
    }
  }

  return lines.join("\n");
}

function buildItemTooltipHtml(itemInput, qty = null) {
  const itemData = itemInput && typeof itemInput === "object" ? itemInput : null;
  const itemId = itemData ? String(itemData.itemId || "") : String(itemInput || "");
  const def = itemDefsById.get(itemId);
  if (!def) {
    return `<div class="tooltip-title-row"><span class="tooltip-title">${escapeHtml(itemId || "Item")}</span></div>`;
  }

  const resolvedQty = qty !== null ? qty : itemData ? itemData.qty : null;
  const displayName = String((itemData && itemData.name) || def.name || itemId || "Item");
  const rarityKey = itemData && typeof itemData.rarity === "string" ? itemData.rarity.trim().toLowerCase() : "normal";
  const rarityColor = getItemRarityColor(rarityKey);
  const iconUrl = getItemIconUrl(itemData || itemId);
  const blocks = [];

  blocks.push(
    `<div class="tooltip-title-row">` +
      `<span class="tooltip-inline-icon" style="background-image:url('${escapeHtml(iconUrl)}')"></span>` +
      `<span class="tooltip-title item-rarity-${escapeHtml(rarityKey)}" style="color:${escapeHtml(rarityColor)}">` +
      `${escapeHtml(resolvedQty && resolvedQty > 0 ? `${displayName} x${Math.floor(resolvedQty)}` : displayName)}` +
      `</span>` +
    `</div>`
  );

  if (itemData && typeof itemData.rarity === "string" && itemData.rarity.trim()) {
    blocks.push(`<div class="tooltip-line">Rarity: ${escapeHtml(toTitleCaseWords(itemData.rarity.trim()))}</div>`);
  }
  if (itemData && Number.isFinite(Number(itemData.itemLevel))) {
    blocks.push(
      `<div class="tooltip-line">Item Level: ${escapeHtml(String(Math.max(1, Math.floor(Number(itemData.itemLevel)))))}</div>`
    );
  }
  if (itemData && typeof itemData.slot === "string" && itemData.slot.trim()) {
    blocks.push(`<div class="tooltip-line">Slot: ${escapeHtml(humanizeKey(itemData.slot.trim()))}</div>`);
  } else if (def && typeof def.slot === "string" && def.slot.trim()) {
    blocks.push(`<div class="tooltip-line">Slot: ${escapeHtml(humanizeKey(def.slot.trim()))}</div>`);
  }
  if (def.description) {
    blocks.push(`<div class="tooltip-line">${escapeHtml(String(def.description))}</div>`);
  }
  if (Number(def.stackSize) > 0) {
    blocks.push(`<div class="tooltip-line">Stack Size: ${escapeHtml(formatTooltipNumber(def.stackSize))}</div>`);
  }
  const copperValue = getItemCopperValueClient(itemData || { itemId, qty: resolvedQty || 1 });
  if (copperValue > 0) {
    blocks.push(`<div class="tooltip-line">Vendor Value: ${escapeHtml(String(copperValue))} copper</div>`);
  }

  const baseStats = itemData && itemData.baseStats && typeof itemData.baseStats === "object" ? itemData.baseStats : def.baseStats;
  if (def && def.isEquipment && baseStats && typeof baseStats === "object") {
    for (const [statKey, statValue] of Object.entries(baseStats)) {
      const rendered = formatEquipmentBaseStatLine(statKey, statValue);
      if (rendered) {
        blocks.push(`<div class="tooltip-line tooltip-stat">${escapeHtml(rendered)}</div>`);
      }
    }
  }

  const effect = def.effect && typeof def.effect === "object" ? def.effect : null;
  if (effect && effect.type) {
    blocks.push(`<div class="tooltip-line">Effect: ${escapeHtml(toTitleCaseWords(String(effect.type)))}</div>`);
    for (const [key, value] of Object.entries(effect)) {
      if (key === "type") {
        continue;
      }
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        if (key === "duration") {
          blocks.push(`<div class="tooltip-line">${escapeHtml("Duration")}: ${escapeHtml(`${value}s`)}</div>`);
        } else if (key === "value") {
          blocks.push(
            `<div class="tooltip-line">${escapeHtml("Value")}: ${escapeHtml(
              Math.abs(value - Math.round(value)) < 0.001 ? String(Math.round(value)) : value.toFixed(2)
            )}</div>`
          );
        } else {
          blocks.push(
            `<div class="tooltip-line">${escapeHtml(humanizeKey(key))}: ${escapeHtml(
              Math.abs(value - Math.round(value)) < 0.001 ? String(Math.round(value)) : value.toFixed(2)
            )}</div>`
          );
        }
      }
    }
  }

  const affixes = getItemInstanceAffixes(itemData);
  if (affixes.length) {
    blocks.push(`<div class="tooltip-section-label">Affixes</div>`);
    for (const affix of affixes) {
      const prefix = affix.name ? `${affix.name}: ` : "";
      const modifierText = affix.modifiers.map(formatAffixModifier).filter(Boolean).join(", ");
      if (prefix || modifierText) {
        blocks.push(
          `<div class="tooltip-line tooltip-affix"><span class="tooltip-bullet">◆</span>${escapeHtml(
            `${prefix}${modifierText || "No modifiers"}`
          )}</div>`
        );
      }
    }
  }

  return blocks.join("");
}

function positionHoverTooltip(clientX, clientY) {
  if (!hoverTooltipEl || hoverTooltipEl.classList.contains("hidden")) {
    return;
  }
  const margin = 14;
  const tooltipWidth = hoverTooltipEl.offsetWidth || 0;
  const tooltipHeight = hoverTooltipEl.offsetHeight || 0;
  let left = clientX + margin;
  let top = clientY + margin;

  if (left + tooltipWidth > window.innerWidth - 10) {
    left = Math.max(10, clientX - tooltipWidth - margin);
  }
  if (top + tooltipHeight > window.innerHeight - 10) {
    top = Math.max(10, clientY - tooltipHeight - margin);
  }

  hoverTooltipEl.style.left = `${Math.round(left)}px`;
  hoverTooltipEl.style.top = `${Math.round(top)}px`;
}

function showItemTooltip(itemInput, event, qty = null) {
  if (!hoverTooltipEl) {
    return;
  }
  hoverTooltipEl.innerHTML = buildItemTooltipHtml(itemInput, qty);
  hoverTooltipEl.classList.remove("hidden");
  positionHoverTooltip(event.clientX, event.clientY);
}

function hideHoverTooltip() {
  if (!hoverTooltipEl) {
    return;
  }
  hoverTooltipEl.classList.add("hidden");
  hoverTooltipEl.innerHTML = "";
}

function bindItemTooltip(node, itemInput, qty = null) {
  if (!node) {
    return;
  }
  node.title = "";
  node.addEventListener("mouseenter", (event) => {
    showItemTooltip(itemInput, event, qty);
  });
  node.addEventListener("mousemove", (event) => {
    positionHoverTooltip(event.clientX, event.clientY);
  });
  node.addEventListener("mouseleave", () => {
    hideHoverTooltip();
  });
  node.addEventListener("blur", () => {
    hideHoverTooltip();
  });
}

function applyItemRarityChrome(slotEl, itemInput) {
  if (!slotEl) {
    return;
  }
  const presentation = getItemPresentationData(itemInput);
  const color = presentation.rarityColor;
  slotEl.style.setProperty("--item-rarity-color", color);
  slotEl.style.setProperty("--item-rarity-glow", hexToRgba(color, 0.28));
}

function getEquippedItemEntries() {
  return Object.values(equipmentState.slots || {}).filter((entry) => entry && entry.itemId);
}

function getClientEquippedBaseStatTotal(statKey) {
  const target = String(statKey || "").trim();
  if (!target) {
    return 0;
  }
  let total = 0;
  for (const entry of getEquippedItemEntries()) {
    const baseStats = entry && entry.baseStats && typeof entry.baseStats === "object" ? entry.baseStats : null;
    total += Number(baseStats && baseStats[target]) || 0;
  }
  return total;
}

function getClientEquippedAffixStatTotal(statKey) {
  const target = String(statKey || "").trim();
  if (!target) {
    return 0;
  }
  let total = 0;
  for (const entry of getEquippedItemEntries()) {
    const affixes = getItemInstanceAffixes(entry);
    for (const affix of affixes) {
      for (const modifier of affix.modifiers) {
        if (String(modifier.stat || "") !== target) {
          continue;
        }
        total += Number(modifier.value) || 0;
      }
    }
  }
  return total;
}

function buildCharacterStatSummary() {
  const self = getCurrentSelf();
  const classDef = classDefsById.get(String((self && self.classType) || (selfStatic && selfStatic.classType) || ""));
  const baseHealth = Math.max(1, Number(classDef?.baseHealth) || 1);
  const baseMana = Math.max(0, Number(classDef?.baseMana) || 0);
  const baseManaRegen = Math.max(0, Number(classDef?.manaRegen) || 0);
  const baseMoveSpeed = Math.max(0.1, Number(classDef?.movementSpeed) || 0.1);
  const baseHealthRegen = 0;
  const baseArmor = Math.max(0, getClientEquippedBaseStatTotal("armor"));
  const armorPercent = getClientEquippedAffixStatTotal("armor.percent");
  const baseBlockChance = Math.max(0, getClientEquippedBaseStatTotal("blockChance"));

  const maxHealthFlat = getClientEquippedAffixStatTotal("maxHealth.flat");
  const maxHealthPercent = getClientEquippedAffixStatTotal("maxHealth.percent");
  const maxManaFlat = getClientEquippedAffixStatTotal("maxMana.flat");
  const maxManaPercent = getClientEquippedAffixStatTotal("maxMana.percent");
  const healthRegenFlat = getClientEquippedAffixStatTotal("healthRegen.flat");
  const healthRegenPercent = getClientEquippedAffixStatTotal("healthRegen.percent");
  const manaRegenFlat = getClientEquippedAffixStatTotal("manaRegen.flat");
  const manaRegenPercent = getClientEquippedAffixStatTotal("manaRegen.percent");
  const moveSpeedPercent = getClientEquippedAffixStatTotal("moveSpeed.percent");
  const critChancePercent = getClientEquippedAffixStatTotal("critChance.percent");
  const critDamagePercent = getClientEquippedAffixStatTotal("critDamage.percent");
  const lifeStealPercent = getClientEquippedAffixStatTotal("lifeSteal.percent");
  const manaStealPercent = getClientEquippedAffixStatTotal("manaSteal.percent");
  const lifeOnKillFlat = getClientEquippedAffixStatTotal("lifeOnKill.flat");
  const manaOnKillFlat = getClientEquippedAffixStatTotal("manaOnKill.flat");
  const thornsFlat = getClientEquippedAffixStatTotal("thorns.flat");
  const attackSpeedPercent = getClientEquippedAffixStatTotal("attackSpeed.percent");
  const castSpeedPercent = getClientEquippedAffixStatTotal("castSpeed.percent");

  const maxHealthTotal = Math.round((baseHealth + maxHealthFlat) * (1 + maxHealthPercent / 100));
  const maxManaTotal = Math.round((baseMana + maxManaFlat) * (1 + maxManaPercent / 100));
  const healthRegenTotal = (baseHealthRegen + healthRegenFlat) * (1 + healthRegenPercent / 100);
  const manaRegenTotal = (baseManaRegen + manaRegenFlat) * (1 + manaRegenPercent / 100);
  const moveSpeedTotal = baseMoveSpeed * (1 + moveSpeedPercent / 100);
  const armorTotal = Math.max(0, Math.round(baseArmor * (1 + armorPercent / 100)));

  return [
    { label: "Health", total: maxHealthTotal, bonus: maxHealthTotal - baseHealth },
    { label: "Mana", total: maxManaTotal, bonus: maxManaTotal - baseMana },
    { label: "Health Regen", total: healthRegenTotal, bonus: healthRegenTotal - baseHealthRegen, decimals: 2 },
    { label: "Mana Regen", total: manaRegenTotal, bonus: manaRegenTotal - baseManaRegen, decimals: 2 },
    { label: "Move Speed", total: moveSpeedTotal, bonus: moveSpeedTotal - baseMoveSpeed, decimals: 2 },
    { label: "Armor", total: armorTotal, bonus: armorTotal },
    { label: "Block", total: baseBlockChance * 100, bonus: baseBlockChance * 100, suffix: "%" },
    { label: "Crit Chance", total: critChancePercent, bonus: critChancePercent, suffix: "%" },
    { label: "Crit Damage", total: critDamagePercent, bonus: critDamagePercent, suffix: "%" },
    { label: "Life Steal", total: lifeStealPercent, bonus: lifeStealPercent, suffix: "%" },
    { label: "Mana Steal", total: manaStealPercent, bonus: manaStealPercent, suffix: "%" },
    { label: "Life On Kill", total: lifeOnKillFlat, bonus: lifeOnKillFlat },
    { label: "Mana On Kill", total: manaOnKillFlat, bonus: manaOnKillFlat },
    { label: "Thorns", total: thornsFlat, bonus: thornsFlat },
    { label: "Attack Speed", total: attackSpeedPercent, bonus: attackSpeedPercent, suffix: "%" },
    { label: "Cast Speed", total: castSpeedPercent, bonus: castSpeedPercent, suffix: "%" }
  ];
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

function getDefaultClassAbilityIds(classType) {
  const classDef = classDefsById.get(String(classType || ""));
  if (!classDef || !Array.isArray(classDef.abilities)) {
    return [];
  }
  const abilityIds = [];
  for (const entry of classDef.abilities) {
    const abilityId = String(entry && entry.id || "").trim();
    const startingLevel = Math.max(1, Math.floor(Number(entry && entry.level) || 1));
    if (!abilityId || !abilityDefsById.has(abilityId) || startingLevel !== 1) {
      continue;
    }
    abilityIds.push(abilityId);
  }
  return abilityIds;
}

function getDefaultClassId() {
  if (classDefsById.size) {
    return classDefsById.keys().next().value;
  }
  return "warrior";
}

function clearSelfPositiveBuffs() {
  selfPositiveBuffs = [];
  if (buffIcons) {
    buffIcons.innerHTML = "";
    buffIcons.classList.add("hidden");
  }
}

function applySelfPositiveBuffs(msg) {
  const now = performance.now();
  const nextBuffs = [];
  for (const buff of Array.isArray(msg && msg.buffs) ? msg.buffs : []) {
    if (!buff || typeof buff !== "object") {
      continue;
    }
    const remainingMs = Math.max(0, Number(buff.remainingMs) || 0);
    if (remainingMs <= 0) {
      continue;
    }
    const durationMs = Math.max(1, Number(buff.durationMs) || remainingMs);
    nextBuffs.push({
      id: String(buff.id || ""),
      name: String(buff.name || "Buff"),
      label: String(buff.label || "").trim().slice(0, 3).toUpperCase(),
      color: String(buff.color || "").trim(),
      stats: buff.stats && typeof buff.stats === "object" ? { ...buff.stats } : {},
      startedAt: now - Math.max(0, durationMs - remainingMs),
      endsAt: now + remainingMs,
      durationMs
    });
  }
  selfPositiveBuffs = nextBuffs;
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

function updatePositiveBuffIcons(now = performance.now()) {
  if (!buffIcons) {
    return;
  }
  const entries = [];
  for (const buff of selfPositiveBuffs) {
    const remainingMs = Math.max(0, Number(buff.endsAt) - now);
    if (remainingMs <= 0) {
      continue;
    }
    const durationMs = Math.max(1, Number(buff.durationMs) || remainingMs);
    entries.push({
      id: String(buff.id || ""),
      label: String(buff.label || "").trim().slice(0, 3).toUpperCase(),
      color: String(buff.color || "") || "rgba(131, 221, 143, 0.94)",
      ratio: clamp(remainingMs / durationMs, 0, 1),
      title: `${String(buff.name || "Buff")} (${(remainingMs / 1000).toFixed(1)}s)`
    });
  }

  selfPositiveBuffs = selfPositiveBuffs.filter((buff) => Math.max(0, Number(buff.endsAt) - now) > 0);
  if (!entries.length) {
    buffIcons.innerHTML = "";
    buffIcons.classList.add("hidden");
    return;
  }

  buffIcons.classList.remove("hidden");
  buffIcons.innerHTML = "";
  for (const entry of entries) {
    const node = document.createElement("div");
    node.className = "buff-icon";
    node.title = entry.title;
    const ring = document.createElement("div");
    ring.className = "buff-ring";
    ring.style.setProperty("--ratio", entry.ratio.toFixed(4));
    ring.style.setProperty("--ring-color", entry.color);
    const core = document.createElement("div");
    core.className = "buff-core";
    core.textContent = entry.label || "BF";
    node.appendChild(ring);
    node.appendChild(core);
    buffIcons.appendChild(node);
  }
}

function getActiveSelfBuffStatTotal(statKey) {
  const target = String(statKey || "").trim();
  if (!target) {
    return 0;
  }
  let total = 0;
  for (const buff of selfPositiveBuffs) {
    const stats = buff && buff.stats && typeof buff.stats === "object" ? buff.stats : null;
    if (!stats) {
      continue;
    }
    total += Number(stats[target]) || 0;
  }
  return total;
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
  const bloodWrathMs = Math.max(0, Number(msg && msg.bloodWrathMs) || 0);
  selfPositiveEffects.bloodWrath = bloodWrathMs > 0 ? { endsAt: now + bloodWrathMs } : null;
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
    const bloodWrathMs = Math.max(0, Number(effect.bloodWrathMs) || 0);
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
    if (bloodWrathMs > 0) {
      remotePlayerBloodWraths.set(id, { endsAt: now + bloodWrathMs });
    } else {
      remotePlayerBloodWraths.delete(id);
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
    clearSelfPositiveBuffs();
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
  updatePositiveBuffIcons(performance.now());
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

function bindAbilityToPreferredActionSlot(abilityId) {
  const resolvedAbilityId = String(abilityId || "").trim();
  if (!resolvedAbilityId) {
    return false;
  }
  const desiredBinding = makeActionBinding(resolvedAbilityId);
  for (let slotId = 1; slotId <= 9; slotId += 1) {
    if ((actionBindings.get(String(slotId)) || makeActionBinding("none")) === desiredBinding) {
      return true;
    }
  }
  for (let slotId = 1; slotId <= 9; slotId += 1) {
    const binding = parseActionBinding(actionBindings.get(String(slotId)) || makeActionBinding("none"));
    if (binding.kind === "action" && binding.id === "none") {
      actionBindings.set(String(slotId), desiredBinding);
      updateActionBarUI(getCurrentSelf());
      return true;
    }
  }
  setStatus("No free action slot.");
  return false;
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
  const mobileLayout = isTouchJoystickEnabled();

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
    node.title = mobileLayout
      ? `${buildAbilityTooltip(abilityId)}\nCurrent Level: ${currentLevel}\nTap to bind to action bar.`
      : `${buildAbilityTooltip(abilityId)}\nCurrent Level: ${currentLevel}\nDrag to action slot.`;
    node.draggable = !mobileLayout;
    node.addEventListener("click", (event) => {
      if (!isTouchJoystickEnabled()) {
        return;
      }
      event.preventDefault();
      bindAbilityToPreferredActionSlot(abilityId);
    });
    node.addEventListener("dragstart", (event) => {
      dragState.source = "spellbook";
      dragState.actionBinding = makeActionBinding(abilityId);
      dragState.inventoryFrom = null;
      dragState.equipmentSlot = "";
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

function inferPreviewArchetypeForItem(itemData) {
  const presentation = getItemPresentationData(itemData);
  const slotFamily = getEquipmentSlotFamily(presentation.slot);
  const tags = new Set(Array.isArray(itemData && itemData.tags) ? itemData.tags.map((value) => String(value || "").trim().toLowerCase()) : []);
  const nameText = String(itemData && (itemData.name || itemData.itemId) || "").toLowerCase();
  const weaponClass = String(presentation.weaponClass || "").toLowerCase();

  if (weaponClass === "bow" || tags.has("bow") || tags.has("projectile") || slotFamily === "trinket" && nameText.includes("hawk")) {
    return "ranger";
  }
  if (
    weaponClass === "staff" ||
    weaponClass === "wand" ||
    weaponClass === "orb" ||
    tags.has("caster") ||
    nameText.includes("arcane") ||
    nameText.includes("oracle") ||
    nameText.includes("wizard")
  ) {
    return "mage";
  }
  if (
    weaponClass === "sword" ||
    weaponClass === "axe" ||
    weaponClass === "shield" ||
    nameText.includes("plate") ||
    nameText.includes("guardian") ||
    nameText.includes("warden") ||
    nameText.includes("iron")
  ) {
    return "warrior";
  }
  if (slotFamily === "head" && (nameText.includes("hood") || nameText.includes("hat"))) {
    return nameText.includes("hat") ? "mage" : "ranger";
  }
  return "warrior";
}

function buildDebugPreviewStyle(itemData) {
  const archetype = inferPreviewArchetypeForItem(itemData);
  const configured = getClassRenderStyle(archetype);
  if (configured && typeof configured === "object") {
    return {
      ...configured,
      sizeScale: Math.min(1.24, Math.max(1.08, Number(configured.sizeScale) || 1))
    };
  }
  return {
    rigType: "humanoid",
    species: "human",
    archetype,
    sizeScale: 1.18,
    defaults: {
      head: archetype === "mage" ? "wizard_hat" : archetype === "ranger" ? "hood" : "helmet",
      chest: archetype === "mage" ? "robe" : archetype === "ranger" ? "leather" : "plate",
      shoulders: archetype === "mage" ? "robe" : archetype === "ranger" ? "leather" : "plate",
      gloves: archetype === "mage" ? "robe" : archetype === "ranger" ? "leather" : "plate",
      bracers: archetype === "mage" ? "robe" : archetype === "ranger" ? "leather" : "plate",
      belt: archetype === "mage" ? "robe" : archetype === "ranger" ? "leather" : "plate",
      pants: archetype === "mage" ? "robe" : archetype === "ranger" ? "leather" : "plate",
      boots: archetype === "mage" ? "robe" : archetype === "ranger" ? "leather" : "plate",
      mainHand: archetype === "mage" ? "staff" : archetype === "ranger" ? "bow" : "sword",
      offHand: archetype === "warrior" ? "shield" : "none"
    }
  };
}

function buildDebugPreviewEquipmentSlots(itemData) {
  const slotFamily = getEquipmentSlotFamily(getEquipmentSlotIdForItem(itemData));
  const slots = {};
  if (slotFamily === "ring") {
    slots.ring1 = itemData;
  } else if (slotFamily === "trinket") {
    slots.trinket1 = itemData;
  } else if (slotFamily) {
    slots[slotFamily] = itemData;
  }
  return slots;
}

function getDebugGearPreviewUrl(itemData) {
  const presentation = getItemPresentationData(itemData);
  const key = [
    "debug_preview",
    presentation.itemId,
    String(itemData && itemData.name || ""),
    presentation.slot,
    presentation.weaponClass,
    presentation.rarity,
    presentation.affixThemes.join(",")
  ].join(":");
  return createIconUrl(key, (iconCtx, size) => {
    const previousTools = humanoidRenderTools;
    const previewTools = sharedCreateHumanoidRenderTools
      ? sharedCreateHumanoidRenderTools({
          ctx: iconCtx,
          clamp,
          lerp,
          hashString,
          sanitizeCssColor
        })
      : null;
    const renderTools = previewTools || previousTools;
    if (!renderTools || typeof renderTools.drawHumanoid !== "function") {
      drawItemIcon(itemData, iconCtx, size);
      return;
    }

    iconCtx.clearRect(0, 0, size, size);
    iconCtx.fillStyle = "rgba(0, 0, 0, 0)";
    iconCtx.fillRect(0, 0, size, size);
    const p = { x: size * 0.5, y: size * 0.66 };
    const previewEntity = {
      id: `preview:${key}`,
      x: 0,
      y: 0
    };
    const previewStyle = buildDebugPreviewStyle(itemData);
    renderTools.drawHumanoid({
      entity: previewEntity,
      entityKey: `preview:${key}`,
      p,
      style: previewStyle,
      equipmentSlots: buildDebugPreviewEquipmentSlots(itemData),
      attackState: null,
      castState: null,
      aimWorldX: 1,
      aimWorldY: 0,
      isSelf: false
    });
  });
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

function drawLightningBeamActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.save();
  iconCtx.translate(mid, mid);
  iconCtx.rotate(-Math.PI / 4.5);
  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";

  iconCtx.strokeStyle = "rgba(119, 203, 255, 0.34)";
  iconCtx.lineWidth = 8.5;
  iconCtx.beginPath();
  iconCtx.moveTo(-12, -8);
  iconCtx.lineTo(-4, -3);
  iconCtx.lineTo(-8, 2);
  iconCtx.lineTo(0, 3);
  iconCtx.lineTo(-2, 10);
  iconCtx.lineTo(12, -3);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(219, 245, 255, 0.98)";
  iconCtx.lineWidth = 3.4;
  iconCtx.beginPath();
  iconCtx.moveTo(-12, -8);
  iconCtx.lineTo(-4, -3);
  iconCtx.lineTo(-8, 2);
  iconCtx.lineTo(0, 3);
  iconCtx.lineTo(-2, 10);
  iconCtx.lineTo(12, -3);
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(122, 223, 255, 0.9)";
  iconCtx.lineWidth = 1.5;
  iconCtx.beginPath();
  iconCtx.moveTo(-7, -10);
  iconCtx.lineTo(-1, -2);
  iconCtx.moveTo(3, 0);
  iconCtx.lineTo(9, 8);
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

function drawFireHydraActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.save();
  iconCtx.translate(mid, mid + 1);

  iconCtx.fillStyle = "rgba(83, 24, 13, 0.95)";
  iconCtx.beginPath();
  iconCtx.ellipse(0, 5, 11, 8, 0, 0, Math.PI * 2);
  iconCtx.fill();

  const neckOffsets = [-7, 0, 7];
  for (let index = 0; index < neckOffsets.length; index += 1) {
    const x = neckOffsets[index];
    iconCtx.strokeStyle = "rgba(255, 125, 62, 0.88)";
    iconCtx.lineWidth = 3.6;
    iconCtx.lineCap = "round";
    iconCtx.beginPath();
    iconCtx.moveTo(x * 0.4, 4);
    iconCtx.quadraticCurveTo(x * 0.55, -2, x, -8);
    iconCtx.stroke();

    iconCtx.fillStyle = "rgba(255, 128, 54, 0.95)";
    iconCtx.beginPath();
    iconCtx.ellipse(x, -10, 4.2, 3.5, 0, 0, Math.PI * 2);
    iconCtx.fill();
    iconCtx.fillStyle = "rgba(255, 226, 142, 0.92)";
    iconCtx.beginPath();
    iconCtx.arc(x + 0.8, -10.6, 1.5, 0, Math.PI * 2);
    iconCtx.fill();
  }

  iconCtx.fillStyle = "rgba(255, 184, 82, 0.85)";
  iconCtx.beginPath();
  iconCtx.arc(0, 7, 3, 0, Math.PI * 2);
  iconCtx.fill();
  iconCtx.restore();
}

function drawActionArrowGlyph(iconCtx, midX, midY, angle, options = {}) {
  const shaftLength = Math.max(10, Number(options.shaftLength) || 18);
  const shaftWidth = Math.max(1.4, Number(options.shaftWidth) || 2.2);
  const headLength = Math.max(4, Number(options.headLength) || 7);
  const featherLength = Math.max(3, Number(options.featherLength) || 5.5);
  const primary = options.primary || "#e9eef6";
  const secondary = options.secondary || "#7c5c39";
  iconCtx.save();
  iconCtx.translate(midX, midY);
  iconCtx.rotate(angle);
  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";

  iconCtx.strokeStyle = primary;
  iconCtx.lineWidth = shaftWidth;
  iconCtx.beginPath();
  iconCtx.moveTo(-shaftLength * 0.58, 0);
  iconCtx.lineTo(shaftLength * 0.44, 0);
  iconCtx.stroke();

  iconCtx.fillStyle = primary;
  iconCtx.strokeStyle = "rgba(120, 132, 148, 0.85)";
  iconCtx.lineWidth = 1.1;
  iconCtx.beginPath();
  iconCtx.moveTo(shaftLength * 0.5, 0);
  iconCtx.lineTo(shaftLength * 0.32, -headLength * 0.55);
  iconCtx.lineTo(shaftLength * 0.38, 0);
  iconCtx.lineTo(shaftLength * 0.32, headLength * 0.55);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.stroke();

  iconCtx.fillStyle = secondary;
  iconCtx.beginPath();
  iconCtx.moveTo(-shaftLength * 0.58, 0);
  iconCtx.lineTo(-shaftLength * 0.78, -featherLength * 0.56);
  iconCtx.lineTo(-shaftLength * 0.66, -featherLength * 0.08);
  iconCtx.closePath();
  iconCtx.moveTo(-shaftLength * 0.58, 0);
  iconCtx.lineTo(-shaftLength * 0.78, featherLength * 0.56);
  iconCtx.lineTo(-shaftLength * 0.66, featherLength * 0.08);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.restore();
}

function drawCompactBowGlyph(iconCtx, midX, midY, angle, options = {}) {
  const size = Math.max(9, Number(options.size) || 15);
  const wood = options.wood || "#c89b62";
  const stringColor = options.stringColor || "#fff2c9";
  iconCtx.save();
  iconCtx.translate(midX, midY);
  iconCtx.rotate(angle);
  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";
  iconCtx.strokeStyle = wood;
  iconCtx.lineWidth = 2.4;
  iconCtx.beginPath();
  iconCtx.moveTo(-size * 0.12, -size);
  iconCtx.quadraticCurveTo(-size * 0.88, 0, -size * 0.12, size);
  iconCtx.stroke();
  iconCtx.strokeStyle = stringColor;
  iconCtx.lineWidth = 1.2;
  iconCtx.beginPath();
  iconCtx.moveTo(-size * 0.12, -size);
  iconCtx.lineTo(-size * 0.12, size);
  iconCtx.stroke();
  iconCtx.restore();
}

function drawAimedShotActionIcon(iconCtx, size) {
  const mid = size / 2;
  drawCompactBowGlyph(iconCtx, mid - 2, mid + 1, -0.18, { size: 13 });
  drawActionArrowGlyph(iconCtx, mid + 2, mid, -0.16, {
    shaftLength: 20,
    shaftWidth: 2.5,
    headLength: 7,
    primary: "#f2f6ff",
    secondary: "#b98b5a"
  });
  iconCtx.strokeStyle = "rgba(255, 226, 154, 0.78)";
  iconCtx.lineWidth = 1.4;
  iconCtx.beginPath();
  iconCtx.arc(mid + 8, mid - 1, 6, 0, Math.PI * 2);
  iconCtx.stroke();
}

function drawMultishotActionIcon(iconCtx, size) {
  const mid = size / 2;
  const angles = [-0.42, -0.12, 0.22];
  for (let i = 0; i < angles.length; i += 1) {
    drawActionArrowGlyph(iconCtx, mid - 1 + i * 1.8, mid + 1, angles[i], {
      shaftLength: 18,
      shaftWidth: 2,
      headLength: 6,
      primary: i === 1 ? "#f4f7ff" : "rgba(220, 228, 241, 0.92)",
      secondary: "#b4895f"
    });
  }
}

function drawPoisonArrowActionIcon(iconCtx, size) {
  const mid = size / 2;
  drawActionArrowGlyph(iconCtx, mid, mid + 1, -0.3, {
    shaftLength: 19,
    shaftWidth: 2.3,
    headLength: 7,
    primary: "#d8f8c6",
    secondary: "#86b25c"
  });
  iconCtx.fillStyle = "rgba(132, 224, 86, 0.96)";
  iconCtx.strokeStyle = "rgba(228, 255, 208, 0.88)";
  iconCtx.lineWidth = 1;
  iconCtx.beginPath();
  iconCtx.moveTo(mid + 8, mid - 5);
  iconCtx.quadraticCurveTo(mid + 12, mid + 1, mid + 8, mid + 6);
  iconCtx.quadraticCurveTo(mid + 4, mid + 1, mid + 8, mid - 5);
  iconCtx.fill();
  iconCtx.stroke();
}

function drawExplosiveArrowActionIcon(iconCtx, size) {
  const mid = size / 2;
  drawActionArrowGlyph(iconCtx, mid - 1, mid + 2, -0.28, {
    shaftLength: 19,
    shaftWidth: 2.2,
    headLength: 7,
    primary: "#ffe3a6",
    secondary: "#b27a4c"
  });
  iconCtx.fillStyle = "rgba(255, 131, 52, 0.94)";
  iconCtx.beginPath();
  iconCtx.arc(mid + 8, mid - 5, 3.8, 0, Math.PI * 2);
  iconCtx.fill();
  iconCtx.strokeStyle = "rgba(255, 216, 128, 0.82)";
  iconCtx.lineWidth = 1.2;
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    iconCtx.beginPath();
    iconCtx.moveTo(mid + 8 + Math.cos(a) * 5.5, mid - 5 + Math.sin(a) * 5.5);
    iconCtx.lineTo(mid + 8 + Math.cos(a) * 8.8, mid - 5 + Math.sin(a) * 8.8);
    iconCtx.stroke();
  }
}

function drawShrapnelGrenadeActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.fillStyle = "#586271";
  iconCtx.strokeStyle = "#d5dde8";
  iconCtx.lineWidth = 1.5;
  iconCtx.beginPath();
  iconCtx.arc(mid, mid + 2, 8.2, 0, Math.PI * 2);
  iconCtx.fill();
  iconCtx.stroke();
  iconCtx.fillStyle = "#9b6f45";
  iconCtx.fillRect(mid - 2.2, mid - 9, 4.4, 5.5);
  iconCtx.strokeStyle = "#ffd58a";
  iconCtx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI * 0.9 + i * 0.38;
    iconCtx.beginPath();
    iconCtx.moveTo(mid + Math.cos(a) * 7, mid - 8 + Math.sin(a) * 3);
    iconCtx.lineTo(mid + Math.cos(a) * 10.5, mid - 12 + Math.sin(a) * 4.2);
    iconCtx.stroke();
  }
}

function drawRainOfArrowsActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.fillStyle = "rgba(103, 147, 96, 0.2)";
  iconCtx.beginPath();
  iconCtx.arc(mid, mid + 5, 11, 0, Math.PI * 2);
  iconCtx.fill();
  const positions = [-8, 0, 8];
  for (let i = 0; i < positions.length; i += 1) {
    drawActionArrowGlyph(iconCtx, mid + positions[i], mid - 1 + i * 0.6, Math.PI * 0.5, {
      shaftLength: 14,
      shaftWidth: 1.9,
      headLength: 5.8,
      primary: "#edf2fa",
      secondary: "#9c7651"
    });
  }
}

function drawCaltropsActionIcon(iconCtx, size) {
  const mid = size / 2;
  const drawSpike = (x, y, scale) => {
    iconCtx.save();
    iconCtx.translate(x, y);
    iconCtx.scale(scale, scale);
    iconCtx.strokeStyle = "#dce5f0";
    iconCtx.lineWidth = 2;
    iconCtx.lineCap = "round";
    iconCtx.beginPath();
    iconCtx.moveTo(-5, -4);
    iconCtx.lineTo(5, 4);
    iconCtx.moveTo(-5, 4);
    iconCtx.lineTo(5, -4);
    iconCtx.moveTo(0, -6);
    iconCtx.lineTo(0, 6);
    iconCtx.stroke();
    iconCtx.restore();
  };
  drawSpike(mid - 5, mid + 1, 0.95);
  drawSpike(mid + 6, mid - 4, 0.8);
  drawSpike(mid + 3, mid + 8, 0.72);
}

function drawRicochetShotActionIcon(iconCtx, size) {
  const mid = size / 2;
  drawActionArrowGlyph(iconCtx, mid - 2, mid + 2, -0.3, {
    shaftLength: 18,
    shaftWidth: 2.2,
    headLength: 6.8,
    primary: "#eff5ff",
    secondary: "#af8357"
  });
  iconCtx.strokeStyle = "rgba(255, 221, 148, 0.85)";
  iconCtx.lineWidth = 1.5;
  iconCtx.beginPath();
  iconCtx.arc(mid + 6, mid - 2, 6.6, 0.2, Math.PI * 1.56);
  iconCtx.stroke();
}

function drawBallistaNestActionIcon(iconCtx, size) {
  const mid = size / 2;
  iconCtx.strokeStyle = "#cfa46f";
  iconCtx.lineWidth = 2.2;
  iconCtx.lineCap = "round";
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 7, mid + 10);
  iconCtx.lineTo(mid - 2, mid + 1);
  iconCtx.lineTo(mid + 8, mid - 1);
  iconCtx.lineTo(mid + 2, mid + 9);
  iconCtx.stroke();
  iconCtx.strokeStyle = "#f0dec0";
  iconCtx.lineWidth = 1.4;
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 1, mid + 1);
  iconCtx.lineTo(mid + 11, mid - 8);
  iconCtx.moveTo(mid - 1, mid + 1);
  iconCtx.lineTo(mid + 11, mid + 8);
  iconCtx.moveTo(mid + 11, mid - 8);
  iconCtx.lineTo(mid + 11, mid + 8);
  iconCtx.stroke();
  iconCtx.fillStyle = "rgba(255, 197, 108, 0.9)";
  iconCtx.beginPath();
  iconCtx.arc(mid - 8, mid + 11, 2.4, 0, Math.PI * 2);
  iconCtx.arc(mid + 4, mid + 11, 2.4, 0, Math.PI * 2);
  iconCtx.fill();
}

function drawPiercingBoltActionIcon(iconCtx, size) {
  const mid = size / 2;
  drawActionArrowGlyph(iconCtx, mid, mid, -0.2, {
    shaftLength: 21,
    shaftWidth: 2.8,
    headLength: 8.5,
    primary: "#f7f2df",
    secondary: "#b88757"
  });
  iconCtx.strokeStyle = "rgba(255, 228, 163, 0.76)";
  iconCtx.lineWidth = 1.1;
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 11, mid + 5);
  iconCtx.lineTo(mid + 13, mid - 3);
  iconCtx.stroke();
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

function drawBloodWrathActionIcon(iconCtx, size) {
  const mid = size / 2;
  const glow = iconCtx.createRadialGradient(mid, mid, 4, mid, mid, size * 0.55);
  glow.addColorStop(0, "rgba(255, 158, 126, 0.36)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  iconCtx.fillStyle = glow;
  iconCtx.fillRect(0, 0, size, size);

  iconCtx.strokeStyle = "#1f0e12";
  iconCtx.lineWidth = 3;
  iconCtx.lineCap = "round";
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 8, mid + 10);
  iconCtx.lineTo(mid + 5, mid - 10);
  iconCtx.stroke();

  iconCtx.strokeStyle = "#ffe6db";
  iconCtx.lineWidth = 1.25;
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 7.2, mid + 9.2);
  iconCtx.lineTo(mid + 4.1, mid - 8.8);
  iconCtx.stroke();

  iconCtx.fillStyle = "#d13d3d";
  iconCtx.strokeStyle = "#2b0f14";
  iconCtx.lineWidth = 2;
  iconCtx.beginPath();
  iconCtx.moveTo(mid + 8, mid - 9);
  iconCtx.bezierCurveTo(mid + 14, mid - 4.5, mid + 14.5, mid + 4, mid + 8, mid + 11.5);
  iconCtx.bezierCurveTo(mid + 1.5, mid + 4, mid + 2, mid - 4.5, mid + 8, mid - 9);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.stroke();

  iconCtx.fillStyle = "rgba(255, 214, 198, 0.88)";
  iconCtx.beginPath();
  iconCtx.arc(mid + 6.4, mid - 2.8, 1.5, 0, Math.PI * 2);
  iconCtx.fill();
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
  aimed_shot: drawAimedShotActionIcon,
  multishot: drawMultishotActionIcon,
  poison_arrow: drawPoisonArrowActionIcon,
  explosive_arrow: drawExplosiveArrowActionIcon,
  shrapnel_grenade: drawShrapnelGrenadeActionIcon,
  rain_of_arrows: drawRainOfArrowsActionIcon,
  caltrops: drawCaltropsActionIcon,
  ricochet_shot: drawRicochetShotActionIcon,
  ballista_nest: drawBallistaNestActionIcon,
  piercing_bolt: drawPiercingBoltActionIcon,
  frostbolt: drawFrostboltActionIcon,
  arcane_missiles: drawArcaneMissilesActionIcon,
  blizzard: drawBlizzardActionIcon,
  arcane_beam: drawArcaneBeamActionIcon,
  lightning_beam: drawLightningBeamActionIcon,
  blink: drawBlinkActionIcon,
  fireball: drawFireballActionIcon,
  fire_hydra: drawFireHydraActionIcon,
  blood_wrath: drawBloodWrathActionIcon,
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

const ITEM_AFFIX_THEME_PALETTES = Object.freeze({
  fire: { primary: "#ff8b42", secondary: "#ffd27a" },
  frost: { primary: "#8ee3ff", secondary: "#dff8ff" },
  arcane: { primary: "#bf8cff", secondary: "#eddcff" },
  lightning: { primary: "#7be1ff", secondary: "#fff5a8" },
  poison: { primary: "#78d652", secondary: "#d7ffaf" },
  physical: { primary: "#d7dde7", secondary: "#8e99ab" },
  vitality: { primary: "#76d88b", secondary: "#d9ffe0" },
  mana: { primary: "#4ea7ff", secondary: "#d5edff" },
  wind: { primary: "#9df5cd", secondary: "#ecfff7" },
  guard: { primary: "#8bc1cf", secondary: "#e0f8ff" },
  precision: { primary: "#ffd768", secondary: "#fff5cb" },
  swift: { primary: "#ffbe78", secondary: "#fff0da" }
});

function getItemAccentPalette(itemInput) {
  const presentation = getItemPresentationData(itemInput);
  const theme = presentation.affixThemes[0] || "";
  return ITEM_AFFIX_THEME_PALETTES[theme] || {
    primary: presentation.rarityColor,
    secondary: "#f0f6ff"
  };
}

function buildItemIconCacheKey(itemInput) {
  const presentation = getItemPresentationData(itemInput);
  return [
    "item_icon",
    presentation.itemId,
    presentation.slot,
    presentation.weaponClass,
    presentation.rarity,
    presentation.affixThemes.join(",")
  ].join(":");
}

function drawItemIconBackdrop(iconCtx, size, rarityColor, accentPalette) {
  const outerGradient = iconCtx.createLinearGradient(0, 0, size, size);
  outerGradient.addColorStop(0, "rgba(12, 18, 27, 0.98)");
  outerGradient.addColorStop(1, "rgba(6, 11, 18, 0.98)");
  iconCtx.fillStyle = outerGradient;
  iconCtx.fillRect(0, 0, size, size);

  const glow = iconCtx.createRadialGradient(size * 0.52, size * 0.38, 4, size * 0.52, size * 0.38, size * 26);
  glow.addColorStop(0, hexToRgba(accentPalette.primary, 0.24));
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  iconCtx.fillStyle = glow;
  iconCtx.fillRect(0, 0, size, size);

  iconCtx.strokeStyle = hexToRgba(rarityColor, 0.95);
  iconCtx.lineWidth = 2.4;
  iconCtx.strokeRect(1.2, 1.2, size - 2.4, size - 2.4);
  iconCtx.strokeStyle = "rgba(255,255,255,0.12)";
  iconCtx.lineWidth = 1;
  iconCtx.strokeRect(4.5, 4.5, size - 9, size - 9);
}

function drawItemAffixDecorations(iconCtx, size, affixThemes) {
  const maxThemes = Math.min(3, affixThemes.length);
  for (let i = 0; i < maxThemes; i += 1) {
    const palette = ITEM_AFFIX_THEME_PALETTES[affixThemes[i]];
    if (!palette) {
      continue;
    }
    const x = 10 + i * 14;
    const y = size - 8;
    iconCtx.fillStyle = palette.primary;
    iconCtx.strokeStyle = hexToRgba(palette.secondary, 0.92);
    iconCtx.lineWidth = 1;
    iconCtx.beginPath();
    iconCtx.moveTo(x, y - 4);
    iconCtx.lineTo(x + 4, y);
    iconCtx.lineTo(x, y + 4);
    iconCtx.lineTo(x - 4, y);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
  }
}

function drawPotionIcon(iconCtx, size, liquidColor) {
  const mid = size / 2;
  iconCtx.strokeStyle = "#d6e4f5";
  iconCtx.fillStyle = liquidColor;
  iconCtx.lineWidth = 2.6;
  iconCtx.beginPath();
  iconCtx.moveTo(mid - 8, mid - 7);
  iconCtx.lineTo(mid + 8, mid - 7);
  iconCtx.lineTo(mid + 6, mid + 11);
  iconCtx.lineTo(mid - 6, mid + 11);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.stroke();
  iconCtx.fillStyle = "#dce6f3";
  iconCtx.fillRect(mid - 4.5, mid - 13, 9, 5);
}

function resolveHeadArmorIconStyle(itemInput, presentation) {
  const text = `${String(presentation?.itemId || "")} ${String(itemInput?.name || "")}`.toLowerCase();
  const tags = new Set(Array.isArray(itemInput?.tags) ? itemInput.tags.map((value) => String(value || "").toLowerCase()) : []);
  if (text.includes("hood") || text.includes("cowl")) {
    return "hood";
  }
  if (text.includes("cap") || text.includes("coif") || text.includes("skullcap")) {
    return "cap";
  }
  if (text.includes("hat") || text.includes("oracle") || text.includes("wizard") || text.includes("sorcer") || text.includes("magus")) {
    return "wizard_hat";
  }
  if (text.includes("crown") || text.includes("circlet") || text.includes("diadem") || text.includes("tiara")) {
    return "crown";
  }
  if (text.includes("horn") || text.includes("antler") || text.includes("viking")) {
    return "horned_helmet";
  }
  if (text.includes("mask") || text.includes("visor") || text.includes("faceguard") || text.includes("barbute") || text.includes("sallet")) {
    return "mask_helmet";
  }
  if (
    text.includes("greathelm") ||
    text.includes("great helm") ||
    text.includes("full helm") ||
    text.includes("plate helm") ||
    (
      (text.includes("helm") || text.includes("helmet")) &&
      (
        text.includes("plate") ||
        text.includes("iron") ||
        text.includes("steel") ||
        text.includes("knight") ||
        text.includes("guardian") ||
        text.includes("warden") ||
        text.includes("recruit")
      )
    )
  ) {
    return "greathelm";
  }
  if (text.includes("helm") || text.includes("helmet")) {
    return "helmet";
  }
  if (tags.has("light") || tags.has("medium")) {
    return text.includes("cap") ? "cap" : "hood";
  }
  return "helmet";
}

function drawHeadArmorIcon(iconCtx, size, itemInput, presentation, accentPalette) {
  const mid = size / 2;
  const style = resolveHeadArmorIconStyle(itemInput, presentation);
  const seed = hashString(`${String(presentation?.itemId || "")}|${String(itemInput?.name || "")}`);
  const variant = Math.abs(seed % 5);
  const variantMinor = Math.abs((seed >>> 3) % 7);
  const primary = hexToRgba(accentPalette.primary, 0.9);
  const secondary = hexToRgba(accentPalette.secondary, 0.96);
  const bright = hexToRgba(accentPalette.secondary, 0.78);
  const dark = "rgba(25, 20, 23, 0.94)";
  const shadow = "rgba(12, 15, 20, 0.84)";
  const fillAndStroke = () => {
    iconCtx.fill();
    iconCtx.stroke();
  };
  const drawGem = (x, y, radius, color = secondary) => {
    iconCtx.fillStyle = color;
    iconCtx.beginPath();
    iconCtx.moveTo(x, y - radius);
    iconCtx.lineTo(x + radius * 0.9, y);
    iconCtx.lineTo(x, y + radius);
    iconCtx.lineTo(x - radius * 0.9, y);
    iconCtx.closePath();
    iconCtx.fill();
  };
  const drawPlume = (x, y, sign = 1, height = 8) => {
    iconCtx.fillStyle = bright;
    iconCtx.strokeStyle = dark;
    iconCtx.lineWidth = 1;
    iconCtx.beginPath();
    iconCtx.moveTo(x, y);
    iconCtx.quadraticCurveTo(x + 3 * sign, y - height * 0.45, x + 1.4 * sign, y - height);
    iconCtx.quadraticCurveTo(x + 0.4 * sign, y - height * 1.18, x - 1.1 * sign, y - height * 0.5);
    iconCtx.closePath();
    fillAndStroke();
  };

  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";
  iconCtx.strokeStyle = dark;
  iconCtx.lineWidth = 1.8;

  if (style === "wizard_hat") {
    iconCtx.fillStyle = primary;
    iconCtx.beginPath();
    iconCtx.ellipse(mid, mid + 5, 13 + variant * 0.6, 4.6 + (variantMinor % 3) * 0.35, -0.12, 0, Math.PI * 2);
    fillAndStroke();
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 7.5, mid + 4.5);
    iconCtx.quadraticCurveTo(mid - 1.5, mid - 8.5 - variant * 0.8, mid + (variant % 2 === 0 ? 2.5 : -1.5), mid - 15.5 - variant * 1.2);
    iconCtx.quadraticCurveTo(mid + 6.8 + variant * 0.4, mid - 9.5 - variant * 0.5, mid + 9.8, mid + 2.8);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.strokeStyle = secondary;
    iconCtx.lineWidth = 1;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 7.5, mid + 1.2);
    iconCtx.lineTo(mid + 7.8, mid + 1.2);
    iconCtx.stroke();
    if (variantMinor % 2 === 0) {
      drawGem(mid + 4.8, mid, 2);
    } else {
      drawPlume(mid + 7.5, mid - 1.5, 1, 7 + variant);
    }
    return;
  }

  if (style === "hood") {
    iconCtx.fillStyle = primary;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 12, mid + 6);
    iconCtx.quadraticCurveTo(mid - 2.2, mid - 15 - variant, mid, mid - 17 - variant);
    iconCtx.quadraticCurveTo(mid + 3.5, mid - 15.5, mid + 12, mid + 5.5);
    iconCtx.lineTo(mid + 9.2, mid + 13);
    iconCtx.quadraticCurveTo(mid + 1.8, mid + 16.4, mid - 10, mid + 13.2);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.fillStyle = shadow;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 6.4, mid + 4);
    iconCtx.quadraticCurveTo(mid, mid - 7.8 - (variantMinor % 2), mid + 6, mid + 3.4);
    iconCtx.lineTo(mid + 4.1, mid + 10);
    iconCtx.quadraticCurveTo(mid, mid + 11.5, mid - 4.8, mid + 10.1);
    iconCtx.closePath();
    iconCtx.fill();
    if (variantMinor % 2 === 0) {
      drawGem(mid, mid + 12.4, 1.8, secondary);
    }
    return;
  }

  if (style === "cap") {
    iconCtx.fillStyle = primary;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 11.2, mid + 7.5);
    iconCtx.quadraticCurveTo(mid - 10.4, mid - 8.8, mid - 1.5, mid - 13.2);
    iconCtx.quadraticCurveTo(mid + 7.5, mid - 12.6, mid + 11.6, mid - 0.5);
    iconCtx.lineTo(mid + 9.6, mid + 9.4);
    iconCtx.lineTo(mid + 6.4, mid + 13.4);
    iconCtx.lineTo(mid - 6.8, mid + 13.2);
    iconCtx.lineTo(mid - 9.8, mid + 9.6);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.strokeStyle = secondary;
    iconCtx.lineWidth = 1;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 7.6, mid - 0.6);
    iconCtx.quadraticCurveTo(mid, mid - 5.8, mid + 7.6, mid - 0.8);
    iconCtx.stroke();
    if (variantMinor % 2 === 0) {
      iconCtx.fillStyle = dark;
      iconCtx.beginPath();
      iconCtx.arc(mid - 5.1, mid - 2.3, 2.2, 0, Math.PI * 2);
      iconCtx.arc(mid + 5.1, mid - 2.3, 2.2, 0, Math.PI * 2);
      iconCtx.fill();
      iconCtx.strokeStyle = secondary;
      iconCtx.lineWidth = 0.9;
      iconCtx.beginPath();
      iconCtx.arc(mid - 5.1, mid - 2.3, 1.2, 0, Math.PI * 2);
      iconCtx.arc(mid + 5.1, mid - 2.3, 1.2, 0, Math.PI * 2);
      iconCtx.stroke();
    }
    return;
  }

  if (style === "crown") {
    iconCtx.fillStyle = primary;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 11, mid + 7);
    iconCtx.lineTo(mid - 8.6, mid - 1.6);
    iconCtx.lineTo(mid - 4.2, mid + 2.2);
    iconCtx.lineTo(mid, mid - 7.6);
    iconCtx.lineTo(mid + 4.2, mid + 2.2);
    iconCtx.lineTo(mid + 8.6, mid - 1.6);
    iconCtx.lineTo(mid + 11, mid + 7);
    iconCtx.lineTo(mid + 8.5, mid + 12.2);
    iconCtx.lineTo(mid - 8.5, mid + 12.2);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.strokeStyle = secondary;
    iconCtx.lineWidth = 1;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 8, mid + 9.1);
    iconCtx.lineTo(mid + 8, mid + 9.1);
    iconCtx.stroke();
    drawGem(mid, mid - 1.6, 2.1);
    drawGem(mid - 5.1, mid + 0.8, 1.4, bright);
    drawGem(mid + 5.1, mid + 0.8, 1.4, bright);
    return;
  }

  if (style === "greathelm" || style === "mask_helmet" || style === "horned_helmet") {
    iconCtx.fillStyle = primary;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 12.5, mid + 5.2);
    iconCtx.quadraticCurveTo(mid - 11, mid - 12.6, mid - 1.8, mid - 16.2);
    iconCtx.quadraticCurveTo(mid + 2.4, mid - 17, mid + 12.4, mid + 4);
    iconCtx.lineTo(mid + 10.2, mid + 14);
    iconCtx.lineTo(mid - 10.4, mid + 14);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.fillStyle = shadow;
    if (style === "mask_helmet") {
      iconCtx.beginPath();
      iconCtx.moveTo(mid - 5.2, mid + 1.2);
      iconCtx.lineTo(mid - 1.4, mid - 5.8);
      iconCtx.lineTo(mid + 1.4, mid - 5.8);
      iconCtx.lineTo(mid + 5.2, mid + 1.2);
      iconCtx.lineTo(mid + 3.3, mid + 9.8);
      iconCtx.lineTo(mid - 3.3, mid + 9.8);
      iconCtx.closePath();
      iconCtx.fill();
      iconCtx.strokeStyle = secondary;
      iconCtx.lineWidth = 0.9;
      iconCtx.beginPath();
      iconCtx.moveTo(mid - 4.6, mid + 5.4);
      iconCtx.lineTo(mid + 4.6, mid + 5.4);
      iconCtx.stroke();
      drawGem(mid, mid - 10.5, 1.4, bright);
    } else {
      iconCtx.fillRect(mid - 5.1, mid + 1.8, 10.2, 1.7);
      if (variantMinor % 2 === 0) {
        iconCtx.fillRect(mid - 1.2, mid - 5.2, 2.4, 8.6);
      } else {
        iconCtx.fillRect(mid - 4.5, mid + 5.2, 9, 1.4);
      }
      if (style === "greathelm") {
        iconCtx.strokeStyle = secondary;
        iconCtx.lineWidth = 1;
        iconCtx.beginPath();
        iconCtx.moveTo(mid - 7, mid - 11.2);
        iconCtx.lineTo(mid + 7, mid - 11.2);
        iconCtx.stroke();
        if (variantMinor % 2 === 0) {
          drawPlume(mid, mid - 14.2, variant % 2 === 0 ? 1 : -1, 8.5);
        }
      }
    }
    if (style === "horned_helmet") {
      iconCtx.fillStyle = bright;
      iconCtx.beginPath();
      iconCtx.moveTo(mid - 7.8, mid - 6.8);
      iconCtx.quadraticCurveTo(mid - 16.4, mid - 10.6, mid - 13.9, mid - 1.5);
      iconCtx.quadraticCurveTo(mid - 10.2, mid - 4.8, mid - 7.2, mid - 1.6);
      iconCtx.closePath();
      fillAndStroke();
      iconCtx.beginPath();
      iconCtx.moveTo(mid + 7.8, mid - 6.8);
      iconCtx.quadraticCurveTo(mid + 16.4, mid - 10.6, mid + 13.9, mid - 1.5);
      iconCtx.quadraticCurveTo(mid + 10.2, mid - 4.8, mid + 7.2, mid - 1.6);
      iconCtx.closePath();
      fillAndStroke();
    }
    return;
  }

  const family = variant % 5;
  iconCtx.fillStyle = primary;
  if (family === 0) {
    iconCtx.beginPath();
    iconCtx.arc(mid, mid - 1.5, 11.8, Math.PI, Math.PI * 2);
    iconCtx.lineTo(mid + 10.8, mid + 4.2);
    iconCtx.lineTo(mid + 7, mid + 10.8);
    iconCtx.lineTo(mid - 7, mid + 10.8);
    iconCtx.lineTo(mid - 10.8, mid + 4.2);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.fillStyle = shadow;
    iconCtx.fillRect(mid - 5, mid + 2.4, 10, 1.6);
    iconCtx.fillRect(mid - 1, mid - 5.1, 2, 9.8);
  } else if (family === 1) {
    iconCtx.beginPath();
    iconCtx.arc(mid, mid - 1.4, 11.2, Math.PI, Math.PI * 2);
    iconCtx.lineTo(mid + 10.4, mid + 4.6);
    iconCtx.lineTo(mid + 6.2, mid + 11.6);
    iconCtx.lineTo(mid - 6.2, mid + 11.6);
    iconCtx.lineTo(mid - 10.4, mid + 4.6);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.fillStyle = shadow;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 5.5, mid + 2);
    iconCtx.lineTo(mid - 1.9, mid - 5.2);
    iconCtx.lineTo(mid + 1.7, mid - 5.2);
    iconCtx.lineTo(mid + 5.7, mid + 2);
    iconCtx.lineTo(mid + 3.1, mid + 9.4);
    iconCtx.lineTo(mid - 3.1, mid + 9.4);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.fillStyle = secondary;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 10.1, mid - 4.2);
    iconCtx.lineTo(mid - 14, mid - 8.6);
    iconCtx.lineTo(mid - 10.6, mid - 1.2);
    iconCtx.closePath();
    iconCtx.moveTo(mid + 10.1, mid - 4.2);
    iconCtx.lineTo(mid + 14, mid - 8.6);
    iconCtx.lineTo(mid + 10.6, mid - 1.2);
    iconCtx.closePath();
    iconCtx.fill();
  } else if (family === 2) {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 9.8, mid + 4.6);
    iconCtx.quadraticCurveTo(mid - 8.5, mid - 9.6, mid, mid - 16.2);
    iconCtx.quadraticCurveTo(mid + 8.5, mid - 9.6, mid + 9.8, mid + 4.6);
    iconCtx.lineTo(mid + 7.2, mid + 11.2);
    iconCtx.lineTo(mid - 7.2, mid + 11.2);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.strokeStyle = secondary;
    iconCtx.lineWidth = 1;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 6.2, mid - 0.8);
    iconCtx.lineTo(mid, mid - 10.8);
    iconCtx.lineTo(mid + 6.2, mid - 0.8);
    iconCtx.stroke();
    iconCtx.fillStyle = shadow;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 5.1, mid + 2.2);
    iconCtx.lineTo(mid, mid - 3.4);
    iconCtx.lineTo(mid + 5.1, mid + 2.2);
    iconCtx.lineTo(mid + 3.2, mid + 9.8);
    iconCtx.lineTo(mid - 3.2, mid + 9.8);
    iconCtx.closePath();
    iconCtx.fill();
    drawPlume(mid, mid - 13.8, variantMinor % 2 === 0 ? 1 : -1, 7.8);
  } else if (family === 3) {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 10.8, mid + 4.6);
    iconCtx.quadraticCurveTo(mid - 8.8, mid - 10.2, mid - 2.2, mid - 15.2);
    iconCtx.quadraticCurveTo(mid + 2.8, mid - 16.4, mid + 10.8, mid + 4);
    iconCtx.lineTo(mid + 7.2, mid + 13);
    iconCtx.lineTo(mid - 6.8, mid + 13);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.fillStyle = shadow;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 4.1, mid + 1.6);
    iconCtx.lineTo(mid - 1.1, mid - 5.2);
    iconCtx.lineTo(mid + 1.5, mid - 5.2);
    iconCtx.lineTo(mid + 4.7, mid + 1.6);
    iconCtx.lineTo(mid + 2.6, mid + 9.4);
    iconCtx.lineTo(mid - 2.8, mid + 9.4);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.strokeStyle = secondary;
    iconCtx.lineWidth = 0.9;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 7.2, mid + 5.4);
    iconCtx.lineTo(mid + 7, mid + 5.4);
    iconCtx.stroke();
  } else {
    iconCtx.beginPath();
    iconCtx.arc(mid - 0.8, mid - 2, 11.2, Math.PI * 0.98, Math.PI * 1.98);
    iconCtx.lineTo(mid + 11.2, mid + 5.1);
    iconCtx.lineTo(mid + 8.6, mid + 12.2);
    iconCtx.lineTo(mid - 5.4, mid + 13.4);
    iconCtx.lineTo(mid - 11.2, mid + 6.2);
    iconCtx.closePath();
    fillAndStroke();
    iconCtx.fillStyle = shadow;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 5.4, mid + 2.5);
    iconCtx.quadraticCurveTo(mid - 1.5, mid - 5.8, mid + 5.1, mid - 2.2);
    iconCtx.lineTo(mid + 5.2, mid + 4.2);
    iconCtx.lineTo(mid - 3.2, mid + 9.6);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.strokeStyle = secondary;
    iconCtx.lineWidth = 0.9;
    for (let i = 0; i < 3; i += 1) {
      const x = mid - 4 + i * 3.4;
      iconCtx.beginPath();
      iconCtx.moveTo(x, mid + 12.2);
      iconCtx.lineTo(x, mid + 16);
      iconCtx.stroke();
    }
  }

  if (variantMinor % 3 === 1 && family !== 1) {
    drawGem(mid, mid - 12, 1.5, bright);
  }
}

function drawArmorSlotIcon(iconCtx, size, slot, accentPalette) {
  const mid = size / 2;
  iconCtx.strokeStyle = hexToRgba(accentPalette.secondary, 0.95);
  iconCtx.fillStyle = hexToRgba(accentPalette.primary, 0.78);
  iconCtx.lineWidth = 2.2;
  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";

  if (slot === "head") {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 11, mid + 8);
    iconCtx.lineTo(mid - 9, mid - 6);
    iconCtx.lineTo(mid - 4, mid - 11);
    iconCtx.lineTo(mid + 4, mid - 11);
    iconCtx.lineTo(mid + 9, mid - 6);
    iconCtx.lineTo(mid + 11, mid + 8);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    iconCtx.clearRect(mid - 6, mid + 1, 12, 4);
    return;
  }

  if (slot === "chest") {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 10, mid - 10);
    iconCtx.lineTo(mid + 10, mid - 10);
    iconCtx.lineTo(mid + 13, mid - 3);
    iconCtx.lineTo(mid + 8, mid + 12);
    iconCtx.lineTo(mid - 8, mid + 12);
    iconCtx.lineTo(mid - 13, mid - 3);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    return;
  }

  if (slot === "shoulders") {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 13, mid + 3);
    iconCtx.lineTo(mid - 8, mid - 8);
    iconCtx.lineTo(mid - 1, mid - 4);
    iconCtx.lineTo(mid - 3, mid + 10);
    iconCtx.closePath();
    iconCtx.moveTo(mid + 13, mid + 3);
    iconCtx.lineTo(mid + 8, mid - 8);
    iconCtx.lineTo(mid + 1, mid - 4);
    iconCtx.lineTo(mid + 3, mid + 10);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    return;
  }

  if (slot === "bracers") {
    iconCtx.beginPath();
    iconCtx.roundRect(mid - 7, mid - 11, 14, 22, 4);
    iconCtx.fill();
    iconCtx.stroke();
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 6, mid - 2);
    iconCtx.lineTo(mid + 6, mid - 2);
    iconCtx.stroke();
    return;
  }

  if (slot === "gloves") {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 10, mid + 9);
    iconCtx.lineTo(mid - 10, mid - 6);
    iconCtx.lineTo(mid - 4, mid - 11);
    iconCtx.lineTo(mid, mid - 6);
    iconCtx.lineTo(mid + 4, mid - 11);
    iconCtx.lineTo(mid + 10, mid - 6);
    iconCtx.lineTo(mid + 10, mid + 9);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    return;
  }

  if (slot === "pants") {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 9, mid - 11);
    iconCtx.lineTo(mid + 9, mid - 11);
    iconCtx.lineTo(mid + 6, mid + 11);
    iconCtx.lineTo(mid + 1, mid + 11);
    iconCtx.lineTo(mid, mid + 2);
    iconCtx.lineTo(mid - 1, mid + 11);
    iconCtx.lineTo(mid - 6, mid + 11);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    return;
  }

  if (slot === "belt") {
    iconCtx.fillStyle = "#6c4b24";
    iconCtx.strokeStyle = "#caa263";
    iconCtx.lineWidth = 2;
    iconCtx.fillRect(mid - 14, mid - 5, 28, 10);
    iconCtx.strokeRect(mid - 14, mid - 5, 28, 10);
    iconCtx.fillStyle = hexToRgba(accentPalette.secondary, 0.95);
    iconCtx.fillRect(mid - 4, mid - 4, 8, 8);
    return;
  }

  if (slot === "boots") {
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 11, mid - 8);
    iconCtx.lineTo(mid - 4, mid - 8);
    iconCtx.lineTo(mid - 1, mid + 4);
    iconCtx.lineTo(mid - 8, mid + 10);
    iconCtx.lineTo(mid - 12, mid + 10);
    iconCtx.closePath();
    iconCtx.moveTo(mid + 4, mid - 8);
    iconCtx.lineTo(mid + 11, mid - 8);
    iconCtx.lineTo(mid + 12, mid + 5);
    iconCtx.lineTo(mid + 6, mid + 10);
    iconCtx.lineTo(mid + 1, mid + 9);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    return;
  }
}

function drawJewelrySlotIcon(iconCtx, size, slot, accentPalette) {
  const mid = size / 2;
  iconCtx.lineWidth = 2.2;
  iconCtx.strokeStyle = "#e9ca7a";
  iconCtx.fillStyle = hexToRgba(accentPalette.primary, 0.95);
  if (slot === "ring") {
    iconCtx.beginPath();
    iconCtx.arc(mid, mid, 10, 0, Math.PI * 2);
    iconCtx.stroke();
    iconCtx.beginPath();
    iconCtx.arc(mid, mid, 5, 0, Math.PI * 2);
    iconCtx.clearRect(mid - 5, mid - 5, 10, 10);
    iconCtx.stroke();
    iconCtx.beginPath();
    iconCtx.arc(mid, mid - 10, 4, 0, Math.PI * 2);
    iconCtx.fill();
    return;
  }
  if (slot === "necklace") {
    iconCtx.beginPath();
    iconCtx.arc(mid, mid - 3, 11, Math.PI * 0.1, Math.PI * 0.9);
    iconCtx.stroke();
    iconCtx.beginPath();
    iconCtx.moveTo(mid, mid + 1);
    iconCtx.lineTo(mid + 6, mid + 11);
    iconCtx.lineTo(mid - 6, mid + 11);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    return;
  }
  iconCtx.strokeStyle = "#c5dfff";
  iconCtx.beginPath();
  iconCtx.moveTo(mid, mid - 12);
  iconCtx.lineTo(mid + 9, mid - 2);
  iconCtx.lineTo(mid + 3, mid + 11);
  iconCtx.lineTo(mid - 3, mid + 11);
  iconCtx.lineTo(mid - 9, mid - 2);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.stroke();
}

function drawWeaponOrOffhandIcon(iconCtx, size, presentation, accentPalette) {
  const mid = size / 2;
  const slot = presentation.slot;
  const weaponClass = presentation.weaponClass;
  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";

  if (weaponClass === "sword") {
    iconCtx.strokeStyle = "#d9e1ea";
    iconCtx.lineWidth = 3.2;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 10, mid + 11);
    iconCtx.lineTo(mid + 8, mid - 10);
    iconCtx.stroke();
    iconCtx.strokeStyle = "#93673f";
    iconCtx.lineWidth = 2.2;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 6, mid + 13);
    iconCtx.lineTo(mid - 12, mid + 7);
    iconCtx.moveTo(mid - 3, mid + 7);
    iconCtx.lineTo(mid + 4, mid + 13);
    iconCtx.stroke();
    return;
  }
  if (weaponClass === "wand" || weaponClass === "staff") {
    iconCtx.strokeStyle = "#7e5b33";
    iconCtx.lineWidth = 3;
    iconCtx.beginPath();
    iconCtx.moveTo(mid - 9, mid + 12);
    iconCtx.lineTo(mid + 6, mid - 10);
    iconCtx.stroke();
    iconCtx.fillStyle = accentPalette.primary;
    iconCtx.strokeStyle = hexToRgba(accentPalette.secondary, 0.92);
    iconCtx.lineWidth = 1.4;
    iconCtx.beginPath();
    iconCtx.arc(mid + 8, mid - 12, weaponClass === "staff" ? 5 : 4, 0, Math.PI * 2);
    iconCtx.fill();
    iconCtx.stroke();
    if (weaponClass === "staff") {
      iconCtx.beginPath();
      iconCtx.arc(mid + 1, mid - 2, 2.8, 0, Math.PI * 2);
      iconCtx.fill();
    }
    return;
  }
  if (weaponClass === "bow") {
    iconCtx.save();
    iconCtx.translate(mid + 1, mid + 1);
    iconCtx.rotate(-0.18);
    iconCtx.strokeStyle = "#c89b62";
    iconCtx.lineWidth = 2.6;
    iconCtx.beginPath();
    iconCtx.moveTo(-2, -13);
    iconCtx.quadraticCurveTo(-12, 0, -2, 13);
    iconCtx.stroke();
    iconCtx.strokeStyle = "#f5e1b7";
    iconCtx.lineWidth = 1.1;
    iconCtx.beginPath();
    iconCtx.moveTo(-2, -13);
    iconCtx.lineTo(-2, 13);
    iconCtx.stroke();
    iconCtx.restore();
    drawActionArrowGlyph(iconCtx, mid + 5, mid - 1, -0.12, {
      shaftLength: 16,
      shaftWidth: 2,
      headLength: 5.8,
      primary: "#f1f5fb",
      secondary: "#a9825c"
    });
    return;
  }
  if (slot === "offHand") {
    const shieldColor = hexToRgba(accentPalette.primary, 0.82);
    iconCtx.fillStyle = shieldColor;
    iconCtx.strokeStyle = hexToRgba(accentPalette.secondary, 0.92);
    iconCtx.lineWidth = 2.1;
    iconCtx.beginPath();
    iconCtx.moveTo(mid, mid - 12);
    iconCtx.lineTo(mid + 11, mid - 6);
    iconCtx.lineTo(mid + 7, mid + 12);
    iconCtx.lineTo(mid - 7, mid + 12);
    iconCtx.lineTo(mid - 11, mid - 6);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    iconCtx.beginPath();
    iconCtx.arc(mid, mid + 1, 3.5, 0, Math.PI * 2);
    iconCtx.stroke();
    return;
  }
  iconCtx.fillStyle = hexToRgba(accentPalette.primary, 0.88);
  iconCtx.beginPath();
  iconCtx.arc(mid, mid, 10, 0, Math.PI * 2);
  iconCtx.fill();
}

function drawItemIcon(itemInput, iconCtx, size) {
  const presentation = getItemPresentationData(itemInput);
  const mid = size / 2;
  const accentPalette = getItemAccentPalette(itemInput);
  drawItemIconBackdrop(iconCtx, size, presentation.rarityColor, accentPalette);

  if (presentation.itemId === "copperCoin") {
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

  if (presentation.itemId === "healthPotion01") {
    drawPotionIcon(iconCtx, size, "#8b1e1e");
    return;
  }
  if (presentation.itemId === "manaPotion01") {
    drawPotionIcon(iconCtx, size, "#185d9c");
    return;
  }

  if (presentation.itemDef && presentation.itemDef.isEquipment) {
    const slotFamily = getEquipmentSlotFamily(presentation.slot);
    if (slotFamily === "head") {
      drawHeadArmorIcon(iconCtx, size, itemInput, presentation, accentPalette);
    } else if (["chest", "shoulders", "bracers", "gloves", "pants", "belt", "boots"].includes(slotFamily)) {
      drawArmorSlotIcon(iconCtx, size, slotFamily, accentPalette);
    } else if (["ring", "necklace", "trinket"].includes(slotFamily)) {
      drawJewelrySlotIcon(iconCtx, size, slotFamily, accentPalette);
    } else {
      drawWeaponOrOffhandIcon(iconCtx, size, presentation, accentPalette);
    }
    drawItemAffixDecorations(iconCtx, size, presentation.affixThemes);
    return;
  }

  iconCtx.fillStyle = "#8fa3b8";
  iconCtx.beginPath();
  iconCtx.arc(mid, mid, 10, 0, Math.PI * 2);
  iconCtx.fill();
}

function getItemIconUrl(itemInput) {
  const key = buildItemIconCacheKey(itemInput);
  return createIconUrl(key, (iconCtx, size) => {
    drawItemIcon(itemInput, iconCtx, size);
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

function getEquipmentSlotIdForItem(slotData) {
  if (!slotData || !slotData.itemId) {
    return "";
  }
  const explicitSlot = String(slotData.slot || "").trim();
  if (explicitSlot === "ring1" || explicitSlot === "ring2" || explicitSlot === "trinket1" || explicitSlot === "trinket2") {
    return explicitSlot;
  }
  if (explicitSlot) {
    return explicitSlot;
  }
  const itemDef = itemDefsById.get(slotData.itemId);
  return String((itemDef && itemDef.slot) || "").trim();
}

function getEquipmentSlotFamily(slotId) {
  const normalized = String(slotId || "").trim();
  if (normalized === "ring1" || normalized === "ring2") {
    return "ring";
  }
  if (normalized === "trinket1" || normalized === "trinket2") {
    return "trinket";
  }
  return normalized;
}

function getCompatibleEquipmentSlotIds(slotData) {
  const itemSlotId = getEquipmentSlotFamily(getEquipmentSlotIdForItem(slotData));
  if (!itemSlotId) {
    return [];
  }
  return equipmentConfigState.itemSlots.filter((slotId) => getEquipmentSlotFamily(slotId) === itemSlotId);
}

function resolvePreferredEquipmentSlotId(slotData) {
  const compatibleSlots = getCompatibleEquipmentSlotIds(slotData);
  if (!compatibleSlots.length) {
    return "";
  }
  const emptySlotId = compatibleSlots.find((slotId) => !equipmentState.slots[slotId]);
  return emptySlotId || compatibleSlots[0];
}

function equipInventoryItemAtIndex(index) {
  const slotData = inventoryState.slots[index];
  if (!slotData || !slotData.itemId) {
    return false;
  }
  const slotId = resolvePreferredEquipmentSlotId(slotData);
  if (!slotId) {
    return false;
  }
  sendJsonMessage({
    type: "equip_item",
    inventoryIndex: index,
    slot: slotId
  });
  return true;
}

function updateInventoryUI() {
  if (!inventoryGrid || !inventoryPanel) {
    return;
  }
  hideHoverTooltip();

  const mobileLayout = isTouchJoystickEnabled();
  const slotSizePx = mobileLayout ? 56 : INVENTORY_SLOT_SIZE_PX;
  const slotGapPx = mobileLayout ? 8 : INVENTORY_SLOT_GAP_PX;
  ensureInventorySlotsLength();
  const gridWidth =
    inventoryState.cols * slotSizePx + Math.max(0, inventoryState.cols - 1) * slotGapPx;
  const requiredPanelWidth = gridWidth + INVENTORY_PANEL_PADDING_PX * 2 + INVENTORY_PANEL_BORDER_PX * 2;
  const maxPanelWidth = Math.max(180, window.innerWidth - 24);
  const panelWidth = Math.min(requiredPanelWidth, maxPanelWidth);
  inventoryPanel.style.width = mobileLayout ? "" : `${panelWidth}px`;
  inventoryPanel.style.overflowX = mobileLayout ? "hidden" : requiredPanelWidth > panelWidth ? "auto" : "visible";
  inventoryGrid.style.gridTemplateColumns = `repeat(${inventoryState.cols}, ${slotSizePx}px)`;
  inventoryGrid.style.gap = `${slotGapPx}px`;
  inventoryGrid.innerHTML = "";

  for (let i = 0; i < inventoryState.slots.length; i += 1) {
    const slotData = inventoryState.slots[i];
    const slotEl = document.createElement("div");
    slotEl.className = "inventory-slot";
    slotEl.dataset.index = String(i);
    slotEl.style.width = `${slotSizePx}px`;
    slotEl.style.height = `${slotSizePx}px`;
    slotEl.addEventListener("dragover", (event) => {
      if (dragState.inventoryFrom === null && !dragState.equipmentSlot) {
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
      const fromInventory = dragState.inventoryFrom;
      const fromEquipmentSlot = dragState.equipmentSlot;
      clearDragState();
      if (fromInventory !== null) {
        const to = i;
        if (fromInventory === to) {
          return;
        }
        sendJsonMessage({
          type: "inventory_move",
          from: fromInventory,
          to
        });
        return;
      }
      if (fromEquipmentSlot) {
        sendJsonMessage({
          type: "unequip_item",
          slot: fromEquipmentSlot,
          targetIndex: i
        });
      }
    });

    if (slotData && slotData.itemId) {
      slotEl.classList.add("has-item");
      slotEl.draggable = !mobileLayout;
      bindItemTooltip(slotEl, slotData);
      applyItemRarityChrome(slotEl, slotData);
      slotEl.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (!trySellInventoryItemAtIndex(i)) {
          equipInventoryItemAtIndex(i);
        }
      });
      bindMobileItemSlotInteraction(
        slotEl,
        slotData,
        () => {
          if (!trySellInventoryItemAtIndex(i)) {
            equipInventoryItemAtIndex(i);
          }
        },
        slotData.qty
      );
      slotEl.addEventListener("dragstart", (event) => {
        dragState.source = "inventory";
        dragState.inventoryFrom = i;
        dragState.equipmentSlot = "";
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
      iconEl.style.backgroundImage = `url(${getItemIconUrl(slotData)})`;
      slotEl.appendChild(iconEl);

      const qtyEl = document.createElement("div");
      qtyEl.className = "inv-qty";
      qtyEl.textContent = String(slotData.qty || 0);
      slotEl.appendChild(qtyEl);
    }

    inventoryGrid.appendChild(slotEl);
  }
}

function updateEquipmentUI() {
  if (!equipmentGrid || !equipmentPanel) {
    return;
  }
  hideHoverTooltip();
  const mobileLayout = isTouchJoystickEnabled();
  const slotIds = Array.isArray(equipmentConfigState.itemSlots) ? equipmentConfigState.itemSlots : [];
  equipmentGrid.innerHTML = "";
  const shellEl = document.createElement("div");
  shellEl.className = "equipment-layout-shell";
  const statsPanelEl = document.createElement("div");
  statsPanelEl.className = "equipment-stats-panel";
  const statsTitleEl = document.createElement("div");
  statsTitleEl.className = "equipment-stats-title";
  statsTitleEl.textContent = "Stats";
  statsPanelEl.appendChild(statsTitleEl);
  const statsListEl = document.createElement("div");
  statsListEl.className = "equipment-stats-list";
  for (const stat of buildCharacterStatSummary()) {
    const rowEl = document.createElement("div");
    rowEl.className = "equipment-stat-row";

    const labelEl = document.createElement("div");
    labelEl.className = "equipment-stat-label";
    labelEl.textContent = stat.label;

    const valueEl = document.createElement("div");
    valueEl.className = "equipment-stat-value";
    const totalText = `${formatTooltipNumber(stat.total, stat.decimals ?? 2)}${stat.suffix || ""}`;
    const bonus = Number(stat.bonus) || 0;
    const bonusText =
      Math.abs(bonus) > 0.001
        ? ` (${bonus > 0 ? "+" : ""}${formatTooltipNumber(Math.abs(bonus), stat.decimals ?? 2)}${stat.suffix || ""})`
        : "";
    valueEl.textContent = `${totalText}${bonusText}`;

    rowEl.appendChild(labelEl);
    rowEl.appendChild(valueEl);
    statsListEl.appendChild(rowEl);
  }
  statsPanelEl.appendChild(statsListEl);

  const layoutEl = document.createElement("div");
  layoutEl.className = "equipment-layout";

  const figureEl = document.createElement("div");
  figureEl.className = "equipment-figure";
  layoutEl.appendChild(figureEl);

  for (const slotId of slotIds) {
    const slotLayout = EQUIPMENT_SLOT_LAYOUT[slotId] || {
      x: 50,
      y: 50,
      label: humanizeKey(slotId)
    };
    const anchor = document.createElement("div");
    const horizontalRole = slotLayout.x < 35 ? "left-anchor" : slotLayout.x > 65 ? "right-anchor" : "center-anchor";
    anchor.className = `equipment-anchor ${horizontalRole}${slotLayout.kind === "belt" ? " belt-anchor" : ""}`;
    anchor.style.left = `${slotLayout.x}%`;
    anchor.style.top = `${slotLayout.y}%`;

    const slotEl = document.createElement("div");
    slotEl.className = `inventory-slot equipment-slot${slotLayout.kind === "belt" ? " belt-slot" : ""}`;
    slotEl.dataset.slot = slotId;
    slotEl.title = slotLayout.label || humanizeKey(slotId);
    slotEl.addEventListener("dragover", (event) => {
      const draggedSlot = dragState.inventoryFrom;
      const slotData = draggedSlot !== null ? inventoryState.slots[draggedSlot] : null;
      const compatibleSlots = getCompatibleEquipmentSlotIds(slotData);
      if (!dragState.itemId || draggedSlot === null || !compatibleSlots.includes(slotId)) {
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
      if (!dragState.itemId || dragState.inventoryFrom === null) {
        clearDragState();
        return;
      }
      const inventoryIndex = dragState.inventoryFrom;
      clearDragState();
      sendJsonMessage({
        type: "equip_item",
        inventoryIndex,
        slot: slotId
      });
    });

    const slotData = equipmentState.slots[slotId] || null;
    if (slotData && slotData.itemId) {
      slotEl.classList.add("has-item");
      slotEl.draggable = !mobileLayout;
      bindItemTooltip(slotEl, slotData);
      applyItemRarityChrome(slotEl, slotData);
      bindMobileItemSlotInteraction(slotEl, slotData, () => {
        sendJsonMessage({
          type: "unequip_item",
          slot: slotId
        });
      });
      slotEl.addEventListener("dragstart", (event) => {
        dragState.source = "equipment";
        dragState.inventoryFrom = null;
        dragState.equipmentSlot = slotId;
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
      iconEl.style.backgroundImage = `url(${getItemIconUrl(slotData)})`;
      slotEl.appendChild(iconEl);
    }

    const label = document.createElement("div");
    label.className = "equipment-slot-label";
    label.textContent = slotLayout.label || humanizeKey(slotId);

    anchor.appendChild(slotEl);
    anchor.appendChild(label);
    layoutEl.appendChild(anchor);
  }

  shellEl.appendChild(statsPanelEl);
  shellEl.appendChild(layoutEl);
  equipmentGrid.appendChild(shellEl);
}

function canInteractWithVendor(self = null) {
  const actor = self || getCurrentSelf();
  const vendor = getTownVendor();
  if (!actor || !vendor) {
    return false;
  }
  return Math.hypot(Number(vendor.x) + 0.5 - Number(actor.x), Number(vendor.y) + 0.5 - Number(actor.y)) <= Math.max(0.5, Number(vendor.interactRange) || 2.25);
}

function setVendorPanelVisible(visible) {
  vendorInteractionState.panelOpen = !!visible;
  if (vendorPanel) {
    vendorPanel.classList.toggle("hidden", !vendorInteractionState.panelOpen);
  }
  if (!visible) {
    clearAutoVendorInteraction(false, false);
  }
}

function sendSellInventoryItem(inventoryIndex) {
  const vendor = getTownVendor();
  if (!vendor) {
    return false;
  }
  return sendJsonMessage({
    type: "sell_inventory_item",
    inventoryIndex,
    vendorId: vendor.id
  });
}

function trySellInventoryItemAtIndex(index) {
  const slotData = inventoryState.slots[index];
  if (!slotData || !slotData.itemId || !slotData.isEquipment || !vendorInteractionState.panelOpen) {
    return false;
  }
  if (!canInteractWithVendor()) {
    setStatus("Move closer to the vendor.");
    return false;
  }
  const copperValue = getItemCopperValueClient(slotData);
  if (copperValue <= 0) {
    return false;
  }
  return sendSellInventoryItem(index);
}

function createVendorItemEntry(slotData, index) {
  const entry = document.createElement("div");
  entry.className = "vendor-item-entry";
  applyItemRarityChrome(entry, slotData);
  const iconShell = document.createElement("div");
  iconShell.className = "vendor-item-icon";
  applyItemRarityChrome(iconShell, slotData);
  const icon = document.createElement("div");
  icon.className = "inv-icon";
  icon.style.backgroundImage = `url(${getItemIconUrl(slotData)})`;
  iconShell.appendChild(icon);

  const meta = document.createElement("div");
  meta.className = "vendor-item-meta";
  const nameEl = document.createElement("div");
  nameEl.className = "vendor-item-name";
  nameEl.textContent = slotData.name || itemDefsById.get(slotData.itemId)?.name || slotData.itemId;
  const extraEl = document.createElement("div");
  extraEl.className = "vendor-item-extra";
  const levelText = Number(slotData.itemLevel) > 0 ? `ilvl ${Math.floor(Number(slotData.itemLevel) || 0)}` : "equipment";
  const qty = Math.max(0, Math.floor(Number(slotData.qty) || 0));
  extraEl.textContent = qty > 1 ? `${levelText} | x${qty}` : levelText;
  meta.appendChild(nameEl);
  meta.appendChild(extraEl);

  const valueEl = document.createElement("div");
  valueEl.className = "vendor-item-value";
  valueEl.textContent = `${getItemCopperValueClient(slotData)}c`;

  entry.appendChild(iconShell);
  entry.appendChild(meta);
  entry.appendChild(valueEl);
  bindItemTooltip(entry, slotData);
  entry.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    sendSellInventoryItem(index);
  });
  return entry;
}

function updateVendorPanelUI() {
  if (!vendorTitle || !vendorSubtitle || !vendorItemList) {
    return;
  }
  const vendor = getTownVendor();
  vendorTitle.textContent = vendor ? vendor.name || "Quartermaster" : "Quartermaster";
  vendorSubtitle.textContent = canInteractWithVendor()
    ? "Right-click gear to sell it for copper."
    : "Right-click the vendor in town to open this panel. Move closer to sell.";
  vendorItemList.innerHTML = "";
  const sellable = [];
  for (let index = 0; index < inventoryState.slots.length; index += 1) {
    const slotData = inventoryState.slots[index];
    if (!slotData || !slotData.itemId || !slotData.isEquipment) {
      continue;
    }
    const copperValue = getItemCopperValueClient(slotData);
    if (copperValue <= 0) {
      continue;
    }
    sellable.push({ slotData, index });
  }
  if (!sellable.length) {
    const empty = document.createElement("div");
    empty.className = "vendor-item-entry empty";
    empty.textContent = "No sellable gear in inventory.";
    vendorItemList.appendChild(empty);
    return;
  }
  for (const entry of sellable) {
    vendorItemList.appendChild(createVendorItemEntry(entry.slotData, entry.index));
  }
}

function clearAutoVendorInteraction(sendStopMove = false, keepPanelOpen = true) {
  const wasActive = vendorInteractionState.active || autoMoveTarget.active;
  vendorInteractionState.active = false;
  vendorInteractionState.npcId = "";
  vendorInteractionState.x = 0;
  vendorInteractionState.y = 0;
  vendorInteractionState.nextAttemptAt = 0;
  clearAutoMoveTarget();
  if (!keepPanelOpen) {
    vendorInteractionState.panelOpen = false;
    if (vendorPanel) {
      vendorPanel.classList.add("hidden");
    }
  }
  if (sendStopMove && wasActive) {
    sendMove();
  }
}

function startAutoVendorInteraction(vendor) {
  if (!vendor) {
    return false;
  }
  vendorInteractionState.active = true;
  vendorInteractionState.npcId = String(vendor.id || "");
  vendorInteractionState.x = Number(vendor.x) || 0;
  vendorInteractionState.y = Number(vendor.y) || 0;
  vendorInteractionState.nextAttemptAt = 0;
  setAutoMoveTarget(vendorInteractionState.x + 0.5, vendorInteractionState.y + 0.5, 0.8);
  sendMove();
  return true;
}

function getHoveredVendor(cameraX, cameraY) {
  const vendor = getTownVendor();
  if (!vendor) {
    return null;
  }
  const p = worldToScreen(Number(vendor.x) + 0.5, Number(vendor.y) + 0.5, cameraX, cameraY);
  const dx = mouseState.sx - p.x;
  const dy = mouseState.sy - p.y;
  const radius = TILE_SIZE * 0.48;
  if (dx * dx + dy * dy > radius * radius) {
    return null;
  }
  return { vendor, p };
}

function tryContextVendorInteraction() {
  const self = getCurrentSelf();
  if (!self) {
    return false;
  }
  const cameraX = self.x + 0.5;
  const cameraY = self.y + 0.5;
  const hovered = getHoveredVendor(cameraX, cameraY);
  if (!hovered || !hovered.vendor) {
    return false;
  }
  if (canInteractWithVendor(self)) {
    clearAutoVendorInteraction(false, true);
    setVendorPanelVisible(true);
    updateVendorPanelUI();
    return true;
  }
  return startAutoVendorInteraction(hovered.vendor);
}

function updateAutoVendorInteraction(now = performance.now()) {
  if (!vendorInteractionState.active && !vendorInteractionState.panelOpen) {
    return;
  }
  const self = getCurrentSelf();
  if (!self || self.hp <= 0) {
    clearAutoVendorInteraction(true, false);
    return;
  }
  const manualMove = getCurrentInputVector();
  if (manualMove.dx || manualMove.dy) {
    clearAutoVendorInteraction(false, true);
    return;
  }
  if (vendorInteractionState.panelOpen && !canInteractWithVendor(self)) {
    setVendorPanelVisible(false);
  }
  if (!vendorInteractionState.active) {
    return;
  }
  const vendor = getTownVendor();
  if (!vendor || String(vendor.id || "") !== vendorInteractionState.npcId) {
    clearAutoVendorInteraction(true, false);
    return;
  }
  vendorInteractionState.x = Number(vendor.x) || 0;
  vendorInteractionState.y = Number(vendor.y) || 0;
  setAutoMoveTarget(vendorInteractionState.x + 0.5, vendorInteractionState.y + 0.5, 0.8);
  const dist = Math.hypot(vendorInteractionState.x + 0.5 - self.x, vendorInteractionState.y + 0.5 - self.y);
  if (dist <= Math.max(0.5, Number(vendor.interactRange) || 2.25)) {
    clearAutoVendorInteraction(true, true);
    setVendorPanelVisible(true);
    updateVendorPanelUI();
    return;
  }
  if (now >= vendorInteractionState.nextAttemptAt) {
    vendorInteractionState.nextAttemptAt = now + 90;
    sendMove();
  }
}

if (vendorCloseButton) {
  vendorCloseButton.addEventListener("click", () => {
    setVendorPanelVisible(false);
  });
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

function isMobilePanelMode() {
  return isTouchJoystickEnabled();
}

function getMobilePanelElement(tabId) {
  const resolvedTab = String(tabId || "").trim().toLowerCase();
  if (resolvedTab === "equipment" || resolvedTab === "character") {
    return equipmentPanel;
  }
  if (resolvedTab === "spellbook" || resolvedTab === "skills") {
    return spellbookPanel;
  }
  return inventoryPanel;
}

function getLootBagsWithinPickupRange(self = null) {
  const actor = self || getCurrentSelf();
  if (!actor) {
    return [];
  }
  const bags = (lastRenderState && Array.isArray(lastRenderState.lootBags) ? lastRenderState.lootBags : null) || gameState.lootBags;
  const reachable = [];
  for (const bag of Array.isArray(bags) ? bags : []) {
    if (!bag) {
      continue;
    }
    const distance = Math.hypot(Number(bag.x) + 0.5 - Number(actor.x), Number(bag.y) + 0.5 - Number(actor.y));
    if (!Number.isFinite(distance) || distance > lootClientConfig.bagPickupRange) {
      continue;
    }
    reachable.push({
      bag,
      distance
    });
  }
  reachable.sort((left, right) => left.distance - right.distance);
  return reachable;
}

function pickupNearestLootBagInRange() {
  const reachable = getLootBagsWithinPickupRange();
  if (!reachable.length) {
    return false;
  }
  clearAutoLootPickup(false);
  const nearest = reachable[0].bag;
  return sendPickupBag(Number(nearest.x) || 0, Number(nearest.y) || 0);
}

function pickupAllLootBagsInRange() {
  const reachable = getLootBagsWithinPickupRange();
  if (!reachable.length) {
    return false;
  }
  clearAutoLootPickup(false);
  let pickedAny = false;
  for (const entry of reachable) {
    const bag = entry && entry.bag;
    if (!bag) {
      continue;
    }
    pickedAny = sendPickupBag(Number(bag.x) || 0, Number(bag.y) || 0) || pickedAny;
  }
  return pickedAny;
}

function clearMobileTooltipHideTimer() {
  if (!mobilePanelState.tooltipHideTimer) {
    return;
  }
  window.clearTimeout(mobilePanelState.tooltipHideTimer);
  mobilePanelState.tooltipHideTimer = 0;
}

function showMobileItemTooltip(itemInput, clientX, clientY, qty = null) {
  showItemTooltip(
    itemInput,
    {
      clientX: Number(clientX) || 0,
      clientY: Number(clientY) || 0
    },
    qty
  );
  clearMobileTooltipHideTimer();
  mobilePanelState.tooltipHideTimer = window.setTimeout(() => {
    mobilePanelState.tooltipHideTimer = 0;
    hideHoverTooltip();
  }, 2600);
}

function bindMobileItemSlotInteraction(node, itemInput, onTap, qty = null) {
  if (!node || !itemInput) {
    return;
  }

  let holdTimer = 0;
  let holdTriggered = false;
  let startClientX = 0;
  let startClientY = 0;
  let tapCanceled = false;

  function clearHoldTimer() {
    if (!holdTimer) {
      return;
    }
    window.clearTimeout(holdTimer);
    holdTimer = 0;
  }

  node.addEventListener("click", (event) => {
    if (!isTouchJoystickEnabled()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  node.addEventListener(
    "touchstart",
    (event) => {
      if (!isTouchJoystickEnabled()) {
        return;
      }
      const touch = event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : null;
      if (!touch) {
        return;
      }
      holdTriggered = false;
      tapCanceled = false;
      startClientX = Number(touch.clientX) || 0;
      startClientY = Number(touch.clientY) || 0;
      clearHoldTimer();
      holdTimer = window.setTimeout(() => {
        holdTimer = 0;
        holdTriggered = true;
        showMobileItemTooltip(itemInput, startClientX, startClientY, qty);
      }, 420);
    },
    { passive: true }
  );
  node.addEventListener(
    "touchmove",
    (event) => {
      if (!isTouchJoystickEnabled()) {
        return;
      }
      const touch = event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : null;
      if (!touch) {
        return;
      }
      if (Math.hypot((Number(touch.clientX) || 0) - startClientX, (Number(touch.clientY) || 0) - startClientY) > 14) {
        tapCanceled = true;
        clearHoldTimer();
      }
    },
    { passive: true }
  );
  node.addEventListener(
    "touchcancel",
    () => {
      clearHoldTimer();
      holdTriggered = false;
      tapCanceled = false;
    },
    { passive: true }
  );
  node.addEventListener(
    "touchend",
    (event) => {
      if (!isTouchJoystickEnabled()) {
        return;
      }
      clearHoldTimer();
      event.preventDefault();
      event.stopPropagation();
      if (holdTriggered || tapCanceled) {
        holdTriggered = false;
        tapCanceled = false;
        return;
      }
      hideHoverTooltip();
      if (typeof onTap === "function") {
        onTap();
      }
    },
    { passive: false }
  );
}

function setDesktopInventoryVisible(visible) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.setInventoryVisible(visible);
}

function setDesktopSpellbookVisible(visible) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.setSpellbookVisible(visible);
}

function setDesktopEquipmentVisible(visible) {
  if (!equipmentPanel) {
    return;
  }
  equipmentPanel.classList.toggle("hidden", !visible);
  if (visible) {
    updateEquipmentUI();
  }
}

function updateMobilePanelTabs() {
  if (!gameUI) {
    return;
  }
  if (!isMobilePanelMode() || !mobilePanelState.open) {
    mobilePanelTabs.classList.add("hidden");
    gameUI.classList.remove("mobile-panels-open");
    return;
  }

  const activePanel = getMobilePanelElement(mobilePanelState.activeTab);
  if (!activePanel) {
    mobilePanelTabs.classList.add("hidden");
    gameUI.classList.remove("mobile-panels-open");
    return;
  }

  if (mobilePanelTabs.parentElement !== activePanel) {
    activePanel.prepend(mobilePanelTabs);
  }
  mobilePanelTabs.classList.remove("hidden");
  mobileInventoryTabButton.classList.toggle("active", mobilePanelState.activeTab === "inventory");
  mobileEquipmentTabButton.classList.toggle("active", mobilePanelState.activeTab === "equipment");
  mobileSpellbookTabButton.classList.toggle("active", mobilePanelState.activeTab === "spellbook");
  gameUI.classList.add("mobile-panels-open");
}

function setMobilePanelTab(tabId, visible = true) {
  if (!isMobilePanelMode()) {
    return false;
  }
  const nextTab = String(tabId || "inventory").trim().toLowerCase();
  const normalizedTab = nextTab === "equipment" || nextTab === "spellbook" ? nextTab : "inventory";

  if (!visible) {
    if (mobilePanelState.open && mobilePanelState.activeTab === normalizedTab) {
      mobilePanelState.open = false;
    }
    inventoryPanel.classList.add("hidden");
    equipmentPanel.classList.add("hidden");
    spellbookPanel.classList.add("hidden");
    hideHoverTooltip();
    clearMobileTooltipHideTimer();
    updateMobilePanelTabs();
    updateMobileUtilityBar(getCurrentSelf());
    return true;
  }

  mobilePanelState.open = true;
  mobilePanelState.activeTab = normalizedTab;
  inventoryPanel.classList.toggle("hidden", normalizedTab !== "inventory");
  equipmentPanel.classList.toggle("hidden", normalizedTab !== "equipment");
  spellbookPanel.classList.toggle("hidden", normalizedTab !== "spellbook");

  if (normalizedTab === "inventory") {
    updateInventoryUI();
  } else if (normalizedTab === "equipment") {
    updateEquipmentUI();
  } else {
    updateSpellbookUI(getCurrentSelf());
  }

  updateMobilePanelTabs();
  updateMobileUtilityBar(getCurrentSelf());
  return true;
}

function closeMobilePanels() {
  if (!isMobilePanelMode()) {
    return;
  }
  setMobilePanelTab(mobilePanelState.activeTab, false);
}

function updateMobileUtilityBar(self = null) {
  if (!mobileUtilityBar || !mobileLootButton || !mobileBagButton) {
    return;
  }

  const mobileActive = isMobilePanelMode() && !!self;
  mobileUtilityBar.classList.toggle("hidden", !mobileActive);
  if (!mobileActive) {
    return;
  }

  const reachableLoot = getLootBagsWithinPickupRange(self);
  const lootCount = reachableLoot.length;
  mobileLootButton.classList.toggle("hidden", lootCount <= 0);
  mobileLootButton.textContent = lootCount > 1 ? `Loot x${lootCount}` : "Loot";
  mobileBagButton.classList.toggle("active", mobilePanelState.open);
}

function setInventoryVisible(visible) {
  if (isMobilePanelMode()) {
    setMobilePanelTab("inventory", visible);
    return;
  }
  if (!uiPanelTools) {
    return;
  }
  setDesktopInventoryVisible(visible);
}

function toggleInventoryPanel() {
  if (isMobilePanelMode()) {
    if (mobilePanelState.open && mobilePanelState.activeTab === "inventory") {
      closeMobilePanels();
    } else {
      setMobilePanelTab("inventory", true);
    }
    updateMobileUtilityBar(getCurrentSelf());
    return;
  }
  if (!uiPanelTools) {
    return;
  }
  setDesktopInventoryVisible(inventoryPanel.classList.contains("hidden"));
}

function setEquipmentVisible(visible) {
  if (isMobilePanelMode()) {
    setMobilePanelTab("equipment", visible);
    return;
  }
  if (!equipmentPanel) {
    return;
  }
  setDesktopEquipmentVisible(visible);
}

function toggleEquipmentPanel() {
  if (isMobilePanelMode()) {
    if (mobilePanelState.open && mobilePanelState.activeTab === "equipment") {
      closeMobilePanels();
    } else {
      setMobilePanelTab("equipment", true);
    }
    updateMobileUtilityBar(getCurrentSelf());
    return;
  }
  if (!equipmentPanel) {
    return;
  }
  setEquipmentVisible(equipmentPanel.classList.contains("hidden"));
}

function setSpellbookVisible(visible) {
  if (isMobilePanelMode()) {
    setMobilePanelTab("spellbook", visible);
    return;
  }
  if (!uiPanelTools) {
    return;
  }
  setDesktopSpellbookVisible(visible);
}

function toggleSpellbookPanel() {
  if (isMobilePanelMode()) {
    if (mobilePanelState.open && mobilePanelState.activeTab === "spellbook") {
      closeMobilePanels();
    } else {
      setMobilePanelTab("spellbook", true);
    }
    updateMobileUtilityBar(getCurrentSelf());
    return;
  }
  if (!uiPanelTools) {
    return;
  }
  setDesktopSpellbookVisible(spellbookPanel.classList.contains("hidden"));
}

if (mobileBagButton) {
  mobileBagButton.addEventListener("click", (event) => {
    event.preventDefault();
    resumeSpatialAudioContext();
    toggleInventoryPanel();
  });
}

if (mobileLootButton) {
  mobileLootButton.addEventListener(
    "touchstart",
    (event) => {
      if (!isMobilePanelMode()) {
        return;
      }
      resumeSpatialAudioContext();
      mobilePanelState.lootHoldTriggered = false;
      if (mobilePanelState.lootHoldTimer) {
        window.clearTimeout(mobilePanelState.lootHoldTimer);
      }
      mobilePanelState.lootHoldTimer = window.setTimeout(() => {
        mobilePanelState.lootHoldTimer = 0;
        mobilePanelState.lootHoldTriggered = pickupAllLootBagsInRange();
        mobilePanelState.suppressLootClickUntil = performance.now() + 420;
      }, 420);
      event.preventDefault();
    },
    { passive: false }
  );
  mobileLootButton.addEventListener(
    "touchend",
    (event) => {
      if (!isMobilePanelMode()) {
        return;
      }
      if (mobilePanelState.lootHoldTimer) {
        window.clearTimeout(mobilePanelState.lootHoldTimer);
        mobilePanelState.lootHoldTimer = 0;
      }
      if (!mobilePanelState.lootHoldTriggered) {
        pickupNearestLootBagInRange();
        mobilePanelState.suppressLootClickUntil = performance.now() + 420;
      }
      mobilePanelState.lootHoldTriggered = false;
      event.preventDefault();
      event.stopPropagation();
    },
    { passive: false }
  );
  mobileLootButton.addEventListener(
    "touchcancel",
    () => {
      if (mobilePanelState.lootHoldTimer) {
        window.clearTimeout(mobilePanelState.lootHoldTimer);
        mobilePanelState.lootHoldTimer = 0;
      }
      mobilePanelState.lootHoldTriggered = false;
    },
    { passive: true }
  );
  mobileLootButton.addEventListener("click", (event) => {
    if (performance.now() < (Number(mobilePanelState.suppressLootClickUntil) || 0)) {
      event.preventDefault();
      return;
    }
    resumeSpatialAudioContext();
    event.preventDefault();
    pickupNearestLootBagInRange();
  });
}

if (mobileInventoryTabButton) {
  mobileInventoryTabButton.addEventListener("click", () => setMobilePanelTab("inventory", true));
}
if (mobileEquipmentTabButton) {
  mobileEquipmentTabButton.addEventListener("click", () => setMobilePanelTab("equipment", true));
}
if (mobileSpellbookTabButton) {
  mobileSpellbookTabButton.addEventListener("click", () => setMobilePanelTab("spellbook", true));
}
if (mobilePanelCloseButton) {
  mobilePanelCloseButton.addEventListener("click", () => closeMobilePanels());
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
      suppressActionBarClickUntil = performance.now() + 180;
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
      dragState.equipmentSlot = "";
      dragState.itemId = "";
      event.dataTransfer.effectAllowed = "move";
    });
    slot.addEventListener("dragend", () => {
      suppressActionBarClickUntil = performance.now() + 120;
      clearDragState();
    });
    slot.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (performance.now() < suppressActionBarClickUntil) {
        return;
      }
      resumeSpatialAudioContext();
      executeBoundAction(slotId);
    });
    slot.addEventListener(
      "touchstart",
      (event) => {
        if (!isTouchJoystickEnabled() || mobileAbilityAimState.active) {
          return;
        }
        const touch = event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : null;
        if (!touch) {
          return;
        }
        resumeSpatialAudioContext();
        if (!beginMobileAbilityAim(slotId, touch.identifier, touch.clientX, touch.clientY)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false }
    );

    actionBar.appendChild(slot);

    actionSlotEls.set(slotId, {
      root: slot,
      progress,
      icon,
      name
    });
  }
  ensureActionBarTouchListenersBound();
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
    updateMobileUtilityBar(null);
    updateMobilePanelTabs();
    return;
  }

  actionUi.classList.remove("hidden");
  ensureActionBindingsForClass(self.classType);
  updateSpellbookUI(self);
  updateResourceBars(self);
  updateMobileUtilityBar(self);
  updateMobilePanelTabs();
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
    slot.root.classList.toggle("aiming", mobileAbilityAimState.active && mobileAbilityAimState.slotId === slotId);
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

function reportFrame(now = performance.now()) {
  if (!uiPanelTools) {
    return;
  }
  uiPanelTools.reportFrame(now);
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

function initializeDebugAdminControls() {
  if (debugRendererApplyButton) {
    debugRendererApplyButton.addEventListener("click", applyRendererModeFromDebugControls);
  }
  if (debugRendererSelect) {
    debugRendererSelect.addEventListener("change", applyRendererModeFromDebugControls);
  }
  if (debugCreateBotButton) {
    debugCreateBotButton.addEventListener("click", handleCreateBotPlayer);
  }
  if (debugToggleBotListButton) {
    debugToggleBotListButton.addEventListener("click", toggleBotListPanel);
  }
  if (debugToggleGearLabButton) {
    debugToggleGearLabButton.addEventListener("click", handleToggleDebugGearLab);
  }
  if (debugGearCloseButton) {
    debugGearCloseButton.addEventListener("click", () => setDebugGearVisible(false));
  }
  if (debugGearRerollAffixesButton) {
    debugGearRerollAffixesButton.addEventListener("click", rerollAllDebugGearAffixes);
  }
  document.addEventListener("click", (event) => {
    if (!botContextMenu || botContextMenu.classList.contains("hidden")) {
      if (debugGearPanel && debugGearState.visible && event.target && debugGearPanel.contains(event.target)) {
        return;
      }
    } else {
      if (event.target && botContextMenu.contains(event.target)) {
        return;
      }
      hideBotContextMenu();
    }
  });
  document.addEventListener("contextmenu", (event) => {
    if (!botContextMenu || botContextMenu.classList.contains("hidden")) {
      return;
    }
    if (event.target && botContextMenu.contains(event.target)) {
      return;
    }
    hideBotContextMenu();
  });
  updateRendererDebugControls();
  updateAdminDebugControls();
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

function isTouchJoystickEnabled() {
  return !!(
    ("ontouchstart" in window) ||
    (navigator && Number(navigator.maxTouchPoints) > 0) ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
  );
}

function updateTouchJoystickVisuals() {
  if (!mobileJoystick || !mobileJoystickBase || !mobileJoystickKnob || !mobileJoystickArrow) {
    return;
  }
  if (!touchJoystickState.active) {
    mobileJoystick.classList.add("hidden");
    return;
  }

  const originX = Number(touchJoystickState.originX) || 0;
  const originY = Number(touchJoystickState.originY) || 0;
  const currentX = Number(touchJoystickState.currentX) || originX;
  const currentY = Number(touchJoystickState.currentY) || originY;
  const dx = currentX - originX;
  const dy = currentY - originY;
  const angle = Math.atan2(dy, dx);
  const strength = clamp(Math.hypot(dx, dy) / Math.max(1, Number(touchJoystickState.radiusPx) || 1), 0, 1);

  mobileJoystick.classList.remove("hidden");
  mobileJoystickBase.style.transform = `translate(${originX}px, ${originY}px)`;
  mobileJoystickKnob.style.transform = `translate(${currentX}px, ${currentY}px)`;
  mobileJoystickArrow.style.opacity = strength > 0.08 ? String(0.18 + strength * 0.82) : "0";
  mobileJoystickArrow.style.transform = `translate(${originX}px, ${originY}px) rotate(${angle}rad) scale(${0.82 + strength * 0.42})`;
}

function beginTouchJoystick(touchId, screenX, screenY) {
  clearAutoMoveTarget();
  touchJoystickState.active = true;
  touchJoystickState.touchId = touchId;
  touchJoystickState.originX = Number(screenX) || 0;
  touchJoystickState.originY = Number(screenY) || 0;
  touchJoystickState.currentX = touchJoystickState.originX;
  touchJoystickState.currentY = touchJoystickState.originY;
  touchJoystickState.vectorDx = 0;
  touchJoystickState.vectorDy = 0;
  updateTouchJoystickVisuals();
}

function updateTouchJoystick(screenX, screenY) {
  if (!touchJoystickState.active) {
    return;
  }
  const rawDx = (Number(screenX) || 0) - touchJoystickState.originX;
  const rawDy = (Number(screenY) || 0) - touchJoystickState.originY;
  const rawLen = Math.hypot(rawDx, rawDy);
  const radius = Math.max(1, Number(touchJoystickState.radiusPx) || 1);
  const clampedLen = Math.min(radius, rawLen);
  const unitDx = rawLen > 0.0001 ? rawDx / rawLen : 0;
  const unitDy = rawLen > 0.0001 ? rawDy / rawLen : 0;

  touchJoystickState.currentX = touchJoystickState.originX + unitDx * clampedLen;
  touchJoystickState.currentY = touchJoystickState.originY + unitDy * clampedLen;
  if (rawLen > Math.max(0, Number(touchJoystickState.deadzonePx) || 0)) {
    touchJoystickState.vectorDx = unitDx;
    touchJoystickState.vectorDy = unitDy;
  } else {
    touchJoystickState.vectorDx = 0;
    touchJoystickState.vectorDy = 0;
  }
  updateTouchJoystickVisuals();
}

function resetTouchJoystick() {
  const changed =
    touchJoystickState.active ||
    Math.abs(Number(touchJoystickState.vectorDx) || 0) > 0.0001 ||
    Math.abs(Number(touchJoystickState.vectorDy) || 0) > 0.0001;
  touchJoystickState.active = false;
  touchJoystickState.touchId = null;
  touchJoystickState.originX = 0;
  touchJoystickState.originY = 0;
  touchJoystickState.currentX = 0;
  touchJoystickState.currentY = 0;
  touchJoystickState.vectorDx = 0;
  touchJoystickState.vectorDy = 0;
  updateTouchJoystickVisuals();
  return changed;
}

function endTouchJoystick() {
  return resetTouchJoystick();
}

function getMobileAbilityAimRadiusPx() {
  const viewportMin = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return clamp(viewportMin * 0.23, 104, 164);
}

function getMobileAbilityAimCanvasPoint(clientX, clientY) {
  if (!canvas) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((Number(clientX) || 0) - rect.left, 0, canvas.width),
    y: clamp((Number(clientY) || 0) - rect.top, 0, canvas.height)
  };
}

function getMobileAbilityAimFingerWorldTarget(self, clientX, clientY) {
  const canvasPoint = getMobileAbilityAimCanvasPoint(clientX, clientY);
  if (!self || !canvasPoint) {
    return null;
  }
  const worldPoint = screenToWorld(canvasPoint.x, canvasPoint.y, self);
  const direction = normalizeDirection(Number(worldPoint.x) - Number(self.x), Number(worldPoint.y) - Number(self.y));
  return direction
    ? {
        canvasPoint,
        worldPoint,
        direction,
        distance: Math.hypot(Number(worldPoint.x) - Number(self.x), Number(worldPoint.y) - Number(self.y))
      }
    : null;
}

function getMobileAbilityAimFallbackDirection(self) {
  const touchMoveDir = normalizeDirection(touchJoystickState.vectorDx, touchJoystickState.vectorDy);
  if (touchMoveDir) {
    return touchMoveDir;
  }
  const facingDir = normalizeDirection(self && self.lastDirection && self.lastDirection.dx, self && self.lastDirection && self.lastDirection.dy);
  if (facingDir) {
    return facingDir;
  }
  return { dx: 0, dy: 1 };
}

function usesVariableMobileAimDistance(actionId, actionDef) {
  const kind = String(actionDef && actionDef.kind || "").trim().toLowerCase();
  return actionId === "pickup_bag" || kind === "area" || kind === "summon" || kind === "teleport";
}

function supportsMobileAbilityAim(actionId, actionDef) {
  const resolvedActionId = String(actionId || "").trim();
  const kind = String(actionDef && actionDef.kind || "").trim().toLowerCase();
  const range = Math.max(0, Number(actionDef && actionDef.range) || 0);
  if (!resolvedActionId || resolvedActionId === "none") {
    return false;
  }
  if (kind === "meleecone") {
    return false;
  }
  if (kind === "selfbuff") {
    return false;
  }
  if (kind === "area" && range <= 0.001) {
    return false;
  }
  return range > 0.001;
}

function getMobileAimFallbackDistance(actionId, actionDef, range) {
  const resolvedRange = Math.max(0, Number(range) || 0);
  if (resolvedRange <= 0) {
    return 0;
  }
  if (usesVariableMobileAimDistance(actionId, actionDef)) {
    return clamp(resolvedRange * 0.68, Math.min(1.25, resolvedRange), resolvedRange);
  }
  return resolvedRange;
}

function findMobileAimSnapTarget(self, actionId, actionDef, direction, range) {
  const kind = String(actionDef && actionDef.kind || "").trim().toLowerCase();
  if (!self || !direction || !["projectile", "beam", "chain", "meleecone"].includes(kind)) {
    return null;
  }
  const maxRange = Math.max(0.75, Number(range) || 0);
  const fullAbilityDef = findAbilityDefById(actionId);
  const maxAngleRad =
    kind === "meleecone"
      ? clamp((((Number(fullAbilityDef && fullAbilityDef.coneAngleDeg) || 120) * Math.PI) / 180) * 0.45, 0.26, Math.PI * 0.72)
      : kind === "chain"
        ? 0.54
        : kind === "beam"
          ? 0.34
          : 0.3;
  const minDot = Math.cos(maxAngleRad);
  const beamWidth = Math.max(0.35, Number(fullAbilityDef && fullAbilityDef.beamWidth) || 0.5);
  let best = null;
  let bestScore = -Infinity;

  for (const mob of Array.isArray(gameState.mobs) ? gameState.mobs : []) {
    if (!mob || Number(mob.hp) <= 0) {
      continue;
    }
    const dx = Number(mob.x) - Number(self.x);
    const dy = Number(mob.y) - Number(self.y);
    const dist = Math.hypot(dx, dy);
    if (!Number.isFinite(dist) || dist <= 0.0001 || dist > maxRange + 0.85) {
      continue;
    }
    const dirX = dx / dist;
    const dirY = dy / dist;
    const dot = dirX * direction.dx + dirY * direction.dy;
    if (dot < minDot) {
      continue;
    }
    const lateralDistance = Math.abs(dx * direction.dy - dy * direction.dx);
    if ((kind === "beam" || kind === "chain") && lateralDistance > beamWidth + 0.45) {
      continue;
    }
    const score = dot * 4.2 - dist / Math.max(1, maxRange) - lateralDistance * 0.12;
    if (score <= bestScore) {
      continue;
    }
    bestScore = score;
    best = {
      id: mob.id,
      kind: "mob",
      x: Number(mob.x) || 0,
      y: Number(mob.y) || 0
    };
  }

  return best;
}

function updateMobileAbilityAimTarget() {
  if (!mobileAbilityAimState.active) {
    return false;
  }
  const self = getCurrentSelf();
  if (!self || self.hp <= 0) {
    return false;
  }
  const actionId = String(mobileAbilityAimState.abilityId || "");
  const actionDef = getActionDefById(actionId);
  const range = Math.max(0, getAbilityEffectiveRangeForSelf(actionId, self));
  const dragDx = Number(mobileAbilityAimState.currentClientX) - Number(mobileAbilityAimState.startClientX);
  const dragDy = Number(mobileAbilityAimState.currentClientY) - Number(mobileAbilityAimState.startClientY);
  const dragLen = Math.hypot(dragDx, dragDy);
  const radiusPx = Math.max(1, Number(mobileAbilityAimState.radiusPx) || 1);
  const deadzonePx = Math.max(0, Number(mobileAbilityAimState.deadzonePx) || 0);
  const fingerTarget = dragLen > deadzonePx
    ? getMobileAbilityAimFingerWorldTarget(
        self,
        mobileAbilityAimState.currentClientX,
        mobileAbilityAimState.currentClientY
      )
    : null;
  const direction = (fingerTarget && fingerTarget.direction) || getMobileAbilityAimFallbackDirection(self);
  if (!direction) {
    return false;
  }
  const variableDistance = usesVariableMobileAimDistance(actionId, actionDef);
  const fallbackDistance = getMobileAimFallbackDistance(actionId, actionDef, range);
  const distance =
    range <= 0
      ? 0
      : variableDistance
        ? (fingerTarget ? clamp(fingerTarget.distance, 0, range) : fallbackDistance)
        : range;
  const snapTarget = findMobileAimSnapTarget(self, actionId, actionDef, direction, range);

  mobileAbilityAimState.snappedTargetId = snapTarget ? snapTarget.id : null;
  mobileAbilityAimState.snappedTargetKind = snapTarget ? snapTarget.kind : "";
  if (snapTarget) {
    mobileAbilityAimState.targetX = snapTarget.x;
    mobileAbilityAimState.targetY = snapTarget.y;
    return true;
  }

  mobileAbilityAimState.targetX = Number(self.x) + direction.dx * distance;
  mobileAbilityAimState.targetY = Number(self.y) + direction.dy * distance;
  return true;
}

function resetMobileAbilityAim() {
  const changed = mobileAbilityAimState.active;
  mobileAbilityAimState.active = false;
  mobileAbilityAimState.touchId = null;
  mobileAbilityAimState.slotId = "";
  mobileAbilityAimState.abilityId = "";
  mobileAbilityAimState.currentClientX = 0;
  mobileAbilityAimState.currentClientY = 0;
  mobileAbilityAimState.startClientX = 0;
  mobileAbilityAimState.startClientY = 0;
  mobileAbilityAimState.targetX = 0;
  mobileAbilityAimState.targetY = 0;
  mobileAbilityAimState.snappedTargetId = null;
  mobileAbilityAimState.snappedTargetKind = "";
  if (changed) {
    updateActionBarUI(getCurrentSelf());
  }
  return changed;
}

function beginMobileAbilityAim(slotId, touchId, clientX, clientY) {
  if (!isTouchJoystickEnabled() || mobileAbilityAimState.active || abilityChannel.active) {
    return false;
  }
  const self = getCurrentSelf();
  if (!self || self.hp <= 0) {
    return false;
  }
  const binding = parseActionBinding(actionBindings.get(slotId) || makeActionBinding("none"));
  if (binding.kind !== "action") {
    return false;
  }
  const actionId = String(binding.id || "").trim();
  const actionDef = getActionDefById(actionId);
  if (!supportsMobileAbilityAim(actionId, actionDef)) {
    return false;
  }
  const now = performance.now();
  if (!hasEnoughManaForAbility(self, actionId) || !canUseAbilityNow(actionId, now, self)) {
    return false;
  }

  if (touchJoystickState.active) {
    endTouchJoystick();
    sendMove();
  }

  const radiusPx = getMobileAbilityAimRadiusPx();
  mobileAbilityAimState.active = true;
  mobileAbilityAimState.touchId = touchId;
  mobileAbilityAimState.slotId = String(slotId || "");
  mobileAbilityAimState.abilityId = actionId;
  mobileAbilityAimState.startClientX = Number(clientX) || 0;
  mobileAbilityAimState.startClientY = Number(clientY) || 0;
  mobileAbilityAimState.currentClientX = mobileAbilityAimState.startClientX;
  mobileAbilityAimState.currentClientY = mobileAbilityAimState.startClientY;
  mobileAbilityAimState.radiusPx = radiusPx;
  mobileAbilityAimState.deadzonePx = Math.round(radiusPx * 0.14);
  suppressActionBarClickUntil = now + 360;
  updateMobileAbilityAimTarget();
  updateActionBarUI(self);
  return true;
}

function updateMobileAbilityAim(clientX, clientY) {
  if (!mobileAbilityAimState.active) {
    return false;
  }
  mobileAbilityAimState.currentClientX = Number(clientX) || 0;
  mobileAbilityAimState.currentClientY = Number(clientY) || 0;
  return updateMobileAbilityAimTarget();
}

function commitMobileAbilityAim() {
  if (!mobileAbilityAimState.active) {
    return false;
  }
  const slotId = String(mobileAbilityAimState.slotId || "");
  const targetX = Number(mobileAbilityAimState.targetX);
  const targetY = Number(mobileAbilityAimState.targetY);
  const didCast =
    slotId &&
    Number.isFinite(targetX) &&
    Number.isFinite(targetY)
      ? executeBoundActionAt(slotId, targetX, targetY, { trackPointer: false })
      : false;
  suppressActionBarClickUntil = performance.now() + 360;
  resetMobileAbilityAim();
  return didCast;
}

function handleMobileAbilityAimTouchMove(event) {
  if (!mobileAbilityAimState.active) {
    return;
  }
  const touches = event.changedTouches || [];
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch.identifier !== mobileAbilityAimState.touchId) {
      continue;
    }
    updateMobileAbilityAim(touch.clientX, touch.clientY);
    event.preventDefault();
    return;
  }
}

function handleMobileAbilityAimTouchEnd(event) {
  if (!mobileAbilityAimState.active) {
    return;
  }
  const touches = event.changedTouches || [];
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch.identifier !== mobileAbilityAimState.touchId) {
      continue;
    }
    updateMobileAbilityAim(touch.clientX, touch.clientY);
    if (event.type === "touchcancel") {
      resetMobileAbilityAim();
    } else {
      commitMobileAbilityAim();
    }
    event.preventDefault();
    return;
  }
}

function ensureActionBarTouchListenersBound() {
  if (actionBarTouchListenersBound) {
    return;
  }
  actionBarTouchListenersBound = true;
  window.addEventListener("touchmove", handleMobileAbilityAimTouchMove, { passive: false });
  window.addEventListener("touchend", handleMobileAbilityAimTouchEnd, { passive: false });
  window.addEventListener("touchcancel", handleMobileAbilityAimTouchEnd, { passive: false });
}

function sendViewportToServer() {
  return sendJsonMessage({
    type: "viewport",
    viewportWidth: Math.max(1, Math.floor(Number(canvas.width) || 0)),
    viewportHeight: Math.max(1, Math.floor(Number(canvas.height) || 0))
  });
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
  resetTouchJoystick();
  resetMobileAbilityAim();
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
  clearSelfPositiveBuffs();
  clearSelfNegativeEffects();
  selfPositiveEffects.bloodWrath = null;
  remotePlayerStuns.clear();
  remotePlayerSlows.clear();
  remotePlayerBurns.clear();
  remotePlayerBloodWraths.clear();
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
      classType: String(meta.classType || getDefaultClassId()),
      appearance: meta.appearance && typeof meta.appearance === "object" ? meta.appearance : null
    });

    const existing = entityRuntime.players.get(meta.id);
    if (existing) {
      existing.name = String(meta.name || existing.name || `P${meta.id}`);
      existing.classType = String(meta.classType || existing.classType || getDefaultClassId());
      existing.appearance = meta.appearance && typeof meta.appearance === "object" ? meta.appearance : existing.appearance || null;
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
    const level = Math.max(1, Math.floor(Number(meta.level) || 1));
    const renderStyle = normalizeMobRenderStyle(meta.renderStyle);
    entityRuntime.mobMeta.set(meta.id, { name, level, renderStyle });

    const existing = entityRuntime.mobs.get(meta.id);
    if (existing) {
      existing.name = name;
      existing.level = level;
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
              name: String(entry.name || (itemDef && itemDef.name) || itemId)
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
      effect: entry.effect && typeof entry.effect === "object" ? entry.effect : null,
      isEquipment: !!entry.isEquipment,
      slot: String(entry.slot || ""),
      weaponClass: String(entry.weaponClass || ""),
      baseStats: entry.baseStats && typeof entry.baseStats === "object" ? { ...entry.baseStats } : null,
      itemLevelRange: Array.isArray(entry.itemLevelRange) ? entry.itemLevelRange.map((value) => Number(value) || 0) : null,
      tags: Array.isArray(entry.tags) ? entry.tags.map((value) => String(value || "")).filter(Boolean) : []
    });
  }
  updateInventoryUI();
  updateEquipmentUI();
  updateActionBarUI(getCurrentSelf());
}

function resolveAbilityIdHash(hashValue) {
  const hash = Number(hashValue) >>> 0;
  if (!hash) {
    return "";
  }
  return abilityIdsByHash.get(hash) || "";
}

function applyClassAndAbilityDefs(classes, abilities) {
  stopAllAbilityChannelAudio();
  abilityAudioRegistry.clear();
  abilityDefsById.clear();
  abilityIdsByHash.clear();
  registerStaticAbilityHashMappings();
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
      damageMode: String(normalizedEntry.damageMode || "instant"),
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
      jumpCount: Math.max(0, Number(normalizedEntry.jumpCount) || 0),
      jumpRange: Math.max(0, Number(normalizedEntry.jumpRange) || 0),
      jumpDamageReduction: clamp(Number(normalizedEntry.jumpDamageReduction) || 0, 0, 0.95),
      jumpCountPerLevel: Math.max(0, Number(normalizedEntry.jumpCountPerLevel) || 0),
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
    abilityIdsByHash.set(hashString32(id), id);
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
      movementSpeed: Math.max(0.1, Number(classDef.speed ?? classDef.movementSpeed) || 0.1),
      renderStyle: normalizeHumanoidRenderStyle(classDef.renderStyle),
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

  populateAdminBotClassOptions();
  updateAdminDebugControls();

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
    if (payload && typeof payload === "object" && payload.equipment) {
      applyEquipmentConfig(payload.equipment);
    }
    if (Array.isArray(payload.items)) {
      applyItemDefs(payload.items);
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function parseItemStateEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const itemId = String(raw.itemId || "").trim();
  const qty = Math.max(0, Math.floor(Number(raw.qty) || 0));
  if (!itemId || qty <= 0) {
    return null;
  }
  const slot = { itemId, qty };
  if (raw.instanceId !== undefined && raw.instanceId !== null) {
    slot.instanceId = String(raw.instanceId);
  }
  if (typeof raw.name === "string" && raw.name.trim()) {
    slot.name = raw.name.trim();
  }
  if (typeof raw.rarity === "string" && raw.rarity.trim()) {
    slot.rarity = raw.rarity.trim();
  }
  if (typeof raw.slot === "string" && raw.slot.trim()) {
    slot.slot = raw.slot.trim();
  }
  if (typeof raw.weaponClass === "string" && raw.weaponClass.trim()) {
    slot.weaponClass = raw.weaponClass.trim();
  }
  if (raw.isEquipment) {
    slot.isEquipment = true;
  }
  if (Number.isFinite(Number(raw.itemLevel))) {
    slot.itemLevel = Math.max(1, Math.floor(Number(raw.itemLevel)));
  }
  if (raw.baseStats && typeof raw.baseStats === "object") {
    slot.baseStats = { ...raw.baseStats };
  }
  if (Array.isArray(raw.tags)) {
    slot.tags = raw.tags.map((value) => String(value || "")).filter(Boolean);
  }
  if (Array.isArray(raw.affixes)) {
    slot.affixes = raw.affixes;
  }
  if (Array.isArray(raw.prefixes)) {
    slot.prefixes = raw.prefixes;
  }
  if (Array.isArray(raw.suffixes)) {
    slot.suffixes = raw.suffixes;
  }
  return slot;
}

function applyEquipmentConfig(equipment) {
  const slotIds = Array.isArray(equipment && equipment.itemSlots)
    ? equipment.itemSlots.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const itemRarities =
    equipment && equipment.itemRarities && typeof equipment.itemRarities === "object" ? equipment.itemRarities : {};
  const debugBaseItems = Array.isArray(equipment && equipment.debugBaseItems) ? equipment.debugBaseItems : [];
  const debugPrefixes = Array.isArray(equipment && equipment.debugPrefixes) ? equipment.debugPrefixes : [];
  const debugSuffixes = Array.isArray(equipment && equipment.debugSuffixes) ? equipment.debugSuffixes : [];
  const debugRarities = Array.isArray(equipment && equipment.debugRarities) ? equipment.debugRarities : [];
  equipmentConfigState.itemSlots = slotIds;
  equipmentConfigState.itemRarities = itemRarities;
  equipmentConfigState.debugBaseItems = debugBaseItems;
  equipmentConfigState.debugPrefixes = debugPrefixes;
  equipmentConfigState.debugSuffixes = debugSuffixes;
  equipmentConfigState.debugRarities = debugRarities;
  equipmentConfigState.maxItemLevel = Math.max(1, Math.floor(Number(equipment && equipment.maxItemLevel) || 1));
  const nextSlots = {};
  for (const slotId of slotIds) {
    nextSlots[slotId] = equipmentState.slots[slotId] || null;
  }
  equipmentState.slots = nextSlots;
  updateEquipmentUI();
  if (debugGearState.visible) {
    rerollDebugGearLab();
  }
}

function randomDebugInt(min, max) {
  const low = Math.floor(Math.min(Number(min) || 0, Number(max) || 0));
  const high = Math.floor(Math.max(Number(min) || 0, Number(max) || 0));
  return low + Math.floor(Math.random() * (high - low + 1));
}

function pickRandomEntry(list) {
  const entries = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!entries.length) {
    return null;
  }
  return entries[randomDebugInt(0, entries.length - 1)] || null;
}

function rollDebugModifierValue(modifier) {
  if (!modifier || typeof modifier !== "object") {
    return 0;
  }
  const min = Number(modifier.rollMin);
  const max = Number(modifier.rollMax);
  const low = Math.min(Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : Number.isFinite(min) ? min : 0);
  const high = Math.max(Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : Number.isFinite(min) ? min : 0);
  const areIntegers = Math.abs(low - Math.round(low)) < 0.001 && Math.abs(high - Math.round(high)) < 0.001;
  if (areIntegers) {
    return randomDebugInt(Math.round(low), Math.round(high));
  }
  return Math.round((low + Math.random() * (high - low)) * 100) / 100;
}

function filterDebugAffixPool(pool, baseItem, itemLevel) {
  const tags = new Set(Array.isArray(baseItem && baseItem.tags) ? baseItem.tags.map((value) => String(value || "").trim()) : []);
  const slotId = String(baseItem && baseItem.slot || "").trim();
  return (Array.isArray(pool) ? pool : []).filter((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    if (itemLevel < Math.max(1, Math.floor(Number(entry.minItemLevel) || 1))) {
      return false;
    }
    const allowedSlots = Array.isArray(entry.allowedSlots) ? entry.allowedSlots.map((value) => String(value || "").trim()).filter(Boolean) : [];
    if (allowedSlots.length && !allowedSlots.includes(slotId)) {
      return false;
    }
    const requiredTags = Array.isArray(entry.requiredItemTagsAny)
      ? entry.requiredItemTagsAny.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (requiredTags.length) {
      let matched = false;
      for (const tag of requiredTags) {
        if (tags.has(tag)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return false;
      }
    }
    return true;
  });
}

function pickUniqueRandomEntries(pool, count) {
  const available = Array.isArray(pool) ? pool.slice() : [];
  const results = [];
  let remaining = Math.max(0, Math.floor(Number(count) || 0));
  while (remaining > 0 && available.length > 0) {
    const index = randomDebugInt(0, available.length - 1);
    results.push(available[index]);
    available.splice(index, 1);
    remaining -= 1;
  }
  return results;
}

function buildDebugAffixInstances(entries, kind) {
  return (Array.isArray(entries) ? entries : []).map((affix) => ({
    id: String(affix.id || ""),
    name: String(affix.name || affix.id || ""),
    kind,
    modifiers: (Array.isArray(affix.modifiers) ? affix.modifiers : [])
      .map((modifier) => ({
        stat: String(modifier.stat || ""),
        value: rollDebugModifierValue(modifier)
      }))
      .filter((modifier) => modifier.stat && Number.isFinite(modifier.value) && modifier.value !== 0)
  }));
}

function buildDebugEquipmentDisplayName(baseItem, prefixes, suffixes) {
  const prefixText = (Array.isArray(prefixes) ? prefixes : []).map((entry) => entry.name).filter(Boolean).join(" ");
  const suffixText = (Array.isArray(suffixes) ? suffixes : []).map((entry) => entry.name).filter(Boolean).join(" ");
  const parts = [];
  if (prefixText) {
    parts.push(prefixText);
  }
  parts.push(String(baseItem && baseItem.name || "Item"));
  if (suffixText) {
    parts.push(suffixText);
  }
  return parts.join(" ");
}

function pickDebugBaseItemForLevel(slotId, itemLevel) {
  const candidates = getDebugBaseItemPool().filter(
    (entry) => String(entry && entry.slot || "").trim() === String(slotId || "").trim()
  );
  if (!candidates.length) {
    return null;
  }
  const exact = candidates.filter((entry) => {
    const range = Array.isArray(entry.itemLevelRange) ? entry.itemLevelRange : [1, 1];
    const minLevel = Math.max(1, Math.floor(Number(range[0]) || 1));
    const maxLevel = Math.max(minLevel, Math.floor(Number(range[1]) || minLevel));
    return itemLevel >= minLevel && itemLevel <= maxLevel;
  });
  if (exact.length) {
    return pickRandomEntry(exact);
  }
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const entry of candidates) {
    const range = Array.isArray(entry.itemLevelRange) ? entry.itemLevelRange : [1, 1];
    const minLevel = Math.max(1, Math.floor(Number(range[0]) || 1));
    const maxLevel = Math.max(minLevel, Math.floor(Number(range[1]) || minLevel));
    const mid = (minLevel + maxLevel) * 0.5;
    const distance = Math.abs(mid - itemLevel);
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best || null;
}

function getDebugBaseItemPool() {
  const configured = Array.isArray(equipmentConfigState.debugBaseItems) ? equipmentConfigState.debugBaseItems.filter(Boolean) : [];
  if (configured.length) {
    return configured;
  }
  const derived = [];
  for (const itemDef of itemDefsById.values()) {
    if (!itemDef || !itemDef.isEquipment) {
      continue;
    }
    derived.push({
      id: String(itemDef.id || ""),
      name: String(itemDef.name || itemDef.id || ""),
      slot: String(itemDef.slot || "").trim(),
      weaponClass: String(itemDef.weaponClass || "").trim(),
      itemLevelRange: Array.isArray(itemDef.itemLevelRange) ? [...itemDef.itemLevelRange] : [1, 1],
      tags: Array.isArray(itemDef.tags) ? [...itemDef.tags] : [],
      baseStats: itemDef.baseStats && typeof itemDef.baseStats === "object" ? { ...itemDef.baseStats } : {}
    });
  }
  return derived;
}

function getDebugMaxItemLevel() {
  const configured = Math.max(1, Math.floor(Number(equipmentConfigState.maxItemLevel) || 1));
  const baseItems = getDebugBaseItemPool();
  let derivedMax = 1;
  for (const entry of baseItems) {
    const range = Array.isArray(entry && entry.itemLevelRange) ? entry.itemLevelRange : [1, 1];
    const maxLevel = Math.max(1, Math.floor(Number(range[1]) || Number(range[0]) || 1));
    if (maxLevel > derivedMax) {
      derivedMax = maxLevel;
    }
  }
  return Math.max(configured, derivedMax, 50);
}

function getDebugRarityPool() {
  const configured = Array.isArray(equipmentConfigState.debugRarities) ? equipmentConfigState.debugRarities.filter(Boolean) : [];
  const merged = new Map();
  for (const entry of configured) {
    const id = String(entry && entry.id || "").trim().toLowerCase();
    if (!id) {
      continue;
    }
    merged.set(id, {
      id,
      prefixMin: Math.max(0, Math.floor(Number(entry.prefixMin) || 0)),
      prefixMax: Math.max(0, Math.floor(Number(entry.prefixMax) || 0)),
      suffixMin: Math.max(0, Math.floor(Number(entry.suffixMin) || 0)),
      suffixMax: Math.max(0, Math.floor(Number(entry.suffixMax) || 0)),
      color: entry && entry.color ? String(entry.color) : ""
    });
  }
  const itemRarities = equipmentConfigState.itemRarities && typeof equipmentConfigState.itemRarities === "object"
    ? equipmentConfigState.itemRarities
    : {};
  for (const rarityId of Object.keys(itemRarities)) {
    const id = String(rarityId || "").trim().toLowerCase();
    if (!id) {
      continue;
    }
    const existing = merged.get(id);
    const fallbackRule = DEFAULT_DEBUG_RARITY_RULES[id] || DEFAULT_DEBUG_RARITY_RULES.normal;
    merged.set(id, {
      id,
      prefixMin: existing ? existing.prefixMin : fallbackRule.prefixMin,
      prefixMax: existing ? existing.prefixMax : fallbackRule.prefixMax,
      suffixMin: existing ? existing.suffixMin : fallbackRule.suffixMin,
      suffixMax: existing ? existing.suffixMax : fallbackRule.suffixMax,
      color:
        (itemRarities[rarityId] && itemRarities[rarityId].color ? String(itemRarities[rarityId].color) : "") ||
        (existing && existing.color) ||
        ""
    });
  }
  for (const rarityId of Object.keys(DEFAULT_ITEM_RARITY_COLORS)) {
    const id = String(rarityId || "").trim().toLowerCase();
    if (!id || merged.has(id)) {
      continue;
    }
    merged.set(id, {
      id,
      prefixMin: (DEFAULT_DEBUG_RARITY_RULES[id] || DEFAULT_DEBUG_RARITY_RULES.normal).prefixMin,
      prefixMax: (DEFAULT_DEBUG_RARITY_RULES[id] || DEFAULT_DEBUG_RARITY_RULES.normal).prefixMax,
      suffixMin: (DEFAULT_DEBUG_RARITY_RULES[id] || DEFAULT_DEBUG_RARITY_RULES.normal).suffixMin,
      suffixMax: (DEFAULT_DEBUG_RARITY_RULES[id] || DEFAULT_DEBUG_RARITY_RULES.normal).suffixMax,
      color: DEFAULT_ITEM_RARITY_COLORS[id] || ""
    });
  }
  const order = ["normal", "magic", "rare", "epic", "legendary", "mythic", "divine"];
  return Array.from(merged.values()).sort((a, b) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);
    if (indexA >= 0 && indexB >= 0) {
      return indexA - indexB;
    }
    if (indexA >= 0) {
      return -1;
    }
    if (indexB >= 0) {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });
}

function getDebugPrefixPool() {
  const configured = Array.isArray(equipmentConfigState.debugPrefixes) ? equipmentConfigState.debugPrefixes.filter(Boolean) : [];
  return configured.length ? configured : DEBUG_GEAR_FALLBACK_PREFIXES;
}

function getDebugSuffixPool() {
  const configured = Array.isArray(equipmentConfigState.debugSuffixes) ? equipmentConfigState.debugSuffixes.filter(Boolean) : [];
  return configured.length ? configured : DEBUG_GEAR_FALLBACK_SUFFIXES;
}

function rollDebugEquipmentItem(forcedRarityId = "") {
  const debugBaseItems = getDebugBaseItemPool();
  const debugRarities = getDebugRarityPool();
  const debugPrefixes = getDebugPrefixPool();
  const debugSuffixes = getDebugSuffixPool();
  const slotFamilies = Array.from(
    new Set(debugBaseItems.map((entry) => String(entry.slot || "").trim()).filter(Boolean))
  );
  const baseSlot = pickRandomEntry(slotFamilies);
  if (!baseSlot) {
    return null;
  }
  const maxItemLevel = getDebugMaxItemLevel();
  const itemLevel = randomDebugInt(1, maxItemLevel);
  const baseItem = pickDebugBaseItemForLevel(baseSlot, itemLevel);
  const rarity =
    forcedRarityId
      ? debugRarities.find((entry) => String(entry && entry.id || "").trim().toLowerCase() === String(forcedRarityId).trim().toLowerCase()) || null
      : pickRandomEntry(debugRarities);
  if (!baseItem || !rarity) {
    return null;
  }
  const prefixPool = filterDebugAffixPool(debugPrefixes, baseItem, itemLevel);
  const suffixPool = filterDebugAffixPool(debugSuffixes, baseItem, itemLevel);
  const prefixCount = randomDebugInt(Number(rarity.prefixMin) || 0, Number(rarity.prefixMax) || 0);
  const suffixCount = randomDebugInt(Number(rarity.suffixMin) || 0, Number(rarity.suffixMax) || 0);
  const prefixes = buildDebugAffixInstances(pickUniqueRandomEntries(prefixPool, prefixCount), "prefix");
  const suffixes = buildDebugAffixInstances(pickUniqueRandomEntries(suffixPool, suffixCount), "suffix");
  const affixes = [...prefixes, ...suffixes];
  return {
    itemId: String(baseItem.id || ""),
    qty: 1,
    instanceId: `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: buildDebugEquipmentDisplayName(baseItem, prefixes, suffixes),
    rarity: String(rarity.id || "normal"),
    slot: String(baseItem.slot || ""),
    weaponClass: String(baseItem.weaponClass || ""),
    itemLevel,
    isEquipment: true,
    tags: Array.isArray(baseItem.tags) ? [...baseItem.tags] : [],
    baseStats: baseItem.baseStats && typeof baseItem.baseStats === "object" ? { ...baseItem.baseStats } : {},
    affixes,
    prefixes,
    suffixes
  };
}

function getDebugGearSlotIds() {
  return Array.isArray(equipmentConfigState.itemSlots) ? equipmentConfigState.itemSlots.slice() : [];
}

function getDebugGearEquipmentSlots() {
  const slots = {};
  for (const slotId of getDebugGearSlotIds()) {
    slots[slotId] = debugGearState.slotStates[slotId] && debugGearState.slotStates[slotId].itemData
      ? debugGearState.slotStates[slotId].itemData
      : null;
  }
  return slots;
}

function getDebugRarityIndex(rarityId) {
  const pool = getDebugRarityPool();
  const normalized = String(rarityId || "").trim().toLowerCase();
  const index = pool.findIndex((entry) => String(entry && entry.id || "").trim().toLowerCase() === normalized);
  return index >= 0 ? index : 0;
}

function getDebugRarityByIndex(index) {
  const pool = getDebugRarityPool();
  if (!pool.length) {
    return { id: "normal", prefixMin: 0, prefixMax: 0, suffixMin: 0, suffixMax: 0 };
  }
  const safeIndex = clamp(Math.floor(Number(index) || 0), 0, pool.length - 1);
  return pool[safeIndex] || pool[0];
}

function buildDebugEquipmentItemFromBase(baseItem, itemLevel, rarityId) {
  const rarityPool = getDebugRarityPool();
  const debugPrefixes = getDebugPrefixPool();
  const debugSuffixes = getDebugSuffixPool();
  const rarity =
    rarityPool.find((entry) => String(entry && entry.id || "").trim().toLowerCase() === String(rarityId || "").trim().toLowerCase()) ||
    rarityPool[0] ||
    { id: "normal", prefixMin: 0, prefixMax: 0, suffixMin: 0, suffixMax: 0 };
  const prefixPool = filterDebugAffixPool(debugPrefixes, baseItem, itemLevel);
  const suffixPool = filterDebugAffixPool(debugSuffixes, baseItem, itemLevel);
  const prefixCount = randomDebugInt(Number(rarity.prefixMin) || 0, Number(rarity.prefixMax) || 0);
  const suffixCount = randomDebugInt(Number(rarity.suffixMin) || 0, Number(rarity.suffixMax) || 0);
  const prefixes = buildDebugAffixInstances(pickUniqueRandomEntries(prefixPool, prefixCount), "prefix");
  const suffixes = buildDebugAffixInstances(pickUniqueRandomEntries(suffixPool, suffixCount), "suffix");
  const affixes = [...prefixes, ...suffixes];
  return {
    itemId: String(baseItem.id || ""),
    qty: 1,
    instanceId: `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: buildDebugEquipmentDisplayName(baseItem, prefixes, suffixes),
    rarity: String(rarity.id || "normal"),
    slot: String(baseItem.slot || ""),
    weaponClass: String(baseItem.weaponClass || ""),
    itemLevel,
    isEquipment: true,
    tags: Array.isArray(baseItem.tags) ? [...baseItem.tags] : [],
    baseStats: baseItem.baseStats && typeof baseItem.baseStats === "object" ? { ...baseItem.baseStats } : {},
    affixes,
    prefixes,
    suffixes
  };
}

function rollDebugEquipmentItemForSlot(slotId, itemLevel, rarityId, preferredBaseItemId = "") {
  const slotFamily = getEquipmentSlotFamily(slotId);
  const basePool = getDebugBaseItemPool();
  let baseItem = null;
  if (preferredBaseItemId) {
    baseItem =
      basePool.find(
        (entry) =>
          String(entry && entry.id || "").trim() === String(preferredBaseItemId || "").trim() &&
          String(entry && entry.slot || "").trim() === String(slotFamily || "").trim()
      ) || null;
  }
  if (!baseItem) {
    baseItem = pickDebugBaseItemForLevel(slotFamily, itemLevel);
  }
  if (!baseItem) {
    return null;
  }
  return buildDebugEquipmentItemFromBase(baseItem, itemLevel, rarityId);
}

function getDebugItemAffixSignature(itemData) {
  if (!itemData || typeof itemData !== "object") {
    return "";
  }
  const affixes = Array.isArray(itemData.affixes) ? itemData.affixes : [];
  return JSON.stringify(
    affixes.map((affix) => ({
      id: String(affix && affix.id || ""),
      modifiers: (Array.isArray(affix && affix.modifiers) ? affix.modifiers : []).map((modifier) => ({
        stat: String(modifier && modifier.stat || ""),
        value: Number(modifier && modifier.value) || 0
      }))
    }))
  );
}

function inferDebugGearPreviewClassType() {
  const slots = getDebugGearEquipmentSlots();
  const mainHand = slots.mainHand || null;
  const offHand = slots.offHand || null;
  const chest = slots.chest || null;
  const head = slots.head || null;
  const mainWeapon = toLowerWord(mainHand && mainHand.weaponClass);
  const combinedText = [head && head.name, chest && chest.name, mainHand && mainHand.name, offHand && offHand.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    mainWeapon === "bow" ||
    combinedText.includes("hood") ||
    combinedText.includes("leather")
  ) {
    return "ranger";
  }
  if (
    mainWeapon === "staff" ||
    mainWeapon === "wand" ||
    mainWeapon === "orb" ||
    combinedText.includes("wizard") ||
    combinedText.includes("robe") ||
    combinedText.includes("arcane")
  ) {
    return "mage";
  }
  if (
    mainWeapon === "sword" ||
    mainWeapon === "axe" ||
    (offHand && Array.isArray(offHand.tags) && offHand.tags.some((tag) => String(tag || "").toLowerCase() === "shield")) ||
    combinedText.includes("plate") ||
    combinedText.includes("helm")
  ) {
    return "warrior";
  }
  return String(selfStatic && selfStatic.classType || "warrior").trim().toLowerCase() || "warrior";
}

function rerollDebugGearSlot(slotId, options = {}) {
  const current =
    debugGearState.slotStates[slotId] && typeof debugGearState.slotStates[slotId] === "object"
      ? debugGearState.slotStates[slotId]
      : null;
  const maxItemLevel = getDebugMaxItemLevel();
  const itemLevel = clamp(
    Math.floor(Number(options.itemLevel !== undefined ? options.itemLevel : current && current.itemLevel) || 1),
    1,
    maxItemLevel
  );
  const rarityId = String(options.rarityId || (current && current.rarityId) || "normal");
  const preferredBaseItemId =
    options.keepBaseItem && current && current.itemData && current.itemData.itemId
      ? current.itemData.itemId
      : "";
  let itemData = rollDebugEquipmentItemForSlot(slotId, itemLevel, rarityId, preferredBaseItemId);
  if (options.forceAffixChange && current && current.itemData && String(rarityId).toLowerCase() !== "normal") {
    const previousSignature = getDebugItemAffixSignature(current.itemData);
    let attempt = 0;
    while (attempt < 6 && itemData && getDebugItemAffixSignature(itemData) === previousSignature) {
      itemData = rollDebugEquipmentItemForSlot(slotId, itemLevel, rarityId, preferredBaseItemId);
      attempt += 1;
    }
  }
  debugGearState.slotStates[slotId] = {
    itemLevel,
    rarityId,
    itemData
  };
}

function rerollAllDebugGearAffixes() {
  for (const slotId of getDebugGearSlotIds()) {
    rerollDebugGearSlot(slotId, { keepBaseItem: true, forceAffixChange: true });
  }
  renderDebugGearLab();
}

function drawDebugGearPreviewCharacter() {
  if (!debugGearPreviewCanvas) {
    return;
  }
  const previewCtx = debugGearPreviewCanvas.getContext("2d");
  if (!previewCtx) {
    return;
  }
  previewCtx.clearRect(0, 0, debugGearPreviewCanvas.width, debugGearPreviewCanvas.height);
  if (!sharedCreateHumanoidRenderTools && !humanoidRenderTools) {
    return;
  }
  const previewTools = sharedCreateHumanoidRenderTools
    ? sharedCreateHumanoidRenderTools({
        ctx: previewCtx,
        clamp,
        lerp,
        hashString,
        sanitizeCssColor
      })
    : humanoidRenderTools;
  if (!previewTools || typeof previewTools.drawHumanoid !== "function") {
    return;
  }
  debugGearState.previewClassType = inferDebugGearPreviewClassType();
  const style =
    getClassRenderStyle(debugGearState.previewClassType) || {
      rigType: "humanoid",
      species: "human",
      archetype: debugGearState.previewClassType
    };
  previewTools.drawHumanoid({
    entity: { id: "debug-gear-preview", x: 0, y: 0 },
    entityKey: "debug-gear-preview",
    p: { x: debugGearPreviewCanvas.width * 0.5, y: debugGearPreviewCanvas.height * 0.56 },
    style: {
      ...style,
      sizeScale: clamp(Number(style.sizeScale) || 1, 0.7, 1.18)
    },
    equipmentSlots: getDebugGearEquipmentSlots(),
    attackState: null,
    castState: null,
    aimWorldX: 1,
    aimWorldY: 0,
    useDefaultGearFallback: false,
    isSelf: false
  });
}

function renderDebugGearPreviewSlots() {
  if (!debugGearPreviewLayout) {
    return;
  }
  for (const anchor of Array.from(debugGearPreviewLayout.querySelectorAll(".debug-gear-anchor"))) {
    anchor.remove();
  }
  for (const slotId of getDebugGearSlotIds()) {
    const slotLayout = EQUIPMENT_SLOT_LAYOUT[slotId] || { x: 50, y: 50, label: humanizeKey(slotId) };
    const anchor = document.createElement("div");
    const horizontalRole = slotLayout.x < 35 ? "left-anchor" : slotLayout.x > 65 ? "right-anchor" : "center-anchor";
    anchor.className = `debug-gear-anchor ${horizontalRole}${slotLayout.kind === "belt" ? " belt-anchor" : ""}`;
    anchor.style.left = `${slotLayout.x}%`;
    anchor.style.top = `${slotLayout.y}%`;

    const slotEl = document.createElement("div");
    slotEl.className = `inventory-slot debug-gear-slot${slotLayout.kind === "belt" ? " belt-slot" : ""}`;
    const slotState = debugGearState.slotStates[slotId] || null;
    const itemData = slotState && slotState.itemData ? slotState.itemData : null;
    if (itemData && itemData.itemId) {
      slotEl.classList.add("has-item");
      applyItemRarityChrome(slotEl, itemData);
      bindItemTooltip(slotEl, itemData);
      const iconEl = document.createElement("div");
      iconEl.className = "inv-icon";
      iconEl.style.backgroundImage = `url(${getItemIconUrl(itemData)})`;
      slotEl.appendChild(iconEl);
    }

    const labelEl = document.createElement("div");
    labelEl.className = "debug-gear-slot-label";
    labelEl.textContent = slotLayout.label || humanizeKey(slotId);

    anchor.appendChild(slotEl);
    anchor.appendChild(labelEl);
    debugGearPreviewLayout.appendChild(anchor);
  }
}

function renderDebugGearControls() {
  if (!debugGearControls) {
    return;
  }
  debugGearControls.innerHTML = "";
  const rarityPool = getDebugRarityPool();
  const maxItemLevel = getDebugMaxItemLevel();
  for (const slotId of getDebugGearSlotIds()) {
    const slotState = debugGearState.slotStates[slotId] || null;
    const itemData = slotState && slotState.itemData ? slotState.itemData : null;
    const rowEl = document.createElement("div");
    rowEl.className = "debug-gear-control-row";

    const labelWrap = document.createElement("div");
    const labelEl = document.createElement("div");
    labelEl.className = "debug-gear-control-label";
    labelEl.textContent = (EQUIPMENT_SLOT_LAYOUT[slotId] && EQUIPMENT_SLOT_LAYOUT[slotId].label) || humanizeKey(slotId);
    const metaEl = document.createElement("div");
    metaEl.className = "debug-gear-control-meta";
    metaEl.textContent = itemData && itemData.name ? itemData.name : "No item";
    labelWrap.appendChild(labelEl);
    labelWrap.appendChild(metaEl);

    const fieldsEl = document.createElement("div");
    fieldsEl.className = "debug-gear-control-fields";

    const levelField = document.createElement("div");
    levelField.className = "debug-gear-control-field";
    const levelLabel = document.createElement("div");
    levelLabel.className = "debug-gear-control-field-label";
    levelLabel.textContent = "iLvl";
    const levelInput = document.createElement("input");
    levelInput.type = "range";
    levelInput.min = "1";
    levelInput.max = String(maxItemLevel);
    levelInput.step = "1";
    levelInput.value = String(slotState && slotState.itemLevel ? slotState.itemLevel : 1);
    const levelValue = document.createElement("div");
    levelValue.className = "debug-gear-control-field-value";
    levelValue.textContent = String(levelInput.value);
    const applyLevelChange = () => {
      const currentSlotState = debugGearState.slotStates[slotId] || null;
      levelValue.textContent = String(levelInput.value);
      rerollDebugGearSlot(slotId, {
        itemLevel: Number(levelInput.value),
        rarityId: currentSlotState && currentSlotState.rarityId ? currentSlotState.rarityId : "normal"
      });
      refreshDebugGearLabPreviewOnly();
      const updatedState = debugGearState.slotStates[slotId] || null;
      metaEl.textContent = updatedState && updatedState.itemData && updatedState.itemData.name ? updatedState.itemData.name : "No item";
    };
    levelInput.addEventListener("input", applyLevelChange);
    levelInput.addEventListener("change", () => renderDebugGearControls());
    levelField.appendChild(levelLabel);
    levelField.appendChild(levelInput);
    levelField.appendChild(levelValue);

    const rarityField = document.createElement("div");
    rarityField.className = "debug-gear-control-field";
    const rarityLabel = document.createElement("div");
    rarityLabel.className = "debug-gear-control-field-label";
    rarityLabel.textContent = "Rarity";
    const rarityInput = document.createElement("input");
    rarityInput.type = "range";
    rarityInput.min = "0";
    rarityInput.max = String(Math.max(0, rarityPool.length - 1));
    rarityInput.step = "1";
    rarityInput.value = String(getDebugRarityIndex(slotState && slotState.rarityId ? slotState.rarityId : "normal"));
    const rarityValue = document.createElement("div");
    rarityValue.className = "debug-gear-control-field-value";
    rarityValue.textContent = humanizeKey(getDebugRarityByIndex(rarityInput.value).id);
    const applyRarityChange = () => {
      const currentSlotState = debugGearState.slotStates[slotId] || null;
      const rarity = getDebugRarityByIndex(rarityInput.value);
      rarityValue.textContent = humanizeKey(rarity.id);
      rerollDebugGearSlot(slotId, {
        itemLevel: currentSlotState && currentSlotState.itemLevel ? currentSlotState.itemLevel : 1,
        rarityId: rarity.id,
        keepBaseItem: true
      });
      refreshDebugGearLabPreviewOnly();
      const updatedState = debugGearState.slotStates[slotId] || null;
      metaEl.textContent = updatedState && updatedState.itemData && updatedState.itemData.name ? updatedState.itemData.name : "No item";
    };
    rarityInput.addEventListener("input", applyRarityChange);
    rarityInput.addEventListener("change", () => renderDebugGearControls());
    rarityField.appendChild(rarityLabel);
    rarityField.appendChild(rarityInput);
    rarityField.appendChild(rarityValue);

    fieldsEl.appendChild(levelField);
    fieldsEl.appendChild(rarityField);
    rowEl.appendChild(labelWrap);
    rowEl.appendChild(fieldsEl);
    debugGearControls.appendChild(rowEl);
  }
}

function renderDebugGearLab() {
  hideHoverTooltip();
  drawDebugGearPreviewCharacter();
  renderDebugGearPreviewSlots();
  renderDebugGearControls();
}

function refreshDebugGearLabPreviewOnly() {
  hideHoverTooltip();
  drawDebugGearPreviewCharacter();
  renderDebugGearPreviewSlots();
}

function rerollDebugGearLab() {
  debugGearState.slotStates = {};
  const maxItemLevel = getDebugMaxItemLevel();
  const rarityPool = getDebugRarityPool();
  for (const slotId of getDebugGearSlotIds()) {
    const itemLevel = randomDebugInt(1, maxItemLevel);
    const rarity = pickRandomEntry(rarityPool) || { id: "normal" };
    rerollDebugGearSlot(slotId, {
      itemLevel,
      rarityId: rarity.id
    });
  }
  renderDebugGearLab();
}

function setDebugGearVisible(visible) {
  debugGearState.visible = !!visible;
  if (debugGearPanel) {
    debugGearPanel.classList.toggle("hidden", !debugGearState.visible);
  }
  if (!debugGearState.visible) {
    hideHoverTooltip();
  }
}

function handleToggleDebugGearLab() {
  if (!selfStatic || !selfStatic.isAdmin) {
    return;
  }
  rerollDebugGearLab();
  setDebugGearVisible(true);
}

function applyInventoryState(msg) {
  const cols = Math.max(1, Math.min(12, Math.floor(Number(msg.cols) || 5)));
  const rows = Math.max(1, Math.min(12, Math.floor(Number(msg.rows) || 2)));
  const targetLength = cols * rows;
  const nextSlots = [];

  for (let i = 0; i < targetLength; i += 1) {
    const raw = Array.isArray(msg.slots) ? msg.slots[i] : null;
    nextSlots.push(parseItemStateEntry(raw));
  }

  inventoryState.cols = cols;
  inventoryState.rows = rows;
  inventoryState.slots = nextSlots;
  updateInventoryUI();
  updateVendorPanelUI();
}

function applyEquipmentState(msg) {
  if (Array.isArray(msg && msg.itemSlots) && msg.itemSlots.length) {
    applyEquipmentConfig({ itemSlots: msg.itemSlots });
  }
  const nextSlots = {};
  for (const slotId of equipmentConfigState.itemSlots) {
    const raw = msg && msg.slots && typeof msg.slots === "object" ? msg.slots[slotId] : null;
    nextSlots[slotId] = parseItemStateEntry(raw);
  }
  equipmentState.slots = nextSlots;
  updateEquipmentUI();
  updateVendorPanelUI();
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
      PLAYER_META_PROTO_TYPE,
      PLAYER_META_PROTO_VERSION,
      LOOTBAG_META_PROTO_TYPE,
      LOOTBAG_META_PROTO_VERSION,
      PLAYER_SWING_PROTO_TYPE,
      PLAYER_SWING_PROTO_VERSION,
      CAST_EVENT_PROTO_TYPE,
      CAST_EVENT_PROTO_VERSION,
      PLAYER_EFFECT_PROTO_TYPE,
      PLAYER_EFFECT_PROTO_VERSION,
      MOB_BITE_PROTO_TYPE,
      MOB_BITE_PROTO_VERSION,
      EXPLOSION_EVENT_PROTO_TYPE,
      EXPLOSION_EVENT_PROTO_VERSION,
      PROJECTILE_HIT_EVENT_PROTO_TYPE,
      PROJECTILE_HIT_EVENT_PROTO_VERSION,
      MOB_DEATH_EVENT_PROTO_TYPE,
      MOB_DEATH_EVENT_PROTO_VERSION,
      CAST_EVENT_KIND_PLAYER,
      CAST_EVENT_KIND_MOB,
      CAST_EVENT_KIND_SELF,
      CAST_EVENT_FLAG_ACTIVE,
      MOB_EFFECT_FLAG_STUN,
      MOB_EFFECT_FLAG_SLOW,
      MOB_EFFECT_FLAG_REMOVE,
      MOB_EFFECT_FLAG_BURN,
      MOB_EFFECT_FLAG_BLOOD_WRATH,
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
      decodeUnitDirectionComponent,
      decodeDamageEventFlags,
      resolveAbilityIdHash,
      entityRuntime,
      gameState,
      remotePlayerCasts,
      remotePlayerStuns,
      remotePlayerSlows,
      remotePlayerBurns,
      remotePlayerBloodWraths,
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
      addFloatingDamageEvents,
      applyPlayerMetaEntries: applyPlayerMeta,
      applyLootBagMetaEntries: applyLootBagMeta,
      applyPlayerCastStates,
      applyMobCastStates,
      applyPlayerEffects,
      applyNearbyPlayerEffects,
      triggerRemotePlayerSwing,
      triggerRemoteMobBite,
      addExplosionEvents,
      addProjectileHitEvents,
      addMobDeathEvents
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
  resetTouchJoystick();
  resetMobileAbilityAim();
  gameState.self = null;
  gameState.players = [];
  gameState.projectiles = [];
  gameState.mobs = [];
  gameState.lootBags = [];
  inventoryState.slots = [];
  equipmentState.slots = {};
  entityRuntime.lootBagMeta.clear();
  setInventoryVisible(false);
  setEquipmentVisible(false);
  setSpellbookVisible(false);
  clearSelfPositiveBuffs();
  clearSelfNegativeEffects();
  selfPositiveEffects.bloodWrath = null;
  updateInventoryUI();
  updateEquipmentUI();
  remotePlayerSwings.clear();
  remotePlayerCasts.clear();
  remotePlayerStuns.clear();
  remotePlayerSlows.clear();
  remotePlayerBurns.clear();
  remotePlayerBloodWraths.clear();
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
  rangerAnimRuntime.clear();
  floatingDamageNumbers.length = 0;
  activeExplosions.length = 0;
  activeAreaEffectsById.clear();
  ambientParticleEmitters.clear();
  clearAutoVendorInteraction(false, false);
  clearAutoLootPickup(false);
  abilityRuntime.clear();
  adminBotState.bots = [];
  adminBotState.inspectBot = null;
  adminBotState.selectedBotId = "";
  adminBotState.contextBotId = "";
  adminBotState.lastListRequestAt = 0;
  setBotListVisible(false);
  debugState.frameSamples.length = 0;
  debugState.totalMobCount = 0;
  dpsState.samples.length = 0;
  setDpsVisible(false);
  spellbookState.signature = "";
  resetAbilityChanneling();
  clearEntityRuntime();
  snapshots.length = 0;
  lastRenderState = null;
  updateAdminDebugControls();
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
  clearAutoLootPickup(true);
  if (Array.isArray(msg.itemsGained) && msg.itemsGained.length) {
    const summary = msg.itemsGained
      .map((entry) => {
        const itemId = String(entry.itemId || "");
        const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
        const itemDef = itemDefsById.get(itemId);
        return `${String(entry.name || (itemDef && itemDef.name) || itemId)} x${qty}`;
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
  __open: ({ name, classType, isAdmin }) => {
    sendJsonMessage({
      type: "join",
      name,
      classType,
      isAdmin: !!isAdmin,
      viewportWidth: Math.max(1, Math.floor(Number(canvas.width) || 0)),
      viewportHeight: Math.max(1, Math.floor(Number(canvas.height) || 0))
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
    if (msg && typeof msg === "object" && msg.equipment) {
      applyEquipmentConfig(msg.equipment);
    }
    applyClassAndAbilityDefs(msg.classes, msg.abilities);
  },
  welcome: (msg) => {
    myId = msg.id;
    selfStatic = msg.selfStatic || {
      id: msg.id,
      name: (pendingJoinInfo && pendingJoinInfo.name) || "You",
      classType: (pendingJoinInfo && pendingJoinInfo.classType) || getDefaultClassId(),
      isAdmin: !!(pendingJoinInfo && pendingJoinInfo.isAdmin)
    };
    selfStatic.isAdmin = !!selfStatic.isAdmin;
    if (msg && typeof msg === "object" && msg.sounds) {
      applySoundManifest(msg.sounds);
    }
    if (msg && typeof msg === "object" && msg.equipment) {
      applyEquipmentConfig(msg.equipment);
    }
    gameState.map = msg.map || gameState.map;
    gameState.visibilityRange = msg.visibilityRange || gameState.visibilityRange;
    gameState.visibilityRangeX = msg.visibilityRangeX || gameState.visibilityRangeX;
    gameState.visibilityRangeY = msg.visibilityRangeY || gameState.visibilityRangeY;
    resetClientSessionState();
    joinScreen.classList.add("hidden");
    gameUI.classList.remove("hidden");
    ensureActionBindingsForClass(selfStatic.classType);
    updateAdminDebugControls();
    setStatus("");
  },
  class_defs: (msg) => applyClassAndAbilityDefs(msg.classes, msg.abilities),
  item_defs: (msg) => applyItemDefs(msg.items),
  equipment_config: (msg) => applyEquipmentConfig(msg.equipment),
  inventory_state: (msg) => applyInventoryState(msg),
  equipment_state: (msg) => applyEquipmentState(msg),
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
  ability_used: (msg) => {
    const abilityId = String(msg && msg.abilityId || "").trim();
    if (!abilityId) {
      return;
    }
    markAbilityUsedClient(abilityId, performance.now());
  },
  self_buffs: (msg) => applySelfPositiveBuffs(msg),
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
  item_used: (msg) => handleServerItemUsed(msg),
  vendor_sale_result: (msg) => {
    if (!msg) {
      return;
    }
    if (msg.ok) {
      setStatus(`Sold ${msg.itemName || "item"} for ${Math.max(0, Math.floor(Number(msg.copperGained) || 0))} copper.`);
    } else if (msg.message) {
      setStatus(String(msg.message));
    }
    updateVendorPanelUI();
  },
  admin_bot_list: (msg) => {
    adminBotState.bots = Array.isArray(msg && msg.bots) ? msg.bots.map((entry) => ({ ...entry })) : [];
    if (
      adminBotState.selectedBotId &&
      !adminBotState.bots.some((entry) => String(entry.id || "") === String(adminBotState.selectedBotId || ""))
    ) {
      adminBotState.selectedBotId = "";
      adminBotState.inspectBot = null;
    }
    renderAdminBotList();
  },
  admin_bot_inspect: (msg) => {
    adminBotState.inspectBot = msg && msg.bot ? { ...msg.bot } : null;
    adminBotState.selectedBotId = adminBotState.inspectBot ? String(adminBotState.inspectBot.id || "") : "";
    renderAdminBotList();
  },
  admin_action_result: (msg) => {
    setStatus(msg && msg.message ? msg.message : "Admin action completed.");
  },
  world_stats: (msg) => {
    debugState.totalMobCount = Math.max(0, Math.floor(Number(msg && msg.mobCount) || 0));
    updateDebugPanel();
  }
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

function connectAndJoin(name, classType, isAdmin = false) {
  pendingJoinInfo = { name, classType, isAdmin: !!isAdmin };
  if (!networkSessionTools) {
    return;
  }
  socket = networkSessionTools.createSocketSession(name, classType, !!isAdmin);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (rendererBootstrap && typeof rendererBootstrap.resize === "function") {
    rendererBootstrap.resize(canvas.width, canvas.height);
  }
  sendViewportToServer();
  updateInventoryUI();
  updateEquipmentUI();
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
      touchJoystickState,
      autoMoveTarget,
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

function getCurrentMovementVector() {
  if (!playerControlTools) {
    return { dx: 0, dy: 0 };
  }
  return playerControlTools.getCurrentMovementVector();
}

function sendMove() {
  if (!playerControlTools) {
    return;
  }
  playerControlTools.sendMove(socket);
}

function setAutoMoveTarget(x, y, stopDistance = 0.1) {
  if (!playerControlTools) {
    return;
  }
  playerControlTools.setAutoMoveTarget(x, y, stopDistance);
}

function clearAutoMoveTarget() {
  if (!playerControlTools) {
    return;
  }
  playerControlTools.clearAutoMoveTarget();
}

function normalizeAimAngle(angle) {
  const tau = Math.PI * 2;
  let normalized = Number(angle) || 0;
  while (normalized <= -Math.PI) {
    normalized += tau;
  }
  while (normalized > Math.PI) {
    normalized -= tau;
  }
  return normalized;
}

function getShortestAimAngleDelta(fromAngle, toAngle) {
  return normalizeAimAngle((Number(toAngle) || 0) - (Number(fromAngle) || 0));
}

function getAimAngleMidpoint(angleA, angleB) {
  return normalizeAimAngle((Number(angleA) || 0) + getShortestAimAngleDelta(angleA, angleB) * 0.5);
}

function resolveAbilityUseTarget(abilityId, worldX, worldY) {
  const self = (lastRenderState && lastRenderState.self) || gameState.self;
  const targetX = Number(worldX);
  const targetY = Number(worldY);
  if (!self) {
    return Number.isFinite(targetX) && Number.isFinite(targetY) ? { x: targetX, y: targetY } : null;
  }

  const abilityDef = getActionDefById(abilityId);
  if (String(abilityDef && abilityDef.kind || "").trim().toLowerCase() !== "meleecone") {
    return Number.isFinite(targetX) && Number.isFinite(targetY)
      ? { x: targetX, y: targetY }
      : { x: Number(self.x) || 0, y: Number(self.y) || 0 };
  }

  const requestedDir =
    normalizeDirection(targetX - Number(self.x), targetY - Number(self.y)) ||
    normalizeDirection(self && self.lastDirection && self.lastDirection.dx, self && self.lastDirection && self.lastDirection.dy);
  const range = Math.max(
    0.2,
    Number(getAbilityEffectiveRangeForSelf(abilityId, self)) || Number(abilityDef && abilityDef.range) || 1.5
  );
  if (!requestedDir) {
    return { x: Number(self.x) || 0, y: Number(self.y) || 0 };
  }

  const candidateMobs = [];
  for (const mob of Array.isArray(gameState.mobs) ? gameState.mobs : []) {
    if (!mob || Number(mob.hp) <= 0) {
      continue;
    }
    const dx = Number(mob.x) - Number(self.x);
    const dy = Number(mob.y) - Number(self.y);
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0.0001 || distance > range) {
      continue;
    }
    const dir = normalizeDirection(dx, dy);
    if (!dir) {
      continue;
    }
    candidateMobs.push({
      distance,
      dir,
      angle: Math.atan2(dir.dy, dir.dx)
    });
  }

  if (!candidateMobs.length) {
    return {
      x: Number(self.x) + requestedDir.dx * range,
      y: Number(self.y) + requestedDir.dy * range
    };
  }

  const requestedAngle = Math.atan2(requestedDir.dy, requestedDir.dx);
  const candidateAngles = [requestedAngle];
  for (const candidate of candidateMobs) {
    candidateAngles.push(candidate.angle);
  }
  for (let i = 0; i < candidateMobs.length; i += 1) {
    for (let j = i + 1; j < candidateMobs.length; j += 1) {
      candidateAngles.push(getAimAngleMidpoint(candidateMobs[i].angle, candidateMobs[j].angle));
    }
  }

  const coneAngleDeg = Math.max(1, Number(abilityDef && abilityDef.coneAngleDeg) || 120);
  const coneCos = Math.cos((coneAngleDeg * Math.PI) / 360);
  let bestDir = requestedDir;
  let bestHitCount = -1;
  let bestNearestDistance = Infinity;
  let bestAlignment = -Infinity;
  let bestTotalDot = -Infinity;

  for (const angle of candidateAngles) {
    const dir = {
      dx: Math.cos(angle),
      dy: Math.sin(angle)
    };
    let hitCount = 0;
    let nearestDistance = Infinity;
    let totalDot = 0;

    for (const candidate of candidateMobs) {
      const dot = dir.dx * candidate.dir.dx + dir.dy * candidate.dir.dy;
      if (dot < coneCos) {
        continue;
      }
      hitCount += 1;
      totalDot += dot;
      if (candidate.distance < nearestDistance) {
        nearestDistance = candidate.distance;
      }
    }

    if (hitCount <= 0) {
      continue;
    }

    const alignment = dir.dx * requestedDir.dx + dir.dy * requestedDir.dy;
    const isBetter =
      hitCount > bestHitCount ||
      (hitCount === bestHitCount && nearestDistance < bestNearestDistance - 1e-6) ||
      (hitCount === bestHitCount &&
        Math.abs(nearestDistance - bestNearestDistance) <= 1e-6 &&
        alignment > bestAlignment + 1e-6) ||
      (hitCount === bestHitCount &&
        Math.abs(nearestDistance - bestNearestDistance) <= 1e-6 &&
        Math.abs(alignment - bestAlignment) <= 1e-6 &&
        totalDot > bestTotalDot + 1e-6);
    if (!isBetter) {
      continue;
    }

    bestDir = dir;
    bestHitCount = hitCount;
    bestNearestDistance = nearestDistance;
    bestAlignment = alignment;
    bestTotalDot = totalDot;
  }

  return {
    x: Number(self.x) + bestDir.dx * range,
    y: Number(self.y) + bestDir.dy * range
  };
}

function triggerSwordSwing(worldX, worldY) {
  const self = (lastRenderState && lastRenderState.self) || gameState.self;
  if (!self) {
    return;
  }
  const target = resolveAbilityUseTarget("slash", worldX, worldY);
  swordSwing.angle = Math.atan2(Number(target && target.y) - self.y, Number(target && target.x) - self.x);
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

function findLootBagById(bagId) {
  const id = String(bagId || "").trim();
  if (!id) {
    return null;
  }
  const bags = (lastRenderState && Array.isArray(lastRenderState.lootBags) ? lastRenderState.lootBags : null) || gameState.lootBags;
  for (const bag of bags) {
    if (String(bag && bag.id) === id) {
      return bag;
    }
  }
  return null;
}

function clearAutoLootPickup(sendStopMove = false) {
  const wasActive = lootPickupState.active || autoMoveTarget.active;
  lootPickupState.active = false;
  lootPickupState.bagId = "";
  lootPickupState.x = 0;
  lootPickupState.y = 0;
  lootPickupState.nextAttemptAt = 0;
  clearAutoMoveTarget();
  if (sendStopMove && wasActive) {
    sendMove();
  }
}

function startAutoLootPickup(bag) {
  if (!bag) {
    return false;
  }
  lootPickupState.active = true;
  lootPickupState.bagId = String(bag.id || "");
  lootPickupState.x = Number(bag.x) || 0;
  lootPickupState.y = Number(bag.y) || 0;
  lootPickupState.nextAttemptAt = 0;
  setAutoMoveTarget(lootPickupState.x + 0.5, lootPickupState.y + 0.5, 0.1);
  sendMove();
  return true;
}

function tryContextLootPickup() {
  const self = getCurrentSelf();
  const renderState = lastRenderState || gameState;
  if (!self || !renderState || !Array.isArray(renderState.lootBags) || !renderState.lootBags.length) {
    return false;
  }
  const cameraX = self.x + 0.5;
  const cameraY = self.y + 0.5;
  const hovered = getHoveredLootBag(renderState.lootBags, cameraX, cameraY);
  if (!hovered || !hovered.bag) {
    return false;
  }
  const bag = hovered.bag;
  const dist = Math.hypot(bag.x + 0.5 - self.x, bag.y + 0.5 - self.y);
  if (dist <= lootClientConfig.bagPickupRange) {
    clearAutoLootPickup(false);
    sendPickupBag(bag.x, bag.y);
    return true;
  }
  return startAutoLootPickup(bag);
}

function updateAutoLootPickup(now = performance.now()) {
  if (!lootPickupState.active) {
    return;
  }
  const self = getCurrentSelf();
  if (!self || self.hp <= 0) {
    clearAutoLootPickup(true);
    return;
  }
  const manualMove = getCurrentInputVector();
  if (manualMove.dx || manualMove.dy) {
    clearAutoLootPickup(false);
    return;
  }
  const bag = findLootBagById(lootPickupState.bagId);
  if (!bag) {
    clearAutoLootPickup(true);
    return;
  }
  lootPickupState.x = Number(bag.x) || 0;
  lootPickupState.y = Number(bag.y) || 0;
  setAutoMoveTarget(lootPickupState.x + 0.5, lootPickupState.y + 0.5, 0.1);
  const dist = Math.hypot(lootPickupState.x + 0.5 - self.x, lootPickupState.y + 0.5 - self.y);
  if (dist <= lootClientConfig.bagPickupRange) {
    if (now < lootPickupState.nextAttemptAt) {
      return;
    }
    lootPickupState.nextAttemptAt = now + 350;
    const targetX = lootPickupState.x;
    const targetY = lootPickupState.y;
    clearAutoLootPickup(true);
    sendPickupBag(targetX, targetY);
    return;
  }
  sendMove();
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

function sendCastTargetUpdate(abilityId, worldX, worldY) {
  const self = getCurrentSelf();
  if (!socket || socket.readyState !== WebSocket.OPEN || !self || !abilityChannel.active) {
    return false;
  }
  const resolvedAbilityId = String(abilityId || abilityChannel.abilityId || "").trim();
  if (!resolvedAbilityId) {
    return false;
  }

  const dx = Number(worldX) - self.x;
  const dy = Number(worldY) - self.y;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len)) {
    return false;
  }

  let dirX = 0;
  let dirY = 1;
  if (len > 0.0001) {
    dirX = dx / len;
    dirY = dy / len;
  } else {
    const fallback = sharedNormalizeDirection(self.lastDirection?.dx, self.lastDirection?.dy);
    if (fallback) {
      dirX = fallback.dx;
      dirY = fallback.dy;
    }
  }

  return sendJsonMessage({
    type: "update_cast_target",
    abilityId: resolvedAbilityId,
    dx: dirX,
    dy: dirY,
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

function useAbilityAt(abilityId, worldX, worldY, options = {}) {
  if (!abilityRuntimeTools) {
    return false;
  }
  return abilityRuntimeTools.useAbilityAt(abilityId, worldX, worldY, options);
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

function executeBoundActionAt(slotId, worldX, worldY, options = {}) {
  if (!uiActionTools || typeof uiActionTools.executeBoundActionAt !== "function") {
    return false;
  }
  return uiActionTools.executeBoundActionAt(slotId, worldX, worldY, options);
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

const sharedClientVfxRuntime = globalThis.VibeClientVfxRuntime || null;
const sharedCreateVfxRuntimeTools =
  sharedClientVfxRuntime && typeof sharedClientVfxRuntime.createVfxRuntimeTools === "function"
    ? sharedClientVfxRuntime.createVfxRuntimeTools
    : null;
const vfxRuntimeTools = sharedCreateVfxRuntimeTools
  ? sharedCreateVfxRuntimeTools({
      floatingDamageNumbers,
      activeExplosions,
      activeAreaEffectsById,
      idState: vfxIdState,
      damageFloatDurationMs: DAMAGE_FLOAT_DURATION_MS,
      addDpsSample,
      toAbilityAudioId,
      playAbilityAudioEvent,
      normalizeDirection,
      hashString,
      playMobEventSound
    })
  : null;
const particleSystemTools = sharedCreateParticleSystemTools
  ? sharedCreateParticleSystemTools({
      emittersByKey: ambientParticleEmitters,
      hashString,
      clamp,
      globalMaxParticles: 280
    })
  : null;

function addFloatingDamageEvents(events) {
  if (!vfxRuntimeTools) {
    return;
  }
  vfxRuntimeTools.addFloatingDamageEvents(events);
}

function addExplosionEvents(events) {
  if (!vfxRuntimeTools) {
    return;
  }
  vfxRuntimeTools.addExplosionEvents(events);
}

function upsertAreaEffectState(raw, now = performance.now()) {
  if (!vfxRuntimeTools) {
    return;
  }
  vfxRuntimeTools.upsertAreaEffectState(raw, now);
}

function applyAreaEffects(events) {
  if (!vfxRuntimeTools) {
    return;
  }
  vfxRuntimeTools.applyAreaEffects(events);
}

function addProjectileHitEvents(events) {
  if (!vfxRuntimeTools) {
    return;
  }
  vfxRuntimeTools.addProjectileHitEvents(events);
}

function addMobDeathEvents(events) {
  if (!vfxRuntimeTools) {
    return;
  }
  vfxRuntimeTools.addMobDeathEvents(events);
}

function pruneAmbientParticleEmitters(now = performance.now()) {
  if (!particleSystemTools) {
    return;
  }
  particleSystemTools.pruneEmitters(now);
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

function getPlayerCastVisualState(player, isSelf, frameNow) {
  const castState = isSelf ? abilityChannel : remotePlayerCasts.get(player.id);
  const cast = getCastProgress(castState, frameNow);
  if (!cast) {
    if (!isSelf && castState && castState.active) {
      remotePlayerCasts.delete(player.id);
    }
    return null;
  }
  return {
    ratio: clamp(Number(cast.ratio) || 0, 0, 1)
  };
}

function getPlayerStatusVisualState(player, isSelf, frameNow) {
  const stunState = isSelf ? selfNegativeEffects.stun : remotePlayerStuns.get(player.id);
  const slowState = isSelf ? selfNegativeEffects.slow : remotePlayerSlows.get(player.id);
  const burnState = isSelf ? selfNegativeEffects.burn : remotePlayerBurns.get(player.id);
  const bloodWrathState = isSelf ? selfPositiveEffects.bloodWrath : remotePlayerBloodWraths.get(player.id);
  const status = {
    phaseSeed: Number(player && player.id) || 0,
    stunActive: false,
    slowActive: false,
    burnActive: false,
    bloodWrathActive: false,
    slowMultiplier: 1
  };

  if (stunState) {
    if ((Number(stunState.endsAt) || 0) > frameNow) {
      status.stunActive = true;
    } else if (!isSelf) {
      remotePlayerStuns.delete(player.id);
    } else {
      selfNegativeEffects.stun = null;
    }
  }

  if (slowState) {
    if ((Number(slowState.endsAt) || 0) > frameNow) {
      status.slowActive = true;
      status.slowMultiplier = isSelf
        ? clamp((Number(slowState.multiplierQ) || 1000) / 1000, 0.1, 1)
        : clamp(Number(slowState.multiplier) || 1, 0.1, 1);
    } else if (!isSelf) {
      remotePlayerSlows.delete(player.id);
    } else {
      selfNegativeEffects.slow = null;
    }
  }

  if (burnState) {
    if ((Number(burnState.endsAt) || 0) > frameNow) {
      status.burnActive = true;
    } else if (!isSelf) {
      remotePlayerBurns.delete(player.id);
    } else {
      selfNegativeEffects.burn = null;
    }
  }

  if (bloodWrathState) {
    if ((Number(bloodWrathState.endsAt) || 0) > frameNow) {
      status.bloodWrathActive = true;
    } else if (!isSelf) {
      remotePlayerBloodWraths.delete(player.id);
    } else {
      selfPositiveEffects.bloodWrath = null;
    }
  }

  return status.stunActive || status.slowActive || status.burnActive || status.bloodWrathActive ? status : null;
}

function getMobCastVisualState(mob, frameNow) {
  const castState = remoteMobCasts.get(mob.id);
  const cast = getCastProgress(castState, frameNow);
  if (!cast) {
    if (castState && castState.active) {
      remoteMobCasts.delete(mob.id);
    }
    return null;
  }
  return {
    ratio: clamp(Number(cast.ratio) || 0, 0, 1)
  };
}

function getMobStatusVisualState(mob, frameNow) {
  const status = {
    phaseSeed: Number(mob && mob.id) || 0,
    stunActive: false,
    slowActive: false,
    burnActive: false,
    slowMultiplier: 1
  };

  const stunState = remoteMobStuns.get(mob.id);
  if (stunState) {
    if ((Number(stunState.endsAt) || 0) > frameNow) {
      status.stunActive = true;
    } else {
      remoteMobStuns.delete(mob.id);
    }
  }

  const slowState = remoteMobSlows.get(mob.id);
  if (slowState) {
    if ((Number(slowState.endsAt) || 0) > frameNow) {
      status.slowActive = true;
      status.slowMultiplier = clamp(Number(slowState.multiplier) || 1, 0.1, 1);
    } else {
      remoteMobSlows.delete(mob.id);
    }
  }

  const burnState = remoteMobBurns.get(mob.id);
  if (burnState) {
    if ((Number(burnState.endsAt) || 0) > frameNow) {
      status.burnActive = true;
    } else {
      remoteMobBurns.delete(mob.id);
    }
  }

  return status.stunActive || status.slowActive || status.burnActive ? status : null;
}

function getFloatingDamageViews(frameNow) {
  if (!floatingDamageNumbers.length) {
    return [];
  }
  const active = [];
  const views = [];
  for (const entry of floatingDamageNumbers) {
    const age = frameNow - entry.createdAt;
    if (age >= entry.durationMs) {
      continue;
    }
    active.push(entry);
    const progress = clamp(age / entry.durationMs, 0, 1);
    views.push({
      id: Number(entry.id) || 0,
      x: Number(entry.x) || 0,
      y: Number(entry.y) || 0,
      amount: Math.max(0, Math.round(Number(entry.amount) || 0)),
      targetType: entry.targetType === "player" ? "player" : "mob",
      progress,
      jitterX: Number(entry.jitterX) || 0,
      riseOffset: Number(entry.riseOffset) || 0
    });
  }
  floatingDamageNumbers.length = 0;
  for (const entry of active) {
    floatingDamageNumbers.push(entry);
  }
  return views;
}

function getExplosionViews(frameNow) {
  if (!activeExplosions.length) {
    return [];
  }
  const active = [];
  const views = [];
  for (const entry of activeExplosions) {
    const age = frameNow - Number(entry.createdAt || frameNow);
    const durationMs = Math.max(1, Number(entry.durationMs) || 380);
    if (age >= durationMs) {
      continue;
    }
    active.push(entry);
    views.push({
      id: Number(entry.id) || 0,
      x: Number(entry.x) || 0,
      y: Number(entry.y) || 0,
      radius: Math.max(0.1, Number(entry.radius) || 0.1),
      abilityId: String(entry.abilityId || ""),
      progress: clamp(age / durationMs, 0, 1),
      alpha: clamp(1 - age / durationMs, 0, 1)
    });
  }
  activeExplosions.length = 0;
  for (const entry of active) {
    activeExplosions.push(entry);
  }
  return views;
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

function buildParametricJaggedBeamPoints(start, end, seed, options = {}) {
  const segmentCount = Math.max(4, Math.floor(Number(options.segmentCount) || 12));
  const amplitudePx = Math.max(0, Number(options.amplitudePx) || 12);
  const phase = Number(options.phase) || 0;
  const taperPower = Math.max(0.4, Number(options.taperPower) || 1.1);
  const waveFrequency = Math.max(0.5, Number(options.waveFrequency) || 3.4);
  const noiseMix = clamp(Number(options.noiseMix) || 0.55, 0, 1);
  const points = [];
  const beamDx = end.x - start.x;
  const beamDy = end.y - start.y;
  const beamLengthPx = Math.max(1, Math.hypot(beamDx, beamDy));
  const dirX = beamDx / beamLengthPx;
  const dirY = beamDy / beamLengthPx;
  const perpX = -dirY;
  const perpY = dirX;
  const seedBase = Math.floor(Number(seed) || 0);

  for (let i = 0; i <= segmentCount; i += 1) {
    const t = i / segmentCount;
    let offset = 0;
    if (i > 0 && i < segmentCount) {
      const envelope = Math.pow(Math.sin(t * Math.PI), taperPower);
      const jitter = seededUnit(seedBase, 100 + i * 17) * 2 - 1;
      const wavePhase = phase + t * Math.PI * 2 * waveFrequency + seededUnit(seedBase, 200 + i * 19) * Math.PI;
      const wave = Math.sin(wavePhase);
      offset = amplitudePx * envelope * (jitter * noiseMix + wave * (1 - noiseMix));
    }
    points.push({
      x: start.x + beamDx * t + perpX * offset,
      y: start.y + beamDy * t + perpY * offset
    });
  }
  return points;
}

function strokeBeamPolyline(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawParametricJaggedBeam(start, end, seed, now, options = {}) {
  const alpha = clamp(Number(options.alpha) || 1, 0, 1);
  if (alpha <= 0) {
    return;
  }
  const widthPx = Math.max(2, Number(options.widthPx) || 14);
  const outerGlowColor = options.outerGlowColor || [122, 208, 255];
  const coreColor = options.coreColor || [180, 235, 255];
  const hotColor = options.hotColor || [248, 251, 255];
  const branchColor = options.branchColor || coreColor;
  const burstColor = options.burstColor || coreColor;
  const phase = now * (Number(options.phaseSpeed) || 0.0095) + (Number(options.phaseOffset) || 0);
  const mainPoints = buildParametricJaggedBeamPoints(start, end, seed, {
    segmentCount: options.segmentCount,
    amplitudePx: options.amplitudePx ?? widthPx * 0.9,
    phase,
    taperPower: options.taperPower,
    waveFrequency: options.waveFrequency,
    noiseMix: options.noiseMix
  });

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = `rgba(${outerGlowColor[0]}, ${outerGlowColor[1]}, ${outerGlowColor[2]}, ${(0.32 * alpha).toFixed(3)})`;
  ctx.lineWidth = widthPx * 1.65;
  strokeBeamPolyline(mainPoints);

  ctx.strokeStyle = `rgba(${coreColor[0]}, ${coreColor[1]}, ${coreColor[2]}, ${(0.92 * alpha).toFixed(3)})`;
  ctx.lineWidth = widthPx * 0.72;
  strokeBeamPolyline(mainPoints);

  ctx.strokeStyle = `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.98 * alpha).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.2, widthPx * 0.22);
  strokeBeamPolyline(mainPoints);

  const branchCount = Math.max(0, Math.floor(Number(options.branchCount) || 0));
  for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
    const startT = 0.18 + seededUnit(seed, 310 + branchIndex * 29) * 0.6;
    const endT = Math.min(0.98, startT + 0.08 + seededUnit(seed, 311 + branchIndex * 29) * 0.22);
    const baseAngle = (seededUnit(seed, 312 + branchIndex * 29) - 0.5) * Math.PI * 1.2;
    const directionX = end.x - start.x;
    const directionY = end.y - start.y;
    const len = Math.max(1, Math.hypot(directionX, directionY));
    const dirX = directionX / len;
    const dirY = directionY / len;
    const perpX = -dirY;
    const perpY = dirX;
    const startPoint = {
      x: start.x + directionX * startT,
      y: start.y + directionY * startT
    };
    const branchLength = widthPx * (1.8 + seededUnit(seed, 313 + branchIndex * 29) * 2.7);
    const branchDirSign = seededUnit(seed, 314 + branchIndex * 29) * 2 - 1;
    const endPoint = {
      x:
        startPoint.x +
        dirX * branchLength * (0.25 + (endT - startT) * 0.8) +
        perpX * branchLength * 0.7 * branchDirSign * Math.cos(baseAngle),
      y:
        startPoint.y +
        dirY * branchLength * (0.25 + (endT - startT) * 0.8) +
        perpY * branchLength * 0.7 * branchDirSign * Math.cos(baseAngle)
    };
    const branchPoints = buildParametricJaggedBeamPoints(startPoint, endPoint, seed + branchIndex * 997, {
      segmentCount: Math.max(4, Math.floor((Number(options.segmentCount) || 10) * 0.45)),
      amplitudePx: Math.max(2, widthPx * 0.32),
      phase: phase * 1.24 + branchIndex * 0.9,
      taperPower: 0.95,
      waveFrequency: 2.8,
      noiseMix: 0.62
    });
    ctx.strokeStyle = `rgba(${branchColor[0]}, ${branchColor[1]}, ${branchColor[2]}, ${(0.52 * alpha).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, widthPx * 0.16);
    strokeBeamPolyline(branchPoints);
  }

  const burstRadius = Math.max(5, widthPx * 0.9);
  for (const point of [start, end]) {
    const burst = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, burstRadius);
    burst.addColorStop(0, `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.95 * alpha).toFixed(3)})`);
    burst.addColorStop(0.42, `rgba(${burstColor[0]}, ${burstColor[1]}, ${burstColor[2]}, ${(0.4 * alpha).toFixed(3)})`);
    burst.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = burst;
    ctx.beginPath();
    ctx.arc(point.x, point.y, burstRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLightningBeamAreaEffect(effect, cameraX, cameraY, now) {
  const dir = normalizeDirection(effect.dx, effect.dy) || { dx: 0, dy: -1 };
  const lengthTiles = Math.max(0.2, Number(effect.length) || Number(effect.radius) || 1);
  const widthTiles = Math.max(0.2, Number(effect.width) || 0.6);
  const startX = Number.isFinite(Number(effect.startX)) ? Number(effect.startX) : effect.x;
  const startY = Number.isFinite(Number(effect.startY)) ? Number(effect.startY) : effect.y;
  const endX = startX + dir.dx * lengthTiles;
  const endY = startY + dir.dy * lengthTiles;
  const start = worldToScreen(startX + 0.5, startY + 0.5, cameraX, cameraY);
  const end = worldToScreen(endX + 0.5, endY + 0.5, cameraX, cameraY);
  const beamWidthPx = Math.max(3, widthTiles * TILE_SIZE);
  const fadeIn = clamp((now - effect.startedAt) / 55, 0, 1);
  const fadeOut = 1 - clamp((now - effect.endsAt + 130) / 130, 0, 1);
  const alpha = clamp(fadeIn * fadeOut, 0, 1);
  const seed = Number(effect.seed) || hashString(`${effect.id || "lightning"}:${effect.startedAt || 0}`);

  drawParametricJaggedBeam(start, end, seed, now, {
    alpha,
    widthPx: beamWidthPx,
    segmentCount: Math.max(8, Math.round(lengthTiles * 3.5)),
    amplitudePx: beamWidthPx * 1.05,
    taperPower: 0.78,
    waveFrequency: 4.8,
    noiseMix: 0.68,
    phaseSpeed: 0.022,
    outerGlowColor: [92, 198, 255],
    coreColor: [141, 228, 255],
    hotColor: [250, 252, 255],
    branchColor: [179, 239, 255],
    burstColor: [143, 218, 255],
    branchCount: Math.max(2, Math.round(lengthTiles * 0.4))
  });
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

const hydraSpriteCache = new Map();

function getHydraSpriteFrame(frameIndex) {
  const key = Math.max(0, Math.floor(Number(frameIndex) || 0)) % 6;
  let sprite = hydraSpriteCache.get(key);
  if (sprite) {
    return sprite;
  }

  const size = 76;
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const iconCtx = offscreen.getContext("2d");
  const phase = key / 6;
  const bob = Math.sin(phase * Math.PI * 2);
  const flicker = Math.cos(phase * Math.PI * 2);

  iconCtx.translate(size / 2, size / 2 + 4);
  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";

  const tailGlow = iconCtx.createRadialGradient(0, 22, 0, 0, 22, 26);
  tailGlow.addColorStop(0, "rgba(255, 196, 96, 0.34)");
  tailGlow.addColorStop(0.5, "rgba(255, 112, 34, 0.18)");
  tailGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  iconCtx.fillStyle = tailGlow;
  iconCtx.beginPath();
  iconCtx.arc(0, 22, 26, 0, Math.PI * 2);
  iconCtx.fill();

  iconCtx.fillStyle = "rgba(63, 16, 9, 0.92)";
  iconCtx.beginPath();
  iconCtx.ellipse(0, 21, 17, 10, 0, 0, Math.PI * 2);
  iconCtx.fill();
  iconCtx.strokeStyle = "rgba(255, 171, 82, 0.72)";
  iconCtx.lineWidth = 1.8;
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(255, 96, 41, 0.82)";
  iconCtx.lineWidth = 8;
  const neckEndX = bob * 5;
  const neckEndY = -9 - Math.abs(flicker) * 2;
  iconCtx.beginPath();
  iconCtx.moveTo(-1.5, 14);
  iconCtx.quadraticCurveTo(-7 + bob * 2.8, 2, neckEndX, neckEndY);
  iconCtx.stroke();

  const headX = neckEndX + 1.5;
  const headY = neckEndY - 4.5;
  const headGlow = iconCtx.createRadialGradient(headX, headY, 0, headX, headY, 15);
  headGlow.addColorStop(0, "rgba(255, 248, 196, 0.88)");
  headGlow.addColorStop(0.42, "rgba(255, 153, 74, 0.48)");
  headGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  iconCtx.fillStyle = headGlow;
  iconCtx.beginPath();
  iconCtx.arc(headX, headY, 15, 0, Math.PI * 2);
  iconCtx.fill();

  iconCtx.fillStyle = "rgba(221, 63, 30, 0.98)";
  iconCtx.beginPath();
  iconCtx.ellipse(headX, headY, 7.5, 6.4, 0, 0, Math.PI * 2);
  iconCtx.fill();
  iconCtx.strokeStyle = "rgba(255, 208, 129, 0.82)";
  iconCtx.lineWidth = 1.3;
  iconCtx.stroke();

  iconCtx.fillStyle = "rgba(255, 214, 115, 0.98)";
  iconCtx.beginPath();
  iconCtx.arc(headX + 1.2, headY - 1, 2.3, 0, Math.PI * 2);
  iconCtx.fill();

  iconCtx.strokeStyle = "rgba(255, 191, 111, 0.76)";
  iconCtx.lineWidth = 1.5;
  iconCtx.beginPath();
  iconCtx.moveTo(headX + 3.8, headY - 1.8);
  iconCtx.lineTo(headX + 10, headY - 5.5 - Math.abs(bob) * 2.8);
  iconCtx.stroke();

  iconCtx.beginPath();
  iconCtx.moveTo(headX + 2, headY + 4);
  iconCtx.lineTo(headX + 8.5, headY + 8.5 + Math.abs(bob) * 1.5);
  iconCtx.stroke();

  sprite = offscreen;
  hydraSpriteCache.set(key, sprite);
  return sprite;
}

function drawHydraSprite(screenX, screenY, scale, alpha, frameNow, attackPulse = 0) {
  const frameIndex = Math.floor(frameNow / 120 + attackPulse * 2) % 6;
  const sprite = getHydraSpriteFrame(frameIndex);
  const width = sprite.width * scale;
  const height = sprite.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(255, 128, 48, 0.44)";
  ctx.drawImage(sprite, screenX - width * 0.5, screenY - height * 0.56, width, height);
  ctx.restore();
}

function drawFireHydraAreaEffect(effect, cameraX, cameraY, now) {
  const count = Math.max(1, Math.round(Number(effect.summonCount) || 1));
  const abilityDef = findAbilityDefById(effect.abilityId) || findAbilityDefById("fireHydra");
  const baseFormationRadius = Math.max(
    0,
    Number(effect.formationRadius) || Number(abilityDef?.summonFormationRadius) || 0.95
  );
  const formationRadius = Math.max(
    baseFormationRadius,
    count >= 4 ? 1.6 : count === 3 ? 1.4 : count === 2 ? 1.05 : 0
  );
  const positions = sharedComputeSummonFormationPositions(effect.x, effect.y, count, formationRadius);
  const ageMs = Math.max(0, now - Number(effect.startedAt || now));
  const fadeOut = 1 - clamp((now - effect.endsAt + 260) / 260, 0, 1);
  const spawnAlpha = clamp(ageMs / 360, 0, 1);
  const alpha = clamp(spawnAlpha * fadeOut, 0, 1);
  const attackIntervalMs = Math.max(120, Number(effect.attackIntervalMs) || 1000);
  const attackPhase = ((ageMs % attackIntervalMs) / attackIntervalMs);

  for (const hydra of positions) {
    const screen = worldToScreen(hydra.x + 0.5, hydra.y + 0.5, cameraX, cameraY);
    const emberRadius = 8 + Math.sin(now * 0.008 + hydra.index * 0.9) * 1.6;
    const glow = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, emberRadius * 2.4);
    glow.addColorStop(0, `rgba(255, 220, 132, ${(0.18 * alpha).toFixed(3)})`);
    glow.addColorStop(0.45, `rgba(255, 103, 43, ${(0.18 * alpha).toFixed(3)})`);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y + 2, emberRadius * 2.4, 0, Math.PI * 2);
    ctx.fill();

    const baseGlow = ctx.createRadialGradient(screen.x, screen.y + 7, 0, screen.x, screen.y + 7, 18);
    baseGlow.addColorStop(0, `rgba(255, 222, 156, ${(0.36 * alpha).toFixed(3)})`);
    baseGlow.addColorStop(0.4, `rgba(255, 132, 54, ${(0.24 * alpha).toFixed(3)})`);
    baseGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = baseGlow;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y + 7, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(59, 13, 8, ${(0.74 * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 8.5, 10.5, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.lineWidth = 1.15;
    ctx.strokeStyle = `rgba(255, 192, 104, ${(0.52 * alpha).toFixed(3)})`;
    ctx.arc(screen.x, screen.y + 5, 8.5, 0, Math.PI * 2);
    ctx.stroke();

    drawHydraSprite(
      screen.x,
      screen.y - 2,
      0.44 + 0.05 * spawnAlpha,
      alpha,
      now + hydra.index * 37,
      attackPhase > 0.72 ? (attackPhase - 0.72) / 0.28 : 0
    );

    if (ageMs < 450) {
      const ring = 12 + (1 - ageMs / 450) * 12;
      ctx.beginPath();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = `rgba(255, 193, 109, ${(0.55 * alpha).toFixed(3)})`;
      ctx.arc(screen.x, screen.y + 4, ring, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

const ballistaSpriteCache = new Map();
const caltropSpriteCache = new Map();

function getBallistaSpriteFrame(frameIndex) {
  const key = Math.max(0, Math.floor(Number(frameIndex) || 0)) % 6;
  let sprite = ballistaSpriteCache.get(key);
  if (sprite) {
    return sprite;
  }

  const size = 76;
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const iconCtx = offscreen.getContext("2d");
  const phase = (key / 6) * Math.PI * 2;
  const recoil = Math.sin(phase) * 2.6;
  iconCtx.translate(size / 2, size / 2 + 6);
  iconCtx.lineCap = "round";
  iconCtx.lineJoin = "round";

  iconCtx.fillStyle = "rgba(42, 28, 18, 0.92)";
  iconCtx.beginPath();
  iconCtx.ellipse(0, 16, 15, 7, 0, 0, Math.PI * 2);
  iconCtx.fill();

  iconCtx.strokeStyle = "rgba(207, 169, 114, 0.92)";
  iconCtx.lineWidth = 3.4;
  iconCtx.beginPath();
  iconCtx.moveTo(-9, 14);
  iconCtx.lineTo(-2, 0);
  iconCtx.lineTo(9, 14);
  iconCtx.moveTo(-4, 16);
  iconCtx.lineTo(0, 4);
  iconCtx.lineTo(4, 16);
  iconCtx.stroke();

  iconCtx.fillStyle = "rgba(138, 101, 58, 0.98)";
  iconCtx.strokeStyle = "rgba(241, 222, 174, 0.72)";
  iconCtx.lineWidth = 1.5;
  drawRoundedRect(iconCtx, -14, -2, 28, 8, 3);
  iconCtx.fill();
  iconCtx.stroke();

  iconCtx.strokeStyle = "rgba(228, 214, 191, 0.96)";
  iconCtx.lineWidth = 1.5;
  iconCtx.beginPath();
  iconCtx.moveTo(-12, -1);
  iconCtx.lineTo(14 + recoil, -13);
  iconCtx.moveTo(-12, 5);
  iconCtx.lineTo(14 + recoil, 17);
  iconCtx.moveTo(14 + recoil, -13);
  iconCtx.lineTo(14 + recoil, 17);
  iconCtx.stroke();

  iconCtx.fillStyle = "rgba(230, 219, 196, 0.96)";
  iconCtx.beginPath();
  iconCtx.moveTo(18 + recoil, 2);
  iconCtx.lineTo(11 + recoil, -2.8);
  iconCtx.lineTo(13.5 + recoil, 2);
  iconCtx.lineTo(11 + recoil, 6.8);
  iconCtx.closePath();
  iconCtx.fill();

  sprite = offscreen;
  ballistaSpriteCache.set(key, sprite);
  return sprite;
}

function drawBallistaSprite(screenX, screenY, scale, alpha, frameNow, attackPulse = 0) {
  const frameIndex = Math.floor(frameNow / 140 + attackPulse * 2.2) % 6;
  const sprite = getBallistaSpriteFrame(frameIndex);
  const width = sprite.width * scale;
  const height = sprite.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 11;
  ctx.shadowColor = "rgba(255, 202, 128, 0.28)";
  ctx.drawImage(sprite, screenX - width * 0.5, screenY - height * 0.56, width, height);
  ctx.restore();
}

function getCaltropSprite() {
  let sprite = caltropSpriteCache.get("default");
  if (sprite) {
    return sprite;
  }
  const size = 22;
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const iconCtx = offscreen.getContext("2d");
  iconCtx.translate(size / 2, size / 2);
  iconCtx.strokeStyle = "rgba(224, 231, 239, 0.96)";
  iconCtx.lineWidth = 2;
  iconCtx.lineCap = "round";
  iconCtx.beginPath();
  iconCtx.moveTo(-5, -4);
  iconCtx.lineTo(5, 4);
  iconCtx.moveTo(-5, 4);
  iconCtx.lineTo(5, -4);
  iconCtx.moveTo(0, -6);
  iconCtx.lineTo(0, 6);
  iconCtx.stroke();
  sprite = offscreen;
  caltropSpriteCache.set("default", sprite);
  return sprite;
}

function getCurrentAbilityPreviewState() {
  if (mobileAbilityAimState.active && mobileAbilityAimState.abilityId) {
    return mobileAbilityAimState;
  }
  if (abilityChannel.active && abilityChannel.abilityId) {
    return abilityChannel;
  }
  return null;
}

function drawCircularTargetPreview(self, cameraX, cameraY, now, options = {}) {
  const previewState = getCurrentAbilityPreviewState();
  if (!self || !previewState) {
    return;
  }
  const targetX = Number(previewState.targetX);
  const targetY = Number(previewState.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return;
  }
  const activeAbilityId = String(previewState.abilityId || "");
  const abilityDef = findAbilityDefById(activeAbilityId) || (options.fallbackId ? findAbilityDefById(options.fallbackId) : null);
  const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(activeAbilityId, self));
  const areaRadius = Math.max(0.2, Number(options.radius) || Number(abilityDef?.areaRadius || abilityDef?.radius || 2.5));
  const center = worldToScreen(targetX + 0.5, targetY + 0.5, cameraX, cameraY);
  const radiusPx = Math.max(8, areaRadius * TILE_SIZE);
  const dist = Math.hypot(targetX - self.x, targetY - self.y);
  const inRange = castRange <= 0 || dist <= castRange + 0.001;
  const pulse = 0.72 + Math.sin(now * 0.011) * 0.14;
  const selfP = worldToScreen(self.x + 0.5, self.y + 0.5, cameraX, cameraY);
  const strokeColor = inRange
    ? options.strokeColor || "rgba(220, 233, 255, 0.72)"
    : options.outOfRangeStrokeColor || "rgba(255, 164, 164, 0.72)";
  const fillColor = inRange
    ? options.fillColor || `rgba(134, 179, 230, ${(0.12 * pulse).toFixed(3)})`
    : options.outOfRangeFillColor || `rgba(214, 104, 104, ${(0.13 * pulse).toFixed(3)})`;

  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = inRange ? "rgba(206, 220, 245, 0.46)" : "rgba(255, 141, 141, 0.48)";
  ctx.beginPath();
  ctx.moveTo(selfP.x, selfP.y);
  ctx.lineTo(center.x, center.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.fillStyle = fillColor;
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = strokeColor;
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  return { center, radiusPx, inRange };
}

function drawTaperedTracerBeam(start, end, seed, now, options = {}) {
  const alpha = clamp(Number(options.alpha) || 1, 0, 1);
  if (alpha <= 0) {
    return;
  }
  const widthPx = Math.max(2, Number(options.widthPx) || 8);
  const outerGlowColor = options.outerGlowColor || [246, 196, 116];
  const coreColor = options.coreColor || [244, 234, 212];
  const hotColor = options.hotColor || [255, 252, 244];
  const streakColor = options.streakColor || [255, 221, 148];
  const sparkCount = Math.max(0, Math.floor(Number(options.sparkCount) || 10));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / length;
  const dirY = dy / length;
  const perpX = -dirY;
  const perpY = dirX;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = `rgba(${outerGlowColor[0]}, ${outerGlowColor[1]}, ${outerGlowColor[2]}, ${(0.28 * alpha).toFixed(3)})`;
  ctx.lineWidth = widthPx * 1.8;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  gradient.addColorStop(0, `rgba(${coreColor[0]}, ${coreColor[1]}, ${coreColor[2]}, ${(0.78 * alpha).toFixed(3)})`);
  gradient.addColorStop(0.55, `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.96 * alpha).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${coreColor[0]}, ${coreColor[1]}, ${coreColor[2]}, ${(0.78 * alpha).toFixed(3)})`);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = widthPx * 0.7;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.98 * alpha).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.1, widthPx * 0.18);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  for (let i = 0; i < sparkCount; i += 1) {
    const t = (seededUnit(seed, 410 + i * 17) + now * 0.00042) % 1;
    const baseX = start.x + dx * t;
    const baseY = start.y + dy * t;
    const drift = (seededUnit(seed, 430 + i * 19) - 0.5) * widthPx * 1.6;
    const px = baseX + perpX * drift;
    const py = baseY + perpY * drift;
    const tail = 3 + seededUnit(seed, 450 + i * 11) * 5;
    ctx.strokeStyle = `rgba(${streakColor[0]}, ${streakColor[1]}, ${streakColor[2]}, ${(0.34 + seededUnit(seed, 470 + i * 7) * 0.4 * alpha).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - dirX * tail * 0.35, py - dirY * tail * 0.35);
    ctx.lineTo(px + dirX * tail, py + dirY * tail);
    ctx.stroke();
  }

  if (options.arrowHead !== false) {
    ctx.save();
    ctx.translate(end.x, end.y);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.96 * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(widthPx * 1.1, 0);
    ctx.lineTo(-widthPx * 0.1, -widthPx * 0.45);
    ctx.lineTo(widthPx * 0.22, 0);
    ctx.lineTo(-widthPx * 0.1, widthPx * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawRainOfArrowsAreaEffect(effect, cameraX, cameraY, now) {
  const center = worldToScreen(effect.x + 0.5, effect.y + 0.5, cameraX, cameraY);
  const radiusPx = Math.max(8, effect.radius * TILE_SIZE);
  const lifeT = clamp((now - effect.startedAt) / Math.max(1, effect.durationMs), 0, 1);
  const fadeOut = 1 - clamp((now - effect.endsAt + 320) / 320, 0, 1);
  const alpha = clamp((0.7 - lifeT * 0.18) * fadeOut, 0, 1);

  ctx.save();
  const zoneGlow = ctx.createRadialGradient(center.x, center.y, radiusPx * 0.15, center.x, center.y, radiusPx * 1.05);
  zoneGlow.addColorStop(0, `rgba(197, 178, 108, ${(0.14 * alpha).toFixed(3)})`);
  zoneGlow.addColorStop(0.7, `rgba(120, 88, 42, ${(0.18 * alpha).toFixed(3)})`);
  zoneGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = zoneGlow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.clip();

  for (let i = 0; i < 24; i += 1) {
    const u = (seededUnit(effect.seed, 510 + i * 17) + now * 0.0003 * (0.7 + i * 0.02)) % 1;
    const v = (seededUnit(effect.seed, 540 + i * 19) + now * 0.00058 * (0.8 + i * 0.01)) % 1;
    const px = center.x + (u * 2 - 1) * radiusPx * 0.9;
    const py = center.y + (v * 2 - 1) * radiusPx * 0.9;
    if ((px - center.x) ** 2 + (py - center.y) ** 2 > radiusPx * radiusPx) {
      continue;
    }
    const dropLen = 12 + seededUnit(effect.seed, 570 + i * 13) * 8;
    ctx.strokeStyle = `rgba(236, 226, 212, ${(0.26 + seededUnit(effect.seed, 590 + i * 11) * 0.32 * alpha).toFixed(3)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(px + 2.5, py - dropLen * 0.55);
    ctx.lineTo(px - 1.2, py + dropLen * 0.38);
    ctx.stroke();
    ctx.fillStyle = `rgba(250, 245, 237, ${(0.34 * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(px - 2.4, py + dropLen * 0.42);
    ctx.lineTo(px - 5.8, py + dropLen * 0.15);
    ctx.lineTo(px - 2, py + dropLen * 0.22);
    ctx.lineTo(px - 4.8, py + dropLen * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  ctx.beginPath();
  ctx.lineWidth = 1.45;
  ctx.strokeStyle = `rgba(235, 211, 162, ${(0.48 * alpha).toFixed(3)})`;
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCaltropsAreaEffect(effect, cameraX, cameraY, now) {
  const center = worldToScreen(effect.x + 0.5, effect.y + 0.5, cameraX, cameraY);
  const radiusPx = Math.max(8, effect.radius * TILE_SIZE);
  const fadeOut = 1 - clamp((now - effect.endsAt + 380) / 380, 0, 1);
  const alpha = clamp((0.82 - ((now - effect.startedAt) / Math.max(1, effect.durationMs)) * 0.12) * fadeOut, 0, 1);
  const sprite = getCaltropSprite();

  ctx.save();
  const zoneGlow = ctx.createRadialGradient(center.x, center.y, radiusPx * 0.2, center.x, center.y, radiusPx * 1.02);
  zoneGlow.addColorStop(0, `rgba(214, 224, 236, ${(0.08 * alpha).toFixed(3)})`);
  zoneGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = zoneGlow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 16; i += 1) {
    const a = seededUnit(effect.seed, 620 + i * 17) * Math.PI * 2;
    const r = radiusPx * (0.18 + seededUnit(effect.seed, 650 + i * 13) * 0.7);
    const px = center.x + Math.cos(a) * r;
    const py = center.y + Math.sin(a) * r;
    const scale = 0.55 + seededUnit(effect.seed, 680 + i * 11) * 0.38;
    const wobble = Math.sin(now * 0.004 + i) * 0.04;
    const width = sprite.width * scale;
    const height = sprite.height * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a + wobble);
    ctx.globalAlpha = alpha * 0.92;
    ctx.drawImage(sprite, -width * 0.5, -height * 0.5, width, height);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.lineWidth = 1.35;
  ctx.strokeStyle = `rgba(220, 229, 242, ${(0.42 * alpha).toFixed(3)})`;
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRicochetShotAreaEffect(effect, cameraX, cameraY, now) {
  const dir = normalizeDirection(effect.dx, effect.dy) || { dx: 1, dy: 0 };
  const startX = Number.isFinite(Number(effect.startX)) ? Number(effect.startX) : effect.x;
  const startY = Number.isFinite(Number(effect.startY)) ? Number(effect.startY) : effect.y;
  const lengthTiles = Math.max(0.25, Number(effect.length) || Number(effect.radius) || 1);
  const endX = startX + dir.dx * lengthTiles;
  const endY = startY + dir.dy * lengthTiles;
  const start = worldToScreen(startX + 0.5, startY + 0.5, cameraX, cameraY);
  const end = worldToScreen(endX + 0.5, endY + 0.5, cameraX, cameraY);
  const widthPx = Math.max(2.5, (Number(effect.width) || 0.35) * TILE_SIZE);
  const fadeOut = 1 - clamp((now - effect.endsAt + 120) / 120, 0, 1);
  drawTaperedTracerBeam(start, end, Number(effect.seed) || 0, now, {
    alpha: fadeOut,
    widthPx,
    outerGlowColor: [245, 181, 96],
    coreColor: [244, 231, 210],
    hotColor: [255, 249, 236],
    streakColor: [255, 214, 140],
    sparkCount: 4
  });
}

function drawPiercingBoltAreaEffect(effect, cameraX, cameraY, now) {
  const dir = normalizeDirection(effect.dx, effect.dy) || { dx: 1, dy: 0 };
  const startX = Number.isFinite(Number(effect.startX)) ? Number(effect.startX) : effect.x;
  const startY = Number.isFinite(Number(effect.startY)) ? Number(effect.startY) : effect.y;
  const lengthTiles = Math.max(0.25, Number(effect.length) || Number(effect.radius) || 1);
  const endX = startX + dir.dx * lengthTiles;
  const endY = startY + dir.dy * lengthTiles;
  const start = worldToScreen(startX + 0.5, startY + 0.5, cameraX, cameraY);
  const end = worldToScreen(endX + 0.5, endY + 0.5, cameraX, cameraY);
  const widthPx = Math.max(3.4, (Number(effect.width) || 0.5) * TILE_SIZE);
  const fadeIn = clamp((now - effect.startedAt) / 60, 0, 1);
  const fadeOut = 1 - clamp((now - effect.endsAt + 120) / 120, 0, 1);
  drawTaperedTracerBeam(start, end, Number(effect.seed) || 0, now, {
    alpha: fadeIn * fadeOut,
    widthPx,
    outerGlowColor: [255, 185, 92],
    coreColor: [244, 230, 203],
    hotColor: [255, 250, 239],
    streakColor: [255, 214, 136],
    sparkCount: 8
  });
}

function drawBallistaNestAreaEffect(effect, cameraX, cameraY, now) {
  const count = Math.max(1, Math.round(Number(effect.summonCount) || 1));
  const abilityDef = findAbilityDefById(effect.abilityId) || findAbilityDefById("ballistaNest");
  const formationRadius = Math.max(
    Number(effect.formationRadius) || Number(abilityDef?.summonFormationRadius) || 0.8,
    count >= 3 ? 1.2 : count === 2 ? 0.95 : 0
  );
  const positions = sharedComputeSummonFormationPositions(effect.x, effect.y, count, formationRadius);
  const ageMs = Math.max(0, now - Number(effect.startedAt || now));
  const fadeOut = 1 - clamp((now - effect.endsAt + 260) / 260, 0, 1);
  const spawnAlpha = clamp(ageMs / 320, 0, 1);
  const alpha = clamp(spawnAlpha * fadeOut, 0, 1);
  const attackIntervalMs = Math.max(120, Number(effect.attackIntervalMs) || 1000);
  const attackPhase = (ageMs % attackIntervalMs) / attackIntervalMs;

  for (const ballista of positions) {
    const screen = worldToScreen(ballista.x + 0.5, ballista.y + 0.5, cameraX, cameraY);
    const baseGlow = ctx.createRadialGradient(screen.x, screen.y + 7, 0, screen.x, screen.y + 7, 14);
    baseGlow.addColorStop(0, `rgba(255, 210, 146, ${(0.24 * alpha).toFixed(3)})`);
    baseGlow.addColorStop(0.48, `rgba(176, 110, 46, ${(0.16 * alpha).toFixed(3)})`);
    baseGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = baseGlow;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y + 7, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(60, 40, 24, ${(0.78 * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 7.8, 10.5, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();

    drawBallistaSprite(
      screen.x,
      screen.y - 1.5,
      0.46 + 0.04 * spawnAlpha,
      alpha,
      now + ballista.index * 41,
      attackPhase > 0.74 ? (attackPhase - 0.74) / 0.26 : 0
    );
  }
}

function drawTargetCircleCastPreview(self, cameraX, cameraY, now) {
  drawCircularTargetPreview(self, cameraX, cameraY, now);
}

function drawBallistaNestCastPreview(self, cameraX, cameraY, now) {
  const previewState = getCurrentAbilityPreviewState();
  const preview = drawCircularTargetPreview(self, cameraX, cameraY, now, {
    fallbackId: "ballistaNest",
    strokeColor: "rgba(248, 219, 170, 0.72)",
    fillColor: "rgba(188, 126, 66, 0.13)"
  });
  if (!preview || !self || !previewState) {
    return;
  }
  const targetX = Number(previewState.targetX);
  const targetY = Number(previewState.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return;
  }
  const activeAbilityId = String(previewState.abilityId || "");
  const abilityDef = findAbilityDefById(activeAbilityId) || findAbilityDefById("ballistaNest");
  const level = getSelfAbilityLevel(self, activeAbilityId, 1);
  const summonCount = sharedGetSummonCountForLevel(
    Number(abilityDef?.summonCount) || 1,
    Number(abilityDef?.summonCountPerLevel) || 0,
    level,
    {
      everyLevels: Number(abilityDef?.summonCountEveryLevels) || 0,
      maxCount: Number(abilityDef?.maxSummonCount) || 0
    }
  );
  const formationRadius = Math.max(
    0,
    Number(abilityDef?.summonFormationRadius) || 0.8,
    summonCount >= 3 ? 1.2 : summonCount === 2 ? 0.95 : 0
  );
  const positions = sharedComputeSummonFormationPositions(targetX, targetY, summonCount, formationRadius);
  const dist = Math.hypot(targetX - self.x, targetY - self.y);
  const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(activeAbilityId, self));
  const inRange = castRange <= 0 || dist <= castRange + 0.001;
  const pulse = 0.76 + Math.sin(now * 0.012) * 0.14;
  for (const ballista of positions) {
    const screen = worldToScreen(ballista.x + 0.5, ballista.y + 0.5, cameraX, cameraY);
    drawBallistaSprite(screen.x, screen.y - 2, 0.46, (inRange ? 0.42 : 0.26) * pulse, now + ballista.index * 31, 0);
  }
}

function drawAreaEffects(cameraX, cameraY, now, layer = "all") {
  for (const [id, effect] of activeAreaEffectsById.entries()) {
    if (!effect || now >= effect.endsAt + 420) {
      activeAreaEffectsById.delete(id);
      continue;
    }
    const isSummon = String(effect.kind || "").toLowerCase() === "summon";
    if (layer === "underlay" && isSummon) {
      continue;
    }
    if (layer === "overlay" && !isSummon) {
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
  const previewState = getCurrentAbilityPreviewState();
  if (!self || !previewState) {
    return;
  }
  const targetX = Number(previewState.targetX);
  const targetY = Number(previewState.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return;
  }
  const activeAbilityId = String(previewState.abilityId || "");
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

function drawFireHydraCastPreview(self, cameraX, cameraY, now) {
  const previewState = getCurrentAbilityPreviewState();
  if (!self || !previewState) {
    return;
  }
  const targetX = Number(previewState.targetX);
  const targetY = Number(previewState.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return;
  }
  const activeAbilityId = String(previewState.abilityId || "");
  const abilityDef = findAbilityDefById(activeAbilityId) || findAbilityDefById("fireHydra");
  const level = getSelfAbilityLevel(self, activeAbilityId, 1);
  const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(activeAbilityId, self));
  const summonCount = sharedGetSummonCountForLevel(
    Number(abilityDef?.summonCount) || 1,
    Number(abilityDef?.summonCountPerLevel) || 0,
    level,
    {
      everyLevels: Number(abilityDef?.summonCountEveryLevels) || 0,
      maxCount: Number(abilityDef?.maxSummonCount) || 0
    }
  );
  const formationRadius = Math.max(
    0,
    Number(abilityDef?.summonFormationRadius) || 0,
    summonCount >= 4 ? 1.6 : summonCount === 3 ? 1.4 : summonCount === 2 ? 1.05 : 0
  );
  const positions = sharedComputeSummonFormationPositions(targetX, targetY, summonCount, formationRadius);
  const center = worldToScreen(targetX + 0.5, targetY + 0.5, cameraX, cameraY);
  const selfP = worldToScreen(self.x + 0.5, self.y + 0.5, cameraX, cameraY);
  const dist = Math.hypot(targetX - self.x, targetY - self.y);
  const inRange = castRange <= 0 || dist <= castRange + 0.001;
  const pulse = 0.76 + Math.sin(now * 0.011) * 0.16;

  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = inRange ? "rgba(255, 195, 120, 0.62)" : "rgba(255, 128, 128, 0.62)";
  ctx.beginPath();
  ctx.moveTo(selfP.x, selfP.y);
  ctx.lineTo(center.x, center.y);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const hydra of positions) {
    const screen = worldToScreen(hydra.x + 0.5, hydra.y + 0.5, cameraX, cameraY);
    drawHydraSprite(screen.x, screen.y - 4, 0.44, inRange ? 0.4 * pulse : 0.28 * pulse, now + hydra.index * 37, 0);
    ctx.beginPath();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = inRange ? "rgba(255, 212, 138, 0.66)" : "rgba(255, 145, 145, 0.6)";
    ctx.arc(screen.x, screen.y + 6, 12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAbilityPreviewSnapMarker(previewState, cameraX, cameraY, now) {
  if (!previewState || !Number.isFinite(Number(previewState.snappedTargetId))) {
    return;
  }
  const targetX = Number(previewState.targetX);
  const targetY = Number(previewState.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return;
  }
  const p = worldToScreen(targetX + 0.5, targetY + 0.5, cameraX, cameraY);
  const pulse = 0.82 + Math.sin(now * 0.015) * 0.16;
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = `rgba(255, 246, 198, ${(0.72 * pulse).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12 + pulse * 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 5.8 + pulse * 1.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGenericAbilityCastPreview(self, cameraX, cameraY, now, previewState) {
  if (!self || !previewState) {
    return;
  }
  const activeAbilityId = String(previewState.abilityId || "");
  const abilityDef = findAbilityDefById(activeAbilityId) || getActionDefById(activeAbilityId);
  const kind = String(abilityDef && abilityDef.kind || "").trim().toLowerCase();
  const targetX = Number(previewState.targetX);
  const targetY = Number(previewState.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return;
  }

  const start = worldToScreen(self.x + 0.5, self.y + 0.5, cameraX, cameraY);
  const end = worldToScreen(targetX + 0.5, targetY + 0.5, cameraX, cameraY);
  const dx = targetX - self.x;
  const dy = targetY - self.y;
  const len = Math.hypot(dx, dy);
  const direction = len > 0.0001 ? { dx: dx / len, dy: dy / len } : getMobileAbilityAimFallbackDirection(self);
  const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(activeAbilityId, self));
  const inRange = castRange <= 0 || len <= castRange + 0.001;
  const strokeColor = inRange ? "rgba(214, 228, 255, 0.72)" : "rgba(255, 164, 164, 0.72)";
  const fillColor = inRange ? "rgba(124, 178, 240, 0.14)" : "rgba(214, 104, 104, 0.14)";
  const pulse = 0.72 + Math.sin(now * 0.011) * 0.14;

  if (kind === "area" || kind === "summon" || kind === "teleport") {
    drawCircularTargetPreview(self, cameraX, cameraY, now, {
      fallbackId: activeAbilityId,
      radius: kind === "teleport" ? 0.45 : undefined,
      strokeColor,
      fillColor
    });
    return;
  }

  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = inRange ? "rgba(206, 220, 245, 0.46)" : "rgba(255, 141, 141, 0.48)";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (kind === "meleecone") {
    const coneAngleDeg = Math.max(24, Number(abilityDef && abilityDef.coneAngleDeg) || 90);
    const halfAngle = (coneAngleDeg * Math.PI) / 360;
    const radiusPx = Math.max(18, Math.max(0.5, castRange || len || 1.8) * TILE_SIZE);
    const facing = Math.atan2(direction.dy, direction.dx);
    ctx.fillStyle = inRange ? `rgba(239, 230, 185, ${(0.16 * pulse).toFixed(3)})` : `rgba(214, 104, 104, ${(0.15 * pulse).toFixed(3)})`;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.arc(start.x, start.y, radiusPx, facing - halfAngle, facing + halfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (kind === "beam" || kind === "chain") {
    const beamWidthPx = Math.max(4, (Number(abilityDef && abilityDef.beamWidth) || 0.5) * TILE_SIZE);
    ctx.strokeStyle = inRange ? `rgba(176, 214, 255, ${(0.18 * pulse).toFixed(3)})` : `rgba(214, 104, 104, ${(0.18 * pulse).toFixed(3)})`;
    ctx.lineWidth = beamWidthPx * 1.7;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = inRange ? `rgba(242, 248, 255, ${(0.86 * pulse).toFixed(3)})` : `rgba(255, 210, 210, ${(0.82 * pulse).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, beamWidthPx * 0.28);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const projectileCount = Math.max(1, Math.floor(Number(abilityDef && abilityDef.projectileCount) || 1));
  const spreadDeg = Math.max(0, Number(abilityDef && abilityDef.spreadDeg) || 0);
  const lineCount = projectileCount > 1 ? projectileCount : 1;
  const baseAngle = Math.atan2(direction.dy, direction.dx);
  const previewRange = Math.max(castRange, len, 0.5);
  for (let index = 0; index < lineCount; index += 1) {
    const spreadOffset =
      lineCount > 1 && spreadDeg > 0
        ? (((index / Math.max(1, lineCount - 1)) - 0.5) * spreadDeg * Math.PI) / 180
        : 0;
    const angle = baseAngle + spreadOffset;
    const endPoint = worldToScreen(
      self.x + Math.cos(angle) * previewRange + 0.5,
      self.y + Math.sin(angle) * previewRange + 0.5,
      cameraX,
      cameraY
    );
    ctx.strokeStyle = inRange ? `rgba(236, 242, 250, ${(0.8 * pulse).toFixed(3)})` : `rgba(255, 210, 210, ${(0.76 * pulse).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
  }

  const endpointRadiusPx = Math.max(
    5,
    Math.max(Number(abilityDef && abilityDef.explosionRadius) || 0, Number(abilityDef && abilityDef.projectileHitRadius) || 0.25) * TILE_SIZE
  );
  ctx.beginPath();
  ctx.fillStyle = inRange ? `rgba(165, 208, 255, ${(0.12 * pulse).toFixed(3)})` : `rgba(214, 104, 104, ${(0.12 * pulse).toFixed(3)})`;
  ctx.arc(end.x, end.y, endpointRadiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = strokeColor;
  ctx.arc(end.x, end.y, endpointRadiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const ABILITY_AREA_EFFECT_RENDERERS = Object.freeze({
  blizzard: drawBlizzardAreaEffect,
  arcane_beam: drawArcaneBeamAreaEffect,
  lightning_beam: drawLightningBeamAreaEffect,
  fire_hydra: drawFireHydraAreaEffect,
  rain_of_arrows: drawRainOfArrowsAreaEffect,
  caltrops: drawCaltropsAreaEffect,
  ricochet_shot: drawRicochetShotAreaEffect,
  ballista_nest: drawBallistaNestAreaEffect,
  piercing_bolt: drawPiercingBoltAreaEffect
});

const ABILITY_CAST_PREVIEW_RENDERERS = Object.freeze({
  blizzard: drawBlizzardCastPreview,
  fire_hydra: drawFireHydraCastPreview,
  target_circle: drawTargetCircleCastPreview,
  ballista_nest: drawBallistaNestCastPreview
});

function drawAbilityCastPreview(self, cameraX, cameraY, now) {
  const previewState = getCurrentAbilityPreviewState();
  if (!self || !previewState) {
    return;
  }
  const actionDef = getActionDefById(previewState.abilityId);
  const castHook = getAbilityVisualHook(previewState.abilityId, actionDef, "castPreviewRenderer", "");
  const drawCastPreview = ABILITY_CAST_PREVIEW_RENDERERS[castHook];
  if (drawCastPreview) {
    drawCastPreview(self, cameraX, cameraY, now);
  } else {
    drawGenericAbilityCastPreview(self, cameraX, cameraY, now, previewState);
  }
  drawAbilityPreviewSnapMarker(previewState, cameraX, cameraY, now);
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
  const frameSize = MOB_SPRITE_SIZE + 24;

  for (let i = 0; i < 6; i += 1) {
    const phase = (i / 6) * Math.PI * 2;
    const pose = Math.sin(phase);
    const frame = document.createElement("canvas");
    frame.width = frameSize;
    frame.height = frameSize;
    const fctx = frame.getContext("2d");
    fctx.translate(frameSize / 2, frameSize / 2);
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
  if (!mobRenderTools) {
    return document.createElement("canvas");
  }
  return mobRenderTools.createMobSprite(typeName, style);
}

function drawMobHpBar(mob, p) {
  if (!mobRenderTools) {
    return;
  }
  mobRenderTools.drawMobHpBar(mob, p);
}

function getHoveredMob(mobs, cameraX, cameraY) {
  if (!mobRenderTools) {
    return null;
  }
  return mobRenderTools.getHoveredMob(mobs, cameraX, cameraY);
}

function getHoveredLootBag(lootBags, cameraX, cameraY) {
  if (!mobRenderTools) {
    return null;
  }
  return mobRenderTools.getHoveredLootBag(lootBags, cameraX, cameraY);
}

function drawMobTooltip(mob, p) {
  if (!uiPresentationTools) {
    return;
  }
  uiPresentationTools.drawMobTooltip(mob, p);
}

function drawLootBagTooltip(bag, p) {
  if (!uiPresentationTools) {
    return;
  }
  uiPresentationTools.drawLootBagTooltip(bag, p);
}

function createTownTileSprite(kind, variantSeed) {
  const tile = document.createElement("canvas");
  tile.width = TILE_SIZE;
  tile.height = TILE_SIZE;
  const tctx = tile.getContext("2d");
  if (!tctx) {
    return tile;
  }
  const seed = Math.abs(Math.floor(Number(variantSeed) || 0));

  if (kind === "wall") {
    tctx.fillStyle = "#3e3124";
    tctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    tctx.fillStyle = "#5d4a37";
    tctx.fillRect(0, 0, TILE_SIZE, 6);
    for (let row = 0; row < 4; row += 1) {
      const y = 6 + row * 7;
      const rowOffset = ((seed + row) % 3) * 3;
      for (let x = -rowOffset; x < TILE_SIZE + 8; x += 11) {
        const width = 10 + ((seed + row + x) % 4);
        const height = 6 + ((seed + row * 3 + x) % 3);
        tctx.fillStyle = row % 2 === 0 ? "#735b43" : "#6a533d";
        tctx.fillRect(x, y, width, height);
        tctx.strokeStyle = "rgba(27, 18, 12, 0.35)";
        tctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
      }
    }
    tctx.fillStyle = "rgba(255, 213, 144, 0.12)";
    tctx.fillRect(0, 0, TILE_SIZE, 3);
  } else {
    tctx.fillStyle = "#2a241c";
    tctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    for (let index = 0; index < 14; index += 1) {
      const px = (seed * 17 + index * 13) % TILE_SIZE;
      const py = (seed * 29 + index * 11) % TILE_SIZE;
      const size = 4 + ((seed + index) % 5);
      tctx.fillStyle = index % 2 === 0 ? "rgba(110, 92, 67, 0.32)" : "rgba(84, 69, 50, 0.34)";
      tctx.fillRect(px, py, size, size);
    }
    tctx.strokeStyle = "rgba(255, 217, 158, 0.06)";
    tctx.lineWidth = 1;
    for (let crack = 0; crack < 3; crack += 1) {
      const startX = (seed * 19 + crack * 9) % TILE_SIZE;
      const startY = (seed * 7 + crack * 13) % TILE_SIZE;
      tctx.beginPath();
      tctx.moveTo(startX, startY);
      tctx.lineTo(startX + 5 + ((seed + crack) % 6), startY + 3 + ((seed + crack * 5) % 5));
      tctx.lineTo(startX + 10 + ((seed + crack * 2) % 7), startY + 1 + ((seed + crack * 3) % 6));
      tctx.stroke();
    }
  }
  return tile;
}

function getTownTileSprite(kind, tileX, tileY) {
  const variantSeed = Math.abs(((tileX * 73856093) ^ (tileY * 19349663)) % 11);
  const cacheKey = `${kind}:${variantSeed}`;
  if (townTileSpriteCache.has(cacheKey)) {
    return townTileSpriteCache.get(cacheKey);
  }
  const sprite = createTownTileSprite(kind, variantSeed);
  townTileSpriteCache.set(cacheKey, sprite);
  return sprite;
}

function createVendorNpcSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = 56;
  sprite.height = 72;
  const sctx = sprite.getContext("2d");
  if (!sctx) {
    return sprite;
  }
  sctx.translate(28, 36);

  sctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  sctx.beginPath();
  sctx.ellipse(0, 20, 15, 7, 0, 0, Math.PI * 2);
  sctx.fill();

  sctx.fillStyle = "#5e2f1a";
  sctx.beginPath();
  sctx.moveTo(-12, 18);
  sctx.quadraticCurveTo(0, -6, 12, 18);
  sctx.lineTo(7, 24);
  sctx.lineTo(-7, 24);
  sctx.closePath();
  sctx.fill();

  sctx.fillStyle = "#b96e34";
  sctx.fillRect(-9, 2, 18, 7);
  sctx.fillRect(-7, -7, 14, 12);
  sctx.fillStyle = "#f0c688";
  sctx.beginPath();
  sctx.arc(0, -12, 8, 0, Math.PI * 2);
  sctx.fill();

  sctx.strokeStyle = "#3a2414";
  sctx.lineWidth = 2;
  sctx.beginPath();
  sctx.moveTo(-9, 7);
  sctx.lineTo(-18, 18);
  sctx.moveTo(9, 7);
  sctx.lineTo(18, 18);
  sctx.stroke();

  sctx.fillStyle = "#8b5a2f";
  sctx.fillRect(9, -2, 8, 14);
  sctx.fillStyle = "#d5ad59";
  sctx.beginPath();
  sctx.arc(18, -4, 8, 0, Math.PI * 2);
  sctx.fill();
  sctx.fillStyle = "#86511a";
  for (let i = 0; i < 4; i += 1) {
    sctx.beginPath();
    sctx.arc(15 + (i % 2) * 5 - 2, -7 + Math.floor(i / 2) * 5, 2, 0, Math.PI * 2);
    sctx.fill();
  }

  sctx.strokeStyle = "rgba(255, 224, 166, 0.38)";
  sctx.lineWidth = 1;
  sctx.strokeRect(-10.5, -0.5, 21, 10);
  return sprite;
}

function getVendorNpcSprite() {
  if (!vendorNpcSprite) {
    vendorNpcSprite = createVendorNpcSprite();
  }
  return vendorNpcSprite;
}

function drawTown(cameraX, cameraY) {
  const layout = townClientState.layout;
  if (!layout || layout.enabled === false) {
    return;
  }
  for (let tileY = layout.minTileY; tileY <= layout.maxTileY; tileY += 1) {
    for (let tileX = layout.minTileX; tileX <= layout.maxTileX; tileX += 1) {
      const p = worldToScreen(tileX, tileY, cameraX, cameraY);
      if (p.x + TILE_SIZE < 0 || p.y + TILE_SIZE < 0 || p.x > canvas.width || p.y > canvas.height) {
        continue;
      }
      const isWall = isTownWallTileAt(tileX, tileY);
      const sprite = getTownTileSprite(isWall ? "wall" : "floor", tileX, tileY);
      ctx.drawImage(sprite, Math.round(p.x), Math.round(p.y), TILE_SIZE, TILE_SIZE);
      if (isTownGateTileAt(tileX, tileY)) {
        ctx.fillStyle = "rgba(232, 196, 129, 0.16)";
        ctx.fillRect(Math.round(p.x + 4), Math.round(p.y + 4), TILE_SIZE - 8, TILE_SIZE - 8);
      }
    }
  }
}

function drawVendorNpc(cameraX, cameraY, frameNow) {
  const vendor = getTownVendor();
  if (!vendor) {
    return;
  }
  const bob = Math.sin(frameNow / 340) * 1.2;
  const p = worldToScreen(Number(vendor.x) + 0.5, Number(vendor.y) + 0.5, cameraX, cameraY);
  const sprite = getVendorNpcSprite();
  ctx.drawImage(sprite, Math.round(p.x - sprite.width / 2), Math.round(p.y - sprite.height / 2 - 4 + bob));
}

function drawVendorTooltip(vendor, p) {
  const title = String(vendor && vendor.name ? vendor.name : "Quartermaster");
  const subtitle = canInteractWithVendor() ? "Right-click to sell gear" : "Right-click to approach";
  ctx.font = "12px sans-serif";
  const width = Math.max(ctx.measureText(title).width, ctx.measureText(subtitle).width) + 18;
  const x = Math.round(p.x - width / 2);
  const y = Math.round(p.y - 52);
  ctx.fillStyle = "rgba(5, 10, 15, 0.94)";
  ctx.strokeStyle = "rgba(203, 167, 88, 0.76)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, width, 34, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4e0aa";
  ctx.fillText(title, x + 9, y + 14);
  ctx.fillStyle = "rgba(224, 230, 236, 0.8)";
  ctx.fillText(subtitle, x + 9, y + 28);
}

function drawGrid(cameraX, cameraY) {
  const tilesX = Math.ceil(canvas.width / TILE_SIZE) + 2;
  const tilesY = Math.ceil(canvas.height / TILE_SIZE) + 2;
  const startX = Math.floor(cameraX - tilesX / 2);
  const startY = Math.floor(cameraY - tilesY / 2);

  drawTown(cameraX, cameraY);

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
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawPlayer(player, cameraX, cameraY, isSelf);
}

function drawPlayerCastBar(player, cameraX, cameraY, isSelf, frameNow) {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawPlayerCastBar(player, cameraX, cameraY, isSelf, frameNow);
}

function drawPlayerStunEffect(player, cameraX, cameraY, isSelf, frameNow) {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawPlayerStunEffect(player, cameraX, cameraY, isSelf, frameNow);
}

function drawPlayerSlowTint(player, cameraX, cameraY, isSelf, frameNow) {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawPlayerSlowTint(player, cameraX, cameraY, isSelf, frameNow);
}

function drawPlayerBurnEffect(player, cameraX, cameraY, isSelf, frameNow) {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawPlayerBurnEffect(player, cameraX, cameraY, isSelf, frameNow);
}

function drawPlayerEffectAnimations(player, cameraX, cameraY, isSelf, frameNow) {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawPlayerEffectAnimations(player, cameraX, cameraY, isSelf, frameNow);
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

function pruneWarriorAnimRuntime() {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.pruneWarriorAnimRuntime();
}

function drawWarriorPlayer(player, p, isSelf) {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawWarriorPlayer(player, p, isSelf);
}

function drawMagePlayer(_player, p, isSelf) {
  if (!playerRenderTools) {
    return;
  }
  playerRenderTools.drawMagePlayer(_player, p, isSelf);
}

function seededUnit(seed, n) {
  const x = Math.sin((seed + n * 374761393) * 0.000001) * 43758.5453;
  return x - Math.floor(x);
}

function pruneProjectileVisualRuntime(now = performance.now()) {
  if (!projectileRenderTools) {
    return;
  }
  projectileRenderTools.pruneProjectileVisualRuntime(now);
}

function drawProjectile(projectile, cameraX, cameraY, frameNow) {
  if (!projectileRenderTools) {
    return;
  }
  projectileRenderTools.drawProjectile(projectile, cameraX, cameraY, frameNow);
}

function drawMob(mob, cameraX, cameraY, attackState = null) {
  if (!mobRenderTools) {
    return;
  }
  mobRenderTools.drawMob(mob, cameraX, cameraY, attackState);
}

function isHumanoidMob(mob) {
  if (!mobRenderTools || typeof mobRenderTools.isHumanoidMob !== "function") {
    return false;
  }
  return !!mobRenderTools.isHumanoidMob(mob);
}

function createLootBagSprite(variant = 0) {
  const spriteSize = 64;
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = spriteSize;
  spriteCanvas.height = spriteSize;
  const spriteCtx = spriteCanvas.getContext("2d");
  if (!spriteCtx) {
    return null;
  }

  const scatterPhase = ((Math.floor(Number(variant) || 0) % 628) / 100) * 0.6;
  spriteCtx.translate(spriteSize * 0.5, spriteSize * 0.5);

  spriteCtx.fillStyle = "rgba(16, 10, 5, 0.34)";
  spriteCtx.beginPath();
  spriteCtx.ellipse(0, 11, 15, 5.5, 0, 0, Math.PI * 2);
  spriteCtx.fill();

  for (let i = 0; i < 3; i += 1) {
    const t = scatterPhase + i * 1.9;
    const coinX = Math.cos(t) * (14 + i * 3) - (i === 1 ? 3 : 0);
    const coinY = 8 + Math.sin(t * 1.4) * 2 + i * 1.5;
    spriteCtx.save();
    spriteCtx.translate(coinX, coinY);
    spriteCtx.rotate(Math.sin(t * 2.2) * 0.24);
    spriteCtx.fillStyle = "#d0a24d";
    spriteCtx.strokeStyle = "#f7d47d";
    spriteCtx.lineWidth = 1;
    spriteCtx.beginPath();
    spriteCtx.ellipse(0, 0, 4.3, 2.1, 0, 0, Math.PI * 2);
    spriteCtx.fill();
    spriteCtx.stroke();
    spriteCtx.beginPath();
    spriteCtx.ellipse(0, 0, 2.1, 0.9, 0, 0, Math.PI * 2);
    spriteCtx.strokeStyle = "rgba(255, 242, 184, 0.8)";
    spriteCtx.stroke();
    spriteCtx.restore();
  }

  spriteCtx.fillStyle = "#5f3d22";
  spriteCtx.beginPath();
  spriteCtx.moveTo(-14, 7);
  spriteCtx.bezierCurveTo(-16, 1, -13, -8, -7, -10);
  spriteCtx.bezierCurveTo(-2, -12, 2, -12, 8, -10);
  spriteCtx.bezierCurveTo(14, -8, 17, 1, 15, 7);
  spriteCtx.bezierCurveTo(11, 13, -10, 13, -14, 7);
  spriteCtx.fill();

  spriteCtx.strokeStyle = "#8c653c";
  spriteCtx.lineWidth = 1.6;
  spriteCtx.beginPath();
  spriteCtx.moveTo(-13, 6);
  spriteCtx.bezierCurveTo(-11, 10, -3, 11, 3, 10);
  spriteCtx.bezierCurveTo(8, 10, 12, 8, 13, 5);
  spriteCtx.stroke();

  spriteCtx.strokeStyle = "rgba(255, 237, 195, 0.25)";
  spriteCtx.lineWidth = 1.1;
  spriteCtx.beginPath();
  spriteCtx.moveTo(-8, -1);
  spriteCtx.quadraticCurveTo(-3, -4, 2, -2);
  spriteCtx.quadraticCurveTo(6, -1, 8, 2);
  spriteCtx.stroke();

  spriteCtx.fillStyle = "#81532c";
  spriteCtx.beginPath();
  spriteCtx.moveTo(-8, -9);
  spriteCtx.quadraticCurveTo(-4, -14, 0, -13);
  spriteCtx.quadraticCurveTo(5, -14, 9, -9);
  spriteCtx.lineTo(8, -4);
  spriteCtx.quadraticCurveTo(3, -6, -2, -6);
  spriteCtx.quadraticCurveTo(-6, -6, -9, -4);
  spriteCtx.closePath();
  spriteCtx.fill();

  spriteCtx.strokeStyle = "#d8b27a";
  spriteCtx.lineWidth = 1.8;
  spriteCtx.beginPath();
  spriteCtx.moveTo(-9, -3);
  spriteCtx.quadraticCurveTo(-2, -1, 8, -3);
  spriteCtx.stroke();
  spriteCtx.lineWidth = 1.1;
  spriteCtx.beginPath();
  spriteCtx.moveTo(-7, -2);
  spriteCtx.quadraticCurveTo(-2, 1, 6, -2);
  spriteCtx.strokeStyle = "#a88457";
  spriteCtx.stroke();

  for (let i = 0; i < 5; i += 1) {
    const t = scatterPhase + i * 0.92;
    const coinX = Math.cos(t) * 7;
    const coinY = -11 + Math.sin(t * 1.6) * 1.8 - i * 0.18;
    spriteCtx.save();
    spriteCtx.translate(coinX, coinY);
    spriteCtx.rotate(Math.sin(t * 2.3) * 0.35);
    spriteCtx.fillStyle = "#d09c43";
    spriteCtx.strokeStyle = "#ffde88";
    spriteCtx.lineWidth = 1;
    spriteCtx.beginPath();
    spriteCtx.ellipse(0, 0, 3.8, 2.2, 0, 0, Math.PI * 2);
    spriteCtx.fill();
    spriteCtx.stroke();
    spriteCtx.beginPath();
    spriteCtx.ellipse(0, 0, 1.7, 0.9, 0, 0, Math.PI * 2);
    spriteCtx.strokeStyle = "rgba(255, 246, 204, 0.85)";
    spriteCtx.stroke();
    spriteCtx.restore();
  }

  spriteCtx.strokeStyle = "#2e1b0d";
  spriteCtx.lineWidth = 1.6;
  spriteCtx.beginPath();
  spriteCtx.moveTo(-14, 7);
  spriteCtx.bezierCurveTo(-16, 1, -13, -8, -7, -10);
  spriteCtx.bezierCurveTo(-2, -12, 2, -12, 8, -10);
  spriteCtx.bezierCurveTo(14, -8, 17, 1, 15, 7);
  spriteCtx.bezierCurveTo(11, 13, -10, 13, -14, 7);
  spriteCtx.stroke();

  return spriteCanvas;
}

function getLootBagSprite(variant) {
  const key = Math.abs(Math.floor(Number(variant) || 0)) % 8;
  if (lootBagSpriteCache.has(key)) {
    return lootBagSpriteCache.get(key);
  }
  const sprite = createLootBagSprite(key);
  lootBagSpriteCache.set(key, sprite);
  return sprite;
}

function drawLootBag(bag, cameraX, cameraY, frameNow = performance.now()) {
  const p = worldToScreen(bag.x + 0.5, bag.y + 0.5, cameraX, cameraY);
  const bagId = String((bag && bag.id) || `${bag.x}:${bag.y}`);
  const seed = hashString(`lootbag:${bagId}`);
  const sprite = getLootBagSprite(seed);

  if (particleSystemTools) {
    particleSystemTools.drawWorldEmitter({
      key: `lootbag:sparkles:${bagId}`,
      x: bag.x + 0.5,
      y: bag.y + 0.5,
      cameraX,
      cameraY,
      now: frameNow,
      ctx,
      worldToScreen,
      config: LOOT_BAG_SPARKLE_PARTICLE_CONFIG
    });
  }
  if (sprite) {
    ctx.drawImage(sprite, Math.round(p.x - sprite.width * 0.5), Math.round(p.y - sprite.height * 0.5));
  }
}

const sharedClientRenderLoop = globalThis.VibeClientRenderLoop || null;
const sharedCreateRenderLoopTools =
  sharedClientRenderLoop && typeof sharedClientRenderLoop.createRenderLoopTools === "function"
    ? sharedClientRenderLoop.createRenderLoopTools
    : null;
const sharedClientWorldViewModels = globalThis.VibeClientWorldViewModels || null;
const sharedCreateWorldViewModelTools =
  sharedClientWorldViewModels && typeof sharedClientWorldViewModels.createWorldViewModelTools === "function"
    ? sharedClientWorldViewModels.createWorldViewModelTools
    : null;
const worldViewModelTools = sharedCreateWorldViewModelTools
  ? sharedCreateWorldViewModelTools({
      gameState,
      getAreaEffects: () => Array.from(activeAreaEffectsById.values()),
      getExplosionViews,
      getTownVendor,
      getActionDefById,
      getAbilityVisualHook,
      getProjectileSpriteFrame:
        projectileRenderTools && typeof projectileRenderTools.getProjectileSpriteFrame === "function"
          ? (projectile, frameNow) => projectileRenderTools.getProjectileSpriteFrame(projectile, frameNow)
          : null,
      getActiveMobAttackState,
      getPlayerAttackState: (player, isSelf, frameNow) => {
        void frameNow;
        return String(player && player.classType || "").toLowerCase() === "warrior"
          && playerRenderTools
          && typeof playerRenderTools.getWarriorSwingState === "function"
          ? playerRenderTools.getWarriorSwingState(player, isSelf)
          : null;
      },
      getMobAttackVisualType,
      isHumanoidMob,
      getPlayerCastVisualState,
      getPlayerStatusVisualState,
      getMobCastVisualState,
      getMobStatusVisualState,
      getFloatingDamageViews,
      getHoveredMob,
      getHoveredLootBag,
      getHoveredVendor
    })
  : null;
const sharedClientCanvasWorldRenderer = globalThis.VibeClientCanvasWorldRenderer || null;
const sharedCreateCanvasWorldRenderer =
  sharedClientCanvasWorldRenderer && typeof sharedClientCanvasWorldRenderer.createCanvasWorldRenderer === "function"
    ? sharedClientCanvasWorldRenderer.createCanvasWorldRenderer
    : null;
const canvasWorldRenderer = sharedCreateCanvasWorldRenderer
  ? sharedCreateCanvasWorldRenderer({
      ctx,
      canvas,
      updateActionBarUI,
      updateMobCastSpatialAudio,
      updateProjectileSpatialAudio,
      drawGrid,
      drawAbilityCastPreview,
      drawProjectile,
      drawExplosionEffects,
      drawAreaEffects,
      drawVendorNpc,
      drawLootBag,
      drawMob,
      drawSkeletonSwordSwing,
      drawSkeletonArcherBowShot,
      drawCreeperIgnitionAnimation,
      drawOrcDualAxeSwing,
      drawMobBiteAnimation,
      drawMobCastBar,
      drawMobSlowTint,
      drawMobBurnEffect,
      drawMobStunEffect,
      drawFloatingDamageNumbers,
      pruneSkeletonWalkRuntime,
      pruneCreeperWalkRuntime,
      pruneZombieWalkRuntime,
      pruneSpiderWalkRuntime,
      pruneOrcWalkRuntime,
      pruneSkeletonArcherWalkRuntime,
      pruneWarriorAnimRuntime,
      pruneProjectileVisualRuntime,
      pruneAmbientParticleEmitters,
      drawPlayer,
      drawPlayerEffectAnimations,
      drawPlayerCastBar,
      drawMobTooltip,
      drawLootBagTooltip,
      drawVendorTooltip
    })
  : null;
const sharedClientPixiWorldRenderer = globalThis.VibeClientPixiWorldRenderer || null;
const sharedCreatePixiWorldRenderer =
  sharedClientPixiWorldRenderer && typeof sharedClientPixiWorldRenderer.createPixiWorldRenderer === "function"
    ? sharedClientPixiWorldRenderer.createPixiWorldRenderer
    : null;
const pixiWorldRenderer = sharedCreatePixiWorldRenderer
  ? sharedCreatePixiWorldRenderer({
      PIXI: globalThis.PIXI || null,
      windowObject: window,
      canvasElement: canvas,
      tileSize: TILE_SIZE,
      townClientState,
      hashString,
      sanitizeCssColor,
      mouseState,
      screenToWorld,
      getCurrentSelf,
      getClassRenderStyle,
      getPlayerVisualEquipment,
      getMobRenderStyle,
      lootBagSparkleConfig: LOOT_BAG_SPARKLE_PARTICLE_CONFIG,
      getLootBagSprite,
      getTownTileSprite,
      getVendorNpcSprite,
      mobSpriteSize: MOB_SPRITE_SIZE,
      getCreeperWalkSprite,
      getSpiderWalkSprite,
      getActionDefById,
      findAbilityDefById,
      getAbilityEffectiveRangeForSelf,
      getAbilityPreviewState: getCurrentAbilityPreviewState,
      getAbilityVisualHook,
      getProjectileSpriteFrame: projectileRenderTools && typeof projectileRenderTools.getProjectileSpriteFrame === "function"
        ? (projectile, frameNow) => projectileRenderTools.getProjectileSpriteFrame(projectile, frameNow)
        : null
    })
  : null;
const sharedClientRendererBootstrap = globalThis.VibeClientRendererBootstrap || null;
const sharedCreateRendererBootstrap =
  sharedClientRendererBootstrap && typeof sharedClientRendererBootstrap.createRendererBootstrap === "function"
    ? sharedClientRendererBootstrap.createRendererBootstrap
    : null;
const rendererBootstrap = sharedCreateRendererBootstrap
  ? sharedCreateRendererBootstrap({
      windowObject: window,
      canvasElement: canvas,
      canvasWorldRenderer,
      pixiWorldRenderer
    })
  : null;
globalThis.__vibemmoGetRendererDebugStats = () =>
  rendererBootstrap && typeof rendererBootstrap.getDebugStats === "function" ? rendererBootstrap.getDebugStats() : null;
const renderLoopTools = sharedCreateRenderLoopTools
  ? sharedCreateRenderLoopTools({
      ctx,
      canvas,
      gameState,
      requestAnimationFrame,
      reportFrame,
      updateAbilityChannel,
      updateResourceBars,
      getInterpolatedState,
      updateActionBarUI,
      buildWorldFrameViewModel: (interpolatedState, frameNow) =>
        worldViewModelTools ? worldViewModelTools.buildWorldFrameViewModel(interpolatedState, frameNow) : null,
      renderWorldFrame: (frameViewModel) => {
        if (rendererBootstrap) {
          return rendererBootstrap.renderWorldFrame(frameViewModel);
        }
        if (canvasWorldRenderer) {
          return canvasWorldRenderer.renderWorldFrame(frameViewModel);
        }
        return null;
      },
      setLastRenderState: (state) => {
        lastRenderState = state;
      },
      hudName,
      hudClass,
      hudPos,
      getMyId: () => myId
    })
  : null;
const sharedClientInputBootstrap = globalThis.VibeClientInputBootstrap || null;
const sharedCreateInputBootstrap =
  sharedClientInputBootstrap && typeof sharedClientInputBootstrap.createInputBootstrap === "function"
    ? sharedClientInputBootstrap.createInputBootstrap
    : null;
const inputBootstrapTools = sharedCreateInputBootstrap
  ? sharedCreateInputBootstrap({
      windowObject: window,
      document,
      canvas,
      joinForm,
      gameUI,
      keys,
      mouseState,
      classDefsById,
      requestAnimationFrame,
      resizeCanvas,
      resumeSpatialAudioContext,
      toggleDebugPanel,
      toggleInventoryPanel,
      toggleEquipmentPanel,
      toggleSpellbookPanel,
      toggleDpsPanel,
      executeBoundAction,
      tryContextVendorInteraction,
      tryContextLootPickup,
      sendMove,
      cancelAutoVendorInteraction: () => clearAutoVendorInteraction(true, true),
      cancelAutoLootPickup: () => clearAutoLootPickup(true),
      updateAutoVendorInteraction,
      updateAutoLootPickup,
      clearDragState,
      resetAbilityChanneling,
      stopAllSpatialLoops,
      updateMouseScreenPosition,
      tryPrimaryAutoAction,
      isTouchJoystickEnabled,
      beginTouchJoystick,
      updateTouchJoystick,
      endTouchJoystick,
      resetTouchJoystick,
      resetMobileAbilityAim,
      hasActiveMobileAbilityAim: () => mobileAbilityAimState.active,
      hasActiveTouchJoystick: () => touchJoystickState.active,
      getActiveTouchJoystickId: () => touchJoystickState.touchId,
      setStatus,
      connectAndJoin,
      updateDebugPanel,
      updateDpsPanel,
      refreshAdminBotList: () => requestAdminBotList(false),
      initializeDpsPanel,
      loadInitialGameConfig,
      render
    })
  : null;

function render() {
  if (!renderLoopTools) {
    return;
  }
  renderLoopTools.renderFrame();
}

function getAutomationDebugMetricsSnapshot() {
  const now = performance.now();
  const upKbps = (Math.max(0, Number(debugState.upBytesWindow) || 0) * 8) / (TRAFFIC_WINDOW_MS / 1000) / 1000;
  const downKbps = (Math.max(0, Number(debugState.downBytesWindow) || 0) * 8) / (TRAFFIC_WINDOW_MS / 1000) / 1000;
  let fps = 0;
  if (uiPanelTools && typeof uiPanelTools.getFps === "function") {
    fps = Number(uiPanelTools.getFps(now)) || 0;
  } else if (Array.isArray(debugState.frameSamples) && debugState.frameSamples.length > 1) {
    const first = Number(debugState.frameSamples[0]) || now;
    const elapsedMs = Math.max(1, now - first);
    fps = ((debugState.frameSamples.length - 1) * 1000) / elapsedMs;
  }
  return {
    upKbps,
    downKbps,
    fps,
    mobCount: Math.max(0, Math.floor(Number(debugState.totalMobCount) || 0))
  };
}

function getAutomationRendererStatsSnapshot() {
  if (rendererBootstrap && typeof rendererBootstrap.getDebugStats === "function") {
    const stats = rendererBootstrap.getDebugStats();
    return stats && typeof stats === "object" ? { ...stats } : { mode: rendererBootstrap.getRendererMode() };
  }
  return {
    mode: rendererBootstrap ? rendererBootstrap.getRendererMode() : "canvas"
  };
}

function buildAutomationSnapshot() {
  return {
    rendererMode: rendererBootstrap ? rendererBootstrap.getRendererMode() : "canvas",
    debugMetrics: getAutomationDebugMetricsSnapshot(),
    rendererStats: getAutomationRendererStatsSnapshot(),
    self: gameState.self
      ? {
          id: myId,
          x: Number(gameState.self.x) || 0,
          y: Number(gameState.self.y) || 0,
          hp: Number(gameState.self.hp) || 0,
          maxHp: Number(gameState.self.maxHp) || 0,
          mana: Number(gameState.self.mana) || 0,
          maxMana: Number(gameState.self.maxMana) || 0,
          classType: selfStatic ? selfStatic.classType : "",
          isAdmin: !!(selfStatic && selfStatic.isAdmin),
          level: entityRuntime.self ? Number(entityRuntime.self.level) || 0 : 0,
          copper: entityRuntime.self ? Number(entityRuntime.self.copper) || 0 : 0,
          abilityLevels:
            entityRuntime.self && entityRuntime.self.abilityLevels && typeof entityRuntime.self.abilityLevels === "object"
              ? { ...entityRuntime.self.abilityLevels }
              : {}
        }
      : null,
    players: gameState.players.map((player) => ({
      id: player.id,
      x: Number(player.x) || 0,
      y: Number(player.y) || 0,
      hp: Number(player.hp) || 0,
      maxHp: Number(player.maxHp) || 0,
      name: String(player.name || ""),
      classType: String(player.classType || "")
    })),
    mobs: gameState.mobs.map((mob) => ({
      id: mob.id,
      x: Number(mob.x) || 0,
      y: Number(mob.y) || 0,
      hp: Number(mob.hp) || 0,
      maxHp: Number(mob.maxHp) || 0,
      name: String(mob.type || mob.name || ""),
      level: Math.max(1, Math.floor(Number(mob.level) || 1))
    })),
    projectiles: gameState.projectiles.map((projectile) => ({
      id: projectile.id,
      x: Number(projectile.x) || 0,
      y: Number(projectile.y) || 0,
      abilityId: String(projectile.abilityId || "")
    })),
    lootBags: gameState.lootBags.map((bag) => ({
      id: bag.id,
      x: Number(bag.x) || 0,
      y: Number(bag.y) || 0,
      items: Array.isArray(bag.items) ? bag.items.map((entry) => ({ ...entry })) : []
    })),
    areaEffects: Array.from(activeAreaEffectsById.values()).map((effect) => ({
      id: String(effect.id || ""),
      abilityId: String(effect.abilityId || ""),
      kind: String(effect.kind || ""),
      x: Number(effect.x) || 0,
      y: Number(effect.y) || 0,
      radius: Number(effect.radius) || 0,
      summonCount: Math.max(1, Math.round(Number(effect.summonCount) || 1)),
      formationRadius: Math.max(0, Number(effect.formationRadius) || 0)
    })),
    inventory: inventoryState.slots.map((slot) => (slot ? { ...slot } : null)),
    equipment: { ...equipmentState.slots },
    status: statusEl ? String(statusEl.textContent || "") : "",
    equipmentVisible: equipmentPanel ? !equipmentPanel.classList.contains("hidden") : false,
    adminBotPanelVisible: botListPanel ? !botListPanel.classList.contains("hidden") : false,
    adminBots: adminBotState.bots.map((bot) => ({ ...bot })),
    adminBotInspect: adminBotState.inspectBot ? { ...adminBotState.inspectBot } : null
  };
}

function installAutomationApi() {
  if (!window || !["localhost", "127.0.0.1"].includes(String(window.location.hostname || ""))) {
    return;
  }
  window.__vibemmoTest = Object.freeze({
    getState: () => buildAutomationSnapshot(),
    getRendererMode: () => (rendererBootstrap ? rendererBootstrap.getRendererMode() : "canvas"),
    setRendererMode(mode) {
      if (!rendererBootstrap) {
        return "canvas";
      }
      return rendererBootstrap.setRendererMode(mode);
    },
    connectAndJoin,
    send: (payload) => sendJsonMessage(payload),
    setMove(dx, dy) {
      sendJsonMessage({
        type: "move",
        dx,
        dy
      });
    },
    stopMove() {
      sendJsonMessage({
        type: "move",
        dx: 0,
        dy: 0
      });
    },
    castAtWorld(abilityId, targetX, targetY) {
      const self = getCurrentSelf();
      if (!self) {
        return false;
      }
      const dx = Number(targetX) - Number(self.x);
      const dy = Number(targetY) - Number(self.y);
      const dir = normalizeDirection(dx, dy);
      if (!dir) {
        return false;
      }
      sendJsonMessage({
        type: "use_ability",
        abilityId,
        dx: dir.dx,
        dy: dir.dy,
        distance: Math.hypot(dx, dy)
      });
      return true;
    },
    pickupNearestBag() {
      const self = getCurrentSelf();
      if (!self || !gameState.lootBags.length) {
        return false;
      }
      let best = null;
      let bestDist = Infinity;
      for (const bag of gameState.lootBags) {
        const dist = Math.hypot(bag.x - self.x, bag.y - self.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = bag;
        }
      }
      if (!best) {
        return false;
      }
      sendJsonMessage({
        type: "pickup_bag",
        x: best.x,
        y: best.y
      });
      return true;
    },
    equipInventoryIndex(index, slot) {
      sendJsonMessage({
        type: "equip_item",
        inventoryIndex: index,
        slot
      });
    },
    toggleEquipmentPanel
  });
}

initializeDebugAdminControls();
installAutomationApi();

if (inputBootstrapTools) {
  inputBootstrapTools.bind();
}
