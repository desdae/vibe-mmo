const assert = require("assert");
const { sendEntityMeta } = require("../server/network/state-broadcast");

function run() {
  const ws = { readyState: 1 };
  const sendBinaryCalls = [];
  const sendJsonCalls = [];

  sendEntityMeta(
    { ws },
    {
      playerMeta: [],
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
    { ws, payload: "mob" },
    { ws, payload: "projectile" },
    { ws, payload: "loot" }
  ]);
  assert.deepStrictEqual(sendJsonCalls, [
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

  console.log(JSON.stringify({ ok: true, sendBinaryCalls, sendJsonCalls }, null, 2));
}

try {
  run();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
