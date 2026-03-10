(function initMobRenderStyle(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory(require("./number-utils"));
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeMobRenderStyle = rootFactory(root.VibeNumberUtils || {});
})(function buildMobRenderStyle(numberUtils) {
  const clamp =
    typeof numberUtils.clamp === "function" ? numberUtils.clamp : (value, min, max) => Math.max(min, Math.min(max, value));

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

  function parseMobRenderStyle(rawStyle) {
    if (!rawStyle || typeof rawStyle !== "object") {
      return null;
    }

    const style = {};
    const spriteType = String(rawStyle.spriteType || "").trim().toLowerCase();
    if (spriteType) {
      style.spriteType = spriteType.slice(0, 32);
    }

    const sizeScale = Number(rawStyle.sizeScale);
    if (Number.isFinite(sizeScale) && sizeScale > 0) {
      style.sizeScale = clamp(sizeScale, 0.5, 3);
    }

    const walkCycleSpeed = Number(rawStyle.walkCycleSpeed);
    if (Number.isFinite(walkCycleSpeed) && walkCycleSpeed > 0) {
      style.walkCycleSpeed = clamp(walkCycleSpeed, 0.1, 10);
    }

    const idleCycleSpeed = Number(rawStyle.idleCycleSpeed);
    if (Number.isFinite(idleCycleSpeed) && idleCycleSpeed >= 0) {
      style.idleCycleSpeed = clamp(idleCycleSpeed, 0, 10);
    }

    const moveThreshold = Number(rawStyle.moveThreshold);
    if (Number.isFinite(moveThreshold) && moveThreshold >= 0) {
      style.moveThreshold = clamp(moveThreshold, 0, 2);
    }

    const attackAnimSpeed = Number(rawStyle.attackAnimSpeed);
    if (Number.isFinite(attackAnimSpeed) && attackAnimSpeed > 0) {
      style.attackAnimSpeed = clamp(attackAnimSpeed, 0.1, 4);
    }

    const weaponOffsetX = Number(rawStyle.weaponOffsetX);
    if (Number.isFinite(weaponOffsetX)) {
      style.weaponOffsetX = clamp(weaponOffsetX, -24, 24);
    }

    const weaponOffsetY = Number(rawStyle.weaponOffsetY);
    if (Number.isFinite(weaponOffsetY)) {
      style.weaponOffsetY = clamp(weaponOffsetY, -24, 24);
    }

    const weaponAngleOffsetDeg = Number(rawStyle.weaponAngleOffsetDeg);
    if (Number.isFinite(weaponAngleOffsetDeg)) {
      style.weaponAngleOffsetDeg = clamp(weaponAngleOffsetDeg, -180, 180);
    }

    const biteRadius = Number(rawStyle.biteRadius);
    if (Number.isFinite(biteRadius) && biteRadius > 0) {
      style.biteRadius = clamp(biteRadius, 4, 40);
    }

    const attackVisual = String(rawStyle.attackVisual || "").trim().toLowerCase();
    if (attackVisual) {
      style.attackVisual = attackVisual.slice(0, 32);
    }

    const palette = {};
    const rawPalette = rawStyle.palette && typeof rawStyle.palette === "object" ? rawStyle.palette : null;
    if (rawPalette) {
      for (const [key, rawValue] of Object.entries(rawPalette)) {
        const color = sanitizeCssColor(rawValue);
        if (!color) {
          continue;
        }
        const normalizedKey = String(key || "").trim().slice(0, 48);
        if (!normalizedKey) {
          continue;
        }
        palette[normalizedKey] = color;
      }
    }
    if (Object.keys(palette).length > 0) {
      style.palette = palette;
    }

    return Object.keys(style).length ? style : null;
  }

  return Object.freeze({
    sanitizeCssColor,
    parseMobRenderStyle
  });
});
