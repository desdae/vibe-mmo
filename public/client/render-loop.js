(function initVibeClientRenderLoop(globalScope) {
  "use strict";

  function createRenderLoopTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    const canvas = deps.canvas;
    const gameState = deps.gameState;
    const buildWorldFrameViewModel = typeof deps.buildWorldFrameViewModel === "function" ? deps.buildWorldFrameViewModel : null;
    const renderWorldFrame = typeof deps.renderWorldFrame === "function" ? deps.renderWorldFrame : null;
    const updateResourceBars = typeof deps.updateResourceBars === "function" ? deps.updateResourceBars : null;
    if (!ctx || !canvas || !gameState || !buildWorldFrameViewModel || !renderWorldFrame) {
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0a1621";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (updateResourceBars) {
          updateResourceBars(null);
        }
        deps.updateActionBarUI(null);
        return;
      }
      deps.setLastRenderState(interpolatedState);

      const frameViewModel = buildWorldFrameViewModel(interpolatedState, frameNow);
      renderWorldFrame(frameViewModel);

      const latestSelf = gameState.self || interpolatedState.self;
      if (updateResourceBars) {
        updateResourceBars(latestSelf);
      }
      deps.updateActionBarUI(latestSelf);

      if (deps.hudName) {
        deps.hudName.textContent = `Player: ${latestSelf.name} (${deps.getMyId() || "?"})`;
      }
      if (deps.hudClass) {
        deps.hudClass.textContent = `Class: ${latestSelf.classType} | HP: ${latestSelf.hp}/${latestSelf.maxHp} | Copper: ${latestSelf.copper ?? 0} | Lvl: ${latestSelf.level ?? 1} EXP: ${latestSelf.exp ?? 0}/${latestSelf.expToNext ?? 20} | SP: ${latestSelf.skillPoints ?? 0}`;
      }
      if (deps.hudPos) {
        deps.hudPos.textContent = `Pos: ${latestSelf.x.toFixed(1)}, ${latestSelf.y.toFixed(1)}`;
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
