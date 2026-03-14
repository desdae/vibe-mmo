(function initVibeClientQuestUi(globalScope) {
  "use strict";

  function createQuestUiTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    
    let questPanel = null;
    let questTrackerPanel = null;
    let dialoguePanel = null;
    let notificationPanel = null;
    
    let currentDialogue = null;
    let currentQuestState = { active: [], completed: [] };

    function initPanels(panels) {
      questPanel = panels.questPanel || document.getElementById("quest-panel");
      questTrackerPanel = panels.questTrackerPanel || document.getElementById("quest-tracker-panel");
      dialoguePanel = panels.dialoguePanel || document.getElementById("dialogue-panel");
      notificationPanel = panels.notificationPanel || document.getElementById("notification-panel");
      
      // Set up dialogue close button
      if (dialoguePanel) {
        const closeBtn = dialoguePanel.querySelector(".dialogue-close-btn");
        if (closeBtn) {
          closeBtn.addEventListener("click", closeDialogue);
        }
      }
    }

    function setQuestPanelVisible(visible) {
      if (!questPanel) return;
      questPanel.classList.toggle("hidden", !visible);
      if (visible) {
        renderQuestLog();
      }
    }

    function toggleQuestPanel() {
      if (!questPanel) return;
      setQuestPanelVisible(questPanel.classList.contains("hidden"));
    }

    function renderQuestLog() {
      if (!questPanel) return;
      
      const questList = questPanel.querySelector(".quest-list");
      if (!questList) return;
      
      questList.innerHTML = "";
      
      // Render active quests
      if (currentQuestState.active.length === 0) {
        questList.innerHTML += '<div class="quest-empty">No active quests</div>';
      } else {
        for (const quest of currentQuestState.active) {
          const questEl = createQuestElement(quest, "active");
          questList.appendChild(questEl);
        }
      }
      
      // Render completed quests section
      const completedSection = questPanel.querySelector(".completed-quests");
      if (completedSection) {
        if (currentQuestState.completed.length === 0) {
          completedSection.innerHTML = '<div class="quest-empty">No completed quests</div>';
        } else {
          completedSection.innerHTML = currentQuestState.completed.map(questId => 
            `<div class="quest-completed-item">✓ ${questId}</div>`
          ).join("");
        }
      }
    }

    function createQuestElement(quest, status) {
      const div = document.createElement("div");
      div.className = `quest-item quest-${status}`;
      div.dataset.questId = quest.questId;
      
      let objectivesHtml = "";
      if (quest.objectives) {
        objectivesHtml = quest.objectives.map(obj => {
          const complete = obj.complete ? "complete" : "";
          const icon = obj.complete ? "✓" : "○";
          return `<div class="quest-objective ${complete}">${icon} ${obj.description}</div>`;
        }).join("");
      }
      
      div.innerHTML = `
        <div class="quest-title">${quest.title || quest.questId}</div>
        <div class="quest-description">${quest.description || ""}</div>
        <div class="quest-objectives">${objectivesHtml}</div>
        ${status === "active" ? '<button class="quest-abandon-btn">Abandon</button>' : ''}
      `;
      
      if (status === "active") {
        const abandonBtn = div.querySelector(".quest-abandon-btn");
        if (abandonBtn) {
          abandonBtn.addEventListener("click", () => {
            if (typeof deps.abandonQuest === "function") {
              deps.abandonQuest(quest.questId);
            }
          });
        }
      }
      
      return div;
    }

    function showDialogue(dialogue) {
      if (!dialoguePanel) return;
      
      currentDialogue = dialogue;
      
      const dialogueTitle = dialoguePanel.querySelector(".dialogue-title");
      const dialogueContent = dialoguePanel.querySelector(".dialogue-content");
      const dialogueOptions = dialoguePanel.querySelector(".dialogue-options");
      
      if (dialogueTitle) {
        dialogueTitle.textContent = dialogue.npcName || "NPC";
      }
      
      if (dialogueContent && dialogue.nodes && dialogue.nodes.length > 0) {
        const node = dialogue.nodes[0];
        dialogueContent.textContent = node.text || "";
      }
      
      if (dialogueOptions) {
        dialogueOptions.innerHTML = "";
        
        // Create dialogue options based on dialogue type
        if (dialogue.dialogueType === "offer" || dialogue.dialogueType === "complete") {
          const acceptBtn = document.createElement("button");
          acceptBtn.className = "dialogue-option-btn";
          acceptBtn.textContent = dialogue.dialogueType === "complete" ? "Complete Quest" : "Accept Quest";
          acceptBtn.addEventListener("click", () => {
            selectDialogueOption(dialogue.nodes[0]?.id || "default");
          });
          dialogueOptions.appendChild(acceptBtn);
        }
        
        const closeBtn = document.createElement("button");
        closeBtn.className = "dialogue-option-btn dialogue-close-btn";
        closeBtn.textContent = "Leave";
        closeBtn.addEventListener("click", closeDialogue);
        dialogueOptions.appendChild(closeBtn);
      }
      
      dialoguePanel.classList.remove("hidden");
    }

    function closeDialogue() {
      if (!dialoguePanel) return;
      dialoguePanel.classList.add("hidden");
      currentDialogue = null;
    }

    function selectDialogueOption(nodeId) {
      if (typeof deps.sendJson === "function") {
        deps.sendJson({
          type: "quest_select_option",
          nodeId: nodeId
        });
      }
      closeDialogue();
    }

    function showQuestNotification(title, message, type = "info") {
      if (!notificationPanel) return;
      
      const notification = document.createElement("div");
      notification.className = `quest-notification quest-notification-${type}`;
      notification.innerHTML = `
        <div class="quest-notification-title">${title}</div>
        <div class="quest-notification-message">${message}</div>
      `;
      
      notificationPanel.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        notification.classList.add("fade-out");
        setTimeout(() => {
          notification.remove();
        }, 500);
      }, 5000);
    }

    function updateQuestState(state) {
      currentQuestState = state || { active: [], completed: [] };
      
      // Update tracker panel if visible
      if (questTrackerPanel && currentQuestState.active.length > 0) {
        renderQuestTracker();
      }
    }

    function renderQuestTracker() {
      if (!questTrackerPanel) return;
      
      questTrackerPanel.innerHTML = "";
      
      // Show active quests in tracker
      const displayQuests = currentQuestState.active.slice(0, 3); // Max 3 quests shown
      
      for (const quest of displayQuests) {
        const trackerItem = document.createElement("div");
        trackerItem.className = "tracker-quest-item";
        
        let objectivesHtml = "";
        if (quest.objectives) {
          objectivesHtml = quest.objectives.map(obj => {
            const complete = obj.complete ? "complete" : "";
            return `<div class="tracker-objective ${complete}">${obj.current}/${obj.required} ${obj.description}</div>`;
          }).join("");
        }
        
        trackerItem.innerHTML = `
          <div class="tracker-quest-title">${quest.title || quest.questId}</div>
          <div class="tracker-objectives">${objectivesHtml}</div>
        `;
        
        questTrackerPanel.appendChild(trackerItem);
      }
    }

    function handleQuestAccepted(data) {
      showQuestNotification("Quest Accepted", data.questTitle, "success");
    }

    function handleQuestCompleted(data) {
      let rewardsText = "";
      if (data.rewards) {
        if (data.rewards.exp) {
          rewardsText += ` +${data.rewards.exp} XP`;
        }
        if (data.rewards.items && data.rewards.items.length > 0) {
          const itemNames = data.rewards.items.map(i => i.itemId).join(", ");
          rewardsText += ` +${itemNames}`;
        }
      }
      showQuestNotification("Quest Completed!", `${data.questTitle}${rewardsText}`, "success");
      
      // Re-render quest log and tracker
      if (questPanel && !questPanel.classList.contains("hidden")) {
        renderQuestLog();
      }
    }

    function handleQuestAbandoned(data) {
      showQuestNotification("Quest Abandoned", data.questId, "info");
    }

    return {
      initPanels,
      setQuestPanelVisible,
      toggleQuestPanel,
      showDialogue,
      closeDialogue,
      selectDialogueOption,
      showQuestNotification,
      updateQuestState,
      renderQuestTracker,
      handleQuestAccepted,
      handleQuestCompleted,
      handleQuestAbandoned
    };
  }

  // Export to global scope
  globalScope.__vibemmoCreateQuestUiTools = createQuestUiTools;
})(typeof window !== "undefined" ? window : global);
