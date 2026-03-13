const PROTOCOL = require("../../public/shared/protocol");
const PROTOCOL_CODECS = require("../../public/shared/protocol-codecs");

const {
  MOB_EFFECT_PROTO_TYPE,
  MOB_EFFECT_PROTO_VERSION,
  AREA_EFFECT_PROTO_TYPE,
  AREA_EFFECT_PROTO_VERSION,
  MOB_META_PROTO_TYPE,
  MOB_META_PROTO_VERSION,
  PROJECTILE_META_PROTO_TYPE,
  PROJECTILE_META_PROTO_VERSION,
  DAMAGE_EVENT_PROTO_TYPE,
  DAMAGE_EVENT_PROTO_VERSION,
  PLAYER_META_PROTO_TYPE,
  PLAYER_META_PROTO_VERSION,
  LOOTBAG_META_PROTO_TYPE,
  LOOTBAG_META_PROTO_VERSION,
  PLAYER_SWING_PROTO_TYPE,
  PLAYER_SWING_PROTO_VERSION,
  CAST_EVENT_PROTO_TYPE,
  CAST_EVENT_PROTO_VERSION,
  PLAYER_EFFECT_PROTO_TYPE,
  PLAYER_EFFECT_PROTO_VERSION,
  MOB_BITE_PROTO_TYPE,
  MOB_BITE_PROTO_VERSION,
  EXPLOSION_EVENT_PROTO_TYPE,
  EXPLOSION_EVENT_PROTO_VERSION,
  PROJECTILE_HIT_EVENT_PROTO_TYPE,
  PROJECTILE_HIT_EVENT_PROTO_VERSION,
  MOB_DEATH_EVENT_PROTO_TYPE,
  MOB_DEATH_EVENT_PROTO_VERSION,
  MOB_EFFECT_FLAG_STUN,
  MOB_EFFECT_FLAG_SLOW,
  MOB_EFFECT_FLAG_REMOVE,
  MOB_EFFECT_FLAG_BURN,
  MOB_EFFECT_FLAG_BLOOD_WRATH,
  CAST_EVENT_KIND_PLAYER,
  CAST_EVENT_KIND_MOB,
  CAST_EVENT_KIND_SELF,
  CAST_EVENT_FLAG_ACTIVE,
  AREA_EFFECT_OP_UPSERT,
  AREA_EFFECT_OP_REMOVE,
  AREA_EFFECT_KIND_AREA,
  AREA_EFFECT_KIND_BEAM,
  AREA_EFFECT_KIND_SUMMON
} = PROTOCOL;
const {
  clamp,
  quantizePos,
  encodeDamageEventFlags,
  hashString32,
  encodeUnitDirectionComponent
} = PROTOCOL_CODECS;

function encodeMobEffectEventPacket(events) {
  const bytes = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(MOB_EFFECT_PROTO_TYPE, 0);
  header.writeUInt8(MOB_EFFECT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  for (const event of events) {
    const id = clamp(Math.floor(Number(event.id) || 0), 0, 255);
    const flags = clamp(Math.floor(Number(event.flags) || 0), 0, 255);
    bytes.push(id & 0xff);
    bytes.push(flags & 0xff);

    if (flags & MOB_EFFECT_FLAG_STUN) {
      const stunnedMs = clamp(Math.floor(Number(event.stunnedMs) || 0), 1, 65535);
      bytes.push(stunnedMs & 0xff, (stunnedMs >> 8) & 0xff);
    }
    if (flags & MOB_EFFECT_FLAG_SLOW) {
      const slowedMs = clamp(Math.floor(Number(event.slowedMs) || 0), 1, 65535);
      const slowMultiplierQ = clamp(Math.floor(Number(event.slowMultiplierQ) || 1000), 1, 1000);
      bytes.push(slowedMs & 0xff, (slowedMs >> 8) & 0xff);
      bytes.push(slowMultiplierQ & 0xff, (slowMultiplierQ >> 8) & 0xff);
    }
    if (flags & MOB_EFFECT_FLAG_BURN) {
      const burningMs = clamp(Math.floor(Number(event.burningMs) || 0), 1, 65535);
      bytes.push(burningMs & 0xff, (burningMs >> 8) & 0xff);
    }
  }

  return Buffer.concat([header, Buffer.from(bytes)]);
}

function encodeAreaEffectEventPacket(events) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(AREA_EFFECT_PROTO_TYPE, 0);
  header.writeUInt8(AREA_EFFECT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);
  parts.push(header);

  for (const event of events) {
    const op = Number(event.op) === AREA_EFFECT_OP_REMOVE ? AREA_EFFECT_OP_REMOVE : AREA_EFFECT_OP_UPSERT;
    const id = clamp(Math.floor(Number(event.id) || 0), 0, 0xffffffff);
    const base = Buffer.alloc(5);
    base.writeUInt8(op, 0);
    base.writeUInt32LE(id, 1);
    parts.push(base);
    if (op !== AREA_EFFECT_OP_UPSERT) {
      continue;
    }

    const abilityBytes = Buffer.from(String(event.abilityId || "").slice(0, 64), "utf8");
    const details = Buffer.alloc(12);
    const kind =
      Number(event.kind) === AREA_EFFECT_KIND_BEAM
        ? AREA_EFFECT_KIND_BEAM
        : Number(event.kind) === AREA_EFFECT_KIND_SUMMON
          ? AREA_EFFECT_KIND_SUMMON
          : AREA_EFFECT_KIND_AREA;
    details.writeUInt8(kind, 0);
    details.writeUInt16LE(clamp(Math.floor(Number(event.xQ) || 0), 0, 65535), 1);
    details.writeUInt16LE(clamp(Math.floor(Number(event.yQ) || 0), 0, 65535), 3);
    details.writeUInt16LE(clamp(Math.floor(Number(event.radiusQ) || 0), 1, 65535), 5);
    details.writeUInt16LE(clamp(Math.floor(Number(event.remainingMs) || 0), 1, 65535), 7);
    details.writeUInt16LE(clamp(Math.floor(Number(event.durationMs) || 0), 1, 65535), 9);
    details.writeUInt8(abilityBytes.length, 11);
    parts.push(details);
    if (abilityBytes.length) {
      parts.push(abilityBytes);
    }

    if (kind === AREA_EFFECT_KIND_BEAM) {
      const beam = Buffer.alloc(12);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.startXQ) || 0), 0, 65535), 0);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.startYQ) || 0), 0, 65535), 2);
      beam.writeInt16LE(clamp(Math.floor(Number(event.dxQ) || 0), -32767, 32767), 4);
      beam.writeInt16LE(clamp(Math.floor(Number(event.dyQ) || 0), -32767, 32767), 6);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.lengthQ) || 0), 1, 65535), 8);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.widthQ) || 0), 1, 65535), 10);
      parts.push(beam);
    } else if (kind === AREA_EFFECT_KIND_SUMMON) {
      const summon = Buffer.alloc(7);
      summon.writeUInt8(clamp(Math.floor(Number(event.summonCount) || 1), 1, 255), 0);
      summon.writeUInt16LE(clamp(Math.floor(Number(event.attackIntervalMs) || 1000), 1, 65535), 1);
      summon.writeUInt16LE(clamp(Math.floor(Number(event.attackRangeQ) || 0), 1, 65535), 3);
      summon.writeUInt16LE(clamp(Math.floor(Number(event.formationRadiusQ) || 0), 0, 65535), 5);
      parts.push(summon);
    }
  }

  return Buffer.concat(parts);
}

function encodeMobMetaPacket(mobsMeta) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(MOB_META_PROTO_TYPE, 0);
  header.writeUInt8(MOB_META_PROTO_VERSION, 1);
  header.writeUInt16LE(mobsMeta.length, 2);
  parts.push(header);

  for (const meta of mobsMeta) {
    const id = clamp(Math.floor(Number(meta && meta.id) || 0), 0, 255);
    const level = clamp(Math.floor(Number(meta && meta.level) || 1), 1, 65535);
    const nameBytesRaw = Buffer.from(String((meta && meta.name) || "Mob"), "utf8");
    const nameBytes = nameBytesRaw.length > 255 ? nameBytesRaw.subarray(0, 255) : nameBytesRaw;

    let styleString = "";
    if (meta && meta.renderStyle && typeof meta.renderStyle === "object") {
      try {
        styleString = JSON.stringify(meta.renderStyle);
      } catch (_error) {
        styleString = "";
      }
    }
    const styleBytesRaw = Buffer.from(styleString, "utf8");
    const styleBytes = styleBytesRaw.length > 65535 ? styleBytesRaw.subarray(0, 65535) : styleBytesRaw;

    const recordHeader = Buffer.alloc(6);
    recordHeader.writeUInt8(id, 0);
    recordHeader.writeUInt8(nameBytes.length, 1);
    recordHeader.writeUInt16LE(level, 2);
    recordHeader.writeUInt16LE(styleBytes.length, 4);
    parts.push(recordHeader);
    if (nameBytes.length) {
      parts.push(nameBytes);
    }
    if (styleBytes.length) {
      parts.push(styleBytes);
    }
  }

  return Buffer.concat(parts);
}

function encodeProjectileMetaPacket(projectileMeta) {
  const header = Buffer.alloc(4);
  header.writeUInt8(PROJECTILE_META_PROTO_TYPE, 0);
  header.writeUInt8(PROJECTILE_META_PROTO_VERSION, 1);
  header.writeUInt16LE(projectileMeta.length, 2);

  const body = Buffer.alloc(projectileMeta.length * 6);
  let offset = 0;
  for (const meta of projectileMeta) {
    const id = clamp(Math.floor(Number(meta && meta.id) || 0), 0, 65535);
    body.writeUInt16LE(id, offset);
    body.writeUInt32LE(hashString32(String((meta && meta.abilityId) || "").trim().toLowerCase()), offset + 2);
    offset += 6;
  }

  return Buffer.concat([header, body]);
}

function encodePlayerMetaPacket(playersMeta) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(PLAYER_META_PROTO_TYPE, 0);
  header.writeUInt8(PLAYER_META_PROTO_VERSION, 1);
  header.writeUInt16LE(playersMeta.length, 2);
  parts.push(header);

  for (const meta of playersMeta) {
    const id = clamp(Math.floor(Number(meta && meta.id) || 0), 0, 255);
    const nameBytesRaw = Buffer.from(String((meta && meta.name) || `P${id}`), "utf8");
    const classBytesRaw = Buffer.from(String((meta && meta.classType) || ""), "utf8");
    let appearanceJson = "";
    if (meta && meta.appearance && typeof meta.appearance === "object") {
      try {
        appearanceJson = JSON.stringify(meta.appearance);
      } catch (_error) {
        appearanceJson = "";
      }
    }
    const appearanceBytesRaw = Buffer.from(appearanceJson, "utf8");
    const nameBytes = nameBytesRaw.length > 255 ? nameBytesRaw.subarray(0, 255) : nameBytesRaw;
    const classBytes = classBytesRaw.length > 255 ? classBytesRaw.subarray(0, 255) : classBytesRaw;
    const appearanceBytes =
      appearanceBytesRaw.length > 65535 ? appearanceBytesRaw.subarray(0, 65535) : appearanceBytesRaw;
    const recordHeader = Buffer.alloc(5);
    recordHeader.writeUInt8(id, 0);
    recordHeader.writeUInt8(nameBytes.length, 1);
    recordHeader.writeUInt8(classBytes.length, 2);
    recordHeader.writeUInt16LE(appearanceBytes.length, 3);
    parts.push(recordHeader);
    if (nameBytes.length) {
      parts.push(nameBytes);
    }
    if (classBytes.length) {
      parts.push(classBytes);
    }
    if (appearanceBytes.length) {
      parts.push(appearanceBytes);
    }
  }

  return Buffer.concat(parts);
}

function encodeLootBagMetaPacket(lootBagMeta) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(LOOTBAG_META_PROTO_TYPE, 0);
  header.writeUInt8(LOOTBAG_META_PROTO_VERSION, 1);
  header.writeUInt16LE(lootBagMeta.length, 2);
  parts.push(header);

  for (const meta of lootBagMeta) {
    const id = clamp(Math.floor(Number(meta && meta.id) || 0), 0, 255);
    const items = Array.isArray(meta && meta.items) ? meta.items : [];
    const itemCount = clamp(items.length, 0, 255);
    const recordHeader = Buffer.alloc(2);
    recordHeader.writeUInt8(id, 0);
    recordHeader.writeUInt8(itemCount, 1);
    parts.push(recordHeader);

    for (let index = 0; index < itemCount; index += 1) {
      const item = items[index];
      const itemIdBytesRaw = Buffer.from(String((item && item.itemId) || ""), "utf8");
      const itemIdBytes = itemIdBytesRaw.length > 255 ? itemIdBytesRaw.subarray(0, 255) : itemIdBytesRaw;
      const qty = clamp(Math.floor(Number(item && item.qty) || 0), 0, 65535);
      const itemHeader = Buffer.alloc(3);
      itemHeader.writeUInt16LE(qty, 0);
      itemHeader.writeUInt8(itemIdBytes.length, 2);
      parts.push(itemHeader);
      if (itemIdBytes.length) {
        parts.push(itemIdBytes);
      }
    }
  }

  return Buffer.concat(parts);
}

function encodePlayerSwingPacket(events) {
  const header = Buffer.alloc(4);
  header.writeUInt8(PLAYER_SWING_PROTO_TYPE, 0);
  header.writeUInt8(PLAYER_SWING_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  const body = Buffer.alloc(events.length * 3);
  let offset = 0;
  for (const event of events) {
    body.writeUInt8(clamp(Math.floor(Number(event && event.id) || 0), 0, 255), offset);
    body.writeInt8(encodeUnitDirectionComponent(event && event.dx), offset + 1);
    body.writeInt8(encodeUnitDirectionComponent(event && event.dy), offset + 2);
    offset += 3;
  }

  return Buffer.concat([header, body]);
}

function getCastRecordSize(record) {
  const isCharge = record && record.isCharge;
  if (!record || !record.active) {
    return 3;
  }
  return isCharge ? 19 : 11;
}

function writeCastRecord(buffer, offset, record, kind) {
  const isCharge = record && record.isCharge;
  let flags = record && record.active ? CAST_EVENT_FLAG_ACTIVE : 0;
  if (isCharge) {
    flags |= CAST_EVENT_FLAG_CHARGE;
  }
  
  buffer.writeUInt8(clamp(kind, 0, 255), offset);
  buffer.writeUInt8(clamp(Math.floor(Number(record && record.id) || 0), 0, 255), offset + 1);
  buffer.writeUInt8(flags, offset + 2);
  
  if (!(record && record.active)) {
    return offset + 3;
  }

  buffer.writeUInt32LE(hashString32(String(record.abilityId || "").trim().toLowerCase()), offset + 3);
  buffer.writeUInt16LE(clamp(Math.floor(Number(record.durationMs) || 0), 1, 65535), offset + 7);
  buffer.writeUInt16LE(clamp(Math.floor(Number(record.elapsedMs) || 0), 0, 65535), offset + 9);
  
  if (isCharge) {
    // Add charge-specific data: startX, startY, targetX, targetY (each 2 bytes quantized)
    buffer.writeUInt16LE(quantizePos(record.chargeStartX || 0), offset + 11);
    buffer.writeUInt16LE(quantizePos(record.chargeStartY || 0), offset + 13);
    buffer.writeUInt16LE(quantizePos(record.chargeTargetX || 0), offset + 15);
    buffer.writeUInt16LE(quantizePos(record.chargeTargetY || 0), offset + 17);
    return offset + 19;
  }
  
  return offset + 11;
}

function encodeCastEventPacket(remotePlayerCasts, remoteMobCasts, selfCast) {
  const remotePlayers = Array.isArray(remotePlayerCasts) ? remotePlayerCasts : [];
  const remoteMobs = Array.isArray(remoteMobCasts) ? remoteMobCasts : [];
  const selfEntry = selfCast && typeof selfCast === "object" ? selfCast : null;
  const totalCount = remotePlayers.length + remoteMobs.length + (selfEntry ? 1 : 0);
  const header = Buffer.alloc(4);
  header.writeUInt8(CAST_EVENT_PROTO_TYPE, 0);
  header.writeUInt8(CAST_EVENT_PROTO_VERSION, 1);
  header.writeUInt16LE(totalCount, 2);

  let bodySize = 0;
  for (const record of remotePlayers) {
    bodySize += getCastRecordSize(record);
  }
  for (const record of remoteMobs) {
    bodySize += getCastRecordSize(record);
  }
  if (selfEntry) {
    bodySize += getCastRecordSize(selfEntry);
  }

  const body = Buffer.alloc(bodySize);
  let offset = 0;
  for (const record of remotePlayers) {
    offset = writeCastRecord(body, offset, record, CAST_EVENT_KIND_PLAYER);
  }
  for (const record of remoteMobs) {
    offset = writeCastRecord(body, offset, record, CAST_EVENT_KIND_MOB);
  }
  if (selfEntry) {
    offset = writeCastRecord(body, offset, selfEntry, CAST_EVENT_KIND_SELF);
  }

  return Buffer.concat([header, body]);
}

function getEffectPayloadFlags(effect) {
  let flags = 0;
  if ((Number(effect && effect.stunnedMs) || 0) > 0) {
    flags |= MOB_EFFECT_FLAG_STUN;
  }
  if ((Number(effect && effect.slowedMs) || 0) > 0) {
    flags |= MOB_EFFECT_FLAG_SLOW;
  }
  if ((Number(effect && effect.burningMs) || 0) > 0) {
    flags |= MOB_EFFECT_FLAG_BURN;
  }
  if ((Number(effect && effect.bloodWrathMs) || 0) > 0) {
    flags |= MOB_EFFECT_FLAG_BLOOD_WRATH;
  }
  return flags;
}

function getEffectPayloadSize(flags) {
  let size = 0;
  if (flags & MOB_EFFECT_FLAG_STUN) {
    size += 4;
  }
  if (flags & MOB_EFFECT_FLAG_SLOW) {
    size += 6;
  }
  if (flags & MOB_EFFECT_FLAG_BURN) {
    size += 4;
  }
  if (flags & MOB_EFFECT_FLAG_BLOOD_WRATH) {
    size += 2;
  }
  return size;
}

function writeEffectPayload(buffer, offset, flags, effect) {
  if (flags & MOB_EFFECT_FLAG_STUN) {
    const stunnedMs = clamp(Math.floor(Number(effect.stunnedMs) || 0), 1, 65535);
    const stunDurationMs = clamp(Math.floor(Number(effect.stunDurationMs) || stunnedMs), 1, 65535);
    buffer.writeUInt16LE(stunnedMs, offset);
    buffer.writeUInt16LE(stunDurationMs, offset + 2);
    offset += 4;
  }
  if (flags & MOB_EFFECT_FLAG_SLOW) {
    const slowedMs = clamp(Math.floor(Number(effect.slowedMs) || 0), 1, 65535);
    const slowDurationMs = clamp(Math.floor(Number(effect.slowDurationMs) || slowedMs), 1, 65535);
    const slowMultiplierQ = clamp(Math.floor(Number(effect.slowMultiplierQ) || 1000), 1, 1000);
    buffer.writeUInt16LE(slowedMs, offset);
    buffer.writeUInt16LE(slowDurationMs, offset + 2);
    buffer.writeUInt16LE(slowMultiplierQ, offset + 4);
    offset += 6;
  }
  if (flags & MOB_EFFECT_FLAG_BURN) {
    const burningMs = clamp(Math.floor(Number(effect.burningMs) || 0), 1, 65535);
    const burnDurationMs = clamp(Math.floor(Number(effect.burnDurationMs) || burningMs), 1, 65535);
    buffer.writeUInt16LE(burningMs, offset);
    buffer.writeUInt16LE(burnDurationMs, offset + 2);
    offset += 4;
  }
  if (flags & MOB_EFFECT_FLAG_BLOOD_WRATH) {
    const bloodWrathMs = clamp(Math.floor(Number(effect.bloodWrathMs) || 0), 1, 65535);
    buffer.writeUInt16LE(bloodWrathMs, offset);
    offset += 2;
  }
  return offset;
}

function encodePlayerEffectPacket(selfEffect, nearbyEffects) {
  const selfState = selfEffect && typeof selfEffect === "object" ? selfEffect : null;
  const effects = Array.isArray(nearbyEffects) ? nearbyEffects : [];
  const selfFlags = selfState ? getEffectPayloadFlags(selfState) || MOB_EFFECT_FLAG_REMOVE : 0;

  const header = Buffer.alloc(5);
  header.writeUInt8(PLAYER_EFFECT_PROTO_TYPE, 0);
  header.writeUInt8(PLAYER_EFFECT_PROTO_VERSION, 1);
  header.writeUInt8(selfFlags, 2);
  header.writeUInt16LE(effects.length, 3);

  let bodySize = getEffectPayloadSize(selfFlags);
  for (const effect of effects) {
    const flags = getEffectPayloadFlags(effect) || MOB_EFFECT_FLAG_REMOVE;
    bodySize += 2 + getEffectPayloadSize(flags);
  }

  const body = Buffer.alloc(bodySize);
  let offset = 0;
  if (selfFlags) {
    offset = writeEffectPayload(body, offset, selfFlags, selfState);
  }
  for (const effect of effects) {
    const flags = getEffectPayloadFlags(effect) || MOB_EFFECT_FLAG_REMOVE;
    body.writeUInt8(clamp(Math.floor(Number(effect && effect.id) || 0), 0, 255), offset);
    body.writeUInt8(flags, offset + 1);
    offset += 2;
    offset = writeEffectPayload(body, offset, flags, effect || {});
  }

  return Buffer.concat([header, body]);
}

function encodeMobBitePacket(events) {
  const header = Buffer.alloc(4);
  header.writeUInt8(MOB_BITE_PROTO_TYPE, 0);
  header.writeUInt8(MOB_BITE_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  const body = Buffer.alloc(events.length * 7);
  let offset = 0;
  for (const event of events) {
    body.writeUInt8(clamp(Math.floor(Number(event && event.id) || 0), 0, 255), offset);
    body.writeInt8(encodeUnitDirectionComponent(event && event.dx), offset + 1);
    body.writeInt8(encodeUnitDirectionComponent(event && event.dy), offset + 2);
    body.writeUInt32LE(hashString32(String((event && event.abilityId) || "").trim().toLowerCase()), offset + 3);
    offset += 7;
  }

  return Buffer.concat([header, body]);
}

function quantizeDistance(value) {
  return clamp(Math.round(Math.max(0, Number(value) || 0) * 64), 0, 65535);
}

function encodeExplosionEventPacket(events) {
  const header = Buffer.alloc(4);
  header.writeUInt8(EXPLOSION_EVENT_PROTO_TYPE, 0);
  header.writeUInt8(EXPLOSION_EVENT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  const body = Buffer.alloc(events.length * 10);
  let offset = 0;
  for (const event of events) {
    body.writeUInt16LE(quantizePos(Number(event && event.x)), offset);
    body.writeUInt16LE(quantizePos(Number(event && event.y)), offset + 2);
    body.writeUInt16LE(quantizeDistance(event && event.radius), offset + 4);
    body.writeUInt32LE(hashString32(String((event && event.abilityId) || "").trim().toLowerCase()), offset + 6);
    offset += 10;
  }

  return Buffer.concat([header, body]);
}

function encodeProjectileHitEventPacket(events) {
  const header = Buffer.alloc(4);
  header.writeUInt8(PROJECTILE_HIT_EVENT_PROTO_TYPE, 0);
  header.writeUInt8(PROJECTILE_HIT_EVENT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  const body = Buffer.alloc(events.length * 8);
  let offset = 0;
  for (const event of events) {
    body.writeUInt16LE(quantizePos(Number(event && event.x)), offset);
    body.writeUInt16LE(quantizePos(Number(event && event.y)), offset + 2);
    body.writeUInt32LE(hashString32(String((event && event.abilityId) || "").trim().toLowerCase()), offset + 4);
    offset += 8;
  }

  return Buffer.concat([header, body]);
}

function encodeMobDeathEventPacket(events) {
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(MOB_DEATH_EVENT_PROTO_TYPE, 0);
  header.writeUInt8(MOB_DEATH_EVENT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);
  parts.push(header);

  for (const event of events) {
    const mobTypeBytesRaw = Buffer.from(String((event && event.mobType) || "Mob"), "utf8");
    const mobTypeBytes = mobTypeBytesRaw.length > 255 ? mobTypeBytesRaw.subarray(0, 255) : mobTypeBytesRaw;
    const recordHeader = Buffer.alloc(5);
    recordHeader.writeUInt16LE(quantizePos(Number(event && event.x)), 0);
    recordHeader.writeUInt16LE(quantizePos(Number(event && event.y)), 2);
    recordHeader.writeUInt8(mobTypeBytes.length, 4);
    parts.push(recordHeader);
    if (mobTypeBytes.length) {
      parts.push(mobTypeBytes);
    }
  }

  return Buffer.concat(parts);
}

function encodeDamageEventPacket(events) {
  const header = Buffer.alloc(4);
  header.writeUInt8(DAMAGE_EVENT_PROTO_TYPE, 0);
  header.writeUInt8(DAMAGE_EVENT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  const recordSize = 7;
  const body = Buffer.alloc(events.length * recordSize);
  let offset = 0;
  for (const event of events) {
    const xQ = quantizePos(Number(event && event.x));
    const yQ = quantizePos(Number(event && event.y));
    const amount = clamp(Math.floor(Number(event && event.amount) || 0), 0, 65535);
    const flags = encodeDamageEventFlags(event && event.targetType, event && event.fromSelf);

    body.writeUInt16LE(xQ, offset);
    body.writeUInt16LE(yQ, offset + 2);
    body.writeUInt16LE(amount, offset + 4);
    body.writeUInt8(flags, offset + 6);
    offset += recordSize;
  }

  return Buffer.concat([header, body]);
}

module.exports = {
  encodeMobEffectEventPacket,
  encodeAreaEffectEventPacket,
  encodeMobMetaPacket,
  encodeProjectileMetaPacket,
  encodePlayerMetaPacket,
  encodeLootBagMetaPacket,
  encodePlayerSwingPacket,
  encodeCastEventPacket,
  encodePlayerEffectPacket,
  encodeMobBitePacket,
  encodeExplosionEventPacket,
  encodeProjectileHitEventPacket,
  encodeMobDeathEventPacket,
  encodeDamageEventPacket
};
