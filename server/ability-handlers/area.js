function executeAreaAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, targetDistance, now, ctx }) {
  const areaRadius = Math.max(0.2, Number(abilityDef.areaRadius) || Number(abilityDef.range) || 2);
  const [damageMin, damageMax] = ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  const stunDurationMs = Math.max(0, Number(abilityDef.stunDurationMs) || 0);
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
    ctx.applyDamageToMob(mob, ctx.randomInt(damageMin, damageMax), player.id);
    if (mob.alive && stunDurationMs > 0) {
      ctx.stunMob(mob, stunDurationMs, now);
    }
  }

  return true;
}

module.exports = executeAreaAbility;

