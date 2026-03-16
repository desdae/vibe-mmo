const { broadcastStateToPlayers } = require("../network/state-broadcast");

function createPlayer(id, x, y) {
  return {
    id,
    x,
    y,
    hp: 100,
    ws: { id: `ws-${id}` },
    activeBuffs: [],
    entitySync: {
      selfBuffStateSignature: "",
      resourceNodeStateSignature: ""
    }
  };
}

function createPlayersMap(players) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const originalValues = playerMap.values;
  let valuesCallCount = 0;
  playerMap.values = function values() {
    valuesCallCount += 1;
    if (valuesCallCount > 1) {
      throw new Error("players.values() should not be used for nearby entity scans when spatial queries are available");
    }
    return originalValues.call(this);
  };
  return playerMap;
}

function createThrowingValuesMap(label) {
  return {
    values() {
      throw new Error(`${label}.values() should not be used when spatial queries are available`);
    }
  };
}

function createDeps(overrides = {}) {
  const recipient = createPlayer("player-1", 10, 10);
  const nearbyPlayer = createPlayer("player-2", 12, 10);
  const players = createPlayersMap([recipient, nearbyPlayer]);
  const visibleProjectile = {
    id: "projectile-1",
    ownerId: "player-1",
    abilityId: "fireball",
    x: 11,
    y: 10
  };
  const visibleMob = {
    id: "mob-1",
    alive: true,
    x: 13,
    y: 10
  };
  const visibleBag = {
    id: "bag-1",
    x: 10,
    y: 12
  };

  return {
    players,
    projectiles: createThrowingValuesMap("projectiles"),
    mobs: createThrowingValuesMap("mobs"),
    lootBags: createThrowingValuesMap("lootBags"),
    VISIBILITY_RANGE: 6,
    getPlayerVisibilityExtents: jest.fn(() => ({ x: 6, y: 4 })),
    inVisibilityRange: jest.fn((player, entity, extents) => {
      const dx = Math.abs((Number(entity && entity.x) || 0) - (Number(player && player.x) || 0));
      const dy = Math.abs((Number(entity && entity.y) || 0) - (Number(player && player.y) || 0));
      return dx <= (Number(extents && extents.x) || 0) && dy <= (Number(extents && extents.y) || 0);
    }),
    serializePlayer: jest.fn((player) => ({ id: player.id, x: player.x, y: player.y })),
    serializeMob: jest.fn((mob) => ({ id: mob.id, x: mob.x, y: mob.y })),
    getVisibleResourceNodesForPlayer: jest.fn(() => []),
    serializeResourceNode: jest.fn((node) => node),
    getPlayersInRadius: jest.fn(() => [recipient, nearbyPlayer]),
    getProjectilesInRadius: jest.fn(() => [visibleProjectile]),
    getMobsInRadius: jest.fn(() => [visibleMob]),
    getLootBagsInRadius: jest.fn(() => [visibleBag]),
    rebuildSpatialIndexes: jest.fn(),
    buildEntityUpdatePacket: jest.fn(() => ({
      playerMeta: [],
      mobMeta: [],
      projectileMeta: [],
      lootBagMeta: [],
      packet: null
    })),
    buildPlayerSwingEventsForRecipient: jest.fn(() => []),
    buildPlayerCastEventsForRecipient: jest.fn(() => ({ casts: [], self: null })),
    buildPlayerEffectEventsForRecipient: jest.fn(() => []),
    buildMobCastEventsForRecipient: jest.fn(() => []),
    buildMobBiteEventsForRecipient: jest.fn(() => []),
    buildMobEffectEventsForRecipient: jest.fn(() => []),
    buildSelfPlayerEffectUpdate: jest.fn(() => null),
    buildAreaEffectEventsForRecipient: jest.fn(() => []),
    encodeMobMetaPacket: jest.fn(() => Buffer.alloc(0)),
    encodeProjectileMetaPacket: jest.fn(() => Buffer.alloc(0)),
    encodePlayerMetaPacket: jest.fn(() => Buffer.alloc(0)),
    encodeLootBagMetaPacket: jest.fn(() => Buffer.alloc(0)),
    encodePlayerSwingPacket: jest.fn(() => Buffer.alloc(0)),
    encodeCastEventPacket: jest.fn(() => Buffer.alloc(0)),
    encodePlayerEffectPacket: jest.fn(() => Buffer.alloc(0)),
    encodeMobBitePacket: jest.fn(() => Buffer.alloc(0)),
    encodeMobEffectEventPacket: jest.fn(() => Buffer.alloc(0)),
    encodeAreaEffectEventPacket: jest.fn(() => Buffer.alloc(0)),
    encodeExplosionEventPacket: jest.fn(() => Buffer.alloc(0)),
    encodeProjectileHitEventPacket: jest.fn(() => Buffer.alloc(0)),
    encodeMobDeathEventPacket: jest.fn(() => Buffer.alloc(0)),
    encodeDamageEventPacket: jest.fn(() => Buffer.alloc(0)),
    pendingDamageEvents: [],
    pendingExplosionEvents: [],
    pendingProjectileHitEvents: [],
    pendingMobDeathEvents: [],
    getAliveMobCount: jest.fn(() => 1),
    sendJson: jest.fn(),
    sendBinary: jest.fn(),
    ...overrides
  };
}

describe("state-broadcast spatial queries", () => {
  test("rebuilds indexes once and uses spatial helpers for nearby entity collection", () => {
    const deps = createDeps();

    broadcastStateToPlayers(deps, 1500);

    expect(deps.rebuildSpatialIndexes).toHaveBeenCalledTimes(1);
    expect(deps.getPlayersInRadius).toHaveBeenCalledWith(10, 10, expect.any(Number));
    expect(deps.getProjectilesInRadius).toHaveBeenCalledWith(10, 10, expect.any(Number));
    expect(deps.getMobsInRadius).toHaveBeenCalledWith(10, 10, expect.any(Number));
    expect(deps.getLootBagsInRadius).toHaveBeenCalledWith(10, 10, expect.any(Number));
    expect(deps.buildEntityUpdatePacket).toHaveBeenCalledWith(
      expect.objectContaining({ id: "player-1" }),
      [{ id: "player-2", x: 12, y: 10 }],
      [{ id: "mob-1", x: 13, y: 10 }],
      [{ id: "projectile-1", ownerId: "player-1", abilityId: "fireball", x: 11, y: 10 }],
      [{ id: "bag-1", x: 10, y: 12 }]
    );
  });
});
