function createRuntimeBootstrap({
  createEntityUpdatePacketBuilder,
  createStateBroadcaster,
  createGameLoop,
  registerWsConnections,
  wss,
  wsDeps,
  entityUpdateDeps,
  stateBroadcastDeps,
  tickMs,
  tickHandlers,
  initializeMobSpawners,
  server,
  port,
  onServerListening
}) {
  const buildEntityUpdatePacket = createEntityUpdatePacketBuilder(entityUpdateDeps);
  const broadcastState = createStateBroadcaster({
    ...stateBroadcastDeps,
    buildEntityUpdatePacket
  });

  registerWsConnections({
    wss,
    deps: wsDeps
  });

  const gameLoop = createGameLoop({
    tickMs,
    runTick: (now) => {
      if (typeof tickHandlers.tickBots === "function") {
        tickHandlers.tickBots(now);
      }
      tickHandlers.tickPlayers();
      tickHandlers.tickPlayerCasts(now);
      tickHandlers.tickAreaEffects(now);
      tickHandlers.tickMobs();
      tickHandlers.tickProjectiles();
      tickHandlers.tickLootBags(now);
      broadcastState(now);
    }
  });

  function start() {
    initializeMobSpawners();
    const handleListenError = (error) => {
      if (error && error.code === "EADDRINUSE") {
        console.error(`[server] Port ${port} is already in use.`);
        console.error("[server] Stop the other process on that port or start with PORT=<free-port>.");
        process.exit(1);
        return;
      }
      throw error;
    };

    server.once("error", handleListenError);
    server.listen(port, () => {
      server.removeListener("error", handleListenError);
      gameLoop.start();
      if (typeof onServerListening === "function") {
        onServerListening();
      }
    });
  }

  return {
    buildEntityUpdatePacket,
    broadcastState,
    gameLoop,
    start
  };
}

module.exports = {
  createRuntimeBootstrap
};
