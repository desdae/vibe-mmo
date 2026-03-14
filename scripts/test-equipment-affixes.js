const assert = require("assert");
const { createEquipmentTools } = require("../server/gameplay/equipment");
const { createDamageTools } = require("../server/gameplay/damage");
const { createPlayerTickSystem } = require("../server/runtime/player-tick");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function main() {
  const equipmentTools = createEquipmentTools({
    equipmentConfigProvider: () => ({ itemSlots: ["mainHand", "offHand"], baseItemsById: new Map() }),
    clamp,
    mapWidth: 1000,
    mapHeight: 1000,
    getAbilityDamageRange: () => [10, 20],
    getAbilityDotDamageRange: () => [2, 4],
    randomInt: (min, max) => max,
    allocateItemInstanceId: () => "test-instance"
  });

  const player = {
    id: "player-1",
    baseHealth: 100,
    hp: 50,
    maxHp: 100,
    baseMana: 100,
    mana: 50,
    maxMana: 100,
    baseHealthRegen: 0,
    healthRegen: 0,
    baseManaRegen: 1,
    manaRegen: 1,
    baseMoveSpeed: 1,
    moveSpeed: 1,
    equipmentSlots: {
      mainHand: {
        itemId: "test-wand",
        qty: 1,
        instanceId: "eq-1",
        baseStats: {
          armor: 10,
          blockChance: 0.2
        },
        affixes: [
          { name: "Vital", modifiers: [{ stat: "maxHealth.flat", value: 20 }] },
          { name: "Mend", modifiers: [{ stat: "healthRegen.flat", value: 5 }] },
          { name: "Focus", modifiers: [{ stat: "manaRegen.flat", value: 2 }] },
          { name: "Fleet", modifiers: [{ stat: "moveSpeed.percent", value: 10 }] },
          { name: "Reinforced", modifiers: [{ stat: "armor.percent", value: 50 }] },
          { name: "Critical", modifiers: [{ stat: "critChance.percent", value: 100 }] },
          { name: "Critical Power", modifiers: [{ stat: "critDamage.percent", value: 100 }] },
          { name: "Leech", modifiers: [{ stat: "lifeSteal.percent", value: 50 }] },
          { name: "Mana Leech", modifiers: [{ stat: "manaSteal.percent", value: 50 }] },
          { name: "Thorns", modifiers: [{ stat: "thorns.flat", value: 7 }] },
          { name: "Quick Strikes", modifiers: [{ stat: "attackSpeed.percent", value: 25 }] },
          { name: "Quick Casting", modifiers: [{ stat: "castSpeed.percent", value: 50 }] },
          { name: "Execution", modifiers: [{ stat: "lifeOnKill.flat", value: 11 }] },
          { name: "Insight", modifiers: [{ stat: "manaOnKill.flat", value: 13 }] },
          { name: "Ember", modifiers: [{ stat: "damageSchool.fire.percent", value: 20 }] },
          { name: "Siege", modifiers: [{ stat: "spellTag.projectile.damagePercent", value: 10 }] },
          { name: "Power", modifiers: [{ stat: "damage.global.percent", value: 5 }] },
          {
            name: "Kindling",
            modifiers: [
              { stat: "damage.fire.flatMin", value: 3 },
              { stat: "damage.fire.flatMax", value: 5 }
            ]
          }
        ]
      },
      offHand: null
    },
    abilityLastUsedAt: new Map(),
    input: { dx: 0, dy: 0 }
  };

  equipmentTools.recomputePlayerDerivedStats(player);
  assert.equal(player.maxHp, 120);
  assert.equal(player.healthRegen, 5);
  assert.equal(player.manaRegen, 3);
  assert.equal(player.moveSpeed, 1.1);
  assert.equal(player.armor, 15);
  assert.equal(player.blockChance, 0.2);
  assert.equal(player.thorns, 7);
  assert.equal(player.lifeOnKill, 11);
  assert.equal(player.manaOnKill, 13);
  assert.equal(player.attackSpeedMultiplier, 1.25);
  assert.equal(player.castSpeedMultiplier, 1.5);

  const fireball = {
    id: "fireball",
    kind: "projectile",
    damageSchool: "fire",
    tags: ["fire", "projectile"],
    castMs: 1500
  };
  assert.deepEqual(equipmentTools.getPlayerModifiedAbilityDamageRange(player, fireball, 1), [17, 34]);
  assert.equal(
    equipmentTools.getPlayerModifiedAbilityCooldownMs(player, { id: "slash", kind: "meleeCone" }, 1, () => 1000),
    800
  );
  assert.equal(equipmentTools.getPlayerModifiedAbilityCastMs(player, fireball), 1000);

  const players = new Map([[player.id, player]]);
  const damageTools = createDamageTools({
    queueDamageEvent: () => {},
    markMobProvokedByPlayer: () => {},
    killMob: () => {},
    clearPlayerCast: () => {},
    clearPlayerCombatEffects: () => {},
    getPlayerById: (id) => players.get(String(id)) || null,
    clamp
  });

  const mob = { alive: true, hp: 100 };
  player.hp = 40;
  player.mana = 10;
  const dealtToMob = damageTools.applyDamageToMob(mob, 10, player.id);
  assert.equal(dealtToMob, 25);
  assert.equal(player.hp, 53);
  assert.equal(player.mana, 23);

  const attacker = { alive: true, hp: 30 };
  player.hp = 100;
  player.blockChance = 0;
  const dealtToPlayer = damageTools.applyDamageToPlayer(player, 20, Date.now(), { sourceMob: attacker });
  assert.equal(dealtToPlayer, 17);
  assert.equal(attacker.hp, 23);

  const tickSystem = createPlayerTickSystem({
    players,
    mobs: new Map(),
    tickMs: 1000,
    clamp,
    mapWidth: 1000,
    mapHeight: 1000,
    basePlayerSpeed: 1,
    tickPlayerHealEffects: () => {},
    tickPlayerManaEffects: () => {},
    tickPlayerBuffs: () => {},
    tickPlayerDotEffects: () => {},
    clearPlayerCast: () => {},
    playerHasMovementInput: () => false,
    clearPlayerCombatEffects: () => {},
    abilityDefsProvider: () => new Map(),
    getPlayerAbilityLevel: () => 1,
    getAbilityCooldownPassed: () => true,
    executeAbilityByKind: () => false,
    abilityHandlerContext: {},
    normalizeDirection: () => ({ dx: 1, dy: 0 }),
    playerMobMinSeparation: 1,
    playerMobSeparationIterations: 1
  });
  player.hp = 100;
  player.maxHp = 120;
  player.mana = 90;
  tickSystem.tickPlayers();
  assert.equal(player.hp, 105);
  assert.equal(player.mana, 93);

  console.log("equipment affix regression checks passed");
}

main();
