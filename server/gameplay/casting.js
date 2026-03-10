function createCastingTools(options = {}) {
  const getAbilityCooldownMsForLevel =
    typeof options.getAbilityCooldownMsForLevel === "function" ? options.getAbilityCooldownMsForLevel : () => 0;

  function getAbilityCooldownPassed(player, abilityDef, level, now) {
    const lastUsed = Number(player.abilityLastUsedAt.get(abilityDef.id) || 0);
    return now - lastUsed >= getAbilityCooldownMsForLevel(abilityDef, level);
  }

  function markAbilityUsed(player, abilityDef, now) {
    player.abilityLastUsedAt.set(abilityDef.id, now);
  }

  function playerHasMovementInput(player) {
    if (!player || !player.input) {
      return false;
    }
    return Math.abs(Number(player.input.dx) || 0) > 1e-6 || Math.abs(Number(player.input.dy) || 0) > 1e-6;
  }

  function clearPlayerCast(player) {
    if (!player || !player.activeCast) {
      return false;
    }
    player.activeCast = null;
    player.castStateVersion = (Number(player.castStateVersion) + 1) & 0xffff;
    return true;
  }

  function clearMobCast(mob) {
    if (!mob || !mob.activeCast) {
      return false;
    }
    mob.activeCast = null;
    mob.castStateVersion = (Number(mob.castStateVersion) + 1) & 0xffff;
    return true;
  }

  return {
    getAbilityCooldownPassed,
    markAbilityUsed,
    playerHasMovementInput,
    clearPlayerCast,
    clearMobCast
  };
}

module.exports = {
  createCastingTools
};
