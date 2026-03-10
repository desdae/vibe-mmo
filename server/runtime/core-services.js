const { createPlayerMessageTools } = require("../network/player-messages");
const { createNormalizeItemEntries, createDropRollTools } = require("../gameplay/drops");
const { createInventoryTools } = require("../gameplay/inventory");
const { createPlayerResourceTools } = require("../gameplay/player-resources");
const { createProgressionTools } = require("../gameplay/progression");

function createCoreServices({
  sendJson,
  itemDefs,
  inventoryCols,
  inventoryRows,
  inventorySlotCount,
  copperItemId,
  baseExpToNext,
  expGrowthFactor,
  getExpMultiplier,
  tickMs,
  clamp,
  randomInt,
  getServerConfig,
  getGlobalDropConfig,
  mapWidth,
  mapHeight
}) {
  const normalizeItemEntries = createNormalizeItemEntries({
    itemDefs
  });

  const playerMessageTools = createPlayerMessageTools({
    sendJson,
    itemDefs,
    inventoryCols,
    inventoryRows,
    inventorySlotCount
  });
  const sendSelfProgress = playerMessageTools.sendSelfProgress;
  const sendInventoryState = playerMessageTools.sendInventoryState;
  const serializeBagItemsForMeta = (items) =>
    playerMessageTools.serializeBagItemsForMeta(items, normalizeItemEntries);

  const inventoryTools = createInventoryTools({
    itemDefs,
    inventorySlotCount,
    copperItemId,
    normalizeItemEntries,
    sendSelfProgress
  });
  const createEmptyInventorySlots = inventoryTools.createEmptyInventorySlots;
  const addItemsToInventory = inventoryTools.addItemsToInventory;
  const mergeOrSwapInventorySlots = inventoryTools.mergeOrSwapInventorySlots;
  const consumeInventoryItem = inventoryTools.consumeInventoryItem;
  const syncPlayerCopperFromInventory = inventoryTools.syncPlayerCopperFromInventory;

  const progressionTools = createProgressionTools({
    baseExpToNext,
    expGrowthFactor,
    getExpMultiplier,
    sendSelfProgress
  });
  const expNeededForLevel = progressionTools.expNeededForLevel;
  const grantPlayerExp = progressionTools.grantPlayerExp;

  const playerResourceTools = createPlayerResourceTools({
    tickMs,
    clamp
  });
  const getPendingHealAmount = playerResourceTools.getPendingHealAmount;
  const getPendingManaAmount = playerResourceTools.getPendingManaAmount;
  const addHealOverTimeEffect = playerResourceTools.addHealOverTimeEffect;
  const addManaOverTimeEffect = playerResourceTools.addManaOverTimeEffect;
  const tickPlayerHealEffects = playerResourceTools.tickPlayerHealEffects;
  const tickPlayerManaEffects = playerResourceTools.tickPlayerManaEffects;

  const dropRollTools = createDropRollTools({
    clamp,
    randomInt,
    normalizeItemEntries,
    getServerConfig,
    getGlobalDropConfig,
    mapWidth,
    mapHeight
  });
  const rollDropRules = dropRollTools.rollDropRules;
  const getDistanceFromCenter = dropRollTools.getDistanceFromCenter;
  const rollGlobalDropsForPlayer = dropRollTools.rollGlobalDropsForPlayer;
  const rollMobDrops = dropRollTools.rollMobDrops;

  return {
    normalizeItemEntries,
    sendSelfProgress,
    sendInventoryState,
    serializeBagItemsForMeta,
    createEmptyInventorySlots,
    addItemsToInventory,
    mergeOrSwapInventorySlots,
    consumeInventoryItem,
    syncPlayerCopperFromInventory,
    expNeededForLevel,
    grantPlayerExp,
    getPendingHealAmount,
    getPendingManaAmount,
    addHealOverTimeEffect,
    addManaOverTimeEffect,
    tickPlayerHealEffects,
    tickPlayerManaEffects,
    rollDropRules,
    getDistanceFromCenter,
    rollGlobalDropsForPlayer,
    rollMobDrops
  };
}

module.exports = {
  createCoreServices
};
