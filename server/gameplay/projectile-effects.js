const { createEffectEngine } = require("./effects/effect-engine");
const { buildHitEffectDefsFromProjectile } = require("./effects/hit-effect-defs");
const { normalizeId } = require("../utils/id-utils");

function createProjectileEffectTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const applySlowToMob = typeof options.applySlowToMob === "function" ? options.applySlowToMob : () => {};
  const stunMob = typeof options.stunMob === "function" ? options.stunMob : () => {};
  const applyDotToMob = typeof options.applyDotToMob === "function" ? options.applyDotToMob : () => {};
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : null;
  const getPlayerById = typeof options.getPlayerById === "function" ? options.getPlayerById : () => null;
  const normalizeIdFn = typeof options.normalizeId === "function" ? options.normalizeId : normalizeId;
  const effectEngine = createEffectEngine({ clamp, randomInt: randomInt || undefined });

  const tools = {
    // Mutable callback; server.js wires talent handlers after tool creation.
    onTalentSpellHit: typeof options.onTalentSpellHit === "function" ? options.onTalentSpellHit : null
  };

  function applyProjectileHitEffects(mob, projectile, dealtDamage, now = Date.now()) {
    if (!mob || !mob.alive || dealtDamage <= 0 || !projectile) {
      return;
    }
    const normalizedOwnerId = normalizeIdFn(projectile.ownerId);
    const hitEffectDefs = buildHitEffectDefsFromProjectile(projectile);
    if (hitEffectDefs.length) {
      const compiled = effectEngine.compile(hitEffectDefs, { defaultTrigger: "onHit" });
      effectEngine.run(compiled, "onHit", {
        now,
        source: { id: normalizedOwnerId || "" },
        target: mob,
        ops: {
          applySlow: (target, multiplier, durationMs, appliedAt) => applySlowToMob(target, multiplier, durationMs, appliedAt),
          applyStun: (target, durationMs, appliedAt) => stunMob(target, durationMs, appliedAt),
          applyDot: (target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt) =>
            applyDotToMob(target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt)
        }
      });
    }

    // Trigger talent on-spell-hit effects for projectile impacts.
    const ownerPlayer = normalizedOwnerId ? getPlayerById(normalizedOwnerId) : null;
    if (ownerPlayer) {
      const handler = typeof tools.onTalentSpellHit === "function" ? tools.onTalentSpellHit : null;
      if (handler) {
        handler(ownerPlayer, mob, null, now);
      }
    }
  }

  tools.applyProjectileHitEffects = applyProjectileHitEffects;
  return tools;
}

module.exports = {
  createProjectileEffectTools
};
