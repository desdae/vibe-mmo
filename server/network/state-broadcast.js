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
  const { sendJson, sendBinary, encodeMobMetaPacket, encodeProjectileMetaPacket } = deps;
  if (entityUpdate.playerMeta.length) {
    sendJson(player.ws, {
      type: "player_meta",
      players: entityUpdate.playerMeta
    });
  }
  if (entityUpdate.mobMeta.length) {
    sendBinary(player.ws, encodeMobMetaPacket(entityUpdate.mobMeta));
  }
  if (entityUpdate.projectileMeta.length) {
    sendBinary(player.ws, encodeProjectileMetaPacket(entityUpdate.projectileMeta));
  }
  if (entityUpdate.lootBagMeta.length) {
    sendJson(player.ws, {
      type: "lootbag_meta",
      bags: entityUpdate.lootBagMeta
    });
  }
}

function sendCastAndCombatAnimationEvents(player, nearbyPlayerObjects, nearbyMobObjects, now, deps) {
  const {
    sendJson,
    sendBinary,
    buildPlayerSwingEventsForRecipient,
    buildPlayerCastEventsForRecipient,
    buildPlayerEffectEventsForRecipient,
    buildMobCastEventsForRecipient,
    buildMobBiteEventsForRecipient,
    buildMobEffectEventsForRecipient,
    buildSelfPlayerEffectUpdate,
    encodeMobEffectEventPacket
  } = deps;

  const swingEvents = buildPlayerSwingEventsForRecipient(player, nearbyPlayerObjects);
  if (swingEvents.length) {
    sendJson(player.ws, {
      type: "player_swings",
      swings: swingEvents
    });
  }

  const castEvents = buildPlayerCastEventsForRecipient(player, nearbyPlayerObjects, now);
  if (castEvents.casts.length || castEvents.self) {
    sendJson(player.ws, {
      type: "player_casts",
      casts: castEvents.casts,
      self: castEvents.self
    });
  }

  const nearbyPlayerEffects = buildPlayerEffectEventsForRecipient(player, nearbyPlayerObjects, now);
  if (nearbyPlayerEffects.length) {
    sendJson(player.ws, {
      type: "player_effects_nearby",
      effects: nearbyPlayerEffects
    });
  }

  const mobCastEvents = buildMobCastEventsForRecipient(player, nearbyMobObjects, now);
  if (mobCastEvents.length) {
    sendJson(player.ws, {
      type: "mob_casts",
      casts: mobCastEvents
    });
  }

  const biteEvents = buildMobBiteEventsForRecipient(player, nearbyMobObjects);
  if (biteEvents.length) {
    sendJson(player.ws, {
      type: "mob_bites",
      bites: biteEvents
    });
  }

  const mobEffectEvents = buildMobEffectEventsForRecipient(player, nearbyMobObjects, now);
  if (mobEffectEvents.length) {
    sendBinary(player.ws, encodeMobEffectEventPacket(mobEffectEvents));
  }

  const selfEffectUpdate = buildSelfPlayerEffectUpdate(player, now);
  if (selfEffectUpdate) {
    sendJson(player.ws, {
      type: "player_effects",
      ...selfEffectUpdate
    });
  }
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
  const { pendingExplosionEvents, sendJson, inVisibilityRange, VISIBILITY_RANGE } = deps;
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
    sendJson(player.ws, {
      type: "explosion_events",
      events: visibleExplosionEvents
    });
  }
}

function sendVisibleProjectileHitEvents(player, deps) {
  const { pendingProjectileHitEvents, sendJson, inVisibilityRange, VISIBILITY_RANGE } = deps;
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
    sendJson(player.ws, {
      type: "projectile_hit_events",
      events: visibleProjectileHitEvents
    });
  }
}

function sendVisibleMobDeathEvents(player, deps) {
  const { pendingMobDeathEvents, sendJson, inVisibilityRange, VISIBILITY_RANGE } = deps;
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
    sendJson(player.ws, {
      type: "mob_death_events",
      events: visibleMobDeathEvents
    });
  }
}

function clearPendingWorldEvents(deps) {
  deps.pendingDamageEvents.length = 0;
  deps.pendingExplosionEvents.length = 0;
  deps.pendingProjectileHitEvents.length = 0;
  deps.pendingMobDeathEvents.length = 0;
}

function broadcastStateToPlayers(deps, now = Date.now()) {
  const { players, buildEntityUpdatePacket, sendBinary } = deps;

  for (const player of players.values()) {
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
    sendAreaEffectEvents(player, now, deps);
    sendVisibleDamageEvents(player, deps);
    sendVisibleExplosionEvents(player, deps);
    sendVisibleProjectileHitEvents(player, deps);
    sendVisibleMobDeathEvents(player, deps);

    if (entityUpdate.packet) {
      sendBinary(player.ws, entityUpdate.packet);
    }
  }

  clearPendingWorldEvents(deps);
}

function createStateBroadcaster(deps) {
  return function broadcast(now = Date.now()) {
    broadcastStateToPlayers(deps, now);
  };
}

module.exports = {
  broadcastStateToPlayers,
  createStateBroadcaster
};
