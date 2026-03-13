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
  const levelUpPlayerAbility =
    typeof options.levelUpPlayerAbility === "function" ? options.levelUpPlayerAbility : () => false;
  const getAbilityRangeForLevel =
    typeof options.getAbilityRangeForLevel === "function" ? options.getAbilityRangeForLevel : () => 0;
  const usePlayerAbility = typeof options.usePlayerAbility === "function" ? options.usePlayerAbility : () => false;
  const tryPickupLootBag = typeof options.tryPickupLootBag === "function" ? options.tryPickupLootBag : () => false;
  const equipInventoryItem = typeof options.equipInventoryItem === "function" ? options.equipInventoryItem : () => false;
  const getInventoryEntrySellValue =
    typeof options.getInventoryEntrySellValue === "function" ? options.getInventoryEntrySellValue : () => 0;
  const sellInventoryItemToVendor =
    typeof options.sellInventoryItemToVendor === "function" ? options.sellInventoryItemToVendor : () => ({ ok: false });
  const randomPointInRadius =
    typeof options.randomPointInRadius === "function" ? options.randomPointInRadius : (x, y) => ({ x, y });
  const distance = typeof options.distance === "function" ? options.distance : () => Infinity;
  const normalizeDirection =
    typeof options.normalizeDirection === "function" ? options.normalizeDirection : () => null;
  const townLayout = options.townLayout || null;
  const centerX = Number(options.centerX) || 0;
  const centerY = Number(options.centerY) || 0;
  const spawnRadius = Math.max(1, Number(options.spawnRadius) || 6);
  const bagPickupRange = Math.max(0.1, Number(options.bagPickupRange) || 1.5);
  const visibilityRange = Math.max(4, Number(options.visibilityRange) || 20);
  const townLayoutTools = require("../../public/shared/town-layout");
  const isPointInTown =
    townLayoutTools && typeof townLayoutTools.isPointInTown === "function" ? townLayoutTools.isPointInTown : () => false;

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

  function countMobsAroundPoint(x, y, maxRange = 2.25) {
    let total = 0;
    const radius = Math.max(0.1, Number(maxRange) || 2.25);
    for (const mob of mobs.values()) {
      if (!mob || !mob.alive) {
        continue;
      }
      const dx = Number(mob.x) - Number(x);
      const dy = Number(mob.y) - Number(y);
      if (Math.hypot(dx, dy) <= radius) {
        total += 1;
      }
    }
    return total;
  }

  function getVendorNpc() {
    return townLayout && townLayout.vendor ? townLayout.vendor : null;
  }

  function isNearVendor(player) {
    const vendor = getVendorNpc();
    if (!player || !vendor) {
      return false;
    }
    return Math.hypot(Number(player.x) - Number(vendor.x), Number(player.y) - Number(vendor.y)) <= Math.max(0.5, Number(vendor.interactRange) || 2.25);
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

  function getKnownBotAbilities(player) {
    const abilityDefs = abilityDefsProvider();
    const entries = [];
    if (!player || !player.abilityLevels || typeof player.abilityLevels.entries !== "function") {
      return entries;
    }
    for (const [abilityId, rawLevel] of player.abilityLevels.entries()) {
      const id = String(abilityId || "").trim();
      const level = Math.max(0, Math.floor(Number(rawLevel) || 0));
      if (!id || level <= 0) {
        continue;
      }
      const def = abilityDefs.get(id);
      if (!def) {
        continue;
      }
      const range = Math.max(0, Number(getAbilityRangeForLevel(def, level)) || Number(def.range) || 0);
      entries.push({ id, level, def, range });
    }
    return entries;
  }

  function getAbilityKindPriority(kind) {
    const normalizedKind = String(kind || "").trim();
    if (normalizedKind === "summon") {
      return 70;
    }
    if (normalizedKind === "selfBuff") {
      return 62;
    }
    if (normalizedKind === "chain") {
      return 64;
    }
    if (normalizedKind === "area") {
      return 58;
    }
    if (normalizedKind === "beam") {
      return 54;
    }
    if (normalizedKind === "projectile") {
      return 46;
    }
    if (normalizedKind === "meleeCone") {
      return 38;
    }
    return 10;
  }

  function isAbilityReady(player, ability) {
    if (!player || !ability || !ability.def) {
      return false;
    }
    const cooldownMs = Math.max(0, Number(ability.def.cooldownMs) || 0);
    const lastUsedAt = Number(player.abilityLastUsedAt && player.abilityLastUsedAt.get(ability.id)) || 0;
    if (cooldownMs > 0 && Date.now() - lastUsedAt < cooldownMs) {
      return false;
    }
    return Number(player.mana) + 1e-6 >= Math.max(0, Number(ability.def.manaCost) || 0);
  }

  function getPreferredCombatDistance(player) {
    const abilities = getKnownBotAbilities(player);
    let bestRangedRange = 0;
    let hasMelee = false;
    for (const ability of abilities) {
      const kind = String(ability.def.kind || "");
      if (kind === "meleeCone") {
        hasMelee = true;
        continue;
      }
      if (kind === "area" && ability.range <= 0.1) {
        hasMelee = true;
        continue;
      }
      if (kind === "teleport") {
        continue;
      }
      bestRangedRange = Math.max(bestRangedRange, ability.range);
    }
    if (bestRangedRange > 0.5) {
      return Math.max(2.2, Math.min(7.5, bestRangedRange * 0.75));
    }
    if (hasMelee) {
      return 1.45;
    }
    return 3;
  }

  function scoreBotAbilityUse(player, ability, target, targetDistance, now) {
    if (!isAbilityReady(player, ability)) {
      return -Infinity;
    }
    const def = ability.def;
    const kind = String(def.kind || "");
    const effectiveRange = Math.max(0, ability.range);
    const areaRadius = Math.max(0, Number(def.areaRadius) || 0);
    const nearbySelfMobs = countNearbyMobs(player, Math.max(1.8, areaRadius + 0.5));
    const nearbyTargetMobs = countMobsAroundPoint(target.x, target.y, Math.max(1.4, areaRadius + 0.5));

    if (kind === "teleport") {
      return -Infinity;
    }
    if (kind === "selfBuff") {
      const alreadyActive = (Array.isArray(player.activeBuffs) ? player.activeBuffs : []).some(
        (buff) => String(buff && buff.sourceAbilityId || "") === String(ability.id || "")
      );
      if (alreadyActive) {
        return -Infinity;
      }
      return targetDistance <= 2.8 ? getAbilityKindPriority(kind) + 4 : -Infinity;
    }
    if (kind === "summon") {
      if (effectiveRange <= 0 || targetDistance > effectiveRange || hasActiveOwnedSummon(player, ability.id, now)) {
        return -Infinity;
      }
      return getAbilityKindPriority(kind) + effectiveRange;
    }
    if (kind === "area") {
      if (effectiveRange <= 0.1) {
        return nearbySelfMobs >= 2 ? getAbilityKindPriority(kind) + nearbySelfMobs * 6 : -Infinity;
      }
      if (targetDistance > effectiveRange) {
        return -Infinity;
      }
      return nearbyTargetMobs >= 2 ? getAbilityKindPriority(kind) + nearbyTargetMobs * 5 : -Infinity;
    }
    if (kind === "chain") {
      if (targetDistance > effectiveRange) {
        return -Infinity;
      }
      const jumpRange = Math.max(0.5, Number(def.jumpRange) || 3);
      const chainTargets = countMobsAroundPoint(target.x, target.y, jumpRange);
      return getAbilityKindPriority(kind) + chainTargets * 4 + Math.min(6, effectiveRange * 0.25);
    }
    if (kind === "beam") {
      if (targetDistance > effectiveRange) {
        return -Infinity;
      }
      return getAbilityKindPriority(kind) + Math.min(6, effectiveRange * 0.25);
    }
    if (kind === "projectile") {
      if (targetDistance > effectiveRange) {
        return -Infinity;
      }
      return getAbilityKindPriority(kind) + Math.min(5, effectiveRange * 0.2);
    }
    if (kind === "meleeCone") {
      if (targetDistance > Math.max(1.25, effectiveRange + 0.1)) {
        return -Infinity;
      }
      return getAbilityKindPriority(kind) + nearbySelfMobs * 2;
    }
    return -Infinity;
  }

  function tryUseBestCombatAbility(player, target, targetDistance, now) {
    const abilities = getKnownBotAbilities(player);
    let bestAbility = null;
    let bestScore = -Infinity;
    for (const ability of abilities) {
      const score = scoreBotAbilityUse(player, ability, target, targetDistance, now);
      if (score > bestScore) {
        bestScore = score;
        bestAbility = ability;
      }
    }
    if (!bestAbility || !Number.isFinite(bestScore)) {
      return false;
    }
    return tryUseBotAbility(player, bestAbility.id, target, targetDistance, now);
  }

  function updateBotMovementToward(player, target, desiredDistance = 0.5) {
    if (!player || !target) {
      return;
    }
    const routedTarget = resolveBotTownPathWaypoint(player, target);
    const waypoint = routedTarget && routedTarget.target ? routedTarget.target : target;
    const effectiveDistance =
      routedTarget && Number.isFinite(Number(routedTarget.desiredDistance))
        ? Math.max(0, Number(routedTarget.desiredDistance) || 0)
        : Math.max(0, Number(desiredDistance) || 0);
    const dx = Number(waypoint.x) - Number(player.x);
    const dy = Number(waypoint.y) - Number(player.y);
    const dist = Math.hypot(dx, dy);
    if (!dist || dist <= effectiveDistance) {
      player.input = { dx: 0, dy: 0 };
      return;
    }
    const direction = normalizeDirection(dx, dy);
    player.input = direction || { dx: 0, dy: 0 };
    if (direction) {
      player.lastDirection = direction;
    }
  }

  function getTownGateRoutes() {
    if (!townLayout || townLayout.enabled === false) {
      return [];
    }
    const northCenterX = (Number(townLayout.northGate?.min) + Number(townLayout.northGate?.max)) * 0.5 + 0.5;
    const southCenterX = (Number(townLayout.southGate?.min) + Number(townLayout.southGate?.max)) * 0.5 + 0.5;
    const westCenterY = (Number(townLayout.westGate?.min) + Number(townLayout.westGate?.max)) * 0.5 + 0.5;
    const eastCenterY = (Number(townLayout.eastGate?.min) + Number(townLayout.eastGate?.max)) * 0.5 + 0.5;
    return [
      {
        key: "north",
        gateCenter: { x: northCenterX, y: Number(townLayout.minTileY) + 0.5 },
        outsidePoint: { x: northCenterX, y: Number(townLayout.minTileY) - 0.5 }
      },
      {
        key: "south",
        gateCenter: { x: southCenterX, y: Number(townLayout.maxTileY) + 0.5 },
        outsidePoint: { x: southCenterX, y: Number(townLayout.maxTileY) + 1.5 }
      },
      {
        key: "west",
        gateCenter: { x: Number(townLayout.minTileX) + 0.5, y: westCenterY },
        outsidePoint: { x: Number(townLayout.minTileX) - 0.5, y: westCenterY }
      },
      {
        key: "east",
        gateCenter: { x: Number(townLayout.maxTileX) + 0.5, y: eastCenterY },
        outsidePoint: { x: Number(townLayout.maxTileX) + 1.5, y: eastCenterY }
      }
    ];
  }

  function getTownGateRouteByKey(routeKey) {
    const normalizedKey = String(routeKey || "").trim().toLowerCase();
    if (!normalizedKey) {
      return null;
    }
    for (const route of getTownGateRoutes()) {
      if (String(route.key || "") === normalizedKey) {
        return route;
      }
    }
    return null;
  }

  function clearBotTownRoute(player) {
    if (player && player.botState) {
      player.botState.townRoute = null;
    }
  }

  function getTownRouteForTarget(player, target) {
    if (!player || !target || !townLayout || townLayout.enabled === false) {
      return null;
    }
    const playerInTown = isPointInTown(townLayout, player.x, player.y);
    const targetInTown = isPointInTown(townLayout, target.x, target.y);
    if (playerInTown === targetInTown) {
      return null;
    }

    const routes = getTownGateRoutes();
    let bestRoute = null;
    let bestScore = Infinity;
    for (const route of routes) {
      const score = playerInTown
        ? Math.hypot(Number(player.x) - route.gateCenter.x, Number(player.y) - route.gateCenter.y) +
          Math.hypot(Number(target.x) - route.outsidePoint.x, Number(target.y) - route.outsidePoint.y)
        : Math.hypot(Number(player.x) - route.outsidePoint.x, Number(player.y) - route.outsidePoint.y) +
          Math.hypot(Number(target.x) - route.gateCenter.x, Number(target.y) - route.gateCenter.y);
      if (score < bestScore) {
        bestScore = score;
        bestRoute = route;
      }
    }
    return bestRoute;
  }

  function resolveBotTownPathWaypoint(player, target) {
    if (!player || !player.botState || !townLayout || townLayout.enabled === false) {
      return null;
    }
    const playerInTown = isPointInTown(townLayout, player.x, player.y);
    const targetInTown = !!(target && isPointInTown(townLayout, target.x, target.y));
    if (playerInTown === targetInTown) {
      clearBotTownRoute(player);
      return null;
    }

    const desiredMode = playerInTown ? "exit" : "enter";
    let routeState = player.botState.townRoute && typeof player.botState.townRoute === "object" ? { ...player.botState.townRoute } : null;
    let route =
      routeState && routeState.mode === desiredMode ? getTownGateRouteByKey(routeState.gateKey) : null;
    if (!route) {
      route = getTownRouteForTarget(player, target);
      if (!route) {
        clearBotTownRoute(player);
        return null;
      }
      routeState = {
        mode: desiredMode,
        gateKey: String(route.key || ""),
        stage: desiredMode === "exit" ? "gate" : "outside"
      };
    }

    const gateDistance = Math.hypot(Number(player.x) - route.gateCenter.x, Number(player.y) - route.gateCenter.y);
    const outsideDistance = Math.hypot(Number(player.x) - route.outsidePoint.x, Number(player.y) - route.outsidePoint.y);
    const gateReachDistance = 0.28;
    const outsideReachDistance = 0.38;
    const gateReleaseDistance = 0.55;

    if (desiredMode === "exit") {
      if (routeState.stage === "gate") {
        if (gateDistance <= gateReachDistance) {
          routeState.stage = "outside";
        } else {
          player.botState.townRoute = routeState;
          return {
            target: route.gateCenter,
            desiredDistance: gateReachDistance
          };
        }
      }
      if (!playerInTown && gateDistance >= gateReleaseDistance) {
        clearBotTownRoute(player);
        return null;
      }
      if (outsideDistance <= outsideReachDistance && !playerInTown) {
        clearBotTownRoute(player);
        return null;
      }
      player.botState.townRoute = routeState;
      return {
        target: route.outsidePoint,
        desiredDistance: outsideReachDistance
      };
    }

    if (routeState.stage === "outside") {
      if (outsideDistance <= outsideReachDistance) {
        routeState.stage = "gate";
      } else {
        player.botState.townRoute = routeState;
        return {
          target: route.outsidePoint,
          desiredDistance: outsideReachDistance
        };
      }
    }
    if (playerInTown && gateDistance <= gateReachDistance) {
      clearBotTownRoute(player);
      return null;
    }
    player.botState.townRoute = routeState;
    return {
      target: route.gateCenter,
      desiredDistance: gateReachDistance
    };
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
      weaponClass: String(entry.weaponClass || ""),
      itemLevel: Math.max(0, Math.floor(Number(entry.itemLevel) || 0)),
      isEquipment: !!entry.isEquipment,
      baseStats: entry.baseStats && typeof entry.baseStats === "object" ? { ...entry.baseStats } : null,
      tags: Array.isArray(entry.tags) ? entry.tags.map((value) => String(value || "")).filter(Boolean) : [],
      affixes: Array.isArray(entry.affixes) ? entry.affixes.map((affix) => ({ ...affix, modifiers: Array.isArray(affix?.modifiers) ? affix.modifiers.map((modifier) => ({ ...modifier })) : [] })) : [],
      prefixes: Array.isArray(entry.prefixes) ? entry.prefixes.map((affix) => ({ ...affix, modifiers: Array.isArray(affix?.modifiers) ? affix.modifiers.map((modifier) => ({ ...modifier })) : [] })) : [],
      suffixes: Array.isArray(entry.suffixes) ? entry.suffixes.map((affix) => ({ ...affix, modifiers: Array.isArray(affix?.modifiers) ? affix.modifiers.map((modifier) => ({ ...modifier })) : [] })) : [],
      copperValue: Math.max(0, Math.floor(Number(getInventoryEntrySellValue(entry)) || 0))
    };
  }

  function getSellableInventoryIndexes(player) {
    const results = [];
    if (!player || !Array.isArray(player.inventorySlots)) {
      return results;
    }
    for (let index = 0; index < player.inventorySlots.length; index += 1) {
      const entry = player.inventorySlots[index];
      if (!entry || !entry.isEquipment) {
        continue;
      }
      if (chooseEquipmentSlotForEntry(player, entry)) {
        continue;
      }
      const copperValue = Math.max(0, Math.floor(Number(getInventoryEntrySellValue(entry)) || 0));
      if (copperValue <= 0) {
        continue;
      }
      results.push(index);
    }
    return results;
  }

  function shouldBotVisitVendor(player, nearestMobDistance = Infinity) {
    if (!player || !townLayout || townLayout.enabled === false || !getVendorNpc()) {
      return false;
    }
    if (player.botState && player.botState.followTargetPlayerId) {
      return false;
    }
    const sellableIndexes = getSellableInventoryIndexes(player);
    if (!sellableIndexes.length) {
      return false;
    }
    const usedSlots = Array.isArray(player.inventorySlots) ? player.inventorySlots.filter(Boolean).length : 0;
    const capacity = Array.isArray(player.inventorySlots) ? player.inventorySlots.length : 0;
    const crowded = capacity > 0 && usedSlots / capacity >= 0.6;
    const safeToLeave = !Number.isFinite(nearestMobDistance) || nearestMobDistance > Math.max(6, visibilityRange * 0.45);
    return crowded || sellableIndexes.length >= 3 || safeToLeave;
  }

  function autoSpendBotSkillPoints(player, now) {
    if (!player || Math.max(0, Number(player.skillPoints) || 0) <= 0) {
      return false;
    }
    if (Number(player.botState?.nextSkillSpendAt) > now) {
      return false;
    }
    const abilities = getKnownBotAbilities(player).sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      const priorityDelta = getAbilityKindPriority(b.def.kind) - getAbilityKindPriority(a.def.kind);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return a.id.localeCompare(b.id);
    });
    let changed = false;
    let iterations = 0;
    while (Math.max(0, Number(player.skillPoints) || 0) > 0 && abilities.length && iterations < 16) {
      const nextAbility = abilities[iterations % abilities.length];
      if (!nextAbility || !levelUpPlayerAbility(player, nextAbility.id)) {
        break;
      }
      changed = true;
      iterations += 1;
    }
    if (player.botState) {
      player.botState.nextSkillSpendAt = now + (changed ? 800 : 1500);
    }
    return changed;
  }

  function runBotVendorRoutine(player, now) {
    const vendor = getVendorNpc();
    if (!player || !vendor) {
      return false;
    }
    const sellableIndexes = getSellableInventoryIndexes(player);
    if (!sellableIndexes.length) {
      return false;
    }
    if (!isNearVendor(player)) {
      updateBotMovementToward(player, vendor, Math.max(0.3, Number(vendor.interactRange) - 0.35 || 1.5));
      return true;
    }
    if (Number(player.botState?.nextVendorActionAt) > now) {
      player.input = { dx: 0, dy: 0 };
      return true;
    }
    player.input = { dx: 0, dy: 0 };
    const saleResult = sellInventoryItemToVendor(player, sellableIndexes[0], vendor.id);
    if (player.botState) {
      player.botState.nextVendorActionAt = now + (saleResult && saleResult.ok ? 180 : 700);
    }
    return true;
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

  function tryUseBotPotion(player, now = Date.now()) {
    if (!player || !Array.isArray(player.inventorySlots)) {
      return false;
    }
    
    const hpPercent = player.hp / Math.max(1, player.maxHp);
    const manaPercent = player.mana / Math.max(1, player.maxMana);
    
    // Find and use health potion if HP is low
    if (hpPercent < 0.5) {
      for (let index = 0; index < player.inventorySlots.length; index += 1) {
        const entry = player.inventorySlots[index];
        if (!entry || !entry.itemId) continue;
        if (String(entry.itemId).toLowerCase() === "healthpotion01") {
          const healAmount = Math.max(1, Number(entry.effect?.value) || 20);
          player.hp = Math.min(player.maxHp, player.hp + healAmount);
          entry.quantity = (Number(entry.quantity) || 1) - 1;
          if (entry.quantity <= 0) {
            player.inventorySlots[index] = null;
          }
          player.lastHealReceivedAt = now;
          player.lastHealAmount = healAmount;
          return true;
        }
      }
    }
    
    // Find and use mana potion if Mana is low and not casting
    if (manaPercent < 0.3 && !player.activeCast) {
      for (let index = 0; index < player.inventorySlots.length; index += 1) {
        const entry = player.inventorySlots[index];
        if (!entry || !entry.itemId) continue;
        if (String(entry.itemId).toLowerCase() === "manapotion01") {
          const manaAmount = Math.max(1, Number(entry.effect?.value) || 30);
          player.mana = Math.min(player.maxMana, player.mana + manaAmount);
          entry.quantity = (Number(entry.quantity) || 1) - 1;
          if (entry.quantity <= 0) {
            player.inventorySlots[index] = null;
          }
          return true;
        }
      }
    }
    
    return false;
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
    
    // Auto-use health/mana potions
    const usedPotion = tryUseBotPotion(player, now);
    if (usedPotion) {
      player.input = { dx: 0, dy: 0 };
      player.botState.nextDecisionAt = now + 120;
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
    autoSpendBotSkillPoints(player, now);

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
        const followedAttackUsed = tryUseBestCombatAbility(player, combatTarget, combatDistance, now);
        if (followedAttackUsed) {
          player.input = { dx: 0, dy: 0 };
          return;
        }
        updateBotMovementToward(player, combatTarget, getPreferredCombatDistance(player));
        return;
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
    if (shouldBotVisitVendor(player, nearestMob.distance)) {
      if (runBotVendorRoutine(player, now)) {
        return;
      }
    }
    if (!targetMob) {
      if (nearbyBag.bag) {
        updateBotMovementToward(player, nearbyBag.bag, 0.7);
      } else if (shouldBotVisitVendor(player, Infinity)) {
        runBotVendorRoutine(player, now);
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
    const abilityUsed = tryUseBestCombatAbility(player, targetMob, targetDistance, now);

    if (abilityUsed) {
      player.botState.targetMobId = String(targetMob.id || "");
      player.input = { dx: 0, dy: 0 };
      return;
    }

    updateBotMovementToward(player, targetMob, getPreferredCombatDistance(player));

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
