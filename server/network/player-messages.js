function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createPlayerMessageTools(options = {}) {
  const sendJson = options.sendJson;
  const itemDefs = options.itemDefs;
  const equipmentSlotIds = Array.isArray(options.equipmentSlotIds) ? options.equipmentSlotIds : [];
  const inventoryCols = Math.max(1, Number(options.inventoryCols) || 1);
  const inventoryRows = Math.max(1, Number(options.inventoryRows) || 1);
  const inventorySlotCount = Math.max(1, Number(options.inventorySlotCount) || inventoryCols * inventoryRows);

  if (typeof sendJson !== "function") {
    throw new Error("createPlayerMessageTools requires sendJson function");
  }
  if (!itemDefs || typeof itemDefs.has !== "function" || typeof itemDefs.get !== "function") {
    throw new Error("createPlayerMessageTools requires Map-like itemDefs");
  }

  function serializeItemEntry(slot) {
    if (!slot || !itemDefs.has(slot.itemId)) {
      return null;
    }
    const entry = {
      itemId: slot.itemId,
      qty: Math.max(0, Math.floor(Number(slot.qty) || 0))
    };
    if (slot.instanceId !== undefined && slot.instanceId !== null) {
      entry.instanceId = String(slot.instanceId);
    }
    if (typeof slot.name === "string" && slot.name.trim()) {
      entry.name = slot.name.trim();
    }
    if (typeof slot.rarity === "string" && slot.rarity.trim()) {
      entry.rarity = slot.rarity.trim();
    }
    if (typeof slot.slot === "string" && slot.slot.trim()) {
      entry.slot = slot.slot.trim();
    }
    if (typeof slot.weaponClass === "string" && slot.weaponClass.trim()) {
      entry.weaponClass = slot.weaponClass.trim();
    }
    if (slot.isEquipment) {
      entry.isEquipment = true;
    }
    if (Number.isFinite(Number(slot.itemLevel))) {
      entry.itemLevel = Math.max(1, Math.floor(Number(slot.itemLevel)));
    }
    if (slot.baseStats && typeof slot.baseStats === "object") {
      entry.baseStats = slot.baseStats;
    }
    if (Array.isArray(slot.tags)) {
      entry.tags = slot.tags;
    }
    if (Array.isArray(slot.affixes)) {
      entry.affixes = slot.affixes;
    }
    if (Array.isArray(slot.prefixes)) {
      entry.prefixes = slot.prefixes;
    }
    if (Array.isArray(slot.suffixes)) {
      entry.suffixes = slot.suffixes;
    }
    return entry;
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
      serialized.push(serializeItemEntry(slots[i]));
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

  function sendEquipmentState(player) {
    if (!player) {
      return;
    }
    const equipmentSlots = player.equipmentSlots && typeof player.equipmentSlots === "object" ? player.equipmentSlots : {};
    const serialized = {};
    for (const slotId of equipmentSlotIds) {
      serialized[slotId] = serializeItemEntry(equipmentSlots[slotId]);
    }
    sendJson(player.ws, {
      type: "equipment_state",
      itemSlots: equipmentSlotIds,
      slots: serialized
    });
  }

  function serializeBagItemsForMeta(items, normalizeItemEntries) {
    const normalized = typeof normalizeItemEntries === "function" ? normalizeItemEntries(items) : [];
    return normalized.map((entry) => {
      const itemDef = itemDefs.get(entry.itemId);
      return {
        itemId: entry.itemId,
        qty: entry.qty,
        name: String(entry.name || (itemDef ? itemDef.name : entry.itemId))
      };
    });
  }

  return {
    serializePlayerAbilityLevels,
    sendSelfProgress,
    serializeInventorySlots,
    sendInventoryState,
    sendEquipmentState,
    serializeBagItemsForMeta
  };
}

module.exports = {
  createPlayerMessageTools
};
