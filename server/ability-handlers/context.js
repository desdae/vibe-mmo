function createAbilityHandlerContext(params = {}) {
  const {
    mobs,
    projectiles,
    mapWidth,
    mapHeight,
    defaultProjectileHitRadius,
    allocateProjectileId,
    clamp,
    normalizeDirection,
    randomInt,
    rotateDirection,
    getAbilityRangeForLevel,
    getAbilityDamageRange,
    getAbilityDotDamageRange,
    markAbilityUsed,
    applyDamageToMob,
    applyAbilityHitEffectsToMob,
    stunMob,
    queueExplosionEvent,
    getAreaAbilityTargetPosition,
    createPersistentAreaEffect,
    createPersistentBeamEffect,
    resolvePlayerMobCollisions,
    getAbilityInvulnerabilityDurationMs
  } = params;

  return {
    mobs,
    projectiles,
    mapWidth,
    mapHeight,
    defaultProjectileHitRadius,
    allocateProjectileId,
    clamp,
    normalizeDirection,
    randomInt,
    rotateDirection,
    getAbilityRangeForLevel,
    getAbilityDamageRange,
    getAbilityDotDamageRange,
    markAbilityUsed,
    applyDamageToMob,
    applyAbilityHitEffectsToMob,
    stunMob,
    queueExplosionEvent,
    getAreaAbilityTargetPosition,
    createPersistentAreaEffect,
    createPersistentBeamEffect,
    resolvePlayerMobCollisions,
    getAbilityInvulnerabilityDurationMs
  };
}

module.exports = {
  createAbilityHandlerContext
};
