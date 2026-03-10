(function initObjectUtils(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeObjectUtils = rootFactory();
})(function buildObjectUtils() {
  function getObjectPath(source, pathValue) {
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
  }

  function firstFiniteNumber(values, fallback = 0) {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n)) {
        return n;
      }
    }
    return fallback;
  }

  function findAbilityEffect(effects, type, mode = "") {
    if (!Array.isArray(effects)) {
      return null;
    }
    const wantedType = String(type || "").trim().toLowerCase();
    const wantedMode = String(mode || "").trim().toLowerCase();
    for (const effect of effects) {
      if (!effect || typeof effect !== "object") {
        continue;
      }
      if (String(effect.type || "").toLowerCase() !== wantedType) {
        continue;
      }
      if (wantedMode && String(effect.mode || "").toLowerCase() !== wantedMode) {
        continue;
      }
      return effect;
    }
    return null;
  }

  function getProgressionPerLevelValue(entry, key) {
    const perLevel = getObjectPath(entry, "progression.perLevel");
    if (!perLevel || typeof perLevel !== "object") {
      return undefined;
    }
    if (key in perLevel) {
      return perLevel[key];
    }
    return getObjectPath(perLevel, key);
  }

  return Object.freeze({
    getObjectPath,
    firstFiniteNumber,
    findAbilityEffect,
    getProgressionPerLevelValue
  });
});
