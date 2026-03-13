(function initVibeClientUiPanels(globalScope) {
  "use strict";

  function createUiPanelTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const {
      inventoryPanel,
      spellbookPanel,
      dpsPanel,
      dpsTabs,
      dpsValue,
      debugPanel,
      debugNet,
      debugState,
      dpsState,
      trafficWindowMs
    } = deps;

    const updateInventoryUI = typeof deps.updateInventoryUI === "function" ? deps.updateInventoryUI : () => {};
    const updateSpellbookUI = typeof deps.updateSpellbookUI === "function" ? deps.updateSpellbookUI : () => {};
    const getCurrentSelf = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf : () => null;
    const getRendererDebugStats =
      typeof deps.getRendererDebugStats === "function"
        ? deps.getRendererDebugStats
        : () => (typeof globalScope.__vibemmoGetRendererDebugStats === "function" ? globalScope.__vibemmoGetRendererDebugStats() : null);

    function setInventoryVisible(visible) {
      if (!inventoryPanel) {
        return;
      }
      inventoryPanel.classList.toggle("hidden", !visible);
      if (visible) {
        updateInventoryUI();
      }
    }

    function toggleInventoryPanel() {
      if (!inventoryPanel) {
        return;
      }
      setInventoryVisible(inventoryPanel.classList.contains("hidden"));
    }

    function setSpellbookVisible(visible) {
      if (!spellbookPanel) {
        return;
      }
      spellbookPanel.classList.toggle("hidden", !visible);
      if (visible) {
        updateSpellbookUI(getCurrentSelf());
      }
    }

    function toggleSpellbookPanel() {
      if (!spellbookPanel) {
        return;
      }
      setSpellbookVisible(spellbookPanel.classList.contains("hidden"));
    }

    function formatKbps(bytesInWindow) {
      const kbps = (bytesInWindow * 8) / (trafficWindowMs / 1000) / 1000;
      return kbps.toFixed(2);
    }

    function pruneTraffic(now) {
      const cutoff = now - trafficWindowMs;

      while (debugState.upEvents.length && debugState.upEvents[0].t < cutoff) {
        debugState.upBytesWindow -= debugState.upEvents.shift().bytes;
      }
      while (debugState.downEvents.length && debugState.downEvents[0].t < cutoff) {
        debugState.downBytesWindow -= debugState.downEvents.shift().bytes;
      }
    }

    function pruneFrameSamples(now) {
      const frameWindowMs = 1000;
      const cutoff = now - frameWindowMs;
      while (debugState.frameSamples.length && debugState.frameSamples[0] < cutoff) {
        debugState.frameSamples.shift();
      }
    }

    function addTrafficEvent(direction, bytes) {
      if (bytes <= 0) {
        return;
      }
      const now = performance.now();
      pruneTraffic(now);

      if (direction === "up") {
        debugState.upEvents.push({ t: now, bytes });
        debugState.upBytesWindow += bytes;
        return;
      }

      debugState.downEvents.push({ t: now, bytes });
      debugState.downBytesWindow += bytes;
    }

    function reportFrame(now = performance.now()) {
      debugState.frameSamples.push(now);
      pruneFrameSamples(now);
    }

    function getFps(now = performance.now()) {
      pruneFrameSamples(now);
      const sampleCount = debugState.frameSamples.length;
      if (sampleCount <= 1) {
        return 0;
      }
      const first = debugState.frameSamples[0];
      const elapsedMs = Math.max(1, now - first);
      return ((sampleCount - 1) * 1000) / elapsedMs;
    }

    function updateDebugPanel() {
      const now = performance.now();
      pruneTraffic(now);

      if (!debugState.enabled || !debugNet) {
        return;
      }

      const rendererStats = getRendererDebugStats();
      const rendererLine = rendererStats && typeof rendererStats === "object"
        ? String(rendererStats.mode || "") === "pixi"
          ? `Renderer: pixi | Nodes: ${Math.max(0, Number(rendererStats.activeSpriteNodes) || 0)} | Pool: ${Math.max(0, Number(rendererStats.pooledSprites) || 0)} | Particles: ${Math.max(0, Number(rendererStats.particleSprites) || 0)} | Emitters: ${Math.max(0, Number(rendererStats.particleEmitters) || 0)} | Fallback: ${Math.max(0, Number(rendererStats.fallbackNodes) || 0)}`
          : `Renderer: canvas | Players: ${Math.max(0, Number(rendererStats.players) || 0)} | Mobs: ${Math.max(0, Number(rendererStats.mobs) || 0)} | Projectiles: ${Math.max(0, Number(rendererStats.projectiles) || 0)} | Bags: ${Math.max(0, Number(rendererStats.lootBags) || 0)} | Effects: ${Math.max(0, Number(rendererStats.areaEffects) || 0)}`
        : "";
      debugNet.textContent =
        `Net 10s avg | Up: ${formatKbps(debugState.upBytesWindow)} kbps | Down: ${formatKbps(debugState.downBytesWindow)} kbps | FPS: ${getFps(now).toFixed(1)} | Mobs: ${Math.max(0, Math.floor(Number(debugState.totalMobCount) || 0))}${rendererLine ? `\n${rendererLine}` : ""}`;
    }

    function setDebugEnabled(enabled) {
      debugState.enabled = !!enabled;
      if (debugPanel) {
        debugPanel.classList.toggle("hidden", !debugState.enabled);
      }
      updateDebugPanel();
    }

    function toggleDebugPanel() {
      setDebugEnabled(!debugState.enabled);
    }

    function pruneDpsSamples(now) {
      const cutoff = now - 60000;
      while (dpsState.samples.length && dpsState.samples[0].t < cutoff) {
        dpsState.samples.shift();
      }
    }

    function addDpsSample(amount, now = performance.now()) {
      const dmg = Math.max(0, Number(amount) || 0);
      if (dmg <= 0) {
        return;
      }
      pruneDpsSamples(now);
      dpsState.samples.push({ t: now, amount: dmg });
    }

    function getDpsAverage(windowSec, now = performance.now()) {
      const windowMs = Math.max(1000, Math.round(windowSec * 1000));
      const cutoff = now - windowMs;
      let total = 0;
      for (const sample of dpsState.samples) {
        if (sample.t >= cutoff) {
          total += sample.amount;
        }
      }
      return total / (windowMs / 1000);
    }

    function updateDpsPanel() {
      const now = performance.now();
      pruneDpsSamples(now);
      if (!dpsState.enabled || !dpsValue) {
        return;
      }
      const dps = getDpsAverage(dpsState.selectedWindowSec, now);
      dpsValue.textContent = `${dps.toFixed(2)} DPS`;
    }

    function setDpsWindow(windowSec) {
      const normalized = Number(windowSec);
      if (normalized !== 60 && normalized !== 20 && normalized !== 5) {
        return;
      }
      dpsState.selectedWindowSec = normalized;
      if (dpsTabs) {
        for (const node of dpsTabs.querySelectorAll(".dps-tab")) {
          const tabWindow = Number(node.getAttribute("data-window") || 0);
          node.classList.toggle("active", tabWindow === dpsState.selectedWindowSec);
        }
      }
      updateDpsPanel();
    }

    function setDpsVisible(visible) {
      dpsState.enabled = !!visible;
      if (!dpsPanel) {
        return;
      }
      dpsPanel.classList.toggle("hidden", !dpsState.enabled);
      updateDpsPanel();
    }

    function toggleDpsPanel() {
      setDpsVisible(!dpsState.enabled);
    }

    return {
      setInventoryVisible,
      toggleInventoryPanel,
      setSpellbookVisible,
      toggleSpellbookPanel,
      setTalentVisible: (visible) => {
        if (!deps.talentPanel) return;
        deps.talentPanel.classList.toggle("hidden", !visible);
        if (visible && typeof deps.renderTalentTree === "function") {
          deps.renderTalentTree(deps.getCurrentSelf());
        }
      },
      toggleTalentPanel: () => {
        const visible = deps.talentPanel && deps.talentPanel.classList.contains("hidden");
        returnSelf.talentVisible = visible;
        if (typeof deps.setTalentVisible === "function") {
          deps.setTalentVisible(visible);
        }
      },
      formatKbps,
      pruneTraffic,
      addTrafficEvent,
      reportFrame,
      getFps,
      updateDebugPanel,
      setDebugEnabled,
      toggleDebugPanel,
      pruneDpsSamples,
      addDpsSample,
      getDpsAverage,
      setDpsWindow,
      updateDpsPanel,
      setDpsVisible,
      toggleDpsPanel
    };
  }

  globalScope.VibeClientUiPanels = Object.freeze({
    createUiPanelTools
  });
})(globalThis);
