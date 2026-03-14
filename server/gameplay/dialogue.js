function createDialogueTools(options = {}) {
  const questTools = options.questTools || null;
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};

  // Dialogue state per player
  const playerDialogueState = new Map();

  function getDialogueState(playerId) {
    return playerDialogueState.get(playerId) || null;
  }

  function clearDialogueState(playerId) {
    playerDialogueState.delete(playerId);
  }

  function normalizeDialogueNodes(nodes) {
    const source = Array.isArray(nodes) ? nodes : [];
    return source.map((node, index) => {
      const entry = node && typeof node === "object" ? { ...node } : { text: String(node || "") };
      if (!entry.id) {
        entry.id = `node_${index}`;
      }
      return entry;
    });
  }

  function startDialogue(playerId, player, npcId) {
    if (!questTools) {
      return { error: "Quest system not available" };
    }

    const npc = questTools.getQuestNpc(npcId);
    if (!npc) {
      return { error: "NPC not found" };
    }

    // Check if there's a talk objective or can complete a quest
    const talkQuest = questTools.getTalkQuestForNpc(player, npcId);

    // Check available quests from this NPC
    const availableQuests = questTools.getAvailableQuestsForPlayer(player);

    let dialogueType = "greeting";
    let dialogueNodes = [];

    if (talkQuest && talkQuest.canComplete) {
      // Can complete a quest
      dialogueType = "complete";
      const quest = talkQuest.quest;
      dialogueNodes = quest.dialogue?.complete || [
        { text: "You've completed my quest! Here is your reward.", questComplete: true }
      ];
    } else if (talkQuest) {
      // Has talk objective
      dialogueType = "inProgress";
      const quest = talkQuest.quest;
      dialogueNodes = quest.dialogue?.inProgress || [
        { text: "You haven't finished yet." }
      ];
    } else if (availableQuests.length > 0) {
      // Has quests to offer
      dialogueType = "offer";
      const quest = availableQuests[0];
      dialogueNodes = quest.dialogue?.offer || [
        { text: "I have a quest for you." }
      ];
    } else {
      // No quests
      dialogueType = "noQuest";
      dialogueNodes = [
        { text: "Hello, adventurer! Return when you need more work." }
      ];
    }

    const normalizedNodes = normalizeDialogueNodes(dialogueNodes);

    const dialogueState = {
      npcId,
      dialogueType,
      questId: talkQuest?.questId || (availableQuests.length > 0 ? availableQuests[0].id : null),
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

    // Find the selected node
    const selectedNode = state.nodes.find(n => n.id === nodeId);
    if (!selectedNode) {
      return { error: "Invalid option" };
    }

    // Check if this node starts a quest
    if (selectedNode.questStart && state.questId) {
      const result = questTools.acceptQuest(player, state.questId);
      if (result.success) {
        clearDialogueState(playerId);
        return {
          questAccepted: true,
          questId: state.questId,
          questTitle: result.quest?.title
        };
      }
    }

    // Check if this node completes a quest
    if (selectedNode.questComplete && state.questId) {
      const result = questTools.completeQuest(player, state.questId);
      if (result.success) {
        clearDialogueState(playerId);
        return {
          questCompleted: true,
          questId: state.questId,
          questTitle: result.quest?.title,
          rewards: result.rewards
        };
      }
    }

    // If no next node, end dialogue
    if (!selectedNode.next) {
      clearDialogueState(playerId);
      return { dialogueEnded: true };
    }

    // Move to next node
    // For simplicity, we'll just end the dialogue here
    // A more complex system would have linked dialogue nodes
    clearDialogueState(playerId);
    return { dialogueEnded: true };
  }

  function getDialogueForQuest(playerId, player, npcId) {
    if (!questTools) {
      return null;
    }

    // Check if there's a talk objective or can complete a quest
    const talkQuest = questTools.getTalkQuestForNpc(player, npcId);
    
    // Check available quests from this NPC
    const availableQuests = questTools.getAvailableQuestsForPlayer(player);

    let dialogueType = "greeting";
    let questId = null;
    let dialogueNodes = [];

    if (talkQuest && talkQuest.canComplete) {
      dialogueType = "complete";
      questId = talkQuest.questId;
      const quest = talkQuest.quest;
      dialogueNodes = quest.dialogue?.complete || [];
    } else if (talkQuest) {
      dialogueType = "inProgress";
      questId = talkQuest.questId;
      const quest = talkQuest.quest;
      dialogueNodes = quest.dialogue?.inProgress || [];
    } else if (availableQuests.length > 0) {
      dialogueType = "offer";
      questId = availableQuests[0].id;
      const quest = availableQuests[0];
      dialogueNodes = quest.dialogue?.offer || [];
    } else {
      dialogueType = "noQuest";
      dialogueNodes = [{ text: "Hello, adventurer! Return when you need more work." }];
    }

    return {
      npcId,
      dialogueType,
      questId,
      nodes: normalizeDialogueNodes(dialogueNodes)
    };
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
