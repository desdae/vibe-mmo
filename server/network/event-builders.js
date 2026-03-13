const PROTOCOL = require("../../public/shared/protocol");

const {
  MOB_EFFECT_FLAG_STUN,
  MOB_EFFECT_FLAG_SLOW,
  MOB_EFFECT_FLAG_REMOVE,
  MOB_EFFECT_FLAG_BURN,
  MOB_EFFECT_FLAG_BLOOD_WRATH
} = PROTOCOL;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getBloodWrathBuffEndsAt(player, now = Date.now()) {
  if (!player || !Array.isArray(player.activeBuffs)) {
    return 0;
  }
  let endsAt = 0;
  for (const buff of player.activeBuffs) {
    if (!buff || typeof buff !== "object") {
      continue;
    }
    if (String(buff.sourceAbilityId || "").trim().toLowerCase() !== "bloodwrath") {
      continue;
    }
    const buffEndsAt = Math.max(0, Math.floor(Number(buff.endsAt) || 0));
    if (buffEndsAt > now) {
      endsAt = Math.max(endsAt, buffEndsAt);
    }
  }
  return endsAt;
}

function toEntityRealId(entityId) {
  const numericId = Number(entityId);
  if (!Number.isFinite(numericId)) {
    return 0;
  }
  return numericId;
}

function buildPlayerSwingEventsForRecipient(recipient, nearbyPlayerObjects) {
  const sync = recipient.entitySync;
  const events = [];

  for (const other of nearbyPlayerObjects) {
    const realId = toEntityRealId(other.id);
    if (!realId) {
      continue;
    }

    const slot = sync.playerSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }

    const currentSwingCounter = other.swingCounter & 0xff;
    const previousSwingCounter = sync.playerSwingBySlot.get(slot);
    if (previousSwingCounter === undefined) {
      sync.playerSwingBySlot.set(slot, currentSwingCounter);
      continue;
    }
    if (previousSwingCounter === currentSwingCounter) {
      continue;
    }

    sync.playerSwingBySlot.set(slot, currentSwingCounter);
    events.push({
      id: slot,
      dx: Number(other.lastSwingDirection.dx.toFixed(2)),
      dy: Number(other.lastSwingDirection.dy.toFixed(2))
    });
  }

  for (const slot of Array.from(sync.playerSwingBySlot.keys())) {
    if (!sync.playerRealIdBySlot.has(slot)) {
      sync.playerSwingBySlot.delete(slot);
    }
  }

  return events;
}

function buildPlayerCastEventsForRecipient(recipient, nearbyPlayerObjects, now) {
  const sync = recipient.entitySync;
  const casts = [];

  for (const other of nearbyPlayerObjects) {
    const realId = toEntityRealId(other.id);
    if (!realId) {
      continue;
    }
    const slot = sync.playerSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }

    const currentVersion = Number(other.castStateVersion) & 0xffff;
    const previousVersion = sync.playerCastVersionBySlot.get(slot);
    const activeCast = other.activeCast && now < other.activeCast.endsAt ? other.activeCast : null;

    if (previousVersion === undefined) {
      sync.playerCastVersionBySlot.set(slot, currentVersion);
      if (activeCast) {
        casts.push({
          id: slot,
          active: true,
          abilityId: String(activeCast.abilityId || ""),
          durationMs: Math.max(1, Math.floor(Number(activeCast.durationMs) || 0)),
          elapsedMs: clamp(now - activeCast.startedAt, 0, activeCast.durationMs),
          isCharge: !!activeCast.isCharge,
          chargeStartX: activeCast.chargeStartX,
          chargeStartY: activeCast.chargeStartY,
          chargeTargetX: activeCast.chargeTargetX,
          chargeTargetY: activeCast.chargeTargetY
        });
      }
      continue;
    }

    if (previousVersion !== currentVersion) {
      sync.playerCastVersionBySlot.set(slot, currentVersion);
      if (activeCast) {
        casts.push({
          id: slot,
          active: true,
          abilityId: String(activeCast.abilityId || ""),
          durationMs: Math.max(1, Math.floor(Number(activeCast.durationMs) || 0)),
          elapsedMs: clamp(now - activeCast.startedAt, 0, activeCast.durationMs),
          isCharge: !!activeCast.isCharge,
          chargeStartX: activeCast.chargeStartX,
          chargeStartY: activeCast.chargeStartY,
          chargeTargetX: activeCast.chargeTargetX,
          chargeTargetY: activeCast.chargeTargetY
        });
      } else {
        casts.push({
          id: slot,
          active: false
        });
      }
    }
  }

  for (const slot of Array.from(sync.playerCastVersionBySlot.keys())) {
    if (!sync.playerRealIdBySlot.has(slot)) {
      sync.playerCastVersionBySlot.delete(slot);
    }
  }

  const selfCast = recipient.activeCast && now < recipient.activeCast.endsAt ? recipient.activeCast : null;
  const currentSelfVersion = Number(recipient.castStateVersion) & 0xffff;
  let self = null;
  if (sync.selfCastVersion === null || sync.selfCastVersion === undefined) {
    sync.selfCastVersion = currentSelfVersion;
    if (selfCast) {
      self = {
        active: true,
        abilityId: String(selfCast.abilityId || ""),
        durationMs: Math.max(1, Math.floor(Number(selfCast.durationMs) || 0)),
        elapsedMs: clamp(now - selfCast.startedAt, 0, selfCast.durationMs),
        isCharge: !!selfCast.isCharge,
        chargeStartX: selfCast.chargeStartX,
        chargeStartY: selfCast.chargeStartY,
        chargeTargetX: selfCast.chargeTargetX,
        chargeTargetY: selfCast.chargeTargetY
      };
    }
  } else if (sync.selfCastVersion !== currentSelfVersion) {
    sync.selfCastVersion = currentSelfVersion;
    if (selfCast) {
      self = {
        active: true,
        abilityId: String(selfCast.abilityId || ""),
        durationMs: Math.max(1, Math.floor(Number(selfCast.durationMs) || 0)),
        elapsedMs: clamp(now - selfCast.startedAt, 0, selfCast.durationMs),
        isCharge: !!selfCast.isCharge,
        chargeStartX: selfCast.chargeStartX,
        chargeStartY: selfCast.chargeStartY,
        chargeTargetX: selfCast.chargeTargetX,
        chargeTargetY: selfCast.chargeTargetY
      };
    } else {
      self = {
        active: false
      };
    }
  }

  return { casts, self };
}

function buildMobCastEventsForRecipient(recipient, nearbyMobObjects, now) {
  const sync = recipient.entitySync;
  const casts = [];

  for (const mob of nearbyMobObjects) {
    const realId = toEntityRealId(mob.id);
    if (!realId) {
      continue;
    }
    const slot = sync.mobSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }

    const currentVersion = Number(mob.castStateVersion) & 0xffff;
    const previousVersion = sync.mobCastVersionBySlot.get(slot);
    const activeCast = mob.activeCast && now < mob.activeCast.endsAt ? mob.activeCast : null;

    if (previousVersion === undefined) {
      sync.mobCastVersionBySlot.set(slot, currentVersion);
      if (activeCast) {
        casts.push({
          id: slot,
          active: true,
          abilityId: String(activeCast.abilityId || ""),
          durationMs: Math.max(1, Math.floor(Number(activeCast.durationMs) || 0)),
          elapsedMs: clamp(now - activeCast.startedAt, 0, activeCast.durationMs)
        });
      }
      continue;
    }

    if (previousVersion !== currentVersion) {
      sync.mobCastVersionBySlot.set(slot, currentVersion);
      if (activeCast) {
        casts.push({
          id: slot,
          active: true,
          abilityId: String(activeCast.abilityId || ""),
          durationMs: Math.max(1, Math.floor(Number(activeCast.durationMs) || 0)),
          elapsedMs: clamp(now - activeCast.startedAt, 0, activeCast.durationMs)
        });
      } else {
        casts.push({
          id: slot,
          active: false
        });
      }
    }
  }

  for (const slot of Array.from(sync.mobCastVersionBySlot.keys())) {
    if (!sync.mobRealIdBySlot.has(slot)) {
      sync.mobCastVersionBySlot.delete(slot);
    }
  }

  return casts;
}

function buildMobBiteEventsForRecipient(recipient, nearbyMobObjects) {
  const sync = recipient.entitySync;
  const events = [];

  for (const mob of nearbyMobObjects) {
    const realId = toEntityRealId(mob.id);
    if (!realId) {
      continue;
    }

    const slot = sync.mobSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }

    const currentBiteCounter = mob.biteCounter & 0xff;
    const previousBiteCounter = sync.mobBiteBySlot.get(slot);
    if (previousBiteCounter === undefined) {
      sync.mobBiteBySlot.set(slot, currentBiteCounter);
      continue;
    }
    if (previousBiteCounter === currentBiteCounter) {
      continue;
    }

    sync.mobBiteBySlot.set(slot, currentBiteCounter);
    const abilityId = String(mob.lastAttackAbilityId || "").trim().slice(0, 64);
    events.push({
      id: slot,
      dx: Number(mob.lastBiteDirection.dx.toFixed(2)),
      dy: Number(mob.lastBiteDirection.dy.toFixed(2)),
      abilityId
    });
  }

  for (const slot of Array.from(sync.mobBiteBySlot.keys())) {
    if (!sync.mobRealIdBySlot.has(slot)) {
      sync.mobBiteBySlot.delete(slot);
    }
  }

  return events;
}

function buildMobEffectEventsForRecipient(recipient, nearbyMobObjects, now = Date.now()) {
  const events = [];
  const sync = recipient.entitySync;
  const visibleSlots = new Set();

  for (const mob of nearbyMobObjects) {
    if (!mob.alive) {
      continue;
    }
    const realId = toEntityRealId(mob.id);
    if (!realId) {
      continue;
    }
    const slot = sync.mobSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }
    visibleSlots.add(slot);

    const stunnedUntil = Math.max(0, Math.floor(Number(mob.stunnedUntil) || 0));
    const slowUntil = Math.max(0, Math.floor(Number(mob.slowUntil) || 0));
    const burningUntil = Math.max(0, Math.floor(Number(mob.burningUntil) || 0));
    const hasStun = stunnedUntil > now;
    const hasSlow = slowUntil > now;
    const hasBurn = burningUntil > now;
    const slowMultiplierQ = clamp(Math.round(clamp(Number(mob.slowMultiplier) || 1, 0.1, 1) * 1000), 1, 1000);
    const previous = sync.mobEffectStatesBySlot.get(slot);

    if (!hasStun && !hasSlow && !hasBurn) {
      if (previous) {
        events.push({
          id: slot,
          flags: MOB_EFFECT_FLAG_REMOVE
        });
        sync.mobEffectStatesBySlot.delete(slot);
      }
      continue;
    }

    const nextState = {
      stunnedUntil: hasStun ? stunnedUntil : 0,
      slowUntil: hasSlow ? slowUntil : 0,
      burningUntil: hasBurn ? burningUntil : 0,
      slowMultiplierQ: hasSlow ? slowMultiplierQ : 1000
    };

    const changed =
      !previous ||
      previous.stunnedUntil !== nextState.stunnedUntil ||
      previous.slowUntil !== nextState.slowUntil ||
      previous.burningUntil !== nextState.burningUntil ||
      previous.slowMultiplierQ !== nextState.slowMultiplierQ;

    if (changed) {
      let flags = 0;
      if (hasStun) {
        flags |= MOB_EFFECT_FLAG_STUN;
      }
      if (hasSlow) {
        flags |= MOB_EFFECT_FLAG_SLOW;
      }
      if (hasBurn) {
        flags |= MOB_EFFECT_FLAG_BURN;
      }
      events.push({
        id: slot,
        flags,
        stunnedMs: hasStun ? clamp(stunnedUntil - now, 1, 65535) : 0,
        slowedMs: hasSlow ? clamp(slowUntil - now, 1, 65535) : 0,
        burningMs: hasBurn ? clamp(burningUntil - now, 1, 65535) : 0,
        slowMultiplierQ: hasSlow ? slowMultiplierQ : 1000
      });
    }
    sync.mobEffectStatesBySlot.set(slot, nextState);
  }

  for (const [slot] of Array.from(sync.mobEffectStatesBySlot.entries())) {
    if (!sync.mobRealIdBySlot.has(slot) || !visibleSlots.has(slot)) {
      events.push({
        id: slot,
        flags: MOB_EFFECT_FLAG_REMOVE
      });
      sync.mobEffectStatesBySlot.delete(slot);
    }
  }

  return events;
}

function buildSelfPlayerEffectUpdate(player, now = Date.now()) {
  if (!player || !player.entitySync) {
    return null;
  }
  const sync = player.entitySync;
  const stunnedUntil = Math.max(0, Math.floor(Number(player.stunnedUntil) || 0));
  const slowUntil = Math.max(0, Math.floor(Number(player.slowUntil) || 0));
  const burningUntil = Math.max(0, Math.floor(Number(player.burningUntil) || 0));
  const bloodWrathUntil = getBloodWrathBuffEndsAt(player, now);
  const hasStun = stunnedUntil > now;
  const hasSlow = slowUntil > now;
  const hasBurn = burningUntil > now;
  const hasBloodWrath = bloodWrathUntil > now;

  const nextState = {
    stunnedUntil: hasStun ? stunnedUntil : 0,
    stunDurationMs: hasStun ? clamp(Math.floor(Number(player.stunDurationMs) || stunnedUntil - now), 1, 65535) : 0,
    slowUntil: hasSlow ? slowUntil : 0,
    slowDurationMs: hasSlow ? clamp(Math.floor(Number(player.slowDurationMs) || slowUntil - now), 1, 65535) : 0,
    slowMultiplierQ: hasSlow
      ? clamp(Math.round(clamp(Number(player.slowMultiplier) || 1, 0.1, 1) * 1000), 1, 1000)
      : 1000,
    burningUntil: hasBurn ? burningUntil : 0,
    burnDurationMs: hasBurn ? clamp(Math.floor(Number(player.burnDurationMs) || burningUntil - now), 1, 65535) : 0,
    bloodWrathUntil: hasBloodWrath ? bloodWrathUntil : 0
  };

  const previous = sync.selfEffectState;
  const changed =
    !previous ||
    previous.stunnedUntil !== nextState.stunnedUntil ||
    previous.stunDurationMs !== nextState.stunDurationMs ||
    previous.slowUntil !== nextState.slowUntil ||
    previous.slowDurationMs !== nextState.slowDurationMs ||
    previous.slowMultiplierQ !== nextState.slowMultiplierQ ||
    previous.burningUntil !== nextState.burningUntil ||
    previous.burnDurationMs !== nextState.burnDurationMs ||
    previous.bloodWrathUntil !== nextState.bloodWrathUntil;

  if (!changed) {
    return null;
  }
  sync.selfEffectState = nextState;
  return {
    stunnedMs: hasStun ? clamp(stunnedUntil - now, 1, 65535) : 0,
    stunDurationMs: nextState.stunDurationMs,
    slowedMs: hasSlow ? clamp(slowUntil - now, 1, 65535) : 0,
    slowDurationMs: nextState.slowDurationMs,
    slowMultiplierQ: nextState.slowMultiplierQ,
    burningMs: hasBurn ? clamp(burningUntil - now, 1, 65535) : 0,
    burnDurationMs: nextState.burnDurationMs,
    bloodWrathMs: hasBloodWrath ? clamp(bloodWrathUntil - now, 1, 65535) : 0
  };
}

function buildPlayerEffectEventsForRecipient(recipient, nearbyPlayerObjects, now = Date.now()) {
  const sync = recipient.entitySync;
  const events = [];
  const visibleSlots = new Set();

  for (const other of nearbyPlayerObjects) {
    const realId = toEntityRealId(other.id);
    if (!realId) {
      continue;
    }
    const slot = sync.playerSlotsByRealId.get(realId);
    if (!slot) {
      continue;
    }
    visibleSlots.add(slot);

    const stunnedUntil = Math.max(0, Math.floor(Number(other.stunnedUntil) || 0));
    const slowUntil = Math.max(0, Math.floor(Number(other.slowUntil) || 0));
    const burningUntil = Math.max(0, Math.floor(Number(other.burningUntil) || 0));
    const bloodWrathUntil = getBloodWrathBuffEndsAt(other, now);
    const hasStun = stunnedUntil > now;
    const hasSlow = slowUntil > now;
    const hasBurn = burningUntil > now;
    const hasBloodWrath = bloodWrathUntil > now;
    const slowMultiplierQ = hasSlow
      ? clamp(Math.round(clamp(Number(other.slowMultiplier) || 1, 0.1, 1) * 1000), 1, 1000)
      : 1000;
    const nextState = {
      stunnedUntil: hasStun ? stunnedUntil : 0,
      slowUntil: hasSlow ? slowUntil : 0,
      burningUntil: hasBurn ? burningUntil : 0,
      slowMultiplierQ,
      bloodWrathUntil: hasBloodWrath ? bloodWrathUntil : 0
    };
    const previous = sync.playerEffectStatesBySlot.get(slot);
    const changed =
      !previous ||
      previous.stunnedUntil !== nextState.stunnedUntil ||
      previous.slowUntil !== nextState.slowUntil ||
      previous.burningUntil !== nextState.burningUntil ||
      previous.slowMultiplierQ !== nextState.slowMultiplierQ ||
      previous.bloodWrathUntil !== nextState.bloodWrathUntil;
    if (!changed) {
      continue;
    }
    sync.playerEffectStatesBySlot.set(slot, nextState);
    events.push({
      id: slot,
      stunnedMs: hasStun ? clamp(stunnedUntil - now, 1, 65535) : 0,
      slowedMs: hasSlow ? clamp(slowUntil - now, 1, 65535) : 0,
      burningMs: hasBurn ? clamp(burningUntil - now, 1, 65535) : 0,
      slowMultiplierQ,
      bloodWrathMs: hasBloodWrath ? clamp(bloodWrathUntil - now, 1, 65535) : 0
    });
  }

  for (const [slot] of Array.from(sync.playerEffectStatesBySlot.entries())) {
    if (!sync.playerRealIdBySlot.has(slot) || !visibleSlots.has(slot)) {
      events.push({
        id: slot,
        stunnedMs: 0,
        slowedMs: 0,
        burningMs: 0,
        slowMultiplierQ: 1000,
        bloodWrathMs: 0
      });
      sync.playerEffectStatesBySlot.delete(slot);
    }
  }

  return events;
}

function createEventBuilders() {
  return {
    buildPlayerSwingEventsForRecipient,
    buildPlayerCastEventsForRecipient,
    buildMobCastEventsForRecipient,
    buildMobBiteEventsForRecipient,
    buildMobEffectEventsForRecipient,
    buildSelfPlayerEffectUpdate,
    buildPlayerEffectEventsForRecipient
  };
}

module.exports = {
  createEventBuilders
};
