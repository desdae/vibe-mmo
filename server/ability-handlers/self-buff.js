function executeSelfBuffAbility({ player, abilityDef, targetDx, targetDy, now, ctx }) {
  const aimDirection =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection && player.lastDirection.dx, player.lastDirection && player.lastDirection.dy);

  ctx.markAbilityUsed(player, abilityDef, now);
  if (aimDirection) {
    player.lastDirection = aimDirection;
  }
  if (typeof ctx.applySelfBuffs === "function") {
    ctx.applySelfBuffs(player, abilityDef, now);
  }
  return true;
}

module.exports = executeSelfBuffAbility;
