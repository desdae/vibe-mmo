function createDamageTools(options = {}) {
  const queueDamageEvent = typeof options.queueDamageEvent === "function" ? options.queueDamageEvent : () => {};
  const markMobProvokedByPlayer =
    typeof options.markMobProvokedByPlayer === "function" ? options.markMobProvokedByPlayer : () => {};
  const killMob = typeof options.killMob === "function" ? options.killMob : () => {};
  const clearPlayerCast = typeof options.clearPlayerCast === "function" ? options.clearPlayerCast : () => {};
  const clearPlayerCombatEffects =
    typeof options.clearPlayerCombatEffects === "function" ? options.clearPlayerCombatEffects : () => {};
  const getPlayerById = typeof options.getPlayerById === "function" ? options.getPlayerById : () => null;
  const clamp =
    typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));

  const tools = {
    // These callbacks are intentionally mutable; server.js wires the real talent handlers after all systems are created.
    onTalentSpellHit: typeof options.onTalentSpellHit === "function" ? options.onTalentSpellHit : null,
    onTalentKill: typeof options.onTalentKill === "function" ? options.onTalentKill : null,
    onTalentDamageDealt: typeof options.onTalentDamageDealt === "function" ? options.onTalentDamageDealt : null
  };

  function rollLeechAmount(baseAmount, percent) {
    const amount = Math.max(0, Number(baseAmount) || 0);
    const multiplier = Math.max(0, Number(percent) || 0) / 100;
    if (amount <= 0 || multiplier <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(amount * multiplier));
  }

  function applyDamageToMob(mob, damage, ownerId, extra = {}) {
    if (!mob || !mob.alive) {
      return 0;
    }
    let dmg = Math.max(0, Math.floor(Number(damage) || 0));
    if (dmg <= 0) {
      return 0;
    }

    const ownerPlayer = ownerId ? getPlayerById(String(ownerId)) : null;
    if (ownerPlayer && extra.allowCrit !== false) {
      const critChance = clamp(Number(ownerPlayer.critChance) || 0, 0, 100);
      if (critChance > 0 && Math.random() * 100 < critChance) {
        const critMultiplier = Math.max(1, 1.5 + Math.max(0, Number(ownerPlayer.critDamage) || 0) / 100);
        dmg = Math.max(1, Math.round(dmg * critMultiplier));
      }
    }

    const beforeHp = mob.hp;
    mob.hp = Math.max(0, mob.hp - dmg);
    const dealt = beforeHp - mob.hp;
    if (dealt > 0) {
      queueDamageEvent(mob, dealt, "mob", ownerId);
      markMobProvokedByPlayer(mob, ownerId);

      // Trigger talent effects on damage dealt
      if (ownerPlayer) {
        const handler = typeof tools.onTalentDamageDealt === "function" ? tools.onTalentDamageDealt : null;
        if (handler) {
          handler(ownerPlayer, mob, dealt);
        }
      }

      if (ownerPlayer && extra.allowLeech !== false) {
        const healAmount = rollLeechAmount(dealt, ownerPlayer.lifeSteal);
        if (healAmount > 0) {
          ownerPlayer.hp = Math.min(ownerPlayer.maxHp, ownerPlayer.hp + healAmount);
        }
        const manaAmount = rollLeechAmount(dealt, ownerPlayer.manaSteal);
        if (manaAmount > 0) {
          ownerPlayer.mana = Math.min(ownerPlayer.maxMana, ownerPlayer.mana + manaAmount);
        }
      }
    }
    if (mob.hp <= 0) {
      killMob(mob, ownerId);
      // Trigger talent on-kill effects
      if (ownerPlayer) {
        const handler = typeof tools.onTalentKill === "function" ? tools.onTalentKill : null;
        if (handler) {
          handler(ownerPlayer, mob);
        }
      }
    }
    return dealt;
  }

  function isPlayerInvulnerable(player, now = Date.now()) {
    if (!player) {
      return false;
    }
    return (Number(player.invulnerableUntil) || 0) > now;
  }

  function applyDamageToPlayer(player, damage, now = Date.now(), extra = {}) {
    if (!player || player.hp <= 0 || isPlayerInvulnerable(player, now)) {
      return 0;
    }
    let dmg = Math.max(0, Math.floor(Number(damage) || 0));
    if (dmg <= 0) {
      return 0;
    }

    const blockChance = clamp(Number(player.blockChance) || 0, 0, 0.75);
    if (blockChance > 0 && Math.random() < blockChance) {
      dmg = Math.max(0, Math.floor(dmg * 0.5));
    }
    const armor = Math.max(0, Number(player.armor) || 0);
    if (armor > 0) {
      const reduction = clamp(armor / (armor + 100), 0, 0.85);
      dmg = Math.max(0, Math.round(dmg * (1 - reduction)));
    }
    if (dmg <= 0) {
      return 0;
    }

    const beforeHp = player.hp;
    player.hp = Math.max(0, player.hp - dmg);
    const dealt = beforeHp - player.hp;
    if (dealt > 0) {
      queueDamageEvent(player, dealt, "player");
      const sourceMob = extra && extra.sourceMob && extra.sourceMob.alive ? extra.sourceMob : null;
      const thorns = Math.max(0, Math.floor(Number(player.thorns) || 0));
      if (sourceMob && thorns > 0) {
        applyDamageToMob(sourceMob, thorns, player.id, {
          allowCrit: false,
          allowLeech: false
        });
      }
    }
    if (player.hp <= 0) {
      player.input = { dx: 0, dy: 0 };
      clearPlayerCast(player);
      clearPlayerCombatEffects(player);
    }
    return dealt;
  }

  tools.applyDamageToMob = applyDamageToMob;
  tools.isPlayerInvulnerable = isPlayerInvulnerable;
  tools.applyDamageToPlayer = applyDamageToPlayer;

  return tools;
}

module.exports = {
  createDamageTools
};
