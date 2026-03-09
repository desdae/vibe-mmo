function executeTeleportAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, targetDistance, now, ctx }) {
  const blinkDir =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
  if (!blinkDir) {
    return false;
  }

  const castRange = Math.max(0.25, ctx.getAbilityRangeForLevel(abilityDef, abilityLevel) || 0);
  if (castRange <= 0) {
    return false;
  }
  const requestedDistance = Number.isFinite(Number(targetDistance)) ? Number(targetDistance) : castRange;
  const blinkDistance = ctx.clamp(requestedDistance, 0, castRange);
  if (blinkDistance <= 0.001) {
    return false;
  }

  const originX = player.x;
  const originY = player.y;

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = blinkDir;
  player.x = ctx.clamp(player.x + blinkDir.dx * blinkDistance, 0, ctx.mapWidth - 1);
  player.y = ctx.clamp(player.y + blinkDir.dy * blinkDistance, 0, ctx.mapHeight - 1);
  ctx.resolvePlayerMobCollisions(player);

  const invulnerabilityMs = ctx.getAbilityInvulnerabilityDurationMs(abilityDef);
  if (invulnerabilityMs > 0) {
    player.invulnerableUntil = Math.max(Number(player.invulnerableUntil) || 0, now + invulnerabilityMs);
  }

  ctx.queueExplosionEvent(originX, originY, 0.45, abilityDef.id);
  ctx.queueExplosionEvent(player.x, player.y, 0.55, abilityDef.id);
  return true;
}

module.exports = executeTeleportAbility;

