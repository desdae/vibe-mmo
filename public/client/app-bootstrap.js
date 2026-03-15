(function initVibeClientAppBootstrap(globalScope) {
  "use strict";

  const appNamespace =
    globalScope.VibeClientApp && typeof globalScope.VibeClientApp === "object"
      ? globalScope.VibeClientApp
      : (globalScope.VibeClientApp = {});

  function createAppBootstrapTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};

    const sharedClientRenderLoop = globalScope.VibeClientRenderLoop || null;
    const sharedCreateRenderLoopTools =
      sharedClientRenderLoop && typeof sharedClientRenderLoop.createRenderLoopTools === "function"
        ? sharedClientRenderLoop.createRenderLoopTools
        : null;
    const sharedClientWorldViewModels = globalScope.VibeClientWorldViewModels || null;
    const sharedCreateWorldViewModelTools =
      sharedClientWorldViewModels && typeof sharedClientWorldViewModels.createWorldViewModelTools === "function"
        ? sharedClientWorldViewModels.createWorldViewModelTools
        : null;
    const worldViewModelTools = sharedCreateWorldViewModelTools
      ? sharedCreateWorldViewModelTools({
          gameState: deps.gameState,
          getAreaEffects: deps.getAreaEffects,
          getExplosionViews: deps.getExplosionViews,
          getTownVendor: deps.getTownVendor,
          getTownQuestGivers: deps.getTownQuestGivers,
          getActionDefById: deps.getActionDefById,
          getAbilityVisualHook: deps.getAbilityVisualHook,
          getProjectileSpriteFrame: deps.getProjectileSpriteFrame,
          getActiveMobAttackState: deps.getActiveMobAttackState,
          getPlayerAttackState: deps.getPlayerAttackState,
          getMobAttackVisualType: deps.getMobAttackVisualType,
          isHumanoidMob: deps.isHumanoidMob,
          getPlayerCastVisualState: deps.getPlayerCastVisualState,
          getPlayerStatusVisualState: deps.getPlayerStatusVisualState,
          getMobCastVisualState: deps.getMobCastVisualState,
          getMobStatusVisualState: deps.getMobStatusVisualState,
          getFloatingDamageViews: deps.getFloatingDamageViews,
          getHoveredMob: deps.getHoveredMob,
          getHoveredLootBag: deps.getHoveredLootBag,
          getHoveredVendor: deps.getHoveredVendor,
          getHoveredQuestNpc: deps.getHoveredQuestNpc
        })
      : null;

    const sharedClientCanvasWorldRenderer = globalScope.VibeClientCanvasWorldRenderer || null;
    const sharedCreateCanvasWorldRenderer =
      sharedClientCanvasWorldRenderer && typeof sharedClientCanvasWorldRenderer.createCanvasWorldRenderer === "function"
        ? sharedClientCanvasWorldRenderer.createCanvasWorldRenderer
        : null;
    const canvasWorldRenderer = sharedCreateCanvasWorldRenderer
      ? sharedCreateCanvasWorldRenderer({
          ctx: deps.ctx,
          canvas: deps.canvas,
          updateActionBarUI: deps.updateActionBarUI,
          updateMobCastSpatialAudio: deps.updateMobCastSpatialAudio,
          updateProjectileSpatialAudio: deps.updateProjectileSpatialAudio,
          drawGrid: deps.drawGrid,
          drawAbilityCastPreview: deps.drawAbilityCastPreview,
          drawProjectile: deps.drawProjectile,
          drawExplosionEffects: deps.drawExplosionEffects,
          drawAreaEffects: deps.drawAreaEffects,
          drawVendorNpc: deps.drawVendorNpc,
          drawQuestNpcs: deps.drawQuestNpcs,
          drawLootBag: deps.drawLootBag,
          drawMob: deps.drawMob,
          drawSkeletonSwordSwing: deps.drawSkeletonSwordSwing,
          drawSkeletonArcherBowShot: deps.drawSkeletonArcherBowShot,
          drawCreeperIgnitionAnimation: deps.drawCreeperIgnitionAnimation,
          drawOrcDualAxeSwing: deps.drawOrcDualAxeSwing,
          drawMobBiteAnimation: deps.drawMobBiteAnimation,
          drawMobCastBar: deps.drawMobCastBar,
          drawMobSlowTint: deps.drawMobSlowTint,
          drawMobBurnEffect: deps.drawMobBurnEffect,
          drawMobStunEffect: deps.drawMobStunEffect,
          drawFloatingDamageNumbers: deps.drawFloatingDamageNumbers,
          pruneSkeletonWalkRuntime: deps.pruneSkeletonWalkRuntime,
          pruneCreeperWalkRuntime: deps.pruneCreeperWalkRuntime,
          pruneZombieWalkRuntime: deps.pruneZombieWalkRuntime,
          pruneSpiderWalkRuntime: deps.pruneSpiderWalkRuntime,
          pruneOrcWalkRuntime: deps.pruneOrcWalkRuntime,
          pruneSkeletonArcherWalkRuntime: deps.pruneSkeletonArcherWalkRuntime,
          pruneWarriorAnimRuntime: deps.pruneWarriorAnimRuntime,
          pruneProjectileVisualRuntime: deps.pruneProjectileVisualRuntime,
          pruneAmbientParticleEmitters: deps.pruneAmbientParticleEmitters,
          drawPlayer: deps.drawPlayer,
          drawPlayerEffectAnimations: deps.drawPlayerEffectAnimations,
          drawPlayerCastBar: deps.drawPlayerCastBar,
          drawMobTooltip: deps.drawMobTooltip,
          drawLootBagTooltip: deps.drawLootBagTooltip,
          drawVendorTooltip: deps.drawVendorTooltip,
          drawQuestNpcTooltip: deps.drawQuestNpcTooltip
        })
      : null;

    const sharedClientPixiWorldRenderer = globalScope.VibeClientPixiWorldRenderer || null;
    const sharedCreatePixiWorldRenderer =
      sharedClientPixiWorldRenderer && typeof sharedClientPixiWorldRenderer.createPixiWorldRenderer === "function"
        ? sharedClientPixiWorldRenderer.createPixiWorldRenderer
        : null;
    const pixiWorldRenderer = sharedCreatePixiWorldRenderer
      ? sharedCreatePixiWorldRenderer({
          PIXI: globalScope.PIXI || null,
          windowObject: deps.windowObject,
          canvasElement: deps.canvas,
          tileSize: deps.tileSize,
          townClientState: deps.townClientState,
          hashString: deps.hashString,
          sanitizeCssColor: deps.sanitizeCssColor,
          mouseState: deps.mouseState,
          screenToWorld: deps.screenToWorld,
          getCurrentSelf: deps.getCurrentSelf,
          getClassRenderStyle: deps.getClassRenderStyle,
          getPlayerVisualEquipment: deps.getPlayerVisualEquipment,
          getMobRenderStyle: deps.getMobRenderStyle,
          lootBagSparkleConfig: deps.lootBagSparkleConfig,
          getLootBagSprite: deps.getLootBagSprite,
          getTownTileSprite: deps.getTownTileSprite,
          getVendorNpcSprite: deps.getVendorNpcSprite,
          getQuestNpcSprite: deps.getQuestNpcSprite,
          mobSpriteSize: deps.mobSpriteSize,
          getCreeperWalkSprite: deps.getCreeperWalkSprite,
          getSpiderWalkSprite: deps.getSpiderWalkSprite,
          getActionDefById: deps.getActionDefById,
          findAbilityDefById: deps.findAbilityDefById,
          getAbilityEffectiveRangeForSelf: deps.getAbilityEffectiveRangeForSelf,
          getAbilityPreviewState: deps.getAbilityPreviewState,
          getAbilityVisualHook: deps.getAbilityVisualHook,
          abilityChannel: deps.abilityChannel,
          getCurrentMovementVector: deps.getCurrentMovementVector,
          isTouchJoystickEnabled: deps.isTouchJoystickEnabled,
          getProjectileSpriteFrame: deps.getProjectileSpriteFrame
        })
      : null;

    const sharedClientRendererBootstrap = globalScope.VibeClientRendererBootstrap || null;
    const sharedCreateRendererBootstrap =
      sharedClientRendererBootstrap && typeof sharedClientRendererBootstrap.createRendererBootstrap === "function"
        ? sharedClientRendererBootstrap.createRendererBootstrap
        : null;
    const rendererBootstrap = sharedCreateRendererBootstrap
      ? sharedCreateRendererBootstrap({
          windowObject: deps.windowObject,
          canvasElement: deps.canvas,
          canvasWorldRenderer,
          pixiWorldRenderer
        })
      : null;

    globalScope.__vibemmoGetRendererDebugStats = () =>
      rendererBootstrap && typeof rendererBootstrap.getDebugStats === "function" ? rendererBootstrap.getDebugStats() : null;

    const renderLoopTools = sharedCreateRenderLoopTools
      ? sharedCreateRenderLoopTools({
          ctx: deps.ctx,
          canvas: deps.canvas,
          gameState: deps.gameState,
          requestAnimationFrame: deps.requestAnimationFrame,
          reportFrame: deps.reportFrame,
          updateAbilityChannel: deps.updateAbilityChannel,
          updateResourceBars: deps.updateResourceBars,
          getInterpolatedState: deps.getInterpolatedState,
          updateActionBarUI: deps.updateActionBarUI,
          buildWorldFrameViewModel: (interpolatedState, frameNow) =>
            worldViewModelTools ? worldViewModelTools.buildWorldFrameViewModel(interpolatedState, frameNow) : null,
          renderWorldFrame: (frameViewModel) => {
            if (rendererBootstrap) {
              return rendererBootstrap.renderWorldFrame(frameViewModel);
            }
            if (canvasWorldRenderer) {
              return canvasWorldRenderer.renderWorldFrame(frameViewModel);
            }
            return null;
          },
          setLastRenderState: deps.setLastRenderState,
          hudName: deps.hudName,
          hudClass: deps.hudClass,
          hudPos: deps.hudPos,
          getMyId: deps.getMyId
        })
      : null;

    function render() {
      if (!renderLoopTools) {
        return;
      }
      renderLoopTools.renderFrame();
    }

    const sharedClientInputBootstrap = globalScope.VibeClientInputBootstrap || null;
    const sharedCreateInputBootstrap =
      sharedClientInputBootstrap && typeof sharedClientInputBootstrap.createInputBootstrap === "function"
        ? sharedClientInputBootstrap.createInputBootstrap
        : null;
    const inputBootstrapTools = sharedCreateInputBootstrap
      ? sharedCreateInputBootstrap({
          windowObject: deps.windowObject,
          document: deps.documentObject,
          canvas: deps.canvas,
          joinForm: deps.joinForm,
          gameUI: deps.gameUI,
          keys: deps.keys,
          mouseState: deps.mouseState,
          classDefsById: deps.classDefsById,
          requestAnimationFrame: deps.requestAnimationFrame,
          resizeCanvas: deps.resizeCanvas,
          resumeSpatialAudioContext: deps.resumeSpatialAudioContext,
          toggleDebugPanel: deps.toggleDebugPanel,
          toggleInventoryPanel: deps.toggleInventoryPanel,
          toggleEquipmentPanel: deps.toggleEquipmentPanel,
          toggleSpellbookPanel: deps.toggleSpellbookPanel,
          toggleTalentPanel: deps.toggleTalentPanel,
          toggleDpsPanel: deps.toggleDpsPanel,
          toggleQuestPanel: deps.toggleQuestPanel,
          questUiTools: deps.questUiTools,
          executeBoundAction: deps.executeBoundAction,
          tryContextVendorInteraction: deps.tryContextVendorInteraction,
          tryContextQuestNpcInteraction: deps.tryContextQuestNpcInteraction,
          tryContextLootPickup: deps.tryContextLootPickup,
          sendMove: deps.sendMove,
          cancelAutoVendorInteraction: deps.cancelAutoVendorInteraction,
          cancelAutoQuestInteraction: deps.cancelAutoQuestInteraction,
          cancelAutoLootPickup: deps.cancelAutoLootPickup,
          updateAutoVendorInteraction: deps.updateAutoVendorInteraction,
          updateAutoQuestInteraction: deps.updateAutoQuestInteraction,
          updateAutoLootPickup: deps.updateAutoLootPickup,
          clearDragState: deps.clearDragState,
          resetAbilityChanneling: deps.resetAbilityChanneling,
          stopAllSpatialLoops: deps.stopAllSpatialLoops,
          updateMouseScreenPosition: deps.updateMouseScreenPosition,
          tryPrimaryAutoAction: deps.tryPrimaryAutoAction,
          isTouchJoystickEnabled: deps.isTouchJoystickEnabled,
          beginTouchJoystick: deps.beginTouchJoystick,
          updateTouchJoystick: deps.updateTouchJoystick,
          endTouchJoystick: deps.endTouchJoystick,
          resetTouchJoystick: deps.resetTouchJoystick,
          resetMobileAbilityAim: deps.resetMobileAbilityAim,
          hasActiveMobileAbilityAim: deps.hasActiveMobileAbilityAim,
          hasActiveTouchJoystick: deps.hasActiveTouchJoystick,
          getActiveTouchJoystickId: deps.getActiveTouchJoystickId,
          setStatus: deps.setStatus,
          connectAndJoin: deps.connectAndJoin,
          updateDebugPanel: deps.updateDebugPanel,
          updateDpsPanel: deps.updateDpsPanel,
          refreshAdminBotList: deps.refreshAdminBotList,
          initializeDpsPanel: deps.initializeDpsPanel,
          loadInitialGameConfig: deps.loadInitialGameConfig,
          render
        })
      : null;

    return {
      rendererBootstrap,
      inputBootstrapTools,
      render
    };
  }

  appNamespace.bootstrap = Object.freeze({
    createAppBootstrapTools
  });
})(typeof window !== "undefined" ? window : globalThis);
