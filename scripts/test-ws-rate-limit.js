"use strict";

const assert = require("assert");
const { EventEmitter } = require("events");

const { createSlidingWindowRateLimiter } = require("../server/network/ws-rate-limit");

const routedMessages = [];
const messageRouterPath = require.resolve("../server/network/message-router");
require.cache[messageRouterPath] = {
  id: messageRouterPath,
  filename: messageRouterPath,
  loaded: true,
  exports: {
    routeIncomingMessage(payload) {
      routedMessages.push(payload);
      return { player: null };
    }
  }
};

const { registerWsConnections } = require("../server/network/ws-connections");

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.closedWith = null;
  }

  close(code, reason) {
    this.closedWith = { code, reason };
  }
}

class FakeWebSocketServer extends EventEmitter {}

function createDeps(overrides = {}) {
  return {
    sendJsonCalls: [],
    sendJson(ws, payload) {
      this.sendJsonCalls.push({ ws, payload });
    },
    buildSoundManifest() {
      return [];
    },
    CLASS_CONFIG: { clientClassDefs: [] },
    ABILITY_CONFIG: { clientAbilityDefs: [] },
    getServerConfig() {
      return {
        wsConnectionRateLimitWindowMs: 1000,
        wsConnectionRateLimitMax: 2,
        wsMessageRateLimitWindowMs: 1000,
        wsMessageRateLimitMax: 2
      };
    },
    players: new Map(),
    ...overrides
  };
}

function findPayload(deps, ws, matcher) {
  return deps.sendJsonCalls.find((entry) => entry.ws === ws && matcher(entry.payload));
}

function testSlidingWindowLimiter() {
  let now = 0;
  const limiter = createSlidingWindowRateLimiter({
    now: () => now
  });
  assert.equal(limiter.check("client-a", { windowMs: 1000, maxEvents: 2 }).allowed, true);
  assert.equal(limiter.check("client-a", { windowMs: 1000, maxEvents: 2 }).allowed, true);
  const blocked = limiter.check("client-a", { windowMs: 1000, maxEvents: 2 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
  now = 1001;
  assert.equal(limiter.check("client-a", { windowMs: 1000, maxEvents: 2 }).allowed, true);
}

function testConnectionRateLimit() {
  routedMessages.length = 0;
  const wss = new FakeWebSocketServer();
  const deps = createDeps();
  registerWsConnections({ wss, deps });

  const req = {
    headers: {},
    socket: { remoteAddress: "127.0.0.1" }
  };
  const ws1 = new FakeSocket();
  const ws2 = new FakeSocket();
  const ws3 = new FakeSocket();

  wss.emit("connection", ws1, req);
  wss.emit("connection", ws2, req);
  wss.emit("connection", ws3, req);

  assert.ok(findPayload(deps, ws1, (payload) => payload.type === "hello"));
  assert.ok(findPayload(deps, ws2, (payload) => payload.type === "hello"));
  const rateLimited = findPayload(
    deps,
    ws3,
    (payload) => payload.type === "error" && payload.code === "rate_limited"
  );
  assert.ok(rateLimited);
  assert.deepEqual(ws3.closedWith, { code: 1008, reason: "rate_limited" });
}

function testMessageRateLimit() {
  routedMessages.length = 0;
  const wss = new FakeWebSocketServer();
  const deps = createDeps();
  registerWsConnections({ wss, deps });

  const ws = new FakeSocket();
  wss.emit("connection", ws, {
    headers: {},
    socket: { remoteAddress: "127.0.0.2" }
  });

  ws.emit("message", JSON.stringify({ type: "join", name: "A", classType: "warrior" }));
  ws.emit("message", JSON.stringify({ type: "join", name: "B", classType: "warrior" }));
  ws.emit("message", JSON.stringify({ type: "join", name: "C", classType: "warrior" }));

  assert.equal(routedMessages.length, 2);
  assert.deepEqual(ws.closedWith, { code: 1008, reason: "rate_limited" });
  assert.ok(
    findPayload(
      deps,
      ws,
      (payload) =>
        payload.type === "error" &&
        payload.code === "rate_limited" &&
        payload.message === "Too many WebSocket messages sent too quickly."
    )
  );
}

function testForwardedForAddressing() {
  routedMessages.length = 0;
  const wss = new FakeWebSocketServer();
  const deps = createDeps({
    getServerConfig() {
      return {
        wsConnectionRateLimitWindowMs: 1000,
        wsConnectionRateLimitMax: 1,
        wsMessageRateLimitWindowMs: 1000,
        wsMessageRateLimitMax: 4
      };
    }
  });
  registerWsConnections({ wss, deps });

  const req = {
    headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    socket: { remoteAddress: "127.0.0.1" }
  };
  const ws1 = new FakeSocket();
  const ws2 = new FakeSocket();
  wss.emit("connection", ws1, req);
  wss.emit("connection", ws2, req);

  assert.deepEqual(ws2.closedWith, { code: 1008, reason: "rate_limited" });
}

function main() {
  testSlidingWindowLimiter();
  testConnectionRateLimit();
  testMessageRateLimit();
  testForwardedForAddressing();
  console.log(JSON.stringify({ ok: true, tests: 4 }, null, 2));
}

main();
