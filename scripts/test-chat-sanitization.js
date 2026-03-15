"use strict";

const assert = require("assert");
const { sanitizeChatText, sanitizeChatSender } = require("../server/network/chat-sanitization");
const { routeIncomingMessage } = require("../server/network/message-router");

function testHelperSanitization() {
  const dangerous = `<img src=x onerror=alert(1)> javascript:alert(2)\nhello`;
  const sanitized = sanitizeChatText(dangerous, 200);
  assert.equal(sanitized.includes("<"), false);
  assert.equal(sanitized.includes(">"), false);
  assert.equal(/javascript\s*:/i.test(sanitized), false);
  assert.equal(/\bon[a-z0-9_-]+\s*=/i.test(sanitized), false);
  assert.equal(sanitized.includes("hello"), true);

  const sender = sanitizeChatSender(`<b>Town</b>`, "System");
  assert.equal(sender, "Town");
}

function testRouteBroadcastsSanitizedText() {
  const broadcastCalls = [];
  const deps = {
    sendJson() {},
    broadcastChatMessage(sender, text) {
      broadcastCalls.push({ sender, text });
    }
  };
  const player = {
    hp: 100,
    name: "Tester",
    isAdmin: false,
    ws: {}
  };

  routeIncomingMessage({
    rawMessage: JSON.stringify({
      type: "chat_message",
      text: `<script>alert(1)</script> hello onload=boom javascript:evil`
    }),
    ws: player.ws,
    player,
    deps
  });

  assert.equal(broadcastCalls.length, 1);
  assert.equal(broadcastCalls[0].text.includes("<"), false);
  assert.equal(broadcastCalls[0].text.includes(">"), false);
  assert.equal(/javascript\s*:/i.test(broadcastCalls[0].text), false);
  assert.equal(/\bon[a-z0-9_-]+\s*=/i.test(broadcastCalls[0].text), false);
  assert.equal(broadcastCalls[0].text.includes("hello"), true);
}

function testRouteDropsEmptySanitizedMessages() {
  const broadcastCalls = [];
  const deps = {
    sendJson() {},
    broadcastChatMessage(sender, text) {
      broadcastCalls.push({ sender, text });
    }
  };
  const player = {
    hp: 100,
    name: "Tester",
    isAdmin: false,
    ws: {}
  };

  routeIncomingMessage({
    rawMessage: JSON.stringify({
      type: "chat_message",
      text: `<<<>>>`
    }),
    ws: player.ws,
    player,
    deps
  });

  assert.equal(broadcastCalls.length, 0);
}

function main() {
  testHelperSanitization();
  testRouteBroadcastsSanitizedText();
  testRouteDropsEmptySanitizedMessages();
  console.log(JSON.stringify({ ok: true, tests: 3 }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
