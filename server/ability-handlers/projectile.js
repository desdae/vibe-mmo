function executeProjectileAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, now, ctx }) {
  const normalized =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
  if (!normalized) {
    return false;
  }

  const speed = Math.max(0.1, Number(abilityDef.speed) || 1);
  const range = Math.max(0.25, ctx.getAbilityRangeForLevel(abilityDef, abilityLevel) || 6);
  const ttlMs = Math.max(120, Math.round((range / speed) * 1000));
  const [damageMin, damageMax] = ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  const projectileCount = ctx.clamp(Math.floor(Number(abilityDef.projectileCount) || 1), 1, 12);
  const spreadDeg =
    Number(abilityDef.spreadDeg) > 0
      ? Number(abilityDef.spreadDeg)
      : projectileCount > 1
        ? 16
        : 0;
  const spreadTotalRad = (spreadDeg * Math.PI) / 180;
  const baseHomingRange = Math.max(0, Number(abilityDef.homingRange) || 0);
  const baseHomingTurnRate = Math.max(0, Number(abilityDef.homingTurnRate) || 0);

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = normalized;
  for (let i = 0; i < projectileCount; i += 1) {
    const ratio = projectileCount <= 1 ? 0.5 : i / (projectileCount - 1);
    const angleOffset = projectileCount <= 1 ? 0 : (ratio - 0.5) * spreadTotalRad;
    const dir = projectileCount <= 1 ? normalized : ctx.rotateDirection(normalized, angleOffset);
    const startOffset = 0.9 + i * 0.04;
    const projectile = {
      id: String(ctx.allocateProjectileId()),
      ownerId: player.id,
      x: player.x + dir.dx * startOffset,
      y: player.y + dir.dy * startOffset,
      dx: dir.dx,
      dy: dir.dy,
      speed,
      ttlMs,
      createdAt: now,
      damageMin,
      damageMax,
      hitRadius: ctx.clamp(Number(abilityDef.projectileHitRadius) || ctx.defaultProjectileHitRadius, 0.1, 8),
      explosionRadius: Math.max(0, Number(abilityDef.explosionRadius) || 0),
      explosionDamageMultiplier: ctx.clamp(Number(abilityDef.explosionDamageMultiplier) || 0, 0, 1),
      slowDurationMs: Math.max(0, Number(abilityDef.slowDurationMs) || 0),
      slowMultiplier: ctx.clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1),
      homingRange: baseHomingRange,
      homingTurnRate: baseHomingTurnRate,
      abilityId: abilityDef.id
    };
    ctx.projectiles.set(projectile.id, projectile);
  }
  return true;
}

module.exports = executeProjectileAbility;

