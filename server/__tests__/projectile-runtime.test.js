const { createProjectileRuntimeTools } = require("../gameplay/projectile-runtime");

class GuardedMap extends Map {
  values() {
    throw new Error("Map.values() should not be used when projectile radius helpers are available");
  }
}

describe("projectile-runtime spatial target queries", () => {
  test("uses radius helpers for homing player target selection", () => {
    const owner = { id: "player-1", team: "blue", hp: 100, x: 0, y: 0 };
    const ally = { id: "player-2", team: "blue", hp: 100, x: 2, y: 0 };
    const enemyFar = { id: "player-3", team: "red", hp: 100, x: 6, y: 0 };
    const enemyNear = { id: "player-4", team: "red", hp: 100, x: 3, y: 0 };
    const getPlayersInRadius = jest.fn(() => [owner, ally, enemyFar, enemyNear]);
    const tools = createProjectileRuntimeTools({
      clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
      players: new GuardedMap([[owner.id, owner]]),
      mobs: new GuardedMap(),
      getPlayersInRadius,
      getMobsInRadius: jest.fn(() => []),
      normalizeProjectileTargetType: (targetType, fallback = "mob") =>
        String(targetType || fallback).trim().toLowerCase() === "player" ? "player" : "mob"
    });

    const target = tools.getNearestProjectileTarget(
      {
        ownerId: owner.id,
        targetType: "player",
        x: 0,
        y: 0
      },
      8
    );

    expect(getPlayersInRadius).toHaveBeenCalledWith(0, 0, 8);
    expect(target).toBe(enemyNear);
  });
});
