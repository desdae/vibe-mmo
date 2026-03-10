function createLootBagTools(options = {}) {
  const normalizeItemEntries =
    typeof options.normalizeItemEntries === "function" ? options.normalizeItemEntries : (items) => items;
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const mapWidth = Math.max(1, Number(options.mapWidth) || 1);
  const mapHeight = Math.max(1, Number(options.mapHeight) || 1);
  const bagDespawnMs = Math.max(0, Math.floor(Number(options.bagDespawnMs) || 0));
  const lootBags = options.lootBags;
  const allocateLootBagId =
    typeof options.allocateLootBagId === "function" ? options.allocateLootBagId : () => String(Date.now());

  if (!(lootBags instanceof Map)) {
    throw new Error("createLootBagTools requires lootBags map");
  }

  function createLootBag(x, y, items = []) {
    const normalizedItems = normalizeItemEntries(items);
    if (!normalizedItems.length) {
      return null;
    }
    const now = Date.now();
    const bag = {
      id: String(allocateLootBagId()),
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
      items: normalizedItems,
      metaVersion: 1,
      createdAt: now,
      expiresAt: bagDespawnMs > 0 ? now + bagDespawnMs : 0
    };
    lootBags.set(bag.id, bag);
    return bag;
  }

  function tickLootBags(now = Date.now()) {
    if (bagDespawnMs <= 0 || lootBags.size === 0) {
      return;
    }
    for (const bag of lootBags.values()) {
      if (bag.expiresAt > 0 && now >= bag.expiresAt) {
        lootBags.delete(bag.id);
      }
    }
  }

  return {
    createLootBag,
    tickLootBags
  };
}

module.exports = {
  createLootBagTools
};
