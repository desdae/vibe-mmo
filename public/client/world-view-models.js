(function initVibeClientWorldViewModels(globalScope) {
  "use strict";

  function createWorldViewModelTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const gameState = deps.gameState;
    const getAreaEffects = typeof deps.getAreaEffects === "function" ? deps.getAreaEffects : () => [];
    const getExplosionViews = typeof deps.getExplosionViews === "function" ? deps.getExplosionViews : () => [];
    const getTownVendor = typeof deps.getTownVendor === "function" ? deps.getTownVendor : () => null;
    const getTownQuestGivers = typeof deps.getTownQuestGivers === "function" ? deps.getTownQuestGivers : () => [];
    const getActionDefById = typeof deps.getActionDefById === "function" ? deps.getActionDefById : () => null;
    const getAbilityVisualHook = typeof deps.getAbilityVisualHook === "function" ? deps.getAbilityVisualHook : () => "default";
    const getProjectileSpriteFrame = typeof deps.getProjectileSpriteFrame === "function" ? deps.getProjectileSpriteFrame : null;
    if (!gameState) {
      return null;
    }
    const mobViewCache = new Map();
    const playerViewCache = new Map();
    const projectileViewCache = new Map();
    const lootBagViewCache = new Map();
    const resourceNodeViewCache = new Map();
    let cacheEpoch = 0;
    const selfView = {
      player: null,
      isSelf: true,
      attackState: null,
      castVisual: null,
      statusVisual: null
    };
    const frameViewModel = {
      frameNow: 0,
      cameraX: 0,
      cameraY: 0,
      self: null,
      latestSelf: null,
      projectileViews: [],
      mobViews: [],
      playerViews: [],
      selfView,
      lootBagViews: [],
      resourceNodeViews: [],
      areaEffects: [],
      explosionViews: [],
      floatingDamageViews: [],
      townVendor: null,
      townQuestGivers: [],
      hoveredMob: null,
      hoveredBag: null,
      hoveredResourceNode: null,
      hoveredVendor: null,
      hoveredQuestNpc: null
    };

    function getEntityCacheKey(entity, prefix, index) {
      if (entity && entity.id != null) {
        return String(entity.id);
      }
      return `${prefix}:${index}`;
    }

    function syncEntryViews(sourceEntries, targetEntries, viewCache, cacheKeyPrefix, syncEntry) {
      const epoch = ++cacheEpoch;
      targetEntries.length = 0;
      for (let index = 0; index < sourceEntries.length; index += 1) {
        const sourceEntry = sourceEntries[index];
        const cacheKey = getEntityCacheKey(sourceEntry, cacheKeyPrefix, index);
        let viewEntry = viewCache.get(cacheKey);
        if (!viewEntry) {
          viewEntry = {};
          viewCache.set(cacheKey, viewEntry);
        }
        viewEntry.__epoch = epoch;
        syncEntry(viewEntry, sourceEntry);
        targetEntries.push(viewEntry);
      }
      for (const [cacheKey, viewEntry] of viewCache.entries()) {
        if (!viewEntry || viewEntry.__epoch !== epoch) {
          viewCache.delete(cacheKey);
        }
      }
      return targetEntries;
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
      const resourceNodes = Array.isArray(interpolatedState.resourceNodes) ? interpolatedState.resourceNodes : [];

      const mobViews = syncEntryViews(mobs, frameViewModel.mobViews, mobViewCache, "mob", (entry, mob) => {
        entry.mob = mob;
        entry.attackState = typeof deps.getActiveMobAttackState === "function" ? deps.getActiveMobAttackState(mob.id) : null;
        entry.attackVisual = typeof deps.getMobAttackVisualType === "function" ? deps.getMobAttackVisualType(mob) : "none";
        entry.isHumanoid = typeof deps.isHumanoidMob === "function" ? deps.isHumanoidMob(mob) : false;
        entry.castVisual = typeof deps.getMobCastVisualState === "function" ? deps.getMobCastVisualState(mob, frameNow) : null;
        entry.statusVisual = typeof deps.getMobStatusVisualState === "function" ? deps.getMobStatusVisualState(mob, frameNow) : null;
      });

      const playerViews = syncEntryViews(players, frameViewModel.playerViews, playerViewCache, "player", (entry, player) => {
        entry.player = player;
        entry.isSelf = false;
        entry.attackState =
          typeof deps.getPlayerAttackState === "function" ? deps.getPlayerAttackState(player, false, frameNow) : null;
        entry.castVisual =
          typeof deps.getPlayerCastVisualState === "function" ? deps.getPlayerCastVisualState(player, false, frameNow) : null;
        entry.statusVisual =
          typeof deps.getPlayerStatusVisualState === "function" ? deps.getPlayerStatusVisualState(player, false, frameNow) : null;
      });

      selfView.player = self;
      selfView.isSelf = true;
      selfView.attackState = typeof deps.getPlayerAttackState === "function" ? deps.getPlayerAttackState(self, true, frameNow) : null;
      selfView.castVisual = typeof deps.getPlayerCastVisualState === "function" ? deps.getPlayerCastVisualState(self, true, frameNow) : null;
      selfView.statusVisual = typeof deps.getPlayerStatusVisualState === "function" ? deps.getPlayerStatusVisualState(self, true, frameNow) : null;

      const rawExplosionViews = getExplosionViews(frameNow);
      const explosionViews = Array.isArray(rawExplosionViews) ? rawExplosionViews : [];
      const projectileViews = syncEntryViews(
        projectiles,
        frameViewModel.projectileViews,
        projectileViewCache,
        "projectile",
        (entry, projectile) => {
        const abilityId = String(projectile && projectile.abilityId || "").trim();
        const actionDef = getActionDefById(abilityId);
        const projectileHook = String(
          getAbilityVisualHook(abilityId, actionDef, "projectileRenderer", "default") || "default"
        )
          .trim()
          .toLowerCase();
          entry.projectile = projectile;
          entry.projectileHook = projectileHook;
          entry.spriteFrame = getProjectileSpriteFrame ? getProjectileSpriteFrame(projectile, frameNow) : null;
        }
      );

      frameViewModel.frameNow = frameNow;
      frameViewModel.cameraX = cameraX;
      frameViewModel.cameraY = cameraY;
      frameViewModel.self = self;
      frameViewModel.latestSelf = gameState.self || self;
      frameViewModel.projectileViews = projectileViews;
      frameViewModel.mobViews = mobViews;
      frameViewModel.playerViews = playerViews;
      frameViewModel.selfView = selfView;
      frameViewModel.lootBagViews = syncEntryViews(lootBags, frameViewModel.lootBagViews, lootBagViewCache, "loot", (entry, bag) => {
        entry.bag = bag;
      });
      frameViewModel.resourceNodeViews = syncEntryViews(
        resourceNodes,
        frameViewModel.resourceNodeViews,
        resourceNodeViewCache,
        "resource",
        (entry, node) => {
          entry.node = node;
        }
      );
      frameViewModel.areaEffects = Array.isArray(getAreaEffects()) ? getAreaEffects() : [];
      frameViewModel.explosionViews = explosionViews;
      frameViewModel.floatingDamageViews =
        typeof deps.getFloatingDamageViews === "function" ? deps.getFloatingDamageViews(frameNow) : [];
      frameViewModel.townVendor = getTownVendor();
      frameViewModel.townQuestGivers = getTownQuestGivers();
      frameViewModel.hoveredMob =
        typeof deps.getHoveredMob === "function" ? deps.getHoveredMob(mobs, cameraX, cameraY) : null;
      frameViewModel.hoveredBag =
        typeof deps.getHoveredLootBag === "function" ? deps.getHoveredLootBag(lootBags, cameraX, cameraY) : null;
      frameViewModel.hoveredResourceNode =
        typeof deps.getHoveredResourceNode === "function" ? deps.getHoveredResourceNode(resourceNodes, cameraX, cameraY) : null;
      frameViewModel.hoveredVendor =
        typeof deps.getHoveredVendor === "function" ? deps.getHoveredVendor(cameraX, cameraY) : null;
      frameViewModel.hoveredQuestNpc =
        typeof deps.getHoveredQuestNpc === "function" ? deps.getHoveredQuestNpc(cameraX, cameraY) : null;
      return frameViewModel;
    }

    return {
      buildWorldFrameViewModel
    };
  }

  globalScope.VibeClientWorldViewModels = Object.freeze({
    createWorldViewModelTools
  });
})(globalThis);
