function createPlayerEntitySyncState() {
  return {
    playerSlotsByRealId: new Map(),
    playerRealIdBySlot: new Map(),
    playerStatesBySlot: new Map(),
    playerMetaSignatureBySlot: new Map(),
    playerSwingBySlot: new Map(),
    playerCastVersionBySlot: new Map(),
    playerEffectStatesBySlot: new Map(),
    selfCastVersion: null,
    freePlayerSlots: [],
    nextPlayerSlot: 1,
    mobSlotsByRealId: new Map(),
    mobRealIdBySlot: new Map(),
    mobStatesBySlot: new Map(),
    mobBiteBySlot: new Map(),
    mobCastVersionBySlot: new Map(),
    mobMetaSignatureBySlot: new Map(),
    mobEffectStatesBySlot: new Map(),
    freeMobSlots: [],
    nextMobSlot: 1,
    projectileSlotsByRealId: new Map(),
    projectileRealIdBySlot: new Map(),
    projectileStatesBySlot: new Map(),
    projectileMetaBySlot: new Map(),
    freeProjectileSlots: [],
    nextProjectileSlot: 1,
    lootBagSlotsByRealId: new Map(),
    lootBagRealIdBySlot: new Map(),
    lootBagStatesBySlot: new Map(),
    lootBagMetaVersionBySlot: new Map(),
    freeLootBagSlots: [],
    nextLootBagSlot: 1,
    selfState: null,
    selfEffectState: null,
    selfBuffStateSignature: "",
    areaEffectStatesById: new Map()
  };
}

function createPlayerFactory(options = {}) {
  const classConfigProvider =
    typeof options.classConfigProvider === "function" ? options.classConfigProvider : () => null;
  const allocatePlayerId =
    typeof options.allocatePlayerId === "function" ? options.allocatePlayerId : () => String(Date.now());
  const createEmptyInventorySlots =
    typeof options.createEmptyInventorySlots === "function" ? options.createEmptyInventorySlots : () => [];
  const createEmptyEquipmentSlots =
    typeof options.createEmptyEquipmentSlots === "function" ? options.createEmptyEquipmentSlots : () => ({});
  const normalizeItemEntries =
    typeof options.normalizeItemEntries === "function" ? options.normalizeItemEntries : () => [];
  const addItemsToInventory =
    typeof options.addItemsToInventory === "function" ? options.addItemsToInventory : () => ({ changed: false });
  const createEquipmentEntryFromBaseItem =
    typeof options.createEquipmentEntryFromBaseItem === "function" ? options.createEquipmentEntryFromBaseItem : () => null;
  const recomputePlayerDerivedStats =
    typeof options.recomputePlayerDerivedStats === "function" ? options.recomputePlayerDerivedStats : () => {};
  const syncPlayerCopperFromInventory =
    typeof options.syncPlayerCopperFromInventory === "function" ? options.syncPlayerCopperFromInventory : () => {};
  const expNeededForLevel =
    typeof options.expNeededForLevel === "function" ? options.expNeededForLevel : () => 20;
  const sanitizeSpawn = typeof options.sanitizeSpawn === "function" ? options.sanitizeSpawn : (spawn) => spawn;
  const defaultVisibilityRange = Math.max(1, Number(options.defaultVisibilityRange) || 20);
  const players = options.players instanceof Map ? options.players : null;

  if (!players) {
    throw new Error("createPlayerFactory requires players map");
  }

  function getSlotFamily(slotId) {
    const normalized = String(slotId || "").trim();
    if (normalized === "ring1" || normalized === "ring2") {
      return "ring";
    }
    if (normalized === "trinket1" || normalized === "trinket2") {
      return "trinket";
    }
    return normalized;
  }

  function findFirstCompatibleEquipmentSlot(equipmentSlots, slotId) {
    if (!equipmentSlots || typeof equipmentSlots !== "object") {
      return "";
    }
    const family = getSlotFamily(slotId);
    const exact = String(slotId || "").trim();
    if (exact && exact in equipmentSlots && !equipmentSlots[exact]) {
      return exact;
    }
    for (const candidate of Object.keys(equipmentSlots)) {
      if (getSlotFamily(candidate) !== family) {
        continue;
      }
      if (!equipmentSlots[candidate]) {
        return candidate;
      }
    }
    return "";
  }

  function createPlayer(params = {}) {
    const name = String(params.name || "").trim().slice(0, 24);
    const classType = String(params.classType || "").trim();
    const classConfig = classConfigProvider();
    const classDef = classConfig && classConfig.classDefs instanceof Map ? classConfig.classDefs.get(classType) || null : null;

    if (!name || !classDef) {
      return { error: "Join requires non-empty name and a valid classType from class config." };
    }

    const requestedSpawn = params.spawn && typeof params.spawn === "object" ? params.spawn : { x: 0, y: 0 };
    const spawn = sanitizeSpawn(requestedSpawn) || requestedSpawn;
    const player = {
      id: allocatePlayerId(),
      entityType: "player",
      ws: params.ws || null,
      isAdmin: !!params.isAdmin,
      isBot: !!params.isBot,
      botOwnerId: params.botOwnerId ? String(params.botOwnerId) : "",
      botState:
        params.isBot
          ? {
              nextDecisionAt: 0,
              nextLootCheckAt: 0,
              nextEquipCheckAt: 0,
              nextSkillSpendAt: 0,
              nextVendorActionAt: 0,
              nextStatusAt: 0,
              targetMobId: "",
              targetBagId: "",
              vendorMode: "",
              townRoute: null,
              followTargetPlayerId: "",
              followDistance: 0
            }
          : null,
      name,
      classType,
      x: Number(spawn.x) || 0,
      y: Number(spawn.y) || 0,
      hp: classDef.baseHealth,
      maxHp: classDef.baseHealth,
      baseHealth: classDef.baseHealth,
      mana: classDef.baseMana,
      maxMana: classDef.baseMana,
      baseMana: classDef.baseMana,
      healthRegen: 0,
      baseHealthRegen: 0,
      buffHealthRegenFlat: 0,
      manaRegen: classDef.manaRegen,
      baseManaRegen: classDef.manaRegen,
      moveSpeed: classDef.movementSpeed,
      baseMoveSpeed: classDef.movementSpeed,
      armor: 0,
      blockChance: 0,
      critChance: 0,
      critDamage: 0,
      lifeSteal: 0,
      manaSteal: 0,
      lifeOnKill: 0,
      manaOnKill: 0,
      thorns: 0,
      attackSpeedMultiplier: 1,
      castSpeedMultiplier: 1,
      meleeDamageBonusPercent: 0,
      activeHeals: [],
      activeManaRestores: [],
      activeBuffs: [],
      activeDots: new Map(),
      copper: 0,
      level: 1,
      exp: 0,
      expToNext: expNeededForLevel(1),
      skillPoints: 0,
      talentPoints: 0,
      talents: {},
      abilityLevels: new Map(classDef.abilities.map((entry) => [entry.id, entry.level])),
      abilityLastUsedAt: new Map(),
      activeCast: null,
      castStateVersion: 0,
      invulnerableUntil: 0,
      stunnedUntil: 0,
      stunAppliedAt: 0,
      stunDurationMs: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      slowAppliedAt: 0,
      slowDurationMs: 0,
      burningUntil: 0,
      burnAppliedAt: 0,
      burnDurationMs: 0,
      clientViewportWidth: 0,
      clientViewportHeight: 0,
      visibilityRangeX: defaultVisibilityRange,
      visibilityRangeY: defaultVisibilityRange,
      inventorySlots: createEmptyInventorySlots(),
      equipmentSlots: createEmptyEquipmentSlots(),
      input: { dx: 0, dy: 0 },
      lastDirection: { dx: 0, dy: 1 },
      lastSwingDirection: { dx: 0, dy: 1 },
      swingCounter: 0,
      entitySync: createPlayerEntitySyncState()
    };

    const starterItems = normalizeItemEntries(classDef.startingItems);
    if (starterItems.length) {
      addItemsToInventory(player, starterItems);
    }
    for (const itemId of Array.isArray(classDef.startingEquipment) ? classDef.startingEquipment : []) {
      const entry = createEquipmentEntryFromBaseItem(itemId, { rarity: "normal" });
      if (!entry) {
        continue;
      }
      const targetSlot = findFirstCompatibleEquipmentSlot(player.equipmentSlots, entry.slot);
      if (!targetSlot) {
        continue;
      }
      player.equipmentSlots[targetSlot] = entry;
    }
    recomputePlayerDerivedStats(player);
    syncPlayerCopperFromInventory(player, false);

    if (params.overrides && typeof params.overrides === "object") {
      Object.assign(player, params.overrides);
    }

    players.set(player.id, player);
    return { player, classDef };
  }

  return {
    createPlayer,
    createPlayerEntitySyncState
  };
}

module.exports = {
  createPlayerFactory,
  createPlayerEntitySyncState
};
