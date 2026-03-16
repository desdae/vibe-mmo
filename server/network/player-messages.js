function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneSerializableValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneSerializableValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const clone = {};
  for (const [key, entryValue] of Object.entries(value)) {
    clone[key] = cloneSerializableValue(entryValue);
  }
  return clone;
}

function createPlayerMessageTools(options = {}) {
  const sendJson = options.sendJson;
  const itemDefs = options.itemDefs;
  const equipmentSlotIds = Array.isArray(options.equipmentSlotIds) ? options.equipmentSlotIds : [];
  const inventoryCols = Math.max(1, Number(options.inventoryCols) || 1);
  const inventoryRows = Math.max(1, Number(options.inventoryRows) || 1);
  const inventorySlotCount = Math.max(1, Number(options.inventorySlotCount) || inventoryCols * inventoryRows);
  const inventorySnapshots = new WeakMap();
  const equipmentSnapshots = new WeakMap();

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
      entry.baseStats = cloneSerializableValue(slot.baseStats);
    }
    if (Array.isArray(slot.tags)) {
      entry.tags = cloneSerializableValue(slot.tags);
    }
    if (Array.isArray(slot.affixes)) {
      entry.affixes = cloneSerializableValue(slot.affixes);
    }
    if (Array.isArray(slot.prefixes)) {
      entry.prefixes = cloneSerializableValue(slot.prefixes);
    }
    if (Array.isArray(slot.suffixes)) {
      entry.suffixes = cloneSerializableValue(slot.suffixes);
    }
    return entry;
  }

  function buildInventorySnapshot(player) {
    const slots = Array.isArray(player?.inventorySlots) ? player.inventorySlots : [];
    const serialized = [];
    const signatures = [];
    for (let i = 0; i < inventorySlotCount; i += 1) {
      const entry = serializeItemEntry(slots[i]);
      serialized.push(entry);
      signatures.push(entry ? JSON.stringify(entry) : "");
    }
    return {
      cols: inventoryCols,
      rows: inventoryRows,
      serialized,
      signatures
    };
  }

  function buildEquipmentSnapshot(player) {
    const equipmentSlots = player && player.equipmentSlots && typeof player.equipmentSlots === "object" ? player.equipmentSlots : {};
    const serialized = {};
    const signatures = {};
    for (const slotId of equipmentSlotIds) {
      const entry = serializeItemEntry(equipmentSlots[slotId]);
      serialized[slotId] = entry;
      signatures[slotId] = entry ? JSON.stringify(entry) : "";
    }
    return {
      itemSlots: [...equipmentSlotIds],
      serialized,
      signatures
    };
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

  function sendSelfProgress(player, playerSkills = null) {
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
      talentPoints: clamp(Math.floor(Number(player.talentPoints) || 0), 0, 65535),
      abilityLevels: serializePlayerAbilityLevels(player),
      skills: Array.isArray(playerSkills) ? playerSkills : []
    });
  }

  function serializeInventorySlots(player) {
    return buildInventorySnapshot(player).serialized;
  }

  function sendInventoryState(player) {
    if (!player) {
      return;
    }
    const snapshot = buildInventorySnapshot(player);
    const previous = inventorySnapshots.get(player);
    if (
      !previous ||
      previous.cols !== snapshot.cols ||
      previous.rows !== snapshot.rows ||
      !Array.isArray(previous.signatures) ||
      previous.signatures.length !== snapshot.signatures.length
    ) {
      sendJson(player.ws, {
        type: "inventory_state",
        cols: snapshot.cols,
        rows: snapshot.rows,
        slots: snapshot.serialized
      });
      inventorySnapshots.set(player, snapshot);
      return;
    }

    const changedSlots = [];
    for (let index = 0; index < snapshot.signatures.length; index += 1) {
      if (snapshot.signatures[index] === previous.signatures[index]) {
        continue;
      }
      changedSlots.push({
        index,
        item: snapshot.serialized[index]
      });
    }
    if (!changedSlots.length) {
      return;
    }
    sendJson(player.ws, {
      type: "inventory_delta",
      slots: changedSlots
    });
    inventorySnapshots.set(player, snapshot);
  }

  function sendEquipmentState(player) {
    if (!player) {
      return;
    }
    const snapshot = buildEquipmentSnapshot(player);
    const previous = equipmentSnapshots.get(player);
    const slotIdsChanged =
      !previous ||
      !Array.isArray(previous.itemSlots) ||
      previous.itemSlots.length !== snapshot.itemSlots.length ||
      previous.itemSlots.some((slotId, index) => slotId !== snapshot.itemSlots[index]);
    if (slotIdsChanged) {
      sendJson(player.ws, {
        type: "equipment_state",
        itemSlots: snapshot.itemSlots,
        slots: snapshot.serialized
      });
      equipmentSnapshots.set(player, snapshot);
      return;
    }

    const changedSlots = [];
    for (const slotId of snapshot.itemSlots) {
      if (snapshot.signatures[slotId] === previous.signatures[slotId]) {
        continue;
      }
      changedSlots.push({
        slotId,
        item: snapshot.serialized[slotId]
      });
    }
    if (!changedSlots.length) {
      return;
    }
    sendJson(player.ws, {
      type: "equipment_delta",
      slots: changedSlots
    });
    equipmentSnapshots.set(player, snapshot);
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
