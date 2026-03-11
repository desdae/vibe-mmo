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
  const [damageMin, damageMax] =
    typeof ctx.getAbilityDamageRangeForEntity === "function"
      ? ctx.getAbilityDamageRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  const [dotDamageMin, dotDamageMax] =
    typeof ctx.getAbilityDotDamageRangeForEntity === "function"
      ? ctx.getAbilityDotDamageRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityDotDamageRange(abilityDef, abilityLevel);
  const dotDurationMs = Math.max(0, Number(abilityDef.dotDurationMs) || 0);
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
    {
      damageMode: String(abilityDef.damageMode || "instant").trim().toLowerCase() || "instant",
      dotDamageMin,
      dotDamageMax,
      dotDurationMs,
      dotSchool: String(abilityDef.dotSchool || "generic").trim().toLowerCase() || "generic"
    },
    now
  );
  return true;
}

module.exports = executeBeamAbility;
