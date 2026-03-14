const { createEffectEngine } = require("./effects/effect-engine");
const { buildHitEffectDefsFromAbilityDef, buildHitEffectDefsFromProjectile } = require("./effects/hit-effect-defs");
const { normalizeId } = require("../utils/id-utils");

function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createPlayerCombatEffectTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : defaultRandomInt;
  const applyDamageToPlayer =
    typeof options.applyDamageToPlayer === "function" ? options.applyDamageToPlayer : () => 0;
  const getAbilityDotDamageRange =
    typeof options.getAbilityDotDamageRange === "function" ? options.getAbilityDotDamageRange : () => [0, 0];
  const getPlayerById = typeof options.getPlayerById === "function" ? options.getPlayerById : () => null;
  const normalizeIdFn = typeof options.normalizeId === "function" ? options.normalizeId : normalizeId;
  const effectEngine = createEffectEngine({ clamp, randomInt });

  const tools = {
    // Mutable callback; server.js wires talent handlers after tool creation.
    onTalentSpellHit: typeof options.onTalentSpellHit === "function" ? options.onTalentSpellHit : null
  };

  function clearPlayerCombatEffects(player) {
    if (!player) {
      return;
    }
    player.stunnedUntil = 0;
    player.stunAppliedAt = 0;
    player.stunDurationMs = 0;
    player.slowUntil = 0;
    player.slowMultiplier = 1;
    player.slowAppliedAt = 0;
    player.slowDurationMs = 0;
    player.burningUntil = 0;
    player.burnAppliedAt = 0;
    player.burnDurationMs = 0;
    if (player.activeDots instanceof Map) {
      player.activeDots.clear();
    } else {
      player.activeDots = new Map();
    }
  }

  function stunPlayer(player, durationMs, now = Date.now()) {
    if (!player || player.hp <= 0) {
      return;
    }
    if ((Number(player.crowdControlImmuneUntil) || 0) > now) {
      return;
    }
    const duration = Math.max(0, Math.floor(Number(durationMs) || 0));
    if (duration <= 0) {
      return;
    }
    const nextUntil = Math.max(Number(player.stunnedUntil) || 0, now + duration);
    player.stunnedUntil = nextUntil;
    player.stunAppliedAt = now;
    player.stunDurationMs = Math.max(1, nextUntil - now);
  }

  function applySlowToPlayer(player, slowMultiplier, durationMs, now = Date.now()) {
    if (!player || player.hp <= 0) {
      return;
    }
    if ((Number(player.crowdControlImmuneUntil) || 0) > now) {
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
    const nextUntil = Math.max(Number(player.slowUntil) || 0, now + duration);
    const active = Number(player.slowUntil) > now;
    if (active) {
      player.slowMultiplier = Math.min(clamp(Number(player.slowMultiplier) || 1, 0.1, 1), multiplier);
    } else {
      player.slowMultiplier = multiplier;
    }
    player.slowUntil = nextUntil;
    player.slowAppliedAt = now;
    player.slowDurationMs = Math.max(1, nextUntil - now);
  }

  function applyDotToPlayer(
    player,
    ownerId,
    school,
    damageMinPerSecond,
    damageMaxPerSecond,
    durationMs,
    now = Date.now()
  ) {
    if (!player || player.hp <= 0) {
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
    if (!(player.activeDots instanceof Map)) {
      player.activeDots = new Map();
    }
    const tickIntervalMs = 1000;
    const nextEndsAt = now + duration;
    const normalizedOwnerId = normalizeIdFn(ownerId);
    const existing = player.activeDots.get(schoolKey);
    if (existing) {
      existing.ownerId = normalizedOwnerId || existing.ownerId;
      existing.damageMin = Math.max(Number(existing.damageMin) || 0, dotMin);
      existing.damageMax = Math.max(Number(existing.damageMax) || existing.damageMin, dotMax);
      existing.endsAt = Math.max(Number(existing.endsAt) || 0, nextEndsAt);
      existing.nextTickAt = Math.min(Number(existing.nextTickAt) || now + tickIntervalMs, now + tickIntervalMs);
      player.activeDots.set(schoolKey, existing);
    } else {
      player.activeDots.set(schoolKey, {
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
      const fireUntil = Math.max(Number(player.burningUntil) || 0, nextEndsAt);
      player.burningUntil = fireUntil;
      player.burnAppliedAt = now;
      player.burnDurationMs = Math.max(1, fireUntil - now);
    }
  }

  function tickPlayerDotEffects(player, now = Date.now()) {
    if (!player || player.hp <= 0) {
      return;
    }
    const dots = player.activeDots;
    if (!(dots instanceof Map) || dots.size === 0) {
      player.burningUntil = 0;
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
        if (player.hp <= 0) {
          break;
        }
        const dealt = applyDamageToPlayer(player, randomInt(Math.floor(dot.damageMin), Math.ceil(dot.damageMax)), now);
        dot.nextTickAt += tickIntervalMs;
        if (player.hp <= 0 || dealt <= 0) {
          break;
        }
      }
      if (player.hp <= 0) {
        break;
      }
      dots.set(schoolKey, dot);
    }

    if (player.hp <= 0) {
      dots.clear();
      player.burningUntil = 0;
      return;
    }
    if (dots.size <= 0) {
      player.burningUntil = 0;
    } else if (fireEndsAt > now) {
      player.burningUntil = fireEndsAt;
    } else {
      player.burningUntil = 0;
    }
  }

  function applyAbilityHitEffectsToPlayer(player, ownerId, abilityDef, abilityLevel, dealtDamage, now = Date.now()) {
    if (!player || player.hp <= 0 || dealtDamage <= 0 || !abilityDef) {
      return;
    }

    const normalizedOwnerId = normalizeIdFn(ownerId);
    const hitEffectDefs = buildHitEffectDefsFromAbilityDef(abilityDef, abilityLevel, getAbilityDotDamageRange);
    if (hitEffectDefs.length) {
      const compiled = effectEngine.compile(hitEffectDefs, { defaultTrigger: "onHit" });
      effectEngine.run(compiled, "onHit", {
        now,
        source: { id: normalizedOwnerId || "" },
        target: player,
        ops: {
          applySlow: (target, multiplier, durationMs, appliedAt) =>
            applySlowToPlayer(target, multiplier, durationMs, appliedAt),
          applyStun: (target, durationMs, appliedAt) => stunPlayer(target, durationMs, appliedAt),
          applyDot: (target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt) =>
            applyDotToPlayer(target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt)
        }
      });
    }
    
    // Trigger talent on-spell-hit effects (for PvP)
    const ownerPlayer = normalizedOwnerId ? getPlayerById(normalizedOwnerId) : null;
    if (ownerPlayer) {
      const handler = typeof tools.onTalentSpellHit === "function" ? tools.onTalentSpellHit : null;
      if (handler) {
        handler(ownerPlayer, player, abilityDef, now);
      }
    }
  }

  function applyProjectileHitEffectsToPlayer(player, projectile, dealtDamage, now = Date.now()) {
    if (!player || player.hp <= 0 || dealtDamage <= 0 || !projectile) {
      return;
    }

    const normalizedProjectileOwnerId = normalizeIdFn(projectile.ownerId);
    const hitEffectDefs = buildHitEffectDefsFromProjectile(projectile);
    if (hitEffectDefs.length) {
      const compiled = effectEngine.compile(hitEffectDefs, { defaultTrigger: "onHit" });
      effectEngine.run(compiled, "onHit", {
        now,
        source: { id: normalizedProjectileOwnerId || "" },
        target: player,
        ops: {
          applySlow: (target, multiplier, durationMs, appliedAt) =>
            applySlowToPlayer(target, multiplier, durationMs, appliedAt),
          applyStun: (target, durationMs, appliedAt) => stunPlayer(target, durationMs, appliedAt),
          applyDot: (target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt) =>
            applyDotToPlayer(target, dotOwnerId, school, damageMin, damageMax, durationMs, appliedAt)
        }
      });
    }

    // Trigger talent on-spell-hit effects for projectile hits (for PvP).
    const ownerPlayer = normalizedProjectileOwnerId ? getPlayerById(normalizedProjectileOwnerId) : null;
    if (ownerPlayer) {
      const handler = typeof tools.onTalentSpellHit === "function" ? tools.onTalentSpellHit : null;
      if (handler) {
        handler(ownerPlayer, player, null, now);
      }
    }
  }

  tools.clearPlayerCombatEffects = clearPlayerCombatEffects;
  tools.stunPlayer = stunPlayer;
  tools.applySlowToPlayer = applySlowToPlayer;
  tools.applyDotToPlayer = applyDotToPlayer;
  tools.tickPlayerDotEffects = tickPlayerDotEffects;
  tools.applyAbilityHitEffectsToPlayer = applyAbilityHitEffectsToPlayer;
  tools.applyProjectileHitEffectsToPlayer = applyProjectileHitEffectsToPlayer;
  return tools;
}

module.exports = {
  createPlayerCombatEffectTools
};
