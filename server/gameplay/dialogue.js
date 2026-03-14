function createDialogueTools(options = {}) {
  const questTools = options.questTools || null;
  const playerDialogueState = new Map();

  function cloneQuestRewards(rewards) {
    if (!rewards || typeof rewards !== "object") {
      return null;
    }
    const exp = Math.max(0, Number(rewards.exp) || 0);
    const items = Array.isArray(rewards.items)
      ? rewards.items
          .map((entry) => ({
            itemId: String(entry && entry.itemId || "").trim(),
            qty: Math.max(0, Number(entry && entry.qty) || 0)
          }))
          .filter((entry) => entry.itemId && entry.qty > 0)
      : [];
    if (exp <= 0 && items.length === 0) {
      return null;
    }
    return { exp, items };
  }

  function attachQuestRewardsToNodes(nodes, quest) {
    const rewards = cloneQuestRewards(quest && quest.rewards);
    if (!rewards) {
      return Array.isArray(nodes) ? nodes.map((node) => ({ ...node })) : [];
    }
    return (Array.isArray(nodes) ? nodes : []).map((node) => {
      const entry = node && typeof node === "object" ? { ...node } : { text: String(node || "") };
      if (entry.questComplete) {
        return entry;
      }
      entry.rewards = {
        exp: rewards.exp,
        items: rewards.items.map((item) => ({ ...item }))
      };
      return entry;
    });
  }

  function getDialogueState(playerId) {
    return playerDialogueState.get(playerId) || null;
  }

  function clearDialogueState(playerId) {
    playerDialogueState.delete(playerId);
  }

  function normalizeDialogueNodes(nodes) {
    return (Array.isArray(nodes) ? nodes : []).map((node, index) => {
      const entry = node && typeof node === "object" ? { ...node } : { text: String(node || "") };
      if (!entry.id) {
        entry.id = `node_${index}`;
      }
      return entry;
    });
  }

  function buildQuestSelectionDialogue(availableQuests, npcName) {
    const introNode = {
      id: "quest_menu",
      text: `I have several assignments available. Which one interests you?`,
      speaker: npcName,
      choices: availableQuests.map((quest) => ({
        text: String(quest && quest.title || quest && quest.id || "Quest"),
        next: `quest_${String(quest && quest.id || "").trim()}_details`
      }))
    };
    const nodes = [introNode];
    for (const quest of availableQuests) {
      const questId = String(quest && quest.id || "").trim();
      const detailsId = `quest_${questId}_details`;
      const acceptId = `quest_${questId}_accept`;
      nodes.push({
        id: detailsId,
        text: String(quest && quest.description || "I have work for you."),
        speaker: npcName,
        rewards: cloneQuestRewards(quest && quest.rewards),
        choices: [
          { text: "I'll take this one.", next: acceptId },
          { text: "Show me the other jobs.", next: "quest_menu" }
        ]
      });
      nodes.push({
        id: acceptId,
        text: `Very well. ${String(quest && quest.title || "This task")} is yours.`,
        speaker: npcName,
        rewards: cloneQuestRewards(quest && quest.rewards),
        questStart: true,
        questId
      });
    }
    return nodes;
  }

  function startDialogue(playerId, player, npcId) {
    if (!questTools) {
      return { error: "Quest system not available" };
    }
    const npc = questTools.getQuestNpc(npcId);
    if (!npc) {
      return { error: "NPC not found" };
    }

    const talkQuest = questTools.getTalkQuestForNpc(player, npcId);
    const availableQuests = questTools.getAvailableQuestsForPlayer(player).filter(
      (quest) => String(quest && quest.npcGiverId || "") === String(npcId || "")
    );

    let dialogueType = "noQuest";
    let dialogueNodes = [];

    if (talkQuest && talkQuest.canComplete) {
      dialogueType = "complete";
      dialogueNodes = talkQuest.quest && talkQuest.quest.dialogue && talkQuest.quest.dialogue.complete
        ? talkQuest.quest.dialogue.complete
        : [{ text: "You've completed my quest! Here is your reward.", questComplete: true, questId: talkQuest.questId }];
    } else if (talkQuest) {
      dialogueType = "inProgress";
      dialogueNodes = talkQuest.quest && talkQuest.quest.dialogue && talkQuest.quest.dialogue.inProgress
        ? talkQuest.quest.dialogue.inProgress
        : [{ text: "You haven't finished yet." }];
    } else if (availableQuests.length > 1) {
      dialogueType = "offer";
      dialogueNodes = buildQuestSelectionDialogue(availableQuests, npc.name);
    } else if (availableQuests.length === 1) {
      dialogueType = "offer";
      dialogueNodes = availableQuests[0] && availableQuests[0].dialogue && availableQuests[0].dialogue.offer
        ? attachQuestRewardsToNodes(availableQuests[0].dialogue.offer, availableQuests[0])
        : [{ text: "I have a quest for you." }];
    } else {
      dialogueType = "noQuest";
      dialogueNodes = [{ text: "Hello, adventurer! Return when you need more work." }];
    }

    const normalizedNodes = normalizeDialogueNodes(dialogueNodes);
    const dialogueState = {
      npcId,
      dialogueType,
      questId:
        talkQuest && talkQuest.questId
          ? talkQuest.questId
          : availableQuests.length === 1
            ? String(availableQuests[0] && availableQuests[0].id || "")
            : null,
      currentNodeIndex: 0,
      nodes: normalizedNodes
    };

    playerDialogueState.set(playerId, dialogueState);

    return {
      npcId,
      npcName: npc.name,
      dialogueType,
      questId: dialogueState.questId,
      nodes: normalizedNodes
    };
  }

  function selectDialogueOption(playerId, player, nodeId) {
    const state = getDialogueState(playerId);
    if (!state) {
      return { error: "No active dialogue" };
    }
    const selectedNode = Array.isArray(state.nodes)
      ? state.nodes.find((node) => String(node && node.id || "") === String(nodeId || ""))
      : null;
    if (!selectedNode) {
      return { error: "Invalid option" };
    }

    const selectedQuestId = String(selectedNode.questId || state.questId || "").trim();
    if (selectedNode.questStart && selectedQuestId) {
      const result = questTools.acceptQuest(player, selectedQuestId);
      if (result.success) {
        clearDialogueState(playerId);
        return {
          questAccepted: true,
          questId: selectedQuestId,
          questTitle: result.quest && result.quest.title ? result.quest.title : selectedQuestId
        };
      }
      return { error: result.reason || "Failed to accept quest" };
    }

    if (selectedNode.questComplete && selectedQuestId) {
      const result = questTools.completeQuest(player, selectedQuestId);
      if (result.success) {
        clearDialogueState(playerId);
        return {
          questCompleted: true,
          questId: selectedQuestId,
          questTitle: result.quest && result.quest.title ? result.quest.title : selectedQuestId,
          rewards: result.rewards
        };
      }
      return { error: result.reason || "Failed to complete quest" };
    }

    if (!selectedNode.next) {
      clearDialogueState(playerId);
      return { dialogueEnded: true };
    }

    const nextIndex = state.nodes.findIndex((node) => String(node && node.id || "") === String(selectedNode.next || ""));
    if (nextIndex < 0) {
      clearDialogueState(playerId);
      return { dialogueEnded: true };
    }
    state.currentNodeIndex = nextIndex;
    playerDialogueState.set(playerId, state);
    return {
      dialogueContinues: true,
      npcId: state.npcId,
      questId: selectedQuestId || state.questId,
      nodes: state.nodes,
      currentNodeIndex: nextIndex
    };
  }

  function getDialogueForQuest(playerId, player, npcId) {
    const result = startDialogue(playerId, player, npcId);
    if (result && !result.error) {
      clearDialogueState(playerId);
    }
    return result && !result.error ? result : null;
  }

  return {
    getDialogueState,
    clearDialogueState,
    startDialogue,
    selectDialogueOption,
    getDialogueForQuest
  };
}

module.exports = { createDialogueTools };
