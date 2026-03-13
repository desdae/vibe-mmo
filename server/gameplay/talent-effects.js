function createTalentEffectTools(options = {}) {
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const talentSystem = typeof options.talentSystem === "object" ? options.talentSystem : null;
  const stunMob = typeof options.stunMob === "function" ? options.stunMob : () => {};
  const stunPlayer = typeof options.stunPlayer === "function" ? options.stunPlayer : () => {};
  const applySlowToMob = typeof options.applySlowToMob === "function" ? options.applySlowToMob : () => {};
  const applySlowToPlayer = typeof options.applySlowToPlayer === "function" ? options.applySlowToPlayer : () => {};

  if (!talentSystem) {
    return {
      onTalentSpellHit: () => {},
      onTalentKill: () => {},
      onTalentDamageDealt: () => {},
      onTalentLowHealth: () => {}
    };
  }

  function getTalentEffects(player) {
    if (!player || !player.classType || !player.talents) {
      return [];
    }
    return talentSystem.getTalentEffects(player.classType, player.talents);
  }

  function onTalentSpellHit(caster, target, abilityDef, now = Date.now()) {
    if (!caster || !target) return;

    const effects = getTalentEffects(caster);
    for (const effect of effects) {
      if (!effect.onSpellHit) continue;

      const chance = Number(effect.onSpellHit.chance) || 0;
      const roll = randomInt(1, 100);
      if (roll > chance) continue;

      const effectType = String(effect.onSpellHit.effect || "").toLowerCase();
      const duration = Math.max(0, Number(effect.onSpellHit.duration) || 0) * 1000;

      if (effectType === "freeze" || effectType === "stun") {
        if (target.entityType === "mob") {
          stunMob(target, duration, now);
        } else if (target.entityType === "player") {
          stunPlayer(target, duration, now);
        }
      } else if (effectType === "slow") {
        const slowAmount = Number(effect.onSpellHit.slowAmount) || 0.3;
        if (target.entityType === "mob") {
          applySlowToMob(target, slowAmount, duration, now);
        } else if (target.entityType === "player") {
          applySlowToPlayer(target, slowAmount, duration, now);
        }
      }
    }
  }

  function onTalentKill(killer, victim, now = Date.now()) {
    if (!killer || !victim) return;

    const effects = getTalentEffects(killer);
    for (const effect of effects) {
      if (!effect.onKill) continue;

      const effectType = String(effect.onKill.effect || "").toLowerCase();
      
      if (effectType === "heal") {
        const healAmount = Math.max(1, Number(effect.onKill.value) || 0);
        killer.hp = clamp(killer.hp + healAmount, 0, killer.maxHp);
      } else if (effectType === "mana") {
        const manaAmount = Math.max(1, Number(effect.onKill.value) || 0);
        killer.mana = clamp(killer.mana + manaAmount, 0, killer.maxMana);
      }
    }
  }

  function onTalentDamageDealt(caster, target, damageDealt, now = Date.now()) {
    if (!caster || !target || damageDealt <= 0) return;

    const effects = getTalentEffects(caster);
    for (const effect of effects) {
      if (!effect.onDamageDealt) continue;

      const statKey = String(effect.onDamageDealt.stat || "");
      const value = Number(effect.onDamageDealt.value) || 0;
      const maxStacks = Math.max(1, Number(effect.onDamageDealt.maxStacks) || 1);
      const duration = Math.max(0, Number(effect.onDamageDealt.duration) || 0) * 1000;

      if (statKey === "attackPower.percent") {
        caster.talentBuffs = caster.talentBuffs || {};
        const existing = caster.talentBuffs.attackPowerStacks || 0;
        const newStacks = clamp(existing + 1, 0, maxStacks);
        caster.talentBuffs.attackPowerStacks = newStacks;
        caster.talentBuffs.attackPowerExpiresAt = now + duration;
      }
    }
  }

  function tickTalentBuffs(player, now = Date.now()) {
    if (!player || !player.talentBuffs) return;

    if (player.talentBuffs.attackPowerExpiresAt && now > player.talentBuffs.attackPowerExpiresAt) {
      player.talentBuffs.attackPowerStacks = 0;
      player.talentBuffs.attackPowerExpiresAt = null;
    }

    if (player.talentBuffs.attackPowerStacks === 0 && 
        !player.talentBuffs.attackPowerExpiresAt) {
      player.talentBuffs = {};
    }
  }

  function getTalentBuffStats(player) {
    const stats = {};
    if (!player || !player.talentBuffs) return stats;

    const attackPowerStacks = player.talentBuffs.attackPowerStacks || 0;
    if (attackPowerStacks > 0) {
      const effects = getTalentEffects(player);
      for (const effect of effects) {
        if (effect.onDamageDealt && effect.onDamageDealt.stat === "attackPower.percent") {
          const valuePerStack = Number(effect.onDamageDealt.value) || 0;
          stats["meleeDamage.percent"] = (stats["meleeDamage.percent"] || 0) + (valuePerStack * attackPowerStacks);
        }
      }
    }

    return stats;
  }

  return {
    onTalentSpellHit,
    onTalentKill,
    onTalentDamageDealt,
    tickTalentBuffs,
    getTalentBuffStats
  };
}

module.exports = {
  createTalentEffectTools
};
