const { createPlayerMessageTools } = require("../network/player-messages");

function createTools(sendJson) {
  const itemDefs = new Map([
    ["potion", { id: "potion", name: "Potion" }],
    ["sword", { id: "sword", name: "Sword" }]
  ]);
  return createPlayerMessageTools({
    sendJson,
    itemDefs,
    equipmentSlotIds: ["mainHand", "offHand"],
    inventoryCols: 2,
    inventoryRows: 2,
    inventorySlotCount: 4
  });
}

function createPlayer() {
  return {
    ws: { id: "socket-1" },
    inventorySlots: [
      { itemId: "potion", qty: 2 },
      null,
      null,
      null
    ],
    equipmentSlots: {
      mainHand: null,
      offHand: null
    }
  };
}

describe("createPlayerMessageTools delta sync", () => {
  test("sends a full inventory snapshot first and deltas after slot changes", () => {
    const sendJson = jest.fn();
    const tools = createTools(sendJson);
    const player = createPlayer();

    tools.sendInventoryState(player);
    expect(sendJson).toHaveBeenCalledTimes(1);
    expect(sendJson).toHaveBeenLastCalledWith(player.ws, {
      type: "inventory_state",
      cols: 2,
      rows: 2,
      slots: [
        { itemId: "potion", qty: 2 },
        null,
        null,
        null
      ]
    });

    player.inventorySlots[0].qty = 3;
    player.inventorySlots[1] = { itemId: "potion", qty: 1 };

    tools.sendInventoryState(player);
    expect(sendJson).toHaveBeenCalledTimes(2);
    expect(sendJson).toHaveBeenLastCalledWith(player.ws, {
      type: "inventory_delta",
      slots: [
        { index: 0, item: { itemId: "potion", qty: 3 } },
        { index: 1, item: { itemId: "potion", qty: 1 } }
      ]
    });

    tools.sendInventoryState(player);
    expect(sendJson).toHaveBeenCalledTimes(2);
  });

  test("detects nested equipment mutations and only sends changed slots", () => {
    const sendJson = jest.fn();
    const tools = createTools(sendJson);
    const player = createPlayer();
    player.equipmentSlots.mainHand = {
      itemId: "sword",
      qty: 1,
      instanceId: "gear-1",
      name: "Savage Sword",
      rarity: "magic",
      slot: "mainHand",
      weaponClass: "sword",
      isEquipment: true,
      itemLevel: 5,
      baseStats: { baseDamageMin: 4, baseDamageMax: 7 },
      affixes: [
        {
          id: "sav",
          name: "Savage",
          modifiers: [{ stat: "damage.global.percent", value: 8 }]
        }
      ]
    };

    tools.sendEquipmentState(player);
    expect(sendJson).toHaveBeenCalledTimes(1);
    expect(sendJson).toHaveBeenLastCalledWith(
      player.ws,
      expect.objectContaining({
        type: "equipment_state",
        itemSlots: ["mainHand", "offHand"]
      })
    );

    player.equipmentSlots.mainHand.affixes[0].modifiers[0].value = 12;

    tools.sendEquipmentState(player);
    expect(sendJson).toHaveBeenCalledTimes(2);
    expect(sendJson).toHaveBeenLastCalledWith(player.ws, {
      type: "equipment_delta",
      slots: [
        {
          slotId: "mainHand",
          item: {
            itemId: "sword",
            qty: 1,
            instanceId: "gear-1",
            name: "Savage Sword",
            rarity: "magic",
            slot: "mainHand",
            weaponClass: "sword",
            isEquipment: true,
            itemLevel: 5,
            baseStats: { baseDamageMin: 4, baseDamageMax: 7 },
            affixes: [
              {
                id: "sav",
                name: "Savage",
                modifiers: [{ stat: "damage.global.percent", value: 12 }]
              }
            ]
          }
        }
      ]
    });
  });
});
