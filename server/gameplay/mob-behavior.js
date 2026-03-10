function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createMobBehaviorTools(options = {}) {
  const players = options.players;
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;
  const getMobCombatProfile =
    typeof options.getMobCombatProfile === "function" ? options.getMobCombatProfile : () => ({});
  const getMobSpeedMultiplier =
    typeof options.getMobSpeedMultiplier === "function" ? options.getMobSpeedMultiplier : () => 1;
  const mobProvokedChaseMs = Math.max(0, Number(options.mobProvokedChaseMs) || 0);
  const mobProvokedLeashRadius = Math.max(1, Number(options.mobProvokedLeashRadius) || 1);
  const mobWanderRadius = Math.max(1, Number(options.mobWanderRadius) || 1);

  if (!(players instanceof Map)) {
    throw new Error("createMobBehaviorTools requires players map");
  }

  function markMobProvokedByPlayer(mob, ownerId, now = Date.now()) {
    if (!mob || !ownerId) {
      return;
    }
    const ownerKey = String(ownerId);
    const owner = players.get(ownerKey);
    if (!owner || owner.hp <= 0) {
      return;
    }
    mob.chaseTargetPlayerId = ownerKey;
    mob.chaseUntil = Math.max(Number(mob.chaseUntil) || 0, now + mobProvokedChaseMs);
    mob.wanderTarget = null;
    mob.returningHome = false;
  }

  function hasActiveProvokedChase(mob, now = Date.now()) {
    return !!(mob && mob.chaseTargetPlayerId && Number(mob.chaseUntil) > now);
  }

  function getMobDistanceFromSpawn(mob) {
    if (!mob) {
      return 0;
    }
    return Math.hypot((mob.x || 0) - (mob.spawnX || 0), (mob.y || 0) - (mob.spawnY || 0));
  }

  function getMobLeashRadius(mob, now = Date.now()) {
    const combat = getMobCombatProfile(mob);
    const configuredLeash = Math.max(1, Number(combat.leashRange) || mobWanderRadius);
    if (hasActiveProvokedChase(mob, now)) {
      return Math.max(configuredLeash, mobProvokedLeashRadius);
    }
    return Math.max(configuredLeash, getMobDistanceFromSpawn(mob));
  }

  function startMobReturnToSpawn(mob) {
    if (!mob) {
      return;
    }
    mob.chaseTargetPlayerId = null;
    mob.chaseUntil = 0;
    mob.wanderTarget = null;
    mob.returningHome = true;
  }

  function getMobMoveSpeed(mob, now = Date.now()) {
    const baseSpeed = clamp(Number(mob?.baseSpeed) || Number(mob?.speed) || 0.5, 0.05, 20);
    let slowMultiplier = 1;
    if (mob && Number(mob.slowUntil) > now) {
      slowMultiplier = clamp(Number(mob.slowMultiplier) || 1, 0.1, 1);
    } else if (mob && (mob.slowUntil || mob.slowMultiplier !== 1)) {
      mob.slowUntil = 0;
      mob.slowMultiplier = 1;
    }
    const speedMultiplier = clamp(Number(getMobSpeedMultiplier()) || 1, 0, 1000);
    return clamp(baseSpeed * speedMultiplier * slowMultiplier, 0.05, 20);
  }

  return {
    markMobProvokedByPlayer,
    hasActiveProvokedChase,
    getMobDistanceFromSpawn,
    getMobLeashRadius,
    startMobReturnToSpawn,
    getMobMoveSpeed
  };
}

module.exports = {
  createMobBehaviorTools
};
