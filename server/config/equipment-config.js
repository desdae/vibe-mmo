const fs = require("fs");
const { clamp, parseNumericRange } = require("../gameplay/number-utils");

function sanitizeCssColor(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
    return raw;
  }
  if (/^rgba?\(([^)]+)\)$/.test(raw)) {
    return raw;
  }
  if (/^hsla?\(([^)]+)\)$/.test(raw)) {
    return raw;
  }
  return "";
}

function sanitizeStringArray(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function sanitizeModifier(modifier) {
  if (!modifier || typeof modifier !== "object") {
    return null;
  }
  const stat = String(modifier.stat || "").trim();
  if (!stat) {
    return null;
  }
  const [rollMinRaw, rollMaxRaw] = parseNumericRange(modifier.rollRange, 0, 0);
  const rollMin = Math.min(rollMinRaw, rollMaxRaw);
  const rollMax = Math.max(rollMinRaw, rollMaxRaw);
  return {
    stat,
    rollMin,
    rollMax
  };
}

function sanitizeAffix(entry, fallbackId) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = String(entry.id || fallbackId || "").trim();
  if (!id) {
    return null;
  }
  const name = String(entry.name || id).trim().slice(0, 64);
  const modifiers = (Array.isArray(entry.modifiers) ? entry.modifiers : []).map(sanitizeModifier).filter(Boolean);
  if (!modifiers.length) {
    return null;
  }
  return {
    id,
    name,
    minItemLevel: Math.max(1, Math.floor(Number(entry.minItemLevel) || 1)),
    allowedSlots: sanitizeStringArray(entry.allowedSlots),
    requiredItemTagsAny: sanitizeStringArray(entry.requiredItemTagsAny),
    tags: sanitizeStringArray(entry.tags),
    modifiers
  };
}

function sanitizeBaseItem(entry, fallbackId) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = String(entry.id || fallbackId || "").trim();
  const name = String(entry.name || id).trim().slice(0, 64);
  const slot = String(entry.slot || "").trim();
  if (!id || !slot) {
    return null;
  }
  const [levelMinRaw, levelMaxRaw] = parseNumericRange(entry.itemLevelRange, 1, 1);
  const itemLevelMin = Math.max(1, Math.floor(Math.min(levelMinRaw, levelMaxRaw)));
  const itemLevelMax = Math.max(itemLevelMin, Math.floor(Math.max(levelMinRaw, levelMaxRaw)));
  const baseStats = entry.baseStats && typeof entry.baseStats === "object" ? { ...entry.baseStats } : {};
  return {
    id,
    name,
    slot,
    weaponClass: String(entry.weaponClass || "").trim(),
    itemLevelRange: [itemLevelMin, itemLevelMax],
    tags: sanitizeStringArray(entry.tags),
    baseStats
  };
}

function sanitizeRarity(entry, fallbackName) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const name = String(fallbackName || "").trim();
  if (!name) {
    return null;
  }
  const [prefixMinRaw, prefixMaxRaw] = parseNumericRange(entry.prefixCount, 0, 0);
  const [suffixMinRaw, suffixMaxRaw] = parseNumericRange(entry.suffixCount, 0, 0);
  return {
    id: name,
    prefixMin: Math.max(0, Math.floor(Math.min(prefixMinRaw, prefixMaxRaw))),
    prefixMax: Math.max(0, Math.floor(Math.max(prefixMinRaw, prefixMaxRaw))),
    suffixMin: Math.max(0, Math.floor(Math.min(suffixMinRaw, suffixMaxRaw))),
    suffixMax: Math.max(0, Math.floor(Math.max(suffixMinRaw, suffixMaxRaw))),
    dropWeight: Math.max(0.0001, Number(entry.dropWeight) || 1),
    color: sanitizeCssColor(entry.color)
  };
}

function buildEquipmentItemDef(baseItem) {
  return {
    id: baseItem.id,
    name: baseItem.name,
    stackSize: 1,
    description: "",
    icon: "",
    effect: null,
    isEquipment: true,
    slot: baseItem.slot,
    weaponClass: baseItem.weaponClass,
    baseStats: { ...baseItem.baseStats },
    itemLevelRange: [...baseItem.itemLevelRange],
    tags: [...baseItem.tags]
  };
}

function expandEquipmentSlotIds(itemSlots) {
  const expanded = [];
  for (const slotId of Array.isArray(itemSlots) ? itemSlots : []) {
    const normalized = String(slotId || "").trim();
    if (!normalized) {
      continue;
    }
    if (normalized === "ring") {
      expanded.push("ring1", "ring2");
      continue;
    }
    if (normalized === "trinket") {
      expanded.push("trinket1", "trinket2");
      continue;
    }
    expanded.push(normalized);
  }
  return sanitizeStringArray(expanded);
}

function loadEquipmentConfigFromDisk(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("equipment config root must be an object");
  }

  const itemSlots = sanitizeStringArray(parsed.itemSlots);
  if (!itemSlots.length) {
    throw new Error(`No valid equipment slots in ${configPath}`);
  }

  const rarityEntries = [];
  for (const [rarityId, rarityEntry] of Object.entries(parsed.itemRarities || {})) {
    const normalized = sanitizeRarity(rarityEntry, rarityId);
    if (normalized) {
      rarityEntries.push(normalized);
    }
  }
  if (!rarityEntries.length) {
    throw new Error(`No valid equipment rarities in ${configPath}`);
  }

  const baseItems = [];
  const baseItemsById = new Map();
  for (const entry of Array.isArray(parsed.baseItems) ? parsed.baseItems : []) {
    const normalized = sanitizeBaseItem(entry);
    if (!normalized || !itemSlots.includes(normalized.slot)) {
      continue;
    }
    baseItems.push(normalized);
    baseItemsById.set(normalized.id, normalized);
  }
  if (!baseItems.length) {
    throw new Error(`No valid equipment base items in ${configPath}`);
  }

  const prefixes = (Array.isArray(parsed.prefixes) ? parsed.prefixes : [])
    .map((entry, index) => sanitizeAffix(entry, `prefix_${index + 1}`))
    .filter(Boolean);
  const suffixes = (Array.isArray(parsed.suffixes) ? parsed.suffixes : [])
    .map((entry, index) => sanitizeAffix(entry, `suffix_${index + 1}`))
    .filter(Boolean);

  const maxItemLevel = baseItems.reduce((max, entry) => Math.max(max, entry.itemLevelRange[1]), 1);
  const equipmentSlotIds = expandEquipmentSlotIds(itemSlots);
  const clientItemRarities = Object.fromEntries(
    rarityEntries.map((entry) => [
      entry.id,
      {
        color: entry.color || ""
      }
    ])
  );
  const clientEquipmentConfig = {
    itemSlots: equipmentSlotIds,
    itemRarities: clientItemRarities
  };
  const equipmentItemDefs = baseItems.map(buildEquipmentItemDef);

  return {
    itemSlots,
    equipmentSlotIds,
    rarityEntries,
    baseItems,
    baseItemsById,
    prefixes,
    suffixes,
    maxItemLevel,
    clientEquipmentConfig,
    equipmentItemDefs
  };
}

module.exports = {
  loadEquipmentConfigFromDisk,
  buildEquipmentItemDef
};
