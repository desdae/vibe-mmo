function executeBeamAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, now, ctx }) {
  const beamDir =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
  if (!beamDir) {
    return false;
  }
  const beamLength = Math.max(0.25, ctx.getAbilityRangeForLevel(abilityDef, abilityLevel) || 0);
  const beamDurationMs = Math.max(150, Number(abilityDef.durationMs) || 0);
  if (beamLength <= 0 || beamDurationMs <= 0) {
    return false;
  }
  const [damageMin, damageMax] = ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  const beamWidth = Math.max(0.2, Number(abilityDef.beamWidth) || 0.8);

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = beamDir;
  ctx.createPersistentBeamEffect(
    player.id,
    abilityDef,
    player.x,
    player.y,
    beamDir,
    beamLength,
    beamWidth,
    beamDurationMs,
    damageMin,
    damageMax,
    now
  );
  return true;
}

module.exports = executeBeamAbility;

