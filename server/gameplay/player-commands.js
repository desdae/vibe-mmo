function createPlayerCommandTools({
  abilityDefsProvider,
  executeAbilityByKind,
  abilityHandlerContext,
  getPlayerAbilityLevel,
  getAbilityCooldownPassed,
  getAbilityCastMsForEntity,
  normalizeDirection,
  playerHasMovementInput,
  clamp,
  distance,
  lootBags,
  bagPickupRange,
  addItemsToInventory,
  sendInventoryState,
  syncPlayerCopperFromInventory,
  sendJson,
  notifyAbilityUsed
}) {
  function tryPickupLootBag(player, targetX, targetY) {
    let pickedBag = null;
    let bestScore = Infinity;
    const hasTarget = Number.isFinite(targetX) && Number.isFinite(targetY);

    for (const bag of lootBags.values()) {
      const playerDist = distance(player, bag);
      if (playerDist > bagPickupRange) {
        continue;
      }

      const clickDist = hasTarget ? Math.hypot(bag.x - targetX, bag.y - targetY) : 0;
      const score = hasTarget ? clickDist + playerDist * 0.15 : playerDist;
      if (score < bestScore) {
        bestScore = score;
        pickedBag = bag;
      }
    }

    if (!pickedBag) {
      return false;
    }

    const transfer = addItemsToInventory(player, pickedBag.items);
    if (!transfer.added.length) {
      sendJson(player.ws, {
        type: "loot_picked",
        itemsGained: [],
        inventoryFull: true
      });
      return false;
    }

    if (transfer.leftover.length) {
      pickedBag.items = transfer.leftover;
      pickedBag.metaVersion += 1;
    } else {
      lootBags.delete(pickedBag.id);
    }

    if (transfer.changed) {
      sendInventoryState(player);
    }
    syncPlayerCopperFromInventory(player, true);

    sendJson(player.ws, {
      type: "loot_picked",
      itemsGained: transfer.added,
      inventoryFull: transfer.leftover.length > 0
    });
    return true;
  }

  function usePlayerAbility(player, abilityId, targetDx, targetDy, targetDistance = null) {
    if (!player || player.hp <= 0) {
      return false;
    }
    if ((Number(player.stunnedUntil) || 0) > Date.now()) {
      return false;
    }

    if (player.activeCast) {
      return false;
    }

    const resolvedAbilityId = String(abilityId || "").trim();
    if (!resolvedAbilityId) {
      return false;
    }
    const abilityDef = abilityDefsProvider().get(resolvedAbilityId);
    if (!abilityDef) {
      return false;
    }

    const abilityLevel = getPlayerAbilityLevel(player, resolvedAbilityId);
    if (abilityLevel <= 0) {
      return false;
    }

    const now = Date.now();
    const manaCost = Math.max(0, Number(abilityDef.manaCost) || 0);
    if (player.mana + 1e-6 < manaCost) {
      return false;
    }
    if (!getAbilityCooldownPassed(player, abilityDef, abilityLevel, now)) {
      return false;
    }

    const aimDirection =
      normalizeDirection(targetDx, targetDy) || normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
    if (!aimDirection) {
      return false;
    }

    const castMs = Math.max(
      0,
      typeof getAbilityCastMsForEntity === "function"
        ? Number(getAbilityCastMsForEntity(player, abilityDef, abilityLevel)) || 0
        : Number(abilityDef.castMs) || 0
    );
    if (castMs > 0) {
      if (abilityDef.kind !== "teleport" && playerHasMovementInput(player)) {
        return false;
      }
      player.activeCast = {
        abilityId: resolvedAbilityId,
        dx: aimDirection.dx,
        dy: aimDirection.dy,
        targetDistance: Number.isFinite(Number(targetDistance)) ? Number(targetDistance) : null,
        durationMs: castMs,
        startedAt: now,
        endsAt: now + castMs
      };
      player.lastDirection = aimDirection;
      player.castStateVersion = (Number(player.castStateVersion) + 1) & 0xffff;
      return true;
    }

    const used = executeAbilityByKind({
      player,
      abilityDef,
      abilityLevel,
      targetDx: aimDirection.dx,
      targetDy: aimDirection.dy,
      targetDistance,
      now,
      ctx: abilityHandlerContext
    });
    if (used && manaCost > 0) {
      player.mana = clamp(player.mana - manaCost, 0, player.maxMana);
    }
    if (used && typeof notifyAbilityUsed === "function") {
      notifyAbilityUsed(player, abilityDef, now);
    }
    return used;
  }

  function updatePlayerCastTarget(player, targetDx, targetDy, targetDistance = null) {
    if (!player || !player.activeCast || player.hp <= 0) {
      return false;
    }
    const cast = player.activeCast;
    const abilityDef = abilityDefsProvider().get(String(cast.abilityId || ""));
    if (!abilityDef) {
      return false;
    }
    if ((Number(player.stunnedUntil) || 0) > Date.now()) {
      return false;
    }
    if (abilityDef.kind !== "teleport" && playerHasMovementInput(player)) {
      return false;
    }

    const aimDirection =
      normalizeDirection(targetDx, targetDy) || normalizeDirection(player.lastDirection.dx, player.lastDirection.dy);
    if (!aimDirection) {
      return false;
    }

    cast.dx = aimDirection.dx;
    cast.dy = aimDirection.dy;
    cast.targetDistance = Number.isFinite(Number(targetDistance)) ? Number(targetDistance) : null;
    player.lastDirection = aimDirection;
    return true;
  }

  return {
    tryPickupLootBag,
    usePlayerAbility,
    updatePlayerCastTarget
  };
}

module.exports = {
  createPlayerCommandTools
};
