function executeSelfBuffAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, now, ctx }) {
  const aimDirection =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection && player.lastDirection.dx, player.lastDirection && player.lastDirection.dy);

  const abilityDefForEntity =
    typeof ctx.getAbilityDefForEntity === "function" ? ctx.getAbilityDefForEntity(player, abilityDef, abilityLevel) : abilityDef;

  ctx.markAbilityUsed(player, abilityDef, now);
  if (aimDirection) {
    player.lastDirection = aimDirection;
  }
  if (typeof ctx.applySelfBuffs === "function") {
    ctx.applySelfBuffs(player, abilityDefForEntity || abilityDef, now);
  }
  return true;
}

module.exports = executeSelfBuffAbility;
