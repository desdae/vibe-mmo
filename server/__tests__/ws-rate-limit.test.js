const { EventEmitter } = require("events");

jest.mock("../network/message-router", () => ({
  routeIncomingMessage: jest.fn(() => ({ player: null }))
}));

const { routeIncomingMessage } = require("../network/message-router");
const { createSlidingWindowRateLimiter } = require("../network/ws-rate-limit");
const { registerWsConnections } = require("../network/ws-connections");

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.close = jest.fn();
  }
}

class FakeWebSocketServer extends EventEmitter {}

function createDeps(overrides = {}) {
  return {
    sendJson: jest.fn(),
    buildSoundManifest: jest.fn(() => []),
    CLASS_CONFIG: { clientClassDefs: [] },
    ABILITY_CONFIG: { clientAbilityDefs: [] },
    getServerConfig: () => ({
      wsTrustProxyHeaders: false,
      wsConnectionRateLimitWindowMs: 1000,
      wsConnectionRateLimitMax: 2,
      wsMessageRateLimitWindowMs: 1000,
      wsMessageRateLimitMax: 2
    }),
    players: new Map(),
    ...overrides
  };
}

describe("createSlidingWindowRateLimiter", () => {
  test("blocks after the configured number of events and recovers after the window", () => {
    let now = 0;
    const limiter = createSlidingWindowRateLimiter({
      now: () => now
    });

    expect(limiter.check("client-a", { windowMs: 1000, maxEvents: 2 }).allowed).toBe(true);
    expect(limiter.check("client-a", { windowMs: 1000, maxEvents: 2 }).allowed).toBe(true);

    const blocked = limiter.check("client-a", { windowMs: 1000, maxEvents: 2 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);

    now = 1001;
    expect(limiter.check("client-a", { windowMs: 1000, maxEvents: 2 }).allowed).toBe(true);
  });
});

describe("registerWsConnections", () => {
  beforeEach(() => {
    routeIncomingMessage.mockClear();
  });

  test("rejects connection floods from the same address", () => {
    const wss = new FakeWebSocketServer();
    const deps = createDeps();
    registerWsConnections({ wss, deps });

    const ws1 = new FakeSocket();
    const ws2 = new FakeSocket();
    const ws3 = new FakeSocket();
    const req = {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" }
    };

    wss.emit("connection", ws1, req);
    wss.emit("connection", ws2, req);
    wss.emit("connection", ws3, req);

    expect(deps.sendJson).toHaveBeenCalledWith(
      ws1,
      expect.objectContaining({ type: "hello" })
    );
    expect(deps.sendJson).toHaveBeenCalledWith(
      ws2,
      expect.objectContaining({ type: "hello" })
    );
    expect(deps.sendJson).toHaveBeenCalledWith(
      ws3,
      expect.objectContaining({
        type: "error",
        code: "rate_limited"
      })
    );
    expect(ws3.close).toHaveBeenCalledWith(1008, "rate_limited");
  });

  test("rejects message spam before routing", () => {
    const wss = new FakeWebSocketServer();
    const deps = createDeps();
    registerWsConnections({ wss, deps });

    const ws = new FakeSocket();
    wss.emit("connection", ws, {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" }
    });

    ws.emit("message", JSON.stringify({ type: "join", name: "A", classType: "warrior" }));
    ws.emit("message", JSON.stringify({ type: "join", name: "B", classType: "warrior" }));
    ws.emit("message", JSON.stringify({ type: "join", name: "C", classType: "warrior" }));

    expect(routeIncomingMessage).toHaveBeenCalledTimes(2);
    expect(ws.close).toHaveBeenCalledWith(1008, "rate_limited");
    expect(deps.sendJson).toHaveBeenCalledWith(
      ws,
      expect.objectContaining({
        type: "error",
        code: "rate_limited",
        message: "Too many WebSocket messages sent too quickly."
      })
    );
  });

  test("ignores forwarded addresses unless trusted proxy mode is enabled", () => {
    const wss = new FakeWebSocketServer();
    const deps = createDeps({
      getServerConfig: () => ({
        wsTrustProxyHeaders: false,
        wsConnectionRateLimitWindowMs: 1000,
        wsConnectionRateLimitMax: 1,
        wsMessageRateLimitWindowMs: 1000,
        wsMessageRateLimitMax: 10
      })
    });
    registerWsConnections({ wss, deps });

    const ws1 = new FakeSocket();
    const ws2 = new FakeSocket();
    const req1 = {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" }
    };
    const req2 = {
      headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" }
    };

    wss.emit("connection", ws1, req1);
    wss.emit("connection", ws2, req2);

    expect(ws2.close).toHaveBeenCalledWith(1008, "rate_limited");
  });

  test("uses forwarded addresses when trusted proxy mode is enabled", () => {
    const wss = new FakeWebSocketServer();
    const deps = createDeps({
      getServerConfig: () => ({
        wsTrustProxyHeaders: true,
        wsConnectionRateLimitWindowMs: 1000,
        wsConnectionRateLimitMax: 1,
        wsMessageRateLimitWindowMs: 1000,
        wsMessageRateLimitMax: 10
      })
    });
    registerWsConnections({ wss, deps });

    const ws1 = new FakeSocket();
    const ws2 = new FakeSocket();
    const ws3 = new FakeSocket();
    const req1 = {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" }
    };
    const req2 = {
      headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" }
    };
    const req3 = {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" }
    };

    wss.emit("connection", ws1, req1);
    wss.emit("connection", ws2, req2);
    wss.emit("connection", ws3, req3);

    expect(ws1.close).not.toHaveBeenCalled();
    expect(ws2.close).not.toHaveBeenCalled();
    expect(ws3.close).toHaveBeenCalledWith(1008, "rate_limited");
  });
});
