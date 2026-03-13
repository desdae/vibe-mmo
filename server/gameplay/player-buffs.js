function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deriveBuffLabel(effect, abilityDef) {
  const explicit = String(effect && effect.label || "").trim().toUpperCase();
  if (explicit) {
    return explicit.slice(0, 3);
  }
  const name = String((effect && effect.name) || (abilityDef && abilityDef.name) || "").trim();
  if (!name) {
    return "BF";
  }
  const letters = name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (letters || name.slice(0, 2)).slice(0, 3);
}

function getBuffDurationMs(effect, fallbackMs = 0) {
  const durationMsRaw = Number(effect && effect.durationMs);
  if (Number.isFinite(durationMsRaw) && durationMsRaw > 0) {
    return Math.round(durationMsRaw);
  }
  const durationSecRaw = Number(effect && effect.duration);
  if (Number.isFinite(durationSecRaw) && durationSecRaw > 0) {
    return Math.round(durationSecRaw * 1000);
  }
  return Math.max(0, Math.round(Number(fallbackMs) || 0));
}

function createPlayerBuffTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;
  const recomputePlayerDerivedStats =
    typeof options.recomputePlayerDerivedStats === "function" ? options.recomputePlayerDerivedStats : () => {};

  function rebuildPlayerBuffState(player, now = Date.now()) {
    if (!player) {
      return false;
    }
    const active = (Array.isArray(player.activeBuffs) ? player.activeBuffs : []).filter((buff) => {
      if (!buff || typeof buff !== "object") {
        return false;
      }
      return Math.max(0, Number(buff.endsAt) || 0) > now;
    });
    const hadChanges = active.length !== (Array.isArray(player.activeBuffs) ? player.activeBuffs.length : 0);

    let healthRegenFlat = 0;
    let meleeDamagePercent = 0;
    let attackSpeedPercent = 0;
    let castSpeedPercent = 0;
    let damageGlobalPercent = 0;
    let invulnerableUntil = 0;
    let crowdControlImmuneUntil = 0;
    for (const buff of active) {
      const stats = buff.stats && typeof buff.stats === "object" ? buff.stats : {};
      healthRegenFlat += Number(stats.healthRegenFlat) || 0;
      meleeDamagePercent += Number(stats.meleeDamagePercent) || 0;
      attackSpeedPercent += Number(stats["attackSpeed.percent"]) || 0;
      castSpeedPercent += Number(stats["castSpeed.percent"]) || 0;
      damageGlobalPercent += Number(stats["damage.global.percent"]) || 0;
      if (stats.invulnerable) {
        invulnerableUntil = Math.max(invulnerableUntil, Math.max(0, Number(buff.endsAt) || 0));
      }
      if (stats.crowdControlImmune) {
        crowdControlImmuneUntil = Math.max(crowdControlImmuneUntil, Math.max(0, Number(buff.endsAt) || 0));
      }
    }

    player.activeBuffs = active;
    player.buffHealthRegenFlat = healthRegenFlat;
    player.buffMeleeDamagePercent = meleeDamagePercent;
    player.buffAttackSpeedPercent = attackSpeedPercent;
    player.buffCastSpeedPercent = castSpeedPercent;
    player.buffDamageGlobalPercent = damageGlobalPercent;
    player.invulnerableUntil = invulnerableUntil;
    player.crowdControlImmuneUntil = crowdControlImmuneUntil;
    recomputePlayerDerivedStats(player);
    return hadChanges;
  }

  function applyAbilityBuffsToPlayer(player, abilityDef, now = Date.now()) {
    if (!player || !abilityDef) {
      return false;
    }
    const buffEffects = Array.isArray(abilityDef.buffEffects) ? abilityDef.buffEffects : [];
    if (!buffEffects.length) {
      return false;
    }

    const existing = Array.isArray(player.activeBuffs) ? player.activeBuffs.filter(Boolean) : [];
    const nextBuffs = existing.filter((buff) => Math.max(0, Number(buff.endsAt) || 0) > now);
    let applied = false;

    for (let index = 0; index < buffEffects.length; index += 1) {
      const effect = buffEffects[index];
      if (!effect || typeof effect !== "object") {
        continue;
      }
      const durationMs = getBuffDurationMs(effect, abilityDef.durationMs);
      if (durationMs <= 0) {
        continue;
      }
      const buffId = String(effect.id || `${abilityDef.id}:${index}`);
      const nextBuff = {
        id: buffId,
        sourceAbilityId: String(abilityDef.id || ""),
        name: String(effect.name || abilityDef.name || buffId),
        label: deriveBuffLabel(effect, abilityDef),
        color: String(effect.color || "").trim(),
        startedAt: now,
        endsAt: now + durationMs,
        durationMs,
        stats: effect.stats && typeof effect.stats === "object" ? { ...effect.stats } : {}
      };
      const existingIndex = nextBuffs.findIndex((buff) => String(buff && buff.id || "") === buffId);
      if (existingIndex >= 0) {
        nextBuffs.splice(existingIndex, 1, nextBuff);
      } else {
        nextBuffs.push(nextBuff);
      }
      applied = true;
    }

    if (!applied) {
      return false;
    }

    player.activeBuffs = nextBuffs;
    rebuildPlayerBuffState(player, now);
    return true;
  }

  function tickPlayerBuffs(player, now = Date.now()) {
    if (!player || !Array.isArray(player.activeBuffs) || !player.activeBuffs.length) {
      return false;
    }
    return rebuildPlayerBuffState(player, now);
  }

  function clearPlayerBuffs(player) {
    if (!player) {
      return;
    }
    player.activeBuffs = [];
    player.buffHealthRegenFlat = 0;
    player.buffMeleeDamagePercent = 0;
    player.buffAttackSpeedPercent = 0;
    player.buffCastSpeedPercent = 0;
    player.buffDamageGlobalPercent = 0;
    player.invulnerableUntil = 0;
    player.crowdControlImmuneUntil = 0;
    recomputePlayerDerivedStats(player);
  }

  function buildSelfBuffVisuals(player, now = Date.now()) {
    if (!player || !Array.isArray(player.activeBuffs) || !player.activeBuffs.length) {
      return [];
    }
    return player.activeBuffs
      .filter((buff) => Math.max(0, Number(buff.endsAt) || 0) > now)
      .map((buff) => ({
        id: String(buff.id || ""),
        name: String(buff.name || ""),
        label: String(buff.label || "").slice(0, 3).toUpperCase(),
        color: String(buff.color || "").trim(),
        durationMs: clamp(Math.floor(Number(buff.durationMs) || 0), 1, 65535),
        remainingMs: clamp(Math.floor((Number(buff.endsAt) || 0) - now), 1, 65535)
      }))
      .sort((a, b) => a.remainingMs - b.remainingMs || a.id.localeCompare(b.id));
  }

  return {
    applyAbilityBuffsToPlayer,
    tickPlayerBuffs,
    clearPlayerBuffs,
    buildSelfBuffVisuals
  };
}

module.exports = {
  createPlayerBuffTools
};
