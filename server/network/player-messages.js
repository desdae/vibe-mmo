function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createPlayerMessageTools(options = {}) {
  const sendJson = options.sendJson;
  const itemDefs = options.itemDefs;
  const inventoryCols = Math.max(1, Number(options.inventoryCols) || 1);
  const inventoryRows = Math.max(1, Number(options.inventoryRows) || 1);
  const inventorySlotCount = Math.max(1, Number(options.inventorySlotCount) || inventoryCols * inventoryRows);

  if (typeof sendJson !== "function") {
    throw new Error("createPlayerMessageTools requires sendJson function");
  }
  if (!itemDefs || typeof itemDefs.has !== "function" || typeof itemDefs.get !== "function") {
    throw new Error("createPlayerMessageTools requires Map-like itemDefs");
  }

  function serializePlayerAbilityLevels(player) {
    if (!player || !player.abilityLevels || typeof player.abilityLevels.entries !== "function") {
      return [];
    }
    const result = [];
    for (const [abilityId, rawLevel] of player.abilityLevels.entries()) {
      const id = String(abilityId || "").trim();
      const level = clamp(Math.floor(Number(rawLevel) || 0), 1, 255);
      if (!id || level <= 0) {
        continue;
      }
      result.push({ id, level });
    }
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
  }

  function sendSelfProgress(player) {
    if (!player) {
      return;
    }
    sendJson(player.ws, {
      type: "self_progress",
      copper: player.copper,
      level: player.level,
      exp: player.exp,
      expToNext: player.expToNext,
      skillPoints: clamp(Math.floor(Number(player.skillPoints) || 0), 0, 65535),
      abilityLevels: serializePlayerAbilityLevels(player)
    });
  }

  function serializeInventorySlots(player) {
    const slots = Array.isArray(player?.inventorySlots) ? player.inventorySlots : [];
    const serialized = [];
    for (let i = 0; i < inventorySlotCount; i += 1) {
      const slot = slots[i];
      if (!slot || !itemDefs.has(slot.itemId)) {
        serialized.push(null);
        continue;
      }
      serialized.push({
        itemId: slot.itemId,
        qty: Math.max(0, Math.floor(Number(slot.qty) || 0))
      });
    }
    return serialized;
  }

  function sendInventoryState(player) {
    if (!player) {
      return;
    }
    sendJson(player.ws, {
      type: "inventory_state",
      cols: inventoryCols,
      rows: inventoryRows,
      slots: serializeInventorySlots(player)
    });
  }

  function serializeBagItemsForMeta(items, normalizeItemEntries) {
    const normalized = typeof normalizeItemEntries === "function" ? normalizeItemEntries(items) : [];
    return normalized.map((entry) => {
      const itemDef = itemDefs.get(entry.itemId);
      return {
        itemId: entry.itemId,
        qty: entry.qty,
        name: itemDef ? itemDef.name : entry.itemId
      };
    });
  }

  return {
    serializePlayerAbilityLevels,
    sendSelfProgress,
    serializeInventorySlots,
    sendInventoryState,
    serializeBagItemsForMeta
  };
}

module.exports = {
  createPlayerMessageTools
};
