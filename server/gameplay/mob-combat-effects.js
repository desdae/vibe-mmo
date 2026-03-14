const { createEffectEngine } = require("./effects/effect-engine");
const { buildHitEffectDefsFromAbilityDef } = require("./effects/hit-effect-defs");
const { normalizeId } = require("../utils/id-utils");

function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createMobCombatEffectTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : defaultRandomInt;
  const applyDamageToMob = typeof options.applyDamageToMob === "function" ? options.applyDamageToMob : () => 0;
  const getAbilityDotDamageRange =
    typeof options.getAbilityDotDamageRange === "function" ? options.getAbilityDotDamageRange : () => [0, 0];
  const getPlayerById = typeof options.getPlayerById === "function" ? options.getPlayerById : () => null;
  const normalizeIdFn = typeof options.normalizeId === "function" ? options.normalizeId : normalizeId;
  const effectEngine = createEffectEngine({ clamp, randomInt });

  const tools = {
    // Mutable callback; server.js wires talent handlers after tool creation.
    onTalentSpellHit: typeof options.onTalentSpellHit === "function" ? options.onTalentSpellHit : null
  };

  function stunMob(mob, durationMs, now = Date.now()) {
    if (!mob) {
      return;
    }
    const duration = Math.max(0, Math.floor(Number(durationMs) || 0));
    if (duration <= 0) {
      return;
    }
    mob.stunnedUntil = Math.max(Number(mob.stunnedUntil) || 0, now + duration);
    mob.wanderTarget = null;
  }

  function applySlowToMob(mob, slowMultiplier, durationMs, now = Date.now()) {
    if (!mob || !mob.alive) {
      return;
    }
    const duration = Math.max(0, Math.round(Number(durationMs) || 0));
    if (duration <= 0) {
      return;
    }
    const multiplier = clamp(Number(slowMultiplier) || 1, 0.1, 1);
    if (multiplier >= 1) {
      return;
    }

    const active = Number(mob.slowUntil) > now;
    if (active) {
      mob.slowUntil = Math.max(Number(mob.slowUntil) || 0, now + duration);
      mob.slowMultiplier = Math.min(clamp(Number(mob.slowMultiplier) || 1, 0.1, 1), multiplier);
    } else {
      mob.slowUntil = now + duration;
      mob.slowMultiplier = multiplier;
    }
  }

  function applyDotToMob(
    mob,
    ownerId,
    school,
    damageMinPerSecond,
    damageMaxPerSecond,
    durationMs,
    now = Date.now()
  ) {
    if (!mob || !mob.alive) {
      return;
    }
    const duration = Math.max(0, Math.round(Number(durationMs) || 0));
    if (duration <= 0) {
      return;
    }
    const dotMin = Math.max(0, Number(damageMinPerSecond) || 0);
    const dotMax = Math.max(dotMin, Number(damageMaxPerSecond) || dotMin);
    if (dotMax <= 0) {
      return;
    }
    const schoolKey = String(school || "generic").trim().toLowerCase() || "generic";
    if (!(mob.activeDots instanceof Map)) {
      mob.activeDots = new Map();
    }
    const tickIntervalMs = 1000;
    const nextEndsAt = now + duration;
    const normalizedOwnerId = normalizeIdFn(ownerId);
    const existing = mob.activeDots.get(schoolKey);
    if (existing) {
      existing.ownerId = normalizedOwnerId || existing.ownerId;
      existing.damageMin = Math.max(Number(existing.damageMin) || 0, dotMin);
      existing.damageMax = Math.max(Number(existing.damageMax) || existing.damageMin, dotMax);
      existing.endsAt = Math.max(Number(existing.endsAt) || 0, nextEndsAt);
      existing.nextTickAt = Math.min(Number(existing.nextTickAt) || now + tickIntervalMs, now + tickIntervalMs);
      mob.activeDots.set(schoolKey, existing);
    } else {
      mob.activeDots.set(schoolKey, {
        school: schoolKey,
        ownerId: normalizedOwnerId || "",
        damageMin: dotMin,
        damageMax: dotMax,
        tickIntervalMs,
        nextTickAt: now + tickIntervalMs,
        endsAt: nextEndsAt
      });
    }
    if (schoolKey === "fire") {
      mob.burningUntil = Math.max(Number(mob.burningUntil) || 0, nextEndsAt);
    }
  }

  function tickMobDotEffects(mob, now = Date.now()) {
    if (!mob || !mob.alive) {
      return;
    }
    const dots = mob.activeDots;
    if (!(dots instanceof Map) || dots.size === 0) {
      mob.burningUntil = 0;
      return;
    }

    let fireEndsAt = 0;
    for (const [schoolKey, dot] of Array.from(dots.entries())) {
      const endsAt = Math.max(0, Math.floor(Number(dot.endsAt) || 0));
      if (endsAt <= now) {
        dots.delete(schoolKey);
        continue;
      }
      if (schoolKey === "fire") {
        fireEndsAt = Math.max(fireEndsAt, endsAt);
      }

      const tickIntervalMs = Math.max(100, Math.floor(Number(dot.tickIntervalMs) || 1000));
      while (Number(dot.nextTickAt) <= now && Number(dot.nextTickAt) < endsAt + 5) {
        if (!mob.alive) {
          break;
        }
        const dealt = applyDamageToMob(
          mob,
          randomInt(Math.floor(dot.damageMin), Math.ceil(dot.damageMax)),
          dot.ownerId || null
        );
        dot.nextTickAt += tickIntervalMs;
        if (!mob.alive || dealt <= 0) {
          break;
        }
      }

      if (!mob.alive) {
        break;
      }
      dots.set(schoolKey, dot);
    }

    if (!mob.alive) {
      if (dots instanceof Map) {
        dots.clear();
      }
      mob.burningUntil = 0;
      return;
    }

    if (dots.size <= 0) {
      mob.burningUntil = 0;
    } else if (fireEndsAt > now) {
      mob.burningUntil = fireEndsAt;
    } else {
      mob.burningUntil = 0;
    }
  }

  function applyAbilityHitEffectsToMob(mob, ownerId, abilityDef, abilityLevel, dealtDamage, now = Date.now()) {
    if (!mob || !mob.alive || dealtDamage <= 0 || !abilityDef) {
      return;
    }

    const normalizedOwnerId = normalizeIdFn(ownerId);
    const hitEffectDefs = buildHitEffectDefsFromAbilityDef(abilityDef, abilityLevel, getAbilityDotDamageRange);
    if (hitEffectDefs.length) {
      const compiled = effectEngine.compile(hitEffectDefs, { defaultTrigger: "onHit" });
      effectEngine.run(compiled, "onHit", {
        now,
        source: { id: normalizedOwnerId || "" },
        target: mob,
        ops: {
          applySlow: (target, multiplier, durationMs, appliedAt) =>
            applySlowToMob(target, multiplier, durationMs, appliedAt),
          applyStun: (target, durationMs, appliedAt) => stunMob(target, durationMs, appliedAt),
          applyDot: (target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt) =>
            applyDotToMob(target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt)
        }
      });
    }
    
    // Trigger talent on-spell-hit effects
    const ownerPlayer = normalizedOwnerId ? getPlayerById(normalizedOwnerId) : null;
    if (ownerPlayer) {
      const handler = typeof tools.onTalentSpellHit === "function" ? tools.onTalentSpellHit : null;
      if (handler) {
        handler(ownerPlayer, mob, abilityDef, now);
      }
    }
  }

  tools.stunMob = stunMob;
  tools.applySlowToMob = applySlowToMob;
  tools.applyDotToMob = applyDotToMob;
  tools.tickMobDotEffects = tickMobDotEffects;
  tools.applyAbilityHitEffectsToMob = applyAbilityHitEffectsToMob;
  return tools;
}

module.exports = {
  createMobCombatEffectTools
};
