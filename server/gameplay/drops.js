function createNormalizeItemEntries({ itemDefs }) {
  function cloneEntry(entry, qtyOverride = null) {
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

  return function normalizeItemEntries(entries) {
    const merged = new Map();
    const uniqueEntries = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry) {
        continue;
      }
      const itemId = String(entry.itemId || "").trim();
      const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
      if (!itemId || qty <= 0) {
        continue;
      }
      if (!itemDefs.has(itemId)) {
        continue;
      }
      if (entry.instanceId !== undefined && entry.instanceId !== null) {
        uniqueEntries.push(cloneEntry(entry, 1));
        continue;
      }
      merged.set(itemId, (merged.get(itemId) || 0) + qty);
    }

    return [
      ...uniqueEntries,
      ...Array.from(merged.entries()).map(([itemId, qty]) => ({ itemId, qty }))
    ];
  };
}

function createDropRollTools({
  clamp,
  randomInt,
  normalizeItemEntries,
  getServerConfig,
  getGlobalDropConfig,
  mapWidth,
  mapHeight
}) {
  function rollDropRules(rules) {
    const drops = [];
    const serverConfig = getServerConfig();
    const chanceMultiplier = Number(serverConfig?.dropChanceMultiplier) || 1;
    for (const rule of Array.isArray(rules) ? rules : []) {
      if (!rule) {
        continue;
      }

      if (rule.kind === "range") {
        const qty = randomInt(Math.max(0, rule.min || 0), Math.max(0, rule.max || 0));
        if (qty > 0) {
          drops.push({ itemId: rule.itemId, qty });
        }
        continue;
      }

      if (rule.kind === "chance") {
        const baseChance = clamp(Number(rule.chance) || 0, 0, 1);
        const effectiveChance = Math.max(0, baseChance * chanceMultiplier);
        const guaranteedDrops = Math.max(0, Math.floor(effectiveChance));
        const fractionalChance = effectiveChance - guaranteedDrops;
        const bonusDrop = Math.random() < fractionalChance ? 1 : 0;
        const totalDrops = guaranteedDrops + bonusDrop;
        if (totalDrops > 0) {
          drops.push({ itemId: rule.itemId, qty: totalDrops });
        }
      }
    }

    return normalizeItemEntries(drops);
  }

  function getDistanceFromCenter(x, y) {
    const cx = mapWidth * 0.5;
    const cy = mapHeight * 0.5;
    return Math.hypot((Number(x) || 0) - cx, (Number(y) || 0) - cy);
  }

  function rollGlobalDropsForPlayer(player) {
    if (!player) {
      return [];
    }

    const globalDropConfig = getGlobalDropConfig();
    const dist = getDistanceFromCenter(player.x, player.y);
    const allDrops = [];
    for (const entry of globalDropConfig.entries) {
      if (!entry || dist < entry.rangeMin || dist > entry.rangeMax) {
        continue;
      }
      const rolled = rollDropRules(entry.rules);
      if (rolled.length) {
        allDrops.push(...rolled);
      }
    }
    return normalizeItemEntries(allDrops);
  }

  function rollMobDrops(mob) {
    const rules = Array.isArray(mob?.dropRules) ? mob.dropRules : [];
    return rollDropRules(rules);
  }

  return {
    rollDropRules,
    getDistanceFromCenter,
    rollGlobalDropsForPlayer,
    rollMobDrops
  };
}

module.exports = {
  createNormalizeItemEntries,
  createDropRollTools
};
