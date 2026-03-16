function createProjectileTickSystem({
  projectiles,
  players,
  mobs,
  tickMs,
  mapWidth,
  mapHeight,
  clamp,
  distance,
  defaultProjectileHitRadius,
  randomInt,
  queueProjectileHitEvent,
  queueExplosionEvent,
  applyDamageToPlayer,
  applyDamageToMob,
  applyProjectileHitEffectsToPlayer,
  applyProjectileHitEffects,
  emitProjectilesFromEmitter,
  getNearestProjectileTarget,
  getPlayersInRadius,
  getMobsInRadius,
  normalizeDirection,
  steerDirectionTowards,
  isProjectileBlockedAt
}) {
  const isBlockedPoint = typeof isProjectileBlockedAt === "function" ? isProjectileBlockedAt : () => false;

  function getTargetCandidates(projectileTargetType, x, y, radius) {
    if (projectileTargetType === "player") {
      if (typeof getPlayersInRadius === "function") {
        return getPlayersInRadius(x, y, radius);
      }
      return players.values();
    }
    if (typeof getMobsInRadius === "function") {
      return getMobsInRadius(x, y, radius);
    }
    return mobs.values();
  }

  function tickProjectiles() {
    const now = Date.now();
    const toDelete = [];

    for (const projectile of projectiles.values()) {
      const dt = tickMs / 1000;
      let emittedOnExpire = false;
      emitProjectilesFromEmitter(projectile, now, "whiletraveling");
      const homingRange = Math.max(0, Number(projectile.homingRange) || 0);
      const homingTurnRate = Math.max(0, Number(projectile.homingTurnRate) || 0);
      if (homingRange > 0 && homingTurnRate > 0) {
        const target = getNearestProjectileTarget(projectile, homingRange);
        if (target) {
          const desiredDir = normalizeDirection(target.x - projectile.x, target.y - projectile.y);
          const nextDir = desiredDir ? steerDirectionTowards(projectile, desiredDir, homingTurnRate * dt) : null;
          if (nextDir) {
            projectile.dx = nextDir.dx;
            projectile.dy = nextDir.dy;
          }
        }
      }
      const nextX = projectile.x + projectile.dx * projectile.speed * dt;
      const nextY = projectile.y + projectile.dy * projectile.speed * dt;
      const worldBlocked = isBlockedPoint(nextX, nextY);
      if (!worldBlocked) {
        projectile.x = nextX;
        projectile.y = nextY;
      }

      const projectileTargetType =
        String(projectile.targetType || "").trim().toLowerCase() === "player" ? "player" : "mob";
      const sourceMob = projectile.sourceMobId ? mobs.get(String(projectile.sourceMobId)) || null : null;
      let hitMob = null;
      let hitPlayer = null;
      const hitRadius = clamp(Number(projectile.hitRadius) || defaultProjectileHitRadius, 0.1, 8);
      if (projectileTargetType === "player") {
        for (const player of getTargetCandidates("player", projectile.x, projectile.y, hitRadius)) {
          if (!player || player.hp <= 0) {
            continue;
          }
          if (distance(projectile, player) > hitRadius) {
            continue;
          }
          hitPlayer = player;
          break;
        }
      } else {
        for (const mob of getTargetCandidates("mob", projectile.x, projectile.y, hitRadius)) {
          if (!mob.alive) {
            continue;
          }
          if (distance(projectile, mob) > hitRadius) {
            continue;
          }
          hitMob = mob;
          break;
        }
      }

      const expired = now - projectile.createdAt > projectile.ttlMs;
      const outOfMap =
        projectile.x < 0 || projectile.x > mapWidth - 1 || projectile.y < 0 || projectile.y > mapHeight - 1;

      if (hitMob || hitPlayer) {
        emitProjectilesFromEmitter(projectile, now, "onimpact");
        const impactX = hitMob ? hitMob.x : hitPlayer.x;
        const impactY = hitMob ? hitMob.y : hitPlayer.y;
        queueProjectileHitEvent(impactX, impactY, projectile.abilityId);
        const damageMin = clamp(Math.floor(Number(projectile.damageMin) || 0), 0, 65535);
        const damageMax = clamp(Math.floor(Number(projectile.damageMax) || damageMin), damageMin, 65535);
        const baseDamage = randomInt(damageMin, damageMax);
        const explosionRadius = Math.max(0, Number(projectile.explosionRadius) || 0);
        const minMultiplier = clamp(Number(projectile.explosionDamageMultiplier) || 0, 0, 1);

        if (explosionRadius > 0) {
          queueExplosionEvent(impactX, impactY, explosionRadius, projectile.abilityId);
          if (projectileTargetType === "player") {
            for (const player of getTargetCandidates("player", impactX, impactY, explosionRadius)) {
              if (!player || player.hp <= 0) {
                continue;
              }
              const dist = Math.hypot(player.x - impactX, player.y - impactY);
              if (dist > explosionRadius) {
                continue;
              }
              const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
              const scale = 1 - t * (1 - minMultiplier);
              const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
              const dealt = applyDamageToPlayer(player, scaledDamage, now, { sourceMob });
              applyProjectileHitEffectsToPlayer(player, projectile, dealt, now);
            }
          } else {
            for (const mob of getTargetCandidates("mob", impactX, impactY, explosionRadius)) {
              if (!mob.alive) {
                continue;
              }
              const dist = Math.hypot(mob.x - impactX, mob.y - impactY);
              if (dist > explosionRadius) {
                continue;
              }
              const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
              const scale = 1 - t * (1 - minMultiplier);
              const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
              const dealt = applyDamageToMob(mob, scaledDamage, projectile.ownerId);
              applyProjectileHitEffects(mob, projectile, dealt, now);
            }
          }
        } else {
          if (projectileTargetType === "player") {
            const dealt = applyDamageToPlayer(hitPlayer, baseDamage, now, { sourceMob });
            applyProjectileHitEffectsToPlayer(hitPlayer, projectile, dealt, now);
          } else {
            const dealt = applyDamageToMob(hitMob, baseDamage, projectile.ownerId);
            applyProjectileHitEffects(hitMob, projectile, dealt, now);
          }
        }
      } else if (
        (expired || outOfMap || worldBlocked) &&
        (Number(projectile.explosionRadius) || 0) > 0 &&
        projectile.explodeOnExpire !== false
      ) {
        emitProjectilesFromEmitter(projectile, now, "onexpire");
        emittedOnExpire = true;
        const explosionRadius = Math.max(0, Number(projectile.explosionRadius) || 0);
        const minMultiplier = clamp(Number(projectile.explosionDamageMultiplier) || 0, 0, 1);
        const damageMin = clamp(Math.floor(Number(projectile.damageMin) || 0), 0, 65535);
        const damageMax = clamp(Math.floor(Number(projectile.damageMax) || damageMin), damageMin, 65535);
        const baseDamage = randomInt(damageMin, damageMax);
        queueExplosionEvent(projectile.x, projectile.y, explosionRadius, projectile.abilityId);
        if (projectileTargetType === "player") {
          for (const player of getTargetCandidates("player", projectile.x, projectile.y, explosionRadius)) {
            if (!player || player.hp <= 0) {
              continue;
            }
            const dist = Math.hypot(player.x - projectile.x, player.y - projectile.y);
            if (dist > explosionRadius) {
              continue;
            }
            const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
            const scale = 1 - t * (1 - minMultiplier);
            const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
            const dealt = applyDamageToPlayer(player, scaledDamage, now, { sourceMob });
            applyProjectileHitEffectsToPlayer(player, projectile, dealt, now);
          }
        } else {
          for (const mob of getTargetCandidates("mob", projectile.x, projectile.y, explosionRadius)) {
            if (!mob.alive) {
              continue;
            }
            const dist = Math.hypot(mob.x - projectile.x, mob.y - projectile.y);
            if (dist > explosionRadius) {
              continue;
            }
            const t = explosionRadius > 0 ? clamp(dist / explosionRadius, 0, 1) : 0;
            const scale = 1 - t * (1 - minMultiplier);
            const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
            const dealt = applyDamageToMob(mob, scaledDamage, projectile.ownerId);
            applyProjectileHitEffects(mob, projectile, dealt, now);
          }
        }
      }

      if ((expired || outOfMap || worldBlocked) && !hitMob && !hitPlayer && !emittedOnExpire) {
        emitProjectilesFromEmitter(projectile, now, "onexpire");
      }

      if (expired || outOfMap || worldBlocked || hitMob || hitPlayer) {
        toDelete.push(projectile.id);
      }
    }

    for (const id of toDelete) {
      projectiles.delete(id);
    }
  }

  return {
    tickProjectiles
  };
}

module.exports = {
  createProjectileTickSystem
};
