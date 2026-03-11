(function initVibeClientRenderLoop(globalScope) {
  "use strict";

  function createRenderLoopTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    const canvas = deps.canvas;
    const gameState = deps.gameState;
    if (!ctx || !canvas || !gameState) {
      return null;
    }

    const requestFrame =
      typeof deps.requestAnimationFrame === "function"
        ? deps.requestAnimationFrame.bind(globalScope)
        : globalScope.requestAnimationFrame.bind(globalScope);

    function renderFrame() {
      requestFrame(renderFrame);

      const frameNow = performance.now();
      deps.reportFrame(frameNow);
      deps.updateAbilityChannel(frameNow);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a1621";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const interpolatedState =
        deps.getInterpolatedState() ||
        (gameState.self
          ? {
              self: gameState.self,
              players: gameState.players,
              projectiles: gameState.projectiles,
              mobs: gameState.mobs,
              lootBags: gameState.lootBags
            }
          : null);

      if (!interpolatedState || !interpolatedState.self) {
        deps.updateActionBarUI(null);
        return;
      }
      deps.setLastRenderState(interpolatedState);

      const cameraX = interpolatedState.self.x + 0.5;
      const cameraY = interpolatedState.self.y + 0.5;
      deps.updateMobCastSpatialAudio(interpolatedState.mobs, frameNow);
      deps.updateProjectileSpatialAudio(interpolatedState.projectiles, frameNow);

      deps.drawGrid(cameraX, cameraY);
      deps.drawAbilityCastPreview(interpolatedState.self, cameraX, cameraY, frameNow);
      const hoveredMob = deps.getHoveredMob(interpolatedState.mobs, cameraX, cameraY);
      const hoveredBag = deps.getHoveredLootBag(interpolatedState.lootBags, cameraX, cameraY);
      const hoveredVendor = deps.getHoveredVendor(cameraX, cameraY);

      for (const projectile of interpolatedState.projectiles) {
        deps.drawProjectile(projectile, cameraX, cameraY, frameNow);
      }
      deps.drawExplosionEffects(cameraX, cameraY);
      deps.drawAreaEffects(cameraX, cameraY, frameNow, "underlay");
      deps.drawVendorNpc(cameraX, cameraY, frameNow);

      for (const bag of interpolatedState.lootBags) {
        deps.drawLootBag(bag, cameraX, cameraY, frameNow);
      }

      for (const mob of interpolatedState.mobs) {
        const attackState = deps.getActiveMobAttackState(mob.id);
        const attackVisual = deps.getMobAttackVisualType(mob);
        if (deps.isHumanoidMob && deps.isHumanoidMob(mob)) {
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

      for (const other of interpolatedState.players) {
        deps.drawPlayer(other, cameraX, cameraY, false);
        deps.drawPlayerEffectAnimations(other, cameraX, cameraY, false, frameNow);
        deps.drawPlayerCastBar(other, cameraX, cameraY, false, frameNow);
      }

      deps.drawPlayer(interpolatedState.self, cameraX, cameraY, true);
      deps.drawPlayerEffectAnimations(interpolatedState.self, cameraX, cameraY, true, frameNow);
      deps.drawPlayerCastBar(interpolatedState.self, cameraX, cameraY, true, frameNow);

      if (hoveredMob) {
        deps.drawMobTooltip(hoveredMob.mob, hoveredMob.p);
      }
      if (hoveredBag) {
        deps.drawLootBagTooltip(hoveredBag.bag, hoveredBag.p);
      }
      if (hoveredVendor) {
        deps.drawVendorTooltip(hoveredVendor.vendor, hoveredVendor.p);
      }

      const latestSelf = gameState.self || interpolatedState.self;
      deps.updateActionBarUI(latestSelf);

      if (deps.hudName) {
        deps.hudName.textContent = `Player: ${latestSelf.name} (${deps.getMyId() || "?"})`;
      }
      if (deps.hudClass) {
        deps.hudClass.textContent = `Class: ${latestSelf.classType} | HP: ${latestSelf.hp}/${latestSelf.maxHp} | Copper: ${latestSelf.copper ?? 0} | Lvl: ${latestSelf.level ?? 1} EXP: ${latestSelf.exp ?? 0}/${latestSelf.expToNext ?? 20} | SP: ${latestSelf.skillPoints ?? 0}`;
      }
      if (deps.hudPos) {
        deps.hudPos.textContent = `Pos: ${interpolatedState.self.x.toFixed(1)}, ${interpolatedState.self.y.toFixed(1)}`;
      }
    }

    return {
      renderFrame
    };
  }

  globalScope.VibeClientRenderLoop = Object.freeze({
    createRenderLoopTools
  });
})(globalThis);
