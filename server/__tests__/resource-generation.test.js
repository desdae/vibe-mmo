const { createBiomeResolver } = require("../gameplay/biome-resolver");
const { createResourceRegistry } = require("../gameplay/resource-registry");
const { createResourceGenerationTools } = require("../gameplay/resource-generation");

describe("resource-generation", () => {
  function createTestHarness() {
    const resourceNodes = new Map();
    let nextId = 1;
    const townLayout = {
      enabled: true,
      centerTileX: 500,
      centerTileY: 500,
      minTileX: 470,
      maxTileX: 530,
      minTileY: 470,
      maxTileY: 530
    };
    const biomeResolver = createBiomeResolver({
      mapWidth: 1000,
      mapHeight: 1000,
      townLayout
    });
    const resourceRegistry = createResourceRegistry({
      itemDefsProvider: () => new Map()
    });
    const tools = createResourceGenerationTools({
      resourceNodes,
      allocateResourceNodeId: () => String(nextId++),
      resourceRegistry,
      biomeResolver,
      mapWidth: 1000,
      mapHeight: 1000,
      townLayout
    });
    return { resourceNodes, tools, townLayout };
  }

  test("generates resources across band and sector regions instead of only starter nodes", () => {
    const { resourceNodes, tools } = createTestHarness();

    const result = tools.initializeResourceNodes();

    const bandIds = new Set();
    const sectorIds = new Set();
    const resourceIds = new Set();
    let starterBandTrees = 0;
    let nonStarterTrees = 0;
    let nonStarterOres = 0;
    for (const node of resourceNodes.values()) {
      bandIds.add(String(node.biome && node.biome.bandId || ""));
      sectorIds.add(String(node.biome && node.biome.sectorId || ""));
      resourceIds.add(String(node.resourceId || ""));
      if (node.family === "tree" && node.biome && node.biome.bandId === "starter_ring") {
        starterBandTrees += 1;
      }
      if (node.family === "tree" && node.biome && node.biome.bandId !== "starter_ring") {
        nonStarterTrees += 1;
      }
      if (node.family === "ore_vein" && node.biome && node.biome.bandId !== "starter_ring") {
        nonStarterOres += 1;
      }
    }

    expect(result.total).toBeGreaterThan(450);
    expect(result.families.tree).toBeGreaterThan(250);
    expect(result.families.ore_vein).toBeGreaterThan(180);
    expect(bandIds.size).toBeGreaterThanOrEqual(4);
    expect(sectorIds.size).toBeGreaterThanOrEqual(6);
    expect(resourceIds.has("pine_tree")).toBe(true);
    expect(resourceIds.has("tin_vein")).toBe(true);
    expect(resourceIds.has("iron_vein")).toBe(true);
    expect(nonStarterTrees).toBeGreaterThan(starterBandTrees);
    expect(nonStarterOres).toBeGreaterThan(20);
  });

  test("keeps guaranteed starter outskirts resources around town", () => {
    const { resourceNodes, tools, townLayout } = createTestHarness();

    tools.initializeResourceNodes();

    const centerX = Number(townLayout.centerTileX) + 0.5;
    const centerY = Number(townLayout.centerTileY) + 0.5;
    const nearbyStarterNodes = Array.from(resourceNodes.values()).filter((node) => {
      const distance = Math.hypot((Number(node.x) || 0) - centerX, (Number(node.y) || 0) - centerY);
      return distance >= 30 && distance <= 45;
    });

    expect(nearbyStarterNodes.filter((node) => node.family === "tree").length).toBeGreaterThanOrEqual(2);
    expect(nearbyStarterNodes.filter((node) => node.family === "ore_vein").length).toBeGreaterThanOrEqual(2);
  });
});
