const { routeIncomingMessage } = require("../network/message-router");

function createJoinDeps(overrides = {}) {
  const staticConfig = {
    version: "cfg-1",
    classes: [{ id: "warrior", name: "Warrior" }],
    abilities: [{ id: "slash", name: "Slash" }],
    items: [{ id: "potion", name: "Potion" }],
    equipment: { itemSlots: ["mainHand"] },
    sounds: [{ id: "swing", url: "/audio/swing.ogg" }]
  };

  return {
    sendJson: jest.fn(),
    createPlayer: jest.fn(({ ws, name, classType, isAdmin }) => ({
      player: {
        id: "player-1",
        ws,
        name,
        classType,
        isAdmin,
        mana: 20,
        maxMana: 20,
        skills: {}
      }
    })),
    randomSpawn: jest.fn(() => ({ x: 5, y: 6 })),
    updatePlayerViewport: jest.fn(() => ({ x: 18, y: 12 })),
    MAP_WIDTH: 1000,
    MAP_HEIGHT: 1000,
    VISIBILITY_RANGE: 20,
    getTalentTreeData: jest.fn(() => ({ availablePoints: 0 })),
    CLASS_CONFIG: { clientClassDefs: staticConfig.classes },
    ABILITY_CONFIG: { clientAbilityDefs: staticConfig.abilities },
    ITEM_CONFIG: {
      clientEquipmentConfig: staticConfig.equipment,
      clientItemDefs: staticConfig.items,
      itemDefs: new Map()
    },
    buildSoundManifest: jest.fn(() => staticConfig.sounds),
    getStaticClientConfigSnapshot: jest.fn(() => staticConfig),
    sendInventoryState: jest.fn(),
    sendEquipmentState: jest.fn(),
    sendSelfProgress: jest.fn(),
    broadcastChatMessage: jest.fn(),
    ...overrides
  };
}

describe("routeIncomingMessage join bootstrap", () => {
  test("skips duplicate static config messages when the client version matches", () => {
    const deps = createJoinDeps();
    const ws = { id: "socket-1" };

    const result = routeIncomingMessage({
      rawMessage: JSON.stringify({
        type: "join",
        name: "Alice",
        classType: "warrior",
        configVersion: "cfg-1",
        viewportWidth: 1280,
        viewportHeight: 720
      }),
      ws,
      player: null,
      deps
    });

    expect(result.player).toEqual(expect.objectContaining({ id: "player-1" }));
    expect(deps.sendJson).toHaveBeenCalledTimes(1);
    expect(deps.sendJson).toHaveBeenCalledWith(
      ws,
      expect.objectContaining({
        type: "welcome",
        configVersion: "cfg-1"
      })
    );
    const welcomePayload = deps.sendJson.mock.calls[0][1];
    expect(welcomePayload.equipment).toBeUndefined();
    expect(welcomePayload.sounds).toBeUndefined();
  });

  test("re-sends static config when the client version is missing or stale", () => {
    const deps = createJoinDeps();
    const ws = { id: "socket-2" };

    routeIncomingMessage({
      rawMessage: JSON.stringify({
        type: "join",
        name: "Bob",
        classType: "warrior",
        configVersion: "stale-config",
        viewportWidth: 1280,
        viewportHeight: 720
      }),
      ws,
      player: null,
      deps
    });

    expect(deps.sendJson).toHaveBeenCalledTimes(4);
    expect(deps.sendJson.mock.calls.map(([, payload]) => payload.type)).toEqual([
      "welcome",
      "class_defs",
      "item_defs",
      "equipment_config"
    ]);
    expect(deps.sendJson).toHaveBeenCalledWith(
      ws,
      expect.objectContaining({
        type: "welcome",
        configVersion: "cfg-1",
        equipment: { itemSlots: ["mainHand"] },
        sounds: [{ id: "swing", url: "/audio/swing.ogg" }]
      })
    );
  });
});
