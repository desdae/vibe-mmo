const assert = require("assert");
const path = require("path");
const { createQuestTools } = require("../server/gameplay/quests");
const { createProceduralQuestTools } = require("../server/gameplay/procedural-quests");

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

function main() {
  const townLayout = createTownLayout();
  const mobConfig = createMockMobConfig();
  const templateDataPath = path.resolve(__dirname, "../data/quest-templates.json");
  const questDataPath = path.resolve(__dirname, "../data/quests.json");

  const proceduralQuestTools = createProceduralQuestTools({
    townLayout,
    mapWidth: 1000,
    mapHeight: 1000,
    templateDataPath,
    mobConfigProvider: () => mobConfig
  });
  const generatedPlayer = createPlayer();
  const generatedOffer = proceduralQuestTools.getAvailableQuestsForNpc(generatedPlayer, "town_herald");
  assert.strictEqual(generatedOffer.length, 1, "Expected one generated offer");
  assert.strictEqual(generatedOffer[0].generated, true, "Generated offer should be marked generated");
  assert.strictEqual(generatedOffer[0].templateId, "town_hunt", "First generated offer should use town_hunt");

  const questTools = createQuestTools({
    townLayout,
    mapWidth: 1000,
    mapHeight: 1000,
    questDataPath,
    templateDataPath,
    mobConfigProvider: () => mobConfig,
    addItemsToInventory: () => ({ added: [], leftover: [] })
  });

  const tutorialPlayer = createPlayer({ level: 1 });
  const tutorialOffers = questTools.getAvailableQuestsForPlayer(tutorialPlayer);
  assert.strictEqual(tutorialOffers.length, 1, "Expected one tutorial offer");
  assert.strictEqual(tutorialOffers[0].id, "quest_first_steps", "Tutorial quest should be offered first");

  const repeatablePlayer = createPlayer({
    questState: {
      active: {},
      completed: ["quest_first_steps"]
    }
  });
  const repeatableOffers = questTools.getAvailableQuestsForPlayer(repeatablePlayer);
  assert.strictEqual(repeatableOffers.length, 1, "Expected one procedural fallback offer");
  assert.strictEqual(repeatableOffers[0].templateId, "town_hunt", "First fallback offer should be the hunt template");

  const acceptedQuest = questTools.acceptQuest(repeatablePlayer, repeatableOffers[0].id);
  assert.strictEqual(acceptedQuest.success, true, "Expected generated quest acceptance to succeed");
  const objective = acceptedQuest.quest.objectives[0];
  questTools.updateQuestObjective(
    repeatablePlayer,
    "kill",
    String(objective.mobId).toLowerCase(),
    Number(objective.count) || 1
  );
  assert.strictEqual(
    questTools.canCompleteQuest(repeatablePlayer, acceptedQuest.quest.id).canComplete,
    true,
    "Generated hunt quest should complete after matching kills"
  );
  const completeResult = questTools.completeQuest(repeatablePlayer, acceptedQuest.quest.id);
  assert.strictEqual(completeResult.success, true, "Expected generated quest completion to succeed");
  assert.deepStrictEqual(
    repeatablePlayer.questState.completed,
    ["quest_first_steps"],
    "Procedural quests should not pollute static completed quest history"
  );

  const scoutOffer = questTools.getAvailableQuestsForPlayer(repeatablePlayer);
  assert.strictEqual(scoutOffer.length, 1, "Expected another procedural offer after turn-in");
  assert.strictEqual(scoutOffer[0].templateId, "town_scout", "Second generated offer should rotate to the scout template");
  assert.strictEqual(scoutOffer[0].objectives[0].type, "explore", "Scout quest should use an explore objective");

  console.log(JSON.stringify({
    ok: true,
    generatedTemplateIds: [generatedOffer[0].templateId, scoutOffer[0].templateId],
    scoutTarget: {
      x: scoutOffer[0].objectives[0].x,
      y: scoutOffer[0].objectives[0].y
    }
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
