const { createEffectEngine } = require("../gameplay/effects/effect-engine");
const { buildItemUseEffectDefsFromItemDef } = require("../gameplay/effects/item-use-effect-defs");
const { MAX_CHAT_MESSAGE_LENGTH, MAX_PLAYER_LEVEL } = require("../../config/game-constants");
const { sanitizeChatText } = require("./chat-sanitization");

function createJoinedPlayer(ws, msg, deps) {
  const joinResult = deps.createPlayer({
    ws,
    name: msg.name,
    classType: msg.classType,
    isAdmin: msg.isAdmin === true,
    spawn: deps.randomSpawn()
  });
  if (joinResult.error) {
    return joinResult;
  }
  const player = joinResult.player;
  const viewportState =
    typeof deps.updatePlayerViewport === "function"
      ? deps.updatePlayerViewport(player, msg.viewportWidth, msg.viewportHeight)
      : null;

  deps.sendJson(ws, {
    type: "welcome",
    id: player.id,
    selfStatic: {
      id: player.id,
      name: player.name,
      classType: player.classType,
      isAdmin: !!player.isAdmin,
      mana: player.mana,
      maxMana: player.maxMana,
      skills: player.skills && typeof player.skills === "object" ? { ...player.skills } : {}
    },
    map: { width: deps.MAP_WIDTH, height: deps.MAP_HEIGHT },
    visibilityRange: viewportState ? Math.max(1, viewportState.x, viewportState.y) : deps.VISIBILITY_RANGE,
    talentTree: typeof deps.getTalentTreeData === "function" ? deps.getTalentTreeData(player) : null,
    visibilityRangeX: viewportState ? viewportState.x : deps.VISIBILITY_RANGE,
    visibilityRangeY: viewportState ? viewportState.y : deps.VISIBILITY_RANGE,
    equipment: deps.ITEM_CONFIG.clientEquipmentConfig || { itemSlots: [] },
    sounds: deps.buildSoundManifest()
  });

  deps.sendJson(ws, {
    type: "class_defs",
    classes: deps.CLASS_CONFIG.clientClassDefs,
    abilities: deps.ABILITY_CONFIG.clientAbilityDefs
  });
  deps.sendJson(ws, {
    type: "item_defs",
    items: deps.ITEM_CONFIG.clientItemDefs
  });
  deps.sendJson(ws, {
    type: "equipment_config",
    equipment: deps.ITEM_CONFIG.clientEquipmentConfig || { itemSlots: [] }
  });
  deps.sendInventoryState(player);
  deps.sendEquipmentState(player);
  deps.sendSelfProgress(player);

  // Broadcast system message about player joining
  if (typeof deps.broadcastChatMessage === "function") {
    deps.broadcastChatMessage({ name: "System", isAdmin: false }, `${player.name} has joined the game.`);
  }

  return { player };
}

function handleViewportMessage(player, msg, deps) {
  if (!player || typeof deps.updatePlayerViewport !== "function") {
    return;
  }
  deps.updatePlayerViewport(player, msg.viewportWidth, msg.viewportHeight);
}

function handleMoveMessage(player, msg, deps) {
  if (player.hp <= 0) {
    player.input = { dx: 0, dy: 0 };
    return;
  }
  if ((Number(player.stunnedUntil) || 0) > Date.now()) {
    player.input = { dx: 0, dy: 0 };
    return;
  }

  const dx = Number(msg.dx);
  const dy = Number(msg.dy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    deps.sendJson(player.ws, { type: "error", message: "Move requires numeric dx, dy." });
    return;
  }

  const moveX = deps.clamp(dx, -1, 1);
  const moveY = deps.clamp(dy, -1, 1);
  const normalized = deps.normalizeDirection(moveX, moveY);
  if (!normalized) {
    player.input = { dx: 0, dy: 0 };
    return;
  }

  if (player.activeCast) {
    deps.clearPlayerCast(player);
  }
  player.input = normalized;
  player.lastDirection = normalized;
}

function handleUseItemMessage(player, msg, deps) {
  if (player.hp <= 0) {
    return;
  }

  const itemId = String(msg.itemId || "").trim();
  if (!itemId) {
    return;
  }
  const itemDef = deps.ITEM_CONFIG.itemDefs.get(itemId);
  const effectDefs = buildItemUseEffectDefsFromItemDef(itemDef);
  if (!effectDefs.length) {
    return;
  }
  const effectType = String(effectDefs[0].type || "").trim().toLowerCase();
  const effectValue = Math.max(0, Number(effectDefs[0].amount) || 0);
  const effectDuration = Math.max(0, Number(effectDefs[0].duration) || 0);
  if (!deps.consumeInventoryItem(player, itemId, 1)) {
    return;
  }

  let healedNow = 0;
  let restoredManaNow = 0;
  let overTime = false;

  const effectEngine = createEffectEngine({ clamp: deps.clamp });
  const compiled = effectEngine.compile(effectDefs, { defaultTrigger: "onUse" });
  effectEngine.run(compiled, "onUse", {
    now: Date.now(),
    source: { id: player.id },
    target: player,
    ops: {
      applyHeal: (target, amount, durationSec) => {
        if (!target) {
          return;
        }
        if ((Number(durationSec) || 0) > 0) {
          // `amount` is total value across `durationSec`, matching existing potion behavior.
          overTime = deps.addHealOverTimeEffect(target, amount, durationSec) || overTime;
          return;
        }
        const beforeHp = target.hp;
        target.hp = deps.clamp(target.hp + amount, 0, target.maxHp);
        healedNow += Math.max(0, target.hp - beforeHp);
      },
      applyMana: (target, amount, durationSec) => {
        if (!target) {
          return;
        }
        if ((Number(durationSec) || 0) > 0) {
          overTime = deps.addManaOverTimeEffect(target, amount, durationSec) || overTime;
          return;
        }
        const beforeMana = target.mana;
        target.mana = deps.clamp(target.mana + amount, 0, target.maxMana);
        restoredManaNow += Math.max(0, target.mana - beforeMana);
      }
    }
  });

  deps.sendInventoryState(player);
  deps.syncPlayerCopperFromInventory(player, true);
  deps.sendJson(player.ws, {
    type: "item_used",
    itemId,
    hp: player.hp,
    mana: player.mana,
    effectType,
    healed: healedNow,
    restoredMana: restoredManaNow,
    overTime,
    effectValue,
    effectDuration
  });
}

function sendAdminBotList(player, deps) {
  deps.sendJson(player.ws, {
    type: "admin_bot_list",
    bots: typeof deps.listBots === "function" ? deps.listBots() : []
  });
}

function sendAdminBotInspect(player, botData, deps) {
  deps.sendJson(player.ws, {
    type: "admin_bot_inspect",
    bot: botData || null
  });
}

function handleQuestNpcInteraction(player, npcId, deps, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const sendNoQuestDialogue = opts.sendNoQuestDialogue !== false;
  const npc = deps.getQuestNpc(npcId);
  if (!npc || !deps.isPlayerNearNpc(player, npcId)) {
    return false;
  }

  const talkQuest = deps.questTools.getTalkQuestForNpc(player, npcId);
  if (talkQuest && talkQuest.objective && talkQuest.objective.type === "talk") {
    const updatedQuestIds = deps.updateQuestObjective(player, "talk", npcId, 1);
    if (Array.isArray(updatedQuestIds) && updatedQuestIds.length > 0) {
      deps.sendSelfProgress(player);
    }
  }
  if (!sendNoQuestDialogue && !talkQuest) {
    return true;
  }

  const dialogue = deps.dialogueTools.startDialogue(player.id, player, npcId);
  if (
    dialogue &&
    !dialogue.error &&
    (sendNoQuestDialogue || String(dialogue.dialogueType || "") !== "noQuest")
  ) {
    deps.sendJson(player.ws, {
      type: "quest_dialogue",
      ...dialogue
    });
  }
  return true;
}

function routeIncomingMessage({ rawMessage, ws, player, deps }) {
  let msg;
  try {
    msg = JSON.parse(String(rawMessage));
  } catch (_error) {
    deps.sendJson(ws, { type: "error", message: "Invalid JSON." });
    return { player };
  }

  if (!msg || typeof msg.type !== "string") {
    deps.sendJson(ws, { type: "error", message: "Invalid message shape." });
    return { player };
  }

  if (msg.type === "join") {
    if (player) {
      deps.sendJson(ws, { type: "error", message: "Already joined." });
      return { player };
    }
    const joinResult = createJoinedPlayer(ws, msg, deps);
    if (joinResult.error) {
      deps.sendJson(ws, { type: "error", message: joinResult.error });
      return { player };
    }
    return { player: joinResult.player };
  }

  if (!player) {
    deps.sendJson(ws, { type: "error", message: "Must join first." });
    return { player };
  }

  if (msg.type === "move") {
    handleMoveMessage(player, msg, deps);
    return { player };
  }

  if (msg.type === "viewport") {
    handleViewportMessage(player, msg, deps);
    return { player };
  }

  if (msg.type === "use_ability") {
    const abilityId = String(msg.abilityId || "").trim();
    const dx = Number(msg.dx);
    const dy = Number(msg.dy);
    const distance = Number(msg.distance);
    if (!abilityId || !Number.isFinite(dx) || !Number.isFinite(dy)) {
      return { player };
    }
    deps.usePlayerAbility(player, abilityId, dx, dy, Number.isFinite(distance) ? distance : null);
    return { player };
  }

  if (msg.type === "update_cast_target") {
    const dx = Number(msg.dx);
    const dy = Number(msg.dy);
    const distance = Number(msg.distance);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return { player };
    }
    deps.updatePlayerCastTarget(player, dx, dy, Number.isFinite(distance) ? distance : null);
    return { player };
  }

  if (msg.type === "level_up_ability") {
    const abilityId = String(msg.abilityId || "").trim();
    if (!abilityId) {
      return { player };
    }
    if (deps.levelUpPlayerAbility(player, abilityId)) {
      deps.sendSelfProgress(player);
    }
    return { player };
  }

  if (msg.type === "spend_talent_point") {
    const talentId = String(msg.talentId || "").trim();
    console.log('[router] spend_talent_point message received:', talentId);
    if (!talentId) {
      console.log('[router] No talentId provided');
      return { player };
    }
    const result = deps.spendTalentPoint(player, talentId);
    console.log('[router] spendTalentPoint result:', result);
    if (result.success) {
      console.log('[router] Sending self_progress');
      deps.sendSelfProgress(player);
    } else {
      console.log('[router] Sending talent_error:', result.reason);
      deps.sendJson(player.ws, {
        type: "talent_error",
        reason: result.reason || "Failed to spend talent point"
      });
    }
    return { player };
  }

  if (msg.type === "get_talent_tree") {
    console.log('[router] get_talent_tree requested');
    const talentTree = deps.getTalentTreeData(player);
    if (talentTree) {
      console.log('[router] Sending talent_tree with', talentTree.availablePoints, 'points');
      deps.sendJson(player.ws, {
        type: "talent_update",
        talentTree
      });
    }
    return { player };
  }

  if (msg.type === "cast") {
    const dx = Number(msg.dx);
    const dy = Number(msg.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return { player };
    }
    deps.usePlayerAbility(player, "fireball", dx, dy);
    return { player };
  }

  if (msg.type === "melee_attack") {
    const dx = Number(msg.dx);
    const dy = Number(msg.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return { player };
    }
    deps.usePlayerAbility(player, "slash", dx, dy);
    return { player };
  }

  if (msg.type === "pickup_bag") {
    if (player.hp <= 0) {
      return { player };
    }
    const targetX = Number(msg.x);
    const targetY = Number(msg.y);
    deps.tryPickupLootBag(player, targetX, targetY);
    return { player };
  }

  if (msg.type === "interact_resource") {
    if (player.hp <= 0) {
      return { player };
    }
    const result = deps.interactWithResourceNode(player, {
      id: msg.resourceNodeId,
      x: Number(msg.x),
      y: Number(msg.y)
    });
    if (!result || !result.ok) {
      deps.sendJson(player.ws, {
        type: "resource_gather_error",
        message: result && result.message ? result.message : "Could not gather that resource."
      });
    }
    return { player };
  }

  if (msg.type === "craft_recipe") {
    const recipeId = String(msg.recipeId || "").trim();
    const times = Math.max(1, Math.floor(Number(msg.times) || 1));
    if (!recipeId || typeof deps.craftRecipe !== "function") {
      return { player };
    }
    const result = deps.craftRecipe(player, recipeId, times);
    if (!result || !result.ok) {
      deps.sendJson(player.ws, {
        type: "craft_result",
        ok: false,
        recipeId,
        message: result && result.message ? result.message : "Could not craft that item."
      });
    }
    return { player };
  }

  if (msg.type === "sell_inventory_item") {
    const inventoryIndex = Math.floor(Number(msg.inventoryIndex));
    const vendorId = String(msg.vendorId || "").trim();
    if (!Number.isFinite(inventoryIndex)) {
      return { player };
    }
    const result = deps.sellInventoryItemToVendor(player, inventoryIndex, vendorId || null);
    if (!result || !result.ok) {
      deps.sendJson(player.ws, {
        type: "vendor_sale_result",
        ok: false,
        inventoryIndex,
        message: result && result.message ? result.message : "Could not sell item."
      });
    }
    return { player };
  }

  if (msg.type === "inventory_move") {
    const from = Math.floor(Number(msg.from));
    const to = Math.floor(Number(msg.to));
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return { player };
    }
    if (deps.mergeOrSwapInventorySlots(player, from, to)) {
      deps.sendInventoryState(player);
    }
    return { player };
  }

  if (msg.type === "equip_item") {
    const inventoryIndex = Math.floor(Number(msg.inventoryIndex));
    const slotId = String(msg.slot || "").trim();
    if (!Number.isFinite(inventoryIndex) || !slotId) {
      return { player };
    }
    if (deps.equipInventoryItem(player, inventoryIndex, slotId)) {
      deps.sendInventoryState(player);
      deps.sendEquipmentState(player);
    }
    return { player };
  }

  if (msg.type === "unequip_item") {
    const slotId = String(msg.slot || "").trim();
    const targetIndex = Number.isFinite(Number(msg.targetIndex)) ? Math.floor(Number(msg.targetIndex)) : null;
    if (!slotId) {
      return { player };
    }
    if (deps.unequipEquipmentItem(player, slotId, targetIndex)) {
      deps.sendInventoryState(player);
      deps.sendEquipmentState(player);
    }
    return { player };
  }

  if (msg.type === "use_item") {
    handleUseItemMessage(player, msg, deps);
    return { player };
  }

  if (msg.type === "admin_grant_equipment_item") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    if (typeof deps.rollEquipmentItemAt !== "function") {
      deps.sendJson(player.ws, { type: "error", message: "Equipment roll unavailable." });
      return { player };
    }

    const minAffixes = Math.max(0, Math.floor(Number(msg.minAffixes) || 0));
    const maxAttempts = 300;
    let rolled = null;
    let bestAffixCount = -1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = deps.rollEquipmentItemAt(player.x, player.y);
      if (!candidate) {
        continue;
      }
      const affixCount = Array.isArray(candidate.affixes) ? candidate.affixes.length : 0;
      if (affixCount > bestAffixCount) {
        rolled = candidate;
        bestAffixCount = affixCount;
      }
      if (affixCount >= minAffixes) {
        rolled = candidate;
        bestAffixCount = affixCount;
        break;
      }
    }

    if (!rolled) {
      deps.sendJson(player.ws, { type: "error", message: "Failed to roll equipment item." });
      return { player };
    }
    if (bestAffixCount < minAffixes) {
      deps.sendJson(player.ws, {
        type: "error",
        message: `Failed to roll equipment with at least ${minAffixes} affixes.`
      });
      return { player };
    }

    const addResult = deps.addItemsToInventory(player, [rolled]);
    if (!addResult || addResult.changed !== true) {
      deps.sendJson(player.ws, { type: "error", message: "Inventory full." });
      return { player };
    }

    deps.sendInventoryState(player);
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      message: `Granted ${String(rolled.name || rolled.itemId || "equipment")}.`
    });
    return { player };
  }

  if (msg.type === "admin_grant_item") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const itemId = String(msg.itemId || "").trim();
    const qty = Math.max(1, Math.floor(Number(msg.qty) || 1));
    const itemDef = deps.ITEM_CONFIG && deps.ITEM_CONFIG.itemDefs instanceof Map
      ? deps.ITEM_CONFIG.itemDefs.get(itemId)
      : null;
    if (!itemDef) {
      deps.sendJson(player.ws, { type: "error", message: "Unknown item." });
      return { player };
    }
    const result = deps.addItemsToInventory(player, [{ itemId, qty }]);
    deps.sendInventoryState(player);
    deps.syncPlayerCopperFromInventory(player, true);
    deps.sendSelfProgress(player);
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      ok: !!(result && Array.isArray(result.added) && result.added.length > 0),
      action: "grant_item",
      itemId,
      qty
    });
    return { player };
  }

  if (msg.type === "admin_set_level") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const requested = Math.floor(Number(msg.level) || 0);
    const level = deps.clamp
      ? deps.clamp(requested, 1, MAX_PLAYER_LEVEL)
      : Math.max(1, Math.min(MAX_PLAYER_LEVEL, requested));
    player.level = level;
    player.exp = 0;
    if (typeof deps.expNeededForLevel === "function") {
      player.expToNext = deps.expNeededForLevel(player.level);
    }
    player.skillPoints = deps.clamp ? deps.clamp(player.level - 1, 0, 65535) : Math.max(0, player.level - 1);

    const talentTree = typeof deps.getTalentTreeData === "function" ? deps.getTalentTreeData(player) : null;
    if (talentTree) {
      player.talentPoints = Math.max(0, Math.floor(Number(talentTree.availablePoints) || 0));
      deps.sendJson(player.ws, {
        type: "talent_update",
        talentTree
      });
    }

    deps.sendSelfProgress(player);
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      message: `Level set to ${player.level}.`
    });
    return { player };
  }

  if (msg.type === "admin_complete_quest") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const questId = String(msg.questId || "").trim();
    if (!questId) {
      return { player };
    }
    const result = typeof deps.debugCompleteQuest === "function"
      ? deps.debugCompleteQuest(player, questId)
      : { success: false, reason: "Quest debug tools unavailable." };
    if (!result || !result.success) {
      deps.sendJson(player.ws, {
        type: "error",
        message: result && result.reason ? String(result.reason) : "Failed to complete quest objectives."
      });
      return { player };
    }
    deps.sendSelfProgress(player);
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      message: `Marked quest objectives complete for ${questId}.`
    });
    return { player };
  }

  if (msg.type === "create_bot_player") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const createResult = deps.createBotPlayer({
      classType: msg.classType,
      ownerPlayerId: player.id
    });
    if (createResult.error) {
      deps.sendJson(player.ws, { type: "error", message: createResult.error });
      return { player };
    }
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      message: `Created ${createResult.player.name} (${createResult.player.classType}).`
    });
    sendAdminBotList(player, deps);
    sendAdminBotInspect(player, deps.inspectBot(createResult.player.id), deps);
    return { player };
  }

  if (msg.type === "admin_spawn_benchmark_scene") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const result = deps.createBenchmarkScene ? deps.createBenchmarkScene(player.id) : { ok: false, error: "Benchmark scene unavailable." };
    if (!result || result.ok !== true) {
      deps.sendJson(player.ws, {
        type: "error",
        message: result && result.error ? String(result.error) : "Failed to create benchmark scene."
      });
      return { player };
    }
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      message: `Benchmark scene ready (${result.botCount} bots, ${result.mobCount} mobs).`
    });
    return { player };
  }

  if (msg.type === "admin_list_bots") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    sendAdminBotList(player, deps);
    return { player };
  }

  if (msg.type === "admin_inspect_bot") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const botId = String(msg.botId || "").trim();
    if (!botId) {
      return { player };
    }
    sendAdminBotInspect(player, deps.inspectBot(botId), deps);
    return { player };
  }

  if (msg.type === "admin_destroy_bot") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const botId = String(msg.botId || "").trim();
    if (!botId) {
      return { player };
    }
    const destroyed = deps.destroyBot(botId);
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      message: destroyed ? "Bot destroyed." : "Bot not found."
    });
    sendAdminBotList(player, deps);
    sendAdminBotInspect(player, destroyed ? null : deps.inspectBot(botId), deps);
    return { player };
  }

  if (msg.type === "admin_command_bot_follow") {
    if (!player.isAdmin) {
      deps.sendJson(player.ws, { type: "error", message: "Admin rights required." });
      return { player };
    }
    const botId = String(msg.botId || "").trim();
    if (!botId) {
      return { player };
    }
    const followRange = Number(msg.range);
    let changed = false;
    if (Number.isFinite(followRange) && followRange > 0) {
      changed = deps.setBotFollow(botId, player.id, followRange);
    } else {
      changed = deps.clearBotFollow(botId);
    }
    deps.sendJson(player.ws, {
      type: "admin_action_result",
      message: changed
        ? Number.isFinite(followRange) && followRange > 0
          ? `Bot now follows at ${followRange.toFixed(1)} tiles.`
          : "Bot follow cleared."
        : "Bot not found."
    });
    sendAdminBotList(player, deps);
    sendAdminBotInspect(player, deps.inspectBot(botId), deps);
    return { player };
  }

  if (msg.type === "chat_message") {
    if (player.hp <= 0) {
      return { player };
    }
    const text = sanitizeChatText(msg.text, MAX_CHAT_MESSAGE_LENGTH);
    if (!text) {
      return { player };
    }

    // Broadcast chat message to all players
    deps.broadcastChatMessage(player, text);
    return { player };
  }

  // Quest message handlers
  if (msg.type === "quest_interact") {
    const npcId = String(msg.npcId || "").trim();
    if (!npcId) {
      return { player };
    }
    handleQuestNpcInteraction(player, npcId, deps, { sendNoQuestDialogue: true });
    return { player };
  }

  if (msg.type === "talk_to_npc") {
    const npcId = String(msg.npcId || "").trim();
    if (!npcId) {
      return { player };
    }
    handleQuestNpcInteraction(player, npcId, deps, { sendNoQuestDialogue: false });
    return { player };
  }

  if (msg.type === "quest_select_option") {
    const nodeId = String(msg.nodeId || "").trim();
    if (!nodeId) {
      return { player };
    }
    
    const result = deps.dialogueTools.selectDialogueOption(player.id, player, nodeId);
    if (result.error) {
      deps.sendJson(player.ws, {
        type: "quest_dialogue_error",
        message: result.error
      });
    } else if (result.questAccepted) {
      deps.sendJson(player.ws, {
        type: "quest_accepted",
        questId: result.questId,
        questTitle: result.questTitle
      });
      deps.sendSelfProgress(player);
    } else if (result.questCompleted) {
      deps.sendJson(player.ws, {
        type: "quest_completed",
        questId: result.questId,
        questTitle: result.questTitle,
        rewards: result.rewards
      });
      deps.sendSelfProgress(player);
    }
    return { player };
  }

  if (msg.type === "abandon_quest") {
    const questId = String(msg.questId || "").trim();
    if (!questId) {
      return { player };
    }
    
    const result = deps.abandonQuest(player, questId);
    if (result.success) {
      deps.sendSelfProgress(player);
      deps.sendJson(player.ws, {
        type: "quest_abandoned",
        questId
      });
    }
    return { player };
  }

  return { player };
}

module.exports = {
  routeIncomingMessage
};
