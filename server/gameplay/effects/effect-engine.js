function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeTrigger(value, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || String(fallback || "").trim().toLowerCase() || "";
}

function normalizeEffectType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeNumeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDurationMs(effect) {
  const durationMsRaw = Number(effect && effect.durationMs);
  if (Number.isFinite(durationMsRaw) && durationMsRaw > 0) {
    return Math.round(durationMsRaw);
  }
  const durationSecRaw = Number(effect && effect.duration);
  if (Number.isFinite(durationSecRaw) && durationSecRaw > 0) {
    return Math.round(durationSecRaw * 1000);
  }
  return 0;
}

function createEffectEngine(options = {}) {
  const randomInt = typeof options.randomInt === "function" ? options.randomInt : defaultRandomInt;
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;

  function compile(effectDefs, compileOptions = {}) {
    const defaultTrigger = normalizeTrigger(compileOptions.defaultTrigger, "onHit") || "onhit";
    const byTrigger = new Map();

    function pushEffect(trigger, compiled) {
      if (!compiled) {
        return;
      }
      const key = normalizeTrigger(trigger, defaultTrigger) || defaultTrigger;
      const list = byTrigger.get(key) || [];
      list.push(compiled);
      byTrigger.set(key, list);
    }

    for (const def of Array.isArray(effectDefs) ? effectDefs : []) {
      if (!def || typeof def !== "object") {
        continue;
      }
      const trigger = normalizeTrigger(def.trigger, defaultTrigger);
      pushEffect(trigger, compileNode(def));
    }

    return Object.freeze({
      byTrigger
    });
  }

  function compileNode(def) {
    const type = normalizeEffectType(def && def.type);
    if (!type) {
      return null;
    }

    if (type === "proc") {
      const chance = clamp(Math.floor(normalizeNumeric(def.chance, 0)), 0, 100);
      const nested = Array.isArray(def.effects) ? def.effects.map(compileNode).filter(Boolean) : [];
      if (chance <= 0 || nested.length === 0) {
        return null;
      }
      return Object.freeze({
        type,
        chance,
        effects: nested
      });
    }

    if (type === "slow") {
      // Supports either `multiplier` directly or `amount` as a slow-amount (converted to multiplier).
      const durationMs = normalizeDurationMs(def);
      const explicitMultiplier = normalizeNumeric(def.multiplier, NaN);
      const amount = normalizeNumeric(def.amount, NaN);
      const multiplier = Number.isFinite(explicitMultiplier)
        ? clamp(explicitMultiplier, 0.1, 1)
        : Number.isFinite(amount)
          ? clamp(1 - clamp(amount, 0, 0.95), 0.1, 1)
          : 1;
      if (durationMs <= 0 || multiplier >= 1) {
        return null;
      }
      return Object.freeze({
        type,
        durationMs,
        multiplier
      });
    }

    if (type === "stun") {
      const durationMs = normalizeDurationMs(def);
      if (durationMs <= 0) {
        return null;
      }
      return Object.freeze({
        type,
        durationMs
      });
    }

    if (type === "dot") {
      const durationMs = normalizeDurationMs(def);
      const school = String(def.school || "generic").trim().toLowerCase() || "generic";
      const damageMin = Math.max(0, normalizeNumeric(def.damageMinPerSecond, 0));
      const damageMax = Math.max(damageMin, normalizeNumeric(def.damageMaxPerSecond, damageMin));
      if (durationMs <= 0 || damageMax <= 0) {
        return null;
      }
      return Object.freeze({
        type,
        durationMs,
        school,
        damageMin,
        damageMax
      });
    }

    if (type === "heal") {
      const amount = Math.max(0, normalizeNumeric(def.amount ?? def.value, 0));
      const durationSec = Math.max(0, normalizeNumeric(def.duration, 0));
      if (amount <= 0) {
        return null;
      }
      return Object.freeze({
        type,
        amount,
        durationSec
      });
    }

    if (type === "mana") {
      const amount = Math.max(0, normalizeNumeric(def.amount ?? def.value, 0));
      const durationSec = Math.max(0, normalizeNumeric(def.duration, 0));
      if (amount <= 0) {
        return null;
      }
      return Object.freeze({
        type,
        amount,
        durationSec
      });
    }

    if (type === "stack_buff") {
      const key = String(def.key ?? def.buffKey ?? def.stat ?? def.id ?? "").trim();
      const durationMs = normalizeDurationMs(def);
      const maxStacks = clamp(Math.floor(normalizeNumeric(def.maxStacks, 1)), 1, 9999);
      const stacks = clamp(Math.floor(normalizeNumeric(def.stacks, 1)), 1, maxStacks);
      if (!key || durationMs <= 0 || maxStacks <= 0 || stacks <= 0) {
        return null;
      }
      return Object.freeze({
        type,
        key,
        durationMs,
        maxStacks,
        stacks
      });
    }

    return Object.freeze({
      type,
      raw: { ...def }
    });
  }

  function run(compiled, trigger, ctx = {}) {
    const pipeline = compiled && compiled.byTrigger instanceof Map ? compiled.byTrigger.get(normalizeTrigger(trigger, "")) : null;
    if (!pipeline || pipeline.length === 0) {
      return { ran: 0 };
    }
    let ran = 0;
    for (const effect of pipeline) {
      if (runNode(effect, ctx)) {
        ran += 1;
      }
    }
    return { ran };
  }

  function runNode(effect, ctx) {
    if (!effect || typeof effect !== "object") {
      return false;
    }
    const type = effect.type;
    const ops = ctx && ctx.ops && typeof ctx.ops === "object" ? ctx.ops : {};
    const now = Math.max(0, Math.floor(Number(ctx.now) || Date.now()));

    if (type === "proc") {
      const chance = clamp(Math.floor(normalizeNumeric(effect.chance, 0)), 0, 100);
      if (chance <= 0) {
        return false;
      }
      const roll = randomInt(1, 100);
      if (roll > chance) {
        return false;
      }
      let ranAny = false;
      for (const nested of Array.isArray(effect.effects) ? effect.effects : []) {
        if (runNode(nested, ctx)) {
          ranAny = true;
        }
      }
      return ranAny;
    }

    if (type === "slow") {
      if (typeof ops.applySlow !== "function") {
        return false;
      }
      ops.applySlow(ctx.target, effect.multiplier, effect.durationMs, now, ctx);
      return true;
    }

    if (type === "stun") {
      if (typeof ops.applyStun !== "function") {
        return false;
      }
      ops.applyStun(ctx.target, effect.durationMs, now, ctx);
      return true;
    }

    if (type === "dot") {
      if (typeof ops.applyDot !== "function") {
        return false;
      }
      ops.applyDot(
        ctx.target,
        ctx.source && ctx.source.id ? String(ctx.source.id) : null,
        effect.school,
        effect.damageMin,
        effect.damageMax,
        effect.durationMs,
        now,
        ctx
      );
      return true;
    }

    if (type === "heal") {
      if (typeof ops.applyHeal !== "function") {
        return false;
      }
      ops.applyHeal(ctx.target, effect.amount, effect.durationSec, now, ctx);
      return true;
    }

    if (type === "mana") {
      if (typeof ops.applyMana !== "function") {
        return false;
      }
      ops.applyMana(ctx.target, effect.amount, effect.durationSec, now, ctx);
      return true;
    }

    if (type === "stack_buff") {
      if (typeof ops.applyStackBuff !== "function") {
        return false;
      }
      ops.applyStackBuff(ctx.target, effect.key, effect.stacks, effect.maxStacks, effect.durationMs, now, ctx);
      return true;
    }

    return false;
  }

  return Object.freeze({
    compile,
    run
  });
}

module.exports = {
  createEffectEngine
};
