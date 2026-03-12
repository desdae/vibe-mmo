(function initVibeClientRendererBootstrap(globalScope) {
  "use strict";

  const CANVAS_RENDERER = "canvas";
  const PIXI_RENDERER = "pixi";
  const RENDERER_STORAGE_KEY = "vibemmo-renderer";

  function normalizeRendererName(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === PIXI_RENDERER) {
      return PIXI_RENDERER;
    }
    return CANVAS_RENDERER;
  }

  function readRendererPreference(windowObject) {
    const source = windowObject || globalScope;
    try {
      const params = new URLSearchParams(source.location && source.location.search ? source.location.search : "");
      if (params.has("renderer")) {
        return normalizeRendererName(params.get("renderer"));
      }
    } catch (_error) {
      // Ignore malformed location access.
    }
    try {
      const stored = source.localStorage ? source.localStorage.getItem(RENDERER_STORAGE_KEY) : "";
      if (stored) {
        return normalizeRendererName(stored);
      }
    } catch (_error) {
      // Ignore storage failures.
    }
    return CANVAS_RENDERER;
  }

  function createRendererBootstrap(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const windowObject = deps.windowObject || globalScope;
    const canvasElement = deps.canvasElement || null;
    const canvasWorldRenderer = deps.canvasWorldRenderer;
    const pixiWorldRenderer = deps.pixiWorldRenderer || null;
    if (!canvasWorldRenderer || typeof canvasWorldRenderer.renderWorldFrame !== "function") {
      return null;
    }

    let rendererMode = readRendererPreference(windowObject);
    let hasWarnedPixiFallback = false;

    function applyRendererVisibility() {
      const canUsePixi = rendererMode === PIXI_RENDERER && pixiWorldRenderer && typeof pixiWorldRenderer.renderWorldFrame === "function";
      if (canUsePixi) {
        if (typeof pixiWorldRenderer.show === "function") {
          pixiWorldRenderer.show();
        }
        if (canvasElement) {
          canvasElement.style.opacity = "0";
        }
        return;
      }
      if (pixiWorldRenderer && typeof pixiWorldRenderer.hide === "function") {
        pixiWorldRenderer.hide();
      }
      if (canvasElement) {
        canvasElement.style.opacity = "1";
      }
    }

    function setRendererMode(nextMode) {
      rendererMode = normalizeRendererName(nextMode);
      try {
        if (windowObject.localStorage) {
          windowObject.localStorage.setItem(RENDERER_STORAGE_KEY, rendererMode);
        }
      } catch (_error) {
        // Ignore storage failures.
      }
      applyRendererVisibility();
      return rendererMode;
    }

    function getRendererMode() {
      return rendererMode;
    }

    function renderWorldFrame(frameViewModel) {
      if (rendererMode === PIXI_RENDERER && pixiWorldRenderer && typeof pixiWorldRenderer.renderWorldFrame === "function") {
        applyRendererVisibility();
        return pixiWorldRenderer.renderWorldFrame(frameViewModel);
      }
      if (rendererMode === PIXI_RENDERER && !hasWarnedPixiFallback) {
        hasWarnedPixiFallback = true;
        try {
          console.warn("[renderer] Pixi renderer requested but unavailable, falling back to canvas.");
        } catch (_error) {
          // Ignore console failures.
        }
      }
      applyRendererVisibility();
      return canvasWorldRenderer.renderWorldFrame(frameViewModel);
    }

    function resize(width, height) {
      if (pixiWorldRenderer && typeof pixiWorldRenderer.resize === "function") {
        pixiWorldRenderer.resize(width, height);
      }
    }

    function getDebugStats() {
      if (rendererMode === PIXI_RENDERER && pixiWorldRenderer && typeof pixiWorldRenderer.getDebugStats === "function") {
        return pixiWorldRenderer.getDebugStats();
      }
      if (canvasWorldRenderer && typeof canvasWorldRenderer.getDebugStats === "function") {
        return canvasWorldRenderer.getDebugStats();
      }
      return {
        mode: rendererMode
      };
    }

    applyRendererVisibility();

    return {
      getRendererMode,
      setRendererMode,
      resize,
      renderWorldFrame,
      getDebugStats
    };
  }

  globalScope.VibeClientRendererBootstrap = Object.freeze({
    CANVAS_RENDERER,
    PIXI_RENDERER,
    RENDERER_STORAGE_KEY,
    createRendererBootstrap
  });
})(globalThis);
