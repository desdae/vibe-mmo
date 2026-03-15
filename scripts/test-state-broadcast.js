const assert = require("assert");
const { sendEntityMeta, sendVisibleDamageEvents } = require("../server/network/state-broadcast");

function run() {
  const ws = { readyState: 1 };
  const sendBinaryCalls = [];
  const sendJsonCalls = [];

  sendEntityMeta(
    { ws },
    {
      playerMeta: [{ id: 3, name: "Aeris", classType: "mage", appearance: { mainHand: { itemId: "staff", slot: "mainHand" } } }],
      mobMeta: [{ id: 7, name: "Zombie", level: 3, renderStyle: { spriteType: "zombie" } }],
      projectileMeta: [{ id: 11, abilityId: "frostbolt" }],
      lootBagMeta: [{ id: 13, items: [{ itemId: "bone_fragment", qty: 2, name: "Bone Fragment" }] }]
    },
    {
      sendBinary(targetWs, payload) {
        sendBinaryCalls.push({ ws: targetWs, payload: payload.toString() });
      },
      sendJson(targetWs, payload) {
        sendJsonCalls.push({ ws: targetWs, payload });
      },
      encodePlayerMetaPacket: () => Buffer.from("player"),
      encodeMobMetaPacket: () => Buffer.from("mob"),
      encodeProjectileMetaPacket: () => Buffer.from("projectile"),
      encodeLootBagMetaPacket: () => Buffer.from("loot")
    }
  );

  assert.deepStrictEqual(sendBinaryCalls, [
    { ws, payload: "player" },
    { ws, payload: "mob" },
    { ws, payload: "projectile" },
    { ws, payload: "loot" }
  ]);
  assert.deepStrictEqual(sendJsonCalls, [
    {
      ws,
      payload: {
        type: "player_meta",
        players: [{ id: 3, name: "Aeris", classType: "mage", appearance: { mainHand: { itemId: "staff", slot: "mainHand" } } }]
      }
    },
    {
      ws,
      payload: {
        type: "mob_meta",
        mobs: [{ id: 7, name: "Zombie", level: 3, renderStyle: { spriteType: "zombie" } }]
      }
    },
    {
      ws,
      payload: {
        type: "projectile_meta",
        projectiles: [{ id: 11, abilityId: "frostbolt" }]
      }
    },
    {
      ws,
      payload: {
        type: "lootbag_meta",
        bags: [{ id: 13, items: [{ itemId: "bone_fragment", qty: 2, name: "Bone Fragment" }] }]
      }
    }
  ]);

  sendBinaryCalls.length = 0;
  sendJsonCalls.length = 0;

  const damageWs = { readyState: 1 };
  const visibleRecipient = { id: "player-1", x: 10, y: 10, ws: damageWs };
  sendVisibleDamageEvents(
    visibleRecipient,
    {
      pendingDamageEvents: [
        { x: 11, y: 10.5, amount: 17, targetType: "mob", sourcePlayerId: "player-1" }
      ],
      sendBinary(targetWs, payload) {
        sendBinaryCalls.push({ ws: targetWs, payload: payload.toString() });
      },
      sendJson(targetWs, payload) {
        sendJsonCalls.push({ ws: targetWs, payload });
      },
      encodeDamageEventPacket: () => Buffer.from("damage"),
      inVisibilityRange(subject, entity, extents) {
        return (
          Math.abs(Number(entity.x) - Number(subject.x)) <= Number(extents && extents.x || 20) &&
          Math.abs(Number(entity.y) - Number(subject.y)) <= Number(extents && extents.y || 20)
        );
      },
      VISIBILITY_RANGE: 20
    }
  );

  assert.deepStrictEqual(sendBinaryCalls, []);
  assert.deepStrictEqual(sendJsonCalls, [
    {
      ws: damageWs,
      payload: {
        type: "damage_events",
        events: [{ x: 11, y: 10.5, amount: 17, targetType: "mob", fromSelf: true }]
      }
    }
  ]);

  console.log(JSON.stringify({ ok: true, sendBinaryCalls, sendJsonCalls }, null, 2));
}

try {
  run();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
