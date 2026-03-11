function createPlayerTickSystem({
  players,
  mobs,
  tickMs,
  clamp,
  mapWidth,
  mapHeight,
  basePlayerSpeed,
  tickPlayerHealEffects,
  tickPlayerManaEffects,
  tickPlayerDotEffects,
  clearPlayerCast,
  playerHasMovementInput,
  clearPlayerCombatEffects,
  abilityDefsProvider,
  getPlayerAbilityLevel,
  getAbilityCooldownPassed,
  executeAbilityByKind,
  abilityHandlerContext,
  normalizeDirection,
  isBlockedPoint,
  playerMobMinSeparation,
  playerMobSeparationIterations
}) {
  const isBlocked = typeof isBlockedPoint === "function" ? isBlockedPoint : () => false;

  function resolvePlayerMobCollisions(player) {
    if (!player || player.hp <= 0) {
      return;
    }

    for (let iter = 0; iter < playerMobSeparationIterations; iter += 1) {
      for (const mob of mobs.values()) {
        if (!mob.alive) {
          continue;
        }
        let dx = player.x - mob.x;
        let dy = player.y - mob.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= playerMobMinSeparation) {
          continue;
        }

        if (dist < 0.0001) {
          const fallback =
            normalizeDirection(player.input && player.input.dx, player.input && player.input.dy) ||
            normalizeDirection(player.lastDirection && player.lastDirection.dx, player.lastDirection && player.lastDirection.dy) ||
            { dx: 1, dy: 0 };
          dx = fallback.dx;
          dy = fallback.dy;
          dist = 1;
        }

        const overlap = playerMobMinSeparation - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const nextX = clamp(player.x + nx * overlap, 0, mapWidth - 1);
        const nextY = clamp(player.y + ny * overlap, 0, mapHeight - 1);
        if (!isBlocked(nextX, nextY)) {
          player.x = nextX;
          player.y = nextY;
        }
      }
    }
  }

  function resolveAllPlayersAgainstMobs() {
    for (const player of players.values()) {
      resolvePlayerMobCollisions(player);
    }
  }

  function tickPlayers() {
    const dt = tickMs / 1000;
    const now = Date.now();
    const abilityDefs = abilityDefsProvider();

    for (const player of players.values()) {
      if (player.hp > 0 && player.hp < player.maxHp && player.healthRegen > 0) {
        player.hp = clamp(player.hp + player.healthRegen * dt, 0, player.maxHp);
      }
      if (player.hp > 0 && player.mana < player.maxMana && player.manaRegen > 0) {
        player.mana = clamp(player.mana + player.manaRegen * dt, 0, player.maxMana);
      }
      tickPlayerHealEffects(player);
      tickPlayerManaEffects(player);
      tickPlayerDotEffects(player, now);

      const stunned = (Number(player.stunnedUntil) || 0) > now;
      if (stunned && player.activeCast) {
        clearPlayerCast(player);
      } else if (player.activeCast && playerHasMovementInput(player)) {
        const activeDef = abilityDefs.get(String(player.activeCast.abilityId || ""));
        if (!activeDef || activeDef.kind !== "teleport") {
          clearPlayerCast(player);
        }
      }

      if (player.hp <= 0) {
        player.input = { dx: 0, dy: 0 };
        clearPlayerCast(player);
        player.activeHeals = [];
        player.activeManaRestores = [];
        clearPlayerCombatEffects(player);
        continue;
      }

      if (!stunned && (player.stunnedUntil || player.stunDurationMs)) {
        player.stunnedUntil = 0;
        player.stunDurationMs = 0;
      }
      if ((Number(player.slowUntil) || 0) <= now && (player.slowUntil || player.slowMultiplier !== 1)) {
        player.slowUntil = 0;
        player.slowMultiplier = 1;
        player.slowDurationMs = 0;
      }
      if ((Number(player.burningUntil) || 0) <= now && player.burningUntil) {
        player.burningUntil = 0;
        player.burnDurationMs = 0;
      }

      if (stunned) {
        player.input = { dx: 0, dy: 0 };
        continue;
      }

      if (!player.input || (!player.input.dx && !player.input.dy)) {
        continue;
      }

      const slowMultiplier =
        (Number(player.slowUntil) || 0) > now ? clamp(Number(player.slowMultiplier) || 1, 0.1, 1) : 1;
      const moveSpeed = Math.max(0.1, Number(player.moveSpeed) || basePlayerSpeed) * slowMultiplier;
      const previousX = player.x;
      const previousY = player.y;
      player.x = clamp(player.x + player.input.dx * moveSpeed * dt, 0, mapWidth - 1);
      player.y = clamp(player.y + player.input.dy * moveSpeed * dt, 0, mapHeight - 1);
      resolvePlayerMobCollisions(player);
      if (isBlocked(player.x, player.y)) {
        player.x = previousX;
        player.y = previousY;
      }
    }
  }

  function tickPlayerCasts(now) {
    const abilityDefs = abilityDefsProvider();

    for (const player of players.values()) {
      const cast = player.activeCast;
      if (!cast) {
        continue;
      }

      const abilityDef = abilityDefs.get(String(cast.abilityId || ""));
      if (!abilityDef) {
        clearPlayerCast(player);
        continue;
      }

      if (player.hp <= 0 || (abilityDef.kind !== "teleport" && playerHasMovementInput(player))) {
        clearPlayerCast(player);
        continue;
      }

      if (now < cast.endsAt) {
        continue;
      }

      const abilityLevel = getPlayerAbilityLevel(player, abilityDef.id);
      if (abilityLevel <= 0) {
        clearPlayerCast(player);
        continue;
      }

      const manaCost = Math.max(0, Number(abilityDef.manaCost) || 0);
      if (player.mana + 1e-6 < manaCost) {
        clearPlayerCast(player);
        continue;
      }
      if (!getAbilityCooldownPassed(player, abilityDef, abilityLevel, now)) {
        clearPlayerCast(player);
        continue;
      }

      const used = executeAbilityByKind({
        player,
        abilityDef,
        abilityLevel,
        targetDx: cast.dx,
        targetDy: cast.dy,
        targetDistance: cast.targetDistance,
        now,
        ctx: abilityHandlerContext
      });
      if (used && manaCost > 0) {
        player.mana = clamp(player.mana - manaCost, 0, player.maxMana);
      }
      clearPlayerCast(player);
    }
  }

  return {
    tickPlayers,
    tickPlayerCasts,
    resolvePlayerMobCollisions,
    resolveAllPlayersAgainstMobs
  };
}

module.exports = {
  createPlayerTickSystem
};
