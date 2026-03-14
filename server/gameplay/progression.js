function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createProgressionTools(options = {}) {
  const baseExpToNext = Math.max(1, Number(options.baseExpToNext) || 1);
  const expGrowthFactor = Math.max(1, Number(options.expGrowthFactor) || 1);
  const getExpMultiplier =
    typeof options.getExpMultiplier === "function" ? options.getExpMultiplier : () => Number(options.expMultiplier) || 1;
  const getTalentPointsPerLevel =
    typeof options.getTalentPointsPerLevel === "function" ? options.getTalentPointsPerLevel : () => 1;
  const sendSelfProgress = options.sendSelfProgress;

  if (typeof sendSelfProgress !== "function") {
    throw new Error("createProgressionTools requires sendSelfProgress function");
  }

  function expNeededForLevel(level) {
    return Math.max(1, Math.ceil(baseExpToNext * Math.pow(expGrowthFactor, level - 1)));
  }

  function grantPlayerExp(player, amount) {
    if (!player || amount <= 0) {
      return;
    }
    const expMultiplier = Math.max(0, Number(getExpMultiplier()) || 0);
    const scaledAmount = Math.max(0, Math.floor(Number(amount) * expMultiplier));
    if (scaledAmount <= 0) {
      return;
    }

    const beforeLevel = player.level;
    const beforeExp = player.exp;
    const beforeExpToNext = player.expToNext;
    const beforeSkillPoints = Math.max(0, Math.floor(Number(player.skillPoints) || 0));
    const beforeTalentPoints = Math.max(0, Math.floor(Number(player.talentPoints) || 0));
    let levelsGained = 0;

    player.exp += scaledAmount;
    while (player.exp >= player.expToNext) {
      player.exp -= player.expToNext;
      player.level += 1;
      player.expToNext = expNeededForLevel(player.level);
      levelsGained += 1;
    }
    if (levelsGained > 0) {
      player.skillPoints = clamp(beforeSkillPoints + levelsGained, 0, 65535);
      const pointsPerLevel = getTalentPointsPerLevel(player.classType);
      player.talentPoints = clamp(beforeTalentPoints + levelsGained * pointsPerLevel, 0, 65535);
    }

    if (
      player.level !== beforeLevel ||
      player.exp !== beforeExp ||
      player.expToNext !== beforeExpToNext ||
      Math.floor(Number(player.skillPoints) || 0) !== beforeSkillPoints ||
      Math.floor(Number(player.talentPoints) || 0) !== beforeTalentPoints
    ) {
      sendSelfProgress(player);
    }
  }

  return {
    expNeededForLevel,
    grantPlayerExp
  };
}

module.exports = {
  createProgressionTools
};
