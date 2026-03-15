const fs = require("fs");
const path = require("path");
const { createResourceRegistry } = require("./resource-registry");

function createQuestContentRegistry(options = {}) {
  const mapWidth = Math.max(64, Math.floor(Number(options.mapWidth) || 1000));
  const mapHeight = Math.max(64, Math.floor(Number(options.mapHeight) || 1000));
  const townLayout = options.townLayout || null;
  const mobConfigProvider =
    typeof options.mobConfigProvider === "function" ? options.mobConfigProvider : () => null;
  const itemDefsProvider =
    typeof options.itemDefsProvider === "function" ? options.itemDefsProvider : () => null;
  const resourceDataPath = options.resourceDataPath
    ? path.resolve(String(options.resourceDataPath))
    : path.resolve(__dirname, "../../data/resources.json");
  const regionDataPath = options.regionDataPath
    ? path.resolve(String(options.regionDataPath))
    : path.resolve(__dirname, "../../data/quest-regions.json");
  const resourceRegistry =
    typeof options.resourceRegistryProvider === "function"
      ? options.resourceRegistryProvider() || createResourceRegistry({ resourceDataPath, itemDefsProvider })
      : createResourceRegistry({ resourceDataPath, itemDefsProvider });

  let loadedRegionData = null;

  function normalizeTag(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeTags(values) {
    const output = [];
    for (const value of Array.isArray(values) ? values : []) {
      const tag = normalizeTag(value);
      if (tag && !output.includes(tag)) {
        output.push(tag);
      }
    }
    return output;
  }

  function hasAllTags(entryTags, requiredTags) {
    const tags = new Set(normalizeTags(entryTags));
    const required = normalizeTags(requiredTags);
    return required.every((tag) => tags.has(tag));
  }

  function hasAnyTags(entryTags, allowedTags) {
    const allowed = normalizeTags(allowedTags);
    if (allowed.length === 0) {
      return true;
    }
    const tags = new Set(normalizeTags(entryTags));
    return allowed.some((tag) => tags.has(tag));
  }

  function hasNoForbiddenTags(entryTags, forbiddenTags) {
    const forbidden = normalizeTags(forbiddenTags);
    if (forbidden.length === 0) {
      return true;
    }
    const tags = new Set(normalizeTags(entryTags));
    return forbidden.every((tag) => !tags.has(tag));
  }

  function loadRegionData() {
    if (loadedRegionData) {
      return loadedRegionData;
    }
    try {
      const raw = fs.readFileSync(regionDataPath, "utf8");
      loadedRegionData = JSON.parse(raw);
    } catch (error) {
      console.error("[quest-content-registry] Failed to load quest regions:", error.message);
      loadedRegionData = { regions: [] };
    }
    return loadedRegionData;
  }

  function buildItemCatalog() {
    const itemDefs = itemDefsProvider();
    if (!itemDefs || typeof itemDefs.values !== "function") {
      return [];
    }
    return Array.from(itemDefs.values()).map((itemDef) => ({
      id: String(itemDef && itemDef.id || ""),
      name: String(itemDef && itemDef.name || itemDef && itemDef.id || ""),
      tags: normalizeTags(itemDef && itemDef.tags)
    })).filter((entry) => entry.id);
  }

  function inferMobTags(mobDef) {
    const tags = normalizeTags(mobDef && mobDef.tags);
    const renderStyle = mobDef && mobDef.renderStyle && typeof mobDef.renderStyle === "object" ? mobDef.renderStyle : {};
    const combat = mobDef && mobDef.combat && typeof mobDef.combat === "object" ? mobDef.combat : {};
    const species = normalizeTag(renderStyle.species);
    const spriteType = normalizeTag(renderStyle.spriteType);
    const archetype = normalizeTag(renderStyle.archetype);
    const behavior = normalizeTag(combat.behavior);
    const name = normalizeTag(mobDef && mobDef.name);
    for (const tag of [species, spriteType, archetype, behavior, name]) {
      if (!tag) {
        continue;
      }
      for (const piece of tag.split(/[^a-z0-9]+/g).filter(Boolean)) {
        if (!tags.includes(piece)) {
          tags.push(piece);
        }
      }
    }
    if (Number(mobDef && mobDef.health) <= 30 && !tags.includes("starter")) {
      tags.push("starter");
    }
    if (Number(mobDef && mobDef.health) >= 35 && !tags.includes("mid")) {
      tags.push("mid");
    }
    return tags;
  }

  function buildMobCatalog() {
    const mobConfig = mobConfigProvider();
    if (!mobConfig || !Array.isArray(mobConfig.clusterDefs)) {
      return [];
    }
    const byName = new Map();
    for (const cluster of mobConfig.clusterDefs) {
      const members = Array.isArray(cluster && cluster.members) ? cluster.members : [];
      for (const mobDef of members) {
        const name = String(mobDef && mobDef.name || "").trim();
        if (!name) {
          continue;
        }
        const entry = byName.get(name) || {
          id: name,
          name,
          tags: inferMobTags(mobDef),
          health: Number(mobDef && mobDef.health) || 1,
          damageMin: Number(mobDef && mobDef.damageMin) || 0,
          damageMax: Number(mobDef && mobDef.damageMax) || 0,
          spawnRangeMin: Number(cluster && cluster.spawnRangeMin) || 0,
          spawnRangeMax: Number(cluster && cluster.spawnRangeMax) || 0,
          dropRules: Array.isArray(mobDef && mobDef.dropRules) ? mobDef.dropRules.map((rule) => ({ ...rule })) : []
        };
        entry.tags = normalizeTags([...(entry.tags || []), ...inferMobTags(mobDef)]);
        entry.spawnRangeMin = Math.min(entry.spawnRangeMin, Number(cluster && cluster.spawnRangeMin) || entry.spawnRangeMin);
        entry.spawnRangeMax = Math.max(entry.spawnRangeMax, Number(cluster && cluster.spawnRangeMax) || entry.spawnRangeMax);
        entry.health = Math.max(entry.health, Number(mobDef && mobDef.health) || entry.health);
        entry.damageMax = Math.max(entry.damageMax, Number(mobDef && mobDef.damageMax) || entry.damageMax);
        entry.dropRules = Array.isArray(mobDef && mobDef.dropRules) ? mobDef.dropRules.map((rule) => ({ ...rule })) : entry.dropRules;
        byName.set(name, entry);
      }
    }
    return Array.from(byName.values()).sort((left, right) => left.spawnRangeMin - right.spawnRangeMin);
  }

  function buildDropItemCatalog() {
    const itemCatalog = buildItemCatalog();
    const itemById = new Map(itemCatalog.map((entry) => [entry.id, entry]));
    const byItemId = new Map();
    for (const mob of buildMobCatalog()) {
      for (const rule of Array.isArray(mob.dropRules) ? mob.dropRules : []) {
        const itemId = String(rule && rule.itemId || "").trim();
        if (!itemId) {
          continue;
        }
        const itemInfo = itemById.get(itemId);
        if (!itemInfo) {
          continue;
        }
        const entry = byItemId.get(itemId) || {
          itemId,
          itemName: itemInfo.name,
          itemTags: normalizeTags(itemInfo.tags),
          sourceMobs: []
        };
        entry.sourceMobs.push({
          mobId: mob.id,
          mobName: mob.name,
          mobTags: normalizeTags(mob.tags),
          spawnRangeMin: mob.spawnRangeMin,
          spawnRangeMax: mob.spawnRangeMax,
          chance: Number(rule && rule.chance) || 0,
          kind: String(rule && rule.kind || "")
        });
        byItemId.set(itemId, entry);
      }
    }
    return Array.from(byItemId.values());
  }

  function buildGatherItemCatalog() {
    const itemCatalog = buildItemCatalog();
    const itemById = new Map(itemCatalog.map((entry) => [entry.id, entry]));
    const byItemId = new Map();
    const resourceDefs =
      resourceRegistry && typeof resourceRegistry.getResourceDefs === "function"
        ? resourceRegistry.getResourceDefs()
        : [];
    for (const resourceDef of Array.isArray(resourceDefs) ? resourceDefs : []) {
      const resourceTags = normalizeTags(resourceDef && resourceDef.tags);
      for (const yieldEntry of Array.isArray(resourceDef && resourceDef.yields) ? resourceDef.yields : []) {
        const itemId = String(yieldEntry && yieldEntry.itemId || "").trim();
        if (!itemId) {
          continue;
        }
        const itemInfo = itemById.get(itemId);
        if (!itemInfo) {
          continue;
        }
        const entry = byItemId.get(itemId) || {
          itemId,
          itemName: itemInfo.name,
          itemTags: normalizeTags(itemInfo.tags),
          sourceResources: []
        };
        entry.sourceResources.push({
          resourceId: String(resourceDef && resourceDef.id || ""),
          resourceName: String(resourceDef && resourceDef.name || resourceDef && resourceDef.id || ""),
          resourceTags,
          skillId: normalizeTag(resourceDef && resourceDef.skillId),
          requiredLevel: Math.max(1, Number(resourceDef && resourceDef.requiredLevel) || 1),
          requiredToolTier: Math.max(0, Number(resourceDef && resourceDef.requiredToolTier) || 0),
          chance: Number(yieldEntry && yieldEntry.chance) || 0
        });
        byItemId.set(itemId, entry);
      }
    }
    return Array.from(byItemId.values());
  }

  function getRegions() {
    const raw = loadRegionData();
    return (Array.isArray(raw.regions) ? raw.regions : []).map((region) => ({
      id: String(region && region.id || ""),
      name: String(region && region.name || region && region.id || ""),
      x: Math.max(0, Math.min(mapWidth - 1, Math.round(Number(region && region.x) || Math.floor(mapWidth * 0.5)))),
      y: Math.max(0, Math.min(mapHeight - 1, Math.round(Number(region && region.y) || Math.floor(mapHeight * 0.5)))),
      radius: Math.max(4, Math.floor(Number(region && region.radius) || 16)),
      tags: normalizeTags(region && region.tags)
    })).filter((entry) => entry.id);
  }

  function findMobs(query = {}) {
    return buildMobCatalog().filter((entry) => {
      if (!hasAllTags(entry.tags, query.tagsAll)) {
        return false;
      }
      if (!hasAnyTags(entry.tags, query.tagsAny)) {
        return false;
      }
      if (!hasNoForbiddenTags(entry.tags, query.tagsNone)) {
        return false;
      }
      if (Number.isFinite(Number(query.maxSpawnRange)) && Number(entry.spawnRangeMin) > Number(query.maxSpawnRange)) {
        return false;
      }
      if (Number.isFinite(Number(query.minSpawnRange)) && Number(entry.spawnRangeMax) < Number(query.minSpawnRange)) {
        return false;
      }
      return true;
    });
  }

  function findDropItems(query = {}) {
    return buildDropItemCatalog().filter((entry) => {
      if (!hasAllTags(entry.itemTags, query.itemTagsAll)) {
        return false;
      }
      if (!hasAnyTags(entry.itemTags, query.itemTagsAny)) {
        return false;
      }
      if (!hasNoForbiddenTags(entry.itemTags, query.itemTagsNone)) {
        return false;
      }
      if (Array.isArray(query.sourceMobTagsAll) && query.sourceMobTagsAll.length > 0) {
        const sourceMatches = entry.sourceMobs.some((source) => hasAllTags(source.mobTags, query.sourceMobTagsAll));
        if (!sourceMatches) {
          return false;
        }
      }
      if (Array.isArray(query.sourceMobTagsAny) && query.sourceMobTagsAny.length > 0) {
        const sourceMatches = entry.sourceMobs.some((source) => hasAnyTags(source.mobTags, query.sourceMobTagsAny));
        if (!sourceMatches) {
          return false;
        }
      }
      if (Array.isArray(query.sourceMobTagsNone) && query.sourceMobTagsNone.length > 0) {
        const sourceMatches = entry.sourceMobs.some((source) => hasNoForbiddenTags(source.mobTags, query.sourceMobTagsNone));
        if (!sourceMatches) {
          return false;
        }
      }
      if (Number.isFinite(Number(query.maxSpawnRange))) {
        const sourceMatches = entry.sourceMobs.some((source) => Number(source.spawnRangeMin) <= Number(query.maxSpawnRange));
        if (!sourceMatches) {
          return false;
        }
      }
      return true;
    });
  }

  function findRegions(query = {}) {
    return getRegions().filter((entry) => {
      if (!hasAllTags(entry.tags, query.tagsAll)) {
        return false;
      }
      if (!hasAnyTags(entry.tags, query.tagsAny)) {
        return false;
      }
      if (!hasNoForbiddenTags(entry.tags, query.tagsNone)) {
        return false;
      }
      return true;
    });
  }

  function findGatherItems(query = {}) {
    return buildGatherItemCatalog().filter((entry) => {
      if (!hasAllTags(entry.itemTags, query.itemTagsAll)) {
        return false;
      }
      if (!hasAnyTags(entry.itemTags, query.itemTagsAny)) {
        return false;
      }
      if (!hasNoForbiddenTags(entry.itemTags, query.itemTagsNone)) {
        return false;
      }
      if (Array.isArray(query.sourceResourceTagsAll) && query.sourceResourceTagsAll.length > 0) {
        const sourceMatches = entry.sourceResources.some((source) =>
          hasAllTags(source.resourceTags, query.sourceResourceTagsAll)
        );
        if (!sourceMatches) {
          return false;
        }
      }
      if (Array.isArray(query.sourceResourceTagsAny) && query.sourceResourceTagsAny.length > 0) {
        const sourceMatches = entry.sourceResources.some((source) =>
          hasAnyTags(source.resourceTags, query.sourceResourceTagsAny)
        );
        if (!sourceMatches) {
          return false;
        }
      }
      if (Array.isArray(query.sourceResourceTagsNone) && query.sourceResourceTagsNone.length > 0) {
        const sourceMatches = entry.sourceResources.some((source) =>
          hasNoForbiddenTags(source.resourceTags, query.sourceResourceTagsNone)
        );
        if (!sourceMatches) {
          return false;
        }
      }
      const requiredSkillId = normalizeTag(query.sourceSkillId);
      if (requiredSkillId) {
        const sourceMatches = entry.sourceResources.some((source) => normalizeTag(source.skillId) === requiredSkillId);
        if (!sourceMatches) {
          return false;
        }
      }
      if (Number.isFinite(Number(query.maxRequiredLevel))) {
        const sourceMatches = entry.sourceResources.some(
          (source) => Number(source.requiredLevel) <= Number(query.maxRequiredLevel)
        );
        if (!sourceMatches) {
          return false;
        }
      }
      return true;
    });
  }

  function getTownAnchor() {
    return {
      x: Number(townLayout && townLayout.centerTileX) || Math.floor(mapWidth * 0.5),
      y: Number(townLayout && townLayout.centerTileY) || Math.floor(mapHeight * 0.5)
    };
  }

  return {
    loadRegionData,
    getRegions,
    buildMobCatalog,
    buildDropItemCatalog,
    buildGatherItemCatalog,
    buildItemCatalog,
    findMobs,
    findDropItems,
    findGatherItems,
    findRegions,
    getTownAnchor
  };
}

module.exports = { createQuestContentRegistry };
