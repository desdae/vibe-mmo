(function initItemValue(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeItemValue = rootFactory();
})(function buildItemValueModule() {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getRarityRank(rarityId, itemRarities) {
    const keys = Object.keys(itemRarities && typeof itemRarities === "object" ? itemRarities : {});
    const normalized = String(rarityId || "").trim().toLowerCase();
    const index = keys.findIndex((key) => String(key || "").trim().toLowerCase() === normalized);
    return index >= 0 ? index : 0;
  }

  function getBaseItemLevel(entry, itemDef) {
    const direct = Math.floor(Number(entry && entry.itemLevel) || 0);
    if (direct > 0) {
      return direct;
    }
    const range = Array.isArray(itemDef && itemDef.itemLevelRange) ? itemDef.itemLevelRange : [];
    if (range.length >= 2) {
      const a = Number(range[0]) || 1;
      const b = Number(range[1]) || a;
      return Math.max(1, Math.round((Math.min(a, b) + Math.max(a, b)) * 0.5));
    }
    return 1;
  }

  function getBaseStatsScore(entry, itemDef) {
    const baseStats =
      entry && entry.baseStats && typeof entry.baseStats === "object"
        ? entry.baseStats
        : itemDef && itemDef.baseStats && typeof itemDef.baseStats === "object"
          ? itemDef.baseStats
          : null;
    if (!baseStats) {
      return 0;
    }
    let total = 0;
    for (const rawValue of Object.values(baseStats)) {
      const value = Number(rawValue) || 0;
      total += Math.abs(value) <= 1 ? Math.abs(value) * 40 : Math.abs(value) * 2;
    }
    return total;
  }

  function getAffixEntries(entry) {
    const results = [];
    const seen = new Set();
    const lists = [];
    if (Array.isArray(entry && entry.affixes)) {
      lists.push(entry.affixes);
    }
    if (Array.isArray(entry && entry.prefixes)) {
      lists.push(entry.prefixes);
    }
    if (Array.isArray(entry && entry.suffixes)) {
      lists.push(entry.suffixes);
    }
    for (const list of lists) {
      for (const affix of list) {
        if (!affix || typeof affix !== "object") {
          continue;
        }
        const modifiers = Array.isArray(affix.modifiers) ? affix.modifiers : [];
        const key = `${String(affix.id || affix.name || "")}|${JSON.stringify(modifiers)}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        results.push(affix);
      }
    }
    return results;
  }

  function getModifierValueScore(modifier) {
    if (!modifier || typeof modifier !== "object") {
      return 0;
    }
    const stat = String(modifier.stat || "");
    const value = Math.abs(Number(modifier.value) || 0);
    if (!value) {
      return 0;
    }
    if (stat.endsWith(".percent")) {
      return value * 0.9;
    }
    if (stat.includes("Chance")) {
      return value <= 1 ? value * 120 : value * 1.2;
    }
    if (stat.includes("flatMin") || stat.includes("flatMax")) {
      return value * 1.6;
    }
    if (value <= 1) {
      return value * 45;
    }
    return value * 1.35;
  }

  function getAffixQualityScore(entry) {
    const affixes = getAffixEntries(entry);
    let total = affixes.length * 8;
    for (const affix of affixes) {
      for (const modifier of Array.isArray(affix.modifiers) ? affix.modifiers : []) {
        total += getModifierValueScore(modifier);
      }
    }
    return total;
  }

  function getConsumableCopperValue(entry, itemDef) {
    const qty = Math.max(1, Math.floor(Number(entry && entry.qty) || 1));
    if (itemDef && Number.isFinite(Number(itemDef.vendorValue))) {
      return Math.max(1, Math.round(Number(itemDef.vendorValue) * qty));
    }
    if (String(entry && entry.itemId || "") === "copperCoin") {
      return qty;
    }
    const effect = itemDef && itemDef.effect && typeof itemDef.effect === "object" ? itemDef.effect : null;
    if (!effect) {
      return qty;
    }
    const value = Math.max(0, Number(effect.value) || 0);
    const duration = Math.max(0, Number(effect.duration) || 0);
    const base = 1 + value * 0.12 + duration * 0.3;
    return Math.max(1, Math.round(base * qty));
  }

  function getEquipmentCopperValue(entry, itemDef, itemRarities) {
    const qty = Math.max(1, Math.floor(Number(entry && entry.qty) || 1));
    const itemLevel = getBaseItemLevel(entry, itemDef);
    const rarityRank = getRarityRank(entry && entry.rarity, itemRarities);
    const baseStatsScore = getBaseStatsScore(entry, itemDef);
    const affixScore = getAffixQualityScore(entry);
    const rarityMultiplier = 1 + rarityRank * 0.65;
    const raw = (itemLevel * 2 + baseStatsScore * 0.28 + affixScore * 0.7) * rarityMultiplier;
    return Math.max(1, Math.round(raw)) * qty;
  }

  function getItemCopperValue(entry, options = {}) {
    const itemDef = options.itemDef && typeof options.itemDef === "object" ? options.itemDef : null;
    const itemRarities = options.itemRarities && typeof options.itemRarities === "object" ? options.itemRarities : {};
    const isEquipment = !!(entry && entry.isEquipment) || !!(itemDef && itemDef.slot);
    if (isEquipment) {
      return getEquipmentCopperValue(entry, itemDef, itemRarities);
    }
    return getConsumableCopperValue(entry, itemDef);
  }

  return Object.freeze({
    getItemCopperValue,
    getAffixEntries,
    getAffixQualityScore,
    getRarityRank
  });
});
