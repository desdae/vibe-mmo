const path = require("path");
const { createQuestTools } = require("../gameplay/quests");
const { createProceduralQuestTools } = require("../gameplay/procedural-quests");

function createMockMobConfig() {
  const zombie = {
    name: "Zombie",
    health: 20,
    damageMax: 2,
    dropRules: [{ itemId: "healthPotion01", kind: "chance", chance: 0.1 }]
  };
  const skeleton = {
    name: "Skeleton",
    health: 30,
    damageMax: 3,
    dropRules: [{ itemId: "manaPotion01", kind: "chance", chance: 0.08 }]
  };
  return {
    mobDefs: new Map([
      [zombie.name, zombie],
      [skeleton.name, skeleton]
    ]),
    clusterDefs: [
      {
        name: "Undead Horde",
        members: [zombie, skeleton],
        spawnRangeMin: 20,
        spawnRangeMax: 180
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

function createPlayer(overrides = {}) {
  return {
    id: "test-player",
    level: 2,
    x: 500,
    y: 503,
    questState: {
      active: {},
      completed: []
    },
    ...overrides
  };
}

describe("procedural quests", () => {
  const townLayout = createTownLayout();
  const mobConfig = createMockMobConfig();
  const templateDataPath = path.resolve(__dirname, "../../data/quest-templates.json");
  const questDataPath = path.resolve(__dirname, "../../data/quests.json");

  test("generates a spawn-backed hunt quest for the Herald", () => {
    const proceduralQuestTools = createProceduralQuestTools({
      townLayout,
      mapWidth: 1000,
      mapHeight: 1000,
      templateDataPath,
      mobConfigProvider: () => mobConfig
    });
    const player = createPlayer();

    const quests = proceduralQuestTools.getAvailableQuestsForNpc(player, "town_herald");

    expect(quests).toHaveLength(1);
    expect(quests[0].generated).toBe(true);
    expect(quests[0].templateId).toBe("town_hunt");
    expect(quests[0].objectives[0].type).toBe("kill");
    expect(["Zombie", "Skeleton"]).toContain(quests[0].objectives[0].mobId);
  });

  test("static tutorial quest remains available before procedural fallback", () => {
    const questTools = createQuestTools({
      townLayout,
      mapWidth: 1000,
      mapHeight: 1000,
      questDataPath,
      templateDataPath,
      mobConfigProvider: () => mobConfig,
      addItemsToInventory: () => ({ added: [], leftover: [] })
    });
    const player = createPlayer({ level: 1 });

    const quests = questTools.getAvailableQuestsForPlayer(player);

    expect(quests).toHaveLength(1);
    expect(quests[0].id).toBe("quest_first_steps");
  });

  test("after the tutorial, accepts and completes a procedural hunt quest", () => {
    const questTools = createQuestTools({
      townLayout,
      mapWidth: 1000,
      mapHeight: 1000,
      questDataPath,
      templateDataPath,
      mobConfigProvider: () => mobConfig,
      addItemsToInventory: () => ({ added: [], leftover: [] })
    });
    const player = createPlayer({
      questState: {
        active: {},
        completed: ["quest_first_steps"]
      }
    });

    const available = questTools.getAvailableQuestsForPlayer(player);
    expect(available).toHaveLength(1);
    expect(available[0].generated).toBe(true);
    expect(available[0].templateId).toBe("town_hunt");

    const acceptResult = questTools.acceptQuest(player, available[0].id);
    expect(acceptResult.success).toBe(true);

    const objective = acceptResult.quest.objectives[0];
    const progressBefore = questTools.getQuestProgress(player, acceptResult.quest.id);
    expect(progressBefore.objectives[0].current).toBe(0);

    questTools.updateQuestObjective(player, "kill", String(objective.mobId).toLowerCase(), objective.count);
    const progressAfter = questTools.getQuestProgress(player, acceptResult.quest.id);
    expect(progressAfter.objectives[0].complete).toBe(true);
    expect(questTools.canCompleteQuest(player, acceptResult.quest.id).canComplete).toBe(true);

    const completeResult = questTools.completeQuest(player, acceptResult.quest.id);
    expect(completeResult.success).toBe(true);
    expect(player.questState.completed).toEqual(["quest_first_steps"]);

    const nextAvailable = questTools.getAvailableQuestsForPlayer(player);
    expect(nextAvailable).toHaveLength(1);
    expect(nextAvailable[0].templateId).toBe("town_scout");
    expect(nextAvailable[0].objectives[0].type).toBe("explore");
  });
});
