const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createSkillTools } = require("../server/gameplay/skills");
const { createCraftingTools } = require("../server/gameplay/crafting");
const { createBiomeResolver } = require("../server/gameplay/biome-resolver");
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
    const itemDef = ITEM_DEFS.get(String(entry.itemId || ""));
    const stackSize = Math.max(1, Math.floor(Number(itemDef && itemDef.stackSize) || 99));
    let remaining = qty;
    for (const slot of player.inventorySlots) {
      if (!slot || slot.itemId !== entry.itemId || slot.qty >= stackSize) {
        continue;
      }
      const canAdd = Math.min(remaining, stackSize - slot.qty);
      slot.qty += canAdd;
      remaining -= canAdd;
    }
    while (remaining > 0) {
      const emptyIndex = player.inventorySlots.findIndex((slot) => !slot);
      if (emptyIndex < 0) {
        leftover.push({ itemId: entry.itemId, qty: remaining });
        break;
      }
      const putQty = Math.min(remaining, stackSize);
      player.inventorySlots[emptyIndex] = { itemId: entry.itemId, qty: putQty };
      remaining -= putQty;
    }
    added.push({ itemId: entry.itemId, qty, name: itemDef && itemDef.name ? itemDef.name : entry.itemId });
  }
  return { added, leftover, changed: added.length > 0 };
}

function getInventoryItemCount(player, itemId) {
  return (Array.isArray(player.inventorySlots) ? player.inventorySlots : []).reduce((sum, slot) => {
    if (!slot || String(slot.itemId || "") !== String(itemId || "")) {
      return sum;
    }
    return sum + Math.max(0, Number(slot.qty) || 0);
  }, 0);
}

function consumeInventoryItem(player, itemId, qty) {
  let remaining = Math.max(1, Math.floor(Number(qty) || 1));
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

const ITEM_DEFS = loadItemsMap();

function main() {
  const skillTools = createSkillTools({
    skillDataPath: path.resolve(__dirname, "../data/skills.json"),
    sendSelfProgress: () => {}
  });
  const craftingTools = createCraftingTools({
    recipeDataPath: path.resolve(__dirname, "../data/recipes.json"),
    itemDefsProvider: () => ITEM_DEFS,
    skillTools,
    getInventoryItemCount,
    consumeInventoryItem,
    addItemsToInventory,
    sendInventoryState: () => {},
    sendJson: () => {}
  });

  const crafter = {
    inventorySlots: Array.from({ length: 24 }, () => null),
    ws: {}
  };
  skillTools.ensurePlayerSkillsState(crafter);
  crafter.skills.mining.level = 3;
  crafter.skills.woodcutting.level = 4;
  addItemsToInventory(crafter, [
    { itemId: "oakLog", qty: 6 },
    { itemId: "sap", qty: 2 },
    { itemId: "roughStone", qty: 4 },
    { itemId: "copperOre", qty: 4 },
    { itemId: "tinOre", qty: 2 }
  ]);

  const crudeResult = craftingTools.craftRecipe(crafter, "crude_pickaxe");
  assert.strictEqual(crudeResult.ok, true, "Expected crude pickaxe craft to succeed");
  assert.ok(getInventoryItemCount(crafter, "crudePickaxe") >= 1, "Expected crude pickaxe in inventory");
  assert.strictEqual(craftingTools.getBestToolTierForPlayer(crafter, "mining"), 1);

  const plankResult = craftingTools.craftRecipe(crafter, "oak_planks");
  assert.strictEqual(plankResult.ok, true, "Expected oak planks recipe to succeed");
  const bronzeResult = craftingTools.craftRecipe(crafter, "bronze_pickaxe");
  assert.strictEqual(bronzeResult.ok, true, "Expected bronze pickaxe craft to succeed");
  assert.strictEqual(craftingTools.getBestToolTierForPlayer(crafter, "mining"), 2);

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
    itemDefsProvider: () => ITEM_DEFS
  });
  const resourceNodes = new Map();
  let nextResourceNodeId = 1;
  const resourceTools = createResourceGenerationTools({
    resourceNodes,
    allocateResourceNodeId: () => String(nextResourceNodeId++),
    resourceRegistry,
    biomeResolver,
    skillTools,
    getToolTierForPlayer: (player, skillId) => craftingTools.getBestToolTierForPlayer(player, skillId),
    addItemsToInventory,
    sendInventoryState: () => {},
    sendJson: () => {},
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
  resourceTools.initializeResourceNodes();

  const tinNode = Array.from(resourceNodes.values()).find((node) => String(node.resourceId || "") === "tin_vein");
  assert.ok(tinNode, "Expected a tin vein node");
  const minerWithoutTool = {
    x: Number(tinNode.x) + 0.1,
    y: Number(tinNode.y) + 0.1,
    inventorySlots: Array.from({ length: 12 }, () => null),
    ws: {}
  };
  skillTools.ensurePlayerSkillsState(minerWithoutTool);
  minerWithoutTool.skills.mining.level = 3;
  const blockedTin = resourceTools.interactWithResourceNode(minerWithoutTool, { id: tinNode.id, x: tinNode.x, y: tinNode.y });
  assert.strictEqual(blockedTin.ok, false, "Expected tin to require a crafted pickaxe");

  const minerWithTool = {
    x: Number(tinNode.x) + 0.1,
    y: Number(tinNode.y) + 0.1,
    inventorySlots: Array.from({ length: 12 }, () => null),
    ws: {}
  };
  skillTools.ensurePlayerSkillsState(minerWithTool);
  minerWithTool.skills.mining.level = 6;
  addItemsToInventory(minerWithTool, [{ itemId: "bronzePickaxe", qty: 1 }]);
  const ironNode = Array.from(resourceNodes.values()).find((node) => String(node.resourceId || "") === "iron_vein");
  assert.ok(ironNode, "Expected an iron vein node");
  minerWithTool.x = Number(ironNode.x) + 0.1;
  minerWithTool.y = Number(ironNode.y) + 0.1;
  const ironResult = resourceTools.interactWithResourceNode(minerWithTool, { id: ironNode.id, x: ironNode.x, y: ironNode.y });
  assert.strictEqual(ironResult.ok, true, "Expected bronze pickaxe to unlock iron gathering");

  console.log("crafting-system: ok");
}

main();
