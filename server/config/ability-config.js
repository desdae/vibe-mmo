const fs = require("fs");
const { clamp, parseNumericRange } = require("../gameplay/number-utils");

function findAbilityEffect(effects, type, mode = "") {
  const targetType = String(type || "").trim().toLowerCase();
  const targetMode = String(mode || "").trim().toLowerCase();
  for (const effect of Array.isArray(effects) ? effects : []) {
    if (!effect || typeof effect !== "object") {
      continue;
    }
    if (String(effect.type || "").trim().toLowerCase() !== targetType) {
      continue;
    }
    if (targetMode && String(effect.mode || "").trim().toLowerCase() !== targetMode) {
      continue;
    }
    return effect;
  }
  return null;
}

const OMITTED_CLIENT_FIELDS = new Set([
  "name",
  "description",
  "kind",
  "cooldown",
  "cooldownMs",
  "castMs",
  "castTime",
  "manaCost",
  "range",
  "speed",
  "damageRange",
  "damageRangePerLevel",
  "coneAngle",
  "hitRadius",
  "projectileHitRadius",
  "explosionRadius",
  "explosionDamageMultiplier",
  "radius",
  "areaRadius",
  "duration",
  "durationMs",
  "damagePerSecond",
  "dotDamagePerSecond",
  "dotDamagePerSecondPerLevel",
  "dotDuration",
  "dotDurationMs",
  "dotSchool",
  "beamWidth",
  "width",
  "stunDuration",
  "slowDuration",
  "slowDurationMs",
  "slowAmount",
  "slowMultiplier",
  "jumpCount",
  "jumpRange",
  "jumpDamageReduction",
  "jumpCountPerLevel",
  "durationPerLevel",
  "summonCount",
  "summonFormationRadius",
  "summonCountPerLevel",
  "summonCountEveryLevels",
  "maxSummonCount",
  "summonAbilityId",
  "summonAbilityOverrides",
  "homingRange",
  "homingTurnRate",
  "turnRate",
  "damageMode"
]);

function loadAbilityConfigFromDisk(configPath, options) {
  const normalizeAbilityEntry = options && options.normalizeAbilityEntry;
  const buildEmitProjectilesConfig = options && options.buildEmitProjectilesConfig;
  const defaultAbilityKind = String((options && options.defaultAbilityKind) || "meleeCone");
  if (typeof normalizeAbilityEntry !== "function" || typeof buildEmitProjectilesConfig !== "function") {
    throw new Error("loadAbilityConfigFromDisk requires normalization helpers");
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const entries = parsed && typeof parsed === "object" ? Object.entries(parsed) : [];
  const normalizedEntries = entries
    .map(([rawId, rawEntry]) => normalizeAbilityEntry(rawId, rawEntry))
    .filter((entry) => entry && typeof entry === "object" && String(entry.id || "").trim());
  const normalizedEntriesById = new Map();
  for (const entry of normalizedEntries) {
    normalizedEntriesById.set(String(entry.id).trim(), entry);
  }

  const abilityDefs = new Map();
  const clientAbilityDefs = [];

  function mergeAbilityTemplate(baseEntry, overrideEntry) {
    const base = baseEntry && typeof baseEntry === "object" ? baseEntry : {};
    const override = overrideEntry && typeof overrideEntry === "object" ? overrideEntry : {};
    return {
      ...base,
      ...override,
      delivery:
        base.delivery || override.delivery
          ? {
              ...(base.delivery && typeof base.delivery === "object" ? base.delivery : {}),
              ...(override.delivery && typeof override.delivery === "object" ? override.delivery : {})
            }
          : undefined,
      targeting:
        base.targeting || override.targeting
          ? {
              ...(base.targeting && typeof base.targeting === "object" ? base.targeting : {}),
              ...(override.targeting && typeof override.targeting === "object" ? override.targeting : {})
            }
          : undefined,
      progression:
        base.progression || override.progression
          ? {
              ...(base.progression && typeof base.progression === "object" ? base.progression : {}),
              ...(override.progression && typeof override.progression === "object" ? override.progression : {}),
              perLevel: {
                ...((base.progression && base.progression.perLevel && typeof base.progression.perLevel === "object")
                  ? base.progression.perLevel
                  : {}),
                ...((override.progression && override.progression.perLevel && typeof override.progression.perLevel === "object")
                  ? override.progression.perLevel
                  : {})
              }
            }
          : undefined,
      effects: Array.isArray(override.effects) ? override.effects : base.effects,
      tags: Array.isArray(override.tags) ? override.tags : base.tags
    };
  }

  function resolveChildAbilityEntry(parentId, rawChildSource) {
    if (!rawChildSource || typeof rawChildSource !== "object") {
      return null;
    }
    const referenceId = String(rawChildSource.abilityId || rawChildSource.childAbilityId || "").trim();
    if (!referenceId) {
      return normalizeAbilityEntry(`${parentId}_child`, rawChildSource);
    }
    const baseEntry = normalizedEntriesById.get(referenceId);
    if (!baseEntry) {
      return null;
    }
    const overrideSource =
      rawChildSource.overrides && typeof rawChildSource.overrides === "object" ? rawChildSource.overrides : {};
    const merged = mergeAbilityTemplate(baseEntry, {
      ...overrideSource,
      id: referenceId
    });
    return normalizeAbilityEntry(referenceId, merged);
  }

  function buildProjectileTemplateFromChildSource(parentId, rawChildSource) {
    const childEntry = resolveChildAbilityEntry(parentId, rawChildSource);
    if (!childEntry || typeof childEntry !== "object") {
      return null;
    }
    const childConfig = buildEmitProjectilesConfig(
      {
        effects: [
          {
            type: "emitProjectiles",
            interval: 1,
            projectile: childEntry
          }
        ]
      },
      `${parentId}_child_projectile`
    );
    return childConfig && childConfig.childProjectile ? childConfig.childProjectile : null;
  }

  function buildResolvedEmitProjectilesConfig(entry, abilityId) {
    const emitEffect = findAbilityEffect(entry && entry.effects, "emitprojectiles");
    if (!emitEffect || typeof emitEffect !== "object") {
      return buildEmitProjectilesConfig(entry, abilityId);
    }
    const resolvedChildEntry = resolveChildAbilityEntry(abilityId, emitEffect.projectile);
    if (!resolvedChildEntry) {
      return buildEmitProjectilesConfig(entry, abilityId);
    }

    const resolvedEntry = {
      ...entry,
      effects: (Array.isArray(entry.effects) ? entry.effects : []).map((effect) => {
        if (effect === emitEffect) {
          return {
            ...emitEffect,
            projectile: resolvedChildEntry
          };
        }
        return effect;
      })
    };
    return buildEmitProjectilesConfig(resolvedEntry, abilityId);
  }

  for (const entry of normalizedEntries) {
    const id = String(entry?.id || "").trim();
    if (!id || !entry || typeof entry !== "object") {
      continue;
    }

    const damageRangeInput = entry.damageRange !== undefined ? entry.damageRange : entry.damagePerSecond;
    const damageRange = parseNumericRange(damageRangeInput, 1, 1);
    const damagePerLevel = parseNumericRange(entry.damageRangePerLevel, 0, 0);
    const dotDamageRange = parseNumericRange(entry.dotDamagePerSecond, 0, 0);
    const dotDamagePerLevel = parseNumericRange(entry.dotDamagePerSecondPerLevel, 0, 0);
    const cooldownMs = Math.max(0, Math.round((Number(entry.cooldown) || 0) * 1000));
    const range = Math.max(0, Number(entry.range) || 0);
    const speed = Math.max(0, Number(entry.speed) || 0);
    const coneAngleDeg = clamp(Number(entry.coneAngle) || 60, 5, 180);
    const coneCos = Math.cos((coneAngleDeg * Math.PI) / 360);
    const kind =
      typeof entry.kind === "string" && entry.kind.trim()
        ? entry.kind.trim()
        : speed > 0
          ? "projectile"
          : coneAngleDeg > 0
            ? "meleeCone"
            : defaultAbilityKind;

    const castMsRaw = Number(entry.castMs);
    const castTimeRaw = Number(entry.castTime);
    let castMs = 0;
    if (Number.isFinite(castMsRaw) && castMsRaw > 0) {
      castMs = Math.round(castMsRaw);
    } else if (Number.isFinite(castTimeRaw) && castTimeRaw > 0) {
      castMs = Math.round(castTimeRaw * 1000);
    }

    const projectileHitRadius = clamp(Number(entry.projectileHitRadius) || Number(entry.hitRadius) || 0.6, 0.1, 8);
    const explosionRadius = Math.max(0, Number(entry.explosionRadius) || 0);
    const explosionDamageMultiplier = clamp(Number(entry.explosionDamageMultiplier) || 0, 0, 1);
    const areaRadius = Math.max(0, Number(entry.radius) || Number(entry.areaRadius) || range);
    const durationMsRaw = Number(entry.durationMs);
    const durationSecRaw = Number(entry.duration);
    const durationMs =
      Number.isFinite(durationMsRaw) && durationMsRaw > 0
        ? Math.round(durationMsRaw)
        : Number.isFinite(durationSecRaw) && durationSecRaw > 0
          ? Math.round(durationSecRaw * 1000)
          : 0;
    const durationPerLevelMsRaw = Number(entry.durationPerLevelMs);
    const durationPerLevelSecRaw = Number(entry.durationPerLevel);
    const durationPerLevelMs =
      Number.isFinite(durationPerLevelMsRaw) && durationPerLevelMsRaw > 0
        ? Math.round(durationPerLevelMsRaw)
        : Number.isFinite(durationPerLevelSecRaw) && durationPerLevelSecRaw > 0
          ? Math.round(durationPerLevelSecRaw * 1000)
          : 0;
    const dotDurationMsRaw = Number(entry.dotDurationMs);
    const dotDurationSecRaw = Number(entry.dotDuration);
    const dotDurationMs =
      Number.isFinite(dotDurationMsRaw) && dotDurationMsRaw > 0
        ? Math.round(dotDurationMsRaw)
        : Number.isFinite(dotDurationSecRaw) && dotDurationSecRaw > 0
          ? Math.round(dotDurationSecRaw * 1000)
          : 0;
    const dotSchool = String(entry.dotSchool || "").trim().toLowerCase();
    const invulnerabilityDurationMs = Math.max(0, Math.round((Number(entry.invulnerabilityDuration) || 0) * 1000));
    const rangePerLevel = Math.max(0, Number(entry.rangePerLevel) || 0);
    const cooldownReductionPerLevelMs = Math.max(
      0,
      Math.round((Number(entry.cooldownReductionPerLevel) || 0) * 1000)
    );
    const beamWidth =
      kind === "beam" || kind === "chain"
        ? Math.max(0.2, Number(entry.beamWidth) || Number(entry.width) || 0.8)
        : 0;
    const jumpCount = Math.max(0, Number(entry.jumpCount) || 0);
    const jumpRange = Math.max(0, Number(entry.jumpRange) || 0);
    const jumpDamageReduction = clamp(Number(entry.jumpDamageReduction) || 0, 0, 0.95);
    const jumpCountPerLevel = Math.max(0, Number(entry.jumpCountPerLevel) || 0);
    const summonCount = Math.max(0, Number(entry.summonCount) || 0);
    const summonFormationRadius = Math.max(0, Number(entry.summonFormationRadius) || 0);
    const summonCountPerLevel = Math.max(0, Number(entry.summonCountPerLevel) || 0);
    const summonCountEveryLevels = Math.max(0, Math.floor(Number(entry.summonCountEveryLevels) || 0));
    const maxSummonCount = Math.max(0, Math.floor(Number(entry.maxSummonCount) || 0));
    const summonKind = String(entry.summonKind || "").trim().toLowerCase();
    const summonProjectile = buildProjectileTemplateFromChildSource(id, {
      abilityId: entry.summonAbilityId,
      overrides: entry.summonAbilityOverrides
    });
    const summonAttackRange = Math.max(0, Number((summonProjectile && summonProjectile.range) || 0));
    const summonAttackIntervalMs = Math.max(0, Number((summonProjectile && summonProjectile.cooldownMs) || 0));
    const stunDurationMs = Math.max(0, Math.round((Number(entry.stunDuration) || 0) * 1000));
    const slowDurationMsRaw = Number(entry.slowDurationMs);
    const slowDurationSecRaw = Number(entry.slowDuration);
    const slowDurationMs =
      Number.isFinite(slowDurationMsRaw) && slowDurationMsRaw > 0
        ? Math.round(slowDurationMsRaw)
        : Number.isFinite(slowDurationSecRaw) && slowDurationSecRaw > 0
          ? Math.round(slowDurationSecRaw * 1000)
          : 0;
    let slowMultiplier = 1;
    if (Number.isFinite(Number(entry.slowMultiplier)) && Number(entry.slowMultiplier) > 0) {
      slowMultiplier = clamp(Number(entry.slowMultiplier), 0.1, 1);
    } else if (Number.isFinite(Number(entry.slowAmount)) && Number(entry.slowAmount) > 0) {
      const slowAmount = Number(entry.slowAmount);
      slowMultiplier = clamp(1 - clamp(slowAmount, 0, 0.95), 0.1, 1);
    }
    const projectileCount = clamp(Math.floor(Number(entry.projectileCount) || 1), 1, 12);
    const spreadDeg = Math.max(0, Number(entry.spreadDeg) || Number(entry.spreadAngle) || 0);
    const homingRangeDefault = id.toLowerCase() === "arcanemissiles" ? Math.max(6, range) : 0;
    const homingTurnRateDefault = id.toLowerCase() === "arcanemissiles" ? 6.5 : 0;
    const homingRange = Math.max(0, Number(entry.homingRange) || homingRangeDefault);
    const homingTurnRate = Math.max(0, Number(entry.homingTurnRate ?? entry.turnRate) || homingTurnRateDefault);
    const emitProjectiles = buildResolvedEmitProjectilesConfig(entry, id);
    const firstDamageEffect = (Array.isArray(entry.effects) ? entry.effects : []).find(
      (effect) => effect && typeof effect === "object" && String(effect.type || "").toLowerCase() === "damage"
    );
    const damageSchool = String(firstDamageEffect?.school || "").trim().toLowerCase();
    const damageMode = String(firstDamageEffect?.mode || "").trim().toLowerCase() || "instant";

    const def = {
      id,
      name: String(entry.name || id).slice(0, 48),
      description: String(entry.description || "").slice(0, 240),
      tags: Array.isArray(entry.tags)
        ? entry.tags.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
        : [],
      damageSchool,
      damageMode,
      kind,
      cooldownMs,
      manaCost: Math.max(0, Number(entry.manaCost) || 0),
      range,
      speed,
      damageMin: clamp(Math.floor(Math.min(damageRange[0], damageRange[1])), 0, 255),
      damageMax: clamp(Math.ceil(Math.max(damageRange[0], damageRange[1])), 0, 255),
      damagePerLevelMin: Math.max(0, Number(damagePerLevel[0]) || 0),
      damagePerLevelMax: Math.max(0, Number(damagePerLevel[1]) || 0),
      dotDamageMin: Math.max(0, Number(dotDamageRange[0]) || 0),
      dotDamageMax: Math.max(0, Number(dotDamageRange[1]) || 0),
      dotDamagePerLevelMin: Math.max(0, Number(dotDamagePerLevel[0]) || 0),
      dotDamagePerLevelMax: Math.max(0, Number(dotDamagePerLevel[1]) || 0),
      dotDurationMs,
      dotSchool,
      coneAngleDeg,
      coneCos,
      projectileHitRadius,
      explosionRadius,
      explosionDamageMultiplier,
      areaRadius,
      durationMs,
      durationPerLevelMs,
      castMs,
      invulnerabilityDurationMs,
      rangePerLevel,
      cooldownReductionPerLevelMs,
      beamWidth,
      jumpCount,
      jumpRange,
      jumpDamageReduction,
      jumpCountPerLevel,
      summonCount,
      summonAttackRange,
      summonFormationRadius,
      summonAttackIntervalMs,
      summonCountPerLevel,
      summonCountEveryLevels,
      maxSummonCount,
      summonKind,
      summonProjectile,
      stunDurationMs,
      slowDurationMs,
      slowMultiplier,
      projectileCount,
      spreadDeg,
      explodeOnExpire: entry.explodeOnExpire !== false,
      homingRange,
      homingTurnRate,
      emitProjectiles
    };

    const extraClientFields = {};
    for (const [fieldKey, fieldValue] of Object.entries(entry)) {
      if (OMITTED_CLIENT_FIELDS.has(fieldKey)) {
        continue;
      }
      if (typeof fieldValue === "number" && Number.isFinite(fieldValue) && fieldValue > 0) {
        extraClientFields[fieldKey] = fieldValue;
      } else if (
        Array.isArray(fieldValue) &&
        fieldValue.length &&
        fieldValue.every((v) => Number.isFinite(Number(v)))
      ) {
        const normalizedArray = fieldValue.map((v) => Number(v));
        if (normalizedArray.some((v) => v > 0)) {
          extraClientFields[fieldKey] = normalizedArray;
        }
      }
    }

    abilityDefs.set(id, def);
    clientAbilityDefs.push({
      id: def.id,
      name: def.name,
      description: def.description,
      tags: def.tags,
      damageSchool: def.damageSchool,
      damageMode: def.damageMode,
      kind: def.kind,
      cooldownMs: def.cooldownMs,
      range: def.range,
      speed: def.speed,
      castMs: def.castMs,
      manaCost: def.manaCost,
      damageMin: def.damageMin,
      damageMax: def.damageMax,
      damagePerLevelMin: def.damagePerLevelMin,
      damagePerLevelMax: def.damagePerLevelMax,
      dotDamageMin: def.dotDamageMin,
      dotDamageMax: def.dotDamageMax,
      dotDamagePerLevelMin: def.dotDamagePerLevelMin,
      dotDamagePerLevelMax: def.dotDamagePerLevelMax,
      dotDurationMs: def.dotDurationMs,
      dotSchool: def.dotSchool,
      coneAngleDeg: def.coneAngleDeg,
      projectileHitRadius: def.projectileHitRadius,
      explosionRadius: def.explosionRadius,
      explosionDamageMultiplier: def.explosionDamageMultiplier,
      areaRadius: def.areaRadius,
      beamWidth: def.beamWidth,
      jumpCount: def.jumpCount,
      jumpRange: def.jumpRange,
      jumpDamageReduction: def.jumpDamageReduction,
      jumpCountPerLevel: def.jumpCountPerLevel,
      summonCount: def.summonCount,
      summonAttackRange: def.summonAttackRange,
      summonFormationRadius: def.summonFormationRadius,
      summonAttackIntervalMs: def.summonAttackIntervalMs,
      summonCountPerLevel: def.summonCountPerLevel,
      summonCountEveryLevels: def.summonCountEveryLevels,
      maxSummonCount: def.maxSummonCount,
      durationMs: def.durationMs,
      durationPerLevelMs: def.durationPerLevelMs,
      stunDurationMs: def.stunDurationMs,
      slowDurationMs: def.slowDurationMs,
      slowMultiplier: def.slowMultiplier,
      projectileCount: def.projectileCount,
      spreadDeg: def.spreadDeg,
      homingRange: def.homingRange,
      homingTurnRate: def.homingTurnRate,
      damageRange: [def.damageMin, def.damageMax],
      damageRangePerLevel: [def.damagePerLevelMin, def.damagePerLevelMax],
      summonKind: def.summonKind,
      ...extraClientFields
    });
  }

  if (!abilityDefs.size) {
    throw new Error(`No valid ability definitions in ${configPath}`);
  }

  return {
    abilityDefs,
    clientAbilityDefs
  };
}

module.exports = {
  loadAbilityConfigFromDisk
};
