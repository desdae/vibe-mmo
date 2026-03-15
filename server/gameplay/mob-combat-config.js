const { clamp, parseNumericRange } = require("./number-utils");
const { getObjectPath, firstFiniteNumber } = require("./object-utils");

function parseMobCombatConfig(rawCombat, abilityDefs, fallbackDamageMin, fallbackDamageMax, defaults) {
  const raw = rawCombat && typeof rawCombat === "object" ? rawCombat : {};
  const behaviorRaw = String(raw.behavior || "").trim().toLowerCase();
  const behavior =
    behaviorRaw === "ranged"
      ? "ranged"
      : behaviorRaw === "flee" || behaviorRaw === "passive_flee" || behaviorRaw === "flee_passive"
        ? "flee"
        : "melee";
  const aggroRange = clamp(Number(raw.aggroRange) || defaults.mobAggroRange, 0.5, 100);
  const preferredRange = clamp(
    Number(raw.preferredRange) ||
      (behavior === "ranged" ? Math.max(2, defaults.mobAttackRange * 2) : defaults.mobAttackRange),
    0.2,
    100
  );
  const leashRange = clamp(Number(raw.leashRange) || defaults.mobWanderRadius, 1, 500);
  const panicDurationMs = Math.max(
    0,
    Math.round((Number(raw.panicDuration) || Number(raw.panicDurationSec) || 0) * 1000)
  );
  const fleeSpeedMultiplier = clamp(Number(raw.fleeSpeedMultiplier) || 1.1, 0.5, 4);

  const basicRaw = raw.basicAttack && typeof raw.basicAttack === "object" ? raw.basicAttack : {};
  const [basicDamageMinParsed, basicDamageMaxParsed] = parseNumericRange(
    basicRaw.damage,
    Math.max(0, Number(fallbackDamageMin) || 0),
    Math.max(0, Number(fallbackDamageMax) || Math.max(0, Number(fallbackDamageMin) || 0))
  );
  const basicCooldownMs = Math.max(
    50,
    Math.round(
      (
        Math.max(
          0,
          Number.isFinite(Number(basicRaw.cooldown))
            ? Number(basicRaw.cooldown)
            : Number(getObjectPath(basicRaw, "delivery.cooldown")) || defaults.mobAttackCooldownMs / 1000
        )
      ) * 1000
    )
  );
  const basicRange = clamp(
    Number.isFinite(Number(basicRaw.range))
      ? Number(basicRaw.range)
      : Number(getObjectPath(basicRaw, "targeting.range")) || defaults.mobAttackRange,
    0.2,
    30
  );
  const basicAbilityId = String(
    basicRaw.abilityId || basicRaw.id || (abilityDefs && abilityDefs.has("mobMeleeSwing") ? "mobMeleeSwing" : "")
  ).trim();
  const basicAttackTypeRaw = String(basicRaw.type || "").trim().toLowerCase();
  const hasBasicAbility = !!(basicAbilityId && abilityDefs && abilityDefs.has(basicAbilityId));
  const basicAttackType = hasBasicAbility || basicAttackTypeRaw === "ability" ? "ability" : "melee";
  const basicTargeting =
    basicRaw.targeting && typeof basicRaw.targeting === "object"
      ? JSON.parse(JSON.stringify(basicRaw.targeting))
      : null;
  const basicDelivery =
    basicRaw.delivery && typeof basicRaw.delivery === "object"
      ? JSON.parse(JSON.stringify(basicRaw.delivery))
      : null;
  const basicEffects = Array.isArray(basicRaw.effects) ? JSON.parse(JSON.stringify(basicRaw.effects)) : null;
  const basicConfig = JSON.parse(JSON.stringify(basicRaw));

  const abilities = [];
  for (const entry of Array.isArray(raw.abilities) ? raw.abilities : []) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const abilityId = String(entry.abilityId || entry.id || "").trim();
    if (!abilityId || !abilityDefs || !abilityDefs.has(abilityId)) {
      continue;
    }
    const abilityDef = abilityDefs.get(abilityId);
    const configuredRange = firstFiniteNumber([getObjectPath(entry, "targeting.range"), entry.range], Number.NaN);
    const abilityRangeDefault = Number.isFinite(configuredRange)
      ? Math.max(0.2, configuredRange)
      : Math.max(0.2, Number(abilityDef?.range) || 0.2);
    const minRange = clamp(Number(entry.minRange) || 0, 0, 100);
    const maxRange = clamp(Number(entry.maxRange) || abilityRangeDefault, minRange, 100);
    const weight = clamp(Number(entry.weight) || 1, 0.01, 1000);
    const castChance = clamp(Number(entry.castChance), 0, 1);
    const level = clamp(Math.floor(Number(entry.level) || 1), 1, 255);
    const cooldownMs = Math.max(
      0,
      Math.round(
        (Number.isFinite(Number(entry.cooldown))
          ? Number(entry.cooldown)
          : Number.isFinite(Number(getObjectPath(entry, "delivery.cooldown")))
            ? Number(getObjectPath(entry, "delivery.cooldown"))
            : Math.max(0, Number(abilityDef?.cooldownMs) || 0) / 1000) * 1000
      )
    );
    const targeting =
      entry.targeting && typeof entry.targeting === "object"
        ? JSON.parse(JSON.stringify(entry.targeting))
        : null;
    const delivery =
      entry.delivery && typeof entry.delivery === "object"
        ? JSON.parse(JSON.stringify(entry.delivery))
        : null;
    const effects = Array.isArray(entry.effects) ? JSON.parse(JSON.stringify(entry.effects)) : null;
    const config = JSON.parse(JSON.stringify(entry));
    abilities.push({
      abilityId,
      weight,
      minRange,
      maxRange,
      cooldownMs,
      castChance: Number.isFinite(castChance) ? castChance : 1,
      level,
      targeting,
      delivery,
      effects,
      config
    });
  }

  return {
    behavior,
    aggroRange,
    preferredRange,
    leashRange,
    panicDurationMs,
    fleeSpeedMultiplier,
    basicAttack: {
      type: basicAttackType,
      abilityId: hasBasicAbility ? basicAbilityId : "",
      damageMin: clamp(Math.floor(Math.min(basicDamageMinParsed, basicDamageMaxParsed)), 0, 255),
      damageMax: clamp(Math.ceil(Math.max(basicDamageMinParsed, basicDamageMaxParsed)), 0, 255),
      cooldownMs: basicCooldownMs,
      range: basicRange,
      targeting: basicTargeting,
      delivery: basicDelivery,
      effects: basicEffects,
      config: basicConfig
    },
    abilities
  };
}

module.exports = {
  parseMobCombatConfig
};
