const fs = require("fs");
const path = require("path");

function createResourceRegistry(options = {}) {
  const resourceDataPath = options.resourceDataPath
    ? path.resolve(String(options.resourceDataPath))
    : path.resolve(__dirname, "../../data/resources.json");
  const itemDefsProvider =
    typeof options.itemDefsProvider === "function" ? options.itemDefsProvider : () => new Map();
  let loadedData = null;

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeTags(values) {
    const tags = [];
    for (const value of Array.isArray(values) ? values : []) {
      const tag = normalizeId(value);
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
    return tags;
  }

  function loadResourceData() {
    if (loadedData) {
      return loadedData;
    }
    try {
      loadedData = JSON.parse(fs.readFileSync(resourceDataPath, "utf8"));
    } catch (error) {
      console.error("[resources] Failed to load resource data:", error.message);
      loadedData = { families: [], resources: [] };
    }
    return loadedData;
  }

  function getFamilyDefs() {
    const defs = Array.isArray(loadResourceData().families) ? loadResourceData().families : [];
    return defs
      .map((entry) => {
        const id = normalizeId(entry && entry.id);
        if (!id) {
          return null;
        }
        return {
          id,
          name: String(entry.name || id),
          defaultInteractRange: Math.max(0.5, Number(entry.defaultInteractRange) || 1.8),
          defaultRespawnSecondsMin: Math.max(10, Math.floor(Number(entry.defaultRespawnSecondsMin) || 90)),
          defaultRespawnSecondsMax: Math.max(
            10,
            Math.floor(Number(entry.defaultRespawnSecondsMax) || Number(entry.defaultRespawnSecondsMin) || 120)
          )
        };
      })
      .filter(Boolean);
  }

  function getFamilyDef(familyId) {
    const normalizedId = normalizeId(familyId);
    return getFamilyDefs().find((entry) => entry.id === normalizedId) || null;
  }

  function normalizeYieldEntry(entry) {
    const itemId = normalizeId(entry && entry.itemId);
    if (!itemId) {
      return null;
    }
    const qtyMin = Math.max(1, Math.floor(Number(entry.qtyMin) || Number(entry.qty) || 1));
    const qtyMax = Math.max(qtyMin, Math.floor(Number(entry.qtyMax) || qtyMin));
    const chance = Math.max(0, Math.min(1, Number(entry.chance) || 0));
    return {
      itemId,
      qtyMin,
      qtyMax,
      chance
    };
  }

  function getResourceDefs() {
    const itemDefs = itemDefsProvider();
    const defs = Array.isArray(loadResourceData().resources) ? loadResourceData().resources : [];
    return defs
      .map((entry) => {
        const id = normalizeId(entry && entry.id);
        if (!id) {
          return null;
        }
        const familyId = normalizeId(entry.family);
        const familyDef = getFamilyDef(familyId);
        const yields = (Array.isArray(entry.yields) ? entry.yields : []).map(normalizeYieldEntry).filter(Boolean);
        if (!familyDef || !yields.length) {
          return null;
        }
        return {
          id,
          name: String(entry.name || id),
          family: familyId,
          skillId: normalizeId(entry.skillId),
          requiredLevel: Math.max(1, Math.floor(Number(entry.requiredLevel) || 1)),
          xp: Math.max(1, Math.floor(Number(entry.xp) || 1)),
          spawnWeight: Math.max(0.01, Number(entry.spawnWeight) || 1),
          density: Math.max(0, Math.min(1, Number(entry.density) || 0)),
          interactRange: Math.max(0.5, Number(entry.interactRange) || familyDef.defaultInteractRange),
          respawnSecondsMin: Math.max(
            5,
            Math.floor(Number(entry.respawnSecondsMin) || familyDef.defaultRespawnSecondsMin)
          ),
          respawnSecondsMax: Math.max(
            5,
            Math.floor(Number(entry.respawnSecondsMax) || familyDef.defaultRespawnSecondsMax)
          ),
          bandTagsAny: normalizeTags(entry.bandTagsAny),
          sectorTagsAny: normalizeTags(entry.sectorTagsAny),
          biomeTagsAny: normalizeTags(entry.biomeTagsAny),
          tags: normalizeTags([
            familyId,
            entry && entry.id,
            ...(entry && entry.bandTagsAny ? entry.bandTagsAny : []),
            ...(entry && entry.sectorTagsAny ? entry.sectorTagsAny : []),
            ...(entry && entry.biomeTagsAny ? entry.biomeTagsAny : [])
          ]),
          yields: yields.map((yieldEntry) => {
            const itemDef = itemDefs instanceof Map ? itemDefs.get(yieldEntry.itemId) : null;
            return {
              ...yieldEntry,
              itemName: String((itemDef && itemDef.name) || yieldEntry.itemId)
            };
          }),
          visual: entry && entry.visual && typeof entry.visual === "object" ? { ...entry.visual } : {}
        };
      })
      .filter(Boolean);
  }

  function getResourceDef(resourceId) {
    const normalizedId = normalizeId(resourceId);
    return getResourceDefs().find((entry) => entry.id === normalizedId) || null;
  }

  function matchesAnyTag(requiredTags, availableTags) {
    if (!requiredTags.length) {
      return true;
    }
    const tagSet = new Set(normalizeTags(availableTags));
    return requiredTags.some((tag) => tagSet.has(tag));
  }

  function getCandidatesForBiome(biomeInfo, familyId = "") {
    const normalizedFamilyId = normalizeId(familyId);
    const biomeTags = normalizeTags(biomeInfo && biomeInfo.tags);
    return getResourceDefs().filter((resourceDef) => {
      if (normalizedFamilyId && resourceDef.family !== normalizedFamilyId) {
        return false;
      }
      return (
        matchesAnyTag(resourceDef.bandTagsAny, biomeTags) &&
        matchesAnyTag(resourceDef.sectorTagsAny, biomeTags) &&
        matchesAnyTag(resourceDef.biomeTagsAny, biomeTags)
      );
    });
  }

  return {
    loadResourceData,
    getFamilyDefs,
    getFamilyDef,
    getResourceDefs,
    getResourceDef,
    getCandidatesForBiome
  };
}

module.exports = {
  createResourceRegistry
};
