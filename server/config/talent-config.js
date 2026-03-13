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
    const classDef = classConfig[String(classType || "").trim().toLowerCase()];
    if (!classDef || !classDef.talentTree) {
      return null;
    }
    return talentConfig[String(classDef.talentTree).trim().toLowerCase()] || null;
  }
  
  function getTalentPointsPerLevel(classType) {
    const classDef = classConfig[String(classType || "").trim().toLowerCase()];
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
    getAvailableTalentPoints
  };
}

module.exports = {
  loadTalentConfigFromDisk,
  createTalentSystem
};
