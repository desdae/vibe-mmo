(function initVibeClientRenderState(globalScope) {
  "use strict";

  function fallbackClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fallbackLerp(a, b, t) {
    return a + (b - a) * t;
  }

  function createRenderStateInterpolator(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const snapshots = Array.isArray(deps.snapshots) ? deps.snapshots : [];
    const clamp = typeof deps.clamp === "function" ? deps.clamp : fallbackClamp;
    const lerp = typeof deps.lerp === "function" ? deps.lerp : fallbackLerp;
    const interpolationDelayMs = Math.max(0, Number(deps.interpolationDelayMs) || 0);

    function blendEntityList(previousList, currentList, alpha) {
      const prevList = Array.isArray(previousList) ? previousList : [];
      const nextList = Array.isArray(currentList) ? currentList : [];
      const previousById = new Map(prevList.map((entity) => [entity.id, entity]));
      return nextList.map((entity) => {
        const previous = previousById.get(entity.id);
        if (!previous) {
          return entity;
        }
        return {
          ...entity,
          x: lerp(previous.x, entity.x, alpha),
          y: lerp(previous.y, entity.y, alpha)
        };
      });
    }

    function getInterpolatedState(now = performance.now()) {
      if (!snapshots.length) {
        return null;
      }

      const renderTime = now - interpolationDelayMs;
      while (snapshots.length >= 3 && snapshots[1].t <= renderTime) {
        snapshots.shift();
      }

      if (snapshots.length === 1) {
        return snapshots[0];
      }

      const previous = snapshots[0];
      const current = snapshots[1];
      const span = current.t - previous.t;
      const alpha = span > 0 ? clamp((renderTime - previous.t) / span, 0, 1) : 1;

      let self = current.self || previous.self;
      if (previous.self && current.self && previous.self.id === current.self.id) {
        self = {
          ...current.self,
          x: lerp(previous.self.x, current.self.x, alpha),
          y: lerp(previous.self.y, current.self.y, alpha)
        };
      }

      return {
        self,
        players: blendEntityList(previous.players, current.players, alpha),
        projectiles: blendEntityList(previous.projectiles, current.projectiles, alpha),
        mobs: blendEntityList(previous.mobs, current.mobs, alpha),
        lootBags: blendEntityList(previous.lootBags, current.lootBags, alpha)
      };
    }

    return {
      blendEntityList,
      getInterpolatedState
    };
  }

  globalScope.VibeClientRenderState = Object.freeze({
    createRenderStateInterpolator
  });
})(globalThis);
