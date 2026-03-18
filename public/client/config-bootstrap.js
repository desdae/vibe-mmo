(function initVibeClientConfigBootstrap(globalScope) {
  "use strict";

  function createConfigBootstrapTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const loadJoinConfig = typeof deps.loadJoinConfig === "function" ? deps.loadJoinConfig : async () => false;
    const loadInitialConfig =
      typeof deps.loadInitialConfig === "function" ? deps.loadInitialConfig : async () => false;
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

    let joinConfigPromise = null;
    let initialGameConfigPromise = null;
    let audioPreloadQueued = false;

    function ensureJoinConfig() {
      if (joinConfigPromise) {
        return joinConfigPromise;
      }
      joinConfigPromise = Promise.resolve().then(() => loadJoinConfig());
      return joinConfigPromise;
    }

    function ensureInitialGameConfig() {
      if (initialGameConfigPromise) {
        return initialGameConfigPromise;
      }
      initialGameConfigPromise = Promise.resolve().then(() => loadInitialConfig());
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
      ensureJoinConfig,
      ensureInitialGameConfig,
      scheduleAbilityAudioPreload
    };
  }

  globalScope.VibeClientConfigBootstrap = Object.freeze({
    createConfigBootstrapTools
  });
})(globalThis);
