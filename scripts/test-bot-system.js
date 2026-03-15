"use strict";

const assert = require("assert");
const { createBotTickSystem } = require("../server/runtime/bot-tick");

function buildClassConfig() {
  const classDefs = new Map();
  classDefs.set("warrior", {
    name: "Warrior",
    abilities: [{ id: "slash", level: 1 }]
  });
  classDefs.set("mage", {
    name: "Mage",
    abilities: [{ id: "frostbolt", level: 1 }]
  });
  classDefs.set("ranger", {
    name: "Ranger",
    abilities: [{ id: "aimedshot", level: 1 }]
  });
  return { classDefs };
}

function run() {
  const createdPlayers = [];
  const system = createBotTickSystem({
    players: new Map(),
    mobs: new Map(),
    lootBags: new Map(),
    activeAreaEffects: new Map(),
    projectiles: new Map(),
    itemDefs: new Map(),
    createPlayer(params) {
      const player = {
        id: String(createdPlayers.length + 1),
        name: String(params.name || ""),
        classType: String(params.classType || ""),
        isBot: !!params.isBot,
        botOwnerId: String(params.botOwnerId || ""),
        x: Number(params.spawn && params.spawn.x) || 0,
        y: Number(params.spawn && params.spawn.y) || 0,
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
        skillPoints: 0,
        abilityLevels: new Map([[params.classType === "mage" ? "frostbolt" : "slash", 1]]),
        abilityLastUsedAt: new Map(),
        input: { dx: 0, dy: 0 },
        lastDirection: { dx: 0, dy: 1 },
        inventorySlots: [],
        equipmentSlots: params.classType === "mage"
          ? { mainHand: { itemId: "wand", slot: "mainHand" }, chest: { itemId: "robe", slot: "chest" } }
          : { mainHand: { itemId: "sword", slot: "mainHand" }, chest: { itemId: "mail", slot: "chest" } },
        botState: {
          nextDecisionAt: 1,
          nextLootCheckAt: 1,
          nextEquipCheckAt: 1,
          nextSkillSpendAt: 1,
          nextVendorActionAt: 1,
          nextStatusAt: 1,
          targetMobId: "",
          targetBagId: "",
          vendorMode: "",
          townRoute: null,
          followTargetPlayerId: "",
          followDistance: 0
        }
      };
      createdPlayers.push(player);
      return { player };
    },
    classConfigProvider: () => buildClassConfig(),
    abilityDefsProvider: () => new Map(),
    levelUpPlayerAbility: () => false,
    getAbilityRangeForLevel: () => 0,
    usePlayerAbility: () => false,
    tryPickupLootBag: () => false,
    equipInventoryItem: () => false,
    getInventoryEntrySellValue: () => 0,
    sellInventoryItemToVendor: () => ({ ok: false }),
    randomPointInRadius: (x, y) => ({ x, y }),
    distance: () => Infinity,
    normalizeDirection: () => ({ dx: 0, dy: 0 }),
    centerX: 500,
    centerY: 500
  });

  const mageBot = system.createBotPlayer({ classType: "mage", ownerPlayerId: "owner-1" });
  const warriorBot = system.createBotPlayer({ classType: "warrior", ownerPlayerId: "owner-1" });

  assert.ok(mageBot && mageBot.player);
  assert.ok(warriorBot && warriorBot.player);
  assert.equal(mageBot.player.name, "Aeris");
  assert.ok(typeof warriorBot.player.name === "string" && warriorBot.player.name.trim().length > 0);
  assert.ok(!/bot/i.test(warriorBot.player.name));
  assert.ok(warriorBot.player.name !== mageBot.player.name);
  assert.ok(mageBot.player.isBot);
  assert.equal(mageBot.player.botOwnerId, "owner-1");
  assert.ok(mageBot.player.equipmentSlots && mageBot.player.equipmentSlots.mainHand);
  assert.ok(warriorBot.player.equipmentSlots && warriorBot.player.equipmentSlots.chest);

  console.log(JSON.stringify({
    ok: true,
    names: [mageBot.player.name, warriorBot.player.name],
    equipped: [
      mageBot.player.equipmentSlots.mainHand.itemId,
      warriorBot.player.equipmentSlots.chest.itemId
    ]
  }, null, 2));
}

try {
  run();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
