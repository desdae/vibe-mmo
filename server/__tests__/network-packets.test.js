const path = require("path");

const protocol = require("../../public/shared/protocol");
const packetEncoders = require("../../server/network/packet-encoders");
const { createEntityUpdatePacketBuilder } = require("../../server/network/entity-update-packet");
const { createPlayerEntitySyncState } = require("../../server/gameplay/player-factory");

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function hashString32(value) {
  const input = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index) & 0xff;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createParserDeps(overrides = {}) {
  const entityRuntime = {
    self: {
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      mana: 0,
      maxMana: 0,
      pendingHeal: 0,
      pendingMana: 0,
      copper: 0,
      level: 1,
      exp: 0,
      expToNext: 20,
      abilityLevels: {},
      _xq: 0,
      _yq: 0
    },
    players: new Map(),
    playerMeta: new Map(),
    mobs: new Map(),
    mobMeta: new Map(),
    projectiles: new Map(),
    projectileMeta: new Map(),
    lootBags: new Map(),
    lootBagMeta: new Map(),
    resourceNodes: new Map()
  };
  const gameState = {
    self: { id: "self", x: 0, y: 0 },
    players: [],
    mobs: [],
    projectiles: [],
    lootBags: [],
    resourceNodes: []
  };
  const snapshots = [];
  const pushSnapshot = jest.fn((snapshot) => {
    snapshots.push(snapshot);
  });

  return {
    entityRuntime,
    gameState,
    snapshots,
    pushSnapshot,
    deps: {
      ...protocol,
      entityRuntime,
      gameState,
      pushSnapshot,
      textDecoder: new TextDecoder(),
      normalizeMobRenderStyle: (style) => style,
      resolveAbilityIdHash: (hash) => (hash >>> 0) === hashString32("fireball") ? "fireball" : "",
      syncEntityArraysToGameState: () => {
        gameState.players = Array.from(entityRuntime.players.values()).map((entity) => ({ ...entity }));
        gameState.mobs = Array.from(entityRuntime.mobs.values()).map((entity) => ({ ...entity }));
        gameState.projectiles = Array.from(entityRuntime.projectiles.values()).map((entity) => ({ ...entity }));
        gameState.lootBags = Array.from(entityRuntime.lootBags.values()).map((entity) => ({ ...entity }));
        gameState.resourceNodes = Array.from(entityRuntime.resourceNodes.values()).map((entity) => ({ ...entity }));
      },
      syncSelfToGameState: () => {
        gameState.self = {
          id: "self",
          x: entityRuntime.self.x,
          y: entityRuntime.self.y
        };
      },
      stopMobCastSpatialLoop: () => {},
      stopProjectileFlightSpatialLoop: () => {},
      applyPlayerMetaEntries: () => {},
      applyLootBagMetaEntries: () => {},
      remotePlayerCasts: new Map(),
      remotePlayerStuns: new Map(),
      remotePlayerSlows: new Map(),
      remotePlayerBurns: new Map(),
      remoteMobCasts: new Map(),
      remoteMobStuns: new Map(),
      remoteMobSlows: new Map(),
      remoteMobBurns: new Map(),
      activeAreaEffectsById: new Map(),
      upsertAreaEffectState: () => {},
      addFloatingDamageEvents: () => {},
      applyPlayerCastStates: () => {},
      applyMobCastStates: () => {},
      applyPlayerEffects: () => {},
      applyNearbyPlayerEffects: () => {},
      triggerRemotePlayerSwing: () => {},
      triggerRemoteMobBite: () => {},
      addExplosionEvents: () => {},
      addProjectileHitEvents: () => {},
      addMobDeathEvents: () => {},
      ...overrides
    }
  };
}

describe("VibeClientNetworkPackets", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/network-packets.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientNetworkPackets;
  });

  afterEach(() => {
    delete globalThis.VibeClientNetworkPackets;
  });

  test("publishes a fresh render snapshot when mob and projectile meta arrive after entity state", () => {
    require(modulePath);

    const { deps, snapshots, pushSnapshot } = createParserDeps();
    const parsers = globalThis.VibeClientNetworkPackets.createNetworkPacketParsers(deps);
    const buildEntityUpdatePacket = createEntityUpdatePacketBuilder({
      getPendingHealAmount: () => 0,
      getPendingManaAmount: () => 0,
      serializeBagItemsForMeta: () => []
    });

    const player = {
      id: "501",
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      mana: 0,
      maxMana: 0,
      copper: 0,
      level: 1,
      exp: 0,
      expToNext: 20,
      entitySync: createPlayerEntitySyncState()
    };

    const entityUpdate = buildEntityUpdatePacket(
      player,
      [],
      [
        {
          id: "3001",
          name: "Skeleton Archer",
          level: 4,
          renderStyle: { rigType: "humanoid", spriteType: "skeleton_archer" },
          x: 5,
          y: 6,
          hp: 20,
          maxHp: 20
        }
      ],
      [
        {
          id: "4001",
          abilityId: "fireball",
          x: 7,
          y: 8
        }
      ],
      []
    );

    parsers.parseEntityBinaryPacket(toArrayBuffer(entityUpdate.packet));

    expect(pushSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshots[0].mobs[0]).toMatchObject({
      id: 1,
      name: "Mob 1",
      renderStyle: null
    });
    expect(snapshots[0].projectiles[0]).toMatchObject({
      id: 1,
      abilityId: ""
    });

    parsers.parseBinaryPacket(toArrayBuffer(packetEncoders.encodeMobMetaPacket(entityUpdate.mobMeta)));

    expect(pushSnapshot).toHaveBeenCalledTimes(2);
    expect(snapshots[1].mobs[0]).toMatchObject({
      id: 1,
      name: "Skeleton Archer",
      level: 4,
      renderStyle: { rigType: "humanoid", spriteType: "skeleton_archer" }
    });

    parsers.parseBinaryPacket(toArrayBuffer(packetEncoders.encodeProjectileMetaPacket(entityUpdate.projectileMeta)));

    expect(pushSnapshot).toHaveBeenCalledTimes(3);
    expect(snapshots[2].projectiles[0]).toMatchObject({
      id: 1,
      abilityId: "fireball"
    });
  });
});
