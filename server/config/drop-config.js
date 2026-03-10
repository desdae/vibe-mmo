const fs = require("fs");
const { clamp, parseNumericRange } = require("../gameplay/number-utils");

function parseMobDropRules(rawDrops, itemDefs) {
  return parseDropRulesFromGroups(rawDrops, itemDefs);
}

function parseDropRulesFromGroups(rawDropGroups, itemDefs) {
  const rules = [];
  if (!Array.isArray(rawDropGroups)) {
    return rules;
  }

  for (const dropGroup of rawDropGroups) {
    if (!dropGroup || typeof dropGroup !== "object") {
      continue;
    }

    for (const [itemId, rawSpec] of Object.entries(dropGroup)) {
      if (!itemDefs.has(itemId)) {
        continue;
      }

      if (Array.isArray(rawSpec) && rawSpec.length >= 2) {
        const a = Number(rawSpec[0]);
        const b = Number(rawSpec[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const min = Math.max(0, Math.floor(Math.min(a, b)));
          const max = Math.max(min, Math.floor(Math.max(a, b)));
          rules.push({
            itemId,
            kind: "range",
            min,
            max
          });
        }
        continue;
      }

      if (Array.isArray(rawSpec) && rawSpec.length === 1) {
        const chance = Number(rawSpec[0]);
        if (Number.isFinite(chance)) {
          rules.push({
            itemId,
            kind: "chance",
            chance: clamp(chance, 0, 1)
          });
        }
        continue;
      }

      if (Number.isFinite(Number(rawSpec))) {
        rules.push({
          itemId,
          kind: "chance",
          chance: clamp(Number(rawSpec), 0, 1)
        });
      }
    }
  }

  return rules;
}

function flattenGlobalDropEntries(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) {
      flattenGlobalDropEntries(item, out);
    }
    return;
  }
  if (node && typeof node === "object") {
    out.push(node);
  }
}

function loadGlobalDropTableConfigFromDisk(configPath, itemDefs, mapWidth, mapHeight) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const maxMapRadius = Math.hypot(mapWidth / 2, mapHeight / 2);
  const flatEntries = [];
  flattenGlobalDropEntries(parsed, flatEntries);

  const entries = [];
  for (const entry of flatEntries) {
    const [rangeMinRaw, rangeMaxRaw] = parseNumericRange(entry.range, 0, maxMapRadius);
    const rangeMin = clamp(Math.min(rangeMinRaw, rangeMaxRaw), 0, maxMapRadius);
    const rangeMax = clamp(Math.max(rangeMinRaw, rangeMaxRaw), rangeMin, maxMapRadius);
    const itemsGroup = entry && typeof entry.items === "object" ? entry.items : null;
    if (!itemsGroup) {
      continue;
    }
    const rules = parseDropRulesFromGroups([itemsGroup], itemDefs);
    if (!rules.length) {
      continue;
    }
    entries.push({
      rangeMin,
      rangeMax,
      rules
    });
  }

  return {
    entries
  };
}

module.exports = {
  parseMobDropRules,
  parseDropRulesFromGroups,
  loadGlobalDropTableConfigFromDisk
};
