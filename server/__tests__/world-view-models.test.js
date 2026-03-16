const path = require("path");

describe("VibeClientWorldViewModels", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/world-view-models.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientWorldViewModels;
  });

  afterEach(() => {
    delete globalThis.VibeClientWorldViewModels;
  });

  test("reuses entity wrapper objects across frames", () => {
    require(modulePath);

    const tools = globalThis.VibeClientWorldViewModels.createWorldViewModelTools({
      gameState: { self: { id: "self-live" } },
      getActiveMobAttackState: (id) => ({ id, active: true }),
      getMobAttackVisualType: () => "sword",
      isHumanoidMob: () => true,
      getMobCastVisualState: (mob, now) => ({ id: mob.id, now }),
      getMobStatusVisualState: (mob, now) => ({ id: mob.id, now }),
      getPlayerAttackState: (player, isSelf, now) => ({ id: player.id, isSelf, now }),
      getPlayerCastVisualState: (player, isSelf, now) => ({ id: player.id, isSelf, now }),
      getPlayerStatusVisualState: (player, isSelf, now) => ({ id: player.id, isSelf, now }),
      getActionDefById: (abilityId) => ({ id: abilityId }),
      getAbilityVisualHook: (abilityId) => abilityId,
      getProjectileSpriteFrame: (projectile, now) => ({ key: projectile.id, now }),
      getAreaEffects: () => [],
      getExplosionViews: () => [],
      getTownVendor: () => null,
      getTownQuestGivers: () => [],
      getFloatingDamageViews: () => []
    });

    const firstState = {
      self: { id: "self", x: 10, y: 20 },
      mobs: [{ id: "mob-1", x: 1, y: 2 }],
      players: [{ id: "player-1", x: 3, y: 4 }],
      projectiles: [{ id: "projectile-1", x: 5, y: 6, abilityId: "fireball" }],
      lootBags: [{ id: "loot-1", x: 7, y: 8 }],
      resourceNodes: [{ id: "resource-1", x: 9, y: 10 }]
    };
    const firstFrame = tools.buildWorldFrameViewModel(firstState, 100);
    const firstMobView = firstFrame.mobViews[0];
    const firstPlayerView = firstFrame.playerViews[0];
    const firstProjectileView = firstFrame.projectileViews[0];
    const firstLootBagView = firstFrame.lootBagViews[0];
    const firstResourceNodeView = firstFrame.resourceNodeViews[0];
    const firstSelfView = firstFrame.selfView;

    const secondState = {
      self: { id: "self", x: 11, y: 21 },
      mobs: [{ id: "mob-1", x: 2, y: 3 }],
      players: [{ id: "player-1", x: 4, y: 5 }],
      projectiles: [{ id: "projectile-1", x: 6, y: 7, abilityId: "fireball" }],
      lootBags: [{ id: "loot-1", x: 8, y: 9 }],
      resourceNodes: [{ id: "resource-1", x: 10, y: 11 }]
    };
    const secondFrame = tools.buildWorldFrameViewModel(secondState, 200);

    expect(secondFrame.mobViews[0]).toBe(firstMobView);
    expect(secondFrame.mobViews[0].mob).toBe(secondState.mobs[0]);
    expect(secondFrame.playerViews[0]).toBe(firstPlayerView);
    expect(secondFrame.playerViews[0].player).toBe(secondState.players[0]);
    expect(secondFrame.projectileViews[0]).toBe(firstProjectileView);
    expect(secondFrame.projectileViews[0].projectile).toBe(secondState.projectiles[0]);
    expect(secondFrame.lootBagViews[0]).toBe(firstLootBagView);
    expect(secondFrame.lootBagViews[0].bag).toBe(secondState.lootBags[0]);
    expect(secondFrame.resourceNodeViews[0]).toBe(firstResourceNodeView);
    expect(secondFrame.resourceNodeViews[0].node).toBe(secondState.resourceNodes[0]);
    expect(secondFrame.selfView).toBe(firstSelfView);
    expect(secondFrame.selfView.player).toBe(secondState.self);
  });
});
