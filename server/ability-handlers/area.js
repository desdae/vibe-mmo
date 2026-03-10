function executeAreaAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, targetDistance, now, ctx }) {
  const areaRadius = Math.max(0.2, Number(abilityDef.areaRadius) || Number(abilityDef.range) || 2);
  const [damageMin, damageMax] = ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  const [dotDamageMin, dotDamageMax] = ctx.getAbilityDotDamageRange(abilityDef, abilityLevel);
  const dotDurationMs = Math.max(0, Number(abilityDef.dotDurationMs) || 0);
  const durationMs = Math.max(0, Number(abilityDef.durationMs) || 0);
  const castRange = ctx.getAbilityRangeForLevel(abilityDef, abilityLevel);
  const target = ctx.getAreaAbilityTargetPosition(player, castRange, targetDx, targetDy, targetDistance);
  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = target.targetDir;

  if (durationMs > 0) {
    ctx.createPersistentAreaEffect(
      player.id,
      abilityDef,
      target.x,
      target.y,
      areaRadius,
      durationMs,
      damageMin,
      damageMax,
      {
        dotDamageMin,
        dotDamageMax,
        dotDurationMs,
        dotSchool: String(abilityDef.dotSchool || "generic").trim().toLowerCase() || "generic"
      },
      now
    );
    return true;
  }

  ctx.queueExplosionEvent(target.x, target.y, areaRadius, abilityDef.id);

  for (const mob of ctx.mobs.values()) {
    if (!mob.alive) {
      continue;
    }
    const mobDist = Math.hypot(mob.x - target.x, mob.y - target.y);
    if (mobDist > areaRadius) {
      continue;
    }
    const dealt = ctx.applyDamageToMob(mob, ctx.randomInt(damageMin, damageMax), player.id);
    ctx.applyAbilityHitEffectsToMob(mob, player.id, abilityDef, abilityLevel, dealt, now);
  }

  return true;
}

module.exports = executeAreaAbility;
