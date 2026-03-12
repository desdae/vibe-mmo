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
    const canvasWorldRenderer = deps.canvasWorldRenderer;
    const pixiWorldRenderer = deps.pixiWorldRenderer || null;
    if (!canvasWorldRenderer || typeof canvasWorldRenderer.renderWorldFrame !== "function") {
      return null;
    }

    let rendererMode = readRendererPreference(windowObject);
    let hasWarnedPixiFallback = false;

    function setRendererMode(nextMode) {
      rendererMode = normalizeRendererName(nextMode);
      try {
        if (windowObject.localStorage) {
          windowObject.localStorage.setItem(RENDERER_STORAGE_KEY, rendererMode);
        }
      } catch (_error) {
        // Ignore storage failures.
      }
      return rendererMode;
    }

    function getRendererMode() {
      return rendererMode;
    }

    function renderWorldFrame(frameViewModel) {
      if (rendererMode === PIXI_RENDERER && pixiWorldRenderer && typeof pixiWorldRenderer.renderWorldFrame === "function") {
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
      return canvasWorldRenderer.renderWorldFrame(frameViewModel);
    }

    return {
      getRendererMode,
      setRendererMode,
      renderWorldFrame
    };
  }

  globalScope.VibeClientRendererBootstrap = Object.freeze({
    CANVAS_RENDERER,
    PIXI_RENDERER,
    RENDERER_STORAGE_KEY,
    createRendererBootstrap
  });
})(globalThis);
