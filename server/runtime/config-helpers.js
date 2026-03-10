function createAbilityConfigLoader({
  loadAbilityConfigFromDisk,
  abilityConfigPath,
  defaultAbilityKind,
  normalizeAbilityEntry,
  buildEmitProjectilesConfig
}) {
  function loadAbilityConfig() {
    return loadAbilityConfigFromDisk(abilityConfigPath, {
      defaultAbilityKind,
      normalizeAbilityEntry,
      buildEmitProjectilesConfig
    });
  }

  return {
    loadAbilityConfig
  };
}

function createClassAbilityDefsBroadcaster({
  players,
  sendJson,
  classConfigProvider,
  abilityConfigProvider
}) {
  function broadcastClassAndAbilityDefs() {
    const classConfig = classConfigProvider();
    const abilityConfig = abilityConfigProvider();
    for (const player of players.values()) {
      sendJson(player.ws, {
        type: "class_defs",
        classes: classConfig.clientClassDefs,
        abilities: abilityConfig.clientAbilityDefs
      });
    }
  }

  return {
    broadcastClassAndAbilityDefs
  };
}

module.exports = {
  createAbilityConfigLoader,
  createClassAbilityDefsBroadcaster
};
