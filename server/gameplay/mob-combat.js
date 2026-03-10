function defaultClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createMobCombatTools(options = {}) {
  const clamp = typeof options.clamp === "function" ? options.clamp : defaultClamp;
  const normalizeDirection =
    typeof options.normalizeDirection === "function" ? options.normalizeDirection : () => null;
  const distance = typeof options.distance === "function" ? options.distance : () => Infinity;
  const players = options.players;
  const defaultAggroRange = Math.max(0.25, Number(options.defaultAggroRange) || 5);
  const defaultAttackRange = Math.max(0.1, Number(options.defaultAttackRange) || 1.25);
  const defaultWanderRadius = Math.max(1, Number(options.defaultWanderRadius) || 10);
  const defaultAttackCooldownMs = Math.max(1, Number(options.defaultAttackCooldownMs) || 900);

  if (!(players instanceof Map)) {
    throw new Error("createMobCombatTools requires players map");
  }

  function getMobCombatProfile(mob) {
    const combat = mob && mob.combat && typeof mob.combat === "object" ? mob.combat : null;
    if (combat) {
      return combat;
    }
    const fallbackDamageMin = clamp(Math.floor(Number(mob?.damageMin) || 1), 0, 255);
    const fallbackDamageMax = clamp(
      Math.floor(Number(mob?.damageMax) || fallbackDamageMin),
      fallbackDamageMin,
      255
    );
    return {
      behavior: "melee",
      aggroRange: defaultAggroRange,
      preferredRange: defaultAttackRange,
      leashRange: defaultWanderRadius,
      basicAttack: {
        type: "melee",
        abilityId: "",
        damageMin: fallbackDamageMin,
        damageMax: fallbackDamageMax,
        cooldownMs: defaultAttackCooldownMs,
        range: defaultAttackRange
      },
      abilities: []
    };
  }

  function getNearestAggroPlayer(mob, maxAggroRange = defaultAggroRange) {
    let nearest = null;
    let nearestDistance = Infinity;
    const rangeLimit = Math.max(0.25, Number(maxAggroRange) || defaultAggroRange);

    for (const player of players.values()) {
      if (player.hp <= 0) {
        continue;
      }
      const d = distance(mob, player);
      if (d <= rangeLimit && d < nearestDistance) {
        nearest = player;
        nearestDistance = d;
      }
    }

    return { player: nearest, dist: nearestDistance };
  }

  function triggerMobAttackAnimation(mob, targetDir, now = Date.now(), abilityId = "") {
    if (!mob) {
      return;
    }
    const normalized = normalizeDirection(Number(targetDir?.dx) || 0, Number(targetDir?.dy) || 0);
    if (normalized) {
      mob.lastBiteDirection = normalized;
    }
    mob.lastAttackAbilityId = String(abilityId || "").trim().slice(0, 64);
    mob.lastAttackAt = now;
    mob.biteCounter = (Number(mob.biteCounter) + 1) & 0xff;
  }

  return {
    getMobCombatProfile,
    getNearestAggroPlayer,
    triggerMobAttackAnimation
  };
}

module.exports = {
  createMobCombatTools
};
