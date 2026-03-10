function createNormalizeItemEntries({ itemDefs }) {
  return function normalizeItemEntries(entries) {
    const merged = new Map();
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
      merged.set(itemId, (merged.get(itemId) || 0) + qty);
    }

    return Array.from(merged.entries()).map(([itemId, qty]) => ({ itemId, qty }));
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
        const chance = clamp((Number(rule.chance) || 0) * chanceMultiplier, 0, 1);
        if (Math.random() < chance) {
          drops.push({ itemId: rule.itemId, qty: 1 });
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
