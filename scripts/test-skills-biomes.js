const assert = require("assert");
const path = require("path");
const { createSkillTools } = require("../server/gameplay/skills");
const { createBiomeResolver } = require("../server/gameplay/biome-resolver");

function run() {
  const progressEvents = [];
  const skillTools = createSkillTools({
    skillDataPath: path.resolve(__dirname, "../data/skills.json"),
    sendSelfProgress(player) {
      progressEvents.push({
        id: player.id,
        skills: skillTools.serializePlayerSkills(player)
      });
    }
  });
  const player = { id: "skill-test", skills: {} };
  skillTools.ensurePlayerSkillsState(player);

  const initialSkills = skillTools.serializePlayerSkills(player);
  assert.ok(initialSkills.some((entry) => entry.id === "woodcutting" && entry.level === 1));
  assert.ok(initialSkills.some((entry) => entry.id === "mining" && entry.level === 1));
  assert.ok(initialSkills.some((entry) => entry.id === "hunting" && entry.level === 1));

  const woodcuttingBefore = skillTools.getPlayerSkillState(player, "woodcutting");
  const grantResult = skillTools.grantPlayerSkillExp(player, "woodcutting", woodcuttingBefore.expToNext + 5);
  assert.strictEqual(grantResult.changed, true);
  assert.strictEqual(grantResult.leveledUp, true);
  assert.strictEqual(skillTools.getPlayerSkillLevel(player, "woodcutting"), 2);
  assert.ok(progressEvents.length >= 1);

  const biomeResolver = createBiomeResolver({
    biomeDataPath: path.resolve(__dirname, "../data/biomes.json"),
    mapWidth: 1000,
    mapHeight: 1000,
    townLayout: { centerTileX: 500, centerTileY: 500 }
  });
  const nearTown = biomeResolver.resolveBiomeAt(520, 520);
  const eastFrontier = biomeResolver.resolveBiomeAt(900, 500);
  const southRiver = biomeResolver.resolveBiomeAt(500, 760);

  assert.strictEqual(nearTown.bandId, "starter_ring");
  assert.ok(["starter_ring", "civilized"].every((tag) => nearTown.tags.includes(tag)));
  assert.strictEqual(eastFrontier.sectorId, "east");
  assert.ok(["frontier", "wilds"].includes(eastFrontier.bandId));
  assert.strictEqual(southRiver.sectorId, "south");
  assert.ok(Array.isArray(southRiver.biomeWeights) && southRiver.biomeWeights.length > 0);

  console.log(
    JSON.stringify(
      {
        ok: true,
        woodcutting: skillTools.getPlayerSkillState(player, "woodcutting"),
        nearTown,
        eastFrontierPrimaryBiome: eastFrontier.primaryBiomeId,
        southRiverPrimaryBiome: southRiver.primaryBiomeId
      },
      null,
      2
    )
  );
}

try {
  run();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
