const { routeIncomingMessage } = require("./message-router");

function registerWsConnections(params = {}) {
  const { wss, deps } = params;
  if (!wss || typeof wss.on !== "function") {
    throw new Error("registerWsConnections requires a valid WebSocketServer instance");
  }
  if (!deps || typeof deps.sendJson !== "function") {
    throw new Error("registerWsConnections requires deps.sendJson");
  }

  wss.on("connection", (ws) => {
    let player = null;

    deps.sendJson(ws, {
      type: "hello",
      message: "Send join message with name and classType.",
      classes: deps.CLASS_CONFIG.clientClassDefs,
      abilities: deps.ABILITY_CONFIG.clientAbilityDefs,
      sounds: deps.buildSoundManifest()
    });

    ws.on("message", (rawMessage) => {
      const result = routeIncomingMessage({ rawMessage, ws, player, deps });
      if (result && Object.prototype.hasOwnProperty.call(result, "player")) {
        player = result.player;
      }
    });

    ws.on("close", () => {
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
