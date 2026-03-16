const { createProjectileTickSystem } = require("../runtime/projectile-tick");

class GuardedMap extends Map {
  values() {
    throw new Error("Map.values() should not be used when projectile radius helpers are available");
  }
}

function createBaseDeps(overrides = {}) {
  return {
    tickMs: 50,
    mapWidth: 100,
    mapHeight: 100,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    distance: (a, b) => Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)),
    defaultProjectileHitRadius: 0.75,
    randomInt: jest.fn((min) => min),
    queueProjectileHitEvent: jest.fn(),
    queueExplosionEvent: jest.fn(),
    applyDamageToPlayer: jest.fn(() => 0),
    applyDamageToMob: jest.fn(() => 9),
    applyProjectileHitEffectsToPlayer: jest.fn(),
    applyProjectileHitEffects: jest.fn(),
    emitProjectilesFromEmitter: jest.fn(),
    getNearestProjectileTarget: jest.fn(() => null),
    getPlayersInRadius: jest.fn(() => []),
    getMobsInRadius: jest.fn(() => []),
    normalizeDirection: jest.fn((dx, dy) => {
      const length = Math.hypot(dx, dy);
      if (!length) {
        return null;
      }
      return { dx: dx / length, dy: dy / length };
    }),
    steerDirectionTowards: jest.fn((projectile, desiredDir) => ({
      dx: desiredDir.dx,
      dy: desiredDir.dy
    })),
    isProjectileBlockedAt: jest.fn(() => false),
    ...overrides
  };
}

describe("projectile-tick spatial queries", () => {
  test("uses radius helpers for direct-hit mob detection", () => {
    const targetMob = { id: "mob-1", alive: true, x: 5.2, y: 5.1 };
    const projectiles = new Map([
      [
        "proj-1",
        {
          id: "proj-1",
          x: 5,
          y: 5,
          dx: 0,
          dy: 0,
          speed: 0,
          createdAt: Date.now(),
          ttlMs: 1000,
          damageMin: 9,
          damageMax: 9,
          abilityId: "fireball",
          ownerId: "player-1",
          targetType: "mob"
        }
      ]
    ]);
    const deps = createBaseDeps({
      projectiles,
      players: new GuardedMap(),
      mobs: new GuardedMap(),
      getMobsInRadius: jest.fn(() => [targetMob])
    });
    const system = createProjectileTickSystem({
      projectiles,
      players: deps.players,
      mobs: deps.mobs,
      ...deps
    });

    system.tickProjectiles();

    expect(deps.getMobsInRadius).toHaveBeenCalledWith(5, 5, 0.75);
    expect(deps.applyDamageToMob).toHaveBeenCalledWith(targetMob, 9, "player-1");
    expect(projectiles.size).toBe(0);
  });

  test("uses radius helpers for mob splash damage on projectile expiry", () => {
    const splashMob = { id: "mob-2", alive: true, x: 8, y: 8 };
    const projectiles = new Map([
      [
        "proj-2",
        {
          id: "proj-2",
          x: 8,
          y: 8,
          dx: 0,
          dy: 0,
          speed: 0,
          createdAt: Date.now() - 2000,
          ttlMs: 100,
          damageMin: 7,
          damageMax: 7,
          explosionRadius: 2,
          explosionDamageMultiplier: 0.5,
          explodeOnExpire: true,
          abilityId: "bomb",
          ownerId: "player-1",
          targetType: "mob"
        }
      ]
    ]);
    const deps = createBaseDeps({
      projectiles,
      players: new GuardedMap(),
      mobs: new GuardedMap(),
      getMobsInRadius: jest.fn(() => [splashMob])
    });
    const system = createProjectileTickSystem({
      projectiles,
      players: deps.players,
      mobs: deps.mobs,
      ...deps
    });

    system.tickProjectiles();

    expect(deps.getMobsInRadius).toHaveBeenCalledWith(8, 8, 0.75);
    expect(deps.getMobsInRadius).toHaveBeenCalledWith(8, 8, 2);
    expect(deps.queueExplosionEvent).toHaveBeenCalledWith(8, 8, 2, "bomb");
    expect(deps.applyDamageToMob).toHaveBeenCalledWith(splashMob, 7, "player-1");
    expect(projectiles.size).toBe(0);
  });
});
