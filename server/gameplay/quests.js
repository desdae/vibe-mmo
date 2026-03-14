const fs = require("fs");
const path = require("path");
const { createProceduralQuestTools } = require("./procedural-quests");

function createQuestTools(options = {}) {
  const townLayout = options.townLayout || null;
  const questDefs = options.questDefs || null;
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
  const sendSelfProgress = typeof options.sendSelfProgress === "function" ? options.sendSelfProgress : () => {};
  const addExp = typeof options.addExp === "function" ? options.addExp : () => {};
  const getInventoryItemCount =
    typeof options.getInventoryItemCount === "function" ? options.getInventoryItemCount : () => 0;
  const consumeInventoryItem =
    typeof options.consumeInventoryItem === "function" ? options.consumeInventoryItem : () => false;
  const addItemsToInventory =
    typeof options.addItemsToInventory === "function" ? options.addItemsToInventory : () => ({ added: [], leftover: [] });
  const sendInventoryState =
    typeof options.sendInventoryState === "function" ? options.sendInventoryState : () => {};
  const syncPlayerCopperFromInventory =
    typeof options.syncPlayerCopperFromInventory === "function" ? options.syncPlayerCopperFromInventory : () => false;
  const mobConfigProvider =
    typeof options.mobConfigProvider === "function" ? options.mobConfigProvider : () => null;
  const itemDefsProvider =
    typeof options.itemDefsProvider === "function" ? options.itemDefsProvider : () => null;
  const questDataPath = options.questDataPath
    ? path.resolve(String(options.questDataPath))
    : path.resolve(__dirname, "../../data/quests.json");

  let loadedQuestData = null;
  const proceduralQuestTools = createProceduralQuestTools({
    townLayout,
    mapWidth: options.mapWidth,
    mapHeight: options.mapHeight,
    mobConfigProvider,
    itemDefsProvider,
    regionDataPath: options.regionDataPath,
    templateDataPath: options.templateDataPath
  });

  function loadQuestData() {
    if (loadedQuestData) {
      return loadedQuestData;
    }
    try {
      const rawData = fs.readFileSync(questDataPath, "utf8");
      loadedQuestData = JSON.parse(rawData);
      return loadedQuestData;
    } catch (err) {
      console.error("[quests] Failed to load quests.json:", err.message);
      loadedQuestData = { quests: [], npcs: {} };
      return loadedQuestData;
    }
  }

  function normalizeQuestLookupId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function getQuestDefs() {
    if (Array.isArray(questDefs)) {
      return questDefs;
    }
    const data = loadQuestData();
    return Array.isArray(data.quests) ? data.quests : [];
  }

  function ensurePlayerQuestState(player) {
    if (!player) {
      return { active: {}, completed: [] };
    }
    if (!player.questState || typeof player.questState !== "object") {
      player.questState = { active: {}, completed: [] };
    }
    if (!player.questState.active || typeof player.questState.active !== "object") {
      player.questState.active = {};
    }
    if (!Array.isArray(player.questState.completed)) {
      player.questState.completed = [];
    }
    return player.questState;
  }

  function getQuestNpcData() {
    const data = loadQuestData();
    const npcs = { ...(data.npcs || {}) };

    if (townLayout && Array.isArray(townLayout.questGivers)) {
      for (const questGiver of townLayout.questGivers) {
        if (!questGiver || !questGiver.id) {
          continue;
        }
        npcs[questGiver.id] = {
          ...(npcs[questGiver.id] || {}),
          name: questGiver.name || questGiver.id,
          x: questGiver.x,
          y: questGiver.y,
          interactRange: questGiver.interactRange || 2.5,
          questGiver: true
        };
      }
    }

    if (townLayout && townLayout.vendor) {
      npcs[townLayout.vendor.id] = {
        ...(npcs[townLayout.vendor.id] || {}),
        name: townLayout.vendor.name,
        x: townLayout.vendor.x,
        y: townLayout.vendor.y,
        interactRange: townLayout.vendor.interactRange || 2.25,
        questGiver: true
      };
    }

    return npcs;
  }

  function getQuestNpc(npcId) {
    const npcs = getQuestNpcData();
    return npcs[npcId] || null;
  }

  function getGeneratedQuestById(player, questId) {
    return proceduralQuestTools.getGeneratedQuestById(player, questId);
  }

  function getQuestById(questId, player = null) {
    const generatedQuest = player ? getGeneratedQuestById(player, questId) : null;
    if (generatedQuest) {
      return generatedQuest;
    }
    const normalizedQuestId = String(questId || "").trim();
    if (!normalizedQuestId) {
      return null;
    }
    const quests = getQuestDefs();
    return quests.find((entry) => String(entry && entry.id || "") === normalizedQuestId) || null;
  }

  function getObjectiveProgressKey(obj) {
    if (!obj || typeof obj !== "object") {
      return "";
    }
    const type = String(obj.type || "").trim().toLowerCase();
    if (type === "explore") {
      return `explore_${Number(obj.x) || 0}_${Number(obj.y) || 0}`;
    }
    return normalizeQuestLookupId(obj.targetId || obj.mobId || obj.itemId || obj.type || "");
  }

  function getObjectiveRequiredCount(obj) {
    return Math.max(1, Number(obj && obj.count) || 1);
  }

  function getObjectiveLiveCurrent(player, activeQuest, obj) {
    const key = getObjectiveProgressKey(obj);
    const storedObjective = activeQuest && activeQuest.objectives ? activeQuest.objectives[key] : null;
    const type = String(obj && obj.type || "").trim().toLowerCase();
    if (type === "collect") {
      return Math.min(getObjectiveRequiredCount(obj), Math.max(0, Number(getInventoryItemCount(player, obj.itemId)) || 0));
    }
    return Math.max(0, Number(storedObjective && storedObjective.current) || 0);
  }

  function isPlayerNearNpc(player, npcId) {
    const npc = getQuestNpc(npcId);
    if (!player || !npc) {
      return false;
    }
    const dx = Number(player.x) - (Number(npc.x) + 0.5);
    const dy = Number(player.y) - (Number(npc.y) + 0.5);
    return Math.hypot(dx, dy) <= Math.max(0.5, Number(npc.interactRange) || 2.5);
  }

  function getNearbyQuestNpc(player) {
    if (!player) {
      return null;
    }
    const npcs = getQuestNpcData();
    for (const [npcId] of Object.entries(npcs)) {
      if (isPlayerNearNpc(player, npcId)) {
        return { id: npcId, ...npcs[npcId] };
      }
    }
    return null;
  }

  function getPlayerQuestState(player) {
    const state = ensurePlayerQuestState(player);
    return {
      active: state.active,
      completed: state.completed
    };
  }

  function hasQuest(player, questId) {
    const state = getPlayerQuestState(player);
    return !!state.active[questId];
  }

  function hasCompletedQuest(player, questId) {
    const state = getPlayerQuestState(player);
    return state.completed.includes(questId);
  }

  function hasMobDefinition(mobId) {
    const mobConfig = mobConfigProvider();
    if (!mobConfig || !(mobConfig.mobDefs instanceof Map)) {
      return false;
    }
    const targetKey = normalizeQuestLookupId(mobId);
    if (!targetKey) {
      return false;
    }
    for (const name of mobConfig.mobDefs.keys()) {
      if (normalizeQuestLookupId(name) === targetKey) {
        return true;
      }
    }
    return false;
  }

  function canAnyMobDropItem(itemId) {
    const mobConfig = mobConfigProvider();
    if (!mobConfig || !(mobConfig.mobDefs instanceof Map)) {
      return false;
    }
    const targetKey = normalizeQuestLookupId(itemId);
    if (!targetKey) {
      return false;
    }
    for (const mobDef of mobConfig.mobDefs.values()) {
      const dropRules = Array.isArray(mobDef && mobDef.dropRules) ? mobDef.dropRules : [];
      if (dropRules.some((rule) => normalizeQuestLookupId(rule && rule.itemId) === targetKey)) {
        return true;
      }
    }
    return false;
  }

  function isQuestDefinitionValid(quest) {
    if (!quest || typeof quest !== "object") {
      return false;
    }
    const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
    if (!objectives.length) {
      return false;
    }
    for (const obj of objectives) {
      const type = String(obj && obj.type || "").trim().toLowerCase();
      if (type === "kill" && !hasMobDefinition(obj.mobId)) {
        return false;
      }
      if (type === "collect" && !canAnyMobDropItem(obj.itemId)) {
        return false;
      }
      if (type === "talk" && !getQuestNpc(obj.targetId)) {
        return false;
      }
      if (type === "explore" && (!Number.isFinite(Number(obj.x)) || !Number.isFinite(Number(obj.y)))) {
        return false;
      }
    }
    return true;
  }

  function canAcceptQuest(player, questId) {
    const quest = getQuestById(questId, player);
    if (!quest) {
      return { canAccept: false, reason: "Quest not found" };
    }
    if (hasQuest(player, questId)) {
      return { canAccept: false, reason: "Already on this quest" };
    }
    if (!quest.generated && hasCompletedQuest(player, questId)) {
      return { canAccept: false, reason: "Already completed" };
    }
    const playerLevel = Number(player && player.level) || 1;
    if (quest.minLevel && playerLevel < quest.minLevel) {
      return { canAccept: false, reason: `Requires level ${quest.minLevel}` };
    }
    return { canAccept: true };
  }

  function acceptQuest(player, questId) {
    const check = canAcceptQuest(player, questId);
    if (!check.canAccept) {
      return { success: false, reason: check.reason };
    }

    const quest = getQuestById(questId, player);
    if (!quest) {
      return { success: false, reason: "Quest not found" };
    }

    const questState = ensurePlayerQuestState(player);
    const objectives = {};
    for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
      const key = getObjectiveProgressKey(obj);
      if (!key) {
        continue;
      }
      const required = getObjectiveRequiredCount(obj);
      let current = 0;
      const type = String(obj.type || "").trim().toLowerCase();
      if (type === "collect") {
        current = Math.min(required, Math.max(0, Number(getInventoryItemCount(player, obj.itemId)) || 0));
      } else if (type === "explore") {
        const dx = (Number(player && player.x) || 0) - Number(obj.x);
        const dy = (Number(player && player.y) || 0) - Number(obj.y);
        if (Math.hypot(dx, dy) <= Number(obj.radius || 15)) {
          current = required;
        }
      }
      objectives[key] = { current, required };
    }

    questState.active[questId] = {
      objectives,
      startedAt: Date.now(),
      generated: !!quest.generated,
      templateId: String(quest.templateId || "")
    };
    if (quest.generated) {
      proceduralQuestTools.markQuestAccepted(player, questId);
    }

    return { success: true, quest };
  }

  function doesObjectiveMatchTarget(obj, type, targetId) {
    const normalizedType = String(type || "").trim().toLowerCase();
    if (String(obj && obj.type || "").trim().toLowerCase() !== normalizedType) {
      return false;
    }
    if (normalizedType === "kill") {
      return normalizeQuestLookupId(obj.mobId) === normalizeQuestLookupId(targetId);
    }
    if (normalizedType === "collect") {
      return normalizeQuestLookupId(obj.itemId) === normalizeQuestLookupId(targetId);
    }
    if (normalizedType === "talk") {
      return normalizeQuestLookupId(obj.targetId) === normalizeQuestLookupId(targetId);
    }
    return true;
  }

  function updateQuestObjective(player, type, targetId, amount = 1) {
    if (!player || !player.questState || !player.questState.active) {
      return [];
    }

    const updatedQuests = [];
    for (const questId of Object.keys(player.questState.active)) {
      const quest = getQuestById(questId, player);
      if (!quest) {
        continue;
      }
      for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
        if (!doesObjectiveMatchTarget(obj, type, targetId)) {
          continue;
        }

        const key = getObjectiveProgressKey(obj);
        const activeQuest = player.questState.active[questId];
        if (!activeQuest || !activeQuest.objectives[key]) {
          continue;
        }
        const required = getObjectiveRequiredCount(obj);
        if (String(type || "").trim().toLowerCase() === "collect") {
          activeQuest.objectives[key].current = Math.min(
            required,
            Math.max(0, Number(getInventoryItemCount(player, obj.itemId)) || 0)
          );
        } else {
          activeQuest.objectives[key].current = Math.min(
            required,
            (activeQuest.objectives[key].current || 0) + amount
          );
        }
        updatedQuests.push(questId);
      }
    }

    return updatedQuests;
  }

  function checkQuestExploreObjective(player) {
    if (!player || !player.questState || !player.questState.active) {
      return [];
    }

    const updatedQuests = [];
    const px = Number(player.x) || 0;
    const py = Number(player.y) || 0;

    for (const questId of Object.keys(player.questState.active)) {
      const quest = getQuestById(questId, player);
      if (!quest) {
        continue;
      }
      for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
        if (String(obj && obj.type || "").trim().toLowerCase() !== "explore") {
          continue;
        }
        const dx = px - Number(obj.x);
        const dy = py - Number(obj.y);
        if (Math.hypot(dx, dy) > Number(obj.radius || 15)) {
          continue;
        }
        const key = getObjectiveProgressKey(obj);
        const activeQuest = player.questState.active[questId];
        if (!activeQuest || !activeQuest.objectives[key]) {
          continue;
        }
        activeQuest.objectives[key].current = activeQuest.objectives[key].required || 1;
        updatedQuests.push(questId);
      }
    }

    return updatedQuests;
  }

  function canCompleteQuest(player, questId) {
    const quest = getQuestById(questId, player);
    if (!quest) {
      return { canComplete: false, reason: "Quest not found" };
    }
    if (!hasQuest(player, questId)) {
      return { canComplete: false, reason: "Not on this quest" };
    }

    const questState = player.questState && player.questState.active ? player.questState.active[questId] : null;
    if (!questState) {
      return { canComplete: false, reason: "Quest state not found" };
    }

    const requiredCollectTotals = new Map();
    for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
      if (String(obj && obj.type || "").trim().toLowerCase() !== "collect") {
        continue;
      }
      const itemId = String(obj && obj.itemId || "").trim();
      if (!itemId) {
        continue;
      }
      requiredCollectTotals.set(itemId, (requiredCollectTotals.get(itemId) || 0) + getObjectiveRequiredCount(obj));
    }
    for (const [itemId, required] of requiredCollectTotals.entries()) {
      if (Math.max(0, Number(getInventoryItemCount(player, itemId)) || 0) < required) {
        return { canComplete: false, reason: "Objectives not complete" };
      }
    }

    for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
      const required = getObjectiveRequiredCount(obj);
      const current = getObjectiveLiveCurrent(player, questState, obj);
      if (current < required) {
        return { canComplete: false, reason: "Objectives not complete" };
      }
    }

    return { canComplete: true };
  }

  function completeQuest(player, questId) {
    const check = canCompleteQuest(player, questId);
    if (!check.canComplete) {
      return { success: false, reason: check.reason };
    }

    const quest = getQuestById(questId, player);
    if (!quest) {
      return { success: false, reason: "Quest not found" };
    }

    const collectRequirements = new Map();
    for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
      if (String(obj && obj.type || "").trim().toLowerCase() !== "collect") {
        continue;
      }
      const itemId = String(obj && obj.itemId || "").trim();
      if (!itemId) {
        continue;
      }
      collectRequirements.set(itemId, (collectRequirements.get(itemId) || 0) + getObjectiveRequiredCount(obj));
    }
    let inventoryChanged = false;
    for (const [itemId, required] of collectRequirements.entries()) {
      if (required <= 0) {
        continue;
      }
      const consumed = consumeInventoryItem(player, itemId, required);
      if (!consumed) {
        return { success: false, reason: "Required items were missing during turn-in" };
      }
      inventoryChanged = true;
    }
    if (inventoryChanged) {
      sendInventoryState(player);
      syncPlayerCopperFromInventory(player, false);
    }

    const questState = ensurePlayerQuestState(player);
    delete questState.active[questId];

    if (!quest.generated && !questState.completed.includes(questId)) {
      questState.completed.push(questId);
    }
    if (quest.generated) {
      proceduralQuestTools.recordGeneratedCompletion(player, quest);
    }

    const rewards = { exp: 0, items: [] };
    if (quest.rewards) {
      if (quest.rewards.exp) {
        addExp(player, quest.rewards.exp);
        rewards.exp = quest.rewards.exp;
      }
      if (Array.isArray(quest.rewards.items) && quest.rewards.items.length > 0) {
        const result = addItemsToInventory(player, quest.rewards.items);
        rewards.items = result.added.map((entry) => ({
          itemId: entry.itemId,
          qty: entry.qty
        }));
      }
    }

    return { success: true, quest, rewards };
  }

  function debugCompleteQuest(player, questId) {
    if (!hasQuest(player, questId)) {
      return { success: false, reason: "Not on this quest" };
    }
    const quest = getQuestById(questId, player);
    const questState = player && player.questState && player.questState.active ? player.questState.active[questId] : null;
    if (!quest || !questState || !questState.objectives) {
      return { success: false, reason: "Quest state not found" };
    }
    for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
      const key = getObjectiveProgressKey(obj);
      if (!key || !questState.objectives[key]) {
        continue;
      }
      questState.objectives[key].current = Math.max(
        questState.objectives[key].current || 0,
        questState.objectives[key].required || Math.max(1, Number(obj.count) || 1)
      );
    }
    return { success: true, quest };
  }

  function abandonQuest(player, questId) {
    if (!hasQuest(player, questId)) {
      return { success: false, reason: "Not on this quest" };
    }
    if (player.questState && player.questState.active) {
      delete player.questState.active[questId];
    }
    return { success: true };
  }

  function getQuestProgress(player, questId) {
    if (!hasQuest(player, questId)) {
      return null;
    }

    const quest = getQuestById(questId, player);
    if (!quest) {
      return null;
    }

    const activeQuest = player.questState && player.questState.active ? player.questState.active[questId] : null;
    if (!activeQuest) {
      return null;
    }

    const objectives = (Array.isArray(quest.objectives) ? quest.objectives : []).map((obj) => {
      const required = getObjectiveRequiredCount(obj);
      const current = getObjectiveLiveCurrent(player, activeQuest, obj);
      return {
        type: obj.type,
        targetId: obj.targetId || obj.mobId || obj.itemId || "",
        description: obj.description,
        current,
        required,
        complete: current >= required
      };
    });

    return {
      questId,
      title: quest.title,
      description: quest.description,
      objectives,
      allComplete: objectives.every((entry) => entry.complete)
    };
  }

  function getStaticAvailableQuestsForNpc(player, npcId) {
    const playerLevel = Number(player && player.level) || 1;
    return getQuestDefs().filter((quest) => {
      if (!quest || String(quest.npcGiverId || "") !== String(npcId || "")) {
        return false;
      }
      if (!isQuestDefinitionValid(quest)) {
        return false;
      }
      if (hasCompletedQuest(player, quest.id)) {
        return false;
      }
      if (hasQuest(player, quest.id)) {
        return false;
      }
      if (quest.minLevel && playerLevel < quest.minLevel) {
        return false;
      }
      return true;
    });
  }

  function getAvailableQuestsForPlayer(player) {
    if (!player) {
      return [];
    }
    const npc = getNearbyQuestNpc(player);
    if (!npc) {
      return [];
    }
    const staticQuests = getStaticAvailableQuestsForNpc(player, npc.id);
    if (staticQuests.length > 0) {
      return staticQuests;
    }
    return proceduralQuestTools.getAvailableQuestsForNpc(player, npc.id);
  }

  function getTalkQuestForNpc(player, npcId) {
    if (!player || !npcId) {
      return null;
    }
    const state = getPlayerQuestState(player);

    for (const questId of Object.keys(state.active)) {
      const quest = getQuestById(questId, player);
      if (!quest) {
        continue;
      }
      if (String(quest.npcCompleteId || "") === String(npcId || "")) {
        const check = canCompleteQuest(player, questId);
        if (check.canComplete) {
          return { questId, quest, canComplete: true };
        }
      }
    }

    for (const questId of Object.keys(state.active)) {
      const quest = getQuestById(questId, player);
      if (!quest) {
        continue;
      }
      for (const obj of Array.isArray(quest.objectives) ? quest.objectives : []) {
        if (
          String(obj && obj.type || "").trim().toLowerCase() === "talk" &&
          normalizeQuestLookupId(obj.targetId) === normalizeQuestLookupId(npcId)
        ) {
          return { questId, objective: obj, quest };
        }
      }
    }

    return null;
  }

  return {
    loadQuestData,
    getQuestDefs,
    getQuestNpcData,
    getQuestNpc,
    getQuestById,
    isPlayerNearNpc,
    getNearbyQuestNpc,
    getPlayerQuestState,
    hasQuest,
    hasCompletedQuest,
    canAcceptQuest,
    acceptQuest,
    updateQuestObjective,
    checkQuestExploreObjective,
    canCompleteQuest,
    completeQuest,
    debugCompleteQuest,
    abandonQuest,
    getQuestProgress,
    getAvailableQuestsForPlayer,
    getTalkQuestForNpc
  };
}

module.exports = { createQuestTools };
