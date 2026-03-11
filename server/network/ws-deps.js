function createWsConnectionDeps({
  getClassConfig,
  getAbilityConfig,
  getItemConfig,
  allocatePlayerId,
  sendJson,
  players,
  mapWidth,
  mapHeight,
  visibilityRange,
  buildSoundManifest,
  randomSpawn,
  expNeededForLevel,
  createEmptyInventorySlots,
  createEmptyEquipmentSlots,
  normalizeItemEntries,
  addItemsToInventory,
  syncPlayerCopperFromInventory,
  sendInventoryState,
  sendEquipmentState,
  sendSelfProgress,
  clamp,
  normalizeDirection,
  clearPlayerCast,
  usePlayerAbility,
  levelUpPlayerAbility,
  tryPickupLootBag,
  mergeOrSwapInventorySlots,
  equipInventoryItem,
  unequipEquipmentItem,
  consumeInventoryItem,
  addHealOverTimeEffect,
  addManaOverTimeEffect
}) {
  return {
    sendJson,
    players,
    get CLASS_CONFIG() {
      return getClassConfig();
    },
    get ABILITY_CONFIG() {
      return getAbilityConfig();
    },
    get ITEM_CONFIG() {
      return getItemConfig();
    },
    MAP_WIDTH: mapWidth,
    MAP_HEIGHT: mapHeight,
    VISIBILITY_RANGE: visibilityRange,
    buildSoundManifest,
    randomSpawn,
    expNeededForLevel,
    createEmptyInventorySlots,
    createEmptyEquipmentSlots,
    normalizeItemEntries,
    addItemsToInventory,
    syncPlayerCopperFromInventory,
    sendInventoryState,
    sendEquipmentState,
    sendSelfProgress,
    clamp,
    normalizeDirection,
    clearPlayerCast,
    usePlayerAbility,
    levelUpPlayerAbility,
    tryPickupLootBag,
    mergeOrSwapInventorySlots,
    equipInventoryItem,
    unequipEquipmentItem,
    consumeInventoryItem,
    addHealOverTimeEffect,
    addManaOverTimeEffect,
    allocatePlayerId
  };
}

module.exports = {
  createWsConnectionDeps
};
