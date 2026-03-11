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
    getAbilityDamageRangeForEntity,
    getAbilityDotDamageRange,
    getAbilityDotDamageRangeForEntity,
    getAbilityChainStatsForEntity,
    markAbilityUsed,
    applyDamageToMob,
    applyAbilityHitEffectsToMob,
    stunMob,
    queueExplosionEvent,
    getAreaAbilityTargetPosition,
    createPersistentAreaEffect,
    createPersistentBeamEffect,
    createPersistentSummonEffect,
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
    getAbilityDamageRangeForEntity,
    getAbilityDotDamageRange,
    getAbilityDotDamageRangeForEntity,
    getAbilityChainStatsForEntity,
    markAbilityUsed,
    applyDamageToMob,
    applyAbilityHitEffectsToMob,
    stunMob,
    queueExplosionEvent,
    getAreaAbilityTargetPosition,
    createPersistentAreaEffect,
    createPersistentBeamEffect,
    createPersistentSummonEffect,
    resolvePlayerMobCollisions,
    getAbilityInvulnerabilityDurationMs
  };
}

module.exports = {
  createAbilityHandlerContext
};
