function executeChargeAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, targetDistance, now, ctx }) {
  const abilityDefForEntity =
    typeof ctx.getAbilityDefForEntity === "function" ? ctx.getAbilityDefForEntity(player, abilityDef, abilityLevel) : abilityDef;
  const chargeDir =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
  if (!chargeDir) {
    return false;
  }

  const castRange =
    typeof ctx.getAbilityRangeForEntity === "function"
      ? ctx.getAbilityRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityRangeForLevel(abilityDef, abilityLevel);
  if (castRange <= 0) {
    return false;
  }

  // Use dash effect properties from ability definition
  const chargeSpeed = Math.max(1, Number(abilityDef.dashSpeed) || 12);
  const impactRadius = Math.max(0.5, Number(abilityDef.dashImpactRadius) || 2);
  
  const [damageMin, damageMax] =
    typeof ctx.getAbilityDamageRangeForEntity === "function"
      ? ctx.getAbilityDamageRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  
  // Use stun duration from ability definition
  const stunDurationMs = Math.max(0, Number(abilityDefForEntity && abilityDefForEntity.stunDurationMs) || 0);

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = chargeDir;

  const originX = player.x;
  const originY = player.y;
  const targetX = ctx.clamp(player.x + chargeDir.dx * castRange, 0, ctx.mapWidth - 1);
  const targetY = ctx.clamp(player.y + chargeDir.dy * castRange, 0, ctx.mapHeight - 1);

  const distance = Math.hypot(targetX - originX, targetY - originY);
  const chargeDurationMs = Math.max(100, Math.round((distance / chargeSpeed) * 1000));

  // Set up cast state for charge - this syncs to client
  player.activeCast = {
    abilityId: abilityDef.id,
    dx: chargeDir.dx,
    dy: chargeDir.dy,
    targetDistance: castRange,
    durationMs: chargeDurationMs,
    startedAt: now,
    endsAt: now + chargeDurationMs,
    chargeStartX: originX,
    chargeStartY: originY,
    chargeTargetX: targetX,
    chargeTargetY: targetY,
    isCharge: true
  };
  player.castStateVersion = (Number(player.castStateVersion) + 1) & 0xffff;
  
  // Store charge impact data
  player.chargeData = {
    abilityDef: abilityDefForEntity || abilityDef,
    abilityLevel: abilityLevel,
    damageMin: damageMin,
    damageMax: damageMax,
    stunDurationMs: stunDurationMs,
    impactRadius: impactRadius,
    hasImpacted: false
  };

  // Queue start explosion effect
  ctx.queueExplosionEvent(originX, originY, 0.3, abilityDef.id);

  return true;
}

module.exports = executeChargeAbility;
