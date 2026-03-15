const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createBiomeResolver } = require("../server/gameplay/biome-resolver");
const { createSkillTools } = require("../server/gameplay/skills");
const { createResourceRegistry } = require("../server/gameplay/resource-registry");
const { createResourceGenerationTools } = require("../server/gameplay/resource-generation");

function loadItemsMap() {
  const filePath = path.resolve(__dirname, "../data/items.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return new Map((Array.isArray(raw) ? raw : []).map((entry) => [String(entry.id || ""), entry]));
}

function addItemsToInventory(player, entries) {
  const added = [];
  const leftover = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const qty = Math.max(0, Math.floor(Number(entry && entry.qty) || 0));
    if (!entry || !entry.itemId || qty <= 0) {
      continue;
    }
    const existing = player.inventorySlots.find((slot) => slot && slot.itemId === entry.itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      const emptyIndex = player.inventorySlots.findIndex((slot) => !slot);
      if (emptyIndex < 0) {
        leftover.push({ itemId: entry.itemId, qty });
        continue;
      }
      player.inventorySlots[emptyIndex] = {
        itemId: entry.itemId,
        qty,
        name: entry.name
      };
    }
    added.push({
      itemId: entry.itemId,
      qty,
      name: String(entry.name || entry.itemId)
    });
  }
  return {
    added,
    leftover,
    changed: added.length > 0
  };
}

function getInventoryCount(player, itemId) {
  return (Array.isArray(player.inventorySlots) ? player.inventorySlots : []).reduce((sum, slot) => {
    if (!slot || String(slot.itemId || "") !== String(itemId || "")) {
      return sum;
    }
    return sum + Math.max(0, Number(slot.qty) || 0);
  }, 0);
}

function main() {
  const itemDefs = loadItemsMap();
  const skillTools = createSkillTools({
    skillDataPath: path.resolve(__dirname, "../data/skills.json"),
    sendSelfProgress: () => {}
  });
  const biomeResolver = createBiomeResolver({
    biomeDataPath: path.resolve(__dirname, "../data/biomes.json"),
    mapWidth: 1000,
    mapHeight: 1000,
    townLayout: {
      centerTileX: 500,
      centerTileY: 500,
      minTileX: 490,
      maxTileX: 510,
      minTileY: 490,
      maxTileY: 510,
      enabled: true
    }
  });
  const resourceRegistry = createResourceRegistry({
    resourceDataPath: path.resolve(__dirname, "../data/resources.json"),
    itemDefsProvider: () => itemDefs
  });
  const resourceNodes = new Map();
  let nextResourceNodeId = 1;
  const sentMessages = [];
  const resourceTools = createResourceGenerationTools({
    resourceNodes,
    allocateResourceNodeId: () => String(nextResourceNodeId++),
    resourceRegistry,
    biomeResolver,
    skillTools,
    addItemsToInventory,
    sendInventoryState: () => {},
    sendJson: (_ws, msg) => sentMessages.push(msg),
    mapWidth: 1000,
    mapHeight: 1000,
    townLayout: {
      centerTileX: 500,
      centerTileY: 500,
      minTileX: 490,
      maxTileX: 510,
      minTileY: 490,
      maxTileY: 510,
      enabled: true
    }
  });

  const init = resourceTools.initializeResourceNodes();
  assert.ok(init.total > 0, "Expected resource nodes to spawn");
  assert.ok(init.families.tree > 0, "Expected tree nodes");
  assert.ok(init.families.ore_vein > 0, "Expected ore nodes");

  const visiblePlayer = {
    x: 500,
    y: 500,
    inventorySlots: Array.from({ length: 12 }, () => null),
    ws: {}
  };
  skillTools.ensurePlayerSkillsState(visiblePlayer);
  const visibleNodes = resourceTools.getVisibleResourceNodesForPlayer(
    visiblePlayer,
    (_player, node, extents) =>
      Math.abs((Number(node.x) || 0) - Number(visiblePlayer.x || 0)) <= Number(extents && extents.x || 20) &&
      Math.abs((Number(node.y) || 0) - Number(visiblePlayer.y || 0)) <= Number(extents && extents.y || 20),
    { x: 20, y: 20 }
  );
  assert.ok(visibleNodes.length > 0, "Expected starter resources near town");

  const gatherNode =
    visibleNodes.find((node) => String(node.skillId || "") === "woodcutting" && Number(node.requiredLevel) <= 1) ||
    visibleNodes[0];
  visiblePlayer.x = Number(gatherNode.x) + 0.2;
  visiblePlayer.y = Number(gatherNode.y) + 0.2;
  const beforeXp = visiblePlayer.skills.woodcutting.exp;
  const gatherResult = resourceTools.interactWithResourceNode(visiblePlayer, { id: gatherNode.id, x: gatherNode.x, y: gatherNode.y });
  assert.strictEqual(gatherResult.ok, true, "Expected resource gather to succeed");
  assert.ok(gatherResult.itemsGained.length > 0, "Expected gathered items");
  assert.ok(visiblePlayer.skills.woodcutting.exp > beforeXp, "Expected woodcutting XP gain");
  assert.ok(getInventoryCount(visiblePlayer, gatherResult.itemsGained[0].itemId) > 0, "Expected gathered item in inventory");
  assert.strictEqual(resourceNodes.get(gatherNode.id).available, false, "Expected gathered node to deplete");
  assert.ok(sentMessages.some((msg) => msg && msg.type === "resource_gathered"), "Expected gather message");

  const advancedNode = Array.from(resourceNodes.values()).find((node) => Number(node.requiredLevel) >= 6);
  assert.ok(advancedNode, "Expected a higher-level resource node");
  const lowLevelPlayer = {
    x: Number(advancedNode.x) + 0.2,
    y: Number(advancedNode.y) + 0.2,
    inventorySlots: Array.from({ length: 12 }, () => null),
    ws: {}
  };
  skillTools.ensurePlayerSkillsState(lowLevelPlayer);
  const blocked = resourceTools.interactWithResourceNode(lowLevelPlayer, { id: advancedNode.id, x: advancedNode.x, y: advancedNode.y });
  assert.strictEqual(blocked.ok, false, "Expected higher-level resource to be gated");

  const depletedNode = resourceNodes.get(gatherNode.id);
  depletedNode.depletedUntil = Date.now() - 1;
  resourceTools.tickResourceNodes(Date.now());
  assert.strictEqual(resourceNodes.get(gatherNode.id).available, true, "Expected node to respawn after timer");

  console.log("resource-system: ok");
}

main();
