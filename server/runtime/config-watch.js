function startConfigWatchers(configOrchestrator) {
  if (!configOrchestrator) {
    throw new Error("startConfigWatchers requires a config orchestrator instance");
  }

  const watchServerConfig = configOrchestrator.watchServerConfig;
  const watchAbilityConfig = configOrchestrator.watchAbilityConfig;
  const watchMobConfig = configOrchestrator.watchMobConfig;

  watchServerConfig();
  watchAbilityConfig();
  watchMobConfig();

  return {
    watchServerConfig,
    watchAbilityConfig,
    watchMobConfig
  };
}

module.exports = {
  startConfigWatchers
};
