"use strict";

const assert = require("assert");

const constants = require("../config/game-constants");
const { sanitizeChatText } = require("../server/network/chat-sanitization");
const { createDamageTools } = require("../server/gameplay/damage");

function testConstantsShape() {
  assert.equal(constants.MAX_PLAYER_LEVEL, 60);
  assert.equal(constants.MAX_CHAT_MESSAGE_LENGTH, 200);
  assert.equal(constants.TOWN_SPAWN_MAX_ATTEMPTS, 80);
  assert.equal(constants.CRIT_BASE_MULTIPLIER, 1.5);
  assert.equal(constants.BLOCK_DAMAGE_REDUCTION, 0.5);
  assert.equal(constants.MAX_BLOCK_CHANCE, 0.75);
}

function testChatSanitizationUsesSharedMaxLength() {
  const longText = "x".repeat(constants.MAX_CHAT_MESSAGE_LENGTH + 25);
  const sanitized = sanitizeChatText(longText);
  assert.equal(sanitized.length, constants.MAX_CHAT_MESSAGE_LENGTH);
}

function testDamageUsesSharedCombatConstants() {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const damageTools = createDamageTools({
      queueDamageEvent: () => {},
      markMobProvokedByPlayer: () => {},
      killMob: () => {},
      clearPlayerCast: () => {},
      clearPlayerCombatEffects: () => {},
      getPlayerById: () => ({
        critChance: 100,
        critDamage: 0,
        lifeSteal: 0,
        manaSteal: 0
      }),
      clamp: (value, min, max) => Math.max(min, Math.min(max, value))
    });

    const mob = { alive: true, hp: 30 };
    const critDealt = damageTools.applyDamageToMob(mob, 10, "owner-1");
    assert.equal(critDealt, Math.round(10 * constants.CRIT_BASE_MULTIPLIER));

    const player = { hp: 100, blockChance: 1, armor: 0 };
    const blocked = damageTools.applyDamageToPlayer(player, 100);
    assert.equal(blocked, Math.floor(100 * constants.BLOCK_DAMAGE_REDUCTION));
  } finally {
    Math.random = originalRandom;
  }
}

function main() {
  testConstantsShape();
  testChatSanitizationUsesSharedMaxLength();
  testDamageUsesSharedCombatConstants();
  console.log(JSON.stringify({ ok: true, tests: 3 }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
