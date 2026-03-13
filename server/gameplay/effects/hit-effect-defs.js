function normalizeNumeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDurationMs(value) {
  const n = Math.max(0, Math.floor(normalizeNumeric(value, 0)));
  return n;
}

function normalizeSchool(value) {
  return String(value || "generic").trim().toLowerCase() || "generic";
}

function buildHitEffectDefsFromAbilityDef(abilityDef, abilityLevel, getAbilityDotDamageRange) {
  if (!abilityDef || typeof abilityDef !== "object") {
    return [];
  }
  const effects = [];

  const slowDurationMs = normalizeDurationMs(abilityDef.slowDurationMs);
  const slowMultiplier = normalizeNumeric(abilityDef.slowMultiplier, 1);
  if (slowDurationMs > 0 && slowMultiplier > 0 && slowMultiplier < 1) {
    effects.push({
      type: "slow",
      multiplier: slowMultiplier,
      durationMs: slowDurationMs
    });
  }

  const stunDurationMs = normalizeDurationMs(abilityDef.stunDurationMs);
  if (stunDurationMs > 0) {
    effects.push({
      type: "stun",
      durationMs: stunDurationMs
    });
  }

  const dotDurationMs = normalizeDurationMs(abilityDef.dotDurationMs);
  const dotRange =
    typeof getAbilityDotDamageRange === "function" ? getAbilityDotDamageRange(abilityDef, abilityLevel) : [0, 0];
  const dotMin = Math.max(0, normalizeNumeric(dotRange && dotRange[0], 0));
  const dotMax = Math.max(dotMin, normalizeNumeric(dotRange && dotRange[1], dotMin));
  if (dotDurationMs > 0 && dotMax > 0) {
    effects.push({
      type: "dot",
      school: normalizeSchool(abilityDef.dotSchool),
      damageMinPerSecond: dotMin,
      damageMaxPerSecond: dotMax,
      durationMs: dotDurationMs
    });
  }

  return effects;
}

function buildHitEffectDefsFromProjectile(projectile) {
  if (!projectile || typeof projectile !== "object") {
    return [];
  }
  const effects = [];

  const slowDurationMs = normalizeDurationMs(projectile.slowDurationMs);
  const slowMultiplier = normalizeNumeric(projectile.slowMultiplier, 1);
  if (slowDurationMs > 0 && slowMultiplier > 0 && slowMultiplier < 1) {
    effects.push({
      type: "slow",
      multiplier: slowMultiplier,
      durationMs: slowDurationMs
    });
  }

  const stunDurationMs = normalizeDurationMs(projectile.stunDurationMs);
  if (stunDurationMs > 0) {
    effects.push({
      type: "stun",
      durationMs: stunDurationMs
    });
  }

  const dotDurationMs = normalizeDurationMs(projectile.dotDurationMs);
  const dotMin = Math.max(0, normalizeNumeric(projectile.dotDamageMin, 0));
  const dotMax = Math.max(dotMin, normalizeNumeric(projectile.dotDamageMax, dotMin));
  if (dotDurationMs > 0 && dotMax > 0) {
    effects.push({
      type: "dot",
      school: normalizeSchool(projectile.dotSchool),
      damageMinPerSecond: dotMin,
      damageMaxPerSecond: dotMax,
      durationMs: dotDurationMs
    });
  }

  return effects;
}

module.exports = {
  buildHitEffectDefsFromAbilityDef,
  buildHitEffectDefsFromProjectile
};

