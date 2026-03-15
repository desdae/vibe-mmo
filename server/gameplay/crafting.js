const fs = require("fs");
const path = require("path");

function createCraftingTools(options = {}) {
  const recipeDataPath = options.recipeDataPath
    ? path.resolve(String(options.recipeDataPath))
    : path.resolve(__dirname, "../../data/recipes.json");
  const itemDefsProvider =
    typeof options.itemDefsProvider === "function" ? options.itemDefsProvider : () => new Map();
  const skillTools = options.skillTools || null;
  const getInventoryItemCount =
    typeof options.getInventoryItemCount === "function" ? options.getInventoryItemCount : () => 0;
  const consumeInventoryItem =
    typeof options.consumeInventoryItem === "function" ? options.consumeInventoryItem : () => false;
  const addItemsToInventory =
    typeof options.addItemsToInventory === "function" ? options.addItemsToInventory : () => ({ added: [], leftover: [] });
  const sendInventoryState =
    typeof options.sendInventoryState === "function" ? options.sendInventoryState : () => {};
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
  let loadedData = null;

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function loadRecipeData() {
    if (loadedData) {
      return loadedData;
    }
    try {
      loadedData = JSON.parse(fs.readFileSync(recipeDataPath, "utf8"));
    } catch (error) {
      console.error("[crafting] Failed to load recipes:", error.message);
      loadedData = { recipes: [] };
    }
    return loadedData;
  }

  function getRecipeDefs() {
    const data = loadRecipeData();
    return Array.isArray(data.recipes) ? data.recipes : [];
  }

  function getRecipeById(recipeId) {
    const normalizedId = normalizeId(recipeId);
    return getRecipeDefs().find((entry) => normalizeId(entry && entry.id) === normalizedId) || null;
  }

  function normalizeEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const itemId = String(entry.itemId || "").trim();
        const qty = Math.max(1, Math.floor(Number(entry.qty) || 1));
        return itemId ? { itemId, qty } : null;
      })
      .filter(Boolean);
  }

  function getItemDef(itemId) {
    const itemDefs = itemDefsProvider();
    return itemDefs && typeof itemDefs.get === "function" ? itemDefs.get(String(itemId || "")) || null : null;
  }

  function cloneInventorySlots(slots) {
    return (Array.isArray(slots) ? slots : []).map((slot) => (slot && typeof slot === "object" ? { ...slot } : null));
  }

  function canFitOutputs(player, outputs) {
    const tempPlayer = {
      inventorySlots: cloneInventorySlots(player && player.inventorySlots)
    };
    const result = addItemsToInventory(tempPlayer, outputs);
    return !Array.isArray(result.leftover) || result.leftover.length === 0;
  }

  function getBestToolTierForPlayer(player, skillId) {
    const skillDef =
      skillTools && typeof skillTools.getSkillDef === "function" ? skillTools.getSkillDef(skillId) : null;
    const requiredTags = Array.isArray(skillDef && skillDef.toolTagsAny)
      ? skillDef.toolTagsAny.map((tag) => normalizeId(tag)).filter(Boolean)
      : [];
    if (!requiredTags.length) {
      return 0;
    }

    let bestTier = 0;
    for (const slot of Array.isArray(player && player.inventorySlots) ? player.inventorySlots : []) {
      if (!slot || !slot.itemId) {
        continue;
      }
      const itemDef = getItemDef(slot.itemId);
      if (!itemDef) {
        continue;
      }
      const itemToolTags = Array.isArray(itemDef.toolTagsAny)
        ? itemDef.toolTagsAny.map((tag) => normalizeId(tag)).filter(Boolean)
        : [];
      if (!itemToolTags.length) {
        continue;
      }
      if (!requiredTags.some((tag) => itemToolTags.includes(tag))) {
        continue;
      }
      bestTier = Math.max(bestTier, Math.max(1, Math.floor(Number(itemDef.toolTier) || 1)));
    }
    return bestTier;
  }

  function getAvailableRecipesForPlayer(player) {
    const list = [];
    for (const recipe of getRecipeDefs()) {
      const inputs = normalizeEntries(recipe.inputs);
      const outputs = normalizeEntries(recipe.outputs);
      if (!inputs.length || !outputs.length) {
        continue;
      }
      const requiredLevel = Math.max(1, Math.floor(Number(recipe.requiredLevel) || 1));
      const currentLevel =
        skillTools && typeof skillTools.getPlayerSkillLevel === "function"
          ? skillTools.getPlayerSkillLevel(player, recipe.skillId)
          : 1;
      const requirements = inputs.map((entry) => ({
        itemId: entry.itemId,
        qty: entry.qty,
        owned: getInventoryItemCount(player, entry.itemId),
        name: String((getItemDef(entry.itemId) && getItemDef(entry.itemId).name) || entry.itemId)
      }));
      list.push({
        id: String(recipe.id || ""),
        name: String(recipe.name || recipe.id || ""),
        description: String(recipe.description || ""),
        category: String(recipe.category || "misc"),
        skillId: String(recipe.skillId || ""),
        requiredLevel,
        currentLevel,
        requirements,
        outputs: outputs.map((entry) => ({
          itemId: entry.itemId,
          qty: entry.qty,
          name: String((getItemDef(entry.itemId) && getItemDef(entry.itemId).name) || entry.itemId)
        })),
        craftable:
          currentLevel >= requiredLevel &&
          requirements.every((entry) => entry.owned >= entry.qty) &&
          canFitOutputs(player, outputs)
      });
    }
    return list;
  }

  function craftRecipe(player, recipeId, times = 1) {
    const recipe = getRecipeById(recipeId);
    const quantity = Math.max(1, Math.floor(Number(times) || 1));
    if (!player || !recipe) {
      return { ok: false, message: "Recipe not found." };
    }
    const requiredLevel = Math.max(1, Math.floor(Number(recipe.requiredLevel) || 1));
    const currentLevel =
      skillTools && typeof skillTools.getPlayerSkillLevel === "function"
        ? skillTools.getPlayerSkillLevel(player, recipe.skillId)
        : 1;
    if (currentLevel < requiredLevel) {
      return { ok: false, message: `Requires ${recipe.skillId} ${requiredLevel}.` };
    }

    const inputs = normalizeEntries(recipe.inputs).map((entry) => ({ ...entry, qty: entry.qty * quantity }));
    const outputs = normalizeEntries(recipe.outputs).map((entry) => ({ ...entry, qty: entry.qty * quantity }));
    for (const entry of inputs) {
      if (getInventoryItemCount(player, entry.itemId) < entry.qty) {
        return { ok: false, message: "Missing crafting materials." };
      }
    }
    if (!canFitOutputs(player, outputs)) {
      return { ok: false, message: "Not enough bag space." };
    }

    for (const entry of inputs) {
      if (!consumeInventoryItem(player, entry.itemId, entry.qty)) {
        return { ok: false, message: "Failed to consume materials." };
      }
    }
    const result = addItemsToInventory(player, outputs);
    sendInventoryState(player);
    sendJson(player.ws, {
      type: "craft_result",
      ok: true,
      recipeId: String(recipe.id || ""),
      produced: Array.isArray(result.added) ? result.added.map((entry) => ({ ...entry })) : []
    });
    return {
      ok: true,
      recipeId: String(recipe.id || ""),
      produced: Array.isArray(result.added) ? result.added.map((entry) => ({ ...entry })) : []
    };
  }

  function serializeRecipeDefs() {
    return getRecipeDefs().map((recipe) => ({
      id: String(recipe.id || ""),
      name: String(recipe.name || recipe.id || ""),
      description: String(recipe.description || ""),
      category: String(recipe.category || "misc"),
      skillId: String(recipe.skillId || ""),
      requiredLevel: Math.max(1, Math.floor(Number(recipe.requiredLevel) || 1)),
      inputs: normalizeEntries(recipe.inputs),
      outputs: normalizeEntries(recipe.outputs)
    }));
  }

  return {
    loadRecipeData,
    getRecipeDefs,
    getRecipeById,
    serializeRecipeDefs,
    getAvailableRecipesForPlayer,
    getBestToolTierForPlayer,
    craftRecipe
  };
}

module.exports = {
  createCraftingTools
};
