function createBotTickSystem(options = {}) {
  const players = options.players instanceof Map ? options.players : null;
  const mobs = options.mobs instanceof Map ? options.mobs : null;
  const lootBags = options.lootBags instanceof Map ? options.lootBags : null;
  const activeAreaEffects = options.activeAreaEffects instanceof Map ? options.activeAreaEffects : null;
  const projectiles = options.projectiles instanceof Map ? options.projectiles : null;
  const itemDefs = options.itemDefs;
  const createPlayer = typeof options.createPlayer === "function" ? options.createPlayer : null;
  const classConfigProvider =
    typeof options.classConfigProvider === "function" ? options.classConfigProvider : () => null;
  const abilityDefsProvider =
    typeof options.abilityDefsProvider === "function" ? options.abilityDefsProvider : () => new Map();
  const getAbilityRangeForLevel =
    typeof options.getAbilityRangeForLevel === "function" ? options.getAbilityRangeForLevel : () => 0;
  const usePlayerAbility = typeof options.usePlayerAbility === "function" ? options.usePlayerAbility : () => false;
  const tryPickupLootBag = typeof options.tryPickupLootBag === "function" ? options.tryPickupLootBag : () => false;
  const equipInventoryItem = typeof options.equipInventoryItem === "function" ? options.equipInventoryItem : () => false;
  const randomPointInRadius =
    typeof options.randomPointInRadius === "function" ? options.randomPointInRadius : (x, y) => ({ x, y });
  const distance = typeof options.distance === "function" ? options.distance : () => Infinity;
  const normalizeDirection =
    typeof options.normalizeDirection === "function" ? options.normalizeDirection : () => null;
  const centerX = Number(options.centerX) || 0;
  const centerY = Number(options.centerY) || 0;
  const spawnRadius = Math.max(1, Number(options.spawnRadius) || 6);
  const bagPickupRange = Math.max(0.1, Number(options.bagPickupRange) || 1.5);
  const visibilityRange = Math.max(4, Number(options.visibilityRange) || 20);

  if (!players || !mobs || !lootBags || !activeAreaEffects || !projectiles || !createPlayer) {
    throw new Error("createBotTickSystem requires maps and createPlayer");
  }

  const rarityRank = Object.freeze({
    normal: 0,
    magic: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5,
    divine: 6
  });
  let nextBotIndex = 1;

  function getCompatibleEquipmentSlots(slotId) {
    const normalized = String(slotId || "").trim();
    if (normalized === "ring") {
      return ["ring1", "ring2"];
    }
    if (normalized === "trinket") {
      return ["trinket1", "trinket2"];
    }
    return normalized ? [normalized] : [];
  }

  function getPlayerDisplayName(playerId) {
    const player = players.get(String(playerId || "")) || null;
    return player ? String(player.name || "") : "";
  }

  function getEntryScore(entry) {
    if (!entry || typeof entry !== "object") {
      return -Infinity;
    }
    const itemLevel = Math.max(0, Number(entry.itemLevel) || 0);
    const rarity = String(entry.rarity || "").trim().toLowerCase();
    const affixCount = Array.isArray(entry.affixes) ? entry.affixes.length : 0;
    let modifierWeight = 0;
    for (const affix of Array.isArray(entry.affixes) ? entry.affixes : []) {
      for (const modifier of Array.isArray(affix.modifiers) ? affix.modifiers : []) {
        modifierWeight += Math.abs(Number(modifier.value) || 0);
      }
    }
    return itemLevel * 100 + (rarityRank[rarity] || 0) * 1000 + affixCount * 40 + modifierWeight;
  }

  function chooseEquipmentSlotForEntry(player, entry) {
    const candidateSlots = getCompatibleEquipmentSlots(entry && entry.slot);
    if (!candidateSlots.length) {
      return "";
    }

    let bestSlot = "";
    let bestGain = -Infinity;
    for (const slotId of candidateSlots) {
      const equipped = player.equipmentSlots && player.equipmentSlots[slotId] ? player.equipmentSlots[slotId] : null;
      const gain = getEntryScore(entry) - getEntryScore(equipped);
      if (!equipped) {
        return slotId;
      }
      if (gain > bestGain) {
        bestGain = gain;
        bestSlot = slotId;
      }
    }
    return bestGain > 0 ? bestSlot : "";
  }

  function autoEquipBot(player) {
    if (!player || !Array.isArray(player.inventorySlots)) {
      return false;
    }
    let changed = false;
    let keepScanning = true;
    while (keepScanning) {
      keepScanning = false;
      for (let index = 0; index < player.inventorySlots.length; index += 1) {
        const entry = player.inventorySlots[index];
        if (!entry || !entry.isEquipment) {
          continue;
        }
        const slotId = chooseEquipmentSlotForEntry(player, entry);
        if (!slotId) {
          continue;
        }
        if (equipInventoryItem(player, index, slotId)) {
          changed = true;
          keepScanning = true;
          break;
        }
      }
    }
    return changed;
  }

  function findNearestLootBag(player, maxRange = 12) {
    let nearest = null;
    let nearestDistance = Math.max(0.1, Number(maxRange) || 12);
    for (const bag of lootBags.values()) {
      const d = distance(player, bag);
      if (d < nearestDistance) {
        nearest = bag;
        nearestDistance = d;
      }
    }
    return { bag: nearest, distance: nearestDistance };
  }

  function findNearestMob(player, maxRange = Infinity) {
    let nearest = null;
    let nearestDistance = Number.isFinite(Number(maxRange)) ? Math.max(0.5, Number(maxRange) || visibilityRange + 6) : Infinity;
    for (const mob of mobs.values()) {
      if (!mob || !mob.alive) {
        continue;
      }
      const d = distance(player, mob);
      if (d < nearestDistance) {
        nearest = mob;
        nearestDistance = d;
      }
    }
    return { mob: nearest, distance: nearestDistance };
  }

  function countNearbyMobs(player, maxRange = 2.25) {
    let total = 0;
    for (const mob of mobs.values()) {
      if (!mob || !mob.alive) {
        continue;
      }
      if (distance(player, mob) <= maxRange) {
        total += 1;
      }
    }
    return total;
  }

  function hasActiveOwnedSummon(player, abilityId, now) {
    for (const effect of activeAreaEffects.values()) {
      if (!effect || String(effect.kind || "") !== "summon") {
        continue;
      }
      if (String(effect.ownerId || "") !== String(player.id || "")) {
        continue;
      }
      if (String(effect.abilityId || "") !== String(abilityId || "")) {
        continue;
      }
      if (Number(effect.endsAt) > now + 1000) {
        return true;
      }
    }
    return false;
  }

  function tryUseBotAbility(player, abilityId, target, targetDistance, now) {
    const dx = Number(target?.x) - Number(player.x);
    const dy = Number(target?.y) - Number(player.y);
    const direction = normalizeDirection(dx, dy) || normalizeDirection(player.lastDirection?.dx, player.lastDirection?.dy);
    if (!direction) {
      return false;
    }
    player.input = { dx: 0, dy: 0 };
    return usePlayerAbility(player, abilityId, direction.dx, direction.dy, targetDistance);
  }

  function tryUseMageAbilities(player, target, targetDistance, now) {
    const abilityDefs = abilityDefsProvider();
    if (player.abilityLevels.get("fireHydra") > 0) {
      const hydraDef = abilityDefs.get("fireHydra");
      const hydraRange = hydraDef ? getAbilityRangeForLevel(hydraDef, player.abilityLevels.get("fireHydra")) : 0;
      if (hydraDef && targetDistance <= hydraRange && !hasActiveOwnedSummon(player, "fireHydra", now)) {
        if (tryUseBotAbility(player, "fireHydra", target, targetDistance, now)) {
          return true;
        }
      }
    }

    const orderedAbilities = ["chainLightning", "lightningBeam", "fireball", "frostbolt", "arcaneMissiles", "blizzard"];
    for (const abilityId of orderedAbilities) {
      const abilityLevel = Math.max(0, Number(player.abilityLevels.get(abilityId) || 0));
      if (abilityLevel <= 0) {
        continue;
      }
      const abilityDef = abilityDefs.get(abilityId);
      if (!abilityDef) {
        continue;
      }
      const range = Math.max(0.5, getAbilityRangeForLevel(abilityDef, abilityLevel));
      if (targetDistance > range) {
        continue;
      }
      if (abilityId === "blizzard" && countNearbyMobs(target, Math.max(abilityDef.areaRadius || 0, 2)) < 2) {
        continue;
      }
      if (tryUseBotAbility(player, abilityId, target, targetDistance, now)) {
        return true;
      }
    }

    return false;
  }

  function tryUseWarriorAbilities(player, target, targetDistance, now) {
    const nearbyCount = countNearbyMobs(player, 2.4);
    if (nearbyCount >= 2 && player.abilityLevels.get("warstomp") > 0) {
      const stompDirection =
        normalizeDirection(Number(target.x) - Number(player.x), Number(target.y) - Number(player.y)) ||
        normalizeDirection(player.lastDirection?.dx, player.lastDirection?.dy);
      if (stompDirection) {
        player.input = { dx: 0, dy: 0 };
        if (usePlayerAbility(player, "warstomp", stompDirection.dx, stompDirection.dy, targetDistance)) {
          return true;
        }
      }
    }

    if (player.abilityLevels.get("slash") > 0 && targetDistance <= 1.95) {
      return tryUseBotAbility(player, "slash", target, targetDistance, now);
    }
    return false;
  }

  function updateBotMovementToward(player, target, desiredDistance = 0.5) {
    if (!player || !target) {
      return;
    }
    const dx = Number(target.x) - Number(player.x);
    const dy = Number(target.y) - Number(player.y);
    const dist = Math.hypot(dx, dy);
    if (!dist || dist <= Math.max(0, Number(desiredDistance) || 0)) {
      player.input = { dx: 0, dy: 0 };
      return;
    }
    const direction = normalizeDirection(dx, dy);
    player.input = direction || { dx: 0, dy: 0 };
    if (direction) {
      player.lastDirection = direction;
    }
  }

  function serializeItemEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const itemId = String(entry.itemId || "").trim();
    const itemDef = itemDefs && typeof itemDefs.get === "function" ? itemDefs.get(itemId) || null : null;
    return {
      itemId,
      name: String(entry.name || (itemDef ? itemDef.name : itemId)),
      qty: Math.max(0, Math.floor(Number(entry.qty) || 0)),
      rarity: String(entry.rarity || ""),
      slot: String(entry.slot || ""),
      itemLevel: Math.max(0, Math.floor(Number(entry.itemLevel) || 0)),
      isEquipment: !!entry.isEquipment
    };
  }

  function buildBotSummary(bot) {
    const followTargetPlayerId = String(bot?.botState?.followTargetPlayerId || "");
    return {
      id: String(bot.id || ""),
      name: String(bot.name || ""),
      classType: String(bot.classType || ""),
      level: Math.max(1, Math.floor(Number(bot.level) || 1)),
      hp: Math.max(0, Number(bot.hp) || 0),
      maxHp: Math.max(1, Number(bot.maxHp) || 1),
      followTargetPlayerId,
      followTargetName: getPlayerDisplayName(followTargetPlayerId),
      followDistance: Math.max(0, Number(bot?.botState?.followDistance) || 0)
    };
  }

  function listBots() {
    const bots = [];
    for (const player of players.values()) {
      if (!player || !player.isBot) {
        continue;
      }
      bots.push(buildBotSummary(player));
    }
    bots.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return bots;
  }

  function getBotById(botId) {
    const bot = players.get(String(botId || "")) || null;
    return bot && bot.isBot ? bot : null;
  }

  function inspectBot(botId) {
    const bot = getBotById(botId);
    if (!bot) {
      return null;
    }
    const abilityLevels = Array.from(bot.abilityLevels.entries())
      .map(([id, level]) => ({
        id: String(id || ""),
        level: Math.max(1, Math.floor(Number(level) || 1))
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const inventory = Array.isArray(bot.inventorySlots)
      ? bot.inventorySlots.map(serializeItemEntry).filter(Boolean)
      : [];
    const equipment = [];
    for (const [slotId, entry] of Object.entries(bot.equipmentSlots && typeof bot.equipmentSlots === "object" ? bot.equipmentSlots : {})) {
      const serialized = serializeItemEntry(entry);
      if (!serialized) {
        continue;
      }
      equipment.push({
        slotId,
        item: serialized
      });
    }
    equipment.sort((a, b) => String(a.slotId || "").localeCompare(String(b.slotId || "")));
    return {
      ...buildBotSummary(bot),
      skillPoints: Math.max(0, Math.floor(Number(bot.skillPoints) || 0)),
      copper: Math.max(0, Number(bot.copper) || 0),
      exp: Math.max(0, Number(bot.exp) || 0),
      expToNext: Math.max(1, Number(bot.expToNext) || 1),
      abilityLevels,
      inventory,
      equipment
    };
  }

  function removeBotOwnedEntities(botId) {
    const ownerId = String(botId || "");
    for (const [projectileId, projectile] of projectiles.entries()) {
      if (String(projectile && projectile.ownerId || "") === ownerId) {
        projectiles.delete(projectileId);
      }
    }
    for (const [effectId, effect] of activeAreaEffects.entries()) {
      if (String(effect && effect.ownerId || "") === ownerId) {
        activeAreaEffects.delete(effectId);
      }
    }
  }

  function destroyBot(botId) {
    const bot = getBotById(botId);
    if (!bot) {
      return false;
    }
    players.delete(bot.id);
    removeBotOwnedEntities(bot.id);
    return true;
  }

  function setBotFollow(botId, leaderPlayerId, followDistance) {
    const bot = getBotById(botId);
    const leaderId = String(leaderPlayerId || "");
    const leader = players.get(leaderId) || null;
    if (!bot || !leader || bot.id === leader.id) {
      return false;
    }
    bot.botState.followTargetPlayerId = leader.id;
    bot.botState.followDistance = Math.max(0, Number(followDistance) || 0);
    return true;
  }

  function clearBotFollow(botId) {
    const bot = getBotById(botId);
    if (!bot) {
      return false;
    }
    bot.botState.followTargetPlayerId = "";
    bot.botState.followDistance = 0;
    return true;
  }

  function tickBot(player, now = Date.now()) {
    if (!player || !player.isBot || !player.botState) {
      return;
    }
    if (player.hp <= 0) {
      player.input = { dx: 0, dy: 0 };
      return;
    }
    if (player.activeCast) {
      player.input = { dx: 0, dy: 0 };
      return;
    }
    if (Number(player.botState.nextDecisionAt) > now) {
      return;
    }
    player.botState.nextDecisionAt = now + 120;

    if (Number(player.botState.nextEquipCheckAt) <= now) {
      autoEquipBot(player);
      player.botState.nextEquipCheckAt = now + 1200;
    }

    const followTarget =
      player.botState.followTargetPlayerId ? players.get(String(player.botState.followTargetPlayerId)) || null : null;
    const followDistance = Math.max(0, Number(player.botState.followDistance) || 0);
    if (followTarget && followTarget.hp > 0) {
      const distanceToLeader = distance(player, followTarget);
      const nearestMobToLeader = findNearestMob(followTarget, visibilityRange);
      if (distanceToLeader > followDistance + 0.9) {
        updateBotMovementToward(player, followTarget, followDistance || 3.5);
        return;
      }
      if (nearestMobToLeader.mob && nearestMobToLeader.distance <= visibilityRange) {
        const combatTarget = nearestMobToLeader.mob;
        const combatDistance = distance(player, combatTarget);
        let followedAttackUsed = false;
        if (String(player.classType || "").toLowerCase() === "mage") {
          followedAttackUsed = tryUseMageAbilities(player, combatTarget, combatDistance, now);
          if (!followedAttackUsed && combatDistance > 6.5) {
            updateBotMovementToward(player, combatTarget, 6);
            return;
          }
        } else {
          followedAttackUsed = tryUseWarriorAbilities(player, combatTarget, combatDistance, now);
          if (!followedAttackUsed && combatDistance > 1.6) {
            updateBotMovementToward(player, combatTarget, 1.4);
            return;
          }
        }
        if (followedAttackUsed) {
          player.input = { dx: 0, dy: 0 };
          return;
        }
      }
      if (distanceToLeader > followDistance + 0.25) {
        updateBotMovementToward(player, followTarget, followDistance || 3.5);
      } else {
        player.input = { dx: 0, dy: 0 };
      }
      return;
    } else if (followTarget && followTarget.hp <= 0) {
      clearBotFollow(player.id);
    }

    const nearbyBag = findNearestLootBag(player, 12);
    if (nearbyBag.bag && nearbyBag.distance <= bagPickupRange) {
      if (tryPickupLootBag(player, nearbyBag.bag.x, nearbyBag.bag.y)) {
        autoEquipBot(player);
        player.botState.nextLootCheckAt = now + 400;
        player.input = { dx: 0, dy: 0 };
        return;
      }
    }

    const nearestMob = findNearestMob(player);
    const targetMob = nearestMob.mob;
    if (!targetMob) {
      if (nearbyBag.bag) {
        updateBotMovementToward(player, nearbyBag.bag, 0.7);
      } else {
        player.input = { dx: 0, dy: 0 };
      }
      return;
    }

    const targetDistance = nearestMob.distance;
    if (nearbyBag.bag && nearbyBag.distance <= 6 && targetDistance > 4) {
      updateBotMovementToward(player, nearbyBag.bag, 0.7);
      return;
    }
    let abilityUsed = false;
    if (String(player.classType || "").toLowerCase() === "mage") {
      abilityUsed = tryUseMageAbilities(player, targetMob, targetDistance, now);
      if (!abilityUsed) {
        const desiredRange = targetDistance <= 8 ? 6 : 7.5;
        updateBotMovementToward(player, targetMob, desiredRange);
      }
    } else {
      abilityUsed = tryUseWarriorAbilities(player, targetMob, targetDistance, now);
      if (!abilityUsed) {
        updateBotMovementToward(player, targetMob, 1.45);
      }
    }

    if (abilityUsed) {
      player.botState.targetMobId = String(targetMob.id || "");
      player.input = { dx: 0, dy: 0 };
      return;
    }

    if (nearbyBag.bag && nearbyBag.distance < targetDistance - 1.5) {
      updateBotMovementToward(player, nearbyBag.bag, 0.7);
    }
  }

  function tickBots(now = Date.now()) {
    for (const player of players.values()) {
      if (!player || !player.isBot) {
        continue;
      }
      tickBot(player, now);
    }
  }

  function createBotPlayer(params = {}) {
    const requestedClassType = String(params.classType || "").trim().toLowerCase();
    const classConfig = classConfigProvider();
    const fallbackClassType =
      classConfig && classConfig.classDefs instanceof Map && classConfig.classDefs.size
        ? String(classConfig.classDefs.keys().next().value || "")
        : "";
    const classType =
      requestedClassType && classConfig && classConfig.classDefs instanceof Map && classConfig.classDefs.has(requestedClassType)
        ? requestedClassType
        : fallbackClassType;
    if (!classType) {
      return { error: "No valid class available for bot creation." };
    }

    const spawn = randomPointInRadius(centerX, centerY, spawnRadius);
    const botNumber = nextBotIndex++;
    const classDef = classConfig && classConfig.classDefs instanceof Map ? classConfig.classDefs.get(classType) || null : null;
    const baseName = classDef ? classDef.name : classType;
    const result = createPlayer({
      ws: null,
      name: `${baseName} Bot ${botNumber}`,
      classType,
      spawn,
      isBot: true,
      botOwnerId: params.ownerPlayerId ? String(params.ownerPlayerId) : ""
    });
    if (result && result.player && result.player.botState) {
      result.player.botState.nextDecisionAt = 0;
      result.player.botState.nextEquipCheckAt = 0;
      result.player.botState.nextLootCheckAt = 0;
    }
    return result;
  }

  return {
    createBotPlayer,
    tickBots,
    listBots,
    inspectBot,
    destroyBot,
    setBotFollow,
    clearBotFollow
  };
}

module.exports = {
  createBotTickSystem
};
