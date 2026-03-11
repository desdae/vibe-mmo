function createMobAbilityTools(options = {}) {
  const players = options.players;
  const projectiles = options.projectiles;
  const getAbilityDefs = typeof options.getAbilityDefs === "function" ? options.getAbilityDefs : () => new Map();
  const resolveMobAbilityOverrideDef =
    typeof options.resolveMobAbilityOverrideDef === "function" ? options.resolveMobAbilityOverrideDef : (def) => def;
  const normalizeDirection =
    typeof options.normalizeDirection === "function" ? options.normalizeDirection : () => null;
  const rotateDirection = typeof options.rotateDirection === "function" ? options.rotateDirection : (dir) => dir;
  const distance = typeof options.distance === "function" ? options.distance : () => Infinity;
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const getAbilityRangeForLevel =
    typeof options.getAbilityRangeForLevel === "function" ? options.getAbilityRangeForLevel : () => 0;
  const getAbilityDamageRange =
    typeof options.getAbilityDamageRange === "function" ? options.getAbilityDamageRange : () => [0, 0];
  const getAbilityDotDamageRange =
    typeof options.getAbilityDotDamageRange === "function" ? options.getAbilityDotDamageRange : () => [0, 0];
  const scaleDamageRangeForMob =
    typeof options.scaleDamageRangeForMob === "function" ? options.scaleDamageRangeForMob : (_mob, min, max) => [min, max];
  const applyDamageToPlayer =
    typeof options.applyDamageToPlayer === "function" ? options.applyDamageToPlayer : () => 0;
  const applyAbilityHitEffectsToPlayer =
    typeof options.applyAbilityHitEffectsToPlayer === "function" ? options.applyAbilityHitEffectsToPlayer : () => {};
  const triggerMobAttackAnimation =
    typeof options.triggerMobAttackAnimation === "function" ? options.triggerMobAttackAnimation : () => {};
  const queueExplosionEvent = typeof options.queueExplosionEvent === "function" ? options.queueExplosionEvent : () => {};
  const clearMobCast = typeof options.clearMobCast === "function" ? options.clearMobCast : () => {};
  const getMobCombatProfile = typeof options.getMobCombatProfile === "function" ? options.getMobCombatProfile : () => ({});
  const allocateProjectileId =
    typeof options.allocateProjectileId === "function" ? options.allocateProjectileId : () => String(Date.now());
  const mapWidth = Math.max(1, Number(options.mapWidth) || 1);
  const mapHeight = Math.max(1, Number(options.mapHeight) || 1);
  const defaultProjectileHitRadius = Math.max(0.01, Number(options.defaultProjectileHitRadius) || 0.6);
  const defaultMobAttackRange = Math.max(0.1, Number(options.defaultMobAttackRange) || 1.25);
  const defaultMobAttackCooldownMs = Math.max(1, Number(options.defaultMobAttackCooldownMs) || 900);

  if (!(players instanceof Map)) {
    throw new Error("createMobAbilityTools requires players map");
  }
  if (!(projectiles instanceof Map)) {
    throw new Error("createMobAbilityTools requires projectiles map");
  }

  function spawnMobProjectileAbility(mob, abilityDef, abilityLevel, targetDir, now = Date.now()) {
    if (!mob || !abilityDef || !targetDir) {
      return false;
    }
    const normalized = normalizeDirection(targetDir.dx, targetDir.dy);
    if (!normalized) {
      return false;
    }

    const speed = Math.max(0.1, Number(abilityDef.speed) || 1);
    const range = Math.max(0.25, getAbilityRangeForLevel(abilityDef, abilityLevel) || 6);
    const ttlMs = Math.max(120, Math.round((range / speed) * 1000));
    const [rawDamageMin, rawDamageMax] = getAbilityDamageRange(abilityDef, abilityLevel);
    const [damageMin, damageMax] = scaleDamageRangeForMob(mob, rawDamageMin, rawDamageMax);
    const [rawDotDamageMin, rawDotDamageMax] = getAbilityDotDamageRange(abilityDef, abilityLevel);
    const [dotDamageMin, dotDamageMax] = scaleDamageRangeForMob(mob, rawDotDamageMin, rawDotDamageMax);
    const dotDurationMs = Math.max(0, Number(abilityDef.dotDurationMs) || 0);
    const dotSchool = String(abilityDef.dotSchool || "generic").trim().toLowerCase() || "generic";
    const projectileCount = clamp(Math.floor(Number(abilityDef.projectileCount) || 1), 1, 12);
    const spreadDeg =
      Number(abilityDef.spreadDeg) > 0 ? Number(abilityDef.spreadDeg) : projectileCount > 1 ? 16 : 0;
    const spreadTotalRad = (spreadDeg * Math.PI) / 180;

    for (let i = 0; i < projectileCount; i += 1) {
      const ratio = projectileCount <= 1 ? 0.5 : i / (projectileCount - 1);
      const angleOffset = projectileCount <= 1 ? 0 : (ratio - 0.5) * spreadTotalRad;
      const dir = projectileCount <= 1 ? normalized : rotateDirection(normalized, angleOffset);
      const startOffset = 0.9 + i * 0.04;
      const projectile = {
        id: String(allocateProjectileId()),
        ownerId: `mob:${String(mob.id)}`,
        sourceMobId: String(mob.id),
        targetType: "player",
        x: clamp(mob.x + dir.dx * startOffset, 0, mapWidth - 1),
        y: clamp(mob.y + dir.dy * startOffset, 0, mapHeight - 1),
        dx: dir.dx,
        dy: dir.dy,
        speed,
        ttlMs,
        createdAt: now,
        damageMin,
        damageMax,
        hitRadius: clamp(Number(abilityDef.projectileHitRadius) || defaultProjectileHitRadius, 0.1, 8),
        explosionRadius: Math.max(0, Number(abilityDef.explosionRadius) || 0),
        explosionDamageMultiplier: clamp(Number(abilityDef.explosionDamageMultiplier) || 0, 0, 1),
        slowDurationMs: Math.max(0, Number(abilityDef.slowDurationMs) || 0),
        slowMultiplier: clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1),
        stunDurationMs: Math.max(0, Number(abilityDef.stunDurationMs) || 0),
        dotDamageMin: Math.max(0, Number(dotDamageMin) || 0),
        dotDamageMax: Math.max(0, Number(dotDamageMax) || 0),
        dotDurationMs,
        dotSchool,
        explodeOnExpire: abilityDef.explodeOnExpire !== false,
        homingRange: Math.max(0, Number(abilityDef.homingRange) || 0),
        homingTurnRate: Math.max(0, Number(abilityDef.homingTurnRate) || 0),
        abilityId: abilityDef.id,
        emitProjectiles: null
      };
      projectiles.set(projectile.id, projectile);
    }

    return true;
  }

  function executeMobAbilityAgainstPlayer(mob, player, abilityEntry, now = Date.now()) {
    if (!mob || !player || !abilityEntry) {
      return false;
    }
    const abilityId = String(abilityEntry.abilityId || "").trim();
    if (!abilityId) {
      return false;
    }
    const baseAbilityDef = getAbilityDefs().get(abilityId);
    if (!baseAbilityDef) {
      return false;
    }
    const abilityDef = resolveMobAbilityOverrideDef(baseAbilityDef, abilityEntry);
    const abilityLevel = clamp(Math.floor(Number(abilityEntry.level) || 1), 1, 255);
    const dir = normalizeDirection(player.x - mob.x, player.y - mob.y);
    if (!dir) {
      return false;
    }
    const dist = distance(mob, player);
    const kind = String(abilityDef.kind || "").trim().toLowerCase();

    if (kind === "projectile") {
      const casted = spawnMobProjectileAbility(mob, abilityDef, abilityLevel, dir, now);
      if (casted) {
        triggerMobAttackAnimation(mob, dir, now, abilityDef.id);
      }
      return casted;
    }

    const [rawDamageMin, rawDamageMax] = getAbilityDamageRange(abilityDef, abilityLevel);
    const [damageMin, damageMax] = scaleDamageRangeForMob(mob, rawDamageMin, rawDamageMax);
    const rollDamage = () =>
      randomInt(clamp(Math.floor(damageMin), 0, 65535), clamp(Math.floor(Math.max(damageMin, damageMax)), damageMin, 65535));

    if (kind === "meleecone") {
      const range = Math.max(0.2, getAbilityRangeForLevel(abilityDef, abilityLevel) || defaultMobAttackRange);
      if (dist > range) {
        return false;
      }
      triggerMobAttackAnimation(mob, dir, now, abilityDef.id);
      const dealt = applyDamageToPlayer(player, rollDamage(), now, { sourceMob: mob });
      applyAbilityHitEffectsToPlayer(player, mob.id, abilityDef, abilityLevel, dealt, now);
      return true;
    }

    if (kind === "selfarea") {
      const radius = Math.max(0.2, Number(abilityDef.areaRadius) || Number(abilityDef.radius) || 0.2);
      if (dist > radius) {
        return false;
      }
      triggerMobAttackAnimation(mob, dir, now, abilityDef.id);
      queueExplosionEvent(mob.x, mob.y, radius, abilityDef.id);
      const dealt = applyDamageToPlayer(player, rollDamage(), now, { sourceMob: mob });
      applyAbilityHitEffectsToPlayer(player, mob.id, abilityDef, abilityLevel, dealt, now);
      return true;
    }

    if (kind === "area") {
      const castRange = Math.max(0, getAbilityRangeForLevel(abilityDef, abilityLevel) || 0);
      const radius = Math.max(0.2, Number(abilityDef.areaRadius) || Number(abilityDef.radius) || 0.2);
      if (dist > castRange + radius) {
        return false;
      }
      triggerMobAttackAnimation(mob, dir, now, abilityDef.id);
      const impactDistance = castRange > 0 ? clamp(dist, 0, castRange) : 0;
      const impactX = clamp(mob.x + dir.dx * impactDistance, 0, mapWidth - 1);
      const impactY = clamp(mob.y + dir.dy * impactDistance, 0, mapHeight - 1);
      queueExplosionEvent(impactX, impactY, radius, abilityDef.id);
      const dealt = applyDamageToPlayer(player, rollDamage(), now, { sourceMob: mob });
      applyAbilityHitEffectsToPlayer(player, mob.id, abilityDef, abilityLevel, dealt, now);
      return true;
    }

    if (kind === "beam") {
      const beamRange = Math.max(0.5, getAbilityRangeForLevel(abilityDef, abilityLevel) || 0.5);
      const halfWidth = Math.max(0.15, (Number(abilityDef.beamWidth) || 0.8) * 0.5);
      const relX = player.x - mob.x;
      const relY = player.y - mob.y;
      const along = relX * dir.dx + relY * dir.dy;
      const perpendicular = Math.abs(relX * dir.dy - relY * dir.dx);
      if (along < 0 || along > beamRange || perpendicular > halfWidth + 0.4) {
        return false;
      }
      triggerMobAttackAnimation(mob, dir, now, abilityDef.id);
      const dealt = applyDamageToPlayer(player, rollDamage(), now, { sourceMob: mob });
      applyAbilityHitEffectsToPlayer(player, mob.id, abilityDef, abilityLevel, dealt, now);
      return true;
    }

    return false;
  }

  function startMobAbilityCast(mob, targetPlayer, abilityEntry, now = Date.now()) {
    if (!mob || !targetPlayer || !abilityEntry || mob.activeCast) {
      return false;
    }
    const abilityId = String(abilityEntry.abilityId || "").trim();
    if (!abilityId) {
      return false;
    }
    const baseAbilityDef = getAbilityDefs().get(abilityId);
    if (!baseAbilityDef) {
      return false;
    }
    const abilityDef = resolveMobAbilityOverrideDef(baseAbilityDef, abilityEntry);
    const castMs = Math.max(0, Number(abilityDef.castMs) || 0);
    if (castMs <= 0) {
      return false;
    }
    const dir = normalizeDirection(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
    if (!dir) {
      return false;
    }

    mob.activeCast = {
      abilityId,
      abilityLevel: clamp(Math.floor(Number(abilityEntry.level) || 1), 1, 255),
      abilityEntry:
        abilityEntry && typeof abilityEntry === "object" ? JSON.parse(JSON.stringify(abilityEntry)) : null,
      targetPlayerId: String(targetPlayer.id),
      dx: dir.dx,
      dy: dir.dy,
      durationMs: castMs,
      startedAt: now,
      endsAt: now + castMs
    };
    mob.castStateVersion = (Number(mob.castStateVersion) + 1) & 0xffff;
    return true;
  }

  function completeMobAbilityCast(mob, now = Date.now()) {
    if (!mob || !mob.activeCast) {
      return false;
    }
    const cast = mob.activeCast;
    const targetPlayer = players.get(String(cast.targetPlayerId || ""));
    const abilityEntry =
      cast.abilityEntry && typeof cast.abilityEntry === "object"
        ? cast.abilityEntry
        : {
            abilityId: String(cast.abilityId || ""),
            level: clamp(Math.floor(Number(cast.abilityLevel) || 1), 1, 255)
          };
    clearMobCast(mob);
    if (!targetPlayer || targetPlayer.hp <= 0) {
      return false;
    }
    return executeMobAbilityAgainstPlayer(mob, targetPlayer, abilityEntry, now);
  }

  function pickMobAbilityToCast(mob, dist, now = Date.now()) {
    const combat = getMobCombatProfile(mob);
    const entries = Array.isArray(combat.abilities) ? combat.abilities : [];
    if (!entries.length) {
      return null;
    }

    const candidates = [];
    let totalWeight = 0;
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const abilityId = String(entry.abilityId || "").trim();
      if (!abilityId || !getAbilityDefs().has(abilityId)) {
        continue;
      }
      const minRange = Math.max(0, Number(entry.minRange) || 0);
      const maxRange = Math.max(minRange, Number(entry.maxRange) || minRange);
      if (dist < minRange || dist > maxRange) {
        continue;
      }
      const castChance = clamp(Number(entry.castChance), 0, 1);
      if (Number.isFinite(castChance) && castChance < 1 && Math.random() > castChance) {
        continue;
      }
      const cooldownMs = Math.max(0, Math.floor(Number(entry.cooldownMs) || 0));
      const cooldownKey = `ability:${abilityId}`;
      const readyAt = mob.abilityCooldowns instanceof Map ? Number(mob.abilityCooldowns.get(cooldownKey) || 0) : 0;
      if (readyAt > now) {
        continue;
      }
      const weight = Math.max(0.01, Number(entry.weight) || 1);
      totalWeight += weight;
      candidates.push({ entry, weight, cooldownKey, cooldownMs });
    }

    if (!candidates.length) {
      return null;
    }
    let roll = Math.random() * totalWeight;
    for (const candidate of candidates) {
      roll -= candidate.weight;
      if (roll <= 0) {
        return candidate;
      }
    }
    return candidates[candidates.length - 1];
  }

  function tryMobCastConfiguredAbility(mob, targetPlayer, dist, now = Date.now()) {
    const picked = pickMobAbilityToCast(mob, dist, now);
    if (!picked) {
      return false;
    }

    if (!(mob.abilityCooldowns instanceof Map)) {
      mob.abilityCooldowns = new Map();
    }
    const baseAbilityDef = getAbilityDefs().get(String(picked.entry.abilityId || ""));
    const abilityDef = resolveMobAbilityOverrideDef(baseAbilityDef, picked.entry);
    const castMs = Math.max(0, Number(abilityDef?.castMs) || 0);
    if (castMs > 0) {
      const started = startMobAbilityCast(mob, targetPlayer, picked.entry, now);
      if (!started) {
        return false;
      }
      mob.abilityCooldowns.set(picked.cooldownKey, now + Math.max(0, picked.cooldownMs));
      return true;
    }

    const used = executeMobAbilityAgainstPlayer(mob, targetPlayer, picked.entry, now);
    if (!used) {
      return false;
    }

    mob.abilityCooldowns.set(picked.cooldownKey, now + Math.max(0, picked.cooldownMs));
    return true;
  }

  function tryMobBasicAttack(mob, targetPlayer, dist, now = Date.now()) {
    if (!mob || !targetPlayer || targetPlayer.hp <= 0) {
      return false;
    }
    const combat = getMobCombatProfile(mob);
    const basic = combat.basicAttack && typeof combat.basicAttack === "object" ? combat.basicAttack : null;
    if (!basic) {
      return false;
    }

    const range = Math.max(0.2, Number(basic.range) || defaultMobAttackRange);
    if (dist > range) {
      return false;
    }
    const cooldownMs = Math.max(50, Math.floor(Number(basic.cooldownMs) || defaultMobAttackCooldownMs));
    if (now - Number(mob.lastAttackAt || 0) < cooldownMs) {
      return false;
    }

    if (String(basic.type || "melee").toLowerCase() === "ability" && String(basic.abilityId || "").trim()) {
      const abilityId = String(basic.abilityId || "").trim();
      const baseAbilityDef = getAbilityDefs().get(abilityId);
      const abilityDef = resolveMobAbilityOverrideDef(baseAbilityDef, basic);
      const castMs = Math.max(0, Number(abilityDef?.castMs) || 0);
      if (castMs > 0) {
        const started = startMobAbilityCast(
          mob,
          targetPlayer,
          {
            abilityId,
            level: 1
          },
          now
        );
        if (started) {
          mob.lastAttackAt = now;
        }
        return started;
      }

      const used = executeMobAbilityAgainstPlayer(
        mob,
        targetPlayer,
        {
          abilityId,
          level: 1
        },
        now
      );
      if (used) {
        mob.lastAttackAt = now;
      }
      return used;
    }

    const dir = normalizeDirection(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
    triggerMobAttackAnimation(mob, dir, now);
    const damageMin = clamp(Math.floor(Number(basic.damageMin) || Number(mob.damageMin) || 1), 0, 65535);
    const damageMax = clamp(Math.floor(Number(basic.damageMax) || Number(mob.damageMax) || damageMin), damageMin, 65535);
    applyDamageToPlayer(targetPlayer, randomInt(damageMin, damageMax), now, { sourceMob: mob });
    return true;
  }

  return {
    spawnMobProjectileAbility,
    executeMobAbilityAgainstPlayer,
    startMobAbilityCast,
    completeMobAbilityCast,
    pickMobAbilityToCast,
    tryMobCastConfiguredAbility,
    tryMobBasicAttack
  };
}

module.exports = {
  createMobAbilityTools
};
