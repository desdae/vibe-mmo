function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createPlayerAbilityTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;
  const getClassDefs = typeof options.getClassDefs === "function" ? options.getClassDefs : () => new Map();
  const getAbilityDefs = typeof options.getAbilityDefs === "function" ? options.getAbilityDefs : () => new Map();

  function getPlayerClassDef(player) {
    if (!player) {
      return null;
    }
    return getClassDefs().get(String(player.classType || "")) || null;
  }

  function getPlayerAbilityLevel(player, abilityId) {
    if (!player || !player.abilityLevels) {
      return 0;
    }
    const level = Number(player.abilityLevels.get(String(abilityId || "")));
    if (!Number.isFinite(level) || level <= 0) {
      return 0;
    }
    return Math.floor(level);
  }

  function levelUpPlayerAbility(player, abilityId) {
    if (!player) {
      return false;
    }
    const resolvedAbilityId = String(abilityId || "").trim();
    if (!resolvedAbilityId || !getAbilityDefs().has(resolvedAbilityId)) {
      return false;
    }
    const classDef = getPlayerClassDef(player);
    if (!classDef || !classDef.abilityLevels || !classDef.abilityLevels.has(resolvedAbilityId)) {
      return false;
    }
    const skillPoints = Math.max(0, Math.floor(Number(player.skillPoints) || 0));
    if (skillPoints <= 0) {
      return false;
    }
    const currentLevel = clamp(getPlayerAbilityLevel(player, resolvedAbilityId), 1, 255);
    if (currentLevel >= 255) {
      return false;
    }
    player.skillPoints = skillPoints - 1;
    player.abilityLevels.set(resolvedAbilityId, currentLevel + 1);
    return true;
  }

  return {
    getPlayerClassDef,
    getPlayerAbilityLevel,
    levelUpPlayerAbility
  };
}

module.exports = {
  createPlayerAbilityTools
};
