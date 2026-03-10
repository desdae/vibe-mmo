function executeMeleeConeAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, now, ctx }) {
  const attackDir =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
  if (!attackDir) {
    return false;
  }

  let closestMob = null;
  let closestDistance = Infinity;
  const range = Math.max(0.2, ctx.getAbilityRangeForLevel(abilityDef, abilityLevel) || 1.5);
  const coneCos = ctx.clamp(Number(abilityDef.coneCos) || 0, -1, 1);

  for (const mob of ctx.mobs.values()) {
    if (!mob.alive) {
      continue;
    }

    const toMobX = mob.x - player.x;
    const toMobY = mob.y - player.y;
    const mobDist = Math.hypot(toMobX, toMobY);
    if (mobDist > range || mobDist <= 0) {
      continue;
    }

    const dirToMob = ctx.normalizeDirection(toMobX, toMobY);
    if (!dirToMob) {
      continue;
    }
    const dot = attackDir.dx * dirToMob.dx + attackDir.dy * dirToMob.dy;
    if (dot < coneCos) {
      continue;
    }

    if (mobDist < closestDistance) {
      closestDistance = mobDist;
      closestMob = mob;
    }
  }

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = attackDir;
  player.lastSwingDirection = attackDir;
  player.swingCounter = (player.swingCounter + 1) & 0xff;

  if (!closestMob) {
    return false;
  }

  const [damageMin, damageMax] = ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  const dealt = ctx.applyDamageToMob(closestMob, ctx.randomInt(damageMin, damageMax), player.id);
  ctx.applyAbilityHitEffectsToMob(closestMob, player.id, abilityDef, abilityLevel, dealt, now);
  return true;
}

module.exports = executeMeleeConeAbility;
