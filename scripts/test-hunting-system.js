const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadMobConfigFromDisk } = require("../server/config/mob-config");
const { createSkillTools } = require("../server/gameplay/skills");
const { createMobLifecycleTools } = require("../server/gameplay/mob-lifecycle");
const { createMobTickSystem } = require("../server/runtime/mob-tick");
const { pickClusterDef } = require("../server/gameplay/cluster-spawn");

function loadItemsMap() {
  const filePath = path.resolve(__dirname, "../data/items.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return new Map((Array.isArray(raw) ? raw : []).map((entry) => [String(entry.id || ""), entry]));
}

function createAbilityDefs() {
  return new Map([["mobMeleeSwing", { id: "mobMeleeSwing", range: 1.5 }]]);
}

function testBiomeFilteredAnimals(mobConfig) {
  const meadowCluster = pickClusterDef(mobConfig, {
    distanceFromCenter: 110,
    biomeInfo: { tags: ["starter_ring", "north", "meadow"] }
  });
  assert.ok(meadowCluster, "Expected a starter biome cluster");
  assert.ok(
    ["Rabbit Warren", "Deer Herd", "Undead Horde", "Arachnid Swarm", "Explosive Threat", "Berserker Patrol"].includes(
      meadowCluster.name
    ),
    "Expected a valid cluster name"
  );

  const swampMidCluster = pickClusterDef(mobConfig, {
    distanceFromCenter: 260,
    biomeInfo: { tags: ["midlands", "south", "swamp"] }
  });
  assert.ok(swampMidCluster, "Expected a midlands biome cluster");
  const allowed = Array.isArray(swampMidCluster.biomeTagsAny) && swampMidCluster.biomeTagsAny.length > 0
    ? swampMidCluster.biomeTagsAny.includes("swamp") || swampMidCluster.biomeTagsAny.includes("riverland")
    : true;
  assert.ok(allowed, "Expected biome-tagged selection to respect swamp-compatible clusters");
}

function testFleeBehavior() {
  const mobs = new Map();
  const players = new Map();
  const player = { id: "player-1", x: 10, y: 10, hp: 50 };
  const mob = {
    id: "mob-1",
    x: 12,
    y: 10,
    spawnX: 12,
    spawnY: 10,
    hp: 10,
    alive: true,
    baseSpeed: 2,
    returningHome: false,
    activeCast: null,
    wanderTarget: null,
    nextWanderAt: 0,
    chaseTargetPlayerId: null,
    chaseUntil: 0,
    stunnedUntil: 0,
    panicUntil: 0,
    slowUntil: 0,
    slowMultiplier: 1,
    burningUntil: 0,
    activeDots: new Map(),
    abilityCooldowns: new Map(),
    lastThreatPosition: null,
    combat: {
      behavior: "flee",
      aggroRange: 6,
      preferredRange: 8,
      leashRange: 15,
      panicDurationMs: 3000,
      fleeSpeedMultiplier: 1.2,
      basicAttack: { range: 1.1 }
    }
  };
  mobs.set(mob.id, mob);
  players.set(player.id, player);

  const tickSystem = createMobTickSystem({
    mobs,
    players,
    tickMs: 100,
    mobWanderRadius: 4,
    mobProvokedLeashRadius: 16,
    mobAggroRange: 5,
    mobAttackRange: 1.25,
    mobMinSeparation: 0.5,
    mobSeparationIterations: 1,
    randomInt: (min) => min,
    randomPointInRadius: (x, y) => ({ x, y }),
    distance: (a, b) => Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)),
    normalizeDirection: (dx, dy) => {
      const len = Math.hypot(dx, dy);
      return len > 0 ? { dx: dx / len, dy: dy / len } : null;
    },
    clampToSpawnRadius: (x, y) => ({ x, y }),
    townLayout: null,
    ensureObservedSpawnerCoverage: () => {},
    refreshMobObservation: () => {},
    despawnUnobservedMobs: () => {},
    respawnMob: () => {},
    isSpawnerObserved: () => true,
    tickMobDotEffects: () => {},
    clearMobCast: () => {},
    completeMobAbilityCast: () => {},
    getMobMoveSpeed: () => 2,
    getMobDistanceFromSpawn: () => 0,
    hasActiveProvokedChase: () => false,
    startMobReturnToSpawn: () => {},
    getMobCombatProfile: (entry) => entry.combat,
    getNearestAggroPlayer: () => ({ player, dist: 2 }),
    tryMobCastConfiguredAbility: () => false,
    tryMobBasicAttack: () => false,
    getMobLeashRadius: () => 15,
    resolveAllPlayersAgainstMobs: () => {}
  });

  const beforeDistance = Math.hypot(mob.x - player.x, mob.y - player.y);
  tickSystem.tickMobs();
  const afterDistance = Math.hypot(mob.x - player.x, mob.y - player.y);
  assert.ok(afterDistance > beforeDistance, "Expected flee mob to increase distance from player");
}

function testHuntingXpAndLoot(skillTools) {
  const mobs = new Map();
  const mobSpawners = new Map();
  const players = new Map();
  const lootBags = [];
  const hunter = {
    id: "hunter-1",
    hp: 50,
    maxHp: 50,
    mana: 20,
    maxMana: 20,
    ws: {},
    questState: { active: {}, completed: [] }
  };
  players.set(hunter.id, hunter);
  skillTools.ensurePlayerSkillsState(hunter);

  const lifecycle = createMobLifecycleTools({
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    randomInt: (min) => min,
    randomPointInRadius: (x, y) => ({ x, y }),
    pickClusterDef: () => null,
    mobSpawners,
    mobs,
    players,
    clearMobCast: () => {},
    queueMobDeathEvent: () => {},
    rollGlobalDropsForPlayer: () => [],
    rollMobDrops: (mob) => mob.dropRules.map((rule) => ({ itemId: rule.itemId, qty: 1 })),
    rollEquipmentDropsAt: () => [],
    createLootBag: (x, y, items) => lootBags.push({ x, y, items }),
    normalizeItemEntries: (entries) => entries,
    grantPlayerExp: () => {},
    skillTools,
    allocateMobId: () => "mob-1",
    allocateSpawnerId: () => "spawner-1",
    getServerConfig: () => ({ mobSpawnMultiplier: 1 }),
    getMobConfig: () => ({ maxSpawnRadius: 500 }),
    biomeResolver: null,
    townLayout: null,
    mapWidth: 1000,
    mapHeight: 1000,
    targetMobClusters: 1,
    clusterAreaSize: 50,
    maxClustersPerArea: 1,
    visibilityRange: 20,
    observedSpawnPadding: 8,
    minSpawnRadiusFromCenter: 10,
    unobservedDespawnMs: 60000,
    getMobLevelForDistance: () => 1,
    applyScaledStatsToMob: () => {},
    onMobKilled: () => {}
  });

  const rabbit = {
    id: "mob-1",
    type: "Rabbit",
    x: 120,
    y: 120,
    hp: 1,
    maxHp: 10,
    alive: true,
    respawnMinMs: 5000,
    respawnMaxMs: 5000,
    dropRules: [{ itemId: "rawMeat" }, { itemId: "rabbitPelt" }],
    skillRewards: [{ skillId: "hunting", xp: 10 }],
    activeDots: new Map(),
    abilityCooldowns: new Map()
  };

  const beforeXp = skillTools.getPlayerSkillState(hunter, "hunting").exp;
  lifecycle.killMob(rabbit, hunter.id);
  const afterXp = skillTools.getPlayerSkillState(hunter, "hunting").exp;
  assert.ok(afterXp > beforeXp, "Expected hunting XP from killing a huntable mob");
  assert.ok(lootBags.length === 1 && lootBags[0].items.length >= 1, "Expected hunt loot bag to be created");
}

function main() {
  const itemDefs = loadItemsMap();
  const abilityDefs = createAbilityDefs();
  const mobConfig = loadMobConfigFromDisk(
    path.resolve(__dirname, "../data/mobs.json"),
    itemDefs,
    abilityDefs,
    { width: 1000, height: 1000 },
    {
      mobHealthMultiplier: 1,
      mobDamageMultiplier: 1,
      mobRespawnMultiplier: 1
    },
    {
      mobAggroRange: 6,
      mobAttackRange: 1.25,
      mobWanderRadius: 8,
      mobAttackCooldownMs: 1000
    }
  );
  const rabbitDef = mobConfig.mobDefs.get("Rabbit");
  const deerDef = mobConfig.mobDefs.get("Deer");
  const boarDef = mobConfig.mobDefs.get("Boar");
  assert.ok(rabbitDef && deerDef && boarDef, "Expected huntable mob definitions to load");
  assert.strictEqual(rabbitDef.combat.behavior, "flee");
  assert.ok(Array.isArray(deerDef.skillRewards) && deerDef.skillRewards[0].skillId === "hunting");

  testBiomeFilteredAnimals(mobConfig);
  testFleeBehavior();

  const skillTools = createSkillTools({
    skillDataPath: path.resolve(__dirname, "../data/skills.json"),
    sendSelfProgress: () => {}
  });
  testHuntingXpAndLoot(skillTools);

  console.log("hunting-system: ok");
}

main();
