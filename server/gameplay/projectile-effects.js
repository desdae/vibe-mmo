const { createEffectEngine } = require("./effects/effect-engine");
const { buildHitEffectDefsFromProjectile } = require("./effects/hit-effect-defs");

function createProjectileEffectTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const applySlowToMob = typeof options.applySlowToMob === "function" ? options.applySlowToMob : () => {};
  const stunMob = typeof options.stunMob === "function" ? options.stunMob : () => {};
  const applyDotToMob = typeof options.applyDotToMob === "function" ? options.applyDotToMob : () => {};
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : null;
  const effectEngine = createEffectEngine({ clamp, randomInt: randomInt || undefined });

  function applyProjectileHitEffects(mob, projectile, dealtDamage, now = Date.now()) {
    if (!mob || !mob.alive || dealtDamage <= 0 || !projectile) {
      return;
    }
    const hitEffectDefs = buildHitEffectDefsFromProjectile(projectile);
    if (hitEffectDefs.length) {
      const compiled = effectEngine.compile(hitEffectDefs, { defaultTrigger: "onHit" });
      effectEngine.run(compiled, "onHit", {
        now,
        source: { id: projectile.ownerId ? String(projectile.ownerId) : "" },
        target: mob,
        ops: {
          applySlow: (target, multiplier, durationMs, appliedAt) => applySlowToMob(target, multiplier, durationMs, appliedAt),
          applyStun: (target, durationMs, appliedAt) => stunMob(target, durationMs, appliedAt),
          applyDot: (target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt) =>
            applyDotToMob(target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt)
        }
      });
    }
  }

  return {
    applyProjectileHitEffects
  };
}

module.exports = {
  createProjectileEffectTools
};
