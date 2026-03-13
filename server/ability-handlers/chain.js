function selectInitialChainTarget(player, abilityDef, castRange, targetDx, targetDy, targetDistance, ctx) {
  const targetDir =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection.dx, player.lastDirection.dy) ||
    { dx: 0, dy: -1 };
  const requestedDistance = Number.isFinite(Number(targetDistance)) ? Math.max(0, Number(targetDistance)) : castRange;
  const aimDistance = castRange > 0 ? ctx.clamp(requestedDistance, 0, castRange) : 0;
  const aimPoint = {
    x: player.x + targetDir.dx * aimDistance,
    y: player.y + targetDir.dy * aimDistance
  };

  let bestMob = null;
  let bestScore = Infinity;
  for (const mob of ctx.mobs.values()) {
    if (!mob || !mob.alive) {
      continue;
    }
    const relX = mob.x - player.x;
    const relY = mob.y - player.y;
    const distToCaster = Math.hypot(relX, relY);
    if (distToCaster <= 0 || distToCaster > castRange) {
      continue;
    }
    const dirToMob = ctx.normalizeDirection(relX, relY);
    if (!dirToMob) {
      continue;
    }
    const facingDot = targetDir.dx * dirToMob.dx + targetDir.dy * dirToMob.dy;
    if (facingDot < 0.15) {
      continue;
    }
    const distToAim = Math.hypot(mob.x - aimPoint.x, mob.y - aimPoint.y);
    const perpendicular = Math.abs(relX * targetDir.dy - relY * targetDir.dx);
    const score = distToAim * 1.5 + perpendicular * 0.85 + (1 - facingDot) * 4 + distToCaster * 0.1;
    if (score < bestScore) {
      bestScore = score;
      bestMob = mob;
    }
  }
  return {
    targetDir,
    mob: bestMob
  };
}

function findNextChainTarget(fromMob, excludedIds, jumpRange, ctx) {
  let bestMob = null;
  let bestDistance = Infinity;
  for (const mob of ctx.mobs.values()) {
    if (!mob || !mob.alive || excludedIds.has(String(mob.id))) {
      continue;
    }
    const dist = Math.hypot(mob.x - fromMob.x, mob.y - fromMob.y);
    if (dist <= 0 || dist > jumpRange || dist >= bestDistance) {
      continue;
    }
    bestDistance = dist;
    bestMob = mob;
  }
  return bestMob;
}

function executeChainAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, targetDistance, now, ctx }) {
  const abilityDefForEntity =
    typeof ctx.getAbilityDefForEntity === "function" ? ctx.getAbilityDefForEntity(player, abilityDef, abilityLevel) : abilityDef;
  const castRange = Math.max(
    0.25,
    (typeof ctx.getAbilityRangeForEntity === "function"
      ? ctx.getAbilityRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityRangeForLevel(abilityDef, abilityLevel)) || 0
  );
  if (castRange <= 0) {
    return false;
  }
  const jumpRange = Math.max(0.25, Number(abilityDef.jumpRange) || Math.max(2.5, castRange * 0.55));
  const baseJumpCount = Math.max(0, Math.round(Number(abilityDef.jumpCount) || 0));
  const jumpCountPerLevel = Math.max(0, Number(abilityDef.jumpCountPerLevel) || 0.3333);
  const jumpDamageReductionBase = ctx.clamp(Number(abilityDef.jumpDamageReduction) || 0.2, 0, 0.95);
  const chainStats =
    typeof ctx.getAbilityChainStatsForEntity === "function"
      ? ctx.getAbilityChainStatsForEntity(player, abilityDef, abilityLevel)
      : { jumpCountBonus: 0, jumpDamageReductionPercent: 0 };
  const extraJumpsFromLevel = Math.max(0, Math.round(Math.max(0, abilityLevel - 1) * jumpCountPerLevel));
  const totalJumps = Math.max(0, Math.round(baseJumpCount + extraJumpsFromLevel + (Number(chainStats.jumpCountBonus) || 0)));
  const jumpDamageReduction = ctx.clamp(
    jumpDamageReductionBase - (Math.max(0, Number(chainStats.jumpDamageReductionPercent) || 0) / 100),
    0,
    0.95
  );

  const { targetDir, mob: initialTarget } = selectInitialChainTarget(
    player,
    abilityDef,
    castRange,
    targetDx,
    targetDy,
    targetDistance,
    ctx
  );

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = targetDir;
  if (!initialTarget) {
    return false;
  }

  const [baseDamageMin, baseDamageMax] =
    typeof ctx.getAbilityDamageRangeForEntity === "function"
      ? ctx.getAbilityDamageRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  const beamWidth = Math.max(0.2, Number(abilityDef.beamWidth) || 0.55);
  const beamDurationMs = Math.max(90, Math.floor(Number(abilityDef.durationMs) || 120));
  const hitIds = new Set();
  let currentSource = { x: player.x, y: player.y };
  let currentTarget = initialTarget;
  let damageMultiplier = 1;

  for (let hopIndex = 0; hopIndex <= totalJumps && currentTarget; hopIndex += 1) {
    const fromX = Number(currentSource.x) || 0;
    const fromY = Number(currentSource.y) || 0;
    const dir = ctx.normalizeDirection(currentTarget.x - fromX, currentTarget.y - fromY) || targetDir;
    const segmentLength = Math.max(0.2, Math.hypot(currentTarget.x - fromX, currentTarget.y - fromY));
    const segmentDamageMin = Math.max(1, Math.round(baseDamageMin * damageMultiplier));
    const segmentDamageMax = Math.max(segmentDamageMin, Math.round(baseDamageMax * damageMultiplier));
    ctx.createPersistentBeamEffect(
      player.id,
      abilityDef,
      fromX,
      fromY,
      dir,
      segmentLength,
      beamWidth,
      beamDurationMs,
      0,
      0,
      { damageMode: "instant" },
      now + hopIndex * 22
    );
    const dealt = ctx.applyDamageToMob(currentTarget, ctx.randomInt(segmentDamageMin, segmentDamageMax), player.id);
    ctx.applyAbilityHitEffectsToMob(currentTarget, player.id, abilityDefForEntity || abilityDef, abilityLevel, dealt, now);
    hitIds.add(String(currentTarget.id));
    currentSource = currentTarget;
    damageMultiplier *= 1 - jumpDamageReduction;
    if (damageMultiplier <= 0.05) {
      break;
    }
    currentTarget = findNextChainTarget(currentTarget, hitIds, jumpRange, ctx);
  }

  return true;
}

module.exports = executeChainAbility;
