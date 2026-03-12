const PROTOCOL = require("../../public/shared/protocol");

const {
  AREA_EFFECT_OP_UPSERT,
  AREA_EFFECT_OP_REMOVE,
  AREA_EFFECT_KIND_AREA,
  AREA_EFFECT_KIND_BEAM,
  AREA_EFFECT_KIND_SUMMON,
  POS_SCALE
} = PROTOCOL;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantizePos(value) {
  return clamp(Math.round(Number(value || 0) * POS_SCALE), 0, 65535);
}

function toAreaEffectState(effect) {
  const id = Number(effect && effect.id);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  const kindRaw = String((effect && effect.kind) || "area").toLowerCase();
  const kind =
    kindRaw === "beam" ? AREA_EFFECT_KIND_BEAM : kindRaw === "summon" ? AREA_EFFECT_KIND_SUMMON : AREA_EFFECT_KIND_AREA;
  const state = {
    id: Math.floor(id),
    kind,
    abilityId: String((effect && effect.abilityId) || "").trim().toLowerCase().slice(0, 64),
    xQ: quantizePos(effect && effect.x),
    yQ: quantizePos(effect && effect.y),
    radiusQ: quantizePos(Math.max(0.1, Number(effect && effect.radius) || 0.1)),
    durationMs: clamp(Math.floor(Number(effect && effect.durationMs) || 0), 1, 65535),
    endsAt: Math.max(0, Math.floor(Number(effect && effect.endsAt) || 0))
  };
  if (kind === AREA_EFFECT_KIND_BEAM) {
    state.startXQ = quantizePos(effect && effect.startX);
    state.startYQ = quantizePos(effect && effect.startY);
    state.dxQ = clamp(Math.round((Number(effect && effect.dx) || 0) * 1000), -32767, 32767);
    state.dyQ = clamp(Math.round((Number(effect && effect.dy) || 0) * 1000), -32767, 32767);
    state.lengthQ = quantizePos(Math.max(0.1, Number(effect && effect.length) || 0.1));
    state.widthQ = quantizePos(Math.max(0.1, Number(effect && effect.width) || 0.1));
  } else if (kind === AREA_EFFECT_KIND_SUMMON) {
    state.summonCount = clamp(Math.round(Number(effect && effect.summonCount) || 1), 1, 255);
    state.attackIntervalMs = clamp(Math.floor(Number(effect && effect.attackIntervalMs) || 1000), 1, 65535);
    state.attackRangeQ = quantizePos(Math.max(0.1, Number(effect && effect.attackRange) || 0.1));
    state.formationRadiusQ = quantizePos(Math.max(0, Number(effect && effect.formationRadius) || 0));
  }
  return state;
}

function areaEffectStateEquals(a, b) {
  if (!a || !b) {
    return false;
  }
  if (
    a.kind !== b.kind ||
    a.abilityId !== b.abilityId ||
    a.xQ !== b.xQ ||
    a.yQ !== b.yQ ||
    a.radiusQ !== b.radiusQ ||
    a.durationMs !== b.durationMs ||
    a.endsAt !== b.endsAt
  ) {
    return false;
  }
  if (a.kind === AREA_EFFECT_KIND_BEAM) {
    return (
      a.startXQ === b.startXQ &&
      a.startYQ === b.startYQ &&
      a.dxQ === b.dxQ &&
      a.dyQ === b.dyQ &&
      a.lengthQ === b.lengthQ &&
      a.widthQ === b.widthQ
    );
  }
  if (a.kind === AREA_EFFECT_KIND_SUMMON) {
    return (
      a.summonCount === b.summonCount &&
      a.attackIntervalMs === b.attackIntervalMs &&
      a.attackRangeQ === b.attackRangeQ &&
      a.formationRadiusQ === b.formationRadiusQ
    );
  }
  return true;
}

function createAreaEffectEventBuilder(options = {}) {
  const activeAreaEffects = options.activeAreaEffects;
  const inVisibilityRange = options.inVisibilityRange;
  const visibilityRange = Math.max(0, Number(options.visibilityRange) || 0);
  const getPlayerVisibilityExtents =
    typeof options.getPlayerVisibilityExtents === "function" ? options.getPlayerVisibilityExtents : null;

  if (!activeAreaEffects || typeof activeAreaEffects.values !== "function") {
    throw new Error("createAreaEffectEventBuilder requires activeAreaEffects Map-like object");
  }
  if (typeof inVisibilityRange !== "function") {
    throw new Error("createAreaEffectEventBuilder requires inVisibilityRange function");
  }

  return function buildAreaEffectEventsForRecipient(recipient, now = Date.now()) {
    const events = [];
    const sync = recipient.entitySync;
    const visibleIds = new Set();

    for (const effect of activeAreaEffects.values()) {
      if (!effect || now >= Number(effect.endsAt)) {
        continue;
      }
      const extents =
        getPlayerVisibilityExtents && recipient
          ? getPlayerVisibilityExtents(recipient)
          : { x: visibilityRange, y: visibilityRange };
      const pad = Math.max(0, Number(effect.radius) || 0);
      const visibility = {
        x: Math.max(0, Number(extents && extents.x) || visibilityRange) + pad,
        y: Math.max(0, Number(extents && extents.y) || visibilityRange) + pad
      };
      if (!inVisibilityRange(recipient, effect, visibility)) {
        continue;
      }

      const state = toAreaEffectState(effect);
      if (!state) {
        continue;
      }
      visibleIds.add(state.id);

      const previous = sync.areaEffectStatesById.get(state.id);
      if (!areaEffectStateEquals(previous, state)) {
        events.push({
          op: AREA_EFFECT_OP_UPSERT,
          ...state,
          remainingMs: clamp(state.endsAt - now, 1, 65535)
        });
        sync.areaEffectStatesById.set(state.id, state);
      }
    }

    for (const [id] of Array.from(sync.areaEffectStatesById.entries())) {
      if (!visibleIds.has(id)) {
        events.push({
          op: AREA_EFFECT_OP_REMOVE,
          id
        });
        sync.areaEffectStatesById.delete(id);
      }
    }

    return events;
  };
}

module.exports = {
  createAreaEffectEventBuilder
};
