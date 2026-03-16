(function initVibeClientQuestRuntime(globalScope) {
  "use strict";

  const appNamespace =
    globalScope.VibeClientApp && typeof globalScope.VibeClientApp === "object"
      ? globalScope.VibeClientApp
      : (globalScope.VibeClientApp = {});

  function createQuestRuntimeTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const questInteractionState =
      deps.questInteractionState && typeof deps.questInteractionState === "object"
        ? deps.questInteractionState
        : { active: false, npcId: "", x: 0, y: 0, interactRange: 0, nextAttemptAt: 0 };
    const autoMoveTarget =
      deps.autoMoveTarget && typeof deps.autoMoveTarget === "object" ? deps.autoMoveTarget : { active: false };
    const mouseState = deps.mouseState && typeof deps.mouseState === "object" ? deps.mouseState : { sx: 0, sy: 0 };

    let questUiTools = null;

    function getCurrentSelf() {
      return typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf() : null;
    }

    function getTownQuestGivers() {
      return typeof deps.getTownQuestGivers === "function" ? deps.getTownQuestGivers() : [];
    }

    function getNearbyQuestNpc() {
      const mobs = typeof deps.getMobs === "function" ? deps.getMobs() : [];
      const self = getCurrentSelf();
      if (!Array.isArray(mobs) || !self) {
        return null;
      }
      const range = 2;
      return (
        mobs.find(
          (mob) =>
            mob &&
            mob.npcType === "quest" &&
            Math.abs((mob.x || 0) - (self.x || 0)) <= range &&
            Math.abs((mob.y || 0) - (self.y || 0)) <= range
        ) || null
      );
    }

    function isPlayerNearQuestNpc(npc, self = null) {
      const actor = self || getCurrentSelf();
      if (!actor || !npc) {
        return false;
      }
      const targetX = Number(npc.x) + 0.5;
      const targetY = Number(npc.y) + 0.5;
      const interactRange = Math.max(0.5, Number(npc.interactRange) || 2.5);
      return Math.hypot(targetX - Number(actor.x), targetY - Number(actor.y)) <= interactRange;
    }

    function getClosestNearbyQuestNpc(self = null) {
      const actor = self || getCurrentSelf();
      const questGivers = getTownQuestGivers();
      if (!actor || !Array.isArray(questGivers) || !questGivers.length) {
        return null;
      }
      let bestNpc = null;
      let bestDist = Infinity;
      for (const npc of questGivers) {
        if (!npc || !isPlayerNearQuestNpc(npc, actor)) {
          continue;
        }
        const dist = Math.hypot(Number(npc.x) + 0.5 - Number(actor.x), Number(npc.y) + 0.5 - Number(actor.y));
        if (dist < bestDist) {
          bestDist = dist;
          bestNpc = npc;
        }
      }
      return bestNpc;
    }

    function getHoveredQuestNpcAtPosition(cameraX, cameraY, mouseX, mouseY) {
      const questGivers = getTownQuestGivers();
      if (!Array.isArray(questGivers) || questGivers.length === 0) {
        return null;
      }
      const worldToScreen = typeof deps.worldToScreen === "function" ? deps.worldToScreen : null;
      const getQuestNpcSprite = typeof deps.getQuestNpcSprite === "function" ? deps.getQuestNpcSprite : null;
      if (!worldToScreen || !getQuestNpcSprite) {
        return null;
      }
      for (const questGiver of questGivers) {
        if (!questGiver) {
          continue;
        }
        const point = worldToScreen(Number(questGiver.x) + 0.5, Number(questGiver.y) + 0.5, cameraX, cameraY);
        const sprite = getQuestNpcSprite();
        if (!sprite) {
          continue;
        }
        const spriteCenterX = point.x;
        const spriteTopY = point.y - sprite.height;
        const dx = mouseX - spriteCenterX;
        const dy = mouseY - (spriteTopY + sprite.height / 2);
        if (Math.abs(dx) < sprite.width / 2 + 10 && Math.abs(dy) < sprite.height / 2 + 10) {
          return { npc: questGiver, p: point };
        }
      }
      return null;
    }

    function getHoveredQuestNpc(cameraX, cameraY) {
      return getHoveredQuestNpcAtPosition(cameraX, cameraY, mouseState.sx, mouseState.sy);
    }

    function clearAutoQuestNpcInteraction(sendStopMove = false) {
      const wasActive = !!(questInteractionState.active || autoMoveTarget.active);
      questInteractionState.active = false;
      questInteractionState.npcId = "";
      questInteractionState.x = 0;
      questInteractionState.y = 0;
      questInteractionState.interactRange = 0;
      questInteractionState.nextAttemptAt = 0;
      if (typeof deps.clearAutoMoveTarget === "function") {
        deps.clearAutoMoveTarget();
      }
      if (sendStopMove && wasActive && typeof deps.sendMove === "function") {
        deps.sendMove();
      }
    }

    function startAutoQuestNpcInteraction(npc) {
      if (!npc) {
        return false;
      }
      if (typeof deps.clearAutoVendorInteraction === "function") {
        deps.clearAutoVendorInteraction(false, false);
      }
      if (typeof deps.clearAutoLootPickup === "function") {
        deps.clearAutoLootPickup(false);
      }
      questInteractionState.active = true;
      questInteractionState.npcId = String(npc.id || "");
      questInteractionState.x = Number(npc.x) || 0;
      questInteractionState.y = Number(npc.y) || 0;
      questInteractionState.interactRange = Math.max(0.5, Number(npc.interactRange) || 2.5);
      questInteractionState.nextAttemptAt = 0;
      if (typeof deps.setAutoMoveTarget === "function") {
        deps.setAutoMoveTarget(
          questInteractionState.x + 0.5,
          questInteractionState.y + 0.5,
          Math.max(0.2, questInteractionState.interactRange - 0.35)
        );
      }
      if (typeof deps.sendMove === "function") {
        deps.sendMove();
      }
      return true;
    }

    function sendQuestNpcInteraction(npcId) {
      const normalizedNpcId = String(npcId || "").trim();
      if (!normalizedNpcId || typeof deps.sendJsonMessage !== "function") {
        return false;
      }
      return deps.sendJsonMessage({
        type: "quest_interact",
        npcId: normalizedNpcId
      });
    }

    function notifyQuestTalkToNpc(npcId) {
      const normalizedNpcId = String(npcId || "").trim();
      if (!normalizedNpcId || typeof deps.sendJsonMessage !== "function") {
        return false;
      }
      return deps.sendJsonMessage({
        type: "talk_to_npc",
        npcId: normalizedNpcId
      });
    }

    function tryContextQuestNpcInteraction() {
      const self = getCurrentSelf();
      if (!self) {
        return false;
      }
      const hovered = getHoveredQuestNpc(self.x + 0.5, self.y + 0.5);
      if (!hovered || !hovered.npc) {
        return false;
      }
      if (typeof deps.clearAutoVendorInteraction === "function") {
        deps.clearAutoVendorInteraction(false, false);
      }
      if (typeof deps.clearAutoLootPickup === "function") {
        deps.clearAutoLootPickup(false);
      }
      if (isPlayerNearQuestNpc(hovered.npc, self)) {
        clearAutoQuestNpcInteraction(false);
        return sendQuestNpcInteraction(hovered.npc.id);
      }
      return startAutoQuestNpcInteraction(hovered.npc);
    }

    function tryNearbyQuestNpcInteraction() {
      const self = getCurrentSelf();
      if (!self) {
        return false;
      }
      const nearbyNpc = getClosestNearbyQuestNpc(self);
      if (!nearbyNpc) {
        return false;
      }
      if (typeof deps.clearAutoVendorInteraction === "function") {
        deps.clearAutoVendorInteraction(false, false);
      }
      if (typeof deps.clearAutoLootPickup === "function") {
        deps.clearAutoLootPickup(false);
      }
      clearAutoQuestNpcInteraction(false);
      return sendQuestNpcInteraction(nearbyNpc.id);
    }

    function updateAutoQuestNpcInteraction(now = performance.now()) {
      if (!questInteractionState.active) {
        return;
      }
      const self = getCurrentSelf();
      if (!self || self.hp <= 0) {
        clearAutoQuestNpcInteraction(true);
        return;
      }
      const manualMove =
        typeof deps.getCurrentInputVector === "function" ? deps.getCurrentInputVector() : { dx: 0, dy: 0 };
      if (manualMove.dx || manualMove.dy) {
        clearAutoQuestNpcInteraction(false);
        return;
      }
      const npc = getTownQuestGivers().find((entry) => String(entry && entry.id || "") === questInteractionState.npcId);
      if (!npc) {
        clearAutoQuestNpcInteraction(true);
        return;
      }
      questInteractionState.x = Number(npc.x) || 0;
      questInteractionState.y = Number(npc.y) || 0;
      questInteractionState.interactRange = Math.max(0.5, Number(npc.interactRange) || 2.5);
      if (typeof deps.setAutoMoveTarget === "function") {
        deps.setAutoMoveTarget(
          questInteractionState.x + 0.5,
          questInteractionState.y + 0.5,
          Math.max(0.2, questInteractionState.interactRange - 0.35)
        );
      }
      if (isPlayerNearQuestNpc(npc, self)) {
        const targetNpcId = questInteractionState.npcId;
        clearAutoQuestNpcInteraction(true);
        sendQuestNpcInteraction(targetNpcId);
        return;
      }
      if (now >= questInteractionState.nextAttemptAt && typeof deps.sendMove === "function") {
        questInteractionState.nextAttemptAt = now + 90;
        deps.sendMove();
      }
    }

    function initQuestUi() {
      if (!questUiTools && typeof deps.createQuestUiTools === "function") {
        questUiTools = deps.createQuestUiTools({
          itemDefsById: deps.itemDefsById,
          sendJson: deps.sendJson,
          abandonQuest: deps.abandonQuest
        });
      }
      if (!questUiTools) {
        return null;
      }
      if (typeof questUiTools.initPanels === "function") {
        questUiTools.initPanels({
          questPanel: deps.questPanel,
          questTrackerPanel: deps.questTrackerPanel,
          dialoguePanel: deps.dialoguePanel,
          notificationPanel: deps.notificationPanel
        });
      }
      if (deps.questCloseButton && !deps.questCloseButton.__vibeQuestRuntimeBound) {
        deps.questCloseButton.addEventListener("click", () => {
          if (questUiTools && typeof questUiTools.setQuestPanelVisible === "function") {
            questUiTools.setQuestPanelVisible(false);
          }
        });
        deps.questCloseButton.__vibeQuestRuntimeBound = true;
      }
      return questUiTools;
    }

    function getQuestUiTools() {
      return questUiTools;
    }

    function getQuestStateSnapshot() {
      return questUiTools && typeof questUiTools.getQuestState === "function"
        ? questUiTools.getQuestState()
        : { active: [], completed: [], questNpcMarkers: [] };
    }

    function getQuestNpcMarkerState(npcId) {
      return questUiTools && typeof questUiTools.getQuestNpcMarkerState === "function"
        ? questUiTools.getQuestNpcMarkerState(npcId)
        : null;
    }

    function getDialogueSnapshot() {
      return questUiTools && typeof questUiTools.getCurrentDialogue === "function"
        ? questUiTools.getCurrentDialogue()
        : null;
    }

    function toggleQuestPanel() {
      if (questUiTools && typeof questUiTools.toggleQuestPanel === "function") {
        questUiTools.toggleQuestPanel();
        return true;
      }
      return false;
    }

    function handleQuestPacket(type, msg) {
      if (type === "quest_dialogue_error") {
        if (typeof deps.setStatus === "function") {
          deps.setStatus(msg && msg.message ? msg.message : "Quest dialogue failed.");
        }
        return true;
      }
      if (!questUiTools) {
        return false;
      }
      if (type === "quest_dialogue") {
        if (msg) {
          questUiTools.showDialogue(msg);
        }
        return true;
      }
      if (type === "quest_accepted") {
        if (msg) {
          questUiTools.handleQuestAccepted(msg);
        }
        return true;
      }
      if (type === "quest_completed") {
        if (msg) {
          questUiTools.handleQuestCompleted(msg);
        }
        return true;
      }
      if (type === "quest_abandoned") {
        if (msg) {
          questUiTools.handleQuestAbandoned(msg);
        }
        return true;
      }
      if (type === "quest_state_update") {
        if (msg) {
          questUiTools.updateQuestState({
            active: msg.active || [],
            completed: msg.completed || [],
            questNpcMarkers: msg.questNpcMarkers || []
          });
        }
        return true;
      }
      return false;
    }

    return {
      getNearbyQuestNpc,
      getHoveredQuestNpc,
      getHoveredQuestNpcAtPosition,
      isPlayerNearQuestNpc,
      getClosestNearbyQuestNpc,
      clearAutoQuestNpcInteraction,
      startAutoQuestNpcInteraction,
      sendQuestNpcInteraction,
      notifyQuestTalkToNpc,
      tryContextQuestNpcInteraction,
      tryNearbyQuestNpcInteraction,
      updateAutoQuestNpcInteraction,
      initQuestUi,
      getQuestUiTools,
      getQuestStateSnapshot,
      getQuestNpcMarkerState,
      getDialogueSnapshot,
      toggleQuestPanel,
      handleQuestPacket
    };
  }

  appNamespace.questRuntime = Object.freeze({
    createQuestRuntimeTools
  });
})(typeof window !== "undefined" ? window : globalThis);
