(function initProtocolConstants(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeProtocol = rootFactory();
})(function buildProtocolConstants() {
  const constants = {
    ENTITY_PROTO_TYPE: 1,
    ENTITY_PROTO_VERSION: 7,
    POS_SCALE: 64,
    MANA_SCALE: 10,
    HEAL_SCALE: 10,
    DELTA_FLAG_HP_CHANGED: 1 << 0,
    DELTA_FLAG_MAX_HP_CHANGED: 1 << 1,
    DELTA_FLAG_REMOVED: 1 << 2,
    DELTA_FLAG_COPPER_CHANGED: 1 << 3,
    DELTA_FLAG_PROGRESS_CHANGED: 1 << 4,
    DELTA_FLAG_MANA_CHANGED: 1 << 5,
    DELTA_FLAG_MAX_MANA_CHANGED: 1 << 6,
    DELTA_FLAG_PENDING_HEAL_CHANGED: 1 << 7,
    SELF_FLAG_PENDING_MANA_CHANGED: 1 << 2,
    SELF_MODE_NONE: 0,
    SELF_MODE_FULL: 1,
    SELF_MODE_DELTA: 2
  };

  return Object.freeze(constants);
});
