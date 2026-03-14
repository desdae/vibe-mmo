const fs = require("fs");
const { clamp, parseNumericRange } = require("../gameplay/number-utils");
const { parseHumanoidRenderStyle } = require("../../public/shared/humanoid-style");

function parseClassStartingItems(rawStartingItems, itemDefs, normalizeItemEntries) {
  const result = [];
  for (const block of Array.isArray(rawStartingItems) ? rawStartingItems : []) {
    if (!block || typeof block !== "object") {
      continue;
    }
    for (const [itemId, rawQty] of Object.entries(block)) {
      if (!itemDefs.has(itemId)) {
        continue;
      }
      const qtyRange = parseNumericRange(rawQty, 0, 0);
      const qty = Math.max(0, Math.floor(Math.max(qtyRange[0], qtyRange[1])));
      if (qty <= 0) {
        continue;
      }
      result.push({
        itemId,
        qty
      });
    }
  }
  return normalizeItemEntries(result);
}

function parseClassStartingEquipment(rawStartingEquipment, itemDefs) {
  const result = [];
  for (const entry of Array.isArray(rawStartingEquipment) ? rawStartingEquipment : []) {
    let itemId = "";
    if (typeof entry === "string") {
      itemId = String(entry || "").trim();
    } else if (entry && typeof entry === "object") {
      itemId = String(entry.itemId || "").trim();
      if (!itemId) {
        const keys = Object.keys(entry);
        if (keys.length === 1) {
          itemId = String(keys[0] || "").trim();
        }
      }
    }
    if (!itemId || !itemDefs.has(itemId)) {
      continue;
    }
    result.push(itemId);
  }
  return result;
}

function loadClassConfigFromDisk(configPath, abilityDefs, itemDefs, basePlayerSpeed, normalizeItemEntries) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const entries = parsed && typeof parsed === "object" ? Object.entries(parsed) : [];

  const classDefs = new Map();
  const clientClassDefs = [];

  for (const [rawId, entry] of entries) {
    const id = String(rawId || "").trim();
    if (!id || !entry || typeof entry !== "object") {
      continue;
    }

    const abilities = [];
    const abilityLevels = new Map();
    for (const abilityEntry of Array.isArray(entry.abilities) ? entry.abilities : []) {
      const abilityId = String(abilityEntry?.id || "").trim();
      if (!abilityId || !abilityDefs.has(abilityId)) {
        continue;
      }
      const level = clamp(Math.floor(Number(abilityEntry.level) || 1), 1, 255);
      abilities.push({ id: abilityId, level });
      abilityLevels.set(abilityId, level);
    }

    const baseHealth = clamp(Math.floor(Number(entry.baseHealth) || 10), 1, 255);
    const baseMana = clamp(Math.floor(Number(entry.baseMana) || 0), 0, 65535);
    const manaRegen = Math.max(0, Number(entry.manaRegen) || 0);
    const classSpeedRaw = Number(entry.speed);
    const movementSpeed = clamp(Number.isFinite(classSpeedRaw) ? classSpeedRaw : basePlayerSpeed, 0.1, 20);
    const startingItems = parseClassStartingItems(entry.startingItems, itemDefs, normalizeItemEntries);
    const startingEquipment = parseClassStartingEquipment(entry.startingEquipment, itemDefs);
    const talentTree = String(entry.talentTree || "").trim().toLowerCase() || null;
    const talentPointsPerLevel = Math.max(1, Number(entry.talentPointsPerLevel) || 1);
    const def = {
      id,
      name: String(entry.name || id).slice(0, 48),
      description: String(entry.description || "").slice(0, 240),
      baseHealth,
      baseMana,
      manaRegen,
      speed: movementSpeed,
      movementSpeed,
      talentTree,
      talentPointsPerLevel,
      renderStyle: parseHumanoidRenderStyle(entry.renderStyle),
      abilities,
      abilityLevels,
      startingItems,
      startingEquipment
    };

    classDefs.set(id, def);
    clientClassDefs.push({
      id: def.id,
      name: def.name,
      description: def.description,
      baseHealth: def.baseHealth,
      baseMana: def.baseMana,
      manaRegen: def.manaRegen,
      speed: def.speed,
      renderStyle: def.renderStyle ? JSON.parse(JSON.stringify(def.renderStyle)) : null,
      abilities: def.abilities.map((ability) => ({ ...ability }))
    });
  }

  if (!classDefs.size) {
    throw new Error(`No valid class definitions in ${configPath}`);
  }

  return {
    classDefs,
    clientClassDefs
  };
}

module.exports = {
  loadClassConfigFromDisk
};
