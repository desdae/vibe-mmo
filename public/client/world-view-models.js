(function initVibeClientWorldViewModels(globalScope) {
  "use strict";

  function createWorldViewModelTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const gameState = deps.gameState;
    const getAreaEffects = typeof deps.getAreaEffects === "function" ? deps.getAreaEffects : () => [];
    const getExplosionViews = typeof deps.getExplosionViews === "function" ? deps.getExplosionViews : () => [];
    const getTownVendor = typeof deps.getTownVendor === "function" ? deps.getTownVendor : () => null;
    if (!gameState) {
      return null;
    }

    function buildWorldFrameViewModel(interpolatedState, frameNow = performance.now()) {
      if (!interpolatedState || !interpolatedState.self) {
        return null;
      }

      const self = interpolatedState.self;
      const cameraX = Number(self.x || 0) + 0.5;
      const cameraY = Number(self.y || 0) + 0.5;
      const mobs = Array.isArray(interpolatedState.mobs) ? interpolatedState.mobs : [];
      const projectiles = Array.isArray(interpolatedState.projectiles) ? interpolatedState.projectiles : [];
      const players = Array.isArray(interpolatedState.players) ? interpolatedState.players : [];
      const lootBags = Array.isArray(interpolatedState.lootBags) ? interpolatedState.lootBags : [];

      const mobViews = mobs.map((mob) => ({
        mob,
        attackState: typeof deps.getActiveMobAttackState === "function" ? deps.getActiveMobAttackState(mob.id) : null,
        attackVisual: typeof deps.getMobAttackVisualType === "function" ? deps.getMobAttackVisualType(mob) : "none",
        isHumanoid: typeof deps.isHumanoidMob === "function" ? deps.isHumanoidMob(mob) : false,
        castVisual: typeof deps.getMobCastVisualState === "function" ? deps.getMobCastVisualState(mob, frameNow) : null,
        statusVisual: typeof deps.getMobStatusVisualState === "function" ? deps.getMobStatusVisualState(mob, frameNow) : null
      }));

      const playerViews = players.map((player) => ({
        player,
        isSelf: false,
        castVisual: typeof deps.getPlayerCastVisualState === "function" ? deps.getPlayerCastVisualState(player, false, frameNow) : null,
        statusVisual: typeof deps.getPlayerStatusVisualState === "function" ? deps.getPlayerStatusVisualState(player, false, frameNow) : null
      }));

      const selfView = {
        player: self,
        isSelf: true,
        castVisual: typeof deps.getPlayerCastVisualState === "function" ? deps.getPlayerCastVisualState(self, true, frameNow) : null,
        statusVisual: typeof deps.getPlayerStatusVisualState === "function" ? deps.getPlayerStatusVisualState(self, true, frameNow) : null
      };

      const rawExplosionViews = getExplosionViews(frameNow);
      const explosionViews = Array.isArray(rawExplosionViews) ? rawExplosionViews : [];

      return {
        frameNow,
        cameraX,
        cameraY,
        self,
        latestSelf: gameState.self || self,
        projectileViews: projectiles.map((projectile) => ({ projectile })),
        mobViews,
        playerViews,
        selfView,
        lootBagViews: lootBags.map((bag) => ({ bag })),
        areaEffects: Array.isArray(getAreaEffects()) ? getAreaEffects() : [],
        explosionViews,
        floatingDamageViews: typeof deps.getFloatingDamageViews === "function" ? deps.getFloatingDamageViews(frameNow) : [],
        townVendor: getTownVendor(),
        hoveredMob: typeof deps.getHoveredMob === "function" ? deps.getHoveredMob(mobs, cameraX, cameraY) : null,
        hoveredBag: typeof deps.getHoveredLootBag === "function" ? deps.getHoveredLootBag(lootBags, cameraX, cameraY) : null,
        hoveredVendor: typeof deps.getHoveredVendor === "function" ? deps.getHoveredVendor(cameraX, cameraY) : null
      };
    }

    return {
      buildWorldFrameViewModel
    };
  }

  globalScope.VibeClientWorldViewModels = Object.freeze({
    createWorldViewModelTools
  });
})(globalThis);
