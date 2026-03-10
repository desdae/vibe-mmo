(function initAbilityStats(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeAbilityStats = rootFactory();
})(function buildAbilityStats() {
  function getAbilityDamageRange(abilityDef, level) {
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const levelOffset = Math.max(0, lvl - 1);
    const min = Math.max(0, Math.floor(abilityDef.damageMin + abilityDef.damagePerLevelMin * levelOffset));
    const max = Math.max(min, Math.ceil(abilityDef.damageMax + abilityDef.damagePerLevelMax * levelOffset));
    return [min, max];
  }

  function getAbilityDotDamageRange(abilityDef, level) {
    if (!abilityDef) {
      return [0, 0];
    }
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const levelOffset = Math.max(0, lvl - 1);
    const min = Math.max(0, Number(abilityDef.dotDamageMin) + Number(abilityDef.dotDamagePerLevelMin) * levelOffset);
    const max = Math.max(min, Number(abilityDef.dotDamageMax) + Number(abilityDef.dotDamagePerLevelMax) * levelOffset);
    return [min, max];
  }

  function getAbilityRangeForLevel(abilityDef, level) {
    if (!abilityDef) {
      return 0;
    }
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const levelOffset = Math.max(0, lvl - 1);
    const baseRange = Math.max(0, Number(abilityDef.range) || 0);
    const rangePerLevel = Math.max(0, Number(abilityDef.rangePerLevel) || 0);
    return Math.max(0, baseRange + rangePerLevel * levelOffset);
  }

  function getAbilityCooldownMsForLevel(abilityDef, level) {
    if (!abilityDef) {
      return 0;
    }
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const levelOffset = Math.max(0, lvl - 1);
    const baseCooldownMs = Math.max(0, Number(abilityDef.cooldownMs) || 0);
    const reductionPerLevelMs = Math.max(
      0,
      Number(abilityDef.cooldownReductionPerLevelMs) ||
        (Math.max(0, Number(abilityDef.cooldownReductionPerLevel) || 0) * 1000)
    );
    return Math.max(0, baseCooldownMs - reductionPerLevelMs * levelOffset);
  }

  function getAbilityInvulnerabilityDurationMs(abilityDef) {
    return Math.max(0, Number(abilityDef?.invulnerabilityDurationMs) || 0);
  }

  return Object.freeze({
    getAbilityDamageRange,
    getAbilityDotDamageRange,
    getAbilityRangeForLevel,
    getAbilityCooldownMsForLevel,
    getAbilityInvulnerabilityDurationMs
  });
});
