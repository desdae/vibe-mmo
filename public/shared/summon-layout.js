(function initSummonLayout(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeSummonLayout = rootFactory();
})(function buildSummonLayout() {
  function getSummonCountForLevel(baseCount, countPerLevel, level, options = {}) {
    const base = Math.max(1, Math.round(Number(baseCount) || 1));
    const perLevel = Math.max(0, Number(countPerLevel) || 0);
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const everyLevels = Math.max(0, Math.floor(Number(options.everyLevels) || 0));
    const maxCount = Math.max(0, Math.floor(Number(options.maxCount) || 0));
    const scaled =
      everyLevels > 0
        ? base + Math.floor(Math.max(0, lvl - 1) / everyLevels)
        : base + perLevel * Math.max(0, lvl - 1);
    const rounded = Math.max(1, Math.round(scaled));
    return maxCount > 0 ? Math.min(maxCount, rounded) : rounded;
  }

  function computeSummonFormationPositions(centerX, centerY, count, formationRadius = 0.9, startAngle = -Math.PI * 0.5) {
    const total = Math.max(1, Math.round(Number(count) || 1));
    const radius = Math.max(0, Number(formationRadius) || 0);
    if (total <= 1 || radius <= 0.001) {
      return [{ x: Number(centerX) || 0, y: Number(centerY) || 0, angle: startAngle, index: 0 }];
    }

    const positions = [];
    for (let index = 0; index < total; index += 1) {
      const ratio = total <= 1 ? 0 : index / total;
      const angle = startAngle + ratio * Math.PI * 2;
      positions.push({
        x: (Number(centerX) || 0) + Math.cos(angle) * radius,
        y: (Number(centerY) || 0) + Math.sin(angle) * radius,
        angle,
        index
      });
    }
    return positions;
  }

  return Object.freeze({
    getSummonCountForLevel,
    computeSummonFormationPositions
  });
});
