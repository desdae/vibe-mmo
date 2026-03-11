const { computeSummonFormationPositions, getSummonCountForLevel } = require("../../public/shared/summon-layout");

function createAreaEffectTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const normalizeDirection =
    typeof options.normalizeDirection === "function" ? options.normalizeDirection : () => null;
  const queueExplosionEvent = typeof options.queueExplosionEvent === "function" ? options.queueExplosionEvent : () => {};
  const allocateAreaEffectId =
    typeof options.allocateAreaEffectId === "function" ? options.allocateAreaEffectId : () => String(Date.now());
  const activeAreaEffects = options.activeAreaEffects;
  const mobs = options.mobs;
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const applyDamageToMob = typeof options.applyDamageToMob === "function" ? options.applyDamageToMob : () => 0;
  const applyDotToMob = typeof options.applyDotToMob === "function" ? options.applyDotToMob : () => {};
  const applySlowToMob = typeof options.applySlowToMob === "function" ? options.applySlowToMob : () => {};
  const spawnProjectileFromTemplate =
    typeof options.spawnProjectileFromTemplate === "function" ? options.spawnProjectileFromTemplate : () => false;
  const mapWidth = Math.max(1, Number(options.mapWidth) || 1);
  const mapHeight = Math.max(1, Number(options.mapHeight) || 1);

  if (!(activeAreaEffects instanceof Map)) {
    throw new Error("createAreaEffectTools requires activeAreaEffects map");
  }
  if (!(mobs instanceof Map)) {
    throw new Error("createAreaEffectTools requires mobs map");
  }

  function getAreaAbilityTargetPosition(player, castRange, targetDx, targetDy, targetDistance) {
    const targetDir =
      normalizeDirection(targetDx, targetDy) ||
      normalizeDirection(player.lastDirection.dx, player.lastDirection.dy) ||
      { dx: 0, dy: 1 };
    const requestedDistance = Number.isFinite(Number(targetDistance)) ? Number(targetDistance) : castRange;
    const distanceFromCaster = castRange > 0 ? clamp(requestedDistance, 0, castRange) : 0;
    const x = clamp(player.x + targetDir.dx * distanceFromCaster, 0, mapWidth - 1);
    const y = clamp(player.y + targetDir.dy * distanceFromCaster, 0, mapHeight - 1);
    return {
      x,
      y,
      castRange,
      distanceFromCaster,
      targetDir
    };
  }

  function createPersistentAreaEffect(
    ownerId,
    abilityDef,
    centerX,
    centerY,
    radius,
    durationMs,
    damageMin,
    damageMax,
    statusPayload = null,
    now
  ) {
    const tickIntervalMs = 1000;
    const payload = statusPayload && typeof statusPayload === "object" ? statusPayload : {};
    const effect = {
      id: String(allocateAreaEffectId()),
      ownerId: String(ownerId || ""),
      abilityId: String(abilityDef.id || ""),
      kind: "area",
      x: clamp(centerX, 0, mapWidth - 1),
      y: clamp(centerY, 0, mapHeight - 1),
      radius: Math.max(0.1, Number(radius) || 0.1),
      damageMin: clamp(Math.floor(Number(damageMin) || 0), 0, 255),
      damageMax: clamp(Math.floor(Number(damageMax) || 0), 0, 255),
      damageMode: String(payload.damageMode || "overTime").trim().toLowerCase() || "overTime",
      dotDamageMin: Math.max(0, Number(payload.dotDamageMin) || 0),
      dotDamageMax: Math.max(0, Number(payload.dotDamageMax) || 0),
      dotDurationMs: Math.max(0, Math.floor(Number(payload.dotDurationMs) || 0)),
      dotSchool: String(payload.dotSchool || "generic").trim().toLowerCase() || "generic",
      slowMultiplier: clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1),
      slowDurationMs: Math.max(
        0,
        Number(abilityDef.slowDurationMs) || (clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1) < 1 ? 1200 : 0)
      ),
      createdAt: now,
      endsAt: now + durationMs,
      durationMs,
      tickIntervalMs,
      nextTickAt: now,
      hitTargetIds: new Set()
    };
    activeAreaEffects.set(effect.id, effect);
    queueExplosionEvent(effect.x, effect.y, effect.radius, effect.abilityId);
    return effect;
  }

  function createPersistentBeamEffect(
    ownerId,
    abilityDef,
    startX,
    startY,
    dir,
    length,
    width,
    durationMs,
    damageMin,
    damageMax,
    statusPayload = null,
    now
  ) {
    const beamLength = Math.max(0.2, Number(length) || 0.2);
    const beamWidth = Math.max(0.2, Number(width) || 0.8);
    const normalizedDir = normalizeDirection(dir?.dx, dir?.dy) || { dx: 0, dy: 1 };
    const clampedStartX = clamp(startX, 0, mapWidth - 1);
    const clampedStartY = clamp(startY, 0, mapHeight - 1);
    const clampedEndX = clamp(clampedStartX + normalizedDir.dx * beamLength, 0, mapWidth - 1);
    const clampedEndY = clamp(clampedStartY + normalizedDir.dy * beamLength, 0, mapHeight - 1);
    const tickIntervalMs = 250;
    const payload = statusPayload && typeof statusPayload === "object" ? statusPayload : {};

    const effect = {
      id: String(allocateAreaEffectId()),
      ownerId: String(ownerId || ""),
      abilityId: String(abilityDef.id || ""),
      kind: "beam",
      x: (clampedStartX + clampedEndX) * 0.5,
      y: (clampedStartY + clampedEndY) * 0.5,
      radius: Math.max(beamWidth, beamLength * 0.55),
      startX: clampedStartX,
      startY: clampedStartY,
      dx: normalizedDir.dx,
      dy: normalizedDir.dy,
      length: beamLength,
      width: beamWidth,
      damageMin: clamp(Math.floor(Number(damageMin) || 0), 0, 255),
      damageMax: clamp(Math.floor(Number(damageMax) || 0), 0, 255),
      damageMode: String(payload.damageMode || "overTime").trim().toLowerCase() || "overTime",
      dotDamageMin: Math.max(0, Number(payload.dotDamageMin) || 0),
      dotDamageMax: Math.max(0, Number(payload.dotDamageMax) || 0),
      dotDurationMs: Math.max(0, Math.floor(Number(payload.dotDurationMs) || 0)),
      dotSchool: String(payload.dotSchool || "generic").trim().toLowerCase() || "generic",
      createdAt: now,
      endsAt: now + durationMs,
      durationMs,
      tickIntervalMs,
      nextTickAt: now,
      hitTargetIds: new Set()
    };
    activeAreaEffects.set(effect.id, effect);
    return effect;
  }

  function createPersistentSummonEffect(
    ownerId,
    abilityDef,
    centerX,
    centerY,
    summonCount,
    durationMs,
    payload = null,
    now
  ) {
    const config = payload && typeof payload === "object" ? payload : {};
    const effectiveSummonCount = getSummonCountForLevel(
      Number(abilityDef && abilityDef.summonCount) || Number(summonCount) || 1,
      Number(abilityDef && abilityDef.summonCountPerLevel) || 0,
      Math.max(1, Math.floor(Number(config.abilityLevel) || 1)),
      {
        everyLevels: Number(abilityDef && abilityDef.summonCountEveryLevels) || 0,
        maxCount: Number(abilityDef && abilityDef.maxSummonCount) || 0
      }
    );
    const effect = {
      id: String(allocateAreaEffectId()),
      ownerId: String(ownerId || ""),
      abilityId: String(abilityDef.id || ""),
      kind: "summon",
      x: clamp(centerX, 0, mapWidth - 1),
      y: clamp(centerY, 0, mapHeight - 1),
      radius: Math.max(0.5, Number(config.renderRadius) || Number(config.formationRadius) + 1.1 || 1.4),
      summonCount: Math.max(1, Math.round(Number(effectiveSummonCount) || 1)),
      formationRadius: Math.max(0, Number(config.formationRadius) || 0),
      attackRange: Math.max(0.5, Number(config.attackRange) || 6),
      attackIntervalMs: Math.max(120, Math.floor(Number(config.attackIntervalMs) || 1000)),
      projectileTemplate:
        config.projectileTemplate && typeof config.projectileTemplate === "object"
          ? { ...config.projectileTemplate }
          : null,
      abilityLevel: Math.max(1, Math.floor(Number(config.abilityLevel) || 1)),
      tickIntervalMs: Math.max(120, Math.floor(Number(config.attackIntervalMs) || 1000)),
      createdAt: now,
      endsAt: now + durationMs,
      durationMs,
      nextAttackAt: now + Math.max(200, Math.min(700, Math.floor(Number(config.initialDelayMs) || 380))),
      nextTickAt: now + Math.max(200, Math.min(700, Math.floor(Number(config.initialDelayMs) || 380)))
    };
    activeAreaEffects.set(effect.id, effect);
    queueExplosionEvent(effect.x, effect.y, Math.max(0.4, effect.radius * 0.7), effect.abilityId);
    return effect;
  }

  function rollScaledTickDamage(minPerSecond, maxPerSecond, tickIntervalMs) {
    const minBase = Math.max(0, Number(minPerSecond) || 0);
    const maxBase = Math.max(minBase, Number(maxPerSecond) || minBase);
    if (maxBase <= 0 || tickIntervalMs <= 0) {
      return 0;
    }
    const scale = tickIntervalMs / 1000;
    const minTick = minBase * scale;
    const maxTick = maxBase * scale;
    const sampled = minTick + Math.random() * Math.max(0, maxTick - minTick);
    let dealt = Math.floor(sampled);
    const fractional = sampled - dealt;
    if (Math.random() < fractional) {
      dealt += 1;
    }
    return Math.max(0, dealt);
  }

  function isMobInsideBeamEffect(mob, effect) {
    if (!mob || !effect || !mob.alive) {
      return false;
    }
    const dir = normalizeDirection(effect.dx, effect.dy);
    if (!dir) {
      return false;
    }
    const startX = Number(effect.startX);
    const startY = Number(effect.startY);
    const beamLength = Math.max(0.2, Number(effect.length) || 0);
    const halfWidth = Math.max(0.1, Number(effect.width) || 0.8) * 0.5;
    const relX = mob.x - startX;
    const relY = mob.y - startY;
    const along = relX * dir.dx + relY * dir.dy;
    if (along < 0 || along > beamLength) {
      return false;
    }
    const perpendicular = Math.abs(relX * dir.dy - relY * dir.dx);
    return perpendicular <= halfWidth;
  }

  function tickAreaEffects(now = Date.now()) {
    for (const [effectId, effect] of activeAreaEffects.entries()) {
      if (!effect || now >= Number(effect.endsAt) || Number(effect.durationMs) <= 0) {
        activeAreaEffects.delete(effectId);
        continue;
      }

      const tickIntervalMs = Math.max(50, Number(effect.tickIntervalMs) || 1000);
      while (Number(effect.nextTickAt) <= now && Number(effect.nextTickAt) < Number(effect.endsAt) + 5) {
        if (String(effect.kind || "") === "beam") {
          for (const mob of mobs.values()) {
            if (!isMobInsideBeamEffect(mob, effect)) {
              continue;
            }
            if (effect.damageMode === "instant" && effect.hitTargetIds && effect.hitTargetIds.has(String(mob.id))) {
              continue;
            }
            const tickDamage =
              effect.damageMode === "instant"
                ? randomInt(effect.damageMin, effect.damageMax)
                : rollScaledTickDamage(effect.damageMin, effect.damageMax, tickIntervalMs);
            if (tickDamage > 0) {
              const dealt = applyDamageToMob(mob, tickDamage, effect.ownerId);
              if (effect.damageMode === "instant" && effect.hitTargetIds) {
                effect.hitTargetIds.add(String(mob.id));
              }
              if (mob.alive && dealt > 0 && effect.dotDurationMs > 0 && effect.dotDamageMax > 0) {
                applyDotToMob(
                  mob,
                  effect.ownerId || null,
                  String(effect.dotSchool || "generic"),
                  effect.dotDamageMin,
                  effect.dotDamageMax,
                  effect.dotDurationMs,
                  now
                );
              }
            }
          }
        } else if (String(effect.kind || "") === "summon") {
          const projectileTemplate =
            effect.projectileTemplate && typeof effect.projectileTemplate === "object"
              ? effect.projectileTemplate
              : null;
          if (!projectileTemplate) {
            effect.nextTickAt = Number(effect.endsAt) + 1;
            continue;
          }
          const hydraPositions = computeSummonFormationPositions(
            effect.x,
            effect.y,
            effect.summonCount,
            effect.formationRadius
          );
          for (const hydra of hydraPositions) {
            let bestTarget = null;
            let bestDistSq = Math.max(0.25, Number(effect.attackRange) || 6) ** 2;
            for (const mob of mobs.values()) {
              if (!mob.alive) {
                continue;
              }
              const dx = mob.x - hydra.x;
              const dy = mob.y - hydra.y;
              const distSq = dx * dx + dy * dy;
              if (distSq > bestDistSq) {
                continue;
              }
              bestTarget = mob;
              bestDistSq = distSq;
            }
            if (!bestTarget) {
              continue;
            }
            spawnProjectileFromTemplate(
              effect.ownerId,
              hydra.x,
              hydra.y,
              { dx: bestTarget.x - hydra.x, dy: bestTarget.y - hydra.y },
              projectileTemplate,
              effect.abilityLevel,
              now,
              "mob"
            );
          }
          effect.nextAttackAt = effect.nextTickAt;
        } else {
          for (const mob of mobs.values()) {
            if (!mob.alive) {
              continue;
            }
            const dist = Math.hypot(mob.x - effect.x, mob.y - effect.y);
            if (dist > effect.radius) {
              continue;
            }
            if (effect.damageMax > 0) {
              const dealt = applyDamageToMob(mob, randomInt(effect.damageMin, effect.damageMax), effect.ownerId);
              if (mob.alive && dealt > 0 && effect.dotDurationMs > 0 && effect.dotDamageMax > 0) {
                applyDotToMob(
                  mob,
                  effect.ownerId || null,
                  String(effect.dotSchool || "generic"),
                  effect.dotDamageMin,
                  effect.dotDamageMax,
                  effect.dotDurationMs,
                  now
                );
              }
            }
            if (mob.alive && effect.slowMultiplier < 1 && effect.slowDurationMs > 0) {
              applySlowToMob(mob, effect.slowMultiplier, effect.slowDurationMs, now);
            }
          }
        }
        effect.nextTickAt += tickIntervalMs;
      }
    }
  }

  return {
    getAreaAbilityTargetPosition,
    createPersistentAreaEffect,
    createPersistentBeamEffect,
    createPersistentSummonEffect,
    tickAreaEffects
  };
}

module.exports = {
  createAreaEffectTools
};
