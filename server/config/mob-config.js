const fs = require("fs");
const { clamp, parseNumericRange } = require("../gameplay/number-utils");
const { parseMobDropRules } = require("./drop-config");
const { parseMobRenderStyle } = require("../gameplay/mob-render-style");
const { parseMobCombatConfig } = require("../gameplay/mob-combat-config");

function loadMobConfigFromDisk(configPath, itemDefs, abilityDefs, mapSize, serverConfig, combatDefaults) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const maxMapRadius = Math.hypot(mapSize.width / 2, mapSize.height / 2);
  const healthMultiplier = serverConfig.mobHealthMultiplier;
  const damageMultiplier = serverConfig.mobDamageMultiplier;
  const respawnMultiplier = serverConfig.mobRespawnMultiplier;

  const mobDefs = new Map();
  function normalizeTags(values) {
    return Array.isArray(values)
      ? values.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
      : [];
  }

  for (const mobEntry of Array.isArray(parsed.mobs) ? parsed.mobs : []) {
    const name = String(mobEntry?.name || "").trim();
    if (!name) {
      continue;
    }

    const health = clamp(Math.round((Number(mobEntry.health) || 1) * healthMultiplier), 1, 65535);
    const [damageMinRaw, damageMaxRaw] = parseNumericRange(mobEntry.damage, 1, 1);
    const damageMin = clamp(Math.round(damageMinRaw * damageMultiplier), 0, 65535);
    const damageMax = clamp(Math.round(damageMaxRaw * damageMultiplier), damageMin, 65535);
    const baseSpeed = clamp(Number(mobEntry.speed) || 0.5, 0.05, 20);
    const [respawnMinRaw, respawnMaxRaw] = parseNumericRange(mobEntry.respawnTime, 30, 30);
    const respawnMinMs = Math.max(1000, Math.round(respawnMinRaw * 1000 * respawnMultiplier));
    const respawnMaxMs = Math.max(respawnMinMs, Math.round(respawnMaxRaw * 1000 * respawnMultiplier));
    const dropRules = parseMobDropRules(mobEntry.drops, itemDefs);
    const renderStyle = parseMobRenderStyle(mobEntry.renderStyle);
    const combat = parseMobCombatConfig(mobEntry.combat, abilityDefs, damageMin, damageMax, combatDefaults);
    const tags = normalizeTags(mobEntry.tags);
    const skillRewards = Array.isArray(mobEntry.skillRewards)
      ? mobEntry.skillRewards
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }
            const skillId = String(entry.skillId || entry.id || "").trim().toLowerCase();
            const xp = Math.max(0, Math.floor(Number(entry.xp) || 0));
            if (!skillId || xp <= 0) {
              return null;
            }
            return { skillId, xp };
          })
          .filter(Boolean)
      : [];

    mobDefs.set(name, {
      name,
      health,
      damageMin,
      damageMax,
      baseSpeed,
      respawnMinMs,
      respawnMaxMs,
      tags,
      dropRules,
      renderStyle,
      combat,
      skillRewards
    });
  }

  if (!mobDefs.size) {
    throw new Error(`No valid mob definitions in ${configPath}`);
  }

  const clusterDefs = [];
  for (const clusterEntry of Array.isArray(parsed.mobClusters) ? parsed.mobClusters : []) {
    const name = String(clusterEntry?.name || "").trim() || `cluster_${clusterDefs.length + 1}`;
    const memberMobNames = Array.isArray(clusterEntry?.mobs) ? clusterEntry.mobs : [];
    const members = memberMobNames.map((mobName) => mobDefs.get(String(mobName))).filter(Boolean);
    if (!members.length) {
      continue;
    }

    const maxSize = clamp(Math.round(Number(clusterEntry.maxSize) || 1), 1, 16);

    const rawSpawnRanges = Array.isArray(clusterEntry.spawnRanges)
      ? clusterEntry.spawnRanges
      : Array.isArray(clusterEntry.spawnBands)
        ? clusterEntry.spawnBands
        : [];
    const fallbackLegacyRange = parseNumericRange(clusterEntry.spawnRange, 0, maxMapRadius);
    const fallbackLegacyChance = Math.max(0, Number(clusterEntry.spawnChance) || 0);
    const spawnBandEntries = rawSpawnRanges.length
      ? rawSpawnRanges
      : fallbackLegacyChance > 0
        ? [
            {
              range: fallbackLegacyRange,
              chance: fallbackLegacyChance,
              curve: clusterEntry.spawnCurve || "linear"
            }
          ]
        : [];

    const spawnBands = [];
    for (const bandEntry of spawnBandEntries) {
      if (!bandEntry || typeof bandEntry !== "object") {
        continue;
      }
      const [rangeMinRaw, rangeMaxRaw] = parseNumericRange(
        bandEntry.range || [bandEntry.from, bandEntry.to],
        0,
        maxMapRadius
      );
      const rangeMin = clamp(Math.min(rangeMinRaw, rangeMaxRaw), 0, maxMapRadius);
      const rangeMax = clamp(Math.max(rangeMinRaw, rangeMaxRaw), rangeMin, maxMapRadius);
      const chance = Math.max(
        0,
        Number(bandEntry.chance ?? bandEntry.spawnChance ?? bandEntry.weight ?? 0) || 0
      );
      if (chance <= 0) {
        continue;
      }
      const curve = String(bandEntry.curve || "linear").trim().toLowerCase() || "linear";
      spawnBands.push({
        rangeMin,
        rangeMax,
        chance,
        curve
      });
    }

    if (!spawnBands.length) {
      continue;
    }

    const spawnRangeMin = Math.min(...spawnBands.map((band) => band.rangeMin));
    const spawnRangeMax = Math.max(...spawnBands.map((band) => band.rangeMax));
    const totalSpawnChance = spawnBands.reduce((sum, band) => sum + band.chance, 0);
    const biomeTagsAny = normalizeTags(clusterEntry.biomeTagsAny);
    const bandTagsAny = normalizeTags(clusterEntry.bandTagsAny);
    const sectorTagsAny = normalizeTags(clusterEntry.sectorTagsAny);

    clusterDefs.push({
      name,
      members,
      spawnBands,
      totalSpawnChance,
      maxSize,
      spawnRangeMin,
      spawnRangeMax,
      biomeTagsAny,
      bandTagsAny,
      sectorTagsAny
    });
  }

  if (!clusterDefs.length) {
    throw new Error(`No valid mob cluster definitions in ${configPath}`);
  }

  const totalSpawnChance = clusterDefs.reduce((sum, cluster) => sum + cluster.totalSpawnChance, 0);
  const configMaxSpawnRadius = clusterDefs.length
    ? Math.max(...clusterDefs.map((cluster) => cluster.spawnRangeMax))
    : maxMapRadius;

  return {
    mobDefs,
    clusterDefs,
    totalSpawnChance,
    maxSpawnRadius: clamp(configMaxSpawnRadius, 1, maxMapRadius)
  };
}

module.exports = {
  loadMobConfigFromDisk
};
