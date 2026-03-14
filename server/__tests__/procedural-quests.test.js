const path = require("path");
const { createQuestTools } = require("../gameplay/quests");
const { createProceduralQuestTools } = require("../gameplay/procedural-quests");
const { createDialogueTools } = require("../gameplay/dialogue");

function createMockItemDefs() {
  return new Map([
    ["healthPotion01", { id: "healthPotion01", name: "Small Health Potion", tags: ["potion"] }],
    ["manaPotion01", { id: "manaPotion01", name: "Small Mana Potion", tags: ["potion"] }],
    ["boneFragment", { id: "boneFragment", name: "Bone Fragment", tags: ["crafting", "bone", "quest"] }],
    ["rottenFlesh", { id: "rottenFlesh", name: "Rotten Flesh", tags: ["crafting", "undead"] }],
    ["orcTusk", { id: "orcTusk", name: "Orc Tusk", tags: ["crafting", "orc", "trophy"] }]
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
      { name: "Undead Horde", members: [zombie, skeleton, skeletonArcher], spawnRangeMin: 20, spawnRangeMax: 180 },
      { name: "Berserker Patrol", members: [orc], spawnRangeMin: 40, spawnRangeMax: 220 }
    ]
  };
}

function createTownLayout() {
  return {
    centerTileX: 500,
    centerTileY: 500,
    vendor: { id: "starter_vendor", name: "Town Quartermaster", x: 500, y: 500, interactRange: 2.25 },
    questGivers: [{ id: "town_herald", name: "Town Herald", x: 500, y: 503, interactRange: 4 }]
  };
}

function createPlayer(overrides = {}) {
  return {
    id: "test-player",
    level: 6,
    x: 500,
    y: 503,
    inventorySlots: Array.from({ length: 12 }, () => null),
    questState: { active: {}, completed: ["quest_first_steps"] },
    ...overrides
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
    const taken = Math.min(remaining, Math.max(0, Number(slot.qty) || 0));
    slot.qty -= taken;
    remaining -= taken;
    if (slot.qty <= 0) {
      player.inventorySlots[index] = null;
    }
  }
  return remaining === 0;
}

describe("procedural quest generation", () => {
  const townLayout = createTownLayout();
  const mobConfig = createMockMobConfig();
  const itemDefs = createMockItemDefs();
  const templateDataPath = path.resolve(__dirname, "../../data/quest-templates.json");
  const questDataPath = path.resolve(__dirname, "../../data/quests.json");
  const regionDataPath = path.resolve(__dirname, "../../data/quest-regions.json");

  test("generates multiple tagged offers for the Herald", () => {
    const tools = createProceduralQuestTools({
      townLayout,
      mapWidth: 1000,
      mapHeight: 1000,
      templateDataPath,
      regionDataPath,
      mobConfigProvider: () => mobConfig,
      itemDefsProvider: () => itemDefs
    });

    const quests = tools.getAvailableQuestsForNpc(createPlayer(), "town_herald");

    expect(quests.map((quest) => quest.templateId)).toEqual([
      "starter_undead_hunt",
      "starter_bone_collection",
      "starter_scouting_run",
      "frontier_cleanup_campaign"
    ]);
  });

  test("dialogue exposes a choice when multiple quests are available", () => {
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
    const dialogueTools = createDialogueTools({ questTools });

    const dialogue = dialogueTools.startDialogue("player-1", createPlayer(), "town_herald");
    const menuNode = dialogue.nodes.find((node) => node.id === "quest_menu");
    const frontierQuest = questTools.getAvailableQuestsForPlayer(createPlayer()).find(
      (quest) => quest.templateId === "frontier_cleanup_campaign"
    );
    const frontierDetailsNode = dialogue.nodes.find(
      (node) => node.id === `quest_${String(frontierQuest && frontierQuest.id || "")}_details`
    );

    expect(menuNode).toBeTruthy();
    expect(menuNode.choices).toHaveLength(4);
    expect(frontierDetailsNode && frontierDetailsNode.rewards).toBeTruthy();
    expect(frontierDetailsNode.rewards.exp).toBe(frontierQuest.rewards.exp);
    expect(frontierDetailsNode.rewards.items).toEqual(frontierQuest.rewards.items);
  });

  test("prefarmed collect items are counted and consumed on hand-in", () => {
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
    const player = createPlayer({
      inventorySlots: [{ itemId: "boneFragment", qty: 12 }, ...Array.from({ length: 11 }, () => null)]
    });
    const collectQuest = questTools.getAvailableQuestsForPlayer(player).find((quest) => quest.templateId === "starter_bone_collection");

    const accepted = questTools.acceptQuest(player, collectQuest.id);
    expect(accepted.success).toBe(true);
    expect(questTools.getQuestProgress(player, collectQuest.id).objectives[0].complete).toBe(true);
    expect(questTools.getQuestProgress(player, collectQuest.id).rewards.exp).toBe(collectQuest.rewards.exp);
    expect(questTools.completeQuest(player, collectQuest.id).success).toBe(true);
    expect(getInventoryItemCount(player, "boneFragment")).toBe(12 - collectQuest.objectives[0].count);
  });

  test("multi-objective quests support kill plus collect combinations", () => {
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
    const player = createPlayer({
      inventorySlots: [{ itemId: "boneFragment", qty: 20 }, ...Array.from({ length: 11 }, () => null)]
    });
    const campaign = questTools.getAvailableQuestsForPlayer(player).find((quest) => quest.templateId === "frontier_cleanup_campaign");

    const accepted = questTools.acceptQuest(player, campaign.id);
    const zombieObjective = accepted.quest.objectives.find((objective) => objective.type === "kill" && objective.mobId === "Zombie");
    const orcObjective = accepted.quest.objectives.find((objective) => objective.type === "kill" && objective.mobId === "Orc Berserker");
    expect(questTools.getQuestProgress(player, campaign.id).objectives).toHaveLength(3);
    questTools.updateQuestObjective(player, "kill", "zombie", zombieObjective.count);
    questTools.updateQuestObjective(player, "kill", "orc berserker", orcObjective.count);

    expect(questTools.canCompleteQuest(player, campaign.id).canComplete).toBe(true);
    expect(questTools.completeQuest(player, campaign.id).success).toBe(true);
    expect(getInventoryItemCount(player, "boneFragment")).toBe(0);
  });
});
