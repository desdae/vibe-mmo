function createProjectileRuntimeTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const players = options.players;
  const mobs = options.mobs;
  const spawnProjectileFromTemplate =
    typeof options.spawnProjectileFromTemplate === "function" ? options.spawnProjectileFromTemplate : () => false;
  const normalizeProjectileTargetType =
    typeof options.normalizeProjectileTargetType === "function"
      ? options.normalizeProjectileTargetType
      : (targetType, fallback = "mob") => fallback;

  if (!(players instanceof Map)) {
    throw new Error("createProjectileRuntimeTools requires players map");
  }
  if (!(mobs instanceof Map)) {
    throw new Error("createProjectileRuntimeTools requires mobs map");
  }

  function emitProjectilesFromEmitter(projectile, now = Date.now()) {
    const emitter = projectile && projectile.emitProjectiles;
    if (!emitter || String(emitter.trigger || "").toLowerCase() !== "whiletraveling") {
      return;
    }
    const intervalMs = Math.max(50, Math.floor(Number(emitter.intervalMs) || 0));
    const maxEmissions = clamp(Math.floor(Number(emitter.maxEmissions) || 0), 0, 1000);
    if (intervalMs <= 0 || maxEmissions <= 0 || !emitter.childProjectile) {
      projectile.emitProjectiles = null;
      return;
    }
    if (Number(emitter.emissionsDone) >= maxEmissions) {
      projectile.emitProjectiles = null;
      return;
    }

    const pattern = emitter.pattern && typeof emitter.pattern === "object" ? emitter.pattern : {};
    const count = clamp(Math.floor(Number(pattern.count) || 1), 1, 64);
    const startAngleRad = (Number(pattern.startAngleDeg) || 0) * (Math.PI / 180);
    const angleSpreadRad = (Number(pattern.angleSpreadDeg) || 360) * (Math.PI / 180);
    const evenSpacing = pattern.evenSpacing !== false;
    const baseAngle = Math.atan2(Number(projectile.dy) || 0, Number(projectile.dx) || 1);
    const level = Math.max(1, Math.floor(Number(emitter.abilityLevel) || 1));

    let burstsThisTick = 0;
    while (now >= Number(emitter.nextEmissionAt) && Number(emitter.emissionsDone) < maxEmissions) {
      for (let i = 0; i < count; i += 1) {
        let t = 0;
        if (count > 1) {
          t = evenSpacing ? i / count : i / (count - 1);
        }
        const angle = baseAngle + startAngleRad + (count === 1 ? 0 : t * angleSpreadRad);
        spawnProjectileFromTemplate(
          projectile.ownerId,
          projectile.x,
          projectile.y,
          { dx: Math.cos(angle), dy: Math.sin(angle) },
          emitter.childProjectile,
          level,
          now,
          projectile.targetType
        );
      }

      emitter.emissionsDone = Math.floor(Number(emitter.emissionsDone) || 0) + 1;
      emitter.nextEmissionAt = Number(emitter.nextEmissionAt) + intervalMs;
      burstsThisTick += 1;
      if (burstsThisTick >= 4) {
        emitter.nextEmissionAt = now + intervalMs;
        break;
      }
    }

    if (Number(emitter.emissionsDone) >= maxEmissions) {
      projectile.emitProjectiles = null;
    }
  }

  function getNearestProjectileTarget(projectile, maxRange) {
    if (!projectile || maxRange <= 0) {
      return null;
    }
    const projectileTargetType = normalizeProjectileTargetType(projectile.targetType, "mob");
    const ownerId = String(projectile.ownerId || "");
    const ownerIsMob = ownerId.toLowerCase().startsWith("mob:");
    const ownerPlayer = !ownerIsMob ? players.get(ownerId) || null : null;
    const ownerTeam =
      ownerPlayer && ownerPlayer.team !== undefined && ownerPlayer.team !== null
        ? String(ownerPlayer.team).trim().toLowerCase()
        : "";

    let best = null;
    let bestDistSq = maxRange * maxRange;

    if (projectileTargetType === "player") {
      for (const player of players.values()) {
        if (!player || player.hp <= 0) {
          continue;
        }
        if (!ownerIsMob && String(player.id || "") === ownerId) {
          continue;
        }
        if (ownerTeam) {
          const candidateTeam =
            player.team !== undefined && player.team !== null ? String(player.team).trim().toLowerCase() : "";
          if (candidateTeam && candidateTeam === ownerTeam) {
            continue;
          }
        }
        const dx = player.x - projectile.x;
        const dy = player.y - projectile.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > bestDistSq) {
          continue;
        }
        best = player;
        bestDistSq = distSq;
      }
      return best;
    }

    for (const mob of mobs.values()) {
      if (!mob.alive) {
        continue;
      }
      const sourceMobId = String(projectile.sourceMobId || "");
      if (sourceMobId && String(mob.id || "") === sourceMobId) {
        continue;
      }
      const dx = mob.x - projectile.x;
      const dy = mob.y - projectile.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > bestDistSq) {
        continue;
      }
      best = mob;
      bestDistSq = distSq;
    }
    return best;
  }

  return {
    emitProjectilesFromEmitter,
    getNearestProjectileTarget
  };
}

module.exports = {
  createProjectileRuntimeTools
};
