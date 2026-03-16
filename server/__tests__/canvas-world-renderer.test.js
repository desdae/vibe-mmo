const path = require("path");

function createRendererDeps(overrides = {}) {
  const noop = () => {};
  return {
    ctx: {
      clearRect: noop,
      fillStyle: "",
      fillRect: noop
    },
    canvas: {
      width: 640,
      height: 480
    },
    updateActionBarUI: noop,
    drawGrid: noop,
    drawAbilityCastPreview: noop,
    drawProjectile: noop,
    drawExplosionEffects: noop,
    drawAreaEffects: noop,
    drawVendorNpc: noop,
    drawQuestNpcs: noop,
    drawResourceNode: noop,
    drawLootBag: noop,
    drawMob: noop,
    drawSkeletonSwordSwing: noop,
    drawSkeletonArcherBowShot: noop,
    drawCreeperIgnitionAnimation: noop,
    drawOrcDualAxeSwing: noop,
    drawMobBiteAnimation: noop,
    drawMobCastBar: noop,
    drawMobSlowTint: noop,
    drawMobBurnEffect: noop,
    drawMobStunEffect: noop,
    drawFloatingDamageNumbers: noop,
    pruneSkeletonWalkRuntime: noop,
    pruneCreeperWalkRuntime: noop,
    pruneZombieWalkRuntime: noop,
    pruneSpiderWalkRuntime: noop,
    pruneOrcWalkRuntime: noop,
    pruneSkeletonArcherWalkRuntime: noop,
    pruneWarriorAnimRuntime: noop,
    pruneProjectileVisualRuntime: noop,
    pruneAmbientParticleEmitters: noop,
    drawPlayer: noop,
    drawPlayerEffectAnimations: noop,
    drawPlayerCastBar: noop,
    drawMobTooltip: noop,
    drawLootBagTooltip: noop,
    drawResourceTooltip: noop,
    drawVendorTooltip: noop,
    drawQuestNpcTooltip: noop,
    updateMobCastSpatialAudio: noop,
    updateProjectileSpatialAudio: noop,
    ...overrides
  };
}

function createFrame(frameNow, mob, projectile) {
  return {
    frameNow,
    cameraX: 10,
    cameraY: 12,
    self: { id: "self", x: 10, y: 12 },
    selfView: { player: { id: "self", x: 10, y: 12 } },
    playerViews: [],
    mobViews: [{ mob, attackVisual: "none", isHumanoid: false, attackState: null }],
    projectileViews: [{ projectile }],
    lootBagViews: [],
    resourceNodeViews: [],
    areaEffects: [],
    hoveredMob: null,
    hoveredBag: null,
    hoveredResourceNode: null,
    hoveredVendor: null,
    hoveredQuestNpc: null
  };
}

describe("VibeClientCanvasWorldRenderer", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/canvas-world-renderer.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientCanvasWorldRenderer;
  });

  afterEach(() => {
    delete globalThis.VibeClientCanvasWorldRenderer;
  });

  test("throttles spatial audio updates and reuses scratch arrays", () => {
    require(modulePath);

    const updateMobCastSpatialAudio = jest.fn();
    const updateProjectileSpatialAudio = jest.fn();
    const renderer = globalThis.VibeClientCanvasWorldRenderer.createCanvasWorldRenderer(
      createRendererDeps({
        spatialAudioIntervalMs: 50,
        maintenanceIntervalMs: 1000,
        updateMobCastSpatialAudio,
        updateProjectileSpatialAudio
      })
    );

    const firstMob = { id: "mob-1" };
    const secondMob = { id: "mob-2" };
    const firstProjectile = { id: "projectile-1" };
    const secondProjectile = { id: "projectile-2" };

    renderer.renderWorldFrame(createFrame(100, firstMob, firstProjectile));
    renderer.renderWorldFrame(createFrame(130, firstMob, firstProjectile));
    renderer.renderWorldFrame(createFrame(170, secondMob, secondProjectile));

    expect(updateMobCastSpatialAudio).toHaveBeenCalledTimes(2);
    expect(updateProjectileSpatialAudio).toHaveBeenCalledTimes(2);
    expect(updateMobCastSpatialAudio.mock.calls[1][0]).toBe(updateMobCastSpatialAudio.mock.calls[0][0]);
    expect(updateProjectileSpatialAudio.mock.calls[1][0]).toBe(updateProjectileSpatialAudio.mock.calls[0][0]);
    expect(updateMobCastSpatialAudio.mock.calls[1][0][0]).toBe(secondMob);
    expect(updateProjectileSpatialAudio.mock.calls[1][0][0]).toBe(secondProjectile);
  });

  test("throttles maintenance sweeps", () => {
    require(modulePath);

    const pruneSkeletonWalkRuntime = jest.fn();
    const pruneProjectileVisualRuntime = jest.fn();
    const pruneAmbientParticleEmitters = jest.fn();
    const renderer = globalThis.VibeClientCanvasWorldRenderer.createCanvasWorldRenderer(
      createRendererDeps({
        spatialAudioIntervalMs: 1000,
        maintenanceIntervalMs: 90,
        pruneSkeletonWalkRuntime,
        pruneProjectileVisualRuntime,
        pruneAmbientParticleEmitters
      })
    );

    renderer.renderWorldFrame(createFrame(100, { id: "mob-1" }, { id: "projectile-1" }));
    renderer.renderWorldFrame(createFrame(150, { id: "mob-1" }, { id: "projectile-1" }));
    renderer.renderWorldFrame(createFrame(210, { id: "mob-1" }, { id: "projectile-1" }));

    expect(pruneSkeletonWalkRuntime).toHaveBeenCalledTimes(2);
    expect(pruneProjectileVisualRuntime).toHaveBeenCalledTimes(2);
    expect(pruneAmbientParticleEmitters).toHaveBeenCalledTimes(2);
  });
});
