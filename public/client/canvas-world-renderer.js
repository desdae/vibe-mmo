(function initVibeClientCanvasWorldRenderer(globalScope) {
  "use strict";

  function createCanvasWorldRenderer(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    const canvas = deps.canvas;
    if (!ctx || !canvas) {
      return null;
    }
    let lastDebugStats = {
      mode: "canvas",
      players: 0,
      mobs: 0,
      projectiles: 0,
      lootBags: 0,
      areaEffects: 0
    };

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
        areaEffects: Array.isArray(frameViewModel.areaEffects) ? frameViewModel.areaEffects.length : 0
      };

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a1621";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (typeof deps.updateMobCastSpatialAudio === "function") {
        deps.updateMobCastSpatialAudio(
          frameViewModel.mobViews.map((entry) => entry.mob),
          frameNow
        );
      }
      if (typeof deps.updateProjectileSpatialAudio === "function") {
        deps.updateProjectileSpatialAudio(
          frameViewModel.projectileViews.map((entry) => entry.projectile),
          frameNow
        );
      }

      deps.drawGrid(cameraX, cameraY);
      deps.drawAbilityCastPreview(frameViewModel.self, cameraX, cameraY, frameNow);

      for (const entry of frameViewModel.projectileViews) {
        deps.drawProjectile(entry.projectile, cameraX, cameraY, frameNow);
      }
      deps.drawExplosionEffects(cameraX, cameraY);
      deps.drawAreaEffects(cameraX, cameraY, frameNow, "underlay");
      deps.drawVendorNpc(cameraX, cameraY, frameNow);

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
      deps.pruneSkeletonWalkRuntime();
      deps.pruneCreeperWalkRuntime();
      deps.pruneZombieWalkRuntime();
      deps.pruneSpiderWalkRuntime();
      deps.pruneOrcWalkRuntime();
      deps.pruneSkeletonArcherWalkRuntime();
      deps.pruneWarriorAnimRuntime();
      deps.pruneProjectileVisualRuntime(frameNow);
      deps.pruneAmbientParticleEmitters(frameNow);

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
      if (frameViewModel.hoveredVendor) {
        deps.drawVendorTooltip(frameViewModel.hoveredVendor.vendor, frameViewModel.hoveredVendor.p);
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
