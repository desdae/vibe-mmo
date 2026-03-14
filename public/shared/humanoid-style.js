(function initHumanoidStyle(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory(require("./number-utils"));
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeHumanoidStyle = rootFactory(root.VibeNumberUtils || {});
})(function buildHumanoidStyle(numberUtils) {
  const clamp =
    typeof numberUtils.clamp === "function" ? numberUtils.clamp : (value, min, max) => Math.max(min, Math.min(max, value));

  const DEFAULT_KEYS = Object.freeze([
    "head",
    "chest",
    "shoulders",
    "gloves",
    "bracers",
    "belt",
    "pants",
    "boots",
    "mainHand",
    "offHand"
  ]);

  function sanitizeCssColor(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
      return raw;
    }
    if (/^rgba?\(([^)]+)\)$/.test(raw)) {
      return raw;
    }
    if (/^hsla?\(([^)]+)\)$/.test(raw)) {
      return raw;
    }
    return "";
  }

  function sanitizeWord(value, maxLength = 32) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized ? normalized.slice(0, maxLength) : "";
  }

  function parseVisualDefaults(rawDefaults) {
    if (!rawDefaults || typeof rawDefaults !== "object") {
      return null;
    }
    const defaults = {};
    for (const key of DEFAULT_KEYS) {
      const normalized = sanitizeWord(rawDefaults[key]);
      if (normalized) {
        defaults[key] = normalized;
      }
    }
    return Object.keys(defaults).length ? defaults : null;
  }

  function parseHumanoidRenderStyle(rawStyle) {
    if (!rawStyle || typeof rawStyle !== "object") {
      return null;
    }

    const style = {};
    const stringFields = ["rigType", "species", "archetype", "spriteType", "attackVisual"];
    for (const field of stringFields) {
      const normalized = sanitizeWord(rawStyle[field]);
      if (normalized) {
        style[field] = normalized;
      }
    }

    const numericFields = [
      ["sizeScale", 0.5, 3],
      ["walkCycleSpeed", 0.1, 10],
      ["idleCycleSpeed", 0, 10],
      ["moveThreshold", 0, 2],
      ["attackAnimSpeed", 0.1, 4],
      ["weaponOffsetX", -24, 24],
      ["weaponOffsetY", -24, 24],
      ["weaponAngleOffsetDeg", -180, 180],
      ["biteRadius", 4, 40]
    ];
    for (const [field, min, max] of numericFields) {
      const n = Number(rawStyle[field]);
      if (Number.isFinite(n)) {
        style[field] = clamp(n, min, max);
      }
    }

    const defaults = parseVisualDefaults(rawStyle.defaults || rawStyle.gear || rawStyle.visualDefaults);
    if (defaults) {
      style.defaults = defaults;
    }

    const palette = {};
    const rawPalette = rawStyle.palette && typeof rawStyle.palette === "object" ? rawStyle.palette : null;
    if (rawPalette) {
      for (const [rawKey, rawValue] of Object.entries(rawPalette)) {
        const key = String(rawKey || "").trim().slice(0, 48);
        const color = sanitizeCssColor(rawValue);
        if (!key || !color) {
          continue;
        }
        palette[key] = color;
      }
    }
    if (Object.keys(palette).length > 0) {
      style.palette = palette;
    }

    return Object.keys(style).length ? style : null;
  }

  return Object.freeze({
    sanitizeCssColor,
    parseHumanoidRenderStyle
  });
});
