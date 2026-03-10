const fs = require("fs");
const { clamp, parseNumericRange } = require("../gameplay/number-utils");

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
  "homingRange",
  "homingTurnRate",
  "turnRate"
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

  const abilityDefs = new Map();
  const clientAbilityDefs = [];

  for (const [rawId, rawEntry] of entries) {
    const entry = normalizeAbilityEntry(rawId, rawEntry);
    const id = String(entry?.id || rawId || "").trim();
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
    const beamWidth = kind === "beam" ? Math.max(0.2, Number(entry.beamWidth) || Number(entry.width) || 0.8) : 0;
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
    const emitProjectiles = buildEmitProjectilesConfig(entry, id);

    const def = {
      id,
      name: String(entry.name || id).slice(0, 48),
      description: String(entry.description || "").slice(0, 240),
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
      castMs,
      invulnerabilityDurationMs,
      rangePerLevel,
      cooldownReductionPerLevelMs,
      beamWidth,
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
      durationMs: def.durationMs,
      stunDurationMs: def.stunDurationMs,
      slowDurationMs: def.slowDurationMs,
      slowMultiplier: def.slowMultiplier,
      projectileCount: def.projectileCount,
      spreadDeg: def.spreadDeg,
      homingRange: def.homingRange,
      homingTurnRate: def.homingTurnRate,
      damageRange: [def.damageMin, def.damageMax],
      damageRangePerLevel: [def.damagePerLevelMin, def.damagePerLevelMax],
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
