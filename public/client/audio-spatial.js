(function initVibeClientSpatialAudio(globalScope) {
  "use strict";

  function fallbackClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createSpatialAudioTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const spatialAudioState = deps.spatialAudioState;
    const spatialAudioConfig = deps.spatialAudioConfig;
    if (!spatialAudioState || !spatialAudioConfig) {
      return null;
    }

    const clamp = typeof deps.clamp === "function" ? deps.clamp : fallbackClamp;
    const getCurrentSelf = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf : () => null;
    const missingRetryMs = Math.max(100, Number(deps.missingRetryMs) || 2000);

    function ensureSpatialAudioContext() {
      if (spatialAudioState.context) {
        return spatialAudioState.context;
      }
      const Ctx = globalScope.AudioContext || globalScope.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      const context = new Ctx();
      const masterGain = context.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(context.destination);
      spatialAudioState.context = context;
      spatialAudioState.masterGain = masterGain;
      return context;
    }

    function resumeSpatialAudioContext() {
      const context = ensureSpatialAudioContext();
      if (!context) {
        return;
      }
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }
    }

    function getSpatialListenerPosition() {
      const self = getCurrentSelf();
      if (!self) {
        return null;
      }
      return {
        x: Number(self.x) + 0.5,
        y: Number(self.y) + 0.5
      };
    }

    function computeSpatialMix(sourceX, sourceY) {
      const listener = getSpatialListenerPosition();
      if (!listener) {
        return null;
      }
      const dx = Number(sourceX) + 0.5 - listener.x;
      const dy = Number(sourceY) + 0.5 - listener.y;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return null;
      }
      const maxDistance = Math.max(0.5, Number(spatialAudioConfig.abilitySpatialMaxDistance) || 15);
      const distance = Math.hypot(dx, dy);
      const linear = clamp(1 - distance / maxDistance, 0, 1);
      if (linear <= 0) {
        return null;
      }
      const panDistance = Math.max(0.5, Number(spatialAudioConfig.abilityPanDistance) || maxDistance);
      return {
        gain: linear * linear,
        pan: clamp(dx / panDistance, -1, 1)
      };
    }

    function getSpatialAudioBufferRecord(url, createIfMissing = true) {
      const key = String(url || "");
      if (!key) {
        return null;
      }
      let record = spatialAudioState.oneShotCache.get(key);
      if (!record && createIfMissing) {
        record = {
          status: "idle",
          buffer: null,
          promise: null,
          missingAt: 0
        };
        spatialAudioState.oneShotCache.set(key, record);
      }
      return record || null;
    }

    function loadSpatialAudioBuffer(url) {
      const key = String(url || "");
      if (!key) {
        return Promise.resolve(null);
      }
      const context = ensureSpatialAudioContext();
      if (!context) {
        return Promise.resolve(null);
      }
      const record = getSpatialAudioBufferRecord(key, true);
      if (!record) {
        return Promise.resolve(null);
      }
      if (record.status === "ready" && record.buffer) {
        return Promise.resolve(record.buffer);
      }
      if (record.status === "missing") {
        const now = performance.now();
        if (now - Number(record.missingAt || 0) < missingRetryMs) {
          return Promise.resolve(null);
        }
        record.status = "idle";
      }
      if (record.status === "loading" && record.promise) {
        return record.promise;
      }

      record.status = "loading";
      record.missingAt = 0;
      record.promise = fetch(key, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`missing:${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)))
        .then((buffer) => {
          record.status = "ready";
          record.buffer = buffer || null;
          record.promise = null;
          return record.buffer;
        })
        .catch(() => {
          record.status = "missing";
          record.buffer = null;
          record.promise = null;
          record.missingAt = performance.now();
          return null;
        });
      return record.promise;
    }

    function setSpatialNodeMix(runtime, mix, baseGain) {
      if (!runtime || !runtime.gainNode) {
        return;
      }
      const gain = mix ? mix.gain : 0;
      runtime.gainNode.gain.value = Math.max(0, Number(baseGain) || 1) * gain;
      if (runtime.pannerNode) {
        runtime.pannerNode.pan.value = mix ? mix.pan : 0;
      }
    }

    function stopSpatialLoop(loopKey) {
      const key = String(loopKey || "");
      if (!key) {
        return;
      }
      const runtime = spatialAudioState.loopSources.get(key);
      if (!runtime) {
        return;
      }
      spatialAudioState.loopSources.delete(key);
      spatialAudioState.loopPending.delete(key);
      try {
        runtime.source.stop();
      } catch (_error) {
        // Ignore stop race conditions.
      }
      try {
        runtime.source.disconnect();
      } catch (_error) {
        // Ignore disconnect race conditions.
      }
      try {
        runtime.gainNode.disconnect();
      } catch (_error) {
        // Ignore disconnect race conditions.
      }
      if (runtime.pannerNode) {
        try {
          runtime.pannerNode.disconnect();
        } catch (_error) {
          // Ignore disconnect race conditions.
        }
      }
    }

    function stopAllSpatialLoops() {
      for (const key of Array.from(spatialAudioState.loopSources.keys())) {
        stopSpatialLoop(key);
      }
      spatialAudioState.loopPending.clear();
    }

    function playSpatialAudioByUrl(
      url,
      sourceX,
      sourceY,
      now = performance.now(),
      baseGain = 1,
      throttleKey = "",
      throttleMs = 0
    ) {
      const mix = computeSpatialMix(sourceX, sourceY);
      if (!mix) {
        return;
      }
      const key = String(throttleKey || "");
      if (key && throttleMs > 0) {
        const last = Number(spatialAudioState.lastEventAtByKey.get(key) || 0);
        if (now - last < throttleMs) {
          return;
        }
        spatialAudioState.lastEventAtByKey.set(key, now);
      }
      resumeSpatialAudioContext();
      const context = ensureSpatialAudioContext();
      if (!context || !spatialAudioState.masterGain) {
        return;
      }
      loadSpatialAudioBuffer(url).then((buffer) => {
        if (!buffer) {
          return;
        }
        const currentMix = computeSpatialMix(sourceX, sourceY);
        if (!currentMix) {
          return;
        }
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = false;
        const gainNode = context.createGain();
        gainNode.gain.value = Math.max(0, Number(baseGain) || 1) * currentMix.gain;
        if (typeof context.createStereoPanner === "function") {
          const pannerNode = context.createStereoPanner();
          pannerNode.pan.value = currentMix.pan;
          source.connect(gainNode);
          gainNode.connect(pannerNode);
          pannerNode.connect(spatialAudioState.masterGain);
        } else {
          source.connect(gainNode);
          gainNode.connect(spatialAudioState.masterGain);
        }
        try {
          source.start();
        } catch (_error) {
          // Ignore aborted start.
        }
      });
    }

    return {
      ensureSpatialAudioContext,
      resumeSpatialAudioContext,
      getSpatialListenerPosition,
      computeSpatialMix,
      getSpatialAudioBufferRecord,
      loadSpatialAudioBuffer,
      setSpatialNodeMix,
      stopSpatialLoop,
      stopAllSpatialLoops,
      playSpatialAudioByUrl
    };
  }

  globalScope.VibeClientSpatialAudio = Object.freeze({
    createSpatialAudioTools
  });
})(globalThis);
