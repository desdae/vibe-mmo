function createProjectileEffectTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const applySlowToMob = typeof options.applySlowToMob === "function" ? options.applySlowToMob : () => {};
  const stunMob = typeof options.stunMob === "function" ? options.stunMob : () => {};
  const applyDotToMob = typeof options.applyDotToMob === "function" ? options.applyDotToMob : () => {};

  function applyProjectileHitEffects(mob, projectile, dealtDamage, now = Date.now()) {
    if (!mob || !mob.alive || dealtDamage <= 0 || !projectile) {
      return;
    }
    const slowDurationMs = Math.max(0, Number(projectile.slowDurationMs) || 0);
    const slowMultiplier = clamp(Number(projectile.slowMultiplier) || 1, 0.1, 1);
    if (slowDurationMs > 0 && slowMultiplier < 1) {
      applySlowToMob(mob, slowMultiplier, slowDurationMs, now);
    }
    const stunDurationMs = Math.max(0, Number(projectile.stunDurationMs) || 0);
    if (stunDurationMs > 0) {
      stunMob(mob, stunDurationMs, now);
    }
    const dotDurationMs = Math.max(0, Number(projectile.dotDurationMs) || 0);
    const dotDamageMin = Math.max(0, Number(projectile.dotDamageMin) || 0);
    const dotDamageMax = Math.max(dotDamageMin, Number(projectile.dotDamageMax) || dotDamageMin);
    if (dotDurationMs > 0 && dotDamageMax > 0) {
      applyDotToMob(
        mob,
        projectile.ownerId || null,
        String(projectile.dotSchool || "generic"),
        dotDamageMin,
        dotDamageMax,
        dotDurationMs,
        now
      );
    }
  }

  return {
    applyProjectileHitEffects
  };
}

module.exports = {
  createProjectileEffectTools
};
