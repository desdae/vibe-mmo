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
      maxMana: player.maxMana
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
  if (!itemDef || !itemDef.effect || typeof itemDef.effect.type !== "string") {
    return;
  }
  const effectType = String(itemDef.effect.type).trim().toLowerCase();
  if (effectType !== "heal" && effectType !== "mana") {
    return;
  }
  const effectValue = Math.max(0, Number(itemDef.effect.value) || 0);
  const effectDuration = Math.max(0, Number(itemDef.effect.duration) || 0);
  if (effectValue <= 0) {
    return;
  }
  if (!deps.consumeInventoryItem(player, itemId, 1)) {
    return;
  }

  let healedNow = 0;
  let restoredManaNow = 0;
  let overTime = false;
  if (effectType === "heal") {
    if (effectDuration > 0) {
      overTime = deps.addHealOverTimeEffect(player, effectValue, effectDuration);
    } else {
      const beforeHp = player.hp;
      player.hp = deps.clamp(player.hp + effectValue, 0, player.maxHp);
      healedNow = Math.max(0, player.hp - beforeHp);
    }
  } else if (effectDuration > 0) {
    overTime = deps.addManaOverTimeEffect(player, effectValue, effectDuration);
  } else {
    const beforeMana = player.mana;
    player.mana = deps.clamp(player.mana + effectValue, 0, player.maxMana);
    restoredManaNow = Math.max(0, player.mana - beforeMana);
  }

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
    if (!talentId) {
      return { player };
    }
    const result = deps.spendTalentPoint(player, talentId);
    if (result.success) {
      deps.sendSelfProgress(player);
    } else {
      deps.sendJson(player.ws, {
        type: "talent_error",
        reason: result.reason || "Failed to spend talent point"
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

  return { player };
}

module.exports = {
  routeIncomingMessage
};
