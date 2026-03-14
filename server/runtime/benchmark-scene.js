function createBenchmarkSceneTools(options = {}) {
  const players = options.players instanceof Map ? options.players : null;
  const mobs = options.mobs instanceof Map ? options.mobs : null;
  const mobSpawners = options.mobSpawners instanceof Map ? options.mobSpawners : null;
  const lootBags = options.lootBags instanceof Map ? options.lootBags : null;
  const activeAreaEffects = options.activeAreaEffects instanceof Map ? options.activeAreaEffects : null;
  const projectiles = options.projectiles instanceof Map ? options.projectiles : null;
  const createBotPlayer = typeof options.createBotPlayer === "function" ? options.createBotPlayer : null;
  const destroyBot = typeof options.destroyBot === "function" ? options.destroyBot : null;
  const getMobConfig = typeof options.getMobConfig === "function" ? options.getMobConfig : () => null;
  const createMob = typeof options.createMob === "function" ? options.createMob : null;
  const clearMobCast = typeof options.clearMobCast === "function" ? options.clearMobCast : () => {};
  const centerX = Number(options.centerX) || 0;
  const centerY = Number(options.centerY) || 0;

  if (!players || !mobs || !mobSpawners || !lootBags || !activeAreaEffects || !projectiles || !createBotPlayer || !destroyBot || !createMob) {
    throw new Error("createBenchmarkSceneTools requires runtime maps and factories");
  }

  const BENCHMARK_MOB_NAMES = Object.freeze([
    "Zombie",
    "Skeleton",
    "Skeleton Archer",
    "Creeper",
    "Spider",
    "Orc Berserker"
  ]);

  function clearWorldForBenchmark(ownerPlayerId) {
    const ownerId = String(ownerPlayerId || "");
    for (const player of players.values()) {
      if (!player || !player.isBot) {
        continue;
      }
      if (ownerId && String(player.botOwnerId || "") !== ownerId) {
        continue;
      }
      destroyBot(player.id);
    }
    for (const mob of mobs.values()) {
      clearMobCast(mob);
    }
    mobs.clear();
    mobSpawners.clear();
    lootBags.clear();
    activeAreaEffects.clear();
    projectiles.clear();
  }

  function placeEntity(entity, x, y) {
    if (!entity) {
      return;
    }
    entity.x = x;
    entity.y = y;
    if ("spawnX" in entity) {
      entity.spawnX = x;
    }
    if ("spawnY" in entity) {
      entity.spawnY = y;
    }
    if ("wanderTarget" in entity) {
      entity.wanderTarget = null;
    }
    if ("input" in entity) {
      entity.input = { dx: 0, dy: 0 };
    }
  }

  function createBenchmarkBots(ownerPlayerId, anchorX, anchorY) {
    const layouts = [
      { classType: "mage", x: anchorX - 3.5, y: anchorY + 2.5 },
      { classType: "mage", x: anchorX + 3.5, y: anchorY + 2.5 },
      { classType: "ranger", x: anchorX - 5.5, y: anchorY + 0.5 },
      { classType: "ranger", x: anchorX + 5.5, y: anchorY + 0.5 },
      { classType: "warrior", x: anchorX - 2, y: anchorY + 5 },
      { classType: "warrior", x: anchorX + 2, y: anchorY + 5 }
    ];
    const created = [];
    for (const layout of layouts) {
      const result = createBotPlayer({
        classType: layout.classType,
        ownerPlayerId
      });
      if (!result || !result.player) {
        continue;
      }
      const bot = result.player;
      placeEntity(bot, layout.x, layout.y);
      if (bot.botState) {
        bot.botState.nextDecisionAt = 0;
        bot.botState.nextEquipCheckAt = 0;
        bot.botState.nextLootCheckAt = 0;
        bot.botState.followTargetId = "";
        bot.botState.followRange = 0;
        bot.botState.townRoute = null;
      }
      created.push(bot);
    }
    return created;
  }

  function createBenchmarkMobs(anchorX, anchorY, now) {
    const mobConfig = getMobConfig();
    const mobDefs = mobConfig && mobConfig.mobDefs instanceof Map ? mobConfig.mobDefs : null;
    if (!mobDefs || !mobDefs.size) {
      return [];
    }
    const created = [];
    const columns = 6;
    const spacingX = 2.7;
    const spacingY = 2.4;
    let index = 0;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const mobName = BENCHMARK_MOB_NAMES[index % BENCHMARK_MOB_NAMES.length];
        index += 1;
        const mobDef = mobDefs.get(mobName);
        if (!mobDef) {
          continue;
        }
        const x = anchorX + (col - (columns - 1) / 2) * spacingX;
        const y = anchorY - 7.5 - row * spacingY;
        const spawner = {
          id: `benchmark-spawner-${index}`,
          x,
          y,
          cellKey: `benchmark:${row}:${col}`,
          clusterDef: {
            name: `benchmark-${mobName}`,
            members: [mobDef],
            maxSize: 1
          },
          mobIds: []
        };
        mobSpawners.set(spawner.id, spawner);
        const mob = createMob(spawner, now);
        if (!mob) {
          continue;
        }
        placeEntity(mob, x, y);
        mob.returningHome = false;
        mob.chaseTargetPlayerId = null;
        mob.chaseUntil = 0;
        mob.lastObservedAt = now;
        created.push(mob);
      }
    }
    return created;
  }

  function createBenchmarkScene(ownerPlayerId) {
    const owner = players.get(String(ownerPlayerId || "")) || null;
    if (!owner) {
      return { ok: false, error: "Owner player not found." };
    }
    const anchorX = Number(owner.x) || centerX;
    const anchorY = Number(owner.y) || centerY - 18;
    const now = Date.now();
    clearWorldForBenchmark(owner.id);
    const bots = createBenchmarkBots(owner.id, anchorX, anchorY);
    const sceneMobs = createBenchmarkMobs(anchorX, anchorY, now);
    return {
      ok: true,
      anchorX,
      anchorY,
      botCount: bots.length,
      mobCount: sceneMobs.length
    };
  }

  return {
    createBenchmarkScene
  };
}

module.exports = {
  createBenchmarkSceneTools
};
