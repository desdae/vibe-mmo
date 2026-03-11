function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createMobScalingTools(options = {}) {
  const levelDistance = Math.max(1, Number(options.levelDistance) || 10);
  const healthMultiplierPerLevel = Math.max(1, Number(options.healthMultiplierPerLevel) || 1.25);
  const damageMultiplierPerLevel = Math.max(1, Number(options.damageMultiplierPerLevel) || 1.15);
  const speedMultiplierPerLevel = Math.max(1, Number(options.speedMultiplierPerLevel) || 1.03);

  function getMobLevelForDistance(distanceFromCenter) {
    const distance = Math.max(0, Number(distanceFromCenter) || 0);
    return Math.max(1, Math.floor(distance / levelDistance) + 1);
  }

  function getMobScalingForLevel(level) {
    const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));
    const levelOffset = Math.max(0, normalizedLevel - 1);
    return {
      level: normalizedLevel,
      healthMultiplier: Math.pow(healthMultiplierPerLevel, levelOffset),
      damageMultiplier: Math.pow(damageMultiplierPerLevel, levelOffset),
      speedMultiplier: Math.pow(speedMultiplierPerLevel, levelOffset)
    };
  }

  function scaleMobStats(mobDef, level) {
    const scaling = getMobScalingForLevel(level);
    const baseHealth = Math.max(1, Number(mobDef?.health) || 1);
    const baseDamageMin = Math.max(0, Number(mobDef?.damageMin) || 0);
    const baseDamageMax = Math.max(baseDamageMin, Number(mobDef?.damageMax) || baseDamageMin);
    const baseSpeed = clamp(Number(mobDef?.baseSpeed) || 0.5, 0.05, 1000);

    return {
      ...scaling,
      maxHp: Math.max(1, Math.round(baseHealth * scaling.healthMultiplier)),
      damageMin: Math.max(0, Math.round(baseDamageMin * scaling.damageMultiplier)),
      damageMax: Math.max(0, Math.round(baseDamageMax * scaling.damageMultiplier)),
      baseSpeed: clamp(baseSpeed * scaling.speedMultiplier, 0.05, 1000)
    };
  }

  function applyScaledStatsToMob(mob, mobDef, level, options = {}) {
    if (!mob || !mobDef) {
      return false;
    }
    const keepHpRatio = options.keepHpRatio !== false;
    const wasAlive = !!mob.alive;
    const previousMaxHp = Math.max(1, Number(mob.maxHp) || 1);
    const previousHp = Math.max(0, Number(mob.hp) || 0);
    const hpRatio = previousMaxHp > 0 ? clamp(previousHp / previousMaxHp, 0, 1) : 1;
    const scaled = scaleMobStats(mobDef, level);

    mob.level = scaled.level;
    mob.levelHealthMultiplier = scaled.healthMultiplier;
    mob.levelDamageMultiplier = scaled.damageMultiplier;
    mob.levelSpeedMultiplier = scaled.speedMultiplier;
    mob.baseHp = Math.max(1, Number(mobDef.health) || 1);
    mob.baseDamageMin = Math.max(0, Number(mobDef.damageMin) || 0);
    mob.baseDamageMax = Math.max(mob.baseDamageMin, Number(mobDef.damageMax) || mob.baseDamageMin);
    mob.baseBaseSpeed = clamp(Number(mobDef.baseSpeed) || 0.5, 0.05, 1000);
    mob.maxHp = scaled.maxHp;
    mob.damageMin = scaled.damageMin;
    mob.damageMax = Math.max(scaled.damageMin, scaled.damageMax);
    mob.baseSpeed = scaled.baseSpeed;
    if (wasAlive) {
      mob.hp = keepHpRatio ? Math.max(1, Math.round(mob.maxHp * hpRatio)) : mob.maxHp;
    } else {
      mob.hp = 0;
    }
    return true;
  }

  function scaleDamageRangeForMob(mob, damageMin, damageMax) {
    const multiplier = Math.max(1, Number(mob?.levelDamageMultiplier) || 1);
    const min = Math.max(0, Math.round((Number(damageMin) || 0) * multiplier));
    const maxSource = Math.max(Number(damageMax) || min, Number(damageMin) || min);
    const max = Math.max(min, Math.round(maxSource * multiplier));
    return [min, max];
  }

  return {
    getMobLevelForDistance,
    getMobScalingForLevel,
    scaleMobStats,
    applyScaledStatsToMob,
    scaleDamageRangeForMob
  };
}

module.exports = {
  createMobScalingTools
};
