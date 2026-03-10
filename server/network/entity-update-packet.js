const PROTOCOL = require("../../public/shared/protocol");

const {
  ENTITY_PROTO_TYPE,
  ENTITY_PROTO_VERSION,
  POS_SCALE,
  MANA_SCALE,
  HEAL_SCALE,
  DELTA_FLAG_HP_CHANGED,
  DELTA_FLAG_MAX_HP_CHANGED,
  DELTA_FLAG_REMOVED,
  DELTA_FLAG_COPPER_CHANGED,
  DELTA_FLAG_PROGRESS_CHANGED,
  DELTA_FLAG_MANA_CHANGED,
  DELTA_FLAG_MAX_MANA_CHANGED,
  DELTA_FLAG_PENDING_HEAL_CHANGED,
  SELF_FLAG_PENDING_MANA_CHANGED,
  SELF_MODE_NONE,
  SELF_MODE_FULL,
  SELF_MODE_DELTA
} = PROTOCOL;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantizePos(value) {
  return clamp(Math.round(Number(value || 0) * POS_SCALE), 0, 65535);
}

function toEntityRealId(entityId) {
  const numericId = Number(entityId);
  if (!Number.isFinite(numericId)) {
    return 0;
  }
  return numericId;
}

function buildMobMetaSignature(name, renderStyle) {
  let styleJson = "";
  if (renderStyle && typeof renderStyle === "object") {
    try {
      styleJson = JSON.stringify(renderStyle);
    } catch (_error) {
      styleJson = "";
    }
  }
  return `${String(name || "Mob")}|${styleJson}`;
}

function getEntitySyncStore(sync, kind) {
  if (kind === "player") {
    return {
      slotsByRealId: sync.playerSlotsByRealId,
      realIdBySlot: sync.playerRealIdBySlot,
      statesBySlot: sync.playerStatesBySlot,
      freeSlots: sync.freePlayerSlots,
      nextSlotKey: "nextPlayerSlot"
    };
  }
  if (kind === "projectile") {
    return {
      slotsByRealId: sync.projectileSlotsByRealId,
      realIdBySlot: sync.projectileRealIdBySlot,
      statesBySlot: sync.projectileStatesBySlot,
      freeSlots: sync.freeProjectileSlots,
      nextSlotKey: "nextProjectileSlot"
    };
  }
  if (kind === "lootbag") {
    return {
      slotsByRealId: sync.lootBagSlotsByRealId,
      realIdBySlot: sync.lootBagRealIdBySlot,
      statesBySlot: sync.lootBagStatesBySlot,
      freeSlots: sync.freeLootBagSlots,
      nextSlotKey: "nextLootBagSlot"
    };
  }
  return {
    slotsByRealId: sync.mobSlotsByRealId,
    realIdBySlot: sync.mobRealIdBySlot,
    statesBySlot: sync.mobStatesBySlot,
    freeSlots: sync.freeMobSlots,
    nextSlotKey: "nextMobSlot"
  };
}

function allocateEntitySlot(sync, store) {
  if (store.freeSlots.length) {
    return store.freeSlots.pop();
  }

  const nextSlot = sync[store.nextSlotKey];
  if (nextSlot > 255) {
    return null;
  }
  sync[store.nextSlotKey] += 1;
  return nextSlot;
}

function processVisibleEntities(sync, kind, entities) {
  const store = getEntitySyncStore(sync, kind);
  const full = [];
  const delta = [];
  const meta = [];
  const visibleRealIds = new Set();

  for (const entity of entities) {
    const realId = toEntityRealId(entity.id);
    if (!realId) {
      continue;
    }
    visibleRealIds.add(realId);

    let slot = store.slotsByRealId.get(realId);
    if (!slot) {
      slot = allocateEntitySlot(sync, store);
      if (!slot) {
        continue;
      }
      store.slotsByRealId.set(realId, slot);
      store.realIdBySlot.set(slot, realId);
    }

    const state = {
      x: quantizePos(entity.x),
      y: quantizePos(entity.y),
      hp: clamp(entity.hp, 0, 255),
      maxHp: clamp(entity.maxHp, 0, 255)
    };

    const previous = store.statesBySlot.get(slot);
    if (!previous) {
      full.push({ id: slot, ...state });
      store.statesBySlot.set(slot, state);
      if (kind === "player") {
        meta.push({
          id: slot,
          name: entity.name,
          classType: entity.classType
        });
      } else if (kind === "mob") {
        const mobName = entity.name || "Mob";
        const mobStyle = entity.renderStyle || null;
        const signature = buildMobMetaSignature(mobName, mobStyle);
        const previousSignature = sync.mobMetaSignatureBySlot.get(slot);
        if (previousSignature !== signature) {
          meta.push({
            id: slot,
            name: mobName,
            renderStyle: mobStyle
          });
          sync.mobMetaSignatureBySlot.set(slot, signature);
        }
      }
      continue;
    }

    const dx = state.x - previous.x;
    const dy = state.y - previous.y;
    let flags = 0;
    if (state.hp !== previous.hp) {
      flags |= DELTA_FLAG_HP_CHANGED;
    }
    if (state.maxHp !== previous.maxHp) {
      flags |= DELTA_FLAG_MAX_HP_CHANGED;
    }

    const canDelta = slot <= 255 && Math.abs(dx) <= 127 && Math.abs(dy) <= 127;
    const changed = dx !== 0 || dy !== 0 || flags !== 0;

    if (changed) {
      if (canDelta) {
        delta.push({
          id: slot,
          dx,
          dy,
          flags,
          hp: state.hp,
          maxHp: state.maxHp
        });
      } else {
        full.push({ id: slot, ...state });
      }
    }

    store.statesBySlot.set(slot, state);
  }

  const toRemove = [];
  for (const [realId, slot] of store.slotsByRealId.entries()) {
    if (!visibleRealIds.has(realId)) {
      toRemove.push({ realId, slot });
    }
  }

  for (const entry of toRemove) {
    if (entry.slot <= 255) {
      delta.push({
        id: entry.slot,
        dx: 0,
        dy: 0,
        flags: DELTA_FLAG_REMOVED
      });
    }
    store.slotsByRealId.delete(entry.realId);
    store.realIdBySlot.delete(entry.slot);
    store.statesBySlot.delete(entry.slot);
    store.freeSlots.push(entry.slot);
  }

  return { full, delta, meta };
}

function processVisibleProjectiles(sync, entities) {
  const store = getEntitySyncStore(sync, "projectile");
  const full = [];
  const delta = [];
  const meta = [];
  const visibleRealIds = new Set();

  for (const entity of entities) {
    const realId = toEntityRealId(entity.id);
    if (!realId) {
      continue;
    }
    visibleRealIds.add(realId);

    let slot = store.slotsByRealId.get(realId);
    if (!slot) {
      slot = allocateEntitySlot(sync, store);
      if (!slot) {
        continue;
      }
      store.slotsByRealId.set(realId, slot);
      store.realIdBySlot.set(slot, realId);
    }

    const state = {
      x: quantizePos(entity.x),
      y: quantizePos(entity.y)
    };

    const previous = store.statesBySlot.get(slot);
    if (!previous) {
      full.push({ id: slot, ...state });
      store.statesBySlot.set(slot, state);
      const abilityId = String(entity.abilityId || "");
      const previousAbilityId = sync.projectileMetaBySlot.get(slot);
      if (previousAbilityId !== abilityId) {
        sync.projectileMetaBySlot.set(slot, abilityId);
        meta.push({
          id: slot,
          abilityId
        });
      }
      continue;
    }

    const dx = state.x - previous.x;
    const dy = state.y - previous.y;
    const changed = dx !== 0 || dy !== 0;
    const canDelta = slot <= 255 && Math.abs(dx) <= 127 && Math.abs(dy) <= 127;

    if (changed) {
      if (canDelta) {
        delta.push({
          id: slot,
          dx,
          dy,
          flags: 0
        });
      } else {
        full.push({ id: slot, ...state });
      }
    }

    store.statesBySlot.set(slot, state);
    const abilityId = String(entity.abilityId || "");
    const previousAbilityId = sync.projectileMetaBySlot.get(slot);
    if (previousAbilityId !== abilityId) {
      sync.projectileMetaBySlot.set(slot, abilityId);
      meta.push({
        id: slot,
        abilityId
      });
    }
  }

  const toRemove = [];
  for (const [realId, slot] of store.slotsByRealId.entries()) {
    if (!visibleRealIds.has(realId)) {
      toRemove.push({ realId, slot });
    }
  }

  for (const entry of toRemove) {
    if (entry.slot <= 255) {
      delta.push({
        id: entry.slot,
        dx: 0,
        dy: 0,
        flags: DELTA_FLAG_REMOVED
      });
    }
    store.slotsByRealId.delete(entry.realId);
    store.realIdBySlot.delete(entry.slot);
    store.statesBySlot.delete(entry.slot);
    store.freeSlots.push(entry.slot);
  }

  return { full, delta, meta };
}

function processVisibleLootBags(sync, entities, serializeBagItemsForMeta) {
  const store = getEntitySyncStore(sync, "lootbag");
  const full = [];
  const delta = [];
  const meta = [];
  const visibleRealIds = new Set();

  for (const entity of entities) {
    const realId = toEntityRealId(entity.id);
    if (!realId) {
      continue;
    }
    visibleRealIds.add(realId);

    let slot = store.slotsByRealId.get(realId);
    if (!slot) {
      slot = allocateEntitySlot(sync, store);
      if (!slot) {
        continue;
      }
      store.slotsByRealId.set(realId, slot);
      store.realIdBySlot.set(slot, realId);
    }

    const state = {
      x: quantizePos(entity.x),
      y: quantizePos(entity.y)
    };

    const previous = store.statesBySlot.get(slot);
    const currentMetaVersion = Math.max(0, Math.floor(Number(entity.metaVersion) || 0));
    const previousMetaVersion = sync.lootBagMetaVersionBySlot.get(slot);
    if (!previous) {
      full.push({ id: slot, ...state });
      store.statesBySlot.set(slot, state);
      sync.lootBagMetaVersionBySlot.set(slot, currentMetaVersion);
      meta.push({
        id: slot,
        items: serializeBagItemsForMeta(entity.items)
      });
      continue;
    }

    const dx = state.x - previous.x;
    const dy = state.y - previous.y;
    const changed = dx !== 0 || dy !== 0;
    const canDelta = slot <= 255 && Math.abs(dx) <= 127 && Math.abs(dy) <= 127;

    if (changed) {
      if (canDelta) {
        delta.push({
          id: slot,
          dx,
          dy,
          flags: 0
        });
      } else {
        full.push({ id: slot, ...state });
      }
    }

    store.statesBySlot.set(slot, state);
    if (previousMetaVersion !== currentMetaVersion) {
      sync.lootBagMetaVersionBySlot.set(slot, currentMetaVersion);
      meta.push({
        id: slot,
        items: serializeBagItemsForMeta(entity.items)
      });
    }
  }

  const toRemove = [];
  for (const [realId, slot] of store.slotsByRealId.entries()) {
    if (!visibleRealIds.has(realId)) {
      toRemove.push({ realId, slot });
    }
  }

  for (const entry of toRemove) {
    if (entry.slot <= 255) {
      delta.push({
        id: entry.slot,
        dx: 0,
        dy: 0,
        flags: DELTA_FLAG_REMOVED
      });
    }
    store.slotsByRealId.delete(entry.realId);
    store.realIdBySlot.delete(entry.slot);
    store.statesBySlot.delete(entry.slot);
    store.freeSlots.push(entry.slot);
    sync.lootBagMetaVersionBySlot.delete(entry.slot);
  }

  return { full, delta, meta };
}

function encodeFullRecords(records) {
  const buffer = Buffer.alloc(records.length * 8);
  let offset = 0;
  for (const record of records) {
    buffer.writeUInt16LE(record.id, offset);
    buffer.writeUInt16LE(record.x, offset + 2);
    buffer.writeUInt16LE(record.y, offset + 4);
    buffer.writeUInt8(record.hp, offset + 6);
    buffer.writeUInt8(record.maxHp, offset + 7);
    offset += 8;
  }
  return buffer;
}

function encodeDeltaRecords(records) {
  const bytes = [];

  for (const record of records) {
    bytes.push(record.id & 0xff);
    bytes.push(record.dx & 0xff);
    bytes.push(record.dy & 0xff);
    bytes.push(record.flags & 0xff);

    if (record.flags & DELTA_FLAG_HP_CHANGED) {
      bytes.push(record.hp & 0xff);
    }
    if (record.flags & DELTA_FLAG_MAX_HP_CHANGED) {
      bytes.push(record.maxHp & 0xff);
    }
  }

  return Buffer.from(bytes);
}

function encodeProjectileFullRecords(records) {
  const buffer = Buffer.alloc(records.length * 6);
  let offset = 0;
  for (const record of records) {
    buffer.writeUInt16LE(record.id, offset);
    buffer.writeUInt16LE(record.x, offset + 2);
    buffer.writeUInt16LE(record.y, offset + 4);
    offset += 6;
  }
  return buffer;
}

function encodeProjectileDeltaRecords(records) {
  const bytes = [];
  for (const record of records) {
    bytes.push(record.id & 0xff);
    bytes.push(record.dx & 0xff);
    bytes.push(record.dy & 0xff);
    bytes.push(record.flags & 0xff);
  }
  return Buffer.from(bytes);
}

function processSelfUpdate(sync, player, getPendingHealAmount, getPendingManaAmount) {
  const state = {
    x: quantizePos(player.x),
    y: quantizePos(player.y),
    hp: clamp(player.hp, 0, 255),
    maxHp: clamp(player.maxHp, 0, 255),
    mana: clamp(Math.round((Number(player.mana) || 0) * MANA_SCALE), 0, 65535),
    maxMana: clamp(Math.round((Number(player.maxMana) || 0) * MANA_SCALE), 0, 65535),
    pendingHeal: clamp(Math.round(getPendingHealAmount(player) * HEAL_SCALE), 0, 65535),
    pendingMana: clamp(Math.round(getPendingManaAmount(player) * MANA_SCALE), 0, 65535),
    copper: clamp(player.copper, 0, 65535),
    level: clamp(player.level, 1, 65535),
    exp: clamp(player.exp, 0, 4294967295),
    expToNext: clamp(player.expToNext, 1, 4294967295)
  };

  const previous = sync.selfState;
  if (!previous) {
    sync.selfState = state;
    return {
      mode: SELF_MODE_FULL,
      flags: 0,
      ...state
    };
  }

  const dx = state.x - previous.x;
  const dy = state.y - previous.y;
  let flags = 0;
  if (state.hp !== previous.hp) {
    flags |= DELTA_FLAG_HP_CHANGED;
  }
  if (state.maxHp !== previous.maxHp) {
    flags |= DELTA_FLAG_MAX_HP_CHANGED;
  }
  if (state.mana !== previous.mana) {
    flags |= DELTA_FLAG_MANA_CHANGED;
  }
  if (state.maxMana !== previous.maxMana) {
    flags |= DELTA_FLAG_MAX_MANA_CHANGED;
  }
  if (state.pendingHeal !== previous.pendingHeal) {
    flags |= DELTA_FLAG_PENDING_HEAL_CHANGED;
  }
  if (state.pendingMana !== previous.pendingMana) {
    flags |= SELF_FLAG_PENDING_MANA_CHANGED;
  }
  if (state.copper !== previous.copper) {
    flags |= DELTA_FLAG_COPPER_CHANGED;
  }
  if (state.level !== previous.level || state.exp !== previous.exp || state.expToNext !== previous.expToNext) {
    flags |= DELTA_FLAG_PROGRESS_CHANGED;
  }

  const changed = dx !== 0 || dy !== 0 || flags !== 0;
  if (!changed) {
    return { mode: SELF_MODE_NONE, flags: 0 };
  }

  sync.selfState = state;
  if (Math.abs(dx) <= 127 && Math.abs(dy) <= 127) {
    return {
      mode: SELF_MODE_DELTA,
      flags,
      dx,
      dy,
      hp: state.hp,
      maxHp: state.maxHp,
      mana: state.mana,
      maxMana: state.maxMana,
      pendingHeal: state.pendingHeal,
      pendingMana: state.pendingMana
    };
  }

  return {
    mode: SELF_MODE_FULL,
    flags: 0,
    ...state
  };
}

function encodeSelfUpdate(update) {
  if (update.mode === SELF_MODE_NONE) {
    return Buffer.alloc(0);
  }

  if (update.mode === SELF_MODE_FULL) {
    const buffer = Buffer.alloc(26);
    buffer.writeUInt16LE(update.x, 0);
    buffer.writeUInt16LE(update.y, 2);
    buffer.writeUInt8(update.hp, 4);
    buffer.writeUInt8(update.maxHp, 5);
    buffer.writeUInt16LE(update.mana, 6);
    buffer.writeUInt16LE(update.maxMana, 8);
    buffer.writeUInt16LE(update.pendingHeal, 10);
    buffer.writeUInt16LE(update.pendingMana, 12);
    buffer.writeUInt16LE(update.copper, 14);
    buffer.writeUInt16LE(update.level, 16);
    buffer.writeUInt32LE(update.exp, 18);
    buffer.writeUInt32LE(update.expToNext, 22);
    return buffer;
  }

  const bytes = [update.dx & 0xff, update.dy & 0xff];
  if (update.flags & DELTA_FLAG_HP_CHANGED) {
    bytes.push(update.hp & 0xff);
  }
  if (update.flags & DELTA_FLAG_MAX_HP_CHANGED) {
    bytes.push(update.maxHp & 0xff);
  }
  if (update.flags & DELTA_FLAG_MANA_CHANGED) {
    bytes.push(update.mana & 0xff, (update.mana >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_MAX_MANA_CHANGED) {
    bytes.push(update.maxMana & 0xff, (update.maxMana >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_PENDING_HEAL_CHANGED) {
    bytes.push(update.pendingHeal & 0xff, (update.pendingHeal >> 8) & 0xff);
  }
  if (update.flags & SELF_FLAG_PENDING_MANA_CHANGED) {
    bytes.push(update.pendingMana & 0xff, (update.pendingMana >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_COPPER_CHANGED) {
    bytes.push(update.copper & 0xff, (update.copper >> 8) & 0xff);
  }
  if (update.flags & DELTA_FLAG_PROGRESS_CHANGED) {
    bytes.push(update.level & 0xff, (update.level >> 8) & 0xff);
    bytes.push(update.exp & 0xff, (update.exp >> 8) & 0xff, (update.exp >> 16) & 0xff, (update.exp >> 24) & 0xff);
    bytes.push(
      update.expToNext & 0xff,
      (update.expToNext >> 8) & 0xff,
      (update.expToNext >> 16) & 0xff,
      (update.expToNext >> 24) & 0xff
    );
  }
  return Buffer.from(bytes);
}

function createEntityUpdatePacketBuilder(options = {}) {
  const getPendingHealAmount = typeof options.getPendingHealAmount === "function" ? options.getPendingHealAmount : () => 0;
  const getPendingManaAmount = typeof options.getPendingManaAmount === "function" ? options.getPendingManaAmount : () => 0;
  const serializeBagItemsForMeta =
    typeof options.serializeBagItemsForMeta === "function" ? options.serializeBagItemsForMeta : () => [];

  return function buildEntityUpdatePacket(player, visiblePlayers, visibleMobs, visibleProjectiles, visibleLootBags) {
    const sync = player.entitySync;
    const selfUpdate = processSelfUpdate(sync, player, getPendingHealAmount, getPendingManaAmount);
    const playerUpdates = processVisibleEntities(sync, "player", visiblePlayers);
    const mobUpdates = processVisibleEntities(sync, "mob", visibleMobs);
    const projectileUpdates = processVisibleProjectiles(sync, visibleProjectiles);
    const lootBagUpdates = processVisibleLootBags(sync, visibleLootBags, serializeBagItemsForMeta);

    const selfBuffer = encodeSelfUpdate(selfUpdate);
    const fullPlayersBuffer = encodeFullRecords(playerUpdates.full);
    const deltaPlayersBuffer = encodeDeltaRecords(playerUpdates.delta);
    const fullMobsBuffer = encodeFullRecords(mobUpdates.full);
    const deltaMobsBuffer = encodeDeltaRecords(mobUpdates.delta);
    const fullProjectilesBuffer = encodeProjectileFullRecords(projectileUpdates.full);
    const deltaProjectilesBuffer = encodeProjectileDeltaRecords(projectileUpdates.delta);
    const fullLootBagsBuffer = encodeProjectileFullRecords(lootBagUpdates.full);
    const deltaLootBagsBuffer = encodeProjectileDeltaRecords(lootBagUpdates.delta);

    const header = Buffer.alloc(20);
    header.writeUInt8(ENTITY_PROTO_TYPE, 0);
    header.writeUInt8(ENTITY_PROTO_VERSION, 1);
    header.writeUInt8(selfUpdate.mode, 2);
    header.writeUInt8(selfUpdate.flags, 3);
    header.writeUInt16LE(playerUpdates.full.length, 4);
    header.writeUInt16LE(playerUpdates.delta.length, 6);
    header.writeUInt16LE(mobUpdates.full.length, 8);
    header.writeUInt16LE(mobUpdates.delta.length, 10);
    header.writeUInt16LE(projectileUpdates.full.length, 12);
    header.writeUInt16LE(projectileUpdates.delta.length, 14);
    header.writeUInt16LE(lootBagUpdates.full.length, 16);
    header.writeUInt16LE(lootBagUpdates.delta.length, 18);

    const hasAnyUpdate =
      selfUpdate.mode !== SELF_MODE_NONE ||
      playerUpdates.full.length > 0 ||
      playerUpdates.delta.length > 0 ||
      mobUpdates.full.length > 0 ||
      mobUpdates.delta.length > 0 ||
      projectileUpdates.full.length > 0 ||
      projectileUpdates.delta.length > 0 ||
      lootBagUpdates.full.length > 0 ||
      lootBagUpdates.delta.length > 0;

    return {
      packet: hasAnyUpdate
        ? Buffer.concat([
            header,
            selfBuffer,
            fullPlayersBuffer,
            deltaPlayersBuffer,
            fullMobsBuffer,
            deltaMobsBuffer,
            fullProjectilesBuffer,
            deltaProjectilesBuffer,
            fullLootBagsBuffer,
            deltaLootBagsBuffer
          ])
        : null,
      playerMeta: playerUpdates.meta,
      mobMeta: mobUpdates.meta,
      projectileMeta: projectileUpdates.meta,
      lootBagMeta: lootBagUpdates.meta
    };
  };
}

module.exports = {
  createEntityUpdatePacketBuilder
};
