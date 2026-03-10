(function initNumberUtils(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeNumberUtils = rootFactory();
})(function buildNumberUtils() {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function parseNumericRange(value, fallbackMin, fallbackMax) {
    if (Array.isArray(value) && value.length >= 2) {
      const first = Number(value[0]);
      const second = Number(value[1]);
      if (Number.isFinite(first) && Number.isFinite(second)) {
        const low = Math.min(first, second);
        const high = Math.max(first, second);
        return [low, high];
      }
    }
    if (Number.isFinite(Number(value))) {
      const v = Number(value);
      return [v, v];
    }
    return [fallbackMin, fallbackMax];
  }

  function parseBoolean(value, fallback = undefined) {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === 1 || value === "1") {
      return true;
    }
    if (value === 0 || value === "0") {
      return false;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    return fallback;
  }

  function parseMultiplier(value, fallback = 1) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return fallback;
    }
    return clamp(n, 0, 1000);
  }

  function parseGameplayInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return fallback;
    }
    return clamp(Math.round(n), min, max);
  }

  function parseGameplayNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return fallback;
    }
    return clamp(n, min, max);
  }

  return Object.freeze({
    clamp,
    randomInt,
    parseNumericRange,
    parseBoolean,
    parseMultiplier,
    parseGameplayInt,
    parseGameplayNumber
  });
});
