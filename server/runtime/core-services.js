const { createPlayerMessageTools } = require("../network/player-messages");
const { createNormalizeItemEntries, createDropRollTools } = require("../gameplay/drops");
const { createInventoryTools } = require("../gameplay/inventory");
const { createPlayerResourceTools } = require("../gameplay/player-resources");
const { createProgressionTools } = require("../gameplay/progression");
const { createSkillTools } = require("../gameplay/skills");
const { loadTalentConfigFromDisk, createTalentSystem } = require("../config/talent-config");

function createCoreServices({
  sendJson,
  itemDefs,
  inventoryCols,
  inventoryRows,
  inventorySlotCount,
  equipmentSlotIds,
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
  mapHeight,
  talentConfigPath,
  classConfig,
  skillDataPath
}) {
  const normalizeItemEntries = createNormalizeItemEntries({
    itemDefs
  });

  const playerMessageTools = createPlayerMessageTools({
    sendJson,
    itemDefs,
    equipmentSlotIds,
    inventoryCols,
    inventoryRows,
    inventorySlotCount
  });
  const skillTools = createSkillTools({
    skillDataPath,
    sendSelfProgress: (player) => playerMessageTools.sendSelfProgress(player, skillTools.serializePlayerSkills(player))
  });
  const sendSelfProgress = (player) =>
    playerMessageTools.sendSelfProgress(player, skillTools.serializePlayerSkills(player));
  const sendInventoryState = playerMessageTools.sendInventoryState;
  const sendEquipmentState = playerMessageTools.sendEquipmentState;
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
  const getInventoryItemCount = inventoryTools.getInventoryItemCount;
  const syncPlayerCopperFromInventory = inventoryTools.syncPlayerCopperFromInventory;

  const talentConfig = talentConfigPath ? loadTalentConfigFromDisk(talentConfigPath) : {};
  const talentSystem = createTalentSystem({
    talentConfig,
    classConfig
  });
  const getTalentPointsPerLevel = talentSystem.getTalentPointsPerLevel;

  const progressionTools = createProgressionTools({
    baseExpToNext,
    expGrowthFactor,
    getExpMultiplier,
    getTalentPointsPerLevel,
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
    sendEquipmentState,
    serializeBagItemsForMeta,
    createEmptyInventorySlots,
    addItemsToInventory,
    mergeOrSwapInventorySlots,
    consumeInventoryItem,
    getInventoryItemCount,
    syncPlayerCopperFromInventory,
    skillTools,
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
    rollMobDrops,
    talentSystem,
    getTalentPointsPerLevel
  };
}

module.exports = {
  createCoreServices
};
