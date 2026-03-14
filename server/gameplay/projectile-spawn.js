function createProjectileSpawnTools(options = {}) {
  const normalizeDirection =
    typeof options.normalizeDirection === "function" ? options.normalizeDirection : () => null;
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const allocateProjectileId =
    typeof options.allocateProjectileId === "function" ? options.allocateProjectileId : () => String(Date.now());
  const projectiles = options.projectiles;
  const mapWidth = Math.max(1, Number(options.mapWidth) || 1);
  const mapHeight = Math.max(1, Number(options.mapHeight) || 1);
  const defaultProjectileHitRadius = Math.max(0.01, Number(options.defaultProjectileHitRadius) || 0.6);

  if (!(projectiles instanceof Map)) {
    throw new Error("createProjectileSpawnTools requires projectiles map");
  }

  function normalizeProjectileTargetType(targetType, fallback = "mob") {
    const normalized = String(targetType || "").trim().toLowerCase();
    if (normalized === "player") {
      return "player";
    }
    if (normalized === "mob") {
      return "mob";
    }
    return fallback === "player" ? "player" : "mob";
  }

  function inferProjectileTargetTypeFromOwner(ownerId) {
    const ownerKey = String(ownerId || "").trim().toLowerCase();
    if (ownerKey.startsWith("mob:")) {
      return "player";
    }
    return "mob";
  }

  function spawnProjectileFromTemplate(
    ownerId,
    sourceX,
    sourceY,
    direction,
    template,
    abilityLevel,
    now = Date.now(),
    defaultTargetType = ""
  ) {
    if (!template || !direction) {
      return false;
    }
    const dir = normalizeDirection(direction.dx, direction.dy);
    if (!dir) {
      return false;
    }

    const level = Math.max(1, Math.floor(Number(abilityLevel) || 1));
    const levelOffset = Math.max(0, level - 1);
    const speed = Math.max(0.1, Number(template.speed) || 1);
    const range = Math.max(0.25, Number(template.range) || 4);
    const ttlMs = Math.max(120, Math.round((range / speed) * 1000));
    const damageMin = clamp(
      Math.floor((Number(template.damageMin) || 0) + (Number(template.damagePerLevelMin) || 0) * levelOffset),
      0,
      65535
    );
    const damageMax = clamp(
      Math.ceil((Number(template.damageMax) || damageMin) + (Number(template.damagePerLevelMax) || 0) * levelOffset),
      damageMin,
      65535
    );
    const dotDamageMin = Math.max(
      0,
      Number(template.dotDamageMin) + (Number(template.dotDamagePerLevelMin) || 0) * levelOffset
    );
    const dotDamageMax = Math.max(
      dotDamageMin,
      Number(template.dotDamageMax) + (Number(template.dotDamagePerLevelMax) || 0) * levelOffset
    );

    const projectile = {
      id: String(allocateProjectileId()),
      ownerId: String(ownerId || ""),
      targetType: normalizeProjectileTargetType(defaultTargetType, inferProjectileTargetTypeFromOwner(ownerId)),
      x: clamp(Number(sourceX) + dir.dx * 0.35, 0, mapWidth - 1),
      y: clamp(Number(sourceY) + dir.dy * 0.35, 0, mapHeight - 1),
      dx: dir.dx,
      dy: dir.dy,
      speed,
      ttlMs,
      createdAt: now,
      damageMin,
      damageMax,
      hitRadius: clamp(Number(template.hitRadius) || defaultProjectileHitRadius, 0.1, 8),
      explosionRadius: Math.max(0, Number(template.explosionRadius) || 0),
      explosionDamageMultiplier: clamp(Number(template.explosionDamageMultiplier) || 0, 0, 1),
      slowDurationMs: Math.max(0, Number(template.slowDurationMs) || 0),
      slowMultiplier: clamp(Number(template.slowMultiplier) || 1, 0.1, 1),
      stunDurationMs: Math.max(0, Number(template.stunDurationMs) || 0),
      dotDamageMin,
      dotDamageMax,
      dotDurationMs: Math.max(0, Number(template.dotDurationMs) || 0),
      dotSchool: String(template.dotSchool || "generic"),
      explodeOnExpire: template.explodeOnExpire !== false,
      homingRange: Math.max(0, Number(template.homingRange) || 0),
      homingTurnRate: Math.max(0, Number(template.homingTurnRate) || 0),
      abilityId: String(template.id || "child_projectile"),
      emitProjectiles: null
    };
    projectiles.set(projectile.id, projectile);
    return true;
  }

  return {
    normalizeProjectileTargetType,
    inferProjectileTargetTypeFromOwner,
    spawnProjectileFromTemplate
  };
}

module.exports = {
  createProjectileSpawnTools
};
