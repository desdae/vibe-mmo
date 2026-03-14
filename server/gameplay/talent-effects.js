const { createEffectEngine } = require("./effects/effect-engine");
const { buildTalentEffectDefsFromTalentEffects } = require("./effects/talent-effect-defs");

function createTalentEffectTools(options = {}) {
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clamp = typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const talentSystem = typeof options.talentSystem === "object" ? options.talentSystem : null;
  const stunMob = typeof options.stunMob === "function" ? options.stunMob : () => {};
  const stunPlayer = typeof options.stunPlayer === "function" ? options.stunPlayer : () => {};
  const applySlowToMob = typeof options.applySlowToMob === "function" ? options.applySlowToMob : () => {};
  const applySlowToPlayer = typeof options.applySlowToPlayer === "function" ? options.applySlowToPlayer : () => {};
  const recomputePlayerDerivedStats =
    typeof options.recomputePlayerDerivedStats === "function" ? options.recomputePlayerDerivedStats : () => {};
  const effectEngine = createEffectEngine({ clamp, randomInt });

  if (!talentSystem) {
    return {
      onTalentSpellHit: () => {},
      onTalentKill: () => {},
      onTalentDamageDealt: () => {},
      tickTalentBuffs: () => {},
      getTalentBuffStats: () => ({})
    };
  }

  function getTalentEffects(player) {
    if (!player || !player.classType || !player.talents) {
      return [];
    }
    return talentSystem.getTalentEffects(player.classType, player.talents);
  }

  function onTalentSpellHit(caster, target, abilityDef, now = Date.now()) {
    if (!caster || !target) {
      return;
    }

    const defs = buildTalentEffectDefsFromTalentEffects(getTalentEffects(caster));
    if (!defs.length) {
      return;
    }
    const compiled = effectEngine.compile(defs, { defaultTrigger: "onSpellHit" });
    effectEngine.run(compiled, "onSpellHit", {
      now,
      source: { id: caster.id ? String(caster.id) : "" },
      target,
      abilityDef: abilityDef || null,
      ops: {
        applyStun: (t, durationMs, appliedAt) => {
          if (!t) {
            return;
          }
          if (t.entityType === "mob") {
            stunMob(t, durationMs, appliedAt);
          } else if (t.entityType === "player") {
            stunPlayer(t, durationMs, appliedAt);
          }
        },
        applySlow: (t, multiplier, durationMs, appliedAt) => {
          if (!t) {
            return;
          }
          if (t.entityType === "mob") {
            applySlowToMob(t, multiplier, durationMs, appliedAt);
          } else if (t.entityType === "player") {
            applySlowToPlayer(t, multiplier, durationMs, appliedAt);
          }
        }
      }
    });
  }

  function onTalentKill(killer, victim, now = Date.now()) {
    if (!killer || !victim) {
      return;
    }

    const defs = buildTalentEffectDefsFromTalentEffects(getTalentEffects(killer));
    if (!defs.length) {
      return;
    }
    const compiled = effectEngine.compile(defs, { defaultTrigger: "onKill" });
    effectEngine.run(compiled, "onKill", {
      now,
      source: { id: killer.id ? String(killer.id) : "" },
      target: killer,
      victim,
      ops: {
        applyHeal: (t, amount) => {
          if (!t) {
            return;
          }
          t.hp = clamp((Number(t.hp) || 0) + Math.max(0, Number(amount) || 0), 0, t.maxHp);
        },
        applyMana: (t, amount) => {
          if (!t) {
            return;
          }
          t.mana = clamp((Number(t.mana) || 0) + Math.max(0, Number(amount) || 0), 0, t.maxMana);
        }
      }
    });
  }

  function onTalentDamageDealt(caster, target, damageDealt, now = Date.now()) {
    if (!caster || !target || damageDealt <= 0) {
      return;
    }

    const defs = buildTalentEffectDefsFromTalentEffects(getTalentEffects(caster));
    if (!defs.length) {
      return;
    }
    const compiled = effectEngine.compile(defs, { defaultTrigger: "onDamageDealt" });
    effectEngine.run(compiled, "onDamageDealt", {
      now,
      source: { id: caster.id ? String(caster.id) : "" },
      target: caster,
      hitTarget: target,
      damageDealt,
      ops: {
        applyStackBuff: (t, key, stacks, maxStacks, durationMs, appliedAt) => {
          if (!t) {
            return;
          }
          const buffKey = String(key || "").trim();
          if (!buffKey) {
            return;
          }
          const addStacks = Math.max(0, Math.floor(Number(stacks) || 0));
          if (addStacks <= 0) {
            return;
          }
          const cap = Math.max(1, Math.floor(Number(maxStacks) || 1));
          const duration = Math.max(0, Math.floor(Number(durationMs) || 0));
          if (duration <= 0) {
            return;
          }

          if (!t.talentBuffs || typeof t.talentBuffs !== "object") {
            t.talentBuffs = {};
          }
          if (!t.talentBuffs.stackBuffs || typeof t.talentBuffs.stackBuffs !== "object") {
            t.talentBuffs.stackBuffs = {};
          }
          const existing = t.talentBuffs.stackBuffs[buffKey] && typeof t.talentBuffs.stackBuffs[buffKey] === "object"
            ? t.talentBuffs.stackBuffs[buffKey]
            : null;
          const existingStacks = Math.max(0, Math.floor(Number(existing && existing.stacks) || 0));
          const nextStacks = clamp(existingStacks + addStacks, 0, cap);
          t.talentBuffs.stackBuffs[buffKey] = {
            stacks: nextStacks,
            expiresAt: appliedAt + duration
          };
          recomputePlayerDerivedStats(t);
        }
      }
    });
  }

  function tickTalentBuffs(player, now = Date.now()) {
    if (!player || !player.talentBuffs || typeof player.talentBuffs !== "object") {
      return;
    }

    const stackBuffs =
      player.talentBuffs.stackBuffs && typeof player.talentBuffs.stackBuffs === "object" ? player.talentBuffs.stackBuffs : null;
    if (!stackBuffs) {
      return;
    }

    let changed = false;
    for (const [key, state] of Object.entries(stackBuffs)) {
      const expiresAt = Math.max(0, Math.floor(Number(state && state.expiresAt) || 0));
      const stacks = Math.max(0, Math.floor(Number(state && state.stacks) || 0));
      if (!key || stacks <= 0 || expiresAt <= now) {
        delete stackBuffs[key];
        changed = true;
      }
    }

    if (Object.keys(stackBuffs).length === 0) {
      player.talentBuffs = {};
      changed = true;
    }

    if (changed) {
      recomputePlayerDerivedStats(player);
    }
  }

  function getTalentBuffStats(player) {
    const stats = {};
    if (!player || !player.talentBuffs || typeof player.talentBuffs !== "object") {
      return stats;
    }

    const stackBuffs =
      player.talentBuffs.stackBuffs && typeof player.talentBuffs.stackBuffs === "object" ? player.talentBuffs.stackBuffs : null;
    if (!stackBuffs) {
      return stats;
    }

    const effects = getTalentEffects(player);
    for (const [key, state] of Object.entries(stackBuffs)) {
      const stacks = Math.max(0, Math.floor(Number(state && state.stacks) || 0));
      if (!key || stacks <= 0) {
        continue;
      }

      // Sum per-stack value for all talents contributing to this buff key, scaled by rank.
      let valuePerStack = 0;
      for (const effect of effects) {
        if (!effect.onDamageDealt || String(effect.onDamageDealt.stat || "") !== key) {
          continue;
        }
        const perRank = Math.max(0, Number(effect.onDamageDealt.value) || 0);
        const rank = Math.max(1, Math.floor(Number(effect.rank) || 1));
        valuePerStack += perRank * rank;
      }
      if (valuePerStack <= 0) {
        continue;
      }

      if (key === "attackPower.percent") {
        stats["meleeDamage.percent"] = (stats["meleeDamage.percent"] || 0) + valuePerStack * stacks;
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
