function normalizeNumeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeEffectType(value) {
  return String(value || "").trim().toLowerCase();
}

function buildTalentEffectDefsFromTalentEffects(talentEffects) {
  const defs = [];

  for (const effect of Array.isArray(talentEffects) ? talentEffects : []) {
    if (!effect || typeof effect !== "object") {
      continue;
    }
    const rank = Math.max(1, Math.floor(normalizeNumeric(effect.rank, 1)));

    const onSpellHit = effect.onSpellHit && typeof effect.onSpellHit === "object" ? effect.onSpellHit : null;
    if (onSpellHit) {
      const chancePerRank = Math.max(0, normalizeNumeric(onSpellHit.chance, 0));
      const chance = chancePerRank * rank;
      const durationSec = Math.max(0, normalizeNumeric(onSpellHit.duration, 0));
      const kind = normalizeEffectType(onSpellHit.effect);
      const nested = [];

      if ((kind === "freeze" || kind === "stun") && durationSec > 0) {
        nested.push({ type: "stun", duration: durationSec });
      } else if (kind === "slow") {
        const slowAmount = Math.max(0, normalizeNumeric(onSpellHit.slowAmount, 0.3));
        if (durationSec > 0 && slowAmount > 0) {
          nested.push({ type: "slow", amount: slowAmount, duration: durationSec });
        }
      }

      if (chance > 0 && nested.length) {
        defs.push({
          trigger: "onSpellHit",
          type: "proc",
          chance,
          effects: nested
        });
      }
    }

    const onKill = effect.onKill && typeof effect.onKill === "object" ? effect.onKill : null;
    if (onKill) {
      const kind = normalizeEffectType(onKill.effect ?? onKill.type);
      if (kind === "heal" || kind === "mana") {
        const valuePerRank = Math.max(0, normalizeNumeric(onKill.value ?? onKill.amount, 0));
        const amount = valuePerRank * rank;
        if (amount > 0) {
          defs.push({
            trigger: "onKill",
            type: kind,
            amount,
            duration: Math.max(0, normalizeNumeric(onKill.duration, 0))
          });
        }
      }
    }

    const onDamageDealt = effect.onDamageDealt && typeof effect.onDamageDealt === "object" ? effect.onDamageDealt : null;
    if (onDamageDealt) {
      const statKey = String(onDamageDealt.stat || "").trim();
      const durationSec = Math.max(0, normalizeNumeric(onDamageDealt.duration, 0));
      const maxStacks = Math.max(1, Math.floor(normalizeNumeric(onDamageDealt.maxStacks, 1)));
      if (statKey && durationSec > 0 && maxStacks > 0) {
        defs.push({
          trigger: "onDamageDealt",
          type: "stack_buff",
          key: statKey,
          stacks: 1,
          maxStacks,
          duration: durationSec
        });
      }
    }
  }

  return defs;
}

module.exports = {
  buildTalentEffectDefsFromTalentEffects
};
