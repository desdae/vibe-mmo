const PROTOCOL = require("../../public/shared/protocol");

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
  DAMAGE_EVENT_FLAG_TARGET_PLAYER,
  DAMAGE_EVENT_FLAG_FROM_SELF,
  MOB_EFFECT_FLAG_STUN,
  MOB_EFFECT_FLAG_SLOW,
  MOB_EFFECT_FLAG_BURN,
  AREA_EFFECT_OP_UPSERT,
  AREA_EFFECT_OP_REMOVE,
  AREA_EFFECT_KIND_AREA,
  AREA_EFFECT_KIND_BEAM,
  POS_SCALE
} = PROTOCOL;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantizePos(value) {
  return clamp(Math.round(Number(value || 0) * POS_SCALE), 0, 65535);
}

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
    details.writeUInt8(Number(event.kind) === AREA_EFFECT_KIND_BEAM ? AREA_EFFECT_KIND_BEAM : AREA_EFFECT_KIND_AREA, 0);
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

    if (Number(event.kind) === AREA_EFFECT_KIND_BEAM) {
      const beam = Buffer.alloc(12);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.startXQ) || 0), 0, 65535), 0);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.startYQ) || 0), 0, 65535), 2);
      beam.writeInt16LE(clamp(Math.floor(Number(event.dxQ) || 0), -32767, 32767), 4);
      beam.writeInt16LE(clamp(Math.floor(Number(event.dyQ) || 0), -32767, 32767), 6);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.lengthQ) || 0), 1, 65535), 8);
      beam.writeUInt16LE(clamp(Math.floor(Number(event.widthQ) || 0), 1, 65535), 10);
      parts.push(beam);
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

    const recordHeader = Buffer.alloc(4);
    recordHeader.writeUInt8(id, 0);
    recordHeader.writeUInt8(nameBytes.length, 1);
    recordHeader.writeUInt16LE(styleBytes.length, 2);
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
  const parts = [];
  const header = Buffer.alloc(4);
  header.writeUInt8(PROJECTILE_META_PROTO_TYPE, 0);
  header.writeUInt8(PROJECTILE_META_PROTO_VERSION, 1);
  header.writeUInt16LE(projectileMeta.length, 2);
  parts.push(header);

  for (const meta of projectileMeta) {
    const id = clamp(Math.floor(Number(meta && meta.id) || 0), 0, 255);
    const abilityBytesRaw = Buffer.from(String((meta && meta.abilityId) || ""), "utf8");
    const abilityBytes = abilityBytesRaw.length > 255 ? abilityBytesRaw.subarray(0, 255) : abilityBytesRaw;
    const recordHeader = Buffer.alloc(2);
    recordHeader.writeUInt8(id, 0);
    recordHeader.writeUInt8(abilityBytes.length, 1);
    parts.push(recordHeader);
    if (abilityBytes.length) {
      parts.push(abilityBytes);
    }
  }

  return Buffer.concat(parts);
}

function encodeDamageEventPacket(events) {
  const header = Buffer.alloc(4);
  header.writeUInt8(DAMAGE_EVENT_PROTO_TYPE, 0);
  header.writeUInt8(DAMAGE_EVENT_PROTO_VERSION, 1);
  header.writeUInt16LE(events.length, 2);

  const recordSize = 6;
  const body = Buffer.alloc(events.length * recordSize);
  let offset = 0;
  for (const event of events) {
    const xQ = quantizePos(Number(event && event.x));
    const yQ = quantizePos(Number(event && event.y));
    const amount = clamp(Math.floor(Number(event && event.amount) || 0), 0, 255);
    let flags = 0;
    if (String((event && event.targetType) || "").toLowerCase() === "player") {
      flags |= DAMAGE_EVENT_FLAG_TARGET_PLAYER;
    }
    if (event && event.fromSelf) {
      flags |= DAMAGE_EVENT_FLAG_FROM_SELF;
    }

    body.writeUInt16LE(xQ, offset);
    body.writeUInt16LE(yQ, offset + 2);
    body.writeUInt8(amount, offset + 4);
    body.writeUInt8(flags, offset + 5);
    offset += recordSize;
  }

  return Buffer.concat([header, body]);
}

module.exports = {
  encodeMobEffectEventPacket,
  encodeAreaEffectEventPacket,
  encodeMobMetaPacket,
  encodeProjectileMetaPacket,
  encodeDamageEventPacket
};
