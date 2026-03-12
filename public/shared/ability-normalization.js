(function initAbilityNormalization(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory(
      require("./number-utils"),
      require("./object-utils")
    );
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeAbilityNormalization = rootFactory(
    root.VibeNumberUtils || {},
    root.VibeObjectUtils || {}
  );
})(function buildAbilityNormalization(numberUtils, objectUtils) {
  const clamp =
    typeof numberUtils.clamp === "function" ? numberUtils.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const parseNumericRange =
    typeof numberUtils.parseNumericRange === "function"
      ? numberUtils.parseNumericRange
      : (value, fallbackMin, fallbackMax) => {
          if (Array.isArray(value) && value.length >= 2) {
            const first = Number(value[0]);
            const second = Number(value[1]);
            if (Number.isFinite(first) && Number.isFinite(second)) {
              return [Math.min(first, second), Math.max(first, second)];
            }
          }
          if (Number.isFinite(Number(value))) {
            const v = Number(value);
            return [v, v];
          }
          return [fallbackMin, fallbackMax];
        };
  const parseBoolean =
    typeof numberUtils.parseBoolean === "function"
      ? numberUtils.parseBoolean
      : (value, fallback = undefined) => {
          if (typeof value === "boolean") {
            return value;
          }
          return fallback;
        };

  const getObjectPath =
    typeof objectUtils.getObjectPath === "function"
      ? objectUtils.getObjectPath
      : (source, pathValue) => {
          if (!source || typeof source !== "object" || !pathValue) {
            return undefined;
          }
          const parts = String(pathValue).split(".");
          let cursor = source;
          for (const part of parts) {
            if (!part || !cursor || typeof cursor !== "object" || !(part in cursor)) {
              return undefined;
            }
            cursor = cursor[part];
          }
          return cursor;
        };
  const firstFiniteNumber =
    typeof objectUtils.firstFiniteNumber === "function"
      ? objectUtils.firstFiniteNumber
      : (values, fallback = 0) => {
          for (const value of values) {
            const n = Number(value);
            if (Number.isFinite(n)) {
              return n;
            }
          }
          return fallback;
        };
  const findAbilityEffect =
    typeof objectUtils.findAbilityEffect === "function"
      ? objectUtils.findAbilityEffect
      : () => null;
  const getProgressionPerLevelValue =
    typeof objectUtils.getProgressionPerLevelValue === "function"
      ? objectUtils.getProgressionPerLevelValue
      : () => undefined;

  const DELIVERY_TYPE_TO_KIND = Object.freeze({
    projectile: "projectile",
    grenade: "projectile",
    meleecone: "meleeCone",
    areatarget: "area",
    selfarea: "area",
    area: "area",
    trap: "area",
    volley: "area",
    beam: "beam",
    chain: "chain",
    summon: "summon",
    turret: "summon",
    selfbuff: "selfBuff",
    teleport: "teleport"
  });

  function createAbilityNormalizationTools({ defaultProjectileHitRadius }) {
    function normalizeAbilityEntry(rawId, entry) {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const id = String(entry.id || rawId || "").trim();
      if (!id) {
        return null;
      }

      const hasExpandedSchema =
        (entry.delivery && typeof entry.delivery === "object") ||
        (entry.targeting && typeof entry.targeting === "object") ||
        Array.isArray(entry.effects);
      if (!hasExpandedSchema) {
        return {
          ...entry,
          id
        };
      }

      const normalized = {
        id,
        name: String(entry.name || id),
        description: String(entry.description || "")
      };

      const delivery = entry.delivery && typeof entry.delivery === "object" ? entry.delivery : {};
      const targeting = entry.targeting && typeof entry.targeting === "object" ? entry.targeting : {};
      const effects = Array.isArray(entry.effects) ? entry.effects : [];

      const deliveryType = String(delivery.type || "").trim().toLowerCase();
      if (deliveryType && DELIVERY_TYPE_TO_KIND[deliveryType]) {
        normalized.kind = DELIVERY_TYPE_TO_KIND[deliveryType];
      } else if (typeof entry.kind === "string" && entry.kind.trim()) {
        normalized.kind = entry.kind.trim();
      }

      const castTime = firstFiniteNumber([delivery.castTime, entry.castTime], 0);
      if (castTime > 0) {
        normalized.castTime = castTime;
      }

      const cooldown = firstFiniteNumber([delivery.cooldown, entry.cooldown], 0);
      if (cooldown > 0) {
        normalized.cooldown = cooldown;
      }

      const manaCost = firstFiniteNumber([delivery?.resourceCost?.mana, entry.manaCost], 0);
      if (manaCost > 0) {
        normalized.manaCost = manaCost;
      }

      const teleportEffect = findAbilityEffect(effects, "teleport");
      const computedRange = firstFiniteNumber([targeting.range, teleportEffect && teleportEffect.distance, entry.range], 0);
      if (computedRange > 0) {
        normalized.range = computedRange;
      } else if (deliveryType === "selfarea") {
        normalized.range = 0;
      }

      const speed = firstFiniteNumber([targeting.speed, entry.speed], 0);
      if (speed > 0) {
        normalized.speed = speed;
      }

      const coneAngle = firstFiniteNumber([targeting.coneAngle, entry.coneAngle], 0);
      if (coneAngle > 0) {
        normalized.coneAngle = coneAngle;
      }

      const radius = firstFiniteNumber([targeting.radius, entry.radius, entry.areaRadius], 0);
      if (radius > 0) {
        normalized.radius = radius;
      }

      const projectileCount = Math.floor(firstFiniteNumber([targeting.projectileCount, entry.projectileCount], 0));
      if (projectileCount > 0) {
        normalized.projectileCount = projectileCount;
      }

      const summonEffect = findAbilityEffect(effects, "summon");
      const summonCount = firstFiniteNumber([targeting.summonCount, summonEffect && summonEffect.count, entry.summonCount], 0);
      if (summonCount > 0) {
        normalized.summonCount = summonCount;
      }
      const summonFormationRadius = firstFiniteNumber(
        [targeting.summonFormationRadius, summonEffect && summonEffect.formationRadius, entry.summonFormationRadius],
        0
      );
      if (summonFormationRadius > 0) {
        normalized.summonFormationRadius = summonFormationRadius;
      }
      const summonKind = String(
        (summonEffect && (summonEffect.summonKind || summonEffect.kind || summonEffect.unitId)) ||
          entry.summonKind ||
          ""
      )
        .trim()
        .toLowerCase();
      if (summonKind) {
        normalized.summonKind = summonKind;
      }
      const summonAbilityId = String(
        (summonEffect && (summonEffect.abilityId || summonEffect.childAbilityId || summonEffect.projectileAbilityId)) ||
          entry.summonAbilityId ||
          ""
      )
        .trim();
      if (summonAbilityId) {
        normalized.summonAbilityId = summonAbilityId;
      }
      const summonAbilityOverrides =
        summonEffect && summonEffect.overrides && typeof summonEffect.overrides === "object"
          ? summonEffect.overrides
          : entry.summonAbilityOverrides && typeof entry.summonAbilityOverrides === "object"
            ? entry.summonAbilityOverrides
            : null;
      if (summonAbilityOverrides) {
        normalized.summonAbilityOverrides = summonAbilityOverrides;
      }

      const directDamageEffect = findAbilityEffect(effects, "damage", "instant");
      const dotDamageEffect = findAbilityEffect(effects, "damage", "overtime");
      const fallbackDamageEffect = findAbilityEffect(effects, "damage");
      const mainDamageEffect = directDamageEffect || dotDamageEffect || fallbackDamageEffect;

      const damageRangeInput =
        (mainDamageEffect && (mainDamageEffect.amount || mainDamageEffect.amountPerSecond)) ||
        entry.damageRange ||
        entry.damagePerSecond;
      if (damageRangeInput !== undefined) {
        normalized.damageRange = damageRangeInput;
      }

      const damagePerLevelInput =
        (mainDamageEffect && (mainDamageEffect.scalingPerLevel || mainDamageEffect.scalingPerSecondPerLevel)) ||
        entry.damageRangePerLevel;
      if (damagePerLevelInput !== undefined) {
        normalized.damageRangePerLevel = damagePerLevelInput;
      }

      const dotDamagePerSecondInput =
        (dotDamageEffect && (dotDamageEffect.amountPerSecond || dotDamageEffect.amount)) || entry.dotDamagePerSecond;
      if (dotDamagePerSecondInput !== undefined) {
        normalized.dotDamagePerSecond = dotDamagePerSecondInput;
      }

      const dotDamagePerLevelInput =
        (dotDamageEffect && (dotDamageEffect.scalingPerSecondPerLevel || dotDamageEffect.scalingPerLevel)) ||
        entry.dotDamagePerSecondPerLevel;
      if (dotDamagePerLevelInput !== undefined) {
        normalized.dotDamagePerSecondPerLevel = dotDamagePerLevelInput;
      }

      const dotDuration = firstFiniteNumber([dotDamageEffect && dotDamageEffect.duration, entry.dotDuration], 0);
      if (dotDuration > 0) {
        normalized.dotDuration = dotDuration;
      }

      const dotSchool = String((dotDamageEffect && dotDamageEffect.school) || entry.dotSchool || "").trim();
      if (dotSchool) {
        normalized.dotSchool = dotSchool.toLowerCase();
      }

      const effectDuration = firstFiniteNumber(
        [targeting.duration, dotDamageEffect && dotDamageEffect.duration, entry.duration, entry.durationMs],
        0
      );
      if (effectDuration > 0) {
        normalized.duration = effectDuration;
      }
      const durationPerLevel = firstFiniteNumber(
        [getProgressionPerLevelValue(entry, "targeting.duration"), entry.durationPerLevel],
        0
      );
      if (durationPerLevel > 0) {
        normalized.durationPerLevel = durationPerLevel;
      }

      const explodeEffect = findAbilityEffect(effects, "explode");
      const explosionRadius = firstFiniteNumber([explodeEffect && explodeEffect.radius, entry.explosionRadius], 0);
      if (explosionRadius > 0) {
        normalized.explosionRadius = explosionRadius;
      }
      const nestedExplosionDamage = findAbilityEffect(explodeEffect && explodeEffect.effects, "damage");
      const explosionDamageMultiplier = firstFiniteNumber(
        [
          nestedExplosionDamage && nestedExplosionDamage.amountMultiplier,
          explodeEffect && explodeEffect.amountMultiplier,
          entry.explosionDamageMultiplier
        ],
        0
      );
      if (explosionDamageMultiplier > 0) {
        normalized.explosionDamageMultiplier = explosionDamageMultiplier;
      }

      const slowEffect = findAbilityEffect(effects, "slow");
      const slowAmount = firstFiniteNumber([slowEffect && slowEffect.amount, entry.slowAmount], 0);
      if (slowAmount > 0) {
        normalized.slowAmount = slowAmount;
      }
      const slowDuration = firstFiniteNumber([slowEffect && slowEffect.duration, entry.slowDuration], 0);
      if (slowDuration > 0) {
        normalized.slowDuration = slowDuration;
      }

      const stunEffect = findAbilityEffect(effects, "stun");
      const stunDuration = firstFiniteNumber([stunEffect && stunEffect.duration, entry.stunDuration], 0);
      if (stunDuration > 0) {
        normalized.stunDuration = stunDuration;
      }

      const invulnerabilityBuff =
        (Array.isArray(effects) ? effects : []).find((effect) => {
          if (!effect || typeof effect !== "object") {
            return false;
          }
          if (String(effect.type || "").toLowerCase() !== "buff") {
            return false;
          }
          return !!(effect.stats && effect.stats.invulnerable);
        }) || null;
      const invulnerabilityDuration = firstFiniteNumber(
        [invulnerabilityBuff && invulnerabilityBuff.duration, entry.invulnerabilityDuration],
        0
      );
      if (invulnerabilityDuration > 0) {
        normalized.invulnerabilityDuration = invulnerabilityDuration;
      }

      const rangePerLevel = firstFiniteNumber([getProgressionPerLevelValue(entry, "targeting.range"), entry.rangePerLevel], 0);
      if (rangePerLevel > 0) {
        normalized.rangePerLevel = rangePerLevel;
      }
      const cooldownPerLevelRaw = Number(getProgressionPerLevelValue(entry, "delivery.cooldown"));
      if (Number.isFinite(cooldownPerLevelRaw)) {
        const reduction = cooldownPerLevelRaw < 0 ? Math.abs(cooldownPerLevelRaw) : 0;
        if (reduction > 0) {
          normalized.cooldownReductionPerLevel = reduction;
        }
      } else if (Number(entry.cooldownReductionPerLevel) > 0) {
        normalized.cooldownReductionPerLevel = Number(entry.cooldownReductionPerLevel);
      }

      const beamWidth = firstFiniteNumber([targeting.width, targeting.beamWidth, entry.beamWidth, entry.width], 0);
      if (beamWidth > 0) {
        normalized.beamWidth = beamWidth;
      }

      const jumpCount = firstFiniteNumber([targeting.jumpCount, entry.jumpCount], 0);
      if (jumpCount > 0) {
        normalized.jumpCount = jumpCount;
      }

      const jumpRange = firstFiniteNumber([targeting.jumpRange, entry.jumpRange], 0);
      if (jumpRange > 0) {
        normalized.jumpRange = jumpRange;
      }

      const jumpDamageReduction = firstFiniteNumber(
        [targeting.jumpDamageReduction, entry.jumpDamageReduction],
        0
      );
      if (jumpDamageReduction > 0) {
        normalized.jumpDamageReduction = jumpDamageReduction;
      }

      const jumpCountPerLevel = firstFiniteNumber(
        [getProgressionPerLevelValue(entry, "targeting.jumpCount"), entry.jumpCountPerLevel],
        0
      );
      if (jumpCountPerLevel > 0) {
        normalized.jumpCountPerLevel = jumpCountPerLevel;
      }
      const summonCountPerLevel = firstFiniteNumber(
        [getProgressionPerLevelValue(entry, "targeting.summonCount"), entry.summonCountPerLevel],
        0
      );
      if (summonCountPerLevel > 0) {
        normalized.summonCountPerLevel = summonCountPerLevel;
      }
      const summonCountEveryLevels = firstFiniteNumber(
        [targeting.summonCountEveryLevels, entry.summonCountEveryLevels],
        0
      );
      if (summonCountEveryLevels > 0) {
        normalized.summonCountEveryLevels = summonCountEveryLevels;
      }
      const maxSummonCount = firstFiniteNumber([targeting.maxSummonCount, entry.maxSummonCount], 0);
      if (maxSummonCount > 0) {
        normalized.maxSummonCount = maxSummonCount;
      }

      const spreadDeg = firstFiniteNumber([targeting.spreadDeg, targeting.spreadAngle, entry.spreadDeg, entry.spreadAngle], 0);
      if (spreadDeg > 0) {
        normalized.spreadDeg = spreadDeg;
      }

      const explodeOnExpire = parseBoolean(
        getObjectPath(targeting, "explodeOnExpire"),
        parseBoolean(entry.explodeOnExpire, undefined)
      );
      if (explodeOnExpire !== undefined) {
        normalized.explodeOnExpire = explodeOnExpire;
      }

      const homingRange = firstFiniteNumber([getObjectPath(targeting, "homing.range"), targeting.homingRange, entry.homingRange], 0);
      if (homingRange > 0) {
        normalized.homingRange = homingRange;
      }
      const homingTurnRate = firstFiniteNumber(
        [
          getObjectPath(targeting, "homing.turnRate"),
          getObjectPath(targeting, "homing.homingTurnRate"),
          targeting.homingTurnRate,
          targeting.turnRate,
          entry.homingTurnRate,
          entry.turnRate
        ],
        0
      );
      if (homingTurnRate > 0) {
        normalized.homingTurnRate = homingTurnRate;
      }

      if (Array.isArray(entry.tags) && entry.tags.length) {
        normalized.tags = entry.tags.map((tag) => String(tag || "").trim()).filter(Boolean);
      }

      normalized.delivery = delivery;
      normalized.targeting = targeting;
      normalized.effects = effects;
      if (entry.progression && typeof entry.progression === "object") {
        normalized.progression = entry.progression;
      }

      return normalized;
    }

    function buildChildProjectileTemplate(parentAbilityId, rawProjectileEntry) {
      if (!rawProjectileEntry || typeof rawProjectileEntry !== "object") {
        return null;
      }
      const normalized = normalizeAbilityEntry(`${parentAbilityId}_child_projectile`, rawProjectileEntry);
      if (!normalized) {
        return null;
      }

      const speed = Math.max(0.1, Number(normalized.speed) || 0);
      const range = Math.max(0.25, Number(normalized.range) || 0);
      const kind =
        typeof normalized.kind === "string" && normalized.kind.trim()
          ? normalized.kind.trim().toLowerCase()
          : speed > 0
            ? "projectile"
            : "";
      if (kind !== "projectile") {
        return null;
      }

      const damageRangeInput =
        normalized.damageRange !== undefined ? normalized.damageRange : normalized.damagePerSecond;
      const damageRange = parseNumericRange(damageRangeInput, 1, 1);
      const damagePerLevel = parseNumericRange(normalized.damageRangePerLevel, 0, 0);
      const dotDamageRange = parseNumericRange(normalized.dotDamagePerSecond, 0, 0);
      const dotDamagePerLevel = parseNumericRange(normalized.dotDamagePerSecondPerLevel, 0, 0);
      const cooldownMs = Math.max(0, Math.round((Number(normalized.cooldown) || 0) * 1000));

      const dotDurationMsRaw = Number(normalized.dotDurationMs);
      const dotDurationSecRaw = Number(normalized.dotDuration);
      const dotDurationMs =
        Number.isFinite(dotDurationMsRaw) && dotDurationMsRaw > 0
          ? Math.round(dotDurationMsRaw)
          : Number.isFinite(dotDurationSecRaw) && dotDurationSecRaw > 0
            ? Math.round(dotDurationSecRaw * 1000)
            : 0;

      const slowDurationMsRaw = Number(normalized.slowDurationMs);
      const slowDurationSecRaw = Number(normalized.slowDuration);
      const slowDurationMs =
        Number.isFinite(slowDurationMsRaw) && slowDurationMsRaw > 0
          ? Math.round(slowDurationMsRaw)
          : Number.isFinite(slowDurationSecRaw) && slowDurationSecRaw > 0
            ? Math.round(slowDurationSecRaw * 1000)
            : 0;
      let slowMultiplier = 1;
      if (Number.isFinite(Number(normalized.slowMultiplier)) && Number(normalized.slowMultiplier) > 0) {
        slowMultiplier = clamp(Number(normalized.slowMultiplier), 0.1, 1);
      } else if (Number.isFinite(Number(normalized.slowAmount)) && Number(normalized.slowAmount) > 0) {
        slowMultiplier = clamp(1 - clamp(Number(normalized.slowAmount), 0, 0.95), 0.1, 1);
      }

      return {
        id: String(normalized.id || `${parentAbilityId}_child_projectile`),
        cooldownMs,
        speed,
        range,
        damageMin: clamp(Math.floor(Math.min(damageRange[0], damageRange[1])), 0, 255),
        damageMax: clamp(Math.ceil(Math.max(damageRange[0], damageRange[1])), 0, 255),
        damagePerLevelMin: Math.max(0, Number(damagePerLevel[0]) || 0),
        damagePerLevelMax: Math.max(0, Number(damagePerLevel[1]) || 0),
        hitRadius: clamp(
          Number(normalized.projectileHitRadius) || Number(normalized.hitRadius) || defaultProjectileHitRadius,
          0.1,
          8
        ),
        explosionRadius: Math.max(0, Number(normalized.explosionRadius) || 0),
        explosionDamageMultiplier: clamp(Number(normalized.explosionDamageMultiplier) || 0, 0, 1),
        slowDurationMs,
        slowMultiplier,
        stunDurationMs: Math.max(0, Math.round((Number(normalized.stunDuration) || 0) * 1000)),
        dotDamageMin: Math.max(0, Number(dotDamageRange[0]) || 0),
        dotDamageMax: Math.max(0, Number(dotDamageRange[1]) || 0),
        dotDamagePerLevelMin: Math.max(0, Number(dotDamagePerLevel[0]) || 0),
        dotDamagePerLevelMax: Math.max(0, Number(dotDamagePerLevel[1]) || 0),
        dotDurationMs,
        dotSchool: String(normalized.dotSchool || "generic").trim().toLowerCase() || "generic",
        explodeOnExpire: normalized.explodeOnExpire !== false,
        homingRange: Math.max(0, Number(normalized.homingRange) || 0),
        homingTurnRate: Math.max(0, Number(normalized.homingTurnRate) || 0)
      };
    }

    function buildEmitProjectilesConfig(entry, abilityId) {
      const emitEffect = findAbilityEffect(entry && entry.effects, "emitprojectiles");
      if (!emitEffect || typeof emitEffect !== "object") {
        return null;
      }
      const trigger = String(emitEffect.trigger || "whileTraveling").trim().toLowerCase();
      const intervalMsRaw = Number(emitEffect.intervalMs);
      const intervalSecRaw = Number(emitEffect.interval);
      const intervalMs =
        Number.isFinite(intervalMsRaw) && intervalMsRaw > 0
          ? Math.round(intervalMsRaw)
          : Number.isFinite(intervalSecRaw) && intervalSecRaw > 0
            ? Math.round(intervalSecRaw * 1000)
            : 0;
      if (intervalMs <= 0) {
        return null;
      }

      const initialDelayMsRaw = Number(emitEffect.initialDelayMs);
      const initialDelaySecRaw = Number(emitEffect.initialDelay);
      const initialDelayMs =
        Number.isFinite(initialDelayMsRaw) && initialDelayMsRaw >= 0
          ? Math.round(initialDelayMsRaw)
          : Number.isFinite(initialDelaySecRaw) && initialDelaySecRaw >= 0
            ? Math.round(initialDelaySecRaw * 1000)
            : 0;
      const maxEmissions = clamp(Math.floor(Number(emitEffect.maxEmissions) || 1), 1, 1000);
      const patternRaw = emitEffect.pattern && typeof emitEffect.pattern === "object" ? emitEffect.pattern : {};
      const patternType = String(patternRaw.type || "radial").trim().toLowerCase();
      const pattern = {
        type: patternType || "radial",
        count: clamp(Math.floor(Number(patternRaw.count) || 1), 1, 64),
        startAngleDeg: Number(patternRaw.startAngle) || 0,
        angleSpreadDeg: Number(patternRaw.angleSpread) || 360,
        evenSpacing: patternRaw.evenSpacing !== false
      };
      const childProjectile = buildChildProjectileTemplate(abilityId, emitEffect.projectile);
      if (!childProjectile) {
        return null;
      }

      return {
        trigger,
        intervalMs: Math.max(50, intervalMs),
        initialDelayMs: Math.max(0, initialDelayMs),
        maxEmissions,
        pattern,
        childProjectile
      };
    }

    return {
      normalizeAbilityEntry,
      buildEmitProjectilesConfig
    };
  }

  return Object.freeze({
    createAbilityNormalizationTools
  });
});
