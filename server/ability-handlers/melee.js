function normalizeAngle(angle) {
  const tau = Math.PI * 2;
  let normalized = Number(angle) || 0;
  while (normalized <= -Math.PI) {
    normalized += tau;
  }
  while (normalized > Math.PI) {
    normalized -= tau;
  }
  return normalized;
}

function getShortestAngleDelta(fromAngle, toAngle) {
  return normalizeAngle((Number(toAngle) || 0) - (Number(fromAngle) || 0));
}

function getCircularMidpointAngle(angleA, angleB) {
  return normalizeAngle((Number(angleA) || 0) + getShortestAngleDelta(angleA, angleB) * 0.5);
}

function executeMeleeConeAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, now, ctx }) {
  const requestedDir =
    ctx.normalizeDirection(targetDx, targetDy) ||
    ctx.normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
  if (!requestedDir) {
    return false;
  }
  const abilityDefForEntity =
    typeof ctx.getAbilityDefForEntity === "function" ? ctx.getAbilityDefForEntity(player, abilityDef, abilityLevel) : abilityDef;
  const range = Math.max(
    0.2,
    (typeof ctx.getAbilityRangeForEntity === "function"
      ? ctx.getAbilityRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityRangeForLevel(abilityDef, abilityLevel)) || 1.5
  );
  const coneCos = ctx.clamp(Number(abilityDef.coneCos) || 0, -1, 1);
  const candidateMobs = [];

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

    candidateMobs.push({
      mob,
      distance: mobDist,
      dir: dirToMob,
      angle: Math.atan2(dirToMob.dy, dirToMob.dx)
    });
  }

  if (!candidateMobs.length) {
    ctx.markAbilityUsed(player, abilityDef, now);
    player.lastDirection = requestedDir;
    player.lastSwingDirection = requestedDir;
    player.swingCounter = (player.swingCounter + 1) & 0xff;
    return true;
  }

  const candidateAngles = [];
  if (requestedDir) {
    candidateAngles.push(Math.atan2(requestedDir.dy, requestedDir.dx));
  }
  for (const candidate of candidateMobs) {
    candidateAngles.push(candidate.angle);
  }
  for (let i = 0; i < candidateMobs.length; i += 1) {
    for (let j = i + 1; j < candidateMobs.length; j += 1) {
      candidateAngles.push(getCircularMidpointAngle(candidateMobs[i].angle, candidateMobs[j].angle));
    }
  }

  let bestAttackDir = requestedDir || candidateMobs[0].dir;
  let bestHits = [];
  let bestCount = -1;
  let bestNearestDistance = Infinity;
  let bestAlignment = -Infinity;
  let bestTotalDot = -Infinity;

  for (const angle of candidateAngles) {
    const candidateDir = {
      dx: Math.cos(angle),
      dy: Math.sin(angle)
    };
    const hits = [];
    let nearestDistance = Infinity;
    let totalDot = 0;

    for (const candidate of candidateMobs) {
      const dot = candidateDir.dx * candidate.dir.dx + candidateDir.dy * candidate.dir.dy;
      if (dot < coneCos) {
        continue;
      }
      hits.push(candidate);
      totalDot += dot;
      if (candidate.distance < nearestDistance) {
        nearestDistance = candidate.distance;
      }
    }

    if (!hits.length) {
      continue;
    }

    const hitCount = hits.length;
    const alignment = requestedDir
      ? candidateDir.dx * requestedDir.dx + candidateDir.dy * requestedDir.dy
      : 0;
    const isBetter =
      hitCount > bestCount ||
      (hitCount === bestCount && nearestDistance < bestNearestDistance - 1e-6) ||
      (hitCount === bestCount &&
        Math.abs(nearestDistance - bestNearestDistance) <= 1e-6 &&
        alignment > bestAlignment + 1e-6) ||
      (hitCount === bestCount &&
        Math.abs(nearestDistance - bestNearestDistance) <= 1e-6 &&
        Math.abs(alignment - bestAlignment) <= 1e-6 &&
        totalDot > bestTotalDot + 1e-6);
    if (!isBetter) {
      continue;
    }

    bestAttackDir = candidateDir;
    bestHits = hits;
    bestCount = hitCount;
    bestNearestDistance = nearestDistance;
    bestAlignment = alignment;
    bestTotalDot = totalDot;
  }

  if (!bestHits.length || !bestAttackDir) {
    return false;
  }

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = bestAttackDir;
  player.lastSwingDirection = bestAttackDir;
  player.swingCounter = (player.swingCounter + 1) & 0xff;

  const [damageMin, damageMax] =
    typeof ctx.getAbilityDamageRangeForEntity === "function"
      ? ctx.getAbilityDamageRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityDamageRange(abilityDef, abilityLevel);
  for (const hit of bestHits) {
    const dealt = ctx.applyDamageToMob(hit.mob, ctx.randomInt(damageMin, damageMax), player.id);
    ctx.applyAbilityHitEffectsToMob(hit.mob, player.id, abilityDefForEntity || abilityDef, abilityLevel, dealt, now);
  }
  return true;
}

module.exports = executeMeleeConeAbility;
