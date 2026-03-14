const fs = require("fs");

function loadTalentConfigFromDisk(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function createTalentSystem(options = {}) {
  const talentConfig = options.talentConfig || {};
  const classConfig = options.classConfig || {};

  function getTalentTreeForClass(classType) {
    const normalizedType = String(classType || "").trim().toLowerCase();
    const classDef = classConfig instanceof Map
      ? classConfig.get(normalizedType)
      : classConfig[normalizedType];
    if (!classDef || !classDef.talentTree) {
      return null;
    }
    return talentConfig[String(classDef.talentTree).trim().toLowerCase()] || null;
  }

  function getTalentPointsPerLevel(classType) {
    const normalizedType = String(classType || "").trim().toLowerCase();
    const classDef = classConfig instanceof Map
      ? classConfig.get(normalizedType)
      : classConfig[normalizedType];
    if (!classDef) {
      return 1;
    }
    return Math.max(1, Number(classDef.talentPointsPerLevel) || 1);
  }

  function getTalentById(classType, talentId) {
    const talentTree = getTalentTreeForClass(classType);
    if (!talentTree || !Array.isArray(talentTree.talents)) {
      return null;
    }
    const normalizedId = String(talentId || "").trim().toLowerCase();
    return talentTree.talents.find(t => String(t.id || "").trim().toLowerCase() === normalizedId) || null;
  }

  function getAvailableTalents(classType, playerTalents) {
    const talentTree = getTalentTreeForClass(classType);
    if (!talentTree || !Array.isArray(talentTree.talents)) {
      return [];
    }

    const playerTalentMap = new Map();
    if (playerTalents && typeof playerTalents === "object") {
      for (const [talentId, rank] of Object.entries(playerTalents)) {
        playerTalentMap.set(String(talentId).trim().toLowerCase(), Math.max(0, Number(rank) || 0));
      }
    }

    const available = [];
    for (const talent of talentTree.talents) {
      const talentId = String(talent.id || "").trim().toLowerCase();
      const currentRank = playerTalentMap.get(talentId) || 0;
      const maxRank = Math.max(1, Number(talent.maxRank) || 1);

      if (currentRank >= maxRank) {
        continue;
      }

      let prerequisitesMet = true;
      const prerequisites = Array.isArray(talent.prerequisites) ? talent.prerequisites : [];
      for (const prereq of prerequisites) {
        const prereqId = String(prereq.talentId || "").trim().toLowerCase();
        const minRank = Math.max(0, Number(prereq.minRank) || 0);
        const prereqRank = playerTalentMap.get(prereqId) || 0;
        if (prereqRank < minRank) {
          prerequisitesMet = false;
          break;
        }
      }

      if (prerequisitesMet) {
        available.push({
          ...talent,
          currentRank,
          maxRank,
          canUpgrade: true
        });
      }
    }

    return available;
  }

  function canSpendTalentPoint(classType, playerTalents, talentId) {
    const talent = getTalentById(classType, talentId);
    if (!talent) {
      return { canSpend: false, reason: "Talent not found" };
    }

    const playerTalentMap = new Map();
    if (playerTalents && typeof playerTalents === "object") {
      for (const [tid, rank] of Object.entries(playerTalents)) {
        playerTalentMap.set(String(tid).trim().toLowerCase(), Math.max(0, Number(rank) || 0));
      }
    }

    const normalizedTalentId = String(talentId).trim().toLowerCase();
    const currentRank = playerTalentMap.get(normalizedTalentId) || 0;
    const maxRank = Math.max(1, Number(talent.maxRank) || 1);

    if (currentRank >= maxRank) {
      return { canSpend: false, reason: "Talent already at max rank" };
    }

    const prerequisites = Array.isArray(talent.prerequisites) ? talent.prerequisites : [];
    for (const prereq of prerequisites) {
      const prereqId = String(prereq.talentId || "").trim().toLowerCase();
      const minRank = Math.max(0, Number(prereq.minRank) || 0);
      const prereqRank = playerTalentMap.get(prereqId) || 0;
      if (prereqRank < minRank) {
        return { canSpend: false, reason: `Prerequisite ${prereq.talentId} requires rank ${minRank}` };
      }
    }

    return { canSpend: true, reason: "" };
  }

  function spendTalentPoint(classType, playerTalents, talentId) {
    const validation = canSpendTalentPoint(classType, playerTalents, talentId);
    if (!validation.canSpend) {
      return { success: false, reason: validation.reason, playerTalents };
    }

    const newTalents = { ...(playerTalents || {}) };
    const normalizedTalentId = String(talentId).trim().toLowerCase();
    newTalents[normalizedTalentId] = (Number(newTalents[normalizedTalentId]) || 0) + 1;

    return { success: true, reason: "", playerTalents: newTalents };
  }

  function calculateTalentStats(classType, playerTalents) {
    const stats = {};
    const talentTree = getTalentTreeForClass(classType);
    if (!talentTree || !Array.isArray(talentTree.talents) || !playerTalents) {
      return stats;
    }

    function getOrCreateAbilityMods() {
      if (!stats.abilityMods || typeof stats.abilityMods !== "object") {
        stats.abilityMods = {
          cooldownReductionMs: {},
          rangeBonus: {},
          damageBonusPercent: {},
          stunDurationBonusMs: {},
          statBonus: {},
          healingReductionPercent: {},
          crowdControlImmunityMs: {}
        };
      }
      return stats.abilityMods;
    }

    function addAbilityMapNumber(mods, key, abilityId, delta) {
      if (!mods || typeof mods !== "object") {
        return;
      }
      const bucket = mods[key] && typeof mods[key] === "object" ? mods[key] : null;
      if (!bucket) {
        return;
      }
      const id = String(abilityId || "").trim();
      const value = Number(delta) || 0;
      if (!id || !Number.isFinite(value) || value === 0) {
        return;
      }
      bucket[id] = (Number(bucket[id]) || 0) + value;
    }

    function addAbilityStatBonus(mods, abilityId, statKey, delta) {
      if (!mods || typeof mods !== "object") {
        return;
      }
      const id = String(abilityId || "").trim();
      const key = String(statKey || "").trim();
      const value = Number(delta) || 0;
      if (!id || !key || !Number.isFinite(value) || value === 0) {
        return;
      }
      if (!mods.statBonus || typeof mods.statBonus !== "object") {
        mods.statBonus = {};
      }
      if (!mods.statBonus[id] || typeof mods.statBonus[id] !== "object") {
        mods.statBonus[id] = {};
      }
      mods.statBonus[id][key] = (Number(mods.statBonus[id][key]) || 0) + value;
    }

    for (const [talentId, rank] of Object.entries(playerTalents)) {
      const talentRank = Math.max(0, Number(rank) || 0);
      if (talentRank <= 0) {
        continue;
      }

      const talent = getTalentById(classType, talentId);
      if (!talent || !Array.isArray(talent.effects)) {
        continue;
      }

      for (const effect of talent.effects) {
        // Handle direct stat bonuses
        if (effect.stat) {
          const statKey = String(effect.stat);
          const valuePerRank = Number(effect.value) || 0;
          const totalValue = valuePerRank * talentRank;

          if (statKey.endsWith(".percent")) {
            stats[statKey] = (Number(stats[statKey]) || 0) + totalValue;
          } else {
            stats[statKey] = (Number(stats[statKey]) || 0) + totalValue;
          }
        }

        // Handle ability modifiers (cooldown, range, damage, etc.). Values are generally specified per rank.
        if (effect.abilityCooldownReduction && typeof effect.abilityCooldownReduction === "object") {
          const mods = getOrCreateAbilityMods();
          for (const [abilityId, valuePerRank] of Object.entries(effect.abilityCooldownReduction)) {
            addAbilityMapNumber(mods, "cooldownReductionMs", abilityId, (Number(valuePerRank) || 0) * 1000 * talentRank);
          }
        }

        if (effect.abilityRangeBonus && typeof effect.abilityRangeBonus === "object") {
          const mods = getOrCreateAbilityMods();
          for (const [abilityId, valuePerRank] of Object.entries(effect.abilityRangeBonus)) {
            addAbilityMapNumber(mods, "rangeBonus", abilityId, (Number(valuePerRank) || 0) * talentRank);
          }
        }

        if (effect.abilityDamageBonus && typeof effect.abilityDamageBonus === "object") {
          const mods = getOrCreateAbilityMods();
          for (const [abilityId, valuePerRank] of Object.entries(effect.abilityDamageBonus)) {
            addAbilityMapNumber(mods, "damageBonusPercent", abilityId, (Number(valuePerRank) || 0) * talentRank);
          }
        }

        if (effect.abilityStunDurationBonus && typeof effect.abilityStunDurationBonus === "object") {
          const mods = getOrCreateAbilityMods();
          for (const [abilityId, valuePerRank] of Object.entries(effect.abilityStunDurationBonus)) {
            addAbilityMapNumber(mods, "stunDurationBonusMs", abilityId, (Number(valuePerRank) || 0) * 1000 * talentRank);
          }
        }

        if (effect.abilityStatBonus && typeof effect.abilityStatBonus === "object") {
          const mods = getOrCreateAbilityMods();
          for (const [abilityId, statMap] of Object.entries(effect.abilityStatBonus)) {
            if (!statMap || typeof statMap !== "object") {
              continue;
            }
            for (const [statKey, valuePerRank] of Object.entries(statMap)) {
              addAbilityStatBonus(mods, abilityId, statKey, (Number(valuePerRank) || 0) * talentRank);
            }
          }
        }

        if (effect.abilityHealingReduction && typeof effect.abilityHealingReduction === "object") {
          const mods = getOrCreateAbilityMods();
          for (const [abilityId, valuePerRank] of Object.entries(effect.abilityHealingReduction)) {
            addAbilityMapNumber(mods, "healingReductionPercent", abilityId, (Number(valuePerRank) || 0) * talentRank);
          }
        }

        if (effect.abilityCrowdControlImmunity && typeof effect.abilityCrowdControlImmunity === "object") {
          const mods = getOrCreateAbilityMods();
          for (const [abilityId, valuePerRank] of Object.entries(effect.abilityCrowdControlImmunity)) {
            addAbilityMapNumber(mods, "crowdControlImmunityMs", abilityId, (Number(valuePerRank) || 0) * 1000 * talentRank);
          }
        }

        // Handle conditional stat bonuses (e.g., damage reduction when HP < 30%)
        if (effect.conditionalStat && effect.conditionalStat.condition) {
          const condition = effect.conditionalStat.condition;
          const statKey = String(effect.conditionalStat.stat);
          const valuePerRank = Number(effect.conditionalStat.value) || 0;
          const totalValue = valuePerRank * talentRank;

          if (condition === "hpBelow30Percent") {
            stats["conditionalDamageReductionPercent"] = (Number(stats["conditionalDamageReductionPercent"]) || 0) + totalValue;
          }
        }

        // Handle on-damage-dealt effects (e.g., attack power stacks)
        if (effect.onDamageDealt) {
          const statKey = String(effect.onDamageDealt.stat);
          const valuePerRank = Number(effect.onDamageDealt.value) || 0;
          const totalValue = valuePerRank * talentRank;
          const maxStacks = Math.max(1, Number(effect.onDamageDealt.maxStacks) || 1);
          stats[`${statKey}.onDamageDealt`] = { value: totalValue, maxStacks };
        }
      }
    }

    return stats;
  }

  function getTotalTalentPoints(classType, playerLevel) {
    const pointsPerLevel = getTalentPointsPerLevel(classType);
    const maxLevel = 60;
    const effectiveLevel = Math.max(1, Math.min(maxLevel, Number(playerLevel) || 1));
    return (effectiveLevel - 1) * pointsPerLevel;
  }

  function getSpentTalentPoints(playerTalents) {
    if (!playerTalents || typeof playerTalents !== "object") {
      return 0;
    }
    let total = 0;
    for (const rank of Object.values(playerTalents)) {
      total += Math.max(0, Number(rank) || 0);
    }
    return total;
  }

  function getAvailableTalentPoints(classType, playerLevel, playerTalents) {
    const totalPoints = getTotalTalentPoints(classType, playerLevel);
    const spentPoints = getSpentTalentPoints(playerTalents);
    return Math.max(0, totalPoints - spentPoints);
  }

  function getTalentEffects(classType, playerTalents) {
    const effects = [];
    const talentTree = getTalentTreeForClass(classType);
    if (!talentTree || !Array.isArray(talentTree.talents) || !playerTalents) {
      return effects;
    }

    for (const [talentId, rank] of Object.entries(playerTalents)) {
      const talentRank = Math.max(0, Number(rank) || 0);
      if (talentRank <= 0) continue;

      const talent = getTalentById(classType, talentId);
      if (!talent || !Array.isArray(talent.effects)) continue;

      for (const effect of talent.effects) {
        if (effect.onSpellHit || effect.onKill || effect.onDamageDealt) {
          effects.push({ ...effect, rank: talentRank });
        }
      }
    }

    return effects;
  }

  return {
    getTalentTreeForClass,
    getTalentPointsPerLevel,
    getTalentById,
    getAvailableTalents,
    canSpendTalentPoint,
    spendTalentPoint,
    calculateTalentStats,
    getTotalTalentPoints,
    getSpentTalentPoints,
    getAvailableTalentPoints,
    getTalentEffects
  };
}

module.exports = {
  loadTalentConfigFromDisk,
  createTalentSystem
};
