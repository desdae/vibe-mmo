function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createPlayerResourceTools(options = {}) {
  const tickMs = Math.max(1, Number(options.tickMs) || 50);
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;

  function getPendingHealAmount(player) {
    if (!player || !Array.isArray(player.activeHeals) || !player.activeHeals.length) {
      return 0;
    }
    let total = 0;
    for (const effect of player.activeHeals) {
      if (!effect) {
        continue;
      }
      total += Math.max(0, Number(effect.remainingTotal) || 0);
    }
    return Math.max(0, total);
  }

  function getPendingManaAmount(player) {
    if (!player || !Array.isArray(player.activeManaRestores) || !player.activeManaRestores.length) {
      return 0;
    }
    let total = 0;
    for (const effect of player.activeManaRestores) {
      if (!effect) {
        continue;
      }
      total += Math.max(0, Number(effect.remainingTotal) || 0);
    }
    return Math.max(0, total);
  }

  function addHealOverTimeEffect(player, totalValue, durationSec) {
    if (!player) {
      return false;
    }
    const value = Math.max(0, Number(totalValue) || 0);
    const durationMs = Math.max(1, Math.round(Math.max(0, Number(durationSec) || 0) * 1000));
    if (value <= 0 || durationMs <= 0) {
      return false;
    }
    if (!Array.isArray(player.activeHeals)) {
      player.activeHeals = [];
    }
    player.activeHeals.push({
      remainingTotal: value,
      remainingMs: durationMs,
      ratePerMs: value / durationMs
    });
    return true;
  }

  function addManaOverTimeEffect(player, totalValue, durationSec) {
    if (!player) {
      return false;
    }
    const value = Math.max(0, Number(totalValue) || 0);
    const durationMs = Math.max(1, Math.round(Math.max(0, Number(durationSec) || 0) * 1000));
    if (value <= 0 || durationMs <= 0) {
      return false;
    }
    if (!Array.isArray(player.activeManaRestores)) {
      player.activeManaRestores = [];
    }
    player.activeManaRestores.push({
      remainingTotal: value,
      remainingMs: durationMs,
      ratePerMs: value / durationMs
    });
    return true;
  }

  function tickPlayerHealEffects(player) {
    if (!player || !Array.isArray(player.activeHeals) || !player.activeHeals.length) {
      return;
    }

    const nextEffects = [];
    for (const effect of player.activeHeals) {
      if (!effect) {
        continue;
      }
      let remainingTotal = Math.max(0, Number(effect.remainingTotal) || 0);
      let remainingMs = Math.max(0, Number(effect.remainingMs) || 0);
      const ratePerMs = Math.max(0, Number(effect.ratePerMs) || 0);
      if (remainingTotal <= 0 || remainingMs <= 0 || ratePerMs <= 0) {
        continue;
      }

      const stepMs = Math.min(remainingMs, tickMs);
      const healBudget = Math.min(remainingTotal, ratePerMs * stepMs);
      if (healBudget > 0 && player.hp > 0) {
        const healed = Math.min(healBudget, Math.max(0, player.maxHp - player.hp));
        player.hp = clamp(player.hp + healed, 0, player.maxHp);
      }
      remainingTotal = Math.max(0, remainingTotal - healBudget);
      remainingMs = Math.max(0, remainingMs - tickMs);

      if (remainingTotal > 0.0001 && remainingMs > 0) {
        nextEffects.push({
          remainingTotal,
          remainingMs,
          ratePerMs
        });
      }
    }

    player.activeHeals = nextEffects;
  }

  function tickPlayerManaEffects(player) {
    if (!player || !Array.isArray(player.activeManaRestores) || !player.activeManaRestores.length) {
      return;
    }

    const nextEffects = [];
    for (const effect of player.activeManaRestores) {
      if (!effect) {
        continue;
      }
      let remainingTotal = Math.max(0, Number(effect.remainingTotal) || 0);
      let remainingMs = Math.max(0, Number(effect.remainingMs) || 0);
      const ratePerMs = Math.max(0, Number(effect.ratePerMs) || 0);
      if (remainingTotal <= 0 || remainingMs <= 0 || ratePerMs <= 0) {
        continue;
      }

      const stepMs = Math.min(remainingMs, tickMs);
      const manaBudget = Math.min(remainingTotal, ratePerMs * stepMs);
      if (manaBudget > 0 && player.hp > 0) {
        const restored = Math.min(manaBudget, Math.max(0, player.maxMana - player.mana));
        player.mana = clamp(player.mana + restored, 0, player.maxMana);
      }
      remainingTotal = Math.max(0, remainingTotal - manaBudget);
      remainingMs = Math.max(0, remainingMs - tickMs);

      if (remainingTotal > 0.0001 && remainingMs > 0) {
        nextEffects.push({
          remainingTotal,
          remainingMs,
          ratePerMs
        });
      }
    }

    player.activeManaRestores = nextEffects;
  }

  return {
    getPendingHealAmount,
    getPendingManaAmount,
    addHealOverTimeEffect,
    addManaOverTimeEffect,
    tickPlayerHealEffects,
    tickPlayerManaEffects
  };
}

module.exports = {
  createPlayerResourceTools
};
