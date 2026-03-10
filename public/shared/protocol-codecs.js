(function initProtocolCodecs(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory(require("./protocol"));
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeProtocolCodecs = rootFactory(root.VibeProtocol || {});
})(function buildProtocolCodecs(protocol) {
  const POS_SCALE = Math.max(1, Number(protocol.POS_SCALE) || 64);
  const DAMAGE_EVENT_FLAG_TARGET_PLAYER = Number(protocol.DAMAGE_EVENT_FLAG_TARGET_PLAYER) || 0;
  const DAMAGE_EVENT_FLAG_FROM_SELF = Number(protocol.DAMAGE_EVENT_FLAG_FROM_SELF) || 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function quantizePos(value) {
    return clamp(Math.round(Number(value || 0) * POS_SCALE), 0, 65535);
  }

  function dequantizePos(valueQ) {
    return (Number(valueQ) || 0) / POS_SCALE;
  }

  function encodeDamageEventFlags(targetType, fromSelf) {
    let flags = 0;
    if (String(targetType || "").toLowerCase() === "player") {
      flags |= DAMAGE_EVENT_FLAG_TARGET_PLAYER;
    }
    if (fromSelf) {
      flags |= DAMAGE_EVENT_FLAG_FROM_SELF;
    }
    return flags & 0xff;
  }

  function decodeDamageEventFlags(flagsValue) {
    const flags = Number(flagsValue) || 0;
    return {
      targetType: flags & DAMAGE_EVENT_FLAG_TARGET_PLAYER ? "player" : "mob",
      fromSelf: !!(flags & DAMAGE_EVENT_FLAG_FROM_SELF)
    };
  }

  return Object.freeze({
    clamp,
    quantizePos,
    dequantizePos,
    encodeDamageEventFlags,
    decodeDamageEventFlags
  });
});
