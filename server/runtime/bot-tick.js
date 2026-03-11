function createBotTickSystem(options = {}) {
  const players = options.players instanceof Map ? options.players : null;
  const mobs = options.mobs instanceof Map ? options.mobs : null;
  const lootBags = options.lootBags instanceof Map ? options.lootBags : null;
  const activeAreaEffects = options.activeAreaEffects instanceof Map ? options.activeAreaEffects : null;
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

  if (!players || !mobs || !lootBags || !activeAreaEffects || !createPlayer) {
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
    tickBots
  };
}

module.exports = {
  createBotTickSystem
};
