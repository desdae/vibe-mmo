function createDamageTools(options = {}) {
  const queueDamageEvent = typeof options.queueDamageEvent === "function" ? options.queueDamageEvent : () => {};
  const markMobProvokedByPlayer =
    typeof options.markMobProvokedByPlayer === "function" ? options.markMobProvokedByPlayer : () => {};
  const killMob = typeof options.killMob === "function" ? options.killMob : () => {};
  const clearPlayerCast = typeof options.clearPlayerCast === "function" ? options.clearPlayerCast : () => {};
  const clearPlayerCombatEffects =
    typeof options.clearPlayerCombatEffects === "function" ? options.clearPlayerCombatEffects : () => {};

  function applyDamageToMob(mob, damage, ownerId) {
    if (!mob || !mob.alive) {
      return 0;
    }
    const dmg = Math.max(0, Math.floor(Number(damage) || 0));
    if (dmg <= 0) {
      return 0;
    }

    const beforeHp = mob.hp;
    mob.hp = Math.max(0, mob.hp - dmg);
    const dealt = beforeHp - mob.hp;
    if (dealt > 0) {
      queueDamageEvent(mob, dealt, "mob", ownerId);
      markMobProvokedByPlayer(mob, ownerId);
    }
    if (mob.hp <= 0) {
      killMob(mob, ownerId);
    }
    return dealt;
  }

  function isPlayerInvulnerable(player, now = Date.now()) {
    if (!player) {
      return false;
    }
    return (Number(player.invulnerableUntil) || 0) > now;
  }

  function applyDamageToPlayer(player, damage, now = Date.now()) {
    if (!player || player.hp <= 0 || isPlayerInvulnerable(player, now)) {
      return 0;
    }
    const dmg = Math.max(0, Math.floor(Number(damage) || 0));
    if (dmg <= 0) {
      return 0;
    }

    const beforeHp = player.hp;
    player.hp = Math.max(0, player.hp - dmg);
    const dealt = beforeHp - player.hp;
    if (dealt > 0) {
      queueDamageEvent(player, dealt, "player");
    }
    if (player.hp <= 0) {
      player.input = { dx: 0, dy: 0 };
      clearPlayerCast(player);
      clearPlayerCombatEffects(player);
    }
    return dealt;
  }

  return {
    applyDamageToMob,
    isPlayerInvulnerable,
    applyDamageToPlayer
  };
}

module.exports = {
  createDamageTools
};
