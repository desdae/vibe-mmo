const assert = require("assert");
const path = require("path");
const { createQuestTools } = require("../server/gameplay/quests");
const { createProceduralQuestTools } = require("../server/gameplay/procedural-quests");
const { createDialogueTools } = require("../server/gameplay/dialogue");

function createMockItemDefs() {
  return new Map([
    ["healthPotion01", { id: "healthPotion01", name: "Small Health Potion", tags: ["potion"] }],
    ["manaPotion01", { id: "manaPotion01", name: "Small Mana Potion", tags: ["potion"] }],
    ["boneFragment", { id: "boneFragment", name: "Bone Fragment", tags: ["crafting", "bone", "quest"] }],
    ["rottenFlesh", { id: "rottenFlesh", name: "Rotten Flesh", tags: ["crafting", "undead"] }],
    ["spiderSilk", { id: "spiderSilk", name: "Spider Silk", tags: ["crafting", "silk"] }],
    ["orcTusk", { id: "orcTusk", name: "Orc Tusk", tags: ["crafting", "orc", "trophy"] }],
    ["volatilePowder", { id: "volatilePowder", name: "Volatile Powder", tags: ["crafting", "volatile"] }],
    ["oakLog", { id: "oakLog", name: "Oak Log", tags: ["crafting", "wood", "log", "oak", "gathered"] }],
    ["birchLog", { id: "birchLog", name: "Birch Log", tags: ["crafting", "wood", "log", "birch", "gathered"] }],
    ["copperOre", { id: "copperOre", name: "Copper Ore", tags: ["crafting", "ore", "metal", "copper", "gathered"] }],
    ["roughStone", { id: "roughStone", name: "Rough Stone", tags: ["crafting", "stone", "ore", "gathered"] }],
    ["rawMeat", { id: "rawMeat", name: "Raw Meat", tags: ["crafting", "food", "hunting", "animal", "gathered"] }],
    ["rabbitPelt", { id: "rabbitPelt", name: "Rabbit Pelt", tags: ["crafting", "hunting", "animal", "hide", "fur", "gathered"] }],
    ["lightHide", { id: "lightHide", name: "Light Hide", tags: ["crafting", "hunting", "animal", "hide", "leather", "gathered"] }],
    ["deerAntler", { id: "deerAntler", name: "Deer Antler", tags: ["crafting", "hunting", "animal", "bone", "trophy", "gathered"] }],
    ["thickHide", { id: "thickHide", name: "Thick Hide", tags: ["crafting", "hunting", "animal", "hide", "leather", "gathered"] }],
    ["boarTusk", { id: "boarTusk", name: "Boar Tusk", tags: ["crafting", "hunting", "animal", "bone", "trophy", "gathered"] }]
  ]);
}

function createMockMobConfig() {
  const zombie = {
    name: "Zombie",
    tags: ["undead", "starter", "melee", "zombie"],
    health: 20,
    damageMax: 2,
    dropRules: [{ itemId: "rottenFlesh", kind: "chance", chance: 0.26 }]
  };
  const skeleton = {
    name: "Skeleton",
    tags: ["undead", "starter", "melee", "skeleton", "bone"],
    health: 30,
    damageMax: 3,
    dropRules: [{ itemId: "boneFragment", kind: "chance", chance: 0.24 }]
  };
  const skeletonArcher = {
    name: "Skeleton Archer",
    tags: ["undead", "starter", "ranged", "skeleton", "bone", "archer"],
    health: 28,
    damageMax: 2,
    dropRules: [{ itemId: "boneFragment", kind: "chance", chance: 0.22 }]
  };
  const orc = {
    name: "Orc Berserker",
    tags: ["orc", "mid", "melee", "brute"],
    health: 40,
    damageMax: 7,
    dropRules: [{ itemId: "orcTusk", kind: "chance", chance: 0.23 }]
  };
  const rabbit = {
    name: "Rabbit",
    tags: ["starter", "animal", "passive", "huntable", "rabbit", "fur", "meat"],
    health: 10,
    damageMax: 0,
    dropRules: [
      { itemId: "rawMeat", kind: "chance", chance: 0.24 },
      { itemId: "rabbitPelt", kind: "chance", chance: 0.22 }
    ]
  };
  const deer = {
    name: "Deer",
    tags: ["starter", "animal", "passive", "huntable", "deer", "hide", "meat", "antler"],
    health: 18,
    damageMax: 0,
    dropRules: [
      { itemId: "rawMeat", kind: "chance", chance: 0.28 },
      { itemId: "lightHide", kind: "chance", chance: 0.22 },
      { itemId: "deerAntler", kind: "chance", chance: 0.12 }
    ]
  };
  const boar = {
    name: "Boar",
    tags: ["mid", "animal", "passive", "huntable", "boar", "hide", "meat", "tusk"],
    health: 24,
    damageMax: 0,
    dropRules: [
      { itemId: "rawMeat", kind: "chance", chance: 0.3 },
      { itemId: "thickHide", kind: "chance", chance: 0.24 },
      { itemId: "boarTusk", kind: "chance", chance: 0.18 }
    ]
  };
  return {
    mobDefs: new Map([
      [zombie.name, zombie],
      [skeleton.name, skeleton],
      [skeletonArcher.name, skeletonArcher],
      [orc.name, orc],
      [rabbit.name, rabbit],
      [deer.name, deer],
      [boar.name, boar]
    ]),
    clusterDefs: [
      {
        name: "Undead Horde",
        members: [zombie, skeleton, skeletonArcher],
        spawnRangeMin: 20,
        spawnRangeMax: 180
      },
      {
        name: "Berserker Patrol",
        members: [orc],
        spawnRangeMin: 40,
        spawnRangeMax: 220
      },
      {
        name: "Starter Wildlife",
        members: [rabbit, deer],
        spawnRangeMin: 18,
        spawnRangeMax: 160
      },
      {
        name: "Boar Wallows",
        members: [boar],
        spawnRangeMin: 55,
        spawnRangeMax: 220
      }
    ]
  };
}

function createTownLayout() {
  return {
    centerTileX: 500,
    centerTileY: 500,
    vendor: {
      id: "starter_vendor",
      name: "Town Quartermaster",
      x: 500,
      y: 500,
      interactRange: 2.25
    },
    questGivers: [
      {
        id: "town_herald",
        name: "Town Herald",
        x: 500,
        y: 503,
        interactRange: 4
      }
    ]
  };
}

function cloneInventory(slots) {
  return (Array.isArray(slots) ? slots : []).map((entry) => (entry ? { ...entry } : null));
}

function createPlayer(overrides = {}) {
  return {
    id: "test-player",
    level: 2,
    x: 500,
    y: 503,
    inventorySlots: Array.from({ length: 12 }, () => null),
    questState: {
      active: {},
      completed: []
    },
    ...overrides,
    inventorySlots: cloneInventory(overrides.inventorySlots || Array.from({ length: 12 }, () => null))
  };
}

function getInventoryItemCount(player, itemId) {
  return (Array.isArray(player && player.inventorySlots) ? player.inventorySlots : []).reduce((sum, slot) => {
    if (!slot || String(slot.itemId || "") !== String(itemId || "")) {
      return sum;
    }
    return sum + Math.max(0, Number(slot.qty) || 0);
  }, 0);
}

function consumeInventoryItem(player, itemId, qty) {
  let remaining = Math.max(0, Number(qty) || 0);
  for (let index = 0; index < player.inventorySlots.length && remaining > 0; index += 1) {
    const slot = player.inventorySlots[index];
    if (!slot || String(slot.itemId || "") !== String(itemId || "")) {
      continue;
    }
    const take = Math.min(remaining, Math.max(0, Number(slot.qty) || 0));
    slot.qty -= take;
    remaining -= take;
    if (slot.qty <= 0) {
      player.inventorySlots[index] = null;
    }
  }
  return remaining === 0;
}

function main() {
  const townLayout = createTownLayout();
  const mobConfig = createMockMobConfig();
  const itemDefs = createMockItemDefs();
  const templateDataPath = path.resolve(__dirname, "../data/quest-templates.json");
  const questDataPath = path.resolve(__dirname, "../data/quests.json");
  const regionDataPath = path.resolve(__dirname, "../data/quest-regions.json");

  const proceduralQuestTools = createProceduralQuestTools({
    townLayout,
    mapWidth: 1000,
    mapHeight: 1000,
    templateDataPath,
    regionDataPath,
    mobConfigProvider: () => mobConfig,
    itemDefsProvider: () => itemDefs
  });

  const generatedPlayer = createPlayer({ level: 6 });
  const generatedOffers = proceduralQuestTools.getAvailableQuestsForNpc(generatedPlayer, "town_herald");
  const generatedTemplateIds = generatedOffers.map((quest) => quest.templateId);
  assert.strictEqual(generatedOffers.length, 6, "Expected six simultaneous generated offers for a high-level player");
  assert.deepStrictEqual(
    generatedTemplateIds,
    [
      "starter_undead_hunt",
      "starter_bone_collection",
      "starter_scouting_run",
      "starter_hunting_drive",
      "starter_supply_stockpile",
      "frontier_cleanup_campaign"
    ],
    "Expected all template types to be offered in order"
  );

  const questTools = createQuestTools({
    townLayout,
    mapWidth: 1000,
    mapHeight: 1000,
    questDataPath,
    templateDataPath,
    regionDataPath,
    mobConfigProvider: () => mobConfig,
    itemDefsProvider: () => itemDefs,
    getInventoryItemCount,
    consumeInventoryItem,
    addItemsToInventory: () => ({ added: [], leftover: [] }),
    sendInventoryState: () => {},
    syncPlayerCopperFromInventory: () => false
  });

  const tutorialPlayer = createPlayer({ level: 1 });
  const tutorialOffers = questTools.getAvailableQuestsForPlayer(tutorialPlayer);
  assert.strictEqual(tutorialOffers.length, 1, "Expected the tutorial quest before procedural fallbacks");
  assert.strictEqual(tutorialOffers[0].id, "quest_first_steps", "Tutorial quest should remain first");

  const repeatablePlayer = createPlayer({
    level: 6,
    questState: {
      active: {},
      completed: ["quest_first_steps"]
    }
  });
  const repeatableOffers = questTools.getAvailableQuestsForPlayer(repeatablePlayer);
  assert.strictEqual(repeatableOffers.length, 6, "Expected multiple quests to choose from after the tutorial");

  const dialogueTools = createDialogueTools({ questTools });
  const dialogue = dialogueTools.startDialogue(repeatablePlayer.id, repeatablePlayer, "town_herald");
  assert.strictEqual(dialogue.dialogueType, "offer", "Expected offer dialogue for the Herald");
  const questMenuNode = dialogue.nodes.find((node) => String(node.id) === "quest_menu");
  assert.ok(questMenuNode, "Expected a quest selection menu node");
  assert.strictEqual(questMenuNode.choices.length, 6, "Expected one dialogue choice per available quest");
  const frontierOffer = repeatableOffers.find((quest) => quest.templateId === "frontier_cleanup_campaign");
  const frontierDetailsNode = dialogue.nodes.find(
    (node) => String(node.id) === `quest_${String(frontierOffer && frontierOffer.id || "")}_details`
  );
  assert.ok(frontierDetailsNode && frontierDetailsNode.rewards, "Expected offer dialogue details to expose rewards");
  assert.strictEqual(frontierDetailsNode.rewards.exp, frontierOffer.rewards.exp, "Expected offer dialogue to include quest XP reward");
  assert.deepStrictEqual(
    frontierDetailsNode.rewards.items,
    frontierOffer.rewards.items,
    "Expected offer dialogue to include quest item rewards"
  );

  const prefarmedPlayer = createPlayer({
    level: 6,
    inventorySlots: [
      { itemId: "boneFragment", qty: 12 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    questState: {
      active: {},
      completed: ["quest_first_steps"]
    }
  });
  const prefarmedOffers = questTools.getAvailableQuestsForPlayer(prefarmedPlayer);
  const collectQuest = prefarmedOffers.find((quest) => quest.templateId === "starter_bone_collection");
  assert.ok(collectQuest, "Expected a generated collect quest");
  const acceptedCollect = questTools.acceptQuest(prefarmedPlayer, collectQuest.id);
  assert.strictEqual(acceptedCollect.success, true, "Expected the collect quest to be accepted");
  const collectProgress = questTools.getQuestProgress(prefarmedPlayer, collectQuest.id);
  assert.strictEqual(collectProgress.objectives[0].complete, true, "Prefarmed quest items should count immediately");
  assert.strictEqual(collectProgress.rewards.exp, collectQuest.rewards.exp, "Expected active quest progress to include XP reward data");
  const collectComplete = questTools.completeQuest(prefarmedPlayer, collectQuest.id);
  assert.strictEqual(collectComplete.success, true, "Expected prefarmed collect quest to hand in successfully");
  assert.strictEqual(getInventoryItemCount(prefarmedPlayer, "boneFragment"), 12 - collectQuest.objectives[0].count, "Quest hand-in should consume collected items");

  const gatheredPlayer = createPlayer({
    level: 6,
    inventorySlots: [
      { itemId: "oakLog", qty: 20 },
      { itemId: "birchLog", qty: 20 },
      { itemId: "copperOre", qty: 12 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    questState: {
      active: {},
      completed: ["quest_first_steps"]
    }
  });
  const stockpileQuest = questTools.getAvailableQuestsForPlayer(gatheredPlayer).find(
    (quest) => quest.templateId === "starter_supply_stockpile"
  );
  assert.ok(stockpileQuest, "Expected a generated gather-supplies quest");
  const acceptedStockpile = questTools.acceptQuest(gatheredPlayer, stockpileQuest.id);
  assert.strictEqual(acceptedStockpile.success, true, "Expected the gather-supplies quest to be accepted");
  const stockpileProgress = questTools.getQuestProgress(gatheredPlayer, stockpileQuest.id);
  assert.strictEqual(stockpileProgress.objectives.length, 2, "Expected two gathered-material objectives");
  assert.ok(stockpileProgress.objectives.every((objective) => objective.complete), "Prefarmed gathered items should count immediately");
  const completedStockpile = questTools.completeQuest(gatheredPlayer, stockpileQuest.id);
  assert.strictEqual(completedStockpile.success, true, "Expected gathered-material quest hand-in to succeed");

  const campaignPlayer = createPlayer({
    level: 6,
    inventorySlots: [
      { itemId: "boneFragment", qty: 20 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    questState: {
      active: {},
      completed: ["quest_first_steps"]
    }
  });
  const campaignQuest = questTools.getAvailableQuestsForPlayer(campaignPlayer).find(
    (quest) => quest.templateId === "frontier_cleanup_campaign"
  );
  assert.ok(campaignQuest, "Expected the multi-objective campaign quest to be offered");
  const acceptedCampaign = questTools.acceptQuest(campaignPlayer, campaignQuest.id);
  assert.strictEqual(acceptedCampaign.success, true, "Expected the multi-objective quest to be accepted");
  const campaignProgressBefore = questTools.getQuestProgress(campaignPlayer, campaignQuest.id);
  assert.strictEqual(campaignProgressBefore.objectives.length, 3, "Expected three objectives in the campaign quest");
  assert.strictEqual(campaignProgressBefore.objectives[2].complete, true, "Prefarmed bones should satisfy the collect leg immediately");

  const zombieObjective = acceptedCampaign.quest.objectives.find((objective) => objective.type === "kill" && objective.mobId === "Zombie");
  const orcObjective = acceptedCampaign.quest.objectives.find((objective) => objective.type === "kill" && objective.mobId === "Orc Berserker");
  questTools.updateQuestObjective(campaignPlayer, "kill", "zombie", zombieObjective.count);
  questTools.updateQuestObjective(campaignPlayer, "kill", "orc berserker", orcObjective.count);

  const campaignProgressAfter = questTools.getQuestProgress(campaignPlayer, campaignQuest.id);
  assert.strictEqual(campaignProgressAfter.allComplete, true, "Expected all multi-objective quest legs to complete");
  const completedCampaign = questTools.completeQuest(campaignPlayer, campaignQuest.id);
  assert.strictEqual(completedCampaign.success, true, "Expected the multi-objective quest to complete");
  assert.strictEqual(getInventoryItemCount(campaignPlayer, "boneFragment"), 0, "Campaign turn-in should consume prefarmed bones");

  console.log(JSON.stringify({
    ok: true,
    generatedTemplateIds,
    collectQuestId: collectQuest.id,
    campaignQuestId: campaignQuest.id,
    campaignObjectives: campaignProgressAfter.objectives.map((objective) => ({
      description: objective.description,
      complete: objective.complete
    }))
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
