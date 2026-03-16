const { routeIncomingMessage } = require("./message-router");
const { createSlidingWindowRateLimiter } = require("./ws-rate-limit");

const WS_RATE_LIMIT_CLOSE_CODE = 1008;

function getSocketAddress(req, ws) {
  const socketAddress =
    (req && req.socket && req.socket.remoteAddress) ||
    (ws && ws._socket && ws._socket.remoteAddress) ||
    "";
  return String(socketAddress || "unknown");
}

function getClientAddress(req, ws, options = {}) {
  if (options.trustProxyHeaders !== true) {
    return getSocketAddress(req, ws);
  }
  const forwardedForHeader = req && req.headers ? req.headers["x-forwarded-for"] : "";
  if (typeof forwardedForHeader === "string" && forwardedForHeader.trim()) {
    const firstForwarded = forwardedForHeader.split(",")[0].trim();
    if (firstForwarded) {
      return firstForwarded;
    }
  }
  return getSocketAddress(req, ws);
}

function getRateLimitConfig(deps) {
  const config = typeof deps.getServerConfig === "function" ? deps.getServerConfig() : null;
  return {
    trustProxyHeaders: config && config.wsTrustProxyHeaders === true,
    connectionWindowMs: Number(config && config.wsConnectionRateLimitWindowMs) || 30000,
    connectionMax: Number(config && config.wsConnectionRateLimitMax) || 12,
    messageWindowMs: Number(config && config.wsMessageRateLimitWindowMs) || 1000,
    messageMax: Number(config && config.wsMessageRateLimitMax) || 120
  };
}

function closeRateLimitedSocket(ws, deps, message, retryAfterMs) {
  if (!ws) {
    return;
  }
  if (typeof deps.sendJson === "function") {
    deps.sendJson(ws, {
      type: "error",
      code: "rate_limited",
      message,
      retryAfterMs: Math.max(0, Math.floor(Number(retryAfterMs) || 0))
    });
  }
  if (typeof ws.close === "function") {
    ws.close(WS_RATE_LIMIT_CLOSE_CODE, "rate_limited");
  }
}

function registerWsConnections(params = {}) {
  const { wss, deps } = params;
  if (!wss || typeof wss.on !== "function") {
    throw new Error("registerWsConnections requires a valid WebSocketServer instance");
  }
  if (!deps || typeof deps.sendJson !== "function") {
    throw new Error("registerWsConnections requires deps.sendJson");
  }

  const connectionLimiter = createSlidingWindowRateLimiter();
  const messageLimiter = createSlidingWindowRateLimiter();
  let nextConnectionId = 1;

  wss.on("connection", (ws, req) => {
    const rateLimitConfig = getRateLimitConfig(deps);
    const remoteAddress = getClientAddress(req, ws, {
      trustProxyHeaders: rateLimitConfig.trustProxyHeaders
    });
    const connectionCheck = connectionLimiter.check(remoteAddress, {
      windowMs: rateLimitConfig.connectionWindowMs,
      maxEvents: rateLimitConfig.connectionMax
    });
    if (!connectionCheck.allowed) {
      closeRateLimitedSocket(
        ws,
        deps,
        "Too many recent WebSocket connections from this address.",
        connectionCheck.retryAfterMs
      );
      return;
    }

    const messageLimitKey = `${remoteAddress}#${nextConnectionId++}`;
    let player = null;

    deps.sendJson(ws, {
      type: "hello",
      message: "Send join message with name and classType.",
      classes: deps.CLASS_CONFIG.clientClassDefs,
      abilities: deps.ABILITY_CONFIG.clientAbilityDefs,
      sounds: deps.buildSoundManifest()
    });

    ws.on("message", (rawMessage) => {
      const currentLimitConfig = getRateLimitConfig(deps);
      const messageCheck = messageLimiter.check(messageLimitKey, {
        windowMs: currentLimitConfig.messageWindowMs,
        maxEvents: currentLimitConfig.messageMax
      });
      if (!messageCheck.allowed) {
        closeRateLimitedSocket(
          ws,
          deps,
          "Too many WebSocket messages sent too quickly.",
          messageCheck.retryAfterMs
        );
        return;
      }
      const result = routeIncomingMessage({ rawMessage, ws, player, deps });
      if (result && Object.prototype.hasOwnProperty.call(result, "player")) {
        player = result.player;
      }
    });

    ws.on("close", () => {
      messageLimiter.clear(messageLimitKey);
      if (player) {
        // Broadcast system message about player leaving
        if (typeof deps.broadcastChatMessage === "function") {
          deps.broadcastChatMessage({ name: "System", isAdmin: false }, `${player.name} has left the game.`);
        }
        deps.players.delete(player.id);
      }
    });
  });
}

module.exports = {
  registerWsConnections
};
