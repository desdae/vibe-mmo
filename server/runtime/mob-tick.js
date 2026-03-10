function createMobTickSystem({
  mobs,
  players,
  tickMs,
  mobWanderRadius,
  mobProvokedLeashRadius,
  mobAggroRange,
  mobAttackRange,
  mobMinSeparation,
  mobSeparationIterations,
  randomInt,
  randomPointInRadius,
  distance,
  normalizeDirection,
  clampToSpawnRadius,
  respawnMob,
  tickMobDotEffects,
  clearMobCast,
  completeMobAbilityCast,
  getMobMoveSpeed,
  getMobDistanceFromSpawn,
  hasActiveProvokedChase,
  startMobReturnToSpawn,
  getMobCombatProfile,
  getNearestAggroPlayer,
  tryMobCastConfiguredAbility,
  tryMobBasicAttack,
  getMobLeashRadius,
  resolveAllPlayersAgainstMobs
}) {
  function resolveMobOverlaps(now = Date.now()) {
    const aliveMobs = [];
    for (const mob of mobs.values()) {
      if (mob.alive) {
        aliveMobs.push(mob);
      }
    }

    for (let iter = 0; iter < mobSeparationIterations; iter += 1) {
      for (let i = 0; i < aliveMobs.length; i += 1) {
        for (let j = i + 1; j < aliveMobs.length; j += 1) {
          const a = aliveMobs[i];
          const b = aliveMobs[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);

          if (dist >= mobMinSeparation) {
            continue;
          }

          if (dist < 0.0001) {
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            dist = 1;
          }

          const overlap = (mobMinSeparation - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;

          const nextA = clampToSpawnRadius(
            a.x - nx * overlap,
            a.y - ny * overlap,
            a.spawnX,
            a.spawnY,
            getMobLeashRadius(a, now)
          );
          const nextB = clampToSpawnRadius(
            b.x + nx * overlap,
            b.y + ny * overlap,
            b.spawnX,
            b.spawnY,
            getMobLeashRadius(b, now)
          );

          a.x = nextA.x;
          a.y = nextA.y;
          b.x = nextB.x;
          b.y = nextB.y;
        }
      }
    }
  }

  function tickMobs() {
    const now = Date.now();
    const dt = tickMs / 1000;

    for (const mob of mobs.values()) {
      if (!mob.alive) {
        if (now >= mob.respawnAt) {
          respawnMob(mob);
        }
        continue;
      }

      tickMobDotEffects(mob, now);
      if (!mob.alive) {
        continue;
      }

      if (mob.activeCast) {
        if ((Number(mob.stunnedUntil) || 0) > now) {
          clearMobCast(mob);
          continue;
        }
        if (now >= (Number(mob.activeCast.endsAt) || 0)) {
          completeMobAbilityCast(mob, now);
          continue;
        }
        continue;
      }

      if ((Number(mob.stunnedUntil) || 0) > now) {
        continue;
      }

      const mobSpeed = getMobMoveSpeed(mob);
      if (mob.returningHome) {
        const distFromSpawn = getMobDistanceFromSpawn(mob);
        if (distFromSpawn <= mobWanderRadius + 0.05) {
          mob.returningHome = false;
          mob.wanderTarget = null;
          mob.nextWanderAt = now + randomInt(450, 1300);
        } else {
          const homeDir = normalizeDirection(mob.spawnX - mob.x, mob.spawnY - mob.y);
          if (homeDir) {
            const returnRadius = Math.max(mobWanderRadius, distFromSpawn);
            const nextPos = clampToSpawnRadius(
              mob.x + homeDir.dx * mobSpeed * 0.8 * dt,
              mob.y + homeDir.dy * mobSpeed * 0.8 * dt,
              mob.spawnX,
              mob.spawnY,
              returnRadius
            );
            mob.x = nextPos.x;
            mob.y = nextPos.y;
          }
          continue;
        }
      }

      let forcedTarget = null;
      if (hasActiveProvokedChase(mob, now)) {
        const candidate = players.get(String(mob.chaseTargetPlayerId));
        if (candidate && candidate.hp > 0) {
          forcedTarget = candidate;
        } else {
          startMobReturnToSpawn(mob);
          continue;
        }
      } else {
        mob.chaseTargetPlayerId = null;
        mob.chaseUntil = 0;
      }

      if (forcedTarget && getMobDistanceFromSpawn(mob) >= mobProvokedLeashRadius - 0.05) {
        startMobReturnToSpawn(mob);
        continue;
      }

      const combat = getMobCombatProfile(mob);
      const behavior = String(combat.behavior || "melee").toLowerCase() === "ranged" ? "ranged" : "melee";
      const aggroRange = Math.max(0.5, Number(combat.aggroRange) || mobAggroRange);
      const nearestAggro = forcedTarget ? null : getNearestAggroPlayer(mob, aggroRange);
      const aggroPlayer = forcedTarget || (nearestAggro ? nearestAggro.player : null);
      const dist = aggroPlayer ? distance(mob, aggroPlayer) : Infinity;

      if (aggroPlayer) {
        const castedAbility = tryMobCastConfiguredAbility(mob, aggroPlayer, dist, now);
        if (castedAbility) {
          if (aggroPlayer.hp <= 0) {
            startMobReturnToSpawn(mob);
          }
          continue;
        }

        const basicAttack = combat.basicAttack && typeof combat.basicAttack === "object" ? combat.basicAttack : null;
        const basicRange = Math.max(0.2, Number(basicAttack?.range) || mobAttackRange);
        const preferredRange =
          behavior === "ranged"
            ? Math.max(basicRange, Number(combat.preferredRange) || basicRange)
            : basicRange;
        const rangeBand = Math.max(0.3, preferredRange * 0.14);
        const shouldMoveCloser =
          behavior === "ranged" ? dist > preferredRange + rangeBand : dist > basicRange;
        const shouldRetreat = behavior === "ranged" ? dist < Math.max(0.2, preferredRange - rangeBand) : false;

        if (tryMobBasicAttack(mob, aggroPlayer, dist, now)) {
          if (aggroPlayer.hp <= 0) {
            startMobReturnToSpawn(mob);
          }
          continue;
        }

        if (shouldMoveCloser || shouldRetreat) {
          const chaseDir = normalizeDirection(aggroPlayer.x - mob.x, aggroPlayer.y - mob.y);
          if (chaseDir) {
            const moveDir = shouldRetreat ? { dx: -chaseDir.dx, dy: -chaseDir.dy } : chaseDir;
            const leashRadius = forcedTarget ? mobProvokedLeashRadius : getMobLeashRadius(mob, now);
            const speedScale = shouldRetreat ? 0.92 : 1;
            const nextPos = clampToSpawnRadius(
              mob.x + moveDir.dx * mobSpeed * speedScale * dt,
              mob.y + moveDir.dy * mobSpeed * speedScale * dt,
              mob.spawnX,
              mob.spawnY,
              leashRadius
            );
            mob.x = nextPos.x;
            mob.y = nextPos.y;
          }
        }
        continue;
      }

      if (!mob.wanderTarget || now >= mob.nextWanderAt || distance(mob, mob.wanderTarget) < 0.35) {
        mob.wanderTarget = randomPointInRadius(mob.spawnX, mob.spawnY, mobWanderRadius);
        mob.nextWanderAt = now + randomInt(900, 2600);
      }

      const dir = normalizeDirection(mob.wanderTarget.x - mob.x, mob.wanderTarget.y - mob.y);
      if (!dir) {
        continue;
      }

      const nextPos = clampToSpawnRadius(
        mob.x + dir.dx * mobSpeed * 0.7 * dt,
        mob.y + dir.dy * mobSpeed * 0.7 * dt,
        mob.spawnX,
        mob.spawnY,
        getMobLeashRadius(mob, now)
      );
      mob.x = nextPos.x;
      mob.y = nextPos.y;
    }

    resolveMobOverlaps(now);
    resolveAllPlayersAgainstMobs();
  }

  return {
    tickMobs,
    resolveMobOverlaps
  };
}

module.exports = {
  createMobTickSystem
};
