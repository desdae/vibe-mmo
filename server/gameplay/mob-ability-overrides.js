function createMobAbilityOverrideResolver(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const parseNumericRange =
    typeof options.parseNumericRange === "function"
      ? options.parseNumericRange
      : (value, fallbackMin, fallbackMax) => [fallbackMin, fallbackMax];
  const parseBoolean =
    typeof options.parseBoolean === "function" ? options.parseBoolean : (_value, fallback) => fallback;
  const getObjectPath = typeof options.getObjectPath === "function" ? options.getObjectPath : () => undefined;
  const findAbilityEffect = typeof options.findAbilityEffect === "function" ? options.findAbilityEffect : () => null;

  function resolveMobAbilityOverrideDef(baseAbilityDef, abilityEntry) {
    if (!baseAbilityDef || !abilityEntry || typeof abilityEntry !== "object") {
      return baseAbilityDef;
    }

    const source =
      abilityEntry.config && typeof abilityEntry.config === "object" ? abilityEntry.config : abilityEntry;
    const targeting = source.targeting && typeof source.targeting === "object" ? source.targeting : {};
    const delivery = source.delivery && typeof source.delivery === "object" ? source.delivery : {};
    const effects = Array.isArray(source.effects) ? source.effects : [];
    const resolved = { ...baseAbilityDef };

    const pickNumber = (...values) => {
      for (const value of values) {
        if (value === null || value === undefined) {
          continue;
        }
        if (typeof value === "string" && value.trim() === "") {
          continue;
        }
        const n = Number(value);
        if (Number.isFinite(n)) {
          return n;
        }
      }
      return null;
    };

    const setRange = pickNumber(targeting.range, source.range);
    if (setRange !== null) {
      resolved.range = Math.max(0, setRange);
    }

    const setSpeed = pickNumber(targeting.speed, source.speed);
    if (setSpeed !== null && setSpeed > 0) {
      resolved.speed = Math.max(0.1, setSpeed);
    }

    const setProjectileCount = pickNumber(targeting.projectileCount, source.projectileCount);
    if (setProjectileCount !== null) {
      resolved.projectileCount = clamp(Math.floor(setProjectileCount), 1, 12);
    }

    const setSpreadDeg = pickNumber(targeting.spreadDeg, targeting.spreadAngle, source.spreadDeg, source.spreadAngle);
    if (setSpreadDeg !== null && setSpreadDeg >= 0) {
      resolved.spreadDeg = Math.max(0, setSpreadDeg);
    }

    const setHomingRange = pickNumber(
      getObjectPath(targeting, "homing.range"),
      targeting.homingRange,
      source.homingRange
    );
    if (setHomingRange !== null && setHomingRange >= 0) {
      resolved.homingRange = Math.max(0, setHomingRange);
    }

    const setHomingTurnRate = pickNumber(
      getObjectPath(targeting, "homing.turnRate"),
      getObjectPath(targeting, "homing.homingTurnRate"),
      targeting.homingTurnRate,
      targeting.turnRate,
      source.homingTurnRate,
      source.turnRate
    );
    if (setHomingTurnRate !== null && setHomingTurnRate >= 0) {
      resolved.homingTurnRate = Math.max(0, setHomingTurnRate);
    }

    const setHitRadius = pickNumber(
      targeting.projectileHitRadius,
      targeting.hitRadius,
      source.projectileHitRadius,
      source.hitRadius
    );
    if (setHitRadius !== null && setHitRadius > 0) {
      resolved.projectileHitRadius = clamp(setHitRadius, 0.1, 8);
    }

    const setAreaRadius = pickNumber(targeting.radius, targeting.areaRadius, source.radius, source.areaRadius);
    if (setAreaRadius !== null && setAreaRadius > 0) {
      resolved.areaRadius = Math.max(0.1, setAreaRadius);
    }

    const setBeamWidth = pickNumber(targeting.width, targeting.beamWidth, source.width, source.beamWidth);
    if (setBeamWidth !== null && setBeamWidth > 0) {
      resolved.beamWidth = Math.max(0.2, setBeamWidth);
    }

    const setExplosionRadius = pickNumber(targeting.explosionRadius, source.explosionRadius);
    if (setExplosionRadius !== null && setExplosionRadius >= 0) {
      resolved.explosionRadius = Math.max(0, setExplosionRadius);
    }

    const setExplosionMultiplier = pickNumber(targeting.explosionDamageMultiplier, source.explosionDamageMultiplier);
    if (setExplosionMultiplier !== null) {
      resolved.explosionDamageMultiplier = clamp(setExplosionMultiplier, 0, 1);
    }

    const castMsDirect = pickNumber(source.castMs, delivery.castMs);
    if (castMsDirect !== null) {
      resolved.castMs = Math.max(0, Math.round(castMsDirect));
    } else {
      const castSeconds = pickNumber(source.castTime, delivery.castTime);
      if (castSeconds !== null) {
        resolved.castMs = Math.max(0, Math.round(castSeconds * 1000));
      }
    }

    const explodeOnExpire = parseBoolean(
      getObjectPath(targeting, "explodeOnExpire"),
      parseBoolean(source.explodeOnExpire, undefined)
    );
    if (explodeOnExpire !== undefined) {
      resolved.explodeOnExpire = explodeOnExpire !== false;
    }

    const instantDamageEffect = findAbilityEffect(effects, "damage", "instant");
    const instantDamageRange = instantDamageEffect
      ? parseNumericRange(instantDamageEffect.amount, resolved.damageMin, resolved.damageMax)
      : source.damageRange !== undefined
        ? parseNumericRange(source.damageRange, resolved.damageMin, resolved.damageMax)
        : null;
    if (instantDamageRange) {
      resolved.damageMin = clamp(
        Math.floor(Math.min(instantDamageRange[0], instantDamageRange[1])),
        0,
        255
      );
      resolved.damageMax = clamp(
        Math.ceil(Math.max(instantDamageRange[0], instantDamageRange[1])),
        resolved.damageMin,
        255
      );
    }
    const instantScaling = instantDamageEffect
      ? parseNumericRange(
          instantDamageEffect.scalingPerLevel,
          resolved.damagePerLevelMin,
          resolved.damagePerLevelMax
        )
      : source.damageRangePerLevel !== undefined
        ? parseNumericRange(source.damageRangePerLevel, resolved.damagePerLevelMin, resolved.damagePerLevelMax)
        : null;
    if (instantScaling) {
      resolved.damagePerLevelMin = Math.max(0, Number(instantScaling[0]) || 0);
      resolved.damagePerLevelMax = Math.max(0, Number(instantScaling[1]) || 0);
    }

    const dotDamageEffect = findAbilityEffect(effects, "damage", "overtime");
    const dotRange = dotDamageEffect
      ? parseNumericRange(
          dotDamageEffect.amountPerSecond || dotDamageEffect.amount,
          resolved.dotDamageMin,
          resolved.dotDamageMax
        )
      : source.dotDamagePerSecond !== undefined
        ? parseNumericRange(source.dotDamagePerSecond, resolved.dotDamageMin, resolved.dotDamageMax)
        : null;
    if (dotRange) {
      resolved.dotDamageMin = Math.max(0, Number(dotRange[0]) || 0);
      resolved.dotDamageMax = Math.max(resolved.dotDamageMin, Number(dotRange[1]) || resolved.dotDamageMin);
    }
    const dotScaling = dotDamageEffect
      ? parseNumericRange(
          dotDamageEffect.scalingPerSecondPerLevel || dotDamageEffect.scalingPerLevel,
          resolved.dotDamagePerLevelMin,
          resolved.dotDamagePerLevelMax
        )
      : source.dotDamagePerSecondPerLevel !== undefined
        ? parseNumericRange(
            source.dotDamagePerSecondPerLevel,
            resolved.dotDamagePerLevelMin,
            resolved.dotDamagePerLevelMax
          )
        : null;
    if (dotScaling) {
      resolved.dotDamagePerLevelMin = Math.max(0, Number(dotScaling[0]) || 0);
      resolved.dotDamagePerLevelMax = Math.max(0, Number(dotScaling[1]) || 0);
    }

    const dotDurationMs = pickNumber(source.dotDurationMs);
    if (dotDurationMs !== null && dotDurationMs >= 0) {
      resolved.dotDurationMs = Math.max(0, Math.round(dotDurationMs));
    } else {
      const dotDurationSec = pickNumber(source.dotDuration, dotDamageEffect && dotDamageEffect.duration);
      if (dotDurationSec !== null && dotDurationSec >= 0) {
        resolved.dotDurationMs = Math.max(0, Math.round(dotDurationSec * 1000));
      }
    }

    const dotSchool = String(source.dotSchool || (dotDamageEffect && dotDamageEffect.school) || resolved.dotSchool || "")
      .trim()
      .toLowerCase();
    if (dotSchool) {
      resolved.dotSchool = dotSchool;
    }

    const slowEffect = findAbilityEffect(effects, "slow");
    const slowDurationMs = pickNumber(source.slowDurationMs);
    if (slowDurationMs !== null && slowDurationMs >= 0) {
      resolved.slowDurationMs = Math.max(0, Math.round(slowDurationMs));
    } else {
      const slowSeconds = pickNumber(source.slowDuration, slowEffect && slowEffect.duration);
      if (slowSeconds !== null && slowSeconds >= 0) {
        resolved.slowDurationMs = Math.max(0, Math.round(slowSeconds * 1000));
      }
    }

    const directSlowMultiplier = pickNumber(source.slowMultiplier);
    if (directSlowMultiplier !== null && directSlowMultiplier > 0) {
      resolved.slowMultiplier = clamp(directSlowMultiplier, 0.1, 1);
    } else {
      const slowAmount = pickNumber(source.slowAmount, slowEffect && slowEffect.amount);
      if (slowAmount !== null && slowAmount > 0) {
        resolved.slowMultiplier = clamp(1 - clamp(slowAmount, 0, 0.95), 0.1, 1);
      }
    }

    const stunEffect = findAbilityEffect(effects, "stun");
    const stunSeconds = pickNumber(source.stunDuration, stunEffect && stunEffect.duration);
    if (stunSeconds !== null && stunSeconds >= 0) {
      resolved.stunDurationMs = Math.max(0, Math.round(stunSeconds * 1000));
    }

    return resolved;
  }

  return {
    resolveMobAbilityOverrideDef
  };
}

module.exports = {
  createMobAbilityOverrideResolver
};
