function createConfigOrchestrator({
  paths,
  loaders,
  state,
  constants,
  runtime,
  createDebouncedFileReloader,
  logger = console
}) {
  function applyRuntimeMobDefinition(mob, mobDef) {
    if (!mob || !mobDef) {
      return false;
    }
    const distanceFromCenter = Number(mob.distanceFromCenter) || Math.hypot(
      (Number(mob.x) || constants.mapWidth * 0.5) - constants.mapWidth * 0.5,
      (Number(mob.y) || constants.mapHeight * 0.5) - constants.mapHeight * 0.5
    );
    const level =
      Number(mob.level) > 0
        ? Math.floor(Number(mob.level))
        : typeof runtime.getMobLevelForDistance === "function"
          ? runtime.getMobLevelForDistance(distanceFromCenter)
          : 1;

    if (typeof runtime.applyScaledStatsToMob === "function") {
      runtime.applyScaledStatsToMob(mob, mobDef, level, { keepHpRatio: true });
    } else {
      const wasAlive = !!mob.alive;
      const oldMaxHp = Math.max(1, Math.floor(Number(mob.maxHp) || 1));
      const oldHp = Math.max(0, Number(mob.hp) || 0);
      const hpRatio = oldMaxHp > 0 ? constants.clamp(oldHp / oldMaxHp, 0, 1) : 1;
      mob.maxHp = constants.clamp(Math.floor(Number(mobDef.health) || 1), 1, 65535);
      mob.hp = wasAlive ? constants.clamp(Math.round(hpRatio * mob.maxHp), 1, mob.maxHp) : 0;
      mob.baseSpeed = constants.clamp(Number(mobDef.baseSpeed) || 0.5, 0.05, 1000);
      mob.damageMin = constants.clamp(Math.floor(Number(mobDef.damageMin) || 0), 0, 65535);
      mob.damageMax = constants.clamp(
        Math.floor(Number(mobDef.damageMax) || mob.damageMin),
        mob.damageMin,
        65535
      );
    }

    mob.respawnMinMs = Math.max(1000, Math.floor(Number(mobDef.respawnMinMs) || 1000));
    mob.respawnMaxMs = Math.max(mob.respawnMinMs, Math.floor(Number(mobDef.respawnMaxMs) || mob.respawnMinMs));
    mob.dropRules = Array.isArray(mobDef.dropRules) ? mobDef.dropRules.map((entry) => ({ ...entry })) : [];
    mob.renderStyle = mobDef.renderStyle ? JSON.parse(JSON.stringify(mobDef.renderStyle)) : null;
    mob.combat = mobDef.combat ? JSON.parse(JSON.stringify(mobDef.combat)) : null;

    if (!(mob.abilityCooldowns instanceof Map)) {
      mob.abilityCooldowns = new Map();
    } else {
      mob.abilityCooldowns.clear();
    }

    if (mob.activeCast) {
      runtime.clearMobCast(mob);
    }
    return true;
  }

  function applyRuntimeMobConfig(nextMobConfig) {
    if (!nextMobConfig || typeof nextMobConfig !== "object") {
      return { updatedMobs: 0, updatedSpawners: 0 };
    }

    let updatedSpawners = 0;
    for (const spawner of runtime.mobSpawners.values()) {
      if (!spawner) {
        continue;
      }
      const existingClusterName = String(spawner.clusterName || "");
      let nextCluster = nextMobConfig.clusterDefs.find((entry) => String(entry?.name || "") === existingClusterName);
      if (!nextCluster) {
        const centerX = constants.mapWidth / 2;
        const centerY = constants.mapHeight / 2;
        const spawnerDistance = Math.hypot((Number(spawner.x) || centerX) - centerX, (Number(spawner.y) || centerY) - centerY);
        nextCluster = runtime.pickClusterDef(nextMobConfig, spawnerDistance);
        if (!nextCluster) {
          nextCluster = runtime.pickClusterDef(nextMobConfig);
        }
        if (!nextCluster) {
          continue;
        }
        spawner.clusterName = nextCluster.name;
      }
      spawner.clusterDef = nextCluster;
      if (!Array.isArray(spawner.mobIds)) {
        spawner.mobIds = [];
      } else {
        spawner.mobIds = spawner.mobIds.filter((mobId) => runtime.mobs.has(mobId));
      }
      updatedSpawners += 1;
    }

    let updatedMobs = 0;
    for (const mob of runtime.mobs.values()) {
      const mobType = String(mob.type || "");
      if (!mobType) {
        continue;
      }
      const nextDef = nextMobConfig.mobDefs.get(mobType);
      if (!nextDef) {
        continue;
      }
      if (applyRuntimeMobDefinition(mob, nextDef)) {
        updatedMobs += 1;
      }
    }

    return { updatedMobs, updatedSpawners };
  }

  function reloadServerConfig(reason) {
    try {
      const nextConfig = loaders.loadServerConfigFromDisk(paths.serverConfigPath);
      state.setServerConfig(nextConfig);
      logger.log(`[config] Reloaded ${paths.serverConfigPath} (${reason}): ${loaders.formatServerConfigForLog(nextConfig)}`);
    } catch (error) {
      const details = error && error.message ? error.message : String(error);
      logger.error(
        `[config] Failed to reload ${paths.serverConfigPath} (${reason}). Keeping previous config. Reason: ${details}`
      );
    }
  }

  function reloadMobConfig(reason) {
    try {
      const nextMobConfig = loaders.loadMobConfigFromDisk(
        paths.mobConfigPath,
        constants.itemDefs,
        state.getAbilityConfig().abilityDefs,
        { width: constants.mapWidth, height: constants.mapHeight },
        state.getServerConfig(),
        constants.mobCombatDefaults
      );
      state.setMobConfig(nextMobConfig);
      const { updatedMobs, updatedSpawners } = applyRuntimeMobConfig(nextMobConfig);
      logger.log(
        `[config] Reloaded ${paths.mobConfigPath} (${reason}): updated ${updatedMobs} mobs, ${updatedSpawners} spawners`
      );
    } catch (error) {
      const details = error && error.message ? error.message : String(error);
      logger.error(
        `[config] Failed to reload ${paths.mobConfigPath} (${reason}). Keeping previous config. Reason: ${details}`
      );
    }
  }

  function reloadAbilityAndClassConfig(reason) {
    try {
      const nextAbilityConfig = loaders.loadAbilityConfig();
      const nextClassConfig = loaders.loadClassConfigFromDisk(
        paths.classConfigPath,
        nextAbilityConfig.abilityDefs,
        constants.itemDefs,
        constants.basePlayerSpeed,
        constants.normalizeItemEntries
      );
      state.setAbilityConfig(nextAbilityConfig);
      state.setClassConfig(nextClassConfig);
      logger.log(`[config] Reloaded ${paths.abilityConfigPath} (${reason})`);
      runtime.broadcastClassAndAbilityDefs();
      reloadMobConfig(`ability dependency reload (${reason})`);
    } catch (error) {
      const details = error && error.message ? error.message : String(error);
      logger.error(
        `[config] Failed to reload ${paths.abilityConfigPath} (${reason}). Keeping previous config. Reason: ${details}`
      );
    }
  }

  const serverConfigReloader = createDebouncedFileReloader({
    filePath: paths.serverConfigPath,
    reloadFn: reloadServerConfig
  });
  const abilityConfigReloader = createDebouncedFileReloader({
    filePath: paths.abilityConfigPath,
    reloadFn: reloadAbilityAndClassConfig
  });
  const mobConfigReloader = createDebouncedFileReloader({
    filePath: paths.mobConfigPath,
    reloadFn: reloadMobConfig
  });

  return {
    reloadServerConfig,
    reloadAbilityAndClassConfig,
    reloadMobConfig,
    applyRuntimeMobConfig,
    watchServerConfig: serverConfigReloader.watch,
    watchAbilityConfig: abilityConfigReloader.watch,
    watchMobConfig: mobConfigReloader.watch,
    scheduleServerConfigReload: serverConfigReloader.schedule,
    scheduleAbilityConfigReload: abilityConfigReloader.schedule,
    scheduleMobConfigReload: mobConfigReloader.schedule
  };
}

module.exports = {
  createConfigOrchestrator
};
