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
    ["volatilePowder", { id: "volatilePowder", name: "Volatile Powder", tags: ["crafting", "volatile"] }]
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
  return {
    mobDefs: new Map([
      [zombie.name, zombie],
      [skeleton.name, skeleton],
      [skeletonArcher.name, skeletonArcher],
      [orc.name, orc]
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
  assert.strictEqual(generatedOffers.length, 4, "Expected four simultaneous generated offers for a high-level player");
  assert.deepStrictEqual(
    generatedTemplateIds,
    [
      "starter_undead_hunt",
      "starter_bone_collection",
      "starter_scouting_run",
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
  assert.strictEqual(repeatableOffers.length, 4, "Expected multiple quests to choose from after the tutorial");

  const dialogueTools = createDialogueTools({ questTools });
  const dialogue = dialogueTools.startDialogue(repeatablePlayer.id, repeatablePlayer, "town_herald");
  assert.strictEqual(dialogue.dialogueType, "offer", "Expected offer dialogue for the Herald");
  const questMenuNode = dialogue.nodes.find((node) => String(node.id) === "quest_menu");
  assert.ok(questMenuNode, "Expected a quest selection menu node");
  assert.strictEqual(questMenuNode.choices.length, 4, "Expected one dialogue choice per available quest");

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
  const collectComplete = questTools.completeQuest(prefarmedPlayer, collectQuest.id);
  assert.strictEqual(collectComplete.success, true, "Expected prefarmed collect quest to hand in successfully");
  assert.strictEqual(getInventoryItemCount(prefarmedPlayer, "boneFragment"), 12 - collectQuest.objectives[0].count, "Quest hand-in should consume collected items");

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
