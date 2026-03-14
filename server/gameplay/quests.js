const fs = require("fs");
const path = require("path");

function createQuestTools(options = {}) {
  const townLayout = options.townLayout || null;
  const questDefs = options.questDefs || null;
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
  const sendSelfProgress = typeof options.sendSelfProgress === "function" ? options.sendSelfProgress : () => {};
  const addExp = typeof options.addExp === "function" ? options.addExp : () => {};
  const addItemsToInventory =
    typeof options.addItemsToInventory === "function" ? options.addItemsToInventory : () => ({ added: [], leftover: [] });

  let loadedQuestData = null;

  function loadQuestData() {
    if (loadedQuestData) {
      return loadedQuestData;
    }
    try {
      const questsPath = path.resolve(__dirname, "../../data/quests.json");
      const rawData = fs.readFileSync(questsPath, "utf8");
      loadedQuestData = JSON.parse(rawData);
      return loadedQuestData;
    } catch (err) {
      console.error("[quests] Failed to load quests.json:", err.message);
      return { quests: [], npcs: {} };
    }
  }

  function getQuestDefs() {
    const data = loadQuestData();
    return data.quests || [];
  }

  function getQuestNpcData() {
    const data = loadQuestData();
    return data.npcs || {};
  }

  function getQuestNpc(npcId) {
    const npcs = getQuestNpcData();
    return npcs[npcId] || null;
  }

  function getQuestById(questId) {
    const quests = getQuestDefs();
    return quests.find(q => q.id === questId) || null;
  }

  function isPlayerNearNpc(player, npcId) {
    const npc = getQuestNpc(npcId);
    if (!player || !npc) {
      return false;
    }
    const dx = Number(player.x) - Number(npc.x);
    const dy = Number(player.y) - Number(npc.y);
    return Math.hypot(dx, dy) <= Math.max(0.5, Number(npc.interactRange) || 2.5);
  }

  function getNearbyQuestNpc(player) {
    if (!player) return null;
    const npcs = getQuestNpcData();
    for (const [npcId, npc] of Object.entries(npcs)) {
      if (isPlayerNearNpc(player, npcId)) {
        return { id: npcId, ...npc };
      }
    }
    return null;
  }

  function getPlayerQuestState(player) {
    if (!player) {
      return { active: {}, completed: [] };
    }
    return {
      active: player.questState?.active || {},
      completed: player.questState?.completed || []
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

  function canAcceptQuest(player, questId) {
    const quest = getQuestById(questId);
    if (!quest) return { canAccept: false, reason: "Quest not found" };
    if (hasQuest(player, questId)) return { canAccept: false, reason: "Already on this quest" };
    if (hasCompletedQuest(player, questId)) return { canAccept: false, reason: "Already completed" };
    const playerLevel = Number(player.level) || 1;
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

    const quest = getQuestById(questId);
    if (!quest) {
      return { success: false, reason: "Quest not found" };
    }

    if (!player.questState) {
      player.questState = { active: {}, completed: [] };
    }

    const objectives = {};
    for (const obj of quest.objectives) {
      objectives[obj.targetId || obj.type] = { current: 0, required: obj.count || 1 };
    }

    player.questState.active[questId] = {
      objectives,
      startedAt: Date.now()
    };

    return { success: true, quest };
  }

  function updateQuestObjective(player, type, targetId, amount = 1) {
    if (!player || !player.questState || !player.questState.active) {
      return [];
    }

    const updatedQuests = [];
    const questIds = Object.keys(player.questState.active);

    for (const questId of questIds) {
      const quest = getQuestById(questId);
      if (!quest) continue;

      for (const obj of quest.objectives) {
        if (obj.type !== type) continue;
        if (type === "kill" && obj.mobId !== targetId) continue;
        if (type === "collect" && obj.itemId !== targetId) continue;
        if (type === "talk" && obj.targetId !== targetId) continue;

        const key = targetId || type;
        const questObj = player.questState.active[questId];
        if (!questObj || !questObj.objectives[key]) continue;

        const required = obj.count || 1;
        questObj.objectives[key].current = Math.min(
          required,
          (questObj.objectives[key].current || 0) + amount
        );

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
    const questIds = Object.keys(player.questState.active);
    const px = Number(player.x) || 0;
    const py = Number(player.y) || 0;

    for (const questId of questIds) {
      const quest = getQuestById(questId);
      if (!quest) continue;

      for (const obj of quest.objectives) {
        if (obj.type !== "explore") continue;

        const dx = px - Number(obj.x);
        const dy = py - Number(obj.y);
        const dist = Math.hypot(dx, dy);
        if (dist > Number(obj.radius || 15)) continue;

        const key = `explore_${obj.x}_${obj.y}`;
        const questObj = player.questState.active[questId];
        if (!questObj || !questObj.objectives[key]) continue;

        questObj.objectives[key].current = 1;
        updatedQuests.push(questId);
      }
    }

    return updatedQuests;
  }

  function canCompleteQuest(player, questId) {
    const quest = getQuestById(questId);
    if (!quest) return { canComplete: false, reason: "Quest not found" };
    if (!hasQuest(player, questId)) return { canComplete: false, reason: "Not on this quest" };

    const questState = player.questState?.active[questId];
    if (!questState) return { canComplete: false, reason: "Quest state not found" };

    for (const obj of quest.objectives) {
      const key = obj.targetId || obj.type;
      const required = obj.count || 1;
      const current = questState.objectives[key]?.current || 0;
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

    const quest = getQuestById(questId);
    if (!quest) {
      return { success: false, reason: "Quest not found" };
    }

    // Remove from active
    if (player.questState?.active) {
      delete player.questState.active[questId];
    }

    // Add to completed
    if (!player.questState) {
      player.questState = { active: {}, completed: [] };
    }
    if (!player.questState.completed) {
      player.questState.completed = [];
    }
    if (!player.questState.completed.includes(questId)) {
      player.questState.completed.push(questId);
    }

    // Grant rewards
    const rewards = { exp: 0, items: [] };
    if (quest.rewards) {
      if (quest.rewards.exp) {
        addExp(player, quest.rewards.exp);
        rewards.exp = quest.rewards.exp;
      }
      if (quest.rewards.items && Array.isArray(quest.rewards.items)) {
        const result = addItemsToInventory(player, quest.rewards.items);
        rewards.items = result.added.map(entry => ({
          itemId: entry.itemId,
          qty: entry.qty
        }));
      }
    }

    return { success: true, quest, rewards };
  }

  function abandonQuest(player, questId) {
    if (!hasQuest(player, questId)) {
      return { success: false, reason: "Not on this quest" };
    }

    if (player.questState?.active) {
      delete player.questState.active[questId];
    }

    return { success: true };
  }

  function getQuestProgress(player, questId) {
    if (!hasQuest(player, questId)) {
      return null;
    }

    const quest = getQuestById(questId);
    if (!quest) return null;

    const questState = player.questState?.active[questId];
    if (!questState) return null;

    const objectives = quest.objectives.map(obj => {
      const key = obj.targetId || obj.type;
      const current = questState.objectives[key]?.current || 0;
      const required = obj.count || 1;
      return {
        type: obj.type,
        targetId: obj.targetId,
        description: obj.description,
        current,
        required,
        complete: current >= required
      };
    });

    const allComplete = objectives.every(obj => obj.complete);

    return {
      questId,
      title: quest.title,
      description: quest.description,
      objectives,
      allComplete
    };
  }

  function getAvailableQuestsForPlayer(player) {
    if (!player) return [];
    const quests = getQuestDefs();
    const npc = getNearbyQuestNpc(player);
    if (!npc) return [];

    return quests.filter(quest => {
      // NPC must be the quest giver
      if (quest.npcGiverId !== npc.id) return false;
      // Check if already completed
      if (hasCompletedQuest(player, quest.id)) return false;
      // Check if already active
      if (hasQuest(player, quest.id)) return false;
      // Check level requirement
      const playerLevel = Number(player.level) || 1;
      if (quest.minLevel && playerLevel < quest.minLevel) return false;
      return true;
    });
  }

  function getTalkQuestForNpc(player, npcId) {
    if (!player || !npcId) return null;
    const quests = getQuestDefs();
    const state = getPlayerQuestState(player);

    // Check for talk objectives in active quests
    for (const questId of Object.keys(state.active)) {
      const quest = quests.find(q => q.id === questId);
      if (!quest) continue;
      for (const obj of quest.objectives) {
        if (obj.type === "talk" && obj.targetId === npcId) {
          return { questId, objective: obj, quest };
        }
      }
    }

    // Check if NPC can complete a quest
    for (const questId of Object.keys(state.active)) {
      const quest = quests.find(q => q.id === questId);
      if (!quest) continue;
      if (quest.npcCompleteId === npcId) {
        const check = canCompleteQuest(player, questId);
        if (check.canComplete) {
          return { questId, quest, canComplete: true };
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
    abandonQuest,
    getQuestProgress,
    getAvailableQuestsForPlayer,
    getTalkQuestForNpc
  };
}

module.exports = { createQuestTools };
