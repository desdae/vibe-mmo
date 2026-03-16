(function initVibeClientCanvasWorldRenderer(globalScope) {
  "use strict";

  function createCanvasWorldRenderer(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    const canvas = deps.canvas;
    if (!ctx || !canvas) {
      return null;
    }
    const spatialAudioIntervalMs = Math.max(0, Number(deps.spatialAudioIntervalMs) || 80);
    const maintenanceIntervalMs = Math.max(0, Number(deps.maintenanceIntervalMs) || 250);
    let lastDebugStats = {
      mode: "canvas",
      players: 0,
      mobs: 0,
      projectiles: 0,
      lootBags: 0,
      resources: 0,
      areaEffects: 0
    };
    let lastSpatialAudioUpdateAt = -Infinity;
    let lastMaintenanceAt = -Infinity;
    const mobAudioScratch = [];
    const projectileAudioScratch = [];

    function reuseEntityScratch(entries, target, propertyName) {
      const sourceEntries = Array.isArray(entries) ? entries : [];
      target.length = sourceEntries.length;
      for (let index = 0; index < sourceEntries.length; index += 1) {
        target[index] = sourceEntries[index] ? sourceEntries[index][propertyName] : null;
      }
      return target;
    }

    function updateSpatialAudio(frameViewModel, frameNow) {
      if (frameNow - lastSpatialAudioUpdateAt < spatialAudioIntervalMs) {
        return;
      }
      lastSpatialAudioUpdateAt = frameNow;
      if (typeof deps.updateMobCastSpatialAudio === "function") {
        deps.updateMobCastSpatialAudio(reuseEntityScratch(frameViewModel.mobViews, mobAudioScratch, "mob"), frameNow);
      }
      if (typeof deps.updateProjectileSpatialAudio === "function") {
        deps.updateProjectileSpatialAudio(
          reuseEntityScratch(frameViewModel.projectileViews, projectileAudioScratch, "projectile"),
          frameNow
        );
      }
    }

    function runMaintenance(frameNow) {
      if (frameNow - lastMaintenanceAt < maintenanceIntervalMs) {
        return;
      }
      lastMaintenanceAt = frameNow;
      deps.pruneSkeletonWalkRuntime();
      deps.pruneCreeperWalkRuntime();
      deps.pruneZombieWalkRuntime();
      deps.pruneSpiderWalkRuntime();
      deps.pruneOrcWalkRuntime();
      deps.pruneSkeletonArcherWalkRuntime();
      deps.pruneWarriorAnimRuntime();
      deps.pruneProjectileVisualRuntime(frameNow);
      deps.pruneAmbientParticleEmitters(frameNow);
    }

    function renderWorldFrame(frameViewModel) {
      if (!frameViewModel || !frameViewModel.self) {
        if (typeof deps.updateActionBarUI === "function") {
          deps.updateActionBarUI(null);
        }
        return;
      }

      const frameNow = Number(frameViewModel.frameNow) || performance.now();
      const cameraX = Number(frameViewModel.cameraX) || 0;
      const cameraY = Number(frameViewModel.cameraY) || 0;
      lastDebugStats = {
        mode: "canvas",
        players: (Array.isArray(frameViewModel.playerViews) ? frameViewModel.playerViews.length : 0) + 1,
        mobs: Array.isArray(frameViewModel.mobViews) ? frameViewModel.mobViews.length : 0,
        projectiles: Array.isArray(frameViewModel.projectileViews) ? frameViewModel.projectileViews.length : 0,
        lootBags: Array.isArray(frameViewModel.lootBagViews) ? frameViewModel.lootBagViews.length : 0,
        resources: Array.isArray(frameViewModel.resourceNodeViews) ? frameViewModel.resourceNodeViews.length : 0,
        areaEffects: Array.isArray(frameViewModel.areaEffects) ? frameViewModel.areaEffects.length : 0
      };

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a1621";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      updateSpatialAudio(frameViewModel, frameNow);

      deps.drawGrid(cameraX, cameraY);
      deps.drawAbilityCastPreview(frameViewModel.self, cameraX, cameraY, frameNow);

      for (const entry of frameViewModel.projectileViews) {
        deps.drawProjectile(entry.projectile, cameraX, cameraY, frameNow);
      }
      deps.drawExplosionEffects(cameraX, cameraY);
      deps.drawAreaEffects(cameraX, cameraY, frameNow, "underlay");
      deps.drawVendorNpc(cameraX, cameraY, frameNow);
      deps.drawQuestNpcs(cameraX, cameraY, frameNow);
      for (const entry of Array.isArray(frameViewModel.resourceNodeViews) ? frameViewModel.resourceNodeViews : []) {
        deps.drawResourceNode(entry.node, cameraX, cameraY, frameNow);
      }

      for (const entry of frameViewModel.lootBagViews) {
        deps.drawLootBag(entry.bag, cameraX, cameraY, frameNow);
      }

      for (const entry of frameViewModel.mobViews) {
        const mob = entry.mob;
        const attackState = entry.attackState;
        const attackVisual = entry.attackVisual;
        if (entry.isHumanoid) {
          deps.drawMob(mob, cameraX, cameraY, attackState);
        } else if (attackVisual === "sword") {
          deps.drawMob(mob, cameraX, cameraY, attackState);
          deps.drawSkeletonSwordSwing(mob, cameraX, cameraY, attackState);
        } else if (attackVisual === "bow") {
          deps.drawMob(mob, cameraX, cameraY, attackState);
          deps.drawSkeletonArcherBowShot(mob, cameraX, cameraY, attackState);
        } else if (attackVisual === "ignition") {
          deps.drawMob(mob, cameraX, cameraY, attackState);
          deps.drawCreeperIgnitionAnimation(mob, cameraX, cameraY, attackState);
        } else if (attackVisual === "dual_axes") {
          deps.drawMob(mob, cameraX, cameraY, attackState);
          deps.drawOrcDualAxeSwing(mob, cameraX, cameraY, attackState);
        } else if (attackVisual === "none") {
          deps.drawMob(mob, cameraX, cameraY, attackState);
        } else {
          deps.drawMob(mob, cameraX, cameraY, attackState);
          deps.drawMobBiteAnimation(mob, cameraX, cameraY);
        }
        deps.drawMobCastBar(mob, cameraX, cameraY, frameNow);
        deps.drawMobSlowTint(mob, cameraX, cameraY, frameNow);
        deps.drawMobBurnEffect(mob, cameraX, cameraY, frameNow);
        deps.drawMobStunEffect(mob, cameraX, cameraY, frameNow);
      }
      deps.drawAreaEffects(cameraX, cameraY, frameNow, "overlay");
      deps.drawFloatingDamageNumbers(cameraX, cameraY);
      runMaintenance(frameNow);

      for (const entry of frameViewModel.playerViews) {
        deps.drawPlayer(entry.player, cameraX, cameraY, false);
        deps.drawPlayerEffectAnimations(entry.player, cameraX, cameraY, false, frameNow);
        deps.drawPlayerCastBar(entry.player, cameraX, cameraY, false, frameNow);
      }

      deps.drawPlayer(frameViewModel.selfView.player, cameraX, cameraY, true);
      deps.drawPlayerEffectAnimations(frameViewModel.selfView.player, cameraX, cameraY, true, frameNow);
      deps.drawPlayerCastBar(frameViewModel.selfView.player, cameraX, cameraY, true, frameNow);

      if (frameViewModel.hoveredMob) {
        deps.drawMobTooltip(frameViewModel.hoveredMob.mob, frameViewModel.hoveredMob.p);
      }
      if (frameViewModel.hoveredBag) {
        deps.drawLootBagTooltip(frameViewModel.hoveredBag.bag, frameViewModel.hoveredBag.p);
      }
      if (frameViewModel.hoveredResourceNode) {
        deps.drawResourceTooltip(frameViewModel.hoveredResourceNode.node, frameViewModel.hoveredResourceNode.p);
      }
      if (frameViewModel.hoveredVendor) {
        deps.drawVendorTooltip(frameViewModel.hoveredVendor.vendor, frameViewModel.hoveredVendor.p);
      }
      if (frameViewModel.hoveredQuestNpc) {
        deps.drawQuestNpcTooltip(frameViewModel.hoveredQuestNpc.npc, frameViewModel.hoveredQuestNpc.p);
      }
    }

    return {
      renderWorldFrame,
      getDebugStats: () => ({ ...lastDebugStats })
    };
  }

  globalScope.VibeClientCanvasWorldRenderer = Object.freeze({
    createCanvasWorldRenderer
  });
})(globalThis);
