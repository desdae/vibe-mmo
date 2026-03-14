const { getSummonCountForLevel } = require("../../public/shared/summon-layout");

function executeSummonAbility({ player, abilityDef, abilityLevel, targetDx, targetDy, targetDistance, now, ctx }) {
  const castRange = Math.max(
    0,
    (typeof ctx.getAbilityRangeForEntity === "function"
      ? ctx.getAbilityRangeForEntity(player, abilityDef, abilityLevel)
      : ctx.getAbilityRangeForLevel(abilityDef, abilityLevel)) || 0
  );
  const target = ctx.getAreaAbilityTargetPosition(player, castRange, targetDx, targetDy, targetDistance);
  const levelOffset = Math.max(0, Math.floor(Number(abilityLevel) || 1) - 1);
  const durationMs = Math.max(
    1000,
    Math.round((Number(abilityDef.durationMs) || 0) + (Number(abilityDef.durationPerLevelMs) || 0) * levelOffset)
  );
  const summonCount = getSummonCountForLevel(
    Number(abilityDef.summonCount) || 1,
    Number(abilityDef.summonCountPerLevel) || 0,
    abilityLevel,
    {
      everyLevels: Number(abilityDef.summonCountEveryLevels) || 0,
      maxCount: Number(abilityDef.maxSummonCount) || 0
    }
  );

  if (durationMs <= 0 || summonCount <= 0 || !ctx.createPersistentSummonEffect) {
    return false;
  }

  ctx.markAbilityUsed(player, abilityDef, now);
  player.lastDirection = target.targetDir;
  ctx.createPersistentSummonEffect(
    player.id,
    abilityDef,
    target.x,
    target.y,
    summonCount,
    durationMs,
    {
      formationRadius: Math.max(0, Number(abilityDef.summonFormationRadius) || 0),
      attackRange: Math.max(0.5, Number(abilityDef.summonAttackRange) || castRange || 6),
      attackIntervalMs: Math.max(120, Number(abilityDef.summonAttackIntervalMs) || 1000),
      projectileTemplate:
        abilityDef.summonProjectile && typeof abilityDef.summonProjectile === "object"
          ? abilityDef.summonProjectile
          : null,
      abilityLevel,
      initialDelayMs: Math.min(durationMs, Math.max(250, Number(abilityDef.castMs) || 450))
    },
    now
  );
  return true;
}

module.exports = executeSummonAbility;
