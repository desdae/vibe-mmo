(function initVibeClientConfigBootstrap(globalScope) {
  "use strict";

  function createConfigBootstrapTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const loadConfig = typeof deps.loadConfig === "function" ? deps.loadConfig : async () => false;
    const scheduleTask =
      typeof deps.scheduleTask === "function"
        ? deps.scheduleTask
        : (task) => {
            if (typeof globalScope.requestIdleCallback === "function") {
              globalScope.requestIdleCallback(() => task());
              return;
            }
            globalScope.setTimeout(() => task(), 0);
          };

    let initialGameConfigPromise = null;
    let audioPreloadQueued = false;

    function ensureInitialGameConfig() {
      if (initialGameConfigPromise) {
        return initialGameConfigPromise;
      }
      initialGameConfigPromise = Promise.resolve().then(() => loadConfig());
      return initialGameConfigPromise;
    }

    function scheduleAbilityAudioPreload(preloadAudio) {
      if (audioPreloadQueued || typeof preloadAudio !== "function") {
        return false;
      }
      audioPreloadQueued = true;
      scheduleTask(() => {
        try {
          preloadAudio();
        } finally {
          audioPreloadQueued = false;
        }
      });
      return true;
    }

    return {
      ensureInitialGameConfig,
      scheduleAbilityAudioPreload
    };
  }

  globalScope.VibeClientConfigBootstrap = Object.freeze({
    createConfigBootstrapTools
  });
})(globalThis);
