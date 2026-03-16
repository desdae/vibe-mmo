const { createPlayerTickSystem } = require("../runtime/player-tick");

function createBaseDeps(overrides = {}) {
  return {
    tickMs: 50,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    mapWidth: 100,
    mapHeight: 100,
    basePlayerSpeed: 4,
    tickPlayerHealEffects: jest.fn(),
    tickPlayerManaEffects: jest.fn(),
    tickPlayerBuffs: jest.fn(),
    tickPlayerDotEffects: jest.fn(),
    tickTalentBuffs: jest.fn(),
    clearPlayerCast: jest.fn((player) => {
      player.activeCast = null;
    }),
    playerHasMovementInput: jest.fn(() => false),
    clearPlayerBuffs: jest.fn(),
    clearPlayerCombatEffects: jest.fn(),
    abilityDefsProvider: jest.fn(() => new Map()),
    getPlayerAbilityLevel: jest.fn(() => 1),
    getAbilityCooldownPassed: jest.fn(() => true),
    executeAbilityByKind: jest.fn(() => false),
    notifyAbilityUsed: jest.fn(),
    abilityHandlerContext: {
      queueExplosionEvent: jest.fn(),
      applyDamageToMob: jest.fn(),
      applyAbilityHitEffectsToMob: jest.fn(),
      stunMob: jest.fn(),
      isPlayerEnemy: jest.fn(() => true),
      applyDamageToPlayer: jest.fn(() => 18),
      stunPlayer: jest.fn(),
      randomInt: jest.fn(() => 18)
    },
    normalizeDirection: jest.fn(() => ({ dx: 1, dy: 0 })),
    isBlockedPoint: jest.fn(() => false),
    playerMobMinSeparation: 0.5,
    playerMobSeparationIterations: 1,
    ...overrides
  };
}

describe("player charge impact", () => {
  test("hits enemy players even when they do not expose an alive flag", () => {
    const players = new Map();
    const mobs = new Map();
    const now = Date.now();
    const charger = {
      id: "player-1",
      hp: 100,
      maxHp: 100,
      mana: 10,
      maxMana: 10,
      manaRegen: 0,
      healthRegen: 0,
      input: { dx: 0, dy: 0 },
      x: 10,
      y: 10,
      activeHeals: [],
      activeManaRestores: [],
      activeCast: {
        abilityId: "charge",
        isCharge: true,
        startedAt: now - 500,
        endsAt: now - 1,
        durationMs: 400,
        chargeTargetX: 12,
        chargeTargetY: 10
      },
      chargeData: {
        hasImpacted: false,
        impactRadius: 2.5,
        damageMin: 12,
        damageMax: 24,
        stunDurationMs: 750,
        abilityDef: { id: "charge" },
        abilityLevel: 1
      }
    };
    const target = {
      id: "player-2",
      hp: 75,
      maxHp: 75,
      mana: 10,
      maxMana: 10,
      manaRegen: 0,
      healthRegen: 0,
      input: { dx: 0, dy: 0 },
      x: 13,
      y: 10,
      activeHeals: [],
      activeManaRestores: []
    };
    players.set(charger.id, charger);
    players.set(target.id, target);

    const deps = createBaseDeps({ players, mobs });
    const system = createPlayerTickSystem({
      players,
      mobs,
      ...deps
    });

    system.tickPlayers();

    expect(deps.abilityHandlerContext.applyDamageToPlayer).toHaveBeenCalledTimes(1);
    expect(deps.abilityHandlerContext.applyDamageToPlayer).toHaveBeenCalledWith(
      target,
      18,
      charger.id,
      "physical"
    );
    expect(deps.abilityHandlerContext.stunPlayer).toHaveBeenCalledWith(target, 750, expect.any(Number));
    expect(deps.clearPlayerCast).toHaveBeenCalledWith(charger);
    expect(charger.chargeData).toBeNull();
  });
});
