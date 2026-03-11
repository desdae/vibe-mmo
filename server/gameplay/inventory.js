function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createInventoryTools(options = {}) {
  const itemDefs = options.itemDefs;
  const inventorySlotCount = Math.max(1, Number(options.inventorySlotCount) || 1);
  const copperItemId = String(options.copperItemId || "").trim();
  const normalizeItemEntries = options.normalizeItemEntries;
  const sendSelfProgress = options.sendSelfProgress;

  if (!itemDefs || typeof itemDefs.get !== "function" || typeof itemDefs.has !== "function") {
    throw new Error("createInventoryTools requires Map-like itemDefs");
  }
  if (typeof normalizeItemEntries !== "function") {
    throw new Error("createInventoryTools requires normalizeItemEntries function");
  }
  if (typeof sendSelfProgress !== "function") {
    throw new Error("createInventoryTools requires sendSelfProgress function");
  }

  function createEmptyInventorySlots() {
    return Array.from({ length: inventorySlotCount }, () => null);
  }

  function cloneInventoryEntry(entry, qtyOverride = null) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const copy = {
      itemId: String(entry.itemId || ""),
      qty: Math.max(0, Math.floor(Number(qtyOverride !== null ? qtyOverride : entry.qty) || 0))
    };
    const passthroughKeys = [
      "instanceId",
      "name",
      "rarity",
      "slot",
      "weaponClass",
      "itemLevel",
      "isEquipment"
    ];
    for (const key of passthroughKeys) {
      if (entry[key] !== undefined && entry[key] !== null && entry[key] !== "") {
        copy[key] = entry[key];
      }
    }
    if (Array.isArray(entry.tags)) {
      copy.tags = entry.tags.map((value) => String(value || "")).filter(Boolean);
    }
    if (entry.baseStats && typeof entry.baseStats === "object") {
      copy.baseStats = { ...entry.baseStats };
    }
    if (Array.isArray(entry.affixes)) {
      copy.affixes = entry.affixes.map((affix) => ({
        ...affix,
        modifiers: Array.isArray(affix?.modifiers) ? affix.modifiers.map((modifier) => ({ ...modifier })) : []
      }));
    }
    if (Array.isArray(entry.prefixes)) {
      copy.prefixes = entry.prefixes.map((affix) => ({
        ...affix,
        modifiers: Array.isArray(affix?.modifiers) ? affix.modifiers.map((modifier) => ({ ...modifier })) : []
      }));
    }
    if (Array.isArray(entry.suffixes)) {
      copy.suffixes = entry.suffixes.map((affix) => ({
        ...affix,
        modifiers: Array.isArray(affix?.modifiers) ? affix.modifiers.map((modifier) => ({ ...modifier })) : []
      }));
    }
    return copy;
  }

  function addItemsToInventory(player, entries) {
    const normalizedEntries = normalizeItemEntries(entries);
    if (!normalizedEntries.length || !player || !Array.isArray(player.inventorySlots)) {
      return {
        added: [],
        leftover: normalizedEntries,
        changed: false
      };
    }

    const addedByItem = new Map();
    const addedUniqueEntries = [];
    const leftover = [];
    let changed = false;

    for (const entry of normalizedEntries) {
      const itemDef = itemDefs.get(entry.itemId);
      if (!itemDef) {
        continue;
      }

      let remaining = entry.qty;
      const stackSize = itemDef.stackSize;
      const isUniqueInstance = entry.instanceId !== undefined && entry.instanceId !== null;

      if (isUniqueInstance) {
        const emptyIndex = player.inventorySlots.findIndex((slot) => !slot);
        if (emptyIndex < 0) {
          leftover.push(cloneInventoryEntry(entry, 1));
          continue;
        }
        player.inventorySlots[emptyIndex] = cloneInventoryEntry(entry, 1);
        changed = true;
        addedUniqueEntries.push({
          itemId: entry.itemId,
          qty: 1,
          name: String(entry.name || itemDef.name || entry.itemId)
        });
        continue;
      }

      for (let i = 0; i < player.inventorySlots.length && remaining > 0; i += 1) {
        const slot = player.inventorySlots[i];
        if (!slot || slot.itemId !== entry.itemId || slot.instanceId !== undefined && slot.instanceId !== null) {
          continue;
        }
        if (slot.qty >= stackSize) {
          continue;
        }

        const canAdd = Math.min(stackSize - slot.qty, remaining);
        if (canAdd <= 0) {
          continue;
        }
        slot.qty += canAdd;
        remaining -= canAdd;
        changed = true;
        addedByItem.set(entry.itemId, (addedByItem.get(entry.itemId) || 0) + canAdd);
      }

      for (let i = 0; i < player.inventorySlots.length && remaining > 0; i += 1) {
        const slot = player.inventorySlots[i];
        if (slot) {
          continue;
        }
        const putQty = Math.min(stackSize, remaining);
        player.inventorySlots[i] = cloneInventoryEntry(entry, putQty);
        remaining -= putQty;
        changed = true;
        addedByItem.set(entry.itemId, (addedByItem.get(entry.itemId) || 0) + putQty);
      }

      if (remaining > 0) {
        leftover.push({
          itemId: entry.itemId,
          qty: remaining
        });
      }
    }

    const added = [
      ...addedUniqueEntries,
      ...Array.from(addedByItem.entries()).map(([itemId, qty]) => ({
        itemId,
        qty,
        name: itemDefs.get(itemId)?.name || itemId
      }))
    ];

    return {
      added,
      leftover: normalizeItemEntries(leftover),
      changed
    };
  }

  function mergeOrSwapInventorySlots(player, fromIndex, toIndex) {
    if (!player || !Array.isArray(player.inventorySlots)) {
      return false;
    }
    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= player.inventorySlots.length ||
      toIndex >= player.inventorySlots.length ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const slots = player.inventorySlots;
    const from = slots[fromIndex];
    const to = slots[toIndex];

    if (!from && !to) {
      return false;
    }

    if (!from || !to) {
      slots[fromIndex] = to;
      slots[toIndex] = from;
      return true;
    }

    if (from.itemId === to.itemId) {
      if (from.instanceId !== undefined || to.instanceId !== undefined) {
        slots[fromIndex] = to;
        slots[toIndex] = from;
        return true;
      }
      const stackSize = itemDefs.get(from.itemId)?.stackSize || 1;
      if (to.qty < stackSize) {
        const moveQty = Math.min(from.qty, stackSize - to.qty);
        to.qty += moveQty;
        from.qty -= moveQty;
        if (from.qty <= 0) {
          slots[fromIndex] = null;
        }
        return moveQty > 0;
      }
    }

    slots[fromIndex] = to;
    slots[toIndex] = from;
    return true;
  }

  function consumeInventoryItem(player, itemId, qty = 1) {
    if (!player || !Array.isArray(player.inventorySlots)) {
      return false;
    }
    const targetId = String(itemId || "").trim();
    let remaining = Math.max(1, Math.floor(Number(qty) || 1));
    if (!targetId) {
      return false;
    }

    for (let i = 0; i < player.inventorySlots.length && remaining > 0; i += 1) {
      const slot = player.inventorySlots[i];
      if (!slot || slot.itemId !== targetId) {
        continue;
      }
      const take = Math.min(slot.qty, remaining);
      slot.qty -= take;
      remaining -= take;
      if (slot.qty <= 0) {
        player.inventorySlots[i] = null;
      }
    }

    return remaining === 0;
  }

  function getInventoryItemCount(player, itemId) {
    if (!player || !Array.isArray(player.inventorySlots) || !itemId) {
      return 0;
    }
    let total = 0;
    for (const slot of player.inventorySlots) {
      if (!slot || slot.itemId !== itemId) {
        continue;
      }
      total += Math.max(0, Math.floor(Number(slot.qty) || 0));
    }
    return total;
  }

  function syncPlayerCopperFromInventory(player, shouldNotify = false) {
    if (!player) {
      return false;
    }
    const nextCopper = clamp(getInventoryItemCount(player, copperItemId), 0, 65535);
    if (nextCopper === player.copper) {
      return false;
    }
    player.copper = nextCopper;
    if (shouldNotify) {
      sendSelfProgress(player);
    }
    return true;
  }

  return {
    createEmptyInventorySlots,
    addItemsToInventory,
    mergeOrSwapInventorySlots,
    consumeInventoryItem,
    getInventoryItemCount,
    syncPlayerCopperFromInventory
  };
}

module.exports = {
  createInventoryTools
};
