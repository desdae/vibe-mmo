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
    const existing = player.activeDots.get(schoolKey);
    if (existing) {
      existing.ownerId = ownerId ? String(ownerId) : existing.ownerId;
      existing.damageMin = Math.max(Number(existing.damageMin) || 0, dotMin);
      existing.damageMax = Math.max(Number(existing.damageMax) || existing.damageMin, dotMax);
      existing.endsAt = Math.max(Number(existing.endsAt) || 0, nextEndsAt);
      existing.nextTickAt = Math.min(Number(existing.nextTickAt) || now + tickIntervalMs, now + tickIntervalMs);
      player.activeDots.set(schoolKey, existing);
    } else {
      player.activeDots.set(schoolKey, {
        school: schoolKey,
        ownerId: ownerId ? String(ownerId) : "",
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
    const slowDurationMs = Math.max(0, Number(abilityDef.slowDurationMs) || 0);
    const slowMultiplier = clamp(Number(abilityDef.slowMultiplier) || 1, 0.1, 1);
    if (slowDurationMs > 0 && slowMultiplier < 1) {
      applySlowToPlayer(player, slowMultiplier, slowDurationMs, now);
    }
    const stunDurationMs = Math.max(0, Number(abilityDef.stunDurationMs) || 0);
    if (stunDurationMs > 0) {
      stunPlayer(player, stunDurationMs, now);
    }
    const dotDurationMs = Math.max(0, Number(abilityDef.dotDurationMs) || 0);
    const [dotDamageMin, dotDamageMax] = getAbilityDotDamageRange(abilityDef, abilityLevel);
    if (dotDurationMs > 0 && dotDamageMax > 0) {
      applyDotToPlayer(
        player,
        ownerId,
        String(abilityDef.dotSchool || "generic"),
        dotDamageMin,
        dotDamageMax,
        dotDurationMs,
        now
      );
    }
    
    // Trigger talent on-spell-hit effects (for PvP)
    const onTalentSpellHit = typeof options.onTalentSpellHit === "function" ? options.onTalentSpellHit : () => {};
    const getPlayerById = typeof options.getPlayerById === "function" ? options.getPlayerById : () => null;
    const ownerPlayer = ownerId ? getPlayerById(String(ownerId)) : null;
    if (ownerPlayer) {
      onTalentSpellHit(ownerPlayer, player, abilityDef, now);
    }
  }

  function applyProjectileHitEffectsToPlayer(player, projectile, dealtDamage, now = Date.now()) {
    if (!player || player.hp <= 0 || dealtDamage <= 0 || !projectile) {
      return;
    }
    const slowDurationMs = Math.max(0, Number(projectile.slowDurationMs) || 0);
    const slowMultiplier = clamp(Number(projectile.slowMultiplier) || 1, 0.1, 1);
    if (slowDurationMs > 0 && slowMultiplier < 1) {
      applySlowToPlayer(player, slowMultiplier, slowDurationMs, now);
    }
    const stunDurationMs = Math.max(0, Number(projectile.stunDurationMs) || 0);
    if (stunDurationMs > 0) {
      stunPlayer(player, stunDurationMs, now);
    }
    const dotDurationMs = Math.max(0, Number(projectile.dotDurationMs) || 0);
    const dotDamageMin = Math.max(0, Number(projectile.dotDamageMin) || 0);
    const dotDamageMax = Math.max(dotDamageMin, Number(projectile.dotDamageMax) || dotDamageMin);
    if (dotDurationMs > 0 && dotDamageMax > 0) {
      applyDotToPlayer(
        player,
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
    clearPlayerCombatEffects,
    stunPlayer,
    applySlowToPlayer,
    applyDotToPlayer,
    tickPlayerDotEffects,
    applyAbilityHitEffectsToPlayer,
    applyProjectileHitEffectsToPlayer
  };
}

module.exports = {
  createPlayerCombatEffectTools
};
