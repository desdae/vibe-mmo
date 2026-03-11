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
    gameLoop.start();
    initializeMobSpawners();

    server.listen(port, () => {
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
