(function initVibeClientAutomationTools(globalScope) {
  "use strict";

  const appNamespace =
    globalScope.VibeClientApp && typeof globalScope.VibeClientApp === "object"
      ? globalScope.VibeClientApp
      : (globalScope.VibeClientApp = {});

  function createAutomationTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const trafficWindowMs = Math.max(1, Number(deps.trafficWindowMs) || 10000);

    function getAutomationDebugMetricsSnapshot() {
      const now = performance.now();
      const debugState = deps.debugState && typeof deps.debugState === "object" ? deps.debugState : {};
      const upKbps = (Math.max(0, Number(debugState.upBytesWindow) || 0) * 8) / (trafficWindowMs / 1000) / 1000;
      const downKbps = (Math.max(0, Number(debugState.downBytesWindow) || 0) * 8) / (trafficWindowMs / 1000) / 1000;
      let fps = 0;
      if (deps.uiPanelTools && typeof deps.uiPanelTools.getFps === "function") {
        fps = Number(deps.uiPanelTools.getFps(now)) || 0;
      } else if (Array.isArray(debugState.frameSamples) && debugState.frameSamples.length > 1) {
        const first = Number(debugState.frameSamples[0]) || now;
        const elapsedMs = Math.max(1, now - first);
        fps = ((debugState.frameSamples.length - 1) * 1000) / elapsedMs;
      }
      return {
        upKbps,
        downKbps,
        fps,
        mobCount: Math.max(0, Math.floor(Number(debugState.totalMobCount) || 0))
      };
    }

    function getAutomationRendererStatsSnapshot() {
      const rendererBootstrap = deps.rendererBootstrap || null;
      if (rendererBootstrap && typeof rendererBootstrap.getDebugStats === "function") {
        const stats = rendererBootstrap.getDebugStats();
        return stats && typeof stats === "object" ? { ...stats } : { mode: rendererBootstrap.getRendererMode() };
      }
      return {
        mode: rendererBootstrap ? rendererBootstrap.getRendererMode() : "canvas"
      };
    }

    function getClientPointForWorldCoords(worldX, worldY) {
      const self = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf() : null;
      const canvas = deps.canvasElement || null;
      const worldToScreen = typeof deps.worldToScreen === "function" ? deps.worldToScreen : null;
      if (!self || !canvas || !worldToScreen) {
        return null;
      }
      const screen = worldToScreen(Number(worldX) || 0, Number(worldY) || 0, self.x + 0.5, self.y + 0.5);
      const rect = canvas.getBoundingClientRect();
      const computedStyle =
        typeof globalScope.getComputedStyle === "function" ? globalScope.getComputedStyle(canvas) : null;
      const rectWidth =
        Number(rect.width) ||
        Number(canvas.clientWidth) ||
        Number.parseFloat(computedStyle && computedStyle.width) ||
        Number(canvas.width) ||
        1;
      const rectHeight =
        Number(rect.height) ||
        Number(canvas.clientHeight) ||
        Number.parseFloat(computedStyle && computedStyle.height) ||
        Number(canvas.height) ||
        1;
      const scaleX = canvas.width > 0 ? rectWidth / canvas.width : 1;
      const scaleY = canvas.height > 0 ? rectHeight / canvas.height : 1;
      return {
        clientX: rect.left + screen.x * scaleX,
        clientY: rect.top + screen.y * scaleY
      };
    }

    function dispatchCanvasMouseEventAtWorld(eventType, worldX, worldY, options = {}) {
      const canvas = deps.canvasElement || null;
      if (!canvas || typeof globalScope.MouseEvent !== "function") {
        return false;
      }
      const point = getClientPointForWorldCoords(worldX, worldY);
      if (!point) {
        return false;
      }
      const button = Math.max(0, Math.floor(Number(options.button) || 0));
      const buttons = Number.isFinite(Number(options.buttons))
        ? Number(options.buttons)
        : button === 2
          ? 2
          : 1;
      canvas.dispatchEvent(new globalScope.MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: point.clientX,
        clientY: point.clientY,
        button,
        buttons
      }));
      canvas.dispatchEvent(new globalScope.MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        clientX: point.clientX,
        clientY: point.clientY,
        button,
        buttons
      }));
      return true;
    }

    function dispatchCanvasTouchTapAtWorld(worldX, worldY) {
      const canvas = deps.canvasElement || null;
      if (!canvas || typeof globalScope.Touch !== "function" || typeof globalScope.TouchEvent !== "function") {
        return false;
      }
      const point = getClientPointForWorldCoords(worldX, worldY);
      if (!point) {
        return false;
      }
      const touchInit = {
        identifier: 1,
        target: canvas,
        clientX: point.clientX,
        clientY: point.clientY,
        radiusX: 10,
        radiusY: 10,
        rotationAngle: 0,
        force: 1
      };
      const touchStart = new globalScope.Touch(touchInit);
      canvas.dispatchEvent(new globalScope.TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [touchStart],
        targetTouches: [touchStart],
        changedTouches: [touchStart]
      }));
      const touchEnd = new globalScope.Touch(touchInit);
      canvas.dispatchEvent(new globalScope.TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        targetTouches: [],
        changedTouches: [touchEnd]
      }));
      return true;
    }

    function dispatchCanvasTouchEventAtClient(eventType, clientX, clientY, identifier = 1) {
      const canvas = deps.canvasElement || null;
      if (!canvas || typeof globalScope.Touch !== "function" || typeof globalScope.TouchEvent !== "function") {
        return false;
      }
      const touch = new globalScope.Touch({
        identifier: Math.max(1, Math.floor(Number(identifier) || 1)),
        target: canvas,
        clientX: Number(clientX) || 0,
        clientY: Number(clientY) || 0,
        radiusX: 10,
        radiusY: 10,
        rotationAngle: 0,
        force: 1
      });
      const isEnd = eventType === "touchend" || eventType === "touchcancel";
      canvas.dispatchEvent(new globalScope.TouchEvent(eventType, {
        bubbles: true,
        cancelable: true,
        touches: isEnd ? [] : [touch],
        targetTouches: isEnd ? [] : [touch],
        changedTouches: [touch]
      }));
      return true;
    }

    function buildAutomationSnapshot() {
      const gameState = deps.gameState || {};
      const entityRuntime = deps.entityRuntime || {};
      const townClientState = deps.townClientState || {};
      const inventoryState = deps.inventoryState || {};
      const equipmentState = deps.equipmentState || {};
      const adminBotState = deps.adminBotState || {};
      const autoMoveTarget = deps.autoMoveTarget || {};
      const questInteractionState = deps.questInteractionState || {};
      const vendorInteractionState = deps.vendorInteractionState || {};
      const lootPickupState = deps.lootPickupState || {};
      const resourceInteractionState = deps.resourceInteractionState || {};
      const activeAreaEffectsById = deps.activeAreaEffectsById || new Map();
      const getFloatingDamageCount =
        typeof deps.getFloatingDamageCount === "function" ? deps.getFloatingDamageCount : () => 0;
      const getQuestStateSnapshot =
        typeof deps.getQuestStateSnapshot === "function" ? deps.getQuestStateSnapshot : () => ({ active: [], completed: [] });
      const getDialogueSnapshot =
        typeof deps.getDialogueSnapshot === "function" ? deps.getDialogueSnapshot : () => null;

      return {
        rendererMode: deps.rendererBootstrap ? deps.rendererBootstrap.getRendererMode() : "canvas",
        debugMetrics: getAutomationDebugMetricsSnapshot(),
        rendererStats: getAutomationRendererStatsSnapshot(),
        floatingDamageCount: Math.max(0, Math.floor(Number(getFloatingDamageCount()) || 0)),
        self: gameState.self
          ? {
              id: deps.myId,
              x: Number(gameState.self.x) || 0,
              y: Number(gameState.self.y) || 0,
              hp: Number(gameState.self.hp) || 0,
              maxHp: Number(gameState.self.maxHp) || 0,
              mana: Number(gameState.self.mana) || 0,
              maxMana: Number(gameState.self.maxMana) || 0,
              classType: deps.selfStatic ? deps.selfStatic.classType : "",
              isAdmin: !!(deps.selfStatic && deps.selfStatic.isAdmin),
              level: entityRuntime.self ? Number(entityRuntime.self.level) || 0 : 0,
              copper: entityRuntime.self ? Number(entityRuntime.self.copper) || 0 : 0,
              skills:
                entityRuntime.self && entityRuntime.self.skills && typeof entityRuntime.self.skills === "object"
                  ? { ...entityRuntime.self.skills }
                  : {},
              abilityLevels:
                entityRuntime.self && entityRuntime.self.abilityLevels && typeof entityRuntime.self.abilityLevels === "object"
                  ? { ...entityRuntime.self.abilityLevels }
                  : {}
            }
          : null,
        players: Array.isArray(gameState.players)
          ? gameState.players.map((player) => ({
              id: player.id,
              x: Number(player.x) || 0,
              y: Number(player.y) || 0,
              hp: Number(player.hp) || 0,
              maxHp: Number(player.maxHp) || 0,
              name: String(player.name || ""),
              classType: String(player.classType || "")
            }))
          : [],
        mobs: Array.isArray(gameState.mobs)
          ? gameState.mobs.map((mob) => ({
              id: mob.id,
              x: Number(mob.x) || 0,
              y: Number(mob.y) || 0,
              hp: Number(mob.hp) || 0,
              maxHp: Number(mob.maxHp) || 0,
              name: String(mob.type || mob.name || ""),
              level: Math.max(1, Math.floor(Number(mob.level) || 1))
            }))
          : [],
        projectiles: Array.isArray(gameState.projectiles)
          ? gameState.projectiles.map((projectile) => ({
              id: projectile.id,
              x: Number(projectile.x) || 0,
              y: Number(projectile.y) || 0,
              abilityId: String(projectile.abilityId || "")
            }))
          : [],
        lootBags: Array.isArray(gameState.lootBags)
          ? gameState.lootBags.map((bag) => ({
              id: bag.id,
              x: Number(bag.x) || 0,
              y: Number(bag.y) || 0,
              items: Array.isArray(bag.items) ? bag.items.map((entry) => ({ ...entry })) : []
            }))
          : [],
        resourceNodes: Array.isArray(gameState.resourceNodes)
          ? gameState.resourceNodes.map((node) => ({
              id: String(node.id || ""),
              resourceId: String(node.resourceId || ""),
              family: String(node.family || ""),
              skillId: String(node.skillId || ""),
              requiredLevel: Math.max(1, Math.floor(Number(node.requiredLevel) || 1)),
              x: Number(node.x) || 0,
              y: Number(node.y) || 0,
              items: Array.isArray(node.items) ? node.items.map((entry) => ({ ...entry })) : []
            }))
          : [],
        areaEffects: Array.from(
          activeAreaEffectsById && typeof activeAreaEffectsById.values === "function" ? activeAreaEffectsById.values() : []
        ).map((effect) => ({
          id: String(effect.id || ""),
          abilityId: String(effect.abilityId || ""),
          kind: String(effect.kind || ""),
          x: Number(effect.x) || 0,
          y: Number(effect.y) || 0,
          radius: Number(effect.radius) || 0,
          summonCount: Math.max(1, Math.round(Number(effect.summonCount) || 1)),
          formationRadius: Math.max(0, Number(effect.formationRadius) || 0)
        })),
        inventory: Array.isArray(inventoryState.slots) ? inventoryState.slots.map((slot) => (slot ? { ...slot } : null)) : [],
        equipment: equipmentState.slots && typeof equipmentState.slots === "object" ? { ...equipmentState.slots } : {},
        town: townClientState.layout
          ? {
              vendor: townClientState.layout.vendor ? { ...townClientState.layout.vendor } : null,
              questGivers:
                typeof deps.getTownQuestGivers === "function"
                  ? deps.getTownQuestGivers().map((npc) => ({ ...npc }))
                  : []
            }
          : null,
        autoMove: {
          active: !!autoMoveTarget.active,
          x: Number(autoMoveTarget.x) || 0,
          y: Number(autoMoveTarget.y) || 0,
          stopDistance: Number(autoMoveTarget.stopDistance) || 0,
          questNpcId: String(questInteractionState.npcId || ""),
          vendorNpcId: String(vendorInteractionState.npcId || ""),
          lootBagId: String(lootPickupState.bagId || ""),
          resourceNodeId: String(resourceInteractionState.resourceNodeId || "")
        },
        mouse: deps.mouseState
          ? {
              sx: Number(deps.mouseState.sx) || 0,
              sy: Number(deps.mouseState.sy) || 0,
              leftDown: !!deps.mouseState.leftDown
            }
          : { sx: 0, sy: 0, leftDown: false },
        questState: getQuestStateSnapshot(),
        dialogue: getDialogueSnapshot(),
        status: deps.statusEl ? String(deps.statusEl.textContent || "") : "",
        equipmentVisible: deps.equipmentPanel ? !deps.equipmentPanel.classList.contains("hidden") : false,
        adminBotPanelVisible: deps.botListPanel ? !deps.botListPanel.classList.contains("hidden") : false,
        adminBots: Array.isArray(adminBotState.bots) ? adminBotState.bots.map((bot) => ({ ...bot })) : [],
        adminBotInspect: adminBotState.inspectBot ? { ...adminBotState.inspectBot } : null
      };
    }

    function installAutomationApi() {
      const windowObject = deps.windowObject || null;
      if (!windowObject || !["localhost", "127.0.0.1"].includes(String(windowObject.location && windowObject.location.hostname || ""))) {
        return;
      }
      windowObject.__vibemmoTest = Object.freeze({
        getState: () => buildAutomationSnapshot(),
        getRendererMode: () => (deps.rendererBootstrap ? deps.rendererBootstrap.getRendererMode() : "canvas"),
        getClientPointForWorld(worldX, worldY) {
          const point = getClientPointForWorldCoords(worldX, worldY);
          return point ? { ...point } : null;
        },
        setRendererMode(mode) {
          if (!deps.rendererBootstrap) {
            return "canvas";
          }
          return deps.rendererBootstrap.setRendererMode(mode);
        },
        connectAndJoin: deps.connectAndJoin,
        send: (payload) => (typeof deps.sendJsonMessage === "function" ? deps.sendJsonMessage(payload) : false),
        setMove(dx, dy) {
          if (typeof deps.sendJsonMessage !== "function") {
            return false;
          }
          return deps.sendJsonMessage({
            type: "move",
            dx,
            dy
          });
        },
        stopMove() {
          if (typeof deps.sendJsonMessage !== "function") {
            return false;
          }
          return deps.sendJsonMessage({
            type: "move",
            dx: 0,
            dy: 0
          });
        },
        castAtWorld(abilityId, targetX, targetY) {
          const self = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf() : null;
          const normalizeDirection = typeof deps.normalizeDirection === "function" ? deps.normalizeDirection : null;
          if (!self || !normalizeDirection || typeof deps.sendJsonMessage !== "function") {
            return false;
          }
          const dx = Number(targetX) - Number(self.x);
          const dy = Number(targetY) - Number(self.y);
          const dir = normalizeDirection(dx, dy);
          if (!dir) {
            return false;
          }
          deps.sendJsonMessage({
            type: "use_ability",
            abilityId,
            dx: dir.dx,
            dy: dir.dy,
            distance: Math.hypot(dx, dy)
          });
          return true;
        },
        toggleQuestPanel() {
          return typeof deps.toggleQuestPanel === "function" ? deps.toggleQuestPanel() : false;
        },
        dispatchContextMenuAtWorld(worldX, worldY) {
          return dispatchCanvasMouseEventAtWorld("contextmenu", worldX, worldY, {
            button: 2,
            buttons: 2
          });
        },
        dispatchTouchTapAtWorld(worldX, worldY) {
          return dispatchCanvasTouchTapAtWorld(worldX, worldY);
        },
        dispatchTouchEventAtClient(eventType, clientX, clientY, identifier = 1) {
          return dispatchCanvasTouchEventAtClient(eventType, clientX, clientY, identifier);
        },
        dispatchMouseDownAtWorld(worldX, worldY, button = 0) {
          return dispatchCanvasMouseEventAtWorld("mousedown", worldX, worldY, { button });
        },
        pickupNearestBag() {
          const self = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf() : null;
          const gameState = deps.gameState || {};
          if (!self || !Array.isArray(gameState.lootBags) || !gameState.lootBags.length || typeof deps.sendJsonMessage !== "function") {
            return false;
          }
          let best = null;
          let bestDist = Infinity;
          for (const bag of gameState.lootBags) {
            const dist = Math.hypot(bag.x - self.x, bag.y - self.y);
            if (dist < bestDist) {
              bestDist = dist;
              best = bag;
            }
          }
          if (!best) {
            return false;
          }
          deps.sendJsonMessage({
            type: "pickup_bag",
            x: best.x,
            y: best.y
          });
          return true;
        },
        equipInventoryIndex(index, slot) {
          if (typeof deps.sendJsonMessage !== "function") {
            return false;
          }
          return deps.sendJsonMessage({
            type: "equip_item",
            inventoryIndex: index,
            slot
          });
        },
        toggleEquipmentPanel: deps.toggleEquipmentPanel
      });
    }

    return {
      getAutomationDebugMetricsSnapshot,
      getAutomationRendererStatsSnapshot,
      getClientPointForWorld: getClientPointForWorldCoords,
      dispatchCanvasMouseEventAtWorld,
      buildAutomationSnapshot,
      installAutomationApi
    };
  }

  appNamespace.automation = Object.freeze({
    createAutomationTools
  });
})(typeof window !== "undefined" ? window : globalThis);
