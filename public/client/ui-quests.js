(function initVibeClientQuestUi(globalScope) {
  "use strict";

  function createQuestUiTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const itemDefsById = deps.itemDefsById && typeof deps.itemDefsById.get === "function" ? deps.itemDefsById : null;

    let questPanel = null;
    let questTrackerPanel = null;
    let dialoguePanel = null;
    let notificationPanel = null;

    let currentDialogue = null;
    let currentQuestState = { active: [], completed: [], questNpcMarkers: [] };
    let trackerVisible = true;

    function initPanels(panels) {
      questPanel = panels.questPanel || document.getElementById("quest-panel");
      questTrackerPanel = panels.questTrackerPanel || document.getElementById("quest-tracker-panel");
      dialoguePanel = panels.dialoguePanel || document.getElementById("dialogue-panel");
      notificationPanel = panels.notificationPanel || document.getElementById("notification-panel");

      if (dialoguePanel) {
        const closeBtn = dialoguePanel.querySelector(".dialogue-close-btn");
        if (closeBtn) {
          closeBtn.addEventListener("click", closeDialogue);
        }
      }
    }

    function setQuestPanelVisible(visible) {
      if (!questPanel) {
        return;
      }
      questPanel.classList.toggle("hidden", !visible);
      if (visible) {
        renderQuestLog();
      }
    }

    function toggleQuestPanel() {
      if (!questPanel) {
        return;
      }
      setQuestPanelVisible(questPanel.classList.contains("hidden"));
    }

    function setQuestTrackerVisible(visible) {
      trackerVisible = !!visible;
      renderQuestTracker();
    }

    function toggleQuestTrackerVisible() {
      setQuestTrackerVisible(!trackerVisible);
      return trackerVisible;
    }

    function renderQuestLog() {
      if (!questPanel) {
        return;
      }

      const questList = questPanel.querySelector(".quest-list");
      if (!questList) {
        return;
      }

      questList.innerHTML = "";

      if (currentQuestState.active.length === 0) {
        questList.innerHTML += '<div class="quest-empty">No active quests</div>';
      } else {
        for (const quest of currentQuestState.active) {
          questList.appendChild(createQuestElement(quest, "active"));
        }
      }

      const completedSection = questPanel.querySelector(".completed-quests");
      if (!completedSection) {
        return;
      }
      if (currentQuestState.completed.length === 0) {
        completedSection.innerHTML = '<div class="quest-empty">No completed quests</div>';
        return;
      }
      completedSection.innerHTML = currentQuestState.completed
        .map((questId) => `<div class="quest-completed-item">[done] ${questId}</div>`)
        .join("");
    }

    function getRewardItemName(itemId) {
      const resolvedId = String(itemId || "").trim();
      if (!resolvedId) {
        return "";
      }
      const itemDef = itemDefsById ? itemDefsById.get(resolvedId) : null;
      return String(itemDef && itemDef.name || resolvedId);
    }

    function getRewardLines(rewards) {
      if (!rewards || typeof rewards !== "object") {
        return [];
      }
      const lines = [];
      const exp = Math.max(0, Number(rewards.exp) || 0);
      if (exp > 0) {
        lines.push(`${exp} XP`);
      }
      for (const item of Array.isArray(rewards.items) ? rewards.items : []) {
        const itemId = String(item && item.itemId || "").trim();
        const qty = Math.max(0, Number(item && item.qty) || 0);
        if (!itemId || qty <= 0) {
          continue;
        }
        lines.push(`${qty}x ${getRewardItemName(itemId)}`);
      }
      return lines;
    }

    function createRewardsHtml(rewards, className = "quest-rewards") {
      const rewardLines = getRewardLines(rewards);
      if (!rewardLines.length) {
        return "";
      }
      return `
        <div class="${className}">
          <div class="${className}-title">Rewards</div>
          ${rewardLines.map((line) => `<div class="${className}-item">${line}</div>`).join("")}
        </div>
      `;
    }

    function createQuestElement(quest, status) {
      const div = document.createElement("div");
      div.className = `quest-item quest-${status}`;
      div.dataset.questId = quest.questId;

      const objectivesHtml = Array.isArray(quest.objectives)
        ? quest.objectives
            .map((obj) => {
              const complete = obj.complete ? "complete" : "";
              const icon = obj.complete ? "[x]" : "[ ]";
              return `<div class="quest-objective ${complete}">${icon} ${obj.description}</div>`;
            })
            .join("")
        : "";

      div.innerHTML = `
        <div class="quest-title">${quest.title || quest.questId}</div>
        <div class="quest-description">${quest.description || ""}</div>
        <div class="quest-objectives">${objectivesHtml}</div>
        ${createRewardsHtml(quest.rewards)}
        ${status === "active" ? '<button class="quest-abandon-btn">Abandon</button>' : ""}
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

    function cloneDialogueNodes(dialogue) {
      const nodes = Array.isArray(dialogue && dialogue.nodes) ? dialogue.nodes : [];
      return nodes.map((node, index) => {
        const entry = node && typeof node === "object" ? { ...node } : { text: String(node || "") };
        if (!entry.id) {
          entry.id = `node_${index}`;
        }
        return entry;
      });
    }

    function getCurrentDialogueNode() {
      if (!currentDialogue || !Array.isArray(currentDialogue.nodes) || currentDialogue.nodes.length === 0) {
        return null;
      }
      const currentIndex = Math.max(0, Math.min(Number(currentDialogue.currentIndex) || 0, currentDialogue.nodes.length - 1));
      return currentDialogue.nodes[currentIndex] || null;
    }

    function getDialogueNodeIndexById(nodeId) {
      if (!currentDialogue || !Array.isArray(currentDialogue.nodes)) {
        return -1;
      }
      const targetId = String(nodeId || "").trim();
      if (!targetId) {
        return -1;
      }
      return currentDialogue.nodes.findIndex((node) => String(node && node.id || "") === targetId);
    }

    function getSequentialDialogueIndex() {
      if (!currentDialogue || !Array.isArray(currentDialogue.nodes)) {
        return -1;
      }
      const nextIndex = (Number(currentDialogue.currentIndex) || 0) + 1;
      return nextIndex < currentDialogue.nodes.length ? nextIndex : -1;
    }

    function createDialogueButton(label, handler, extraClassName = "") {
      const button = document.createElement("button");
      button.className = `dialogue-option-btn${extraClassName ? ` ${extraClassName}` : ""}`;
      button.textContent = label;
      button.addEventListener("click", handler);
      return button;
    }

    function closeDialogue() {
      if (!dialoguePanel) {
        return;
      }
      dialoguePanel.classList.add("hidden");
      currentDialogue = null;
    }

    function selectDialogueOption(nodeId) {
      if (typeof deps.sendJson === "function") {
        deps.sendJson({
          type: "quest_select_option",
          nodeId
        });
      }
      closeDialogue();
    }

    function setDialogueNodeIndex(index) {
      if (!currentDialogue) {
        return;
      }
      if (!Number.isFinite(index) || index < 0 || index >= currentDialogue.nodes.length) {
        closeDialogue();
        return;
      }
      currentDialogue.currentIndex = index;
      renderDialogue();
    }

    function handleDialogueChoice(choice) {
      const nextId = String(choice && choice.next || "").trim();
      if (!nextId) {
        closeDialogue();
        return;
      }
      const nextIndex = getDialogueNodeIndexById(nextId);
      if (nextIndex < 0) {
        closeDialogue();
        return;
      }
      setDialogueNodeIndex(nextIndex);
    }

    function renderDialogue() {
      if (!dialoguePanel || !currentDialogue) {
        return;
      }

      const dialogueTitle = dialoguePanel.querySelector(".dialogue-title");
      const dialogueContent = dialoguePanel.querySelector(".dialogue-content");
      const dialogueOptions = dialoguePanel.querySelector(".dialogue-options");
      const node = getCurrentDialogueNode();

      if (dialogueTitle) {
        dialogueTitle.textContent = currentDialogue.npcName || "NPC";
      }
      if (dialogueContent) {
        dialogueContent.innerHTML = "";
        const textEl = document.createElement("div");
        textEl.className = "dialogue-text";
        textEl.textContent = node && node.text ? node.text : "";
        dialogueContent.appendChild(textEl);
        const rewardsHtml = createRewardsHtml(node && node.rewards, "dialogue-rewards");
        if (rewardsHtml) {
          dialogueContent.insertAdjacentHTML("beforeend", rewardsHtml);
        }
      }
      if (dialogueOptions) {
        dialogueOptions.innerHTML = "";

        const choices = Array.isArray(node && node.choices) ? node.choices : [];
        if (choices.length > 0) {
          for (const choice of choices) {
            dialogueOptions.appendChild(
              createDialogueButton(choice.text || "Continue", () => handleDialogueChoice(choice))
            );
          }
        } else if (node && (node.questStart || node.questComplete)) {
          dialogueOptions.appendChild(
            createDialogueButton(
              node.questComplete ? "Complete Quest" : "Accept Quest",
              () => selectDialogueOption(node.id),
              "dialogue-primary-btn"
            )
          );
        } else {
          const nextIndex = getSequentialDialogueIndex();
          if (nextIndex >= 0) {
            dialogueOptions.appendChild(createDialogueButton("Continue", () => setDialogueNodeIndex(nextIndex)));
          }
        }

        dialogueOptions.appendChild(createDialogueButton("Leave", closeDialogue, "dialogue-leave-btn"));
      }

      dialoguePanel.classList.remove("hidden");
    }

    function showDialogue(dialogue) {
      if (!dialoguePanel) {
        return;
      }

      currentDialogue = {
        ...(dialogue || {}),
        nodes: cloneDialogueNodes(dialogue),
        currentIndex: 0
      };

      renderDialogue();
    }

    function showQuestNotification(title, message, type = "info") {
      if (!notificationPanel) {
        return;
      }

      const notification = document.createElement("div");
      notification.className = `quest-notification quest-notification-${type}`;
      notification.innerHTML = `
        <div class="quest-notification-title">${title}</div>
        <div class="quest-notification-message">${message}</div>
      `;

      notificationPanel.appendChild(notification);

      setTimeout(() => {
        notification.classList.add("fade-out");
        setTimeout(() => {
          notification.remove();
        }, 500);
      }, 5000);
    }

    function updateQuestState(state) {
      currentQuestState = {
        active: Array.isArray(state && state.active) ? state.active : [],
        completed: Array.isArray(state && state.completed) ? state.completed : [],
        questNpcMarkers: Array.isArray(state && state.questNpcMarkers) ? state.questNpcMarkers : []
      };

      if (questPanel && !questPanel.classList.contains("hidden")) {
        renderQuestLog();
      }
      if (questTrackerPanel) {
        renderQuestTracker();
      }
    }

    function renderQuestTracker() {
      if (!questTrackerPanel) {
        return;
      }

      const displayQuests = Array.isArray(currentQuestState.active) ? currentQuestState.active : [];
      questTrackerPanel.innerHTML = "";
      questTrackerPanel.classList.toggle("hidden", displayQuests.length === 0 || !trackerVisible);

      for (const quest of displayQuests) {
        const trackerItem = document.createElement("div");
        trackerItem.className = "tracker-quest-item";

        const objectivesHtml = Array.isArray(quest.objectives)
          ? quest.objectives
              .map((obj) => {
                const complete = obj.complete ? "complete" : "";
                return `<div class="tracker-objective ${complete}">${obj.current}/${obj.required} ${obj.description}</div>`;
              })
              .join("")
          : "";

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
        if (Array.isArray(data.rewards.items) && data.rewards.items.length > 0) {
          rewardsText += ` +${data.rewards.items.map((item) => item.itemId).join(", ")}`;
        }
      }
      showQuestNotification("Quest Completed!", `${data.questTitle}${rewardsText}`, "success");

      if (questPanel && !questPanel.classList.contains("hidden")) {
        renderQuestLog();
      }
      if (questTrackerPanel) {
        renderQuestTracker();
      }
    }

    function handleQuestAbandoned(data) {
      showQuestNotification("Quest Abandoned", data.questId, "info");
    }

    function getQuestNpcMarkerState(npcId) {
      const targetId = String(npcId || "").trim();
      if (!targetId) {
        return null;
      }
      const marker = Array.isArray(currentQuestState.questNpcMarkers)
        ? currentQuestState.questNpcMarkers.find((entry) => String(entry && entry.npcId || "") === targetId)
        : null;
      if (!marker) {
        return null;
      }
      return {
        npcId: targetId,
        hasAvailableQuest: !!marker.hasAvailableQuest,
        hasCompletableQuest: !!marker.hasCompletableQuest
      };
    }

    return {
      initPanels,
      setQuestPanelVisible,
      toggleQuestPanel,
      setQuestTrackerVisible,
      toggleQuestTrackerVisible,
      showDialogue,
      closeDialogue,
      selectDialogueOption,
      showQuestNotification,
      updateQuestState,
      renderQuestTracker,
      handleQuestAccepted,
      handleQuestCompleted,
      handleQuestAbandoned,
      getQuestState: () => ({
        active: Array.isArray(currentQuestState.active) ? currentQuestState.active.map((quest) => ({ ...quest })) : [],
        completed: Array.isArray(currentQuestState.completed) ? currentQuestState.completed.slice() : [],
        questNpcMarkers: Array.isArray(currentQuestState.questNpcMarkers)
          ? currentQuestState.questNpcMarkers.map((marker) => ({ ...marker }))
          : []
      }),
      getQuestNpcMarkerState,
      isQuestTrackerVisible: () => trackerVisible,
      getCurrentDialogue: () => {
        if (!currentDialogue) {
          return null;
        }
        const node = getCurrentDialogueNode();
        return {
          npcName: currentDialogue.npcName || "",
          dialogueType: currentDialogue.dialogueType || "",
          questId: currentDialogue.questId || "",
          currentIndex: Number(currentDialogue.currentIndex) || 0,
          visible: !!(dialoguePanel && !dialoguePanel.classList.contains("hidden")),
          node: node ? { ...node } : null
        };
      }
    };
  }

  globalScope.__vibemmoCreateQuestUiTools = createQuestUiTools;
})(typeof window !== "undefined" ? window : global);
