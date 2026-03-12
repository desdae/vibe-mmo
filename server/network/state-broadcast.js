function collectNearbyEntitiesForPlayer(player, deps) {
  const {
    players,
    projectiles,
    mobs,
    lootBags,
    inVisibilityRange,
    VISIBILITY_RANGE,
    serializePlayer,
    serializeMob
  } = deps;

  const nearbyPlayers = [];
  const nearbyPlayerObjects = [];
  const nearbyMobs = [];
  const nearbyMobObjects = [];
  const nearbyProjectiles = [];
  const nearbyLootBags = [];

  for (const other of players.values()) {
    if (other.id === player.id) {
      continue;
    }
    if (inVisibilityRange(player, other, VISIBILITY_RANGE)) {
      nearbyPlayers.push(serializePlayer(other));
      nearbyPlayerObjects.push(other);
    }
  }

  for (const projectile of projectiles.values()) {
    if (inVisibilityRange(player, projectile, VISIBILITY_RANGE)) {
      nearbyProjectiles.push({
        id: projectile.id,
        ownerId: projectile.ownerId,
        abilityId: projectile.abilityId,
        x: projectile.x,
        y: projectile.y
      });
    }
  }

  for (const mob of mobs.values()) {
    if (!mob.alive) {
      continue;
    }
    if (inVisibilityRange(player, mob, VISIBILITY_RANGE)) {
      nearbyMobs.push(serializeMob(mob));
      nearbyMobObjects.push(mob);
    }
  }

  for (const bag of lootBags.values()) {
    if (inVisibilityRange(player, bag, VISIBILITY_RANGE)) {
      nearbyLootBags.push(bag);
    }
  }

  return {
    nearbyPlayers,
    nearbyPlayerObjects,
    nearbyMobs,
    nearbyMobObjects,
    nearbyProjectiles,
    nearbyLootBags
  };
}

function sendEntityMeta(player, entityUpdate, deps) {
  const {
    sendBinary,
    encodePlayerMetaPacket,
    encodeMobMetaPacket,
    encodeProjectileMetaPacket,
    encodeLootBagMetaPacket
  } = deps;
  if (entityUpdate.playerMeta.length) {
    sendBinary(player.ws, encodePlayerMetaPacket(entityUpdate.playerMeta));
  }
  if (entityUpdate.mobMeta.length) {
    sendBinary(player.ws, encodeMobMetaPacket(entityUpdate.mobMeta));
  }
  if (entityUpdate.projectileMeta.length) {
    sendBinary(player.ws, encodeProjectileMetaPacket(entityUpdate.projectileMeta));
  }
  if (entityUpdate.lootBagMeta.length) {
    sendBinary(player.ws, encodeLootBagMetaPacket(entityUpdate.lootBagMeta));
  }
}

function sendCastAndCombatAnimationEvents(player, nearbyPlayerObjects, nearbyMobObjects, now, deps) {
  const {
    sendBinary,
    buildPlayerSwingEventsForRecipient,
    buildPlayerCastEventsForRecipient,
    buildPlayerEffectEventsForRecipient,
    buildMobCastEventsForRecipient,
    buildMobBiteEventsForRecipient,
    buildMobEffectEventsForRecipient,
    buildSelfPlayerEffectUpdate,
    encodeMobEffectEventPacket,
    encodePlayerSwingPacket,
    encodeCastEventPacket,
    encodePlayerEffectPacket,
    encodeMobBitePacket
  } = deps;

  const swingEvents = buildPlayerSwingEventsForRecipient(player, nearbyPlayerObjects);
  if (swingEvents.length) {
    sendBinary(player.ws, encodePlayerSwingPacket(swingEvents));
  }

  const castEvents = buildPlayerCastEventsForRecipient(player, nearbyPlayerObjects, now);
  const mobCastEvents = buildMobCastEventsForRecipient(player, nearbyMobObjects, now);
  if (castEvents.casts.length || castEvents.self || mobCastEvents.length) {
    sendBinary(player.ws, encodeCastEventPacket(castEvents.casts, mobCastEvents, castEvents.self));
  }

  const biteEvents = buildMobBiteEventsForRecipient(player, nearbyMobObjects);
  if (biteEvents.length) {
    sendBinary(player.ws, encodeMobBitePacket(biteEvents));
  }

  const mobEffectEvents = buildMobEffectEventsForRecipient(player, nearbyMobObjects, now);
  if (mobEffectEvents.length) {
    sendBinary(player.ws, encodeMobEffectEventPacket(mobEffectEvents));
  }

  const selfEffectUpdate = buildSelfPlayerEffectUpdate(player, now);
  const nearbyPlayerEffects = buildPlayerEffectEventsForRecipient(player, nearbyPlayerObjects, now);
  if (selfEffectUpdate || nearbyPlayerEffects.length) {
    sendBinary(player.ws, encodePlayerEffectPacket(selfEffectUpdate, nearbyPlayerEffects));
  }
}

function sendSelfBuffUpdates(player, now, deps) {
  const { sendJson } = deps;
  if (typeof sendJson !== "function" || !player || !player.entitySync) {
    return;
  }
  const visibleBuffs = (Array.isArray(player.activeBuffs) ? player.activeBuffs : [])
    .filter((buff) => Math.max(0, Number(buff && buff.endsAt) || 0) > now)
    .map((buff) => ({
      id: String(buff.id || ""),
      name: String(buff.name || ""),
      label: String(buff.label || "").slice(0, 3).toUpperCase(),
      color: String(buff.color || "").trim(),
      stats: buff.stats && typeof buff.stats === "object" ? { ...buff.stats } : {},
      endsAt: Math.max(0, Math.floor(Number(buff.endsAt) || 0)),
      durationMs: Math.max(1, Math.min(65535, Math.floor(Number(buff.durationMs) || 0))),
      remainingMs: Math.max(1, Math.min(65535, Math.floor((Number(buff.endsAt) || 0) - now)))
    }))
    .sort((a, b) => a.remainingMs - b.remainingMs || a.id.localeCompare(b.id));
  const signature = visibleBuffs
    .map((buff) => `${buff.id}:${buff.endsAt}:${buff.durationMs}:${buff.label}:${buff.color}:${buff.name}`)
    .join("|");
  if ((player.entitySync.selfBuffStateSignature || "") === signature) {
    return;
  }
  player.entitySync.selfBuffStateSignature = signature;
  sendJson(player.ws, {
    type: "self_buffs",
    buffs: visibleBuffs.map(({ endsAt, ...buff }) => buff)
  });
}

function sendAreaEffectEvents(player, now, deps) {
  const { buildAreaEffectEventsForRecipient, sendBinary, encodeAreaEffectEventPacket } = deps;
  const areaEffectEvents = buildAreaEffectEventsForRecipient(player, now);
  if (areaEffectEvents.length) {
    sendBinary(player.ws, encodeAreaEffectEventPacket(areaEffectEvents));
  }
}

function sendVisibleDamageEvents(player, deps) {
  const { pendingDamageEvents, sendBinary, encodeDamageEventPacket, inVisibilityRange, VISIBILITY_RANGE } = deps;
  if (!pendingDamageEvents.length) {
    return;
  }
  const visibleDamageEvents = [];
  for (const event of pendingDamageEvents) {
    if (inVisibilityRange(player, event, VISIBILITY_RANGE)) {
      visibleDamageEvents.push({
        x: event.x,
        y: event.y,
        amount: event.amount,
        targetType: event.targetType,
        fromSelf: !!(event.sourcePlayerId && event.sourcePlayerId === player.id)
      });
    }
  }
  if (visibleDamageEvents.length) {
    sendBinary(player.ws, encodeDamageEventPacket(visibleDamageEvents));
  }
}

function sendVisibleExplosionEvents(player, deps) {
  const { pendingExplosionEvents, sendBinary, encodeExplosionEventPacket, inVisibilityRange, VISIBILITY_RANGE } = deps;
  if (!pendingExplosionEvents.length) {
    return;
  }
  const visibleExplosionEvents = [];
  for (const event of pendingExplosionEvents) {
    const range = VISIBILITY_RANGE + Math.max(0, Number(event.radius) || 0);
    if (inVisibilityRange(player, event, range)) {
      visibleExplosionEvents.push(event);
    }
  }
  if (visibleExplosionEvents.length) {
    sendBinary(player.ws, encodeExplosionEventPacket(visibleExplosionEvents));
  }
}

function sendVisibleProjectileHitEvents(player, deps) {
  const {
    pendingProjectileHitEvents,
    sendBinary,
    encodeProjectileHitEventPacket,
    inVisibilityRange,
    VISIBILITY_RANGE
  } = deps;
  if (!pendingProjectileHitEvents.length) {
    return;
  }
  const visibleProjectileHitEvents = [];
  for (const event of pendingProjectileHitEvents) {
    if (inVisibilityRange(player, event, VISIBILITY_RANGE + 2)) {
      visibleProjectileHitEvents.push(event);
    }
  }
  if (visibleProjectileHitEvents.length) {
    sendBinary(player.ws, encodeProjectileHitEventPacket(visibleProjectileHitEvents));
  }
}

function sendVisibleMobDeathEvents(player, deps) {
  const { pendingMobDeathEvents, sendBinary, encodeMobDeathEventPacket, inVisibilityRange, VISIBILITY_RANGE } = deps;
  if (!pendingMobDeathEvents.length) {
    return;
  }
  const visibleMobDeathEvents = [];
  for (const event of pendingMobDeathEvents) {
    if (inVisibilityRange(player, event, VISIBILITY_RANGE + 2)) {
      visibleMobDeathEvents.push(event);
    }
  }
  if (visibleMobDeathEvents.length) {
    sendBinary(player.ws, encodeMobDeathEventPacket(visibleMobDeathEvents));
  }
}

function sendWorldStats(player, now, deps) {
  const { sendJson, getAliveMobCount } = deps;
  if (typeof sendJson !== "function" || typeof getAliveMobCount !== "function") {
    return;
  }
  const lastSentAt = Number(player.lastWorldStatsSentAt) || 0;
  if (now - lastSentAt < 1000) {
    return;
  }
  player.lastWorldStatsSentAt = now;
  sendJson(player.ws, {
    type: "world_stats",
    mobCount: Math.max(0, Math.floor(Number(getAliveMobCount()) || 0))
  });
}

function getCosmeticEventFlushInterval(deps) {
  const load =
    deps.pendingDamageEvents.length +
    deps.pendingExplosionEvents.length +
    deps.pendingProjectileHitEvents.length +
    deps.pendingMobDeathEvents.length;
  if (load >= 180) {
    return 3;
  }
  if (load >= 80) {
    return 2;
  }
  return 1;
}

function clearPendingWorldEvents(deps, options = {}) {
  const clearDamage = options.clearDamage !== false;
  const clearCosmetic = options.clearCosmetic !== false;
  if (clearDamage) {
    deps.pendingDamageEvents.length = 0;
  }
  if (clearCosmetic) {
    deps.pendingExplosionEvents.length = 0;
    deps.pendingProjectileHitEvents.length = 0;
    deps.pendingMobDeathEvents.length = 0;
  }
}

function broadcastStateToPlayers(deps, now = Date.now(), options = {}) {
  const { players, buildEntityUpdatePacket, sendBinary } = deps;
  const sendCosmeticBursts = options.sendCosmeticBursts !== false;
  const sendDamageBursts = options.sendDamageBursts !== false;

  for (const player of players.values()) {
    if (!player || !player.ws) {
      continue;
    }
    const nearby = collectNearbyEntitiesForPlayer(player, deps);
    const entityUpdate = buildEntityUpdatePacket(
      player,
      nearby.nearbyPlayers,
      nearby.nearbyMobs,
      nearby.nearbyProjectiles,
      nearby.nearbyLootBags
    );

    sendEntityMeta(player, entityUpdate, deps);
    sendCastAndCombatAnimationEvents(player, nearby.nearbyPlayerObjects, nearby.nearbyMobObjects, now, deps);
    sendSelfBuffUpdates(player, now, deps);
    sendAreaEffectEvents(player, now, deps);
    if (sendDamageBursts) {
      sendVisibleDamageEvents(player, deps);
    }
    if (sendCosmeticBursts) {
      sendVisibleExplosionEvents(player, deps);
      sendVisibleProjectileHitEvents(player, deps);
      sendVisibleMobDeathEvents(player, deps);
    }
    sendWorldStats(player, now, deps);

    if (entityUpdate.packet) {
      sendBinary(player.ws, entityUpdate.packet);
    }
  }

  clearPendingWorldEvents(deps, {
    clearDamage: sendDamageBursts,
    clearCosmetic: sendCosmeticBursts
  });
}

function createStateBroadcaster(deps) {
  let tickCounter = 0;
  return function broadcast(now = Date.now()) {
    tickCounter += 1;
    const flushInterval = getCosmeticEventFlushInterval(deps);
    const shouldFlushBursts = tickCounter % flushInterval === 0;
    broadcastStateToPlayers(deps, now, {
      sendDamageBursts: shouldFlushBursts,
      sendCosmeticBursts: shouldFlushBursts
    });
  };
}

module.exports = {
  broadcastStateToPlayers,
  createStateBroadcaster
};
