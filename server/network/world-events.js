function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createWorldEventQueues(options = {}) {
  const mapWidth = Math.max(1, Number(options.mapWidth) || 1);
  const mapHeight = Math.max(1, Number(options.mapHeight) || 1);

  const pendingDamageEvents = [];
  const pendingExplosionEvents = [];
  const pendingProjectileHitEvents = [];
  const pendingMobDeathEvents = [];
  const pendingLineEvents = [];

  function queueDamageEvent(target, amount, targetType, sourcePlayerId = null) {
    const dmg = Math.max(0, Math.round(Number(amount) || 0));
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || dmg <= 0) {
      return;
    }

    pendingDamageEvents.push({
      x: target.x,
      y: target.y,
      amount: dmg,
      targetType: targetType === "player" ? "player" : "mob",
      sourcePlayerId: sourcePlayerId ? String(sourcePlayerId) : null
    });
  }

  function queueExplosionEvent(x, y, radius, abilityId = "") {
    const eventRadius = Math.max(0, Number(radius) || 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || eventRadius <= 0) {
      return;
    }

    pendingExplosionEvents.push({
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
      radius: eventRadius,
      abilityId: String(abilityId || "").slice(0, 32)
    });
  }

  function queueLineEvent(startX, startY, endX, endY, abilityId = "", durationMs = 0) {
    if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(endX) || !Number.isFinite(endY)) {
      return;
    }
    pendingLineEvents.push({
      startX: clamp(startX, 0, mapWidth - 1),
      startY: clamp(startY, 0, mapHeight - 1),
      endX: clamp(endX, 0, mapWidth - 1),
      endY: clamp(endY, 0, mapHeight - 1),
      abilityId: String(abilityId || "").slice(0, 32),
      durationMs: Math.max(0, Math.round(Number(durationMs) || 0))
    });
  }

  function queueProjectileHitEvent(x, y, abilityId = "") {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    const normalizedAbilityId = String(abilityId || "").slice(0, 32);
    if (!normalizedAbilityId) {
      return;
    }
    pendingProjectileHitEvents.push({
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
      abilityId: normalizedAbilityId
    });
  }

  function queueMobDeathEvent(mob) {
    if (!mob || !Number.isFinite(mob.x) || !Number.isFinite(mob.y)) {
      return;
    }
    pendingMobDeathEvents.push({
      x: clamp(mob.x, 0, mapWidth - 1),
      y: clamp(mob.y, 0, mapHeight - 1),
      mobType: String(mob.type || "Mob").slice(0, 48)
    });
  }

  return {
    pendingDamageEvents,
    pendingExplosionEvents,
    pendingProjectileHitEvents,
    pendingMobDeathEvents,
    pendingLineEvents,
    queueDamageEvent,
    queueExplosionEvent,
    queueLineEvent,
    queueProjectileHitEvent,
    queueMobDeathEvent
  };
}

module.exports = {
  createWorldEventQueues
};
