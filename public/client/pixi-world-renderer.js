(function initVibeClientPixiWorldRenderer(globalScope) {
  "use strict";

  function createPixiWorldRenderer(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const PIXI = deps.PIXI || globalScope.PIXI;
    const canvasElement = deps.canvasElement;
    const windowObject = deps.windowObject || globalScope;
    const tileSize = Math.max(8, Number(deps.tileSize) || 32);
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const lerp = (a, b, t) => a + (b - a) * t;
    const hashString =
      typeof deps.hashString === "function"
        ? deps.hashString
        : (value) => {
            const text = String(value || "");
            let hash = 0;
            for (let i = 0; i < text.length; i += 1) {
              hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
            }
            return hash;
          };
    const seededUnit =
      typeof deps.seededUnit === "function"
        ? deps.seededUnit
        : (seed, n) => {
            const x = Math.sin(((Number(seed) || 0) + n * 374761393) * 0.000001) * 43758.5453;
            return x - Math.floor(x);
          };
    const normalizeDirection =
      typeof deps.normalizeDirection === "function"
        ? deps.normalizeDirection
        : (dx, dy) => {
            const len = Math.hypot(Number(dx) || 0, Number(dy) || 0);
            if (len <= 1e-6) {
              return null;
            }
            return {
              dx: (Number(dx) || 0) / len,
              dy: (Number(dy) || 0) / len
            };
          };
    const getActionDefById = typeof deps.getActionDefById === "function" ? deps.getActionDefById : () => null;
    const findAbilityDefById = typeof deps.findAbilityDefById === "function" ? deps.findAbilityDefById : () => null;
    const getAbilityEffectiveRangeForSelf =
      typeof deps.getAbilityEffectiveRangeForSelf === "function" ? deps.getAbilityEffectiveRangeForSelf : () => 0;
    const getAbilityPreviewState =
      typeof deps.getAbilityPreviewState === "function" ? deps.getAbilityPreviewState : () => null;
    const getAbilityVisualHook =
      typeof deps.getAbilityVisualHook === "function" ? deps.getAbilityVisualHook : () => "";
    const getLootBagSprite = typeof deps.getLootBagSprite === "function" ? deps.getLootBagSprite : null;
    const getProjectileSpriteFrame = typeof deps.getProjectileSpriteFrame === "function" ? deps.getProjectileSpriteFrame : null;
    const getTownTileSprite = typeof deps.getTownTileSprite === "function" ? deps.getTownTileSprite : null;
    const getVendorNpcSprite = typeof deps.getVendorNpcSprite === "function" ? deps.getVendorNpcSprite : null;
    const getQuestNpcSprite = typeof deps.getQuestNpcSprite === "function" ? deps.getQuestNpcSprite : null;
    const getCreeperWalkSprite = typeof deps.getCreeperWalkSprite === "function" ? deps.getCreeperWalkSprite : null;
    const getSpiderWalkSprite = typeof deps.getSpiderWalkSprite === "function" ? deps.getSpiderWalkSprite : null;
    const mobSpriteSize = Math.max(20, Number(deps.mobSpriteSize) || 36);
    const sanitizeCssColor =
      typeof deps.sanitizeCssColor === "function"
        ? deps.sanitizeCssColor
        : (value) => (/^#[0-9a-fA-F]{3,8}$/.test(String(value || "").trim()) ? String(value).trim() : "");
    const sharedHumanoidModule = globalScope.VibeClientRenderHumanoids || null;
    const createHumanoidRenderTools =
      sharedHumanoidModule && typeof sharedHumanoidModule.createHumanoidRenderTools === "function"
        ? sharedHumanoidModule.createHumanoidRenderTools
        : null;
    const sharedPixiParticleModule = globalScope.VibeClientPixiParticleSystem || null;
    const createPixiParticleSystem =
      sharedPixiParticleModule && typeof sharedPixiParticleModule.createPixiParticleSystem === "function"
        ? sharedPixiParticleModule.createPixiParticleSystem
        : null;
    if (!PIXI || !canvasElement) {
      return null;
    }

    let app = null;
    let view = null;
    let stage = null;
    let root = null;
    let backgroundLayer = null;
    let areaUnderlayLayer = null;
    let areaUnderlaySpriteLayer = null;
    let areaUnderlayFallbackLayer = null;
    let lootSpriteLayer = null;
    let lootFallbackLayer = null;
    let explosionLayer = null;
    let particleLayer = null;
    let mobLayer = null;
    let playerLayer = null;
    let projectileSpriteLayer = null;
    let projectileFallbackLayer = null;
    let vendorLayer = null;
    let areaOverlayLayer = null;
    let areaOverlaySpriteLayer = null;
    let abilityPreviewLayer = null;
    let floatingDamageLayer = null;
    let tooltipLayer = null;
    let backgroundGraphics = null;
    let gridSprite = null;
    let townSprite = null;
    let areaUnderlayGraphics = null;
    let areaOverlayGraphics = null;
    let abilityPreviewGraphics = null;
    let tooltipGraphics = null;
    let tooltipText = null;
    let playerNodes = new Map();
    let mobNodes = new Map();
    let projectileNodes = new Map();
    let lootNodes = new Map();
    let lootFallbackNodes = new Map();
    let explosionNodes = new Map();
    let areaUnderlayNodes = new Map();
    let areaOverlayNodes = new Map();
    let projectileFallbackNodes = new Map();
    let vendorNode = null;
    let questNpcLayer = null;
    let questNpcNodes = new Map();
    let pixiParticleSystem = null;
    const floatingDamageTextPool = [];
    const activeFloatingDamageTexts = [];
    const canvasTextureCache = new WeakMap();
    const humanoidRuntimeByKey = new Map();
    const areaEffectCanvasCache = new Map();
    const dynamicAreaEffectRuntime = new Map();
    const backgroundTextureCache = new Map();
    const genericCanvasCache = new Map();
    let staticSpriteCachesWarmed = false;
    let lastDebugStats = {
      mode: "pixi",
      players: 0,
      mobs: 0,
      projectiles: 0,
      lootBags: 0,
      areaEffects: 0,
      activeSpriteNodes: 0,
      pooledSprites: 0,
      particleEmitters: 0,
      particleSprites: 0,
      questNpcCount: 0,
      questNpcSamples: [],
      projectileSamples: []
    };
    const spritePools = {
      loot: [],
      explosion: [],
      projectile: [],
      areaUnderlay: [],
      areaOverlay: []
    };

    const classColors = Object.freeze({
      warrior: 0xcbd5e1,
      mage: 0x6ab6ff,
      ranger: 0x74d68e
    });
    const projectileColors = Object.freeze({
      fire: 0xff8a4d,
      frost: 0x8edcff,
      arcane: 0xb98cff,
      lightning: 0xffea77,
      poison: 0x83d860,
      arrow: 0xd6ddea,
      grenade: 0xc7924b
    });
    const projectileParticleConfigs = Object.freeze({
      fire: Object.freeze({
        maxParticles: 14,
        spawnRate: 16,
        burstCount: 2,
        idleTimeoutMs: 260,
        spawnBox: Object.freeze({ minX: -0.05, maxX: 0.05, minY: -0.05, maxY: 0.05 }),
        velocity: Object.freeze({ minX: -0.014, maxX: 0.014, minY: -0.035, maxY: -0.01 }),
        acceleration: Object.freeze({ minX: 0, maxX: 0, minY: 0.015, maxY: 0.04 }),
        lifeMs: Object.freeze([220, 420]),
        sizePx: Object.freeze([1.8, 3.4]),
        alpha: Object.freeze([0.42, 0.9]),
        twinkle: Object.freeze([0.7, 1.2]),
        rotation: Object.freeze([0, Math.PI * 2]),
        spin: Object.freeze([-1.4, 1.4]),
        phase: Object.freeze([0, Math.PI * 2]),
        shapes: Object.freeze(["sparkle", "dot", "dot"]),
        colors: Object.freeze(["#fff3c2", "#ffb66b", "#ff7b4d"]),
        glowColors: Object.freeze(["rgba(255, 192, 125, 0.45)", "rgba(255, 120, 76, 0.38)"])
      }),
      frost: Object.freeze({
        maxParticles: 10,
        spawnRate: 12,
        burstCount: 2,
        idleTimeoutMs: 260,
        spawnBox: Object.freeze({ minX: -0.04, maxX: 0.04, minY: -0.04, maxY: 0.04 }),
        velocity: Object.freeze({ minX: -0.012, maxX: 0.012, minY: -0.025, maxY: -0.008 }),
        acceleration: Object.freeze({ minX: 0, maxX: 0, minY: 0.01, maxY: 0.03 }),
        lifeMs: Object.freeze([240, 420]),
        sizePx: Object.freeze([1.6, 2.8]),
        alpha: Object.freeze([0.35, 0.82]),
        twinkle: Object.freeze([0.5, 0.9]),
        rotation: Object.freeze([0, Math.PI * 2]),
        spin: Object.freeze([-0.9, 0.9]),
        phase: Object.freeze([0, Math.PI * 2]),
        shapes: Object.freeze(["dot", "dot", "sparkle"]),
        colors: Object.freeze(["#eefcff", "#b7ecff", "#87d6ff"]),
        glowColors: Object.freeze(["rgba(173, 232, 255, 0.36)"])
      }),
      arcane: Object.freeze({
        maxParticles: 12,
        spawnRate: 14,
        burstCount: 2,
        idleTimeoutMs: 260,
        spawnBox: Object.freeze({ minX: -0.04, maxX: 0.04, minY: -0.04, maxY: 0.04 }),
        velocity: Object.freeze({ minX: -0.014, maxX: 0.014, minY: -0.03, maxY: -0.008 }),
        acceleration: Object.freeze({ minX: 0, maxX: 0, minY: 0.012, maxY: 0.03 }),
        lifeMs: Object.freeze([220, 400]),
        sizePx: Object.freeze([1.6, 3.0]),
        alpha: Object.freeze([0.38, 0.86]),
        twinkle: Object.freeze([0.65, 1.1]),
        rotation: Object.freeze([0, Math.PI * 2]),
        spin: Object.freeze([-1.1, 1.1]),
        phase: Object.freeze([0, Math.PI * 2]),
        shapes: Object.freeze(["sparkle", "dot", "dot"]),
        colors: Object.freeze(["#f3e8ff", "#d2b2ff", "#9e76ff"]),
        glowColors: Object.freeze(["rgba(188, 143, 255, 0.34)"])
      }),
      lightning: Object.freeze({
        maxParticles: 12,
        spawnRate: 18,
        burstCount: 3,
        idleTimeoutMs: 220,
        spawnBox: Object.freeze({ minX: -0.05, maxX: 0.05, minY: -0.05, maxY: 0.05 }),
        velocity: Object.freeze({ minX: -0.02, maxX: 0.02, minY: -0.03, maxY: -0.008 }),
        acceleration: Object.freeze({ minX: 0, maxX: 0, minY: 0.01, maxY: 0.025 }),
        lifeMs: Object.freeze([160, 280]),
        sizePx: Object.freeze([1.4, 2.8]),
        alpha: Object.freeze([0.42, 0.96]),
        twinkle: Object.freeze([0.8, 1.35]),
        rotation: Object.freeze([0, Math.PI * 2]),
        spin: Object.freeze([-1.5, 1.5]),
        phase: Object.freeze([0, Math.PI * 2]),
        shapes: Object.freeze(["sparkle", "sparkle", "dot"]),
        colors: Object.freeze(["#fff9c4", "#ffe76d", "#ffd54a"]),
        glowColors: Object.freeze(["rgba(255, 234, 122, 0.36)"])
      }),
      poison: Object.freeze({
        maxParticles: 10,
        spawnRate: 12,
        burstCount: 2,
        idleTimeoutMs: 260,
        spawnBox: Object.freeze({ minX: -0.04, maxX: 0.04, minY: -0.04, maxY: 0.04 }),
        velocity: Object.freeze({ minX: -0.01, maxX: 0.01, minY: -0.024, maxY: -0.008 }),
        acceleration: Object.freeze({ minX: 0, maxX: 0, minY: 0.012, maxY: 0.03 }),
        lifeMs: Object.freeze([240, 440]),
        sizePx: Object.freeze([1.6, 2.9]),
        alpha: Object.freeze([0.34, 0.82]),
        twinkle: Object.freeze([0.45, 0.8]),
        rotation: Object.freeze([0, Math.PI * 2]),
        spin: Object.freeze([-1.1, 1.1]),
        phase: Object.freeze([0, Math.PI * 2]),
        shapes: Object.freeze(["dot", "dot", "sparkle"]),
        colors: Object.freeze(["#d5ffc4", "#8fe36c", "#68b84e"]),
        glowColors: Object.freeze(["rgba(137, 217, 109, 0.3)"])
      })
    });

    function createMixedTextureSpriteLayer() {
      // Spell and loot visuals are built from many standalone canvases; a normal container
      // preserves per-sprite textures, while ParticleContainer can cross-wire them.
      return new PIXI.Container();
    }

    function worldToScreen(worldX, worldY, cameraX, cameraY, width, height) {
      return {
        x: (Number(worldX) - Number(cameraX)) * tileSize + width / 2,
        y: (Number(worldY) - Number(cameraY)) * tileSize + height / 2
      };
    }

    function getMobKind(mob) {
      const lower = `${String(mob && mob.name || "")} ${String(mob && mob.classType || "")}`.toLowerCase();
      if (lower.includes("skeleton") && lower.includes("archer")) {
        return "skeleton_archer";
      }
      if (lower.includes("skeleton")) {
        return "skeleton";
      }
      if (lower.includes("zombie")) {
        return "zombie";
      }
      if (lower.includes("spider")) {
        return "spider";
      }
      if (lower.includes("creeper")) {
        return "creeper";
      }
      if (lower.includes("orc")) {
        return "orc";
      }
      return "mob";
    }

    function getProjectileColor(projectile) {
      const text = `${String(projectile && projectile.abilityId || "")} ${String(projectile && projectile.name || "")}`.toLowerCase();
      if (text.includes("fire")) {
        return projectileColors.fire;
      }
      if (text.includes("frost") || text.includes("ice")) {
        return projectileColors.frost;
      }
      if (text.includes("arcane")) {
        return projectileColors.arcane;
      }
      if (text.includes("lightning")) {
        return projectileColors.lightning;
      }
      if (text.includes("poison")) {
        return projectileColors.poison;
      }
      if (text.includes("grenade") || text.includes("bomb")) {
        return projectileColors.grenade;
      }
      if (text.includes("arrow") || text.includes("bolt") || text.includes("shot")) {
        return projectileColors.arrow;
      }
      return 0xf1f5f9;
    }

    function stableStringify(value) {
      try {
        return JSON.stringify(value) || "";
      } catch {
        return "";
      }
    }

    function createRuntimeCanvas(width, height) {
      if (typeof document === "undefined" || !document || typeof document.createElement !== "function") {
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(Number(width) || 1));
      canvas.height = Math.max(1, Math.ceil(Number(height) || 1));
      return canvas;
    }

    function drawCanvasRoundedRect(targetCtx, x, y, width, height, radius) {
      const r = Math.min(radius, width * 0.5, height * 0.5);
      targetCtx.beginPath();
      targetCtx.moveTo(x + r, y);
      targetCtx.lineTo(x + width - r, y);
      targetCtx.quadraticCurveTo(x + width, y, x + width, y + r);
      targetCtx.lineTo(x + width, y + height - r);
      targetCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      targetCtx.lineTo(x + r, y + height);
      targetCtx.quadraticCurveTo(x, y + height, x, y + height - r);
      targetCtx.lineTo(x, y + r);
      targetCtx.quadraticCurveTo(x, y, x + r, y);
      targetCtx.closePath();
    }

    function getDynamicAreaEffectCanvas(key, width, height, now, debugKey = "") {
      const runtimeKey = String(key || "");
      const normalizedWidth = Math.max(1, Math.ceil(Number(width) || 1));
      const normalizedHeight = Math.max(1, Math.ceil(Number(height) || 1));
      let runtime = dynamicAreaEffectRuntime.get(runtimeKey);
      if (!runtime) {
        const canvas = createRuntimeCanvas(normalizedWidth, normalizedHeight);
        if (!canvas) {
          return null;
        }
        runtime = { canvas, lastSeenAt: Number(now) || performance.now() };
        dynamicAreaEffectRuntime.set(runtimeKey, runtime);
      } else if (
        !runtime.canvas ||
        runtime.canvas.width !== normalizedWidth ||
        runtime.canvas.height !== normalizedHeight
      ) {
        runtime.canvas = createRuntimeCanvas(normalizedWidth, normalizedHeight);
        if (!runtime.canvas) {
          dynamicAreaEffectRuntime.delete(runtimeKey);
          return null;
        }
      }
      runtime.lastSeenAt = Number(now) || performance.now();
      if (debugKey && runtime.canvas && typeof runtime.canvas === "object") {
        try {
          runtime.canvas.__vibeSpriteKey = String(debugKey);
        } catch (_error) {
          // Debug tagging is best-effort only.
        }
      }
      return runtime.canvas;
    }

    function pruneDynamicAreaEffectRuntime(now = performance.now()) {
      for (const [key, runtime] of dynamicAreaEffectRuntime.entries()) {
        if (now - (Number(runtime && runtime.lastSeenAt) || 0) > 700) {
          dynamicAreaEffectRuntime.delete(key);
        }
      }
    }

    function getBackgroundGridTexture() {
      const key = `grid:${tileSize}`;
      const cached = backgroundTextureCache.get(key);
      if (cached) {
        return cached;
      }
      const surface = createRuntimeCanvas(tileSize, tileSize);
      if (!surface) {
        return PIXI.Texture.WHITE;
      }
      const ctx = surface.getContext("2d");
      if (!ctx) {
        return PIXI.Texture.WHITE;
      }
      ctx.clearRect(0, 0, tileSize, tileSize);
      ctx.strokeStyle = "rgba(23,54,79,0.70)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.5, tileSize);
      ctx.moveTo(0, 0.5);
      ctx.lineTo(tileSize, 0.5);
      ctx.stroke();
      const texture = PIXI.Texture.from(surface);
      backgroundTextureCache.set(key, texture);
      return texture;
    }

    function getTownTexture(townLayout, wallTiles) {
      if (!townLayout) {
        return null;
      }
      const key = `town:${stableStringify(townLayout)}:${stableStringify(wallTiles)}`;
      const cached = backgroundTextureCache.get(key);
      if (cached) {
        return cached;
      }
      const minX = Number(townLayout.minTileX) || 0;
      const minY = Number(townLayout.minTileY) || 0;
      const maxX = Number(townLayout.maxTileX) || 0;
      const maxY = Number(townLayout.maxTileY) || 0;
      const widthTiles = Math.max(1, maxX - minX + 1);
      const heightTiles = Math.max(1, maxY - minY + 1);
      const surface = createRuntimeCanvas(widthTiles * tileSize, heightTiles * tileSize);
      if (!surface) {
        return null;
      }
      const ctx = surface.getContext("2d");
      if (!ctx) {
        return null;
      }
      const wallSet = new Set(
        Array.isArray(wallTiles)
          ? wallTiles.map((tile) => `${Number(tile.x) || 0}:${Number(tile.y) || 0}`)
          : []
      );
      for (let y = 0; y < heightTiles; y += 1) {
        for (let x = 0; x < widthTiles; x += 1) {
          const tileX = minX + x;
          const tileY = minY + y;
          const px = x * tileSize;
          const py = y * tileSize;
          const isWall = wallSet.has(`${tileX}:${tileY}`);
          const tileSprite = getTownTileSprite ? getTownTileSprite(isWall ? "wall" : "floor", tileX, tileY) : null;
          if (tileSprite && tileSprite.width > 0 && tileSprite.height > 0) {
            ctx.drawImage(tileSprite, px, py, tileSize, tileSize);
          } else {
            ctx.fillStyle = isWall ? "#7e6041" : "#2d261e";
            ctx.fillRect(px, py, tileSize, tileSize);
          }
          const isGate =
            (tileY === Number(townLayout.minTileY) && tileX >= Number(townLayout.northGate && townLayout.northGate.min) && tileX <= Number(townLayout.northGate && townLayout.northGate.max)) ||
            (tileY === Number(townLayout.maxTileY) && tileX >= Number(townLayout.southGate && townLayout.southGate.min) && tileX <= Number(townLayout.southGate && townLayout.southGate.max)) ||
            (tileX === Number(townLayout.minTileX) && tileY >= Number(townLayout.westGate && townLayout.westGate.min) && tileY <= Number(townLayout.westGate && townLayout.westGate.max)) ||
            (tileX === Number(townLayout.maxTileX) && tileY >= Number(townLayout.eastGate && townLayout.eastGate.min) && tileY <= Number(townLayout.eastGate && townLayout.eastGate.max));
          if (isGate) {
            ctx.fillStyle = "rgba(232, 196, 129, 0.16)";
            ctx.fillRect(Math.round(px + 4), Math.round(py + 4), tileSize - 8, tileSize - 8);
          }
        }
      }
      const texture = PIXI.Texture.from(surface);
      backgroundTextureCache.set(key, texture);
      return texture;
    }

    function ensureApp(width, height) {
      if (app) {
        return true;
      }
      try {
        app = new PIXI.Application({
          width: Math.max(1, width | 0),
          height: Math.max(1, height | 0),
          antialias: true,
          autoDensity: true,
          resolution: windowObject.devicePixelRatio || 1,
          backgroundAlpha: 1,
          backgroundColor: 0x0a1621,
          powerPreference: "high-performance"
        });
      } catch (_error) {
        app = null;
        return false;
      }
      view = app.view;
      view.style.position = "fixed";
      view.style.left = "0";
      view.style.top = "0";
      view.style.width = "100vw";
      view.style.height = "100vh";
      view.style.display = "none";
      view.style.pointerEvents = "none";
      view.style.zIndex = "0";
      canvasElement.style.position = "fixed";
      canvasElement.style.left = "0";
      canvasElement.style.top = "0";
      canvasElement.style.zIndex = "1";
      if (canvasElement.parentNode) {
        canvasElement.parentNode.insertBefore(view, canvasElement);
      } else {
        document.body.appendChild(view);
      }
      stage = app.stage;
      root = new PIXI.Container();
      stage.addChild(root);

      backgroundLayer = new PIXI.Container();
      areaUnderlayLayer = new PIXI.Container();
      areaUnderlaySpriteLayer = createMixedTextureSpriteLayer();
      areaUnderlayFallbackLayer = new PIXI.Container();
      lootSpriteLayer = createMixedTextureSpriteLayer();
      lootFallbackLayer = new PIXI.Container();
      explosionLayer = createMixedTextureSpriteLayer();
      particleLayer = createMixedTextureSpriteLayer();
      mobLayer = new PIXI.Container();
      playerLayer = new PIXI.Container();
      projectileSpriteLayer = createMixedTextureSpriteLayer();
      projectileFallbackLayer = new PIXI.Container();
      vendorLayer = new PIXI.Container();
      questNpcLayer = new PIXI.Container();
      areaOverlayLayer = new PIXI.Container();
      areaOverlaySpriteLayer = createMixedTextureSpriteLayer();
      abilityPreviewLayer = new PIXI.Container();
      floatingDamageLayer = new PIXI.Container();
      tooltipLayer = new PIXI.Container();

      backgroundGraphics = new PIXI.Graphics();
      gridSprite = new PIXI.TilingSprite(PIXI.Texture.WHITE, Math.max(1, width | 0), Math.max(1, height | 0));
      gridSprite.alpha = 0.78;
      townSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
      townSprite.visible = false;
      areaUnderlayGraphics = new PIXI.Graphics();
      areaOverlayGraphics = new PIXI.Graphics();
      abilityPreviewGraphics = new PIXI.Graphics();
      tooltipGraphics = new PIXI.Graphics();
      tooltipText = new PIXI.Text("", {
        fontFamily: "Segoe UI",
        fontSize: 12,
        fill: 0xeaf6ff
      });
      tooltipText.anchor.set(0.5, 0);
      tooltipLayer.addChild(tooltipGraphics, tooltipText);

      backgroundLayer.addChild(backgroundGraphics, gridSprite, townSprite);
      areaUnderlayLayer.addChild(areaUnderlayGraphics);
      areaUnderlayLayer.addChild(areaUnderlaySpriteLayer);
      areaUnderlayLayer.addChild(areaUnderlayFallbackLayer);
      areaOverlayLayer.addChild(areaOverlayGraphics);
      areaOverlayLayer.addChild(areaOverlaySpriteLayer);
      abilityPreviewLayer.addChild(abilityPreviewGraphics);
      root.addChild(
        backgroundLayer,
        abilityPreviewLayer,
        projectileSpriteLayer,
        projectileFallbackLayer,
        explosionLayer,
        areaUnderlayLayer,
        particleLayer,
        vendorLayer,
        questNpcLayer,
        lootSpriteLayer,
        lootFallbackLayer,
        mobLayer,
        areaOverlayLayer,
        floatingDamageLayer,
        playerLayer,
        tooltipLayer
      );
      pixiParticleSystem = createPixiParticleSystem
        ? createPixiParticleSystem({
            PIXI,
            parentContainer: particleLayer,
            hashString
          })
        : null;
      prewarmStaticSpriteCaches();
      if (app.ticker && typeof app.ticker.stop === "function") {
        app.ticker.stop();
      }
      return true;
    }

    function clearNodeMap(nodeMap, destroyChild) {
      for (const [, node] of nodeMap) {
        if (node && node.container && node.container.parent) {
          node.container.parent.removeChild(node.container);
        }
        if (typeof destroyChild === "function") {
          destroyChild(node);
        }
      }
      nodeMap.clear();
    }

    function destroyNode(node) {
      if (node && node.container && typeof node.container.destroy === "function") {
        node.container.destroy({ children: true });
      }
    }

    function hide() {
      if (view) {
        view.style.display = "none";
      }
      canvasElement.style.opacity = "1";
    }

    function show() {
      if (view) {
        view.style.display = "block";
      }
      canvasElement.style.opacity = "0";
    }

    function resize(width, height) {
      if (!ensureApp(width, height)) {
        return;
      }
      app.renderer.resize(Math.max(1, width | 0), Math.max(1, height | 0));
    }

    function createLabeledNode() {
      const container = new PIXI.Container();
      const graphics = new PIXI.Graphics();
      const hpBack = new PIXI.Graphics();
      const hpFill = new PIXI.Graphics();
      const nameText = new PIXI.Text("", {
        fontFamily: "Segoe UI",
        fontSize: 12,
        fill: 0xf5f7fa
      });
      nameText.anchor.set(0.5, 1);
      container.addChild(graphics, hpBack, hpFill, nameText);
      return { container, graphics, hpBack, hpFill, nameText };
    }

    function createSimpleNode() {
      const container = new PIXI.Container();
      const graphics = new PIXI.Graphics();
      container.addChild(graphics);
      return { container, graphics };
    }

    function createLabeledSpriteNode() {
      const container = new PIXI.Container();
      const graphics = new PIXI.Graphics();
      const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      const hpBack = new PIXI.Graphics();
      const hpFill = new PIXI.Graphics();
      const castBack = new PIXI.Graphics();
      const castFill = new PIXI.Graphics();
      const effectGraphics = new PIXI.Graphics();
      const nameText = new PIXI.Text("", {
        fontFamily: "Segoe UI",
        fontSize: 12,
        fill: 0xf5f7fa
      });
      nameText.anchor.set(0.5, 1);
      container.addChild(graphics, sprite, effectGraphics, hpBack, hpFill, castBack, castFill, nameText);
      return { container, graphics, sprite, hpBack, hpFill, castBack, castFill, effectGraphics, nameText };
    }

    function createSpriteNode() {
      const container = new PIXI.Container();
      const graphics = new PIXI.Graphics();
      const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      container.addChild(graphics, sprite);
      return { container, graphics, sprite };
    }

    function acquirePooledSprite(pool, parentContainer) {
      const sprite = Array.isArray(pool) && pool.length ? pool.pop() : new PIXI.Sprite(PIXI.Texture.EMPTY);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = true;
      sprite.alpha = 1;
      sprite.rotation = 0;
      sprite.scale.set(1, 1);
      if (sprite.parent !== parentContainer) {
        if (sprite.parent) {
          sprite.parent.removeChild(sprite);
        }
        parentContainer.addChild(sprite);
      }
      return sprite;
    }

    function releasePooledSprite(pool, sprite) {
      if (!sprite) {
        return;
      }
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      sprite.visible = false;
      sprite.texture = PIXI.Texture.EMPTY;
      sprite.alpha = 1;
      sprite.rotation = 0;
      sprite.scale.set(1, 1);
      pool.push(sprite);
    }

    function configureCanvasTexture(texture, modeKey, forceUpdate = false) {
      const baseTexture = texture && texture.baseTexture ? texture.baseTexture : null;
      if (!baseTexture) {
        return;
      }
      if (modeKey === "nearest" && PIXI.SCALE_MODES && PIXI.SCALE_MODES.NEAREST !== undefined) {
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      } else if (PIXI.SCALE_MODES && PIXI.SCALE_MODES.LINEAR !== undefined) {
        baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      }
      if (PIXI.MIPMAP_MODES && PIXI.MIPMAP_MODES.OFF !== undefined && baseTexture.mipmap !== undefined) {
        baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
      }
      if (forceUpdate && typeof baseTexture.update === "function") {
        baseTexture.update();
      }
    }

    function getTextureFromCanvas(canvas, samplingMode = "linear", forceUpdate = false) {
      if (!canvas || typeof canvas.getContext !== "function") {
        return null;
      }
      const modeKey = String(samplingMode || "linear").trim().toLowerCase() === "nearest" ? "nearest" : "linear";
      let cacheByMode = canvasTextureCache.get(canvas);
      if (!cacheByMode) {
        cacheByMode = new Map();
        canvasTextureCache.set(canvas, cacheByMode);
      }
      const cached = cacheByMode.get(modeKey);
      if (cached) {
        configureCanvasTexture(cached, modeKey, forceUpdate);
        return cached;
      }
      const texture = PIXI.Texture.from(canvas);
      configureCanvasTexture(texture, modeKey, true);
      cacheByMode.set(modeKey, texture);
      return texture;
    }

    function warmCanvasTexture(canvas, samplingMode = "linear") {
      if (!canvas || Number(canvas.width) <= 0 || Number(canvas.height) <= 0) {
        return null;
      }
      return getTextureFromCanvas(canvas, samplingMode);
    }

    function buildPlayerHumanoidStyle(player) {
      const configured = typeof deps.getClassRenderStyle === "function" ? deps.getClassRenderStyle(player && player.classType) : null;
      if (configured && typeof configured === "object") {
        return configured;
      }
      const classType = String(player && player.classType || "").trim().toLowerCase();
      return {
        rigType: "humanoid",
        species: "human",
        archetype: classType || "adventurer",
        defaults: {
          head: classType === "mage" ? "wizard_hat" : classType === "ranger" ? "hood" : "helmet",
          chest: classType === "mage" ? "robe" : classType === "ranger" ? "leather" : "plate",
          shoulders: classType === "mage" ? "robe" : classType === "ranger" ? "leather" : "plate",
          gloves: classType === "mage" ? "robe" : classType === "ranger" ? "leather" : "plate",
          bracers: classType === "mage" ? "robe" : classType === "ranger" ? "leather" : "plate",
          belt: classType === "mage" ? "robe" : classType === "ranger" ? "leather" : "plate",
          pants: classType === "mage" ? "robe" : classType === "ranger" ? "leather" : "plate",
          boots: classType === "mage" ? "robe" : classType === "ranger" ? "leather" : "plate",
          mainHand: classType === "mage" ? "staff" : classType === "ranger" ? "bow" : "sword",
          offHand: classType === "warrior" ? "shield" : "none"
        }
      };
    }

    function buildHumanoidMobStyle(mob) {
      const baseStyle =
        typeof deps.getMobRenderStyle === "function" ? deps.getMobRenderStyle(mob) : mob && mob.renderStyle && typeof mob.renderStyle === "object" ? mob.renderStyle : null;
      const spriteType = getMobKind(mob);
      if (baseStyle && String(baseStyle.rigType || "").toLowerCase() === "humanoid") {
        return baseStyle;
      }
      if (spriteType === "zombie") {
        return {
          ...(baseStyle || {}),
          rigType: "humanoid",
          species: "zombie",
          defaults: {
            head: "none",
            chest: "ragged",
            shoulders: "ragged",
            gloves: "ragged",
            bracers: "ragged",
            belt: "ragged",
            pants: "ragged",
            boots: "leather",
            mainHand: "claws",
            offHand: "none"
          }
        };
      }
      if (spriteType === "skeleton_archer") {
        return {
          ...(baseStyle || {}),
          rigType: "humanoid",
          species: "skeleton",
          archetype: "archer",
          defaults: {
            head: "rusty_helmet",
            chest: "ribcage",
            shoulders: "none",
            gloves: "none",
            bracers: "none",
            belt: "none",
            pants: "none",
            boots: "none",
            mainHand: "bow",
            offHand: "none"
          }
        };
      }
      if (spriteType === "skeleton") {
        return {
          ...(baseStyle || {}),
          rigType: "humanoid",
          species: "skeleton",
          archetype: "warrior",
          defaults: {
            head: "rusty_helmet",
            chest: "ribcage",
            shoulders: "none",
            gloves: "none",
            bracers: "none",
            belt: "none",
            pants: "none",
            boots: "none",
            mainHand: "sword",
            offHand: "shield"
          }
        };
      }
      if (spriteType === "orc") {
        return {
          ...(baseStyle || {}),
          rigType: "humanoid",
          species: "orc",
          archetype: "berserker",
          defaults: {
            head: "none",
            chest: "leather",
            shoulders: "leather",
            gloves: "leather",
            bracers: "leather",
            belt: "leather",
            pants: "leather",
            boots: "leather",
            mainHand: "axe",
            offHand: "axe"
          }
        };
      }
      return {
        ...(baseStyle || {}),
        rigType: "humanoid",
        species: "human"
      };
    }

    function getHumanoidRuntime(entityKey) {
      const key = String(entityKey || "");
      const cached = humanoidRuntimeByKey.get(key);
      if (cached) {
        return cached;
      }
      if (!createHumanoidRenderTools) {
        return null;
      }
      const spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = 96;
      spriteCanvas.height = 96;
      const spriteCtx = spriteCanvas.getContext("2d");
      if (!spriteCtx) {
        return null;
      }
      const tools = createHumanoidRenderTools({
        ctx: spriteCtx,
        clamp,
        lerp,
        hashString,
        sanitizeCssColor,
        getActionDefById
      });
      if (!tools || typeof tools.drawHumanoid !== "function") {
        return null;
      }
      const runtime = {
        key,
        canvas: spriteCanvas,
        ctx: spriteCtx,
        tools,
        texture: getTextureFromCanvas(spriteCanvas),
        lastSeenAt: performance.now()
      };
      humanoidRuntimeByKey.set(key, runtime);
      return runtime;
    }

    function renderHumanoidSpriteFrame(entityKey, renderOptions) {
      const runtime = getHumanoidRuntime(entityKey);
      if (!runtime || !runtime.tools || typeof runtime.tools.drawHumanoid !== "function") {
        return null;
      }
      runtime.lastSeenAt = performance.now();
      runtime.ctx.clearRect(0, 0, runtime.canvas.width, runtime.canvas.height);
      runtime.tools.drawHumanoid({
        ...renderOptions,
        entityKey,
        p: {
          x: runtime.canvas.width * 0.5,
          y: runtime.canvas.height * 0.62
        }
      });
      if (runtime.texture && typeof runtime.texture.update === "function") {
        runtime.texture.update();
      } else if (runtime.texture && runtime.texture.baseTexture && typeof runtime.texture.baseTexture.update === "function") {
        runtime.texture.baseTexture.update();
      }
      return { canvas: runtime.canvas, texture: runtime.texture, rotation: 0 };
    }

    function pruneHumanoidRuntimes(now) {
      for (const [key, runtime] of humanoidRuntimeByKey.entries()) {
        if (!runtime || now - Number(runtime.lastSeenAt || 0) > 5000) {
          humanoidRuntimeByKey.delete(key);
        }
      }
    }

    function getPlayerSpriteFrame(entry) {
      const player = entry && entry.player ? entry.player : null;
      const isSelf = !!(entry && entry.isSelf);
      if (!player) {
        return null;
      }
      const style = buildPlayerHumanoidStyle(player);
      const equipmentSlots = typeof deps.getPlayerVisualEquipment === "function" ? deps.getPlayerVisualEquipment(player, isSelf) : {};
      let aimWorldX = NaN;
      let aimWorldY = NaN;
      let facingDx = NaN;
      if (isSelf) {
        if (
          deps.isTouchJoystickEnabled &&
          deps.isTouchJoystickEnabled() &&
          deps.abilityChannel &&
          deps.abilityChannel.active &&
          Number.isFinite(Number(deps.abilityChannel.targetX)) &&
          Number.isFinite(Number(deps.abilityChannel.targetY))
        ) {
          aimWorldX = Number(deps.abilityChannel.targetX);
          aimWorldY = Number(deps.abilityChannel.targetY);
        } else if (deps.isTouchJoystickEnabled && deps.isTouchJoystickEnabled()) {
          const movementDir =
            typeof deps.getCurrentMovementVector === "function" ? deps.getCurrentMovementVector() : null;
          const movementDx = Number(movementDir && movementDir.dx);
          if (Number.isFinite(movementDx) && Math.abs(movementDx) > 0.05) {
            facingDx = movementDx;
          }
        } else if (typeof deps.screenToWorld === "function" && deps.mouseState) {
          const self = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf() : player;
          const world = deps.screenToWorld(Number(deps.mouseState.sx) || 0, Number(deps.mouseState.sy) || 0, self);
          if (world && Number.isFinite(world.x) && Number.isFinite(world.y)) {
            aimWorldX = Number(world.x);
            aimWorldY = Number(world.y);
          }
        }
      }
      return renderHumanoidSpriteFrame(`pixi-player:${String(player.id ?? "0")}`, {
        entity: player,
        style,
        equipmentSlots,
        useDefaultGearFallback: false,
        attackState: entry.attackState || null,
        castState:
          entry.castVisual && Number(entry.castVisual.ratio) > 0
            ? { active: true, ratio: clamp(Number(entry.castVisual.ratio) || 0, 0, 1), abilityId: String(entry.castVisual.abilityId || ""), isCharge: entry.castVisual.isCharge, chargeStartX: entry.castVisual.chargeStartX, chargeStartY: entry.castVisual.chargeStartY, chargeTargetX: entry.castVisual.chargeTargetX, chargeTargetY: entry.castVisual.chargeTargetY }
            : null,
        aimWorldX,
        aimWorldY,
        facingDx,
        isSelf
      });
    }

    function getMobSpriteFrame(entry) {
      const mob = entry && entry.mob ? entry.mob : null;
      if (!mob) {
        return null;
      }
      const style = buildHumanoidMobStyle(mob);
      const attackState = entry.attackState
        ? {
            ...entry.attackState,
            progress: Math.round(clamp(Number(entry.attackState.progress) || 0, 0, 1) * 4) / 4
          }
        : null;
      const currentSelf = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf() : null;
      const aimWorldX = currentSelf && Number.isFinite(Number(currentSelf.x)) ? Number(currentSelf.x) + 0.5 : NaN;
      const aimWorldY = currentSelf && Number.isFinite(Number(currentSelf.y)) ? Number(currentSelf.y) + 0.5 : NaN;
      return renderHumanoidSpriteFrame(`pixi-mob:${String(mob.id ?? "0")}`, {
        entity: mob,
        style,
        equipmentSlots: {},
        useDefaultGearFallback: true,
        attackState,
        aimWorldX,
        aimWorldY,
        castState:
          entry.castVisual && Number(entry.castVisual.ratio) > 0
            ? { active: true, progress: clamp(Number(entry.castVisual.ratio) || 0, 0, 1), abilityId: String(entry.castVisual.abilityId || "") }
            : null,
        isSelf: false
      });
    }

    function getProjectileParticleConfig(projectile, projectileHook = "") {
      const normalizedHook = String(projectileHook || "").trim().toLowerCase();
      if (
        normalizedHook === "fireball" ||
        normalizedHook === "fire_spark" ||
        normalizedHook === "frostbolt" ||
        normalizedHook === "arcane_missiles" ||
        normalizedHook === "bone_arrow" ||
        normalizedHook === "ranger_arrow" ||
        normalizedHook === "poison_arrow" ||
        normalizedHook === "explosive_arrow" ||
        normalizedHook === "shrapnel_grenade" ||
        normalizedHook === "shrapnel_shard" ||
        normalizedHook === "ballista_bolt"
      ) {
        return null;
      }
      const text = `${String(projectile && projectile.abilityId || "")} ${String(projectile && projectile.name || "")}`.toLowerCase();
      if (text.includes("fire")) {
        return projectileParticleConfigs.fire;
      }
      if (text.includes("frost") || text.includes("ice")) {
        return projectileParticleConfigs.frost;
      }
      if (text.includes("arcane")) {
        return projectileParticleConfigs.arcane;
      }
      if (text.includes("lightning")) {
        return projectileParticleConfigs.lightning;
      }
      if (text.includes("poison")) {
        return projectileParticleConfigs.poison;
      }
      return null;
    }

    function getSpriteCanvasDebugKey(spriteFrame) {
      const canvas = spriteFrame && spriteFrame.canvas;
      if (!canvas || typeof canvas !== "object") {
        return "";
      }
      return String(canvas.__vibeSpriteKey || "");
    }

    function getAreaEffectVisualConfig(effect) {
      const abilityId = String(effect && effect.abilityId || "").toLowerCase();
      if (abilityId.includes("fire")) {
        return {
          kind: "fire",
          stroke: "#ffae6b",
          fill: "rgba(255, 117, 59, 0.16)",
          glow: "rgba(255, 117, 59, 0.28)"
        };
      }
      if (abilityId.includes("frost") || abilityId.includes("blizzard")) {
        return {
          kind: "frost",
          stroke: "#c8efff",
          fill: "rgba(124, 198, 255, 0.12)",
          glow: "rgba(124, 198, 255, 0.22)"
        };
      }
      if (abilityId.includes("arcane")) {
        return {
          kind: "arcane",
          stroke: "#e0c7ff",
          fill: "rgba(170, 121, 255, 0.12)",
          glow: "rgba(170, 121, 255, 0.24)"
        };
      }
      if (abilityId.includes("lightning")) {
        return {
          kind: "lightning",
          stroke: "#fff2a3",
          fill: "rgba(255, 224, 100, 0.12)",
          glow: "rgba(255, 224, 100, 0.22)"
        };
      }
      if (abilityId.includes("poison") || abilityId.includes("caltrop")) {
        return {
          kind: "poison",
          stroke: "#c7ff9f",
          fill: "rgba(116, 201, 96, 0.12)",
          glow: "rgba(116, 201, 96, 0.22)"
        };
      }
      if (abilityId.includes("rain")) {
        return {
          kind: "rain",
          stroke: "#f0e8c2",
          fill: "rgba(212, 184, 110, 0.10)",
          glow: "rgba(212, 184, 110, 0.18)"
        };
      }
      return {
        kind: "default",
        stroke: "#c7ddf1",
        fill: "rgba(121, 185, 255, 0.10)",
        glow: "rgba(121, 185, 255, 0.18)"
      };
    }

    function drawDetailedBlizzardTexture(ctx, size, radius, phaseBucket) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const phase = phaseBucket / 6;
      const zoneGlow = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.08);
      zoneGlow.addColorStop(0, "rgba(196,230,255,0.26)");
      zoneGlow.addColorStop(0.62, "rgba(103,165,218,0.16)");
      zoneGlow.addColorStop(1, "rgba(61,104,168,0)");
      ctx.fillStyle = zoneGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.lineCap = "round";
      for (let i = 0; i < 38; i += 1) {
        const a = phase * Math.PI * 2 + i * 1.73;
        const px = cx + Math.cos(a * 0.7 + i) * radius * 0.72;
        const py = cy + Math.sin(a * 1.2 + i * 0.4) * radius * 0.72;
        const len = 5 + (i % 4) * 2.2;
        ctx.strokeStyle = `rgba(225,245,255,${(0.18 + (i % 3) * 0.07).toFixed(3)})`;
        ctx.lineWidth = 0.9 + (i % 3) * 0.25;
        ctx.beginPath();
        ctx.moveTo(px - len * 0.45, py - len * 0.75);
        ctx.lineTo(px + len * 0.15, py + len * 0.18);
        ctx.stroke();
        if (i % 7 === 0) {
          ctx.strokeStyle = "rgba(239,250,255,0.34)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px - 2, py);
          ctx.lineTo(px + 2, py);
          ctx.moveTo(px, py - 2);
          ctx.lineTo(px, py + 2);
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.strokeStyle = "rgba(167,224,255,0.45)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawDetailedRainTexture(ctx, size, radius, phaseBucket) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const phase = phaseBucket / 6;
      const zoneGlow = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.05);
      zoneGlow.addColorStop(0, "rgba(197,178,108,0.16)");
      zoneGlow.addColorStop(0.7, "rgba(120,88,42,0.12)");
      zoneGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = zoneGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 26; i += 1) {
        const a = i * 0.81 + phase * 2.2;
        const px = cx + Math.cos(a * 1.27) * radius * 0.78;
        const py = cy + Math.sin(a * 0.93 + i * 0.35) * radius * 0.78;
        const len = 10 + (i % 5) * 1.6;
        ctx.strokeStyle = `rgba(236,226,212,${(0.22 + (i % 4) * 0.05).toFixed(3)})`;
        ctx.lineWidth = 1 + (i % 3) * 0.15;
        ctx.beginPath();
        ctx.moveTo(px + 2.5, py - len * 0.55);
        ctx.lineTo(px - 1.2, py + len * 0.38);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(235,211,162,0.48)";
      ctx.lineWidth = 1.45;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    function getCaltropIconCanvas() {
      const key = "caltrop-icon";
      const cached = genericCanvasCache.get(key);
      if (cached) {
        return cached.canvas;
      }
      const canvas = createRuntimeCanvas(22, 22);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.translate(11, 11);
      ctx.strokeStyle = "rgba(224, 231, 239, 0.96)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-5, -4);
      ctx.lineTo(5, 4);
      ctx.moveTo(-5, 4);
      ctx.lineTo(5, -4);
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.stroke();
      genericCanvasCache.set(key, { canvas, rotation: 0 });
      return canvas;
    }

    function getHydraSummonIconCanvas(frameIndex = 0) {
      const key = `hydra-summon-icon:${Math.max(0, Math.floor(Number(frameIndex) || 0)) % 6}`;
      const cached = genericCanvasCache.get(key);
      if (cached) {
        return cached.canvas;
      }
      const size = 76;
      const canvas = createRuntimeCanvas(size, size);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const phase = (Math.max(0, Math.floor(Number(frameIndex) || 0)) % 6) / 6;
      const bob = Math.sin(phase * Math.PI * 2);
      const flicker = Math.cos(phase * Math.PI * 2);

      ctx.translate(size / 2, size / 2 + 4);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const tailGlow = ctx.createRadialGradient(0, 22, 0, 0, 22, 26);
      tailGlow.addColorStop(0, "rgba(255, 196, 96, 0.34)");
      tailGlow.addColorStop(0.5, "rgba(255, 112, 34, 0.18)");
      tailGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = tailGlow;
      ctx.beginPath();
      ctx.arc(0, 22, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(63, 16, 9, 0.92)";
      ctx.beginPath();
      ctx.ellipse(0, 21, 17, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 171, 82, 0.72)";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 96, 41, 0.82)";
      ctx.lineWidth = 8;
      const neckEndX = bob * 5;
      const neckEndY = -9 - Math.abs(flicker) * 2;
      ctx.beginPath();
      ctx.moveTo(-1.5, 14);
      ctx.quadraticCurveTo(-7 + bob * 2.8, 2, neckEndX, neckEndY);
      ctx.stroke();

      const headX = neckEndX + 1.5;
      const headY = neckEndY - 4.5;
      const headGlow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 15);
      headGlow.addColorStop(0, "rgba(255, 248, 196, 0.88)");
      headGlow.addColorStop(0.42, "rgba(255, 153, 74, 0.48)");
      headGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(headX, headY, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(221, 63, 30, 0.98)";
      ctx.beginPath();
      ctx.ellipse(headX, headY, 7.5, 6.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 208, 129, 0.82)";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 214, 115, 0.98)";
      ctx.beginPath();
      ctx.arc(headX + 1.2, headY - 1, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 191, 111, 0.76)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(headX + 3.8, headY - 1.8);
      ctx.lineTo(headX + 10, headY - 5.5 - Math.abs(bob) * 2.8);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(headX + 2, headY + 4);
      ctx.lineTo(headX + 8.5, headY + 8.5 + Math.abs(bob) * 1.5);
      ctx.stroke();

      genericCanvasCache.set(key, { canvas, rotation: 0 });
      return canvas;
    }

    function getBallistaSummonIconCanvas(frameIndex = 0) {
      const key = `ballista-summon-icon:${Math.max(0, Math.floor(Number(frameIndex) || 0)) % 6}`;
      const cached = genericCanvasCache.get(key);
      if (cached) {
        return cached.canvas;
      }
      const size = 76;
      const canvas = createRuntimeCanvas(size, size);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const phase = (Math.max(0, Math.floor(Number(frameIndex) || 0)) % 6) / 6 * Math.PI * 2;
      const recoil = Math.sin(phase) * 2.6;

      ctx.translate(size / 2, size / 2 + 6);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.fillStyle = "rgba(42, 28, 18, 0.92)";
      ctx.beginPath();
      ctx.ellipse(0, 16, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(207, 169, 114, 0.92)";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-9, 14);
      ctx.lineTo(-2, 0);
      ctx.lineTo(9, 14);
      ctx.moveTo(-4, 16);
      ctx.lineTo(0, 4);
      ctx.lineTo(4, 16);
      ctx.stroke();

      ctx.fillStyle = "rgba(138, 101, 58, 0.98)";
      ctx.strokeStyle = "rgba(241, 222, 174, 0.72)";
      ctx.lineWidth = 1.5;
      drawCanvasRoundedRect(ctx, -14, -2, 28, 8, 3);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(228, 214, 191, 0.96)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-12, -1);
      ctx.lineTo(14 + recoil, -13);
      ctx.moveTo(-12, 5);
      ctx.lineTo(14 + recoil, 17);
      ctx.moveTo(14 + recoil, -13);
      ctx.lineTo(14 + recoil, 17);
      ctx.stroke();

      ctx.fillStyle = "rgba(230, 219, 196, 0.96)";
      ctx.beginPath();
      ctx.moveTo(18 + recoil, 2);
      ctx.lineTo(11 + recoil, -2.8);
      ctx.lineTo(13.5 + recoil, 2);
      ctx.lineTo(11 + recoil, 6.8);
      ctx.closePath();
      ctx.fill();

      genericCanvasCache.set(key, { canvas, rotation: 0 });
      return canvas;
    }

    function prewarmStaticSpriteCaches() {
      if (staticSpriteCachesWarmed) {
        return;
      }
      staticSpriteCachesWarmed = true;

      warmCanvasTexture(getCaltropIconCanvas());
      for (let frameIndex = 0; frameIndex < 6; frameIndex += 1) {
        warmCanvasTexture(getHydraSummonIconCanvas(frameIndex));
        warmCanvasTexture(getBallistaSummonIconCanvas(frameIndex));
      }
      if (getVendorNpcSprite) {
        warmCanvasTexture(getVendorNpcSprite());
      }
      if (getLootBagSprite) {
        for (let variant = 0; variant < 8; variant += 1) {
          warmCanvasTexture(getLootBagSprite(variant));
        }
      }
    }

    function drawDetailedCaltropsTexture(ctx, size, radius) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const icon = getCaltropIconCanvas();
      const zoneGlow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
      zoneGlow.addColorStop(0, "rgba(214,224,236,0.10)");
      zoneGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = zoneGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 16; i += 1) {
        const a = i * 0.92;
        const r = radius * (0.22 + ((i * 37) % 100) / 100 * 0.62);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a * 1.12) * r;
        const scale = 0.5 + (i % 4) * 0.1;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a * 0.8);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(icon, -icon.width * scale * 0.5, -icon.height * scale * 0.5, icon.width * scale, icon.height * scale);
        ctx.restore();
      }
      ctx.strokeStyle = "rgba(220,229,242,0.42)";
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawDetailedSummonTexture(ctx, size, radius, effect, phaseBucket) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const count = Math.max(1, Math.round(Number(effect && effect.summonCount) || 1));
      const formationRadius = Math.max(0, Number(effect && effect.formationRadius) || 0.9);
      const abilityId = String(effect && effect.abilityId || "").toLowerCase();
      const positions =
        globalScope.VibeSummonLayout && typeof globalScope.VibeSummonLayout.computeSummonFormationPositions === "function"
          ? globalScope.VibeSummonLayout.computeSummonFormationPositions(0, 0, count, formationRadius)
          : [{ x: 0, y: 0, index: 0 }];
      const isHydra = abilityId.includes("hydra");
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
      glow.addColorStop(0, isHydra ? "rgba(255,170,92,0.14)" : "rgba(255,210,146,0.12)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      for (const point of positions) {
        const px = cx + point.x * tileSize;
        const py = cy + point.y * tileSize;
        if (isHydra) {
          const hydraIcon = getHydraSummonIconCanvas((phaseBucket + point.index) % 6);
          if (hydraIcon) {
            const scale = 0.44;
            const width = hydraIcon.width * scale;
            const height = hydraIcon.height * scale;
            ctx.drawImage(hydraIcon, px - width * 0.5, py - height * 0.56 - 2, width, height);
          }
        } else {
          const ballistaIcon = getBallistaSummonIconCanvas((phaseBucket + point.index) % 6);
          if (ballistaIcon) {
            const scale = 0.46;
            const width = ballistaIcon.width * scale;
            const height = ballistaIcon.height * scale;
            ctx.drawImage(ballistaIcon, px - width * 0.5, py - height * 0.56 - 1.5, width, height);
          }
        }
      }
    }

    function getTracerAreaEffectSpriteFrame(effect, paletteKey, frameNow) {
      const palettes = {
        ricochet: {
          outer: [245, 181, 96],
          core: [244, 231, 210],
          hot: [255, 249, 236],
          streak: [255, 214, 140]
        },
        piercing: {
          outer: [255, 185, 92],
          core: [244, 230, 203],
          hot: [255, 250, 239],
          streak: [255, 214, 136]
        }
      };
      const palette = palettes[paletteKey] || palettes.ricochet;
      const startX = Number(effect && (Number.isFinite(Number(effect.startX)) ? effect.startX : effect.x)) + 0.5;
      const startY = Number(effect && (Number.isFinite(Number(effect.startY)) ? effect.startY : effect.y)) + 0.5;
      const dir = normalizeDirection(effect && effect.dx, effect && effect.dy) || { dx: 1, dy: 0 };
      const dirX = dir.dx;
      const dirY = dir.dy;
      const lengthTiles = Math.max(0.25, Number(effect && (effect.length || effect.radius)) || 1);
      const endX = startX + dirX * lengthTiles;
      const endY = startY + dirY * lengthTiles;
      const deltaXPx = (endX - startX) * tileSize;
      const deltaYPx = (endY - startY) * tileSize;
      const widthPx =
        paletteKey === "piercing"
          ? Math.max(3.4, (Number(effect && effect.width) || 0.5) * tileSize)
          : Math.max(2.5, (Number(effect && effect.width) || 0.35) * tileSize);
      const padding = Math.max(18, Math.ceil(widthPx * 3));
      const canvasWidth = Math.max(1, Math.ceil(Math.abs(deltaXPx) + padding * 2));
      const canvasHeight = Math.max(1, Math.ceil(Math.abs(deltaYPx) + padding * 2));
      const runtimeKey = `tracer:${paletteKey}:${String(effect && effect.id || `${effect && effect.abilityId || ""}:${effect && effect.startedAt || 0}`)}`;
      const canvas = getDynamicAreaEffectCanvas(runtimeKey, canvasWidth, canvasHeight, frameNow, runtimeKey);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fadeIn = paletteKey === "piercing" ? clamp((frameNow - effect.startedAt) / 60, 0, 1) : 1;
      const fadeOut = 1 - clamp((frameNow - effect.endsAt + 120) / 120, 0, 1);
      const alpha = paletteKey === "piercing" ? fadeIn * fadeOut : fadeOut;
      const start = {
        x: padding + Math.max(0, -deltaXPx),
        y: padding + Math.max(0, -deltaYPx)
      };
      const end = {
        x: start.x + deltaXPx,
        y: start.y + deltaYPx
      };
      drawTaperedTracerBeam(ctx, start, end, Number(effect && effect.seed) || 0, frameNow, {
        alpha,
        widthPx,
        outerGlowColor: palette.outer,
        coreColor: palette.core,
        hotColor: palette.hot,
        streakColor: palette.streak,
        sparkCount: paletteKey === "piercing" ? 8 : 4
      });
      return {
        canvas,
        rotation: 0,
        alpha: 1,
        dynamic: true,
        centerWorldX: (startX + endX) * 0.5,
        centerWorldY: (startY + endY) * 0.5
      };
    }

    function resolveBeamWorldEndpoints(effect) {
      const startX = Number.isFinite(Number(effect && effect.startX)) ? Number(effect.startX) : Number(effect && effect.x) || 0;
      const startY = Number.isFinite(Number(effect && effect.startY)) ? Number(effect.startY) : Number(effect && effect.y) || 0;
      const dir = normalizeDirection(effect && effect.dx, effect && effect.dy) || { dx: 0, dy: -1 };
      const dirX = dir.dx;
      const dirY = dir.dy;
      const lengthTiles = Math.max(0.25, Number(effect && (effect.length || effect.radius)) || 1);
      return {
        startX,
        startY,
        endX: startX + dirX * lengthTiles,
        endY: startY + dirY * lengthTiles,
        lengthTiles
      };
    }

    function buildParametricJaggedBeamPoints(start, end, seed, options = {}) {
      const segmentCount = Math.max(4, Math.floor(Number(options.segmentCount) || 12));
      const amplitudePx = Math.max(0, Number(options.amplitudePx) || 12);
      const phase = Number(options.phase) || 0;
      const taperPower = Math.max(0.4, Number(options.taperPower) || 1.1);
      const waveFrequency = Math.max(0.5, Number(options.waveFrequency) || 3.4);
      const noiseMix = clamp(Number(options.noiseMix) || 0.55, 0, 1);
      const points = [];
      const beamDx = end.x - start.x;
      const beamDy = end.y - start.y;
      const beamLengthPx = Math.max(1, Math.hypot(beamDx, beamDy));
      const dirX = beamDx / beamLengthPx;
      const dirY = beamDy / beamLengthPx;
      const perpX = -dirY;
      const perpY = dirX;
      const seedBase = Math.floor(Number(seed) || 0);

      for (let i = 0; i <= segmentCount; i += 1) {
        const t = i / segmentCount;
        let offset = 0;
        if (i > 0 && i < segmentCount) {
          const envelope = Math.pow(Math.sin(t * Math.PI), taperPower);
          const jitter = seededUnit(seedBase, 100 + i * 17) * 2 - 1;
          const wavePhase = phase + t * Math.PI * 2 * waveFrequency + seededUnit(seedBase, 200 + i * 19) * Math.PI;
          const wave = Math.sin(wavePhase);
          offset = amplitudePx * envelope * (jitter * noiseMix + wave * (1 - noiseMix));
        }
        points.push({
          x: start.x + beamDx * t + perpX * offset,
          y: start.y + beamDy * t + perpY * offset
        });
      }
      return points;
    }

    function strokeBeamPolyline(targetCtx, points) {
      if (!targetCtx || !Array.isArray(points) || points.length < 2) {
        return;
      }
      targetCtx.beginPath();
      targetCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        targetCtx.lineTo(points[i].x, points[i].y);
      }
      targetCtx.stroke();
    }

    function drawParametricJaggedBeam(targetCtx, start, end, seed, now, options = {}) {
      const alpha = clamp(Number(options.alpha) || 1, 0, 1);
      if (!targetCtx || alpha <= 0) {
        return;
      }
      const widthPx = Math.max(2, Number(options.widthPx) || 14);
      const outerGlowColor = options.outerGlowColor || [122, 208, 255];
      const coreColor = options.coreColor || [180, 235, 255];
      const hotColor = options.hotColor || [248, 251, 255];
      const branchColor = options.branchColor || coreColor;
      const burstColor = options.burstColor || coreColor;
      const phase = now * (Number(options.phaseSpeed) || 0.0095) + (Number(options.phaseOffset) || 0);
      const mainPoints = buildParametricJaggedBeamPoints(start, end, seed, {
        segmentCount: options.segmentCount,
        amplitudePx: options.amplitudePx ?? widthPx * 0.9,
        phase,
        taperPower: options.taperPower,
        waveFrequency: options.waveFrequency,
        noiseMix: options.noiseMix
      });

      targetCtx.save();
      targetCtx.globalCompositeOperation = "lighter";
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";

      targetCtx.strokeStyle = `rgba(${outerGlowColor[0]}, ${outerGlowColor[1]}, ${outerGlowColor[2]}, ${(0.32 * alpha).toFixed(3)})`;
      targetCtx.lineWidth = widthPx * 1.65;
      strokeBeamPolyline(targetCtx, mainPoints);

      targetCtx.strokeStyle = `rgba(${coreColor[0]}, ${coreColor[1]}, ${coreColor[2]}, ${(0.92 * alpha).toFixed(3)})`;
      targetCtx.lineWidth = widthPx * 0.72;
      strokeBeamPolyline(targetCtx, mainPoints);

      targetCtx.strokeStyle = `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.98 * alpha).toFixed(3)})`;
      targetCtx.lineWidth = Math.max(1.2, widthPx * 0.22);
      strokeBeamPolyline(targetCtx, mainPoints);

      const branchCount = Math.max(0, Math.floor(Number(options.branchCount) || 0));
      for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        const startT = 0.18 + seededUnit(seed, 310 + branchIndex * 29) * 0.6;
        const endT = Math.min(0.98, startT + 0.08 + seededUnit(seed, 311 + branchIndex * 29) * 0.22);
        const baseAngle = (seededUnit(seed, 312 + branchIndex * 29) - 0.5) * Math.PI * 1.2;
        const directionX = end.x - start.x;
        const directionY = end.y - start.y;
        const len = Math.max(1, Math.hypot(directionX, directionY));
        const dirX = directionX / len;
        const dirY = directionY / len;
        const perpX = -dirY;
        const perpY = dirX;
        const startPoint = {
          x: start.x + directionX * startT,
          y: start.y + directionY * startT
        };
        const branchLength = widthPx * (1.8 + seededUnit(seed, 313 + branchIndex * 29) * 2.7);
        const branchDirSign = seededUnit(seed, 314 + branchIndex * 29) * 2 - 1;
        const endPoint = {
          x:
            startPoint.x +
            dirX * branchLength * (0.25 + (endT - startT) * 0.8) +
            perpX * branchLength * 0.7 * branchDirSign * Math.cos(baseAngle),
          y:
            startPoint.y +
            dirY * branchLength * (0.25 + (endT - startT) * 0.8) +
            perpY * branchLength * 0.7 * branchDirSign * Math.cos(baseAngle)
        };
        const branchPoints = buildParametricJaggedBeamPoints(startPoint, endPoint, seed + branchIndex * 997, {
          segmentCount: Math.max(4, Math.floor((Number(options.segmentCount) || 10) * 0.45)),
          amplitudePx: Math.max(2, widthPx * 0.32),
          phase: phase * 1.24 + branchIndex * 0.9,
          taperPower: 0.95,
          waveFrequency: 2.8,
          noiseMix: 0.62
        });
        targetCtx.strokeStyle = `rgba(${branchColor[0]}, ${branchColor[1]}, ${branchColor[2]}, ${(0.52 * alpha).toFixed(3)})`;
        targetCtx.lineWidth = Math.max(1, widthPx * 0.16);
        strokeBeamPolyline(targetCtx, branchPoints);
      }

      const burstRadius = Math.max(5, widthPx * 0.9);
      for (const point of [start, end]) {
        const burst = targetCtx.createRadialGradient(point.x, point.y, 0, point.x, point.y, burstRadius);
        burst.addColorStop(0, `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.95 * alpha).toFixed(3)})`);
        burst.addColorStop(0.42, `rgba(${burstColor[0]}, ${burstColor[1]}, ${burstColor[2]}, ${(0.4 * alpha).toFixed(3)})`);
        burst.addColorStop(1, "rgba(0, 0, 0, 0)");
        targetCtx.fillStyle = burst;
        targetCtx.beginPath();
        targetCtx.arc(point.x, point.y, burstRadius, 0, Math.PI * 2);
        targetCtx.fill();
      }

      targetCtx.restore();
    }

    function drawArcaneBeamTexture(targetCtx, effect, start, end, now, beamWidthPx) {
      const beamLengthPx = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
      const dirX = (end.x - start.x) / beamLengthPx;
      const dirY = (end.y - start.y) / beamLengthPx;
      const effectSeed = Number(effect && effect.seed) || 0;
      const lifeT = clamp((now - effect.startedAt) / Math.max(1, effect.durationMs), 0, 1);
      const fadeOut = 1 - clamp((now - effect.endsAt + 300) / 300, 0, 1);
      const alpha = clamp((0.82 - lifeT * 0.2) * fadeOut, 0, 1);
      if (alpha <= 0) {
        return;
      }

      targetCtx.save();
      targetCtx.globalCompositeOperation = "lighter";

      targetCtx.strokeStyle = `rgba(165, 132, 255, ${(0.45 * alpha).toFixed(3)})`;
      targetCtx.lineCap = "round";
      targetCtx.lineWidth = beamWidthPx * 1.9;
      targetCtx.beginPath();
      targetCtx.moveTo(start.x, start.y);
      targetCtx.lineTo(end.x, end.y);
      targetCtx.stroke();

      const beamGradient = targetCtx.createLinearGradient(start.x, start.y, end.x, end.y);
      beamGradient.addColorStop(0, `rgba(206, 176, 255, ${(0.88 * alpha).toFixed(3)})`);
      beamGradient.addColorStop(0.5, `rgba(245, 236, 255, ${(0.98 * alpha).toFixed(3)})`);
      beamGradient.addColorStop(1, `rgba(196, 168, 255, ${(0.9 * alpha).toFixed(3)})`);
      targetCtx.strokeStyle = beamGradient;
      targetCtx.lineWidth = beamWidthPx * 0.9;
      targetCtx.beginPath();
      targetCtx.moveTo(start.x, start.y);
      targetCtx.lineTo(end.x, end.y);
      targetCtx.stroke();

      targetCtx.strokeStyle = `rgba(255, 252, 255, ${(0.95 * alpha).toFixed(3)})`;
      targetCtx.lineWidth = Math.max(1.5, beamWidthPx * 0.22);
      targetCtx.beginPath();
      targetCtx.moveTo(start.x, start.y);
      targetCtx.lineTo(end.x, end.y);
      targetCtx.stroke();

      const perpX = -dirY;
      const perpY = dirX;
      for (let strand = 0; strand < 2; strand += 1) {
        targetCtx.beginPath();
        targetCtx.strokeStyle = `rgba(233, 220, 255, ${(0.56 * alpha).toFixed(3)})`;
        targetCtx.lineWidth = Math.max(1.2, beamWidthPx * 0.18);
        for (let i = 0; i <= 32; i += 1) {
          const t = i / 32;
          const phase = now * 0.008 + strand * Math.PI + t * Math.PI * 6;
          const wobble = Math.sin(phase) * beamWidthPx * 0.55;
          const px = start.x + (end.x - start.x) * t + perpX * wobble;
          const py = start.y + (end.y - start.y) * t + perpY * wobble;
          if (i === 0) {
            targetCtx.moveTo(px, py);
          } else {
            targetCtx.lineTo(px, py);
          }
        }
        targetCtx.stroke();
      }

      for (let i = 0; i < 20; i += 1) {
        const t = (seededUnit(effectSeed, i * 23 + 11) + now * 0.00035) % 1;
        const baseX = start.x + (end.x - start.x) * t;
        const baseY = start.y + (end.y - start.y) * t;
        const wiggle = (seededUnit(effectSeed, i * 31 + 7) - 0.5) * beamWidthPx * 1.7;
        const px = baseX + perpX * wiggle;
        const py = baseY + perpY * wiggle;
        const radius = 0.8 + seededUnit(effectSeed, i * 19 + 3) * 1.8;
        targetCtx.beginPath();
        targetCtx.fillStyle = `rgba(244, 238, 255, ${(0.38 + seededUnit(effectSeed, i * 13 + 5) * 0.4 * alpha).toFixed(3)})`;
        targetCtx.arc(px, py, radius, 0, Math.PI * 2);
        targetCtx.fill();
      }

      const burstRadius = Math.max(6, beamWidthPx * 1.1);
      for (const point of [start, end]) {
        const burst = targetCtx.createRadialGradient(point.x, point.y, 0, point.x, point.y, burstRadius);
        burst.addColorStop(0, `rgba(250, 243, 255, ${(0.9 * alpha).toFixed(3)})`);
        burst.addColorStop(0.5, `rgba(196, 159, 255, ${(0.45 * alpha).toFixed(3)})`);
        burst.addColorStop(1, "rgba(124, 90, 220, 0)");
        targetCtx.fillStyle = burst;
        targetCtx.beginPath();
        targetCtx.arc(point.x, point.y, burstRadius, 0, Math.PI * 2);
        targetCtx.fill();
      }

      targetCtx.restore();
    }

    function drawLightningBeamTexture(targetCtx, effect, start, end, now, beamWidthPx, lengthTiles) {
      const fadeIn = clamp((now - effect.startedAt) / 55, 0, 1);
      const fadeOut = 1 - clamp((now - effect.endsAt + 130) / 130, 0, 1);
      const alpha = clamp(fadeIn * fadeOut, 0, 1);
      if (alpha <= 0) {
        return;
      }
      const seed = Number(effect.seed) || hashString(`${effect.id || "lightning"}:${effect.startedAt || 0}`);
      drawParametricJaggedBeam(targetCtx, start, end, seed, now, {
        alpha,
        widthPx: beamWidthPx,
        segmentCount: Math.max(8, Math.round(lengthTiles * 3.5)),
        amplitudePx: beamWidthPx * 1.05,
        taperPower: 0.78,
        waveFrequency: 4.8,
        noiseMix: 0.68,
        phaseSpeed: 0.022,
        outerGlowColor: [92, 198, 255],
        coreColor: [141, 228, 255],
        hotColor: [250, 252, 255],
        branchColor: [179, 239, 255],
        burstColor: [143, 218, 255],
        branchCount: Math.max(2, Math.round(lengthTiles * 0.4))
      });
    }

    function drawTaperedTracerBeam(targetCtx, start, end, seed, now, options = {}) {
      const alpha = clamp(Number(options.alpha) || 1, 0, 1);
      if (!targetCtx || alpha <= 0) {
        return;
      }
      const widthPx = Math.max(2, Number(options.widthPx) || 8);
      const outerGlowColor = options.outerGlowColor || [246, 196, 116];
      const coreColor = options.coreColor || [244, 234, 212];
      const hotColor = options.hotColor || [255, 252, 244];
      const streakColor = options.streakColor || [255, 221, 148];
      const sparkCount = Math.max(0, Math.floor(Number(options.sparkCount) || 10));
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const dirX = dx / length;
      const dirY = dy / length;
      const perpX = -dirY;
      const perpY = dirX;

      targetCtx.save();
      targetCtx.globalCompositeOperation = "lighter";
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";

      targetCtx.strokeStyle = `rgba(${outerGlowColor[0]}, ${outerGlowColor[1]}, ${outerGlowColor[2]}, ${(0.28 * alpha).toFixed(3)})`;
      targetCtx.lineWidth = widthPx * 1.8;
      targetCtx.beginPath();
      targetCtx.moveTo(start.x, start.y);
      targetCtx.lineTo(end.x, end.y);
      targetCtx.stroke();

      const gradient = targetCtx.createLinearGradient(start.x, start.y, end.x, end.y);
      gradient.addColorStop(0, `rgba(${coreColor[0]}, ${coreColor[1]}, ${coreColor[2]}, ${(0.78 * alpha).toFixed(3)})`);
      gradient.addColorStop(0.55, `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.96 * alpha).toFixed(3)})`);
      gradient.addColorStop(1, `rgba(${coreColor[0]}, ${coreColor[1]}, ${coreColor[2]}, ${(0.78 * alpha).toFixed(3)})`);
      targetCtx.strokeStyle = gradient;
      targetCtx.lineWidth = widthPx * 0.7;
      targetCtx.beginPath();
      targetCtx.moveTo(start.x, start.y);
      targetCtx.lineTo(end.x, end.y);
      targetCtx.stroke();

      targetCtx.strokeStyle = `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.98 * alpha).toFixed(3)})`;
      targetCtx.lineWidth = Math.max(1.1, widthPx * 0.18);
      targetCtx.beginPath();
      targetCtx.moveTo(start.x, start.y);
      targetCtx.lineTo(end.x, end.y);
      targetCtx.stroke();

      for (let i = 0; i < sparkCount; i += 1) {
        const t = (seededUnit(seed, 410 + i * 17) + now * 0.00042) % 1;
        const baseX = start.x + dx * t;
        const baseY = start.y + dy * t;
        const drift = (seededUnit(seed, 430 + i * 19) - 0.5) * widthPx * 1.6;
        const px = baseX + perpX * drift;
        const py = baseY + perpY * drift;
        const tail = 3 + seededUnit(seed, 450 + i * 11) * 5;
        targetCtx.strokeStyle = `rgba(${streakColor[0]}, ${streakColor[1]}, ${streakColor[2]}, ${(0.34 + seededUnit(seed, 470 + i * 7) * 0.4 * alpha).toFixed(3)})`;
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.moveTo(px - dirX * tail * 0.35, py - dirY * tail * 0.35);
        targetCtx.lineTo(px + dirX * tail, py + dirY * tail);
        targetCtx.stroke();
      }

      if (options.arrowHead !== false) {
        targetCtx.save();
        targetCtx.translate(end.x, end.y);
        targetCtx.rotate(Math.atan2(dy, dx));
        targetCtx.fillStyle = `rgba(${hotColor[0]}, ${hotColor[1]}, ${hotColor[2]}, ${(0.96 * alpha).toFixed(3)})`;
        targetCtx.beginPath();
        targetCtx.moveTo(widthPx * 1.1, 0);
        targetCtx.lineTo(-widthPx * 0.1, -widthPx * 0.45);
        targetCtx.lineTo(widthPx * 0.22, 0);
        targetCtx.lineTo(-widthPx * 0.1, widthPx * 0.45);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.restore();
      }

      targetCtx.restore();
    }

    function getAreaEffectSpriteFrame(effect, frameNow, areaHook = "") {
      const abilityId = String(effect && effect.abilityId || "").toLowerCase();
      const normalizedHook = String(areaHook || "").trim().toLowerCase();
      if (String(effect && effect.kind || "") === "beam") {
        return null;
      }
      if (normalizedHook === "ricochet_shot" || abilityId.includes("ricochet")) {
        return getTracerAreaEffectSpriteFrame(effect, "ricochet", frameNow);
      }
      if (normalizedHook === "piercing_bolt" || abilityId.includes("piercing")) {
        return getTracerAreaEffectSpriteFrame(effect, "piercing", frameNow);
      }
      const radiusPx = Math.max(6, (Number(effect && effect.radius) || 1) * tileSize);
      const roundedRadius = Math.max(6, Math.round(radiusPx));
      const phaseBucket = Math.floor((Number(frameNow) || 0) / 90) % 6;
      const visual = getAreaEffectVisualConfig(effect);
      const summonCount = Math.max(1, Math.round(Number(effect && effect.summonCount) || 1));
      const formationRadius = Math.max(0, Number(effect && effect.formationRadius) || 0.9);
      const key = [
        String(effect && effect.kind || "area"),
        String(effect && effect.abilityId || ""),
        roundedRadius,
        phaseBucket,
        summonCount,
        Math.round(formationRadius * 100)
      ].join("|");
      const cached = areaEffectCanvasCache.get(key);
      if (cached) {
        return cached;
      }
      const padding = 20;
      const size = roundedRadius * 2 + padding * 2;
      const canvas = createRuntimeCanvas(size, size);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const cx = size * 0.5;
      const cy = size * 0.5;
      const phase = phaseBucket / 6;
      const pulse = 0.92 + Math.sin(phase * Math.PI * 2) * 0.06;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phase * Math.PI * 2 * 0.08);
      if (normalizedHook === "blizzard" || abilityId.includes("blizzard")) {
        ctx.restore();
        drawDetailedBlizzardTexture(ctx, size, roundedRadius, phaseBucket);
      } else if (normalizedHook === "rain_of_arrows" || abilityId.includes("rain")) {
        ctx.restore();
        drawDetailedRainTexture(ctx, size, roundedRadius, phaseBucket);
      } else if (normalizedHook === "caltrops" || abilityId.includes("caltrop")) {
        ctx.restore();
        drawDetailedCaltropsTexture(ctx, size, roundedRadius);
      } else if (
        String(effect && effect.kind || "") === "summon" &&
        (
          normalizedHook === "fire_hydra" ||
          normalizedHook === "ballista_nest" ||
          abilityId.includes("hydra") ||
          abilityId.includes("ballista")
        )
      ) {
        ctx.restore();
        drawDetailedSummonTexture(ctx, size, roundedRadius, effect, phaseBucket);
      } else {
        ctx.fillStyle = visual.fill;
        ctx.strokeStyle = visual.stroke;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14;
        ctx.shadowColor = visual.glow;
        ctx.beginPath();
        ctx.arc(0, 0, roundedRadius * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.78;
        if (visual.kind === "frost" || visual.kind === "arcane" || visual.kind === "lightning") {
          for (let i = 0; i < 6; i += 1) {
            const a = phase * Math.PI * 2 + i * ((Math.PI * 2) / 6);
            const r = roundedRadius * (0.54 + (i % 2) * 0.08);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5));
            ctx.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
            ctx.stroke();
          }
        } else if (visual.kind === "poison" || visual.kind === "rain") {
          for (let i = 0; i < 18; i += 1) {
            const a = i * ((Math.PI * 2) / 18) + phase * 0.6;
            const r = roundedRadius * 0.88;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = visual.stroke;
            ctx.fill();
          }
        } else {
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          ctx.arc(0, 0, roundedRadius * 0.74, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (String(effect && effect.kind || "") === "summon" && globalScope.VibeSummonLayout && typeof globalScope.VibeSummonLayout.computeSummonFormationPositions === "function") {
          const positions = globalScope.VibeSummonLayout.computeSummonFormationPositions(
            0,
            0,
            summonCount,
            formationRadius
          );
          ctx.fillStyle = visual.stroke;
          for (const point of positions) {
            const px = point.x * tileSize;
            const py = point.y * tileSize;
            ctx.beginPath();
            ctx.arc(px, py, 5 + Math.sin(phase * Math.PI * 2 + point.index) * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      const result = { canvas, rotation: 0 };
      areaEffectCanvasCache.set(key, result);
      return result;
    }

    function getBeamAreaEffectSpriteFrame(effect, frameNow, areaHook = "") {
      const normalizedHook = String(areaHook || "").trim().toLowerCase();
      const resolvedHook = normalizedHook === "arcane_beam" ? "arcane_beam" : "lightning_beam";
      const endpoints = resolveBeamWorldEndpoints(effect);
      const startWorldX = endpoints.startX + 0.5;
      const startWorldY = endpoints.startY + 0.5;
      const endWorldX = endpoints.endX + 0.5;
      const endWorldY = endpoints.endY + 0.5;
      const deltaXPx = (endWorldX - startWorldX) * tileSize;
      const deltaYPx = (endWorldY - startWorldY) * tileSize;
      const widthTiles = Math.max(
        0.2,
        Number(effect && effect.width) || (resolvedHook === "arcane_beam" ? 0.8 : 0.6)
      );
      const beamWidthPx = Math.max(3, widthTiles * tileSize);
      const padding = Math.max(26, Math.ceil(beamWidthPx * (resolvedHook === "arcane_beam" ? 3.2 : 3.4)));
      const canvasWidth = Math.max(1, Math.ceil(Math.abs(deltaXPx) + padding * 2));
      const canvasHeight = Math.max(1, Math.ceil(Math.abs(deltaYPx) + padding * 2));
      const runtimeKey = `beam:${resolvedHook}:${String(effect && effect.id || `${effect && effect.abilityId || ""}:${effect && effect.startedAt || 0}`)}`;
      const canvas = getDynamicAreaEffectCanvas(runtimeKey, canvasWidth, canvasHeight, frameNow, runtimeKey);
      if (!canvas) {
        return null;
      }
      const targetCtx = canvas.getContext("2d");
      if (!targetCtx) {
        return null;
      }
      targetCtx.clearRect(0, 0, canvas.width, canvas.height);
      const start = {
        x: padding + Math.max(0, -deltaXPx),
        y: padding + Math.max(0, -deltaYPx)
      };
      const end = {
        x: start.x + deltaXPx,
        y: start.y + deltaYPx
      };
      if (resolvedHook === "arcane_beam") {
        drawArcaneBeamTexture(targetCtx, effect, start, end, frameNow, beamWidthPx);
      } else {
        drawLightningBeamTexture(targetCtx, effect, start, end, frameNow, beamWidthPx, endpoints.lengthTiles);
      }
      return {
        canvas,
        rotation: 0,
        alpha: 1,
        dynamic: true,
        centerWorldX: (startWorldX + endWorldX) * 0.5,
        centerWorldY: (startWorldY + endWorldY) * 0.5
      };
    }

    function getExplosionSpriteFrame(explosionView) {
      const abilityId = String(explosionView && explosionView.abilityId || "").toLowerCase();
      const radiusPx = Math.max(6, (Number(explosionView && explosionView.radius) || 1) * tileSize);
      const roundedRadius = Math.max(6, Math.round(radiusPx));
      const phaseBucket = clamp(Math.floor((Number(explosionView && explosionView.progress) || 0) * 6), 0, 5);
      const key = `explosion:${abilityId}:${roundedRadius}:${phaseBucket}`;
      const cached = areaEffectCanvasCache.get(key);
      if (cached) {
        return cached;
      }
      const size = roundedRadius * 2 + 20;
      const canvas = createRuntimeCanvas(size, size);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const cx = size * 0.5;
      const cy = size * 0.5;
      const progress = phaseBucket / 5;
      const ringRadius = roundedRadius * (0.25 + progress * 0.85);
      const alpha = 1 - progress;
      if (abilityId === "warstomp") {
        ctx.save();
        ctx.globalAlpha = 0.9 * alpha;
        ctx.strokeStyle = "rgba(222, 243, 255, 0.92)";
        ctx.lineWidth = Math.max(1.4, 3.6 * (1 - progress));
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.42 * alpha;
        ctx.strokeStyle = "rgba(112, 193, 248, 0.85)";
        ctx.lineWidth = Math.max(1, 2.4 * (1 - progress));
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 10; i += 1) {
          const a = (Math.PI * 2 * i) / 10 + progress * 0.8;
          const inner = ringRadius * 0.15;
          const outer = ringRadius * 0.95;
          ctx.globalAlpha = 0.5 * alpha;
          ctx.strokeStyle = "rgba(180, 225, 255, 0.72)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
          ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
          ctx.stroke();
        }
        ctx.restore();
      } else if (abilityId === "charge") {
        ctx.save();
        // Outer shockwave ring
        ctx.globalAlpha = 0.85 * alpha;
        ctx.strokeStyle = "rgba(255, 220, 140, 0.95)";
        ctx.lineWidth = Math.max(1.6, 4.2 * (1 - progress));
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Inner impact ring
        ctx.globalAlpha = 0.5 * alpha;
        ctx.strokeStyle = "rgba(255, 180, 80, 0.88)";
        ctx.lineWidth = Math.max(1.2, 2.8 * (1 - progress));
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        // Radial impact lines
        for (let i = 0; i < 12; i += 1) {
          const a = (Math.PI * 2 * i) / 12 + progress * 0.6;
          const inner = ringRadius * 0.2;
          const outer = ringRadius * 0.9;
          ctx.globalAlpha = 0.55 * alpha;
          ctx.strokeStyle = "rgba(255, 200, 100, 0.78)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
          ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
          ctx.stroke();
        }
        // Dust particles
        ctx.globalAlpha = 0.35 * alpha;
        ctx.fillStyle = "rgba(200, 180, 150, 0.65)";
        for (let i = 0; i < 8; i += 1) {
          const particleAngle = (Math.PI * 2 * i) / 8 + progress * 1.2;
          const particleDist = ringRadius * (0.4 + (i % 3) * 0.15);
          const particleSize = 1.8 + (i % 4) * 0.4;
          ctx.beginPath();
          ctx.arc(
            cx + Math.cos(particleAngle) * particleDist,
            cy + Math.sin(particleAngle) * particleDist,
            particleSize,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.restore();
      } else if (abilityId === "blink") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const blinkGradient = ctx.createRadialGradient(cx, cy, ringRadius * 0.12, cx, cy, ringRadius);
        blinkGradient.addColorStop(0, `rgba(240, 226, 255, ${(0.75 * alpha).toFixed(3)})`);
        blinkGradient.addColorStop(0.55, `rgba(170, 126, 255, ${(0.46 * alpha).toFixed(3)})`);
        blinkGradient.addColorStop(1, "rgba(118, 75, 245, 0)");
        ctx.fillStyle = blinkGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.78 * alpha;
        ctx.strokeStyle = "rgba(209, 188, 255, 0.94)";
        ctx.lineWidth = Math.max(1.1, 2.8 * (1 - progress));
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.5 * alpha;
        const gradient = ctx.createRadialGradient(cx, cy, ringRadius * 0.2, cx, cy, ringRadius);
        gradient.addColorStop(0, "rgba(255, 230, 140, 0.95)");
        gradient.addColorStop(0.45, "rgba(255, 132, 56, 0.82)");
        gradient.addColorStop(1, "rgba(255, 52, 28, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85 * alpha;
        ctx.strokeStyle = "rgba(255, 240, 190, 0.9)";
        ctx.lineWidth = Math.max(1.2, 3.2 * (1 - progress));
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const result = { canvas, rotation: 0, alpha: clamp(Number(explosionView && explosionView.alpha) || 1, 0, 1) };
      areaEffectCanvasCache.set(key, result);
      return result;
    }

    function getGenericPlayerSpriteFrame(player, isSelf) {
      const classType = String(player && player.classType || "").toLowerCase();
      const key = `player:${classType}:${isSelf ? "self" : "other"}`;
      const cached = genericCanvasCache.get(key);
      if (cached) {
        return cached;
      }
      const canvas = createRuntimeCanvas(42, 54);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const bodyColor = sanitizeCssColor(
        classType === "mage" ? "#6ab6ff" : classType === "ranger" ? "#74d68e" : classType === "warrior" ? "#cbd5e1" : "#dbe7f2"
      ) || "#dbe7f2";
      ctx.fillStyle = "rgba(16,24,39,0.45)";
      ctx.beginPath();
      ctx.ellipse(21, 43, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#06131d";
      ctx.lineWidth = 2;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(21, 15, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(15, 21, 12, 17, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(13, 27); ctx.lineTo(29, 27);
      ctx.moveTo(18, 38); ctx.lineTo(15, 46);
      ctx.moveTo(24, 38); ctx.lineTo(27, 46);
      ctx.stroke();
      if (isSelf) {
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(21, 15, 8.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      const frame = { canvas, rotation: 0 };
      genericCanvasCache.set(key, frame);
      return frame;
    }

    function getGenericMobSpriteFrame(mob) {
      const kind = getMobKind(mob);
      if (kind === "creeper" && getCreeperWalkSprite) {
        const sprite = getCreeperWalkSprite(mob);
        if (sprite && sprite.width > 0 && sprite.height > 0) {
          return {
            canvas: sprite,
            rotation: 0,
            scaleX: mobSpriteSize / sprite.width,
            scaleY: mobSpriteSize / sprite.height
          };
        }
      }
      if (kind === "spider" && getSpiderWalkSprite) {
        const sprite = getSpiderWalkSprite(mob);
        if (sprite && sprite.width > 0 && sprite.height > 0) {
          return {
            canvas: sprite,
            rotation: 0,
            scaleX: mobSpriteSize / sprite.width,
            scaleY: mobSpriteSize / sprite.height
          };
        }
      }
      const key = `mob:${kind}`;
      const cached = genericCanvasCache.get(key);
      if (cached) {
        return cached;
      }
      const canvas = createRuntimeCanvas(44, 50);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      if (kind === "creeper") {
        ctx.fillStyle = "rgba(16,24,39,0.40)";
        ctx.beginPath();
        ctx.ellipse(22, 40, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2;
        ctx.fillStyle = "#f6f5ef";
        ctx.beginPath();
        ctx.roundRect(12, 10, 20, 24, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e84444";
        ctx.fillRect(17, 20, 10, 7);
        const frame = { canvas, rotation: 0 };
        genericCanvasCache.set(key, frame);
        return frame;
      }
      const fillColor = sanitizeCssColor(
        kind === "zombie" ? "#79bf56" :
        kind === "skeleton" || kind === "skeleton_archer" ? "#e7edf5" :
        kind === "orc" ? "#5fa24a" : "#c2d3df"
      ) || "#c2d3df";
      ctx.fillStyle = "rgba(16,24,39,0.40)";
      ctx.beginPath();
      ctx.ellipse(22, 41, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0d1621";
      ctx.lineWidth = 2;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(22, 15, kind === "orc" ? 8 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, 24); ctx.lineTo(28, 24);
      ctx.moveTo(19, 24); ctx.lineTo(16, 34);
      ctx.moveTo(25, 24); ctx.lineTo(28, 34);
      ctx.stroke();
      if (kind === "skeleton_archer") {
        ctx.strokeStyle = "#8d6d48";
        ctx.beginPath();
        ctx.arc(31, 16, 7, -1.05, 1.05);
        ctx.stroke();
      } else if (kind === "skeleton") {
        ctx.strokeStyle = "#e8eef6";
        ctx.beginPath();
        ctx.moveTo(29, 15); ctx.lineTo(35, 8);
        ctx.stroke();
      } else if (kind === "orc") {
        ctx.strokeStyle = "#d3dbe7";
        ctx.beginPath();
        ctx.moveTo(14, 15); ctx.lineTo(8, 8);
        ctx.moveTo(30, 15); ctx.lineTo(36, 8);
        ctx.stroke();
      }
      const frame = { canvas, rotation: 0 };
      genericCanvasCache.set(key, frame);
      return frame;
    }

    function getGenericProjectileSpriteFrame(projectile, frameNow) {
      const color = getProjectileColor(projectile);
      const pulseBucket = Math.floor((Number(frameNow) || 0) / 50) % 4;
      const key = `projectile:${color}:${pulseBucket}`;
      const cached = genericCanvasCache.get(key);
      if (cached) {
        return cached;
      }
      const canvas = createRuntimeCanvas(22, 22);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const colorHex = `#${(color >>> 0).toString(16).padStart(6, "0")}`;
      const glowRadius = 6.6 + pulseBucket * 0.45;
      const gradient = ctx.createRadialGradient(11, 11, 0, 11, 11, glowRadius);
      gradient.addColorStop(0, `${colorHex}`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(11, 11, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(11, 11, 3.5, 0, Math.PI * 2);
      ctx.fill();
      const frame = { canvas, rotation: 0 };
      genericCanvasCache.set(key, frame);
      return frame;
    }

    function getVendorSpriteFrame() {
      if (getVendorNpcSprite) {
        const vendorSprite = getVendorNpcSprite();
        if (vendorSprite && vendorSprite.width > 0 && vendorSprite.height > 0) {
          return {
            canvas: vendorSprite,
            rotation: 0
          };
        }
      }
      const key = "vendor";
      const cached = genericCanvasCache.get(key);
      if (cached) {
        return cached;
      }
      const canvas = createRuntimeCanvas(38, 46);
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.fillStyle = "rgba(16,24,39,0.40)";
      ctx.beginPath();
      ctx.ellipse(19, 37, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6c3e22";
      ctx.beginPath();
      ctx.arc(19, 12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9b5d30";
      ctx.fillRect(13, 20, 12, 13);
      ctx.fillStyle = "#e4c45e";
      ctx.beginPath();
      ctx.arc(25, 18, 3, 0, Math.PI * 2);
      ctx.fill();
      const frame = { canvas, rotation: 0 };
      genericCanvasCache.set(key, frame);
      return frame;
    }

    function getQuestNpcSpriteFrame() {
      if (getQuestNpcSprite) {
        const questNpcSprite = getQuestNpcSprite();
        if (questNpcSprite && questNpcSprite.width > 0 && questNpcSprite.height > 0) {
          return {
            canvas: questNpcSprite,
            rotation: 0
          };
        }
      }
      return null;
    }


    function drawPlayerGraphic(graphics, player, isSelf) {
      const classType = String(player && player.classType || "").toLowerCase();
      const bodyColor = classColors[classType] || 0xdbe7f2;
      graphics.clear();
      graphics.beginFill(0x101827, 0.45);
      graphics.drawEllipse(0, 9, 7.5, 3.5);
      graphics.endFill();
      graphics.lineStyle(2, 0x06131d, 1);
      graphics.beginFill(bodyColor, 1);
      graphics.drawCircle(0, -8, 5.5);
      graphics.drawRoundedRect(-5.5, -2.5, 11, 15, 4);
      graphics.endFill();
      graphics.lineStyle(2, 0x06131d, 1);
      graphics.moveTo(-8, 2);
      graphics.lineTo(8, 2);
      graphics.moveTo(-2.5, 12);
      graphics.lineTo(-5.5, 19);
      graphics.moveTo(2.5, 12);
      graphics.lineTo(5.5, 19);
      if (classType === "mage") {
        graphics.beginFill(0x1b2c4e, 1);
        graphics.moveTo(-7, -8);
        graphics.lineTo(0, -18);
        graphics.lineTo(7, -8);
        graphics.endFill();
      } else if (classType === "ranger") {
        graphics.lineStyle(2, 0x9a6b3a, 1);
        graphics.arc(7, -1, 7, -1.05, 1.05);
        graphics.moveTo(7, -8);
        graphics.lineTo(7, 6);
      } else {
        graphics.lineStyle(2, 0xe8eef6, 1);
        graphics.moveTo(8, -5);
        graphics.lineTo(14, -13);
        graphics.moveTo(-8, -4);
        graphics.lineTo(-13, 2);
      }
      if (isSelf) {
        graphics.lineStyle(1.5, 0xb8d4ec, 1);
        graphics.drawCircle(0, -8, 8.5);
      }
    }

    function drawMobGraphic(graphics, mob) {
      const kind = getMobKind(mob);
      graphics.clear();
      if (kind === "creeper") {
        graphics.lineStyle(2, 0x183222, 1);
        graphics.beginFill(0xf4f7fb, 1);
        graphics.drawRoundedRect(-8, -10, 16, 20, 3);
        graphics.endFill();
        graphics.beginFill(0xe84444, 0.9);
        graphics.drawRect(-4, -2, 8, 6);
        graphics.endFill();
        return;
      }
      if (kind === "spider") {
        graphics.lineStyle(2, 0x111827, 1);
        graphics.beginFill(0x7b536c, 1);
        graphics.drawEllipse(0, 0, 7.5, 6);
        graphics.endFill();
        for (let i = -1; i <= 1; i += 2) {
          for (let j = 0; j < 4; j += 1) {
            const y = -5 + j * 3.5;
            graphics.moveTo(i * 4, y);
            graphics.lineTo(i * (11 + j), y + i * (j - 1));
          }
        }
        return;
      }
      const bodyColor =
        kind === "zombie"
          ? 0x79bf56
          : kind === "skeleton" || kind === "skeleton_archer"
            ? 0xe7edf5
            : kind === "orc"
              ? 0x5fa24a
              : 0xc2d3df;
      graphics.lineStyle(2, 0x0d1621, 1);
      graphics.beginFill(bodyColor, 1);
      graphics.drawCircle(0, -4, kind === "orc" ? 8 : 7);
      graphics.endFill();
      graphics.moveTo(-6, 4);
      graphics.lineTo(6, 4);
      graphics.moveTo(-2.5, 4);
      graphics.lineTo(-5, 12);
      graphics.moveTo(2.5, 4);
      graphics.lineTo(5, 12);
      if (kind === "skeleton_archer") {
        graphics.lineStyle(2, 0x9a6b3a, 1);
        graphics.arc(8, 0, 7, -1.05, 1.05);
      } else if (kind === "skeleton") {
        graphics.lineStyle(2, 0xe8eef6, 1);
        graphics.moveTo(7, -4);
        graphics.lineTo(12, -11);
      } else if (kind === "orc") {
        graphics.lineStyle(2, 0xd3dbe7, 1);
        graphics.moveTo(-8, -4);
        graphics.lineTo(-14, -11);
        graphics.moveTo(8, -4);
        graphics.lineTo(14, -11);
      }
    }

    function drawProjectileGraphic(graphics, projectile, frameNow) {
      const color = getProjectileColor(projectile);
      const pulse = 0.86 + Math.sin(frameNow * 0.012 + (Number(projectile.id) || 0)) * 0.14;
      graphics.clear();
      graphics.beginFill(color, 0.18 * pulse);
      graphics.drawCircle(0, 0, 7);
      graphics.endFill();
      graphics.lineStyle(2, color, 1);
      graphics.beginFill(color, 0.92);
      graphics.drawCircle(0, 0, 3.4);
      graphics.endFill();
    }

    function drawLootGraphic(graphics, bag, frameNow) {
      const pulse = 0.9 + Math.sin(frameNow * 0.009 + (Number(bag.id) || 0)) * 0.1;
      graphics.clear();
      graphics.lineStyle(2, 0x4d3016, 1);
      graphics.beginFill(0x8c5b2a, 1);
      graphics.drawRoundedRect(-8, -7, 16, 14, 5);
      graphics.endFill();
      graphics.beginFill(0xe4c45e, 0.9);
      graphics.drawCircle(-4, -8, 1.3 * pulse);
      graphics.drawCircle(3, -11, 1.1 * pulse);
      graphics.drawCircle(6, -6, 0.95 * pulse);
      graphics.endFill();
    }

    function updateSpriteNode(node, x, y, spriteFrame, drawFallback) {
      node.container.position.set(x, y);
      if (spriteFrame && spriteFrame.canvas) {
        const texture = getTextureFromCanvas(spriteFrame.canvas, "linear", !!spriteFrame.dynamic);
        if (texture) {
          node.graphics.clear();
          node.sprite.visible = true;
          node.sprite.texture = texture;
          node.sprite.rotation = Number(spriteFrame.rotation) || 0;
          node.sprite.scale.set(1, 1);
          return;
        }
      }
      node.sprite.visible = false;
      if (typeof drawFallback === "function") {
        drawFallback(node.graphics);
      } else {
        node.graphics.clear();
      }
    }

    function updateSprite(sprite, x, y, spriteFrame, options = null) {
      const samplingMode =
        options && String(options.samplingMode || "").trim().toLowerCase() === "nearest" ? "nearest" : "linear";
      const texture =
        spriteFrame && spriteFrame.canvas
          ? getTextureFromCanvas(spriteFrame.canvas, samplingMode, !!spriteFrame.dynamic)
          : null;
      if (!texture) {
        sprite.visible = false;
        sprite.texture = PIXI.Texture.EMPTY;
        return false;
      }
      sprite.visible = true;
      sprite.texture = texture;
      sprite.position.set(x, y);
      sprite.rotation = Number(spriteFrame.rotation) || 0;
      sprite.scale.set(
        Math.max(0.001, Number(spriteFrame.scaleX) || 1),
        Math.max(0.001, Number(spriteFrame.scaleY) || 1)
      );
      sprite.alpha = Math.max(0, Math.min(1, Number(spriteFrame.alpha) || 1));
      sprite.roundPixels = samplingMode === "nearest";
      return true;
    }

    function updateLabeledNode(node, x, y, label, hp, maxHp, drawFn, overlayOptions = null) {
      node.container.position.set(x, y);
      drawFn(node.graphics);
      node.nameText.text = label;
      node.nameText.visible = !!label;
      node.nameText.position.set(0, Number(overlayOptions && overlayOptions.labelOffsetY) || -18);
      node.hpBack.clear();
      node.hpFill.clear();
      const currentHp = Number(hp) || 0;
      const totalHp = Math.max(1, Number(maxHp) || 1);
      if (currentHp < totalHp) {
        const hpOffsetY = Number(overlayOptions && overlayOptions.hpOffsetY) || -30;
        node.hpBack.beginFill(0x09111a, 0.84);
        node.hpBack.drawRoundedRect(-11, hpOffsetY, 22, 4, 2);
        node.hpBack.endFill();
        node.hpFill.beginFill(0x64d37a, 1);
        node.hpFill.drawRoundedRect(-11, hpOffsetY, Math.max(0, (currentHp / totalHp) * 22), 4, 2);
        node.hpFill.endFill();
      }
    }

    function drawStatusEffectGraphics(graphics, x, y, statusVisual, frameNow, isPlayer) {
      graphics.clear();
      if (!statusVisual) {
        return;
      }
      const pulse = 0.6 + Math.sin(frameNow * 0.016 + (Number(statusVisual.phaseSeed) || 0)) * 0.4;
      if (statusVisual.bloodWrathActive) {
        const wrathPulse = 0.58 + Math.sin(frameNow * 0.012 + (Number(statusVisual.phaseSeed) || 0) * 0.17) * 0.42;
        const auraRadius = (isPlayer ? 13.5 : 15.5) + wrathPulse * (isPlayer ? 1.8 : 2.1);
        const swirlRadius = (isPlayer ? 8.5 : 10.5) + wrathPulse * (isPlayer ? 1.4 : 1.7);
        graphics.beginFill(0xe85c4c, (0.22 + wrathPulse * 0.14) * 0.42);
        graphics.drawCircle(x, y + 1, auraRadius);
        graphics.endFill();
        graphics.lineStyle(isPlayer ? 1.5 : 1.7, 0xff8a76, 0.55);
        for (let i = 0; i < 3; i += 1) {
          const start = frameNow * 0.006 + i * ((Math.PI * 2) / 3) + (Number(statusVisual.phaseSeed) || 0) * 0.09;
          for (let step = 0; step <= 16; step += 1) {
            const t = step / 16;
            const angle = start + t * 1.85;
            const radius = 4.5 + t * swirlRadius;
            const px = x + Math.cos(angle) * radius;
            const py = y + 2 + Math.sin(angle) * (radius * 0.48) - t * (isPlayer ? 5.5 : 6.2);
            if (step === 0) {
              graphics.moveTo(px, py);
            } else {
              graphics.lineTo(px, py);
            }
          }
        }
      }
      if (statusVisual.slowActive) {
        const strength = clamp(1 - (Number(statusVisual.slowMultiplier) || 1), 0, 1);
        const alpha = clamp(0.16 + strength * 0.28, 0.12, 0.42) * (0.75 + pulse * 0.25);
        const radius = (isPlayer ? 14 : 16.5) + strength * (isPlayer ? 3 : 3.5);
        graphics.beginFill(0x72c2ff, alpha * 0.42);
        graphics.drawCircle(x, y, radius);
        graphics.endFill();
        graphics.lineStyle(1.2, 0x9addff, clamp(0.2 + strength * 0.25, 0.18, 0.45));
        for (let i = 0; i < 3; i += 1) {
          const a0 = frameNow * 0.005 + i * ((Math.PI * 2) / 3);
          graphics.arc(x, y, 8 + i * 3.4, a0, a0 + Math.PI * 0.65);
        }
      }
      if (statusVisual.burnActive) {
        const burnPulse = 0.58 + Math.sin(frameNow * 0.019 + (Number(statusVisual.phaseSeed) || 0)) * 0.42;
        const alpha = 0.26 + burnPulse * 0.2;
        const radius = (isPlayer ? 12 : 14) + burnPulse * (isPlayer ? 2.2 : 2.5);
        graphics.beginFill(0xff9945, alpha * 0.38);
        graphics.drawCircle(x, y + 1, radius);
        graphics.endFill();
        graphics.lineStyle(1.1, 0xffbe62, 0.55);
        for (let i = 0; i < 5; i += 1) {
          const a = frameNow * 0.006 + i * ((Math.PI * 2) / 5) + (Number(statusVisual.phaseSeed) || 0) * 0.3;
          const up = 9 + (i % 2) * 3;
          const fx = x + Math.cos(a) * (5 + i * 0.7);
          const fy = y - 2 - Math.sin(a * 1.3) * 2.4;
          graphics.moveTo(fx, fy + 4);
          graphics.quadraticCurveTo(fx + 1.6, fy - up * 0.3, fx, fy - up);
          graphics.quadraticCurveTo(fx - 1.4, fy - up * 0.35, fx, fy + 4);
        }
      }
      if (statusVisual.stunActive) {
        const centerY = y - (isPlayer ? 18 : 22);
        const t = frameNow * 0.0065;
        graphics.lineStyle(isPlayer ? 1.4 : 1.6, 0xf3fcff, 0.92);
        for (let i = 0; i < 3; i += 1) {
          const a = t + i * ((Math.PI * 2) / 3);
          const baseX = x + Math.cos(a) * (isPlayer ? 7 : 8);
          const baseY = centerY + Math.sin(a) * (isPlayer ? 3.2 : 3.5);
          for (let s = 0; s <= 20; s += 1) {
            const u = s / 20;
            const ang = a + u * Math.PI * 2.2;
            const r = (isPlayer ? 2.2 : 2.6) * (1 - u);
            const px = baseX + Math.cos(ang) * r;
            const py = baseY + Math.sin(ang) * r;
            if (s === 0) {
              graphics.moveTo(px, py);
            } else {
              graphics.lineTo(px, py);
            }
          }
        }
      }
    }

    function updateLabeledSpriteNode(node, x, y, label, hp, maxHp, spriteFrame, drawFallback, overlayOptions = null) {
      node.container.position.set(x, y);
      if (spriteFrame && spriteFrame.canvas) {
        const texture = getTextureFromCanvas(spriteFrame.canvas, "linear", !!spriteFrame.dynamic);
        if (texture) {
          node.graphics.clear();
          node.sprite.visible = true;
          node.sprite.texture = texture;
          node.sprite.rotation = Number(spriteFrame.rotation) || 0;
          node.sprite.scale.set(
            Math.max(0.001, Number(spriteFrame.scaleX) || 1),
            Math.max(0.001, Number(spriteFrame.scaleY) || 1)
          );
        } else {
          node.sprite.visible = false;
          drawFallback(node.graphics);
        }
      } else {
        node.sprite.visible = false;
        drawFallback(node.graphics);
      }
      node.nameText.text = label;
      node.nameText.visible = !!label;
      node.nameText.position.set(0, Number(overlayOptions && overlayOptions.labelOffsetY) || -18);
      node.hpBack.clear();
      node.hpFill.clear();
      node.castBack.clear();
      node.castFill.clear();
      drawStatusEffectGraphics(node.effectGraphics, 0, 0, overlayOptions && overlayOptions.statusVisual, Number(overlayOptions && overlayOptions.frameNow) || 0, !!(overlayOptions && overlayOptions.isPlayer));
      const currentHp = Number(hp) || 0;
      const totalHp = Math.max(1, Number(maxHp) || 1);
      if (overlayOptions && overlayOptions.showHpBar && currentHp < totalHp) {
        const hpOffsetY = Number(overlayOptions && overlayOptions.hpOffsetY) || -30;
        node.hpBack.beginFill(0x09111a, 0.84);
        node.hpBack.drawRoundedRect(-11, hpOffsetY, 22, 4, 2);
        node.hpBack.endFill();
        node.hpFill.beginFill(0x64d37a, 1);
        node.hpFill.drawRoundedRect(-11, hpOffsetY, Math.max(0, (currentHp / totalHp) * 22), 4, 2);
        node.hpFill.endFill();
      }
      const castVisual = overlayOptions && overlayOptions.castVisual;
      if (castVisual && Number(castVisual.ratio) > 0) {
        const width = overlayOptions && overlayOptions.isPlayer ? 34 : 30;
        const height = overlayOptions && overlayOptions.isPlayer ? 5 : 4;
        const x0 = -width / 2;
        const y0 = overlayOptions && overlayOptions.isPlayer ? 20 : 17;
        const fillWidth = Math.round(width * clamp(Number(castVisual.ratio) || 0, 0, 1));
        node.castBack.beginFill(0x040a12, 0.9);
        node.castBack.drawRect(x0, y0, width, height);
        node.castBack.endFill();
        node.castBack.lineStyle(1, 0xb5e4ff, overlayOptions && overlayOptions.isPlayer ? 0.7 : 0.76);
        node.castBack.drawRect(x0 - 0.5, y0 - 0.5, width + 1, height + 1);
        node.castFill.beginFill(overlayOptions && overlayOptions.isPlayer ? 0x3fadff : 0x75ccff, 0.95);
        node.castFill.drawRect(x0, y0, fillWidth, height);
        node.castFill.endFill();
      }
    }

    function getFloatingDamageTextNode(pool, parentContainer) {
      const node = Array.isArray(pool) && pool.length ? pool.pop() : new PIXI.Text("", {
        fontFamily: "Segoe UI",
        fontSize: 15,
        fontWeight: "700",
        fill: 0xffd36b,
        stroke: 0x0e121b,
        strokeThickness: 3
      });
      node.anchor.set(0.5, 0.5);
      node.visible = true;
      if (node.parent !== parentContainer) {
        if (node.parent) {
          node.parent.removeChild(node);
        }
        parentContainer.addChild(node);
      }
      return node;
    }

    function releaseFloatingDamageTextNode(pool, node) {
      if (!node) {
        return;
      }
      if (node.parent) {
        node.parent.removeChild(node);
      }
      node.visible = false;
      pool.push(node);
    }

    function syncFloatingDamageTexts(frameViewModel, cameraX, cameraY, width, height) {
      while (activeFloatingDamageTexts.length) {
        releaseFloatingDamageTextNode(floatingDamageTextPool, activeFloatingDamageTexts.pop());
      }
      const entries = Array.isArray(frameViewModel.floatingDamageViews) ? frameViewModel.floatingDamageViews : [];
      for (const entry of entries) {
        const progress = clamp(Number(entry.progress) || 0, 0, 1);
        const rise = 0.9 * progress + (Number(entry.riseOffset) || 0);
        const wobble = Math.sin(((Number(entry.id) || 0) % 7) + progress * Math.PI * 2) * 0.08;
        const screen = worldToScreen(
          Number(entry.x) + 0.5 + (Number(entry.jitterX) || 0) + wobble,
          Number(entry.y) + 0.35 - rise,
          cameraX,
          cameraY,
          width,
          height
        );
        const node = getFloatingDamageTextNode(floatingDamageTextPool, floatingDamageLayer);
        node.position.set(screen.x, screen.y);
        node.text = `-${Math.max(0, Math.round(Number(entry.amount) || 0))}`;
        node.alpha = 1 - progress;
        const fillColor = entry.targetType === "player" ? 0xff7a7a : 0xffd36b;
        if (node.style) {
          node.style.fill = fillColor;
        }
        activeFloatingDamageTexts.push(node);
      }
    }

    function updateSimpleNode(node, x, y, drawFn) {
      node.container.position.set(x, y);
      drawFn(node.graphics);
    }

    function syncNodeMap(nodeMap, entries, idSelector, createFn, updateFn, parentContainer) {
      const seen = new Set();
      for (const entry of entries) {
        const id = String(idSelector(entry));
        seen.add(id);
        let node = nodeMap.get(id);
        if (!node) {
          node = createFn(entry);
          nodeMap.set(id, node);
          parentContainer.addChild(node.container);
        }
        updateFn(node, entry);
      }
      for (const [id, node] of nodeMap.entries()) {
        if (seen.has(id)) {
          continue;
        }
        if (node.container.parent) {
          node.container.parent.removeChild(node.container);
        }
        destroyNode(node);
        nodeMap.delete(id);
      }
    }

    function syncSpriteMap(nodeMap, entries, idSelector, updateFn, parentContainer, pool) {
      const seen = new Set();
      for (const entry of entries) {
        const id = String(idSelector(entry));
        seen.add(id);
        let sprite = nodeMap.get(id);
        if (!sprite) {
          sprite = acquirePooledSprite(pool, parentContainer);
          nodeMap.set(id, sprite);
        }
        updateFn(sprite, entry);
      }
      for (const [id, sprite] of nodeMap.entries()) {
        if (seen.has(id)) {
          continue;
        }
        releasePooledSprite(pool, sprite);
        nodeMap.delete(id);
      }
    }

    function drawTownAndGrid(frameViewModel) {
      const width = app.renderer.width / (app.renderer.resolution || 1);
      const height = app.renderer.height / (app.renderer.resolution || 1);
      const cameraX = frameViewModel.cameraX;
      const cameraY = frameViewModel.cameraY;
      backgroundGraphics.clear();
      backgroundGraphics.beginFill(0x0a1621, 1);
      backgroundGraphics.drawRect(0, 0, width, height);
      backgroundGraphics.endFill();
      gridSprite.texture = getBackgroundGridTexture();
      gridSprite.width = width + tileSize;
      gridSprite.height = height + tileSize;
      gridSprite.position.set(-tileSize, -tileSize);
      const cameraOffsetX = ((Number(cameraX) % 1) + 1) % 1;
      const cameraOffsetY = ((Number(cameraY) % 1) + 1) % 1;
      gridSprite.tilePosition.set(
        width / 2 - cameraOffsetX * tileSize,
        height / 2 - cameraOffsetY * tileSize
      );

      const townLayout = deps.townClientState && deps.townClientState.layout ? deps.townClientState.layout : null;
      const wallTiles = deps.townClientState && Array.isArray(deps.townClientState.wallTiles) ? deps.townClientState.wallTiles : [];
      if (!townLayout) {
        townSprite.visible = false;
        return;
      }
      const townTexture = getTownTexture(townLayout, wallTiles);
      if (!townTexture) {
        townSprite.visible = false;
        return;
      }
      const minX = Number(townLayout.minTileX) || 0;
      const minY = Number(townLayout.minTileY) || 0;
      const maxX = Number(townLayout.maxTileX) || 0;
      const maxY = Number(townLayout.maxTileY) || 0;
      townSprite.visible = true;
      townSprite.texture = townTexture;
      townSprite.position.set(
        (minX - cameraX) * tileSize + width / 2,
        (minY - cameraY) * tileSize + height / 2
      );
      townSprite.width = Math.max(1, maxX - minX + 1) * tileSize;
      townSprite.height = Math.max(1, maxY - minY + 1) * tileSize;
    }

    function drawAreaEffects(frameViewModel) {
      const width = app.renderer.width / (app.renderer.resolution || 1);
      const height = app.renderer.height / (app.renderer.resolution || 1);
      const cameraX = frameViewModel.cameraX;
      const cameraY = frameViewModel.cameraY;
      const now = frameViewModel.frameNow;
      areaUnderlayGraphics.clear();
      areaOverlayGraphics.clear();
      const underlaySpriteEffects = [];
      const overlaySpriteEffects = [];
      for (const effect of frameViewModel.areaEffects) {
        const actionDef = getActionDefById(String(effect && effect.abilityId || ""));
        const areaHook = String(
          getAbilityVisualHook(
            effect && effect.abilityId,
            actionDef,
            "areaEffectRenderer",
            "",
            String(effect && effect.kind || "")
          ) || ""
        )
          .trim()
          .toLowerCase();
        const center = worldToScreen(Number(effect.x) + 0.5, Number(effect.y) + 0.5, cameraX, cameraY, width, height);
        const radius = Math.max(6, (Number(effect.radius) || 1) * tileSize);
        const abilityId = String(effect.abilityId || "").toLowerCase();
        const color =
          abilityId.includes("fire") ? 0xff8a4d :
          abilityId.includes("frost") || abilityId.includes("blizzard") ? 0x8edcff :
          abilityId.includes("arcane") ? 0xb98cff :
          abilityId.includes("lightning") ? 0xffea77 :
          abilityId.includes("poison") || abilityId.includes("caltrop") ? 0x7bd65d :
          0x79b9ff;
        const targetGraphics = String(effect.kind || "") === "summon" ? areaOverlayGraphics : areaUnderlayGraphics;
        const spriteFrame = getAreaEffectSpriteFrame(effect, now, areaHook);
        if (String(effect.kind || "") === "beam") {
          const beamFrame = getBeamAreaEffectSpriteFrame(effect, now, areaHook);
          if (beamFrame) {
            const beamCenter = worldToScreen(
              Number.isFinite(Number(beamFrame.centerWorldX)) ? Number(beamFrame.centerWorldX) : Number(effect.x) + 0.5,
              Number.isFinite(Number(beamFrame.centerWorldY)) ? Number(beamFrame.centerWorldY) : Number(effect.y) + 0.5,
              cameraX,
              cameraY,
              width,
              height
            );
            underlaySpriteEffects.push({
              effect,
              center: beamCenter,
              spriteFrame: beamFrame
            });
            continue;
          }
        }
        if (spriteFrame) {
          const spriteCenter =
            Number.isFinite(Number(spriteFrame.centerWorldX)) && Number.isFinite(Number(spriteFrame.centerWorldY))
              ? worldToScreen(
                  Number(spriteFrame.centerWorldX),
                  Number(spriteFrame.centerWorldY),
                  cameraX,
                  cameraY,
                  width,
                  height
                )
              : center;
          (String(effect.kind || "") === "summon" ? overlaySpriteEffects : underlaySpriteEffects).push({
            effect,
            center: spriteCenter,
            spriteFrame
          });
          continue;
        }
        targetGraphics.lineStyle(2, color, 0.9);
        targetGraphics.beginFill(color, String(effect.kind || "") === "summon" ? 0.1 : 0.08);
        if (String(effect.kind || "") === "beam") {
          const endpoints = resolveBeamWorldEndpoints(effect);
          const start = worldToScreen(endpoints.startX + 0.5, endpoints.startY + 0.5, cameraX, cameraY, width, height);
          const end = worldToScreen(endpoints.endX + 0.5, endpoints.endY + 0.5, cameraX, cameraY, width, height);
          targetGraphics.moveTo(start.x, start.y);
          targetGraphics.lineTo(end.x, end.y);
        } else {
          targetGraphics.drawCircle(center.x, center.y, radius);
          targetGraphics.endFill();
        }
      }
      pruneDynamicAreaEffectRuntime(now);
      syncSpriteMap(
        areaUnderlayNodes,
        underlaySpriteEffects,
        (entry) => entry.effect.id,
        (sprite, entry) => {
          updateSprite(sprite, entry.center.x, entry.center.y, entry.spriteFrame);
        },
        areaUnderlaySpriteLayer,
        spritePools.areaUnderlay
      );
      syncSpriteMap(
        areaOverlayNodes,
        overlaySpriteEffects,
        (entry) => entry.effect.id,
        (sprite, entry) => {
          updateSprite(sprite, entry.center.x, entry.center.y, entry.spriteFrame);
        },
        areaOverlaySpriteLayer,
        spritePools.areaOverlay
      );
    }

    function drawAbilityPreview(frameViewModel) {
      if (!abilityPreviewGraphics) {
        return;
      }
      abilityPreviewGraphics.clear();
      if (!frameViewModel || !frameViewModel.self) {
        return;
      }

      const previewState = getAbilityPreviewState();
      if (!previewState || !previewState.abilityId) {
        return;
      }

      const width = app.renderer.width / (app.renderer.resolution || 1);
      const height = app.renderer.height / (app.renderer.resolution || 1);
      const cameraX = frameViewModel.cameraX;
      const cameraY = frameViewModel.cameraY;
      const now = Number(frameViewModel.frameNow) || performance.now();
      const self = frameViewModel.self;
      const abilityId = String(previewState.abilityId || "");
      const abilityDef = findAbilityDefById(abilityId) || getActionDefById(abilityId) || {};
      const kind = String(abilityDef.kind || "").trim().toLowerCase();
      const targetX = Number(previewState.targetX);
      const targetY = Number(previewState.targetY);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        return;
      }

      const start = worldToScreen(Number(self.x) + 0.5, Number(self.y) + 0.5, cameraX, cameraY, width, height);
      const end = worldToScreen(targetX + 0.5, targetY + 0.5, cameraX, cameraY, width, height);
      const dx = targetX - Number(self.x);
      const dy = targetY - Number(self.y);
      const len = Math.hypot(dx, dy);
      const direction = normalizeDirection(dx, dy) || normalizeDirection(self.lastDirection && self.lastDirection.dx, self.lastDirection && self.lastDirection.dy) || { dx: 0, dy: 1 };
      const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(abilityId, self));
      const inRange = castRange <= 0 || len <= castRange + 0.001;
      const pulse = 0.72 + Math.sin(now * 0.011) * 0.14;
      const strokeColor = inRange ? 0xd6e4ff : 0xffa4a4;
      const fillColor = inRange ? 0x7cb2f0 : 0xd66868;

      abilityPreviewGraphics.lineStyle(1.2, strokeColor, inRange ? 0.46 : 0.48);
      abilityPreviewGraphics.moveTo(start.x, start.y);
      abilityPreviewGraphics.lineTo(end.x, end.y);

      if (kind === "area" || kind === "summon" || kind === "teleport") {
        const radiusTiles =
          kind === "teleport"
            ? 0.45
            : Math.max(0.2, Number(abilityDef.areaRadius || abilityDef.radius) || 2.5);
        abilityPreviewGraphics.beginFill(fillColor, inRange ? 0.12 : 0.14);
        abilityPreviewGraphics.lineStyle(1.6, strokeColor, 0.72);
        abilityPreviewGraphics.drawCircle(end.x, end.y, Math.max(8, radiusTiles * tileSize));
        abilityPreviewGraphics.endFill();
      } else if (kind === "meleecone") {
        const coneAngleDeg = Math.max(24, Number(abilityDef.coneAngleDeg) || 90);
        const halfAngle = (coneAngleDeg * Math.PI) / 360;
        const radiusPx = Math.max(18, Math.max(0.5, castRange || len || 1.8) * tileSize);
        const facing = Math.atan2(direction.dy, direction.dx);
        
        // Draw cone fill
        abilityPreviewGraphics.beginFill(fillColor, inRange ? 0.16 * pulse : 0.15 * pulse);
        abilityPreviewGraphics.lineStyle(1.6, strokeColor, 0.72);
        abilityPreviewGraphics.moveTo(start.x, start.y);
        abilityPreviewGraphics.arc(start.x, start.y, radiusPx, facing - halfAngle, facing + halfAngle);
        abilityPreviewGraphics.lineTo(start.x, start.y);
        abilityPreviewGraphics.endFill();
        
        // Draw slashy animation - sweeping arc trails
        const slashAlpha = 0.35 * pulse;
        const slashColor = inRange ? 0xfff5dc : 0xffb4b4;
        
        // Draw multiple arc trails for slash effect
        for (let i = 0; i < 3; i++) {
          const trailRadius = radiusPx * (0.6 + i * 0.15);
          const trailAlpha = slashAlpha * (1 - i * 0.25);
          abilityPreviewGraphics.lineStyle(2.5 - i * 0.5, slashColor, trailAlpha);
          abilityPreviewGraphics.arc(start.x, start.y, trailRadius, facing - halfAngle * 0.8, facing + halfAngle * 0.8);
        }
        
        // Draw slash marks
        const slashCount = 3;
        for (let i = 0; i < slashCount; i++) {
          const slashAngle = facing - halfAngle * 0.6 + (halfAngle * 1.2 * i / (slashCount - 1));
          const slashLength = radiusPx * (0.7 + Math.random() * 0.3);
          const slashAlpha2 = slashAlpha * (0.7 + Math.random() * 0.3);
          abilityPreviewGraphics.lineStyle(1.5, slashColor, slashAlpha2);
          abilityPreviewGraphics.moveTo(start.x, start.y);
          abilityPreviewGraphics.lineTo(start.x + Math.cos(slashAngle) * slashLength, start.y + Math.sin(slashAngle) * slashLength);
        }
      } else if (kind === "beam" || kind === "chain") {
        const beamWidthPx = Math.max(4, (Number(abilityDef.beamWidth) || 0.5) * tileSize);
        abilityPreviewGraphics.lineStyle(beamWidthPx * 1.7, fillColor, inRange ? 0.18 * pulse : 0.18 * pulse);
        abilityPreviewGraphics.moveTo(start.x, start.y);
        abilityPreviewGraphics.lineTo(end.x, end.y);
        abilityPreviewGraphics.lineStyle(Math.max(1.2, beamWidthPx * 0.28), 0xf2f8ff, inRange ? 0.86 * pulse : 0.82 * pulse);
        abilityPreviewGraphics.moveTo(start.x, start.y);
        abilityPreviewGraphics.lineTo(end.x, end.y);
      } else {
        const projectileCount = Math.max(1, Math.floor(Number(abilityDef.projectileCount) || 1));
        const spreadDeg = Math.max(0, Number(abilityDef.spreadDeg) || 0);
        const previewRange = Math.max(castRange, len, 0.5);
        const baseAngle = Math.atan2(direction.dy, direction.dx);
        abilityPreviewGraphics.lineStyle(1.4, 0xecf2fa, inRange ? 0.8 * pulse : 0.76 * pulse);
        for (let index = 0; index < projectileCount; index += 1) {
          const spreadOffset =
            projectileCount > 1 && spreadDeg > 0
              ? (((index / Math.max(1, projectileCount - 1)) - 0.5) * spreadDeg * Math.PI) / 180
              : 0;
          const angle = baseAngle + spreadOffset;
          const endPoint = worldToScreen(
            Number(self.x) + Math.cos(angle) * previewRange + 0.5,
            Number(self.y) + Math.sin(angle) * previewRange + 0.5,
            cameraX,
            cameraY,
            width,
            height
          );
          abilityPreviewGraphics.moveTo(start.x, start.y);
          abilityPreviewGraphics.lineTo(endPoint.x, endPoint.y);
        }
        const endpointRadiusPx = Math.max(
          5,
          Math.max(Number(abilityDef.explosionRadius) || 0, Number(abilityDef.projectileHitRadius) || 0.25) * tileSize
        );
        abilityPreviewGraphics.beginFill(fillColor, inRange ? 0.12 * pulse : 0.12 * pulse);
        abilityPreviewGraphics.lineStyle(1.5, strokeColor, 0.72);
        abilityPreviewGraphics.drawCircle(end.x, end.y, endpointRadiusPx);
        abilityPreviewGraphics.endFill();
      }

      if (Number.isFinite(Number(previewState.snappedTargetId))) {
        abilityPreviewGraphics.lineStyle(1.6, 0xfff6c6, 0.72 * pulse);
        abilityPreviewGraphics.drawCircle(end.x, end.y, 12 + pulse * 2.5);
        abilityPreviewGraphics.drawCircle(end.x, end.y, 5.8 + pulse * 1.2);
      }
    }

    function updateTooltip(frameViewModel) {
      tooltipGraphics.clear();
      tooltipText.text = "";
      const hovered = frameViewModel.hoveredMob
        ? { label: `${frameViewModel.hoveredMob.mob.name} [${Math.max(1, Math.floor(Number(frameViewModel.hoveredMob.mob.level) || 1))}]`, p: frameViewModel.hoveredMob.p }
        : frameViewModel.hoveredBag
          ? { label: "Loot Bag", p: frameViewModel.hoveredBag.p }
          : frameViewModel.hoveredVendor
            ? { label: String(frameViewModel.hoveredVendor.vendor && frameViewModel.hoveredVendor.vendor.name || "Quartermaster"), p: frameViewModel.hoveredVendor.p }
            : null;
      if (!hovered) {
        return;
      }
      tooltipText.text = hovered.label;
      const bounds = tooltipText.getLocalBounds();
      const x = Math.round(hovered.p.x);
      const y = Math.round(hovered.p.y - 34);
      tooltipGraphics.beginFill(0x081018, 0.88);
      tooltipGraphics.lineStyle(1, 0xb8d4ec, 0.45);
      tooltipGraphics.drawRoundedRect(
        x - bounds.width / 2 - 8,
        y,
        bounds.width + 16,
        bounds.height + 10,
        6
      );
      tooltipGraphics.endFill();
      tooltipText.position.set(x, y + 4);
    }

    function renderWorldFrame(frameViewModel) {
      if (!frameViewModel || !frameViewModel.self) {
        hide();
        return;
      }
      if (!ensureApp(deps.canvasElement.width, deps.canvasElement.height)) {
        return;
      }
      show();
      resize(deps.canvasElement.width, deps.canvasElement.height);

      const width = app.renderer.width / (app.renderer.resolution || 1);
      const height = app.renderer.height / (app.renderer.resolution || 1);
      const cameraX = frameViewModel.cameraX;
      const cameraY = frameViewModel.cameraY;
      const frameNow = frameViewModel.frameNow;
      const projectileCount = Array.isArray(frameViewModel.projectileViews) ? frameViewModel.projectileViews.length : 0;
      const mobCount = Array.isArray(frameViewModel.mobViews) ? frameViewModel.mobViews.length : 0;
      const particleDensityScale = clamp(1 - projectileCount / 220 - mobCount / 140, 0.22, 1);

      drawTownAndGrid(frameViewModel);
      drawAreaEffects(frameViewModel);
      drawAbilityPreview(frameViewModel);
      if (pixiParticleSystem && typeof pixiParticleSystem.pruneEmitters === "function") {
        pixiParticleSystem.pruneEmitters(frameNow);
      }

      const lootSpriteEntries = [];
      const lootFallbackEntries = [];
      for (const entry of frameViewModel.lootBagViews) {
        const bagId = String((entry.bag && entry.bag.id) || `${entry.bag.x}:${entry.bag.y}`);
        const seed = hashString(`lootbag:${bagId}`);
        const spriteCanvas = getLootBagSprite ? getLootBagSprite(seed) : null;
        if (spriteCanvas) {
          lootSpriteEntries.push({
            entry,
            spriteFrame: {
              canvas: spriteCanvas,
              rotation: 0
            }
          });
        } else {
          lootFallbackEntries.push(entry);
        }
      }
      syncSpriteMap(
        lootNodes,
        lootSpriteEntries,
        (item) => item.entry.bag.id,
        (sprite, item) => {
          const p = worldToScreen(Number(item.entry.bag.x) + 0.5, Number(item.entry.bag.y) + 0.5, cameraX, cameraY, width, height);
          updateSprite(sprite, p.x, p.y, item.spriteFrame, { samplingMode: "nearest" });
        },
        lootSpriteLayer,
        spritePools.loot
      );
      syncNodeMap(
        lootFallbackNodes,
        lootFallbackEntries,
        (entry) => entry.bag.id,
        () => createSimpleNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.bag.x) + 0.5, Number(entry.bag.y) + 0.5, cameraX, cameraY, width, height);
          updateSimpleNode(node, p.x, p.y, (graphics) => drawLootGraphic(graphics, entry.bag, frameNow));
        },
        lootFallbackLayer
      );
      if (pixiParticleSystem && typeof pixiParticleSystem.renderWorldEmitter === "function") {
        for (const entry of frameViewModel.lootBagViews) {
          const bagId = String((entry.bag && entry.bag.id) || `${entry.bag.x}:${entry.bag.y}`);
          pixiParticleSystem.renderWorldEmitter({
            key: `pixi:lootbag:sparkles:${bagId}`,
            x: Number(entry.bag.x) + 0.5,
            y: Number(entry.bag.y) + 0.5,
            cameraX,
            cameraY,
            now: frameNow,
            densityScale: clamp(particleDensityScale + 0.15, 0.25, 1),
            worldToScreen: (worldX, worldY, localCameraX, localCameraY) => worldToScreen(worldX, worldY, localCameraX, localCameraY, width, height),
            config: deps.lootBagSparkleConfig || null
          });
        }
      }

      const vendor = frameViewModel.townVendor;
      if (vendor) {
        if (!vendorNode) {
          vendorNode = createLabeledSpriteNode();
          vendorLayer.addChild(vendorNode.container);
        }
        const p = worldToScreen(Number(vendor.x) + 0.5, Number(vendor.y) + 0.5, cameraX, cameraY, width, height);
        const vendorBob = Math.sin(frameNow / 340) * 1.2;
        updateLabeledSpriteNode(vendorNode, p.x, p.y - 4 + vendorBob, String(vendor.name || "Quartermaster"), 1, 1, getVendorSpriteFrame(), (graphics) => {
          graphics.clear();
        });
        vendorNode.hpBack.clear();
        vendorNode.hpFill.clear();
      }

      // Render quest NPCs
      syncNodeMap(
        questNpcNodes,
        Array.isArray(frameViewModel.townQuestGivers) ? frameViewModel.townQuestGivers : [],
        (entry) => String(entry && entry.id || ""),
        () => createLabeledSpriteNode(),
        (node, questNpc) => {
          const p = worldToScreen(Number(questNpc.x) + 0.5, Number(questNpc.y) + 0.5, cameraX, cameraY, width, height);
          const questBob = Math.sin(frameNow / 340) * 1.2;
          const spriteFrame = getQuestNpcSpriteFrame();
          const spriteHeight =
            spriteFrame && spriteFrame.canvas && Number(spriteFrame.canvas.height) > 0
              ? Number(spriteFrame.canvas.height)
              : 64;
          // Pixi sprites are anchored at the center, so shift by half-height to keep feet on the tile.
          updateLabeledSpriteNode(
            node,
            p.x,
            p.y - spriteHeight * 0.5 + questBob,
            String(questNpc.name || "Quest Giver"),
            1,
            1,
            spriteFrame,
            (graphics) => {
              graphics.clear();
            }
          );
          node.hpBack.clear();
          node.hpFill.clear();
        },
        questNpcLayer
      );

      syncNodeMap(
        mobNodes,
        frameViewModel.mobViews,
        (entry) => entry.mob.id,
        () => createLabeledSpriteNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.mob.x) + 0.5, Number(entry.mob.y) + 0.5, cameraX, cameraY, width, height);
          const spriteFrame = entry.isHumanoid ? getMobSpriteFrame(entry) : null;
          const hoveredMobId = frameViewModel.hoveredMob && frameViewModel.hoveredMob.mob ? frameViewModel.hoveredMob.mob.id : null;
          const isHovered = hoveredMobId != null && String(hoveredMobId) === String(entry.mob.id);
          updateLabeledSpriteNode(
            node,
            p.x,
            p.y,
            isHovered ? String(entry.mob.name || "Mob") : "",
            entry.mob.hp,
            entry.mob.maxHp,
            spriteFrame || getGenericMobSpriteFrame(entry.mob),
            (graphics) => drawMobGraphic(graphics, entry.mob),
            {
              showHpBar: true,
              castVisual: entry.castVisual,
              statusVisual: entry.statusVisual,
              frameNow,
              isPlayer: false,
              labelOffsetY: -16,
              hpOffsetY: -12
            }
          );
        },
        mobLayer
      );

      syncNodeMap(
        playerNodes,
        [...frameViewModel.playerViews, frameViewModel.selfView],
        (entry) => entry.player.id,
        () => createLabeledSpriteNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.player.x) + 0.5, Number(entry.player.y) + 0.5, cameraX, cameraY, width, height);
          const spriteFrame = getPlayerSpriteFrame(entry);
          updateLabeledSpriteNode(
            node,
            p.x,
            p.y,
            String(entry.player.name || "Player"),
            entry.player.hp,
            entry.player.maxHp,
            spriteFrame || getGenericPlayerSpriteFrame(entry.player, !!entry.isSelf),
            (graphics) => drawPlayerGraphic(graphics, entry.player, !!entry.isSelf),
            {
              showHpBar: true,
              castVisual: entry.castVisual,
              statusVisual: entry.statusVisual,
              frameNow,
              isPlayer: true,
              labelOffsetY: -18,
              hpOffsetY: -10
            }
          );
        },
        playerLayer
      );

      const projectileSpriteEntries = [];
      for (const entry of frameViewModel.projectileViews) {
        const spriteFrame =
          entry && entry.spriteFrame && entry.spriteFrame.canvas
            ? entry.spriteFrame
            : (getProjectileSpriteFrame ? getProjectileSpriteFrame(entry.projectile, frameNow) : null);
        const projectileHook = String(entry && entry.projectileHook || "default").trim().toLowerCase();
        const resolvedSpriteFrame =
          spriteFrame && spriteFrame.canvas ? spriteFrame : getGenericProjectileSpriteFrame(entry.projectile, frameNow);
        projectileSpriteEntries.push({
          entry,
          spriteFrame: resolvedSpriteFrame,
          projectileHook,
          isGenericFallback: !(spriteFrame && spriteFrame.canvas)
        });
      }
      syncSpriteMap(
        projectileNodes,
        projectileSpriteEntries,
        (item) => item.entry.projectile.id,
        (sprite, item) => {
          const p = worldToScreen(Number(item.entry.projectile.x) + 0.5, Number(item.entry.projectile.y) + 0.5, cameraX, cameraY, width, height);
          updateSprite(sprite, p.x, p.y, item.spriteFrame, { samplingMode: "nearest" });
        },
        projectileSpriteLayer,
        spritePools.projectile
      );
      const explosionSpriteEntries = [];
      for (const explosionView of Array.isArray(frameViewModel.explosionViews) ? frameViewModel.explosionViews : []) {
        const spriteFrame = getExplosionSpriteFrame(explosionView);
        if (!spriteFrame) {
          continue;
        }
        explosionSpriteEntries.push({ explosionView, spriteFrame });
      }
      syncSpriteMap(
        explosionNodes,
        explosionSpriteEntries,
        (item) => item.explosionView.id,
        (sprite, item) => {
          const p = worldToScreen(Number(item.explosionView.x) + 0.5, Number(item.explosionView.y) + 0.5, cameraX, cameraY, width, height);
          updateSprite(sprite, p.x, p.y, item.spriteFrame);
        },
        explosionLayer,
        spritePools.explosion
      );
      syncNodeMap(
        projectileFallbackNodes,
        [],
        (entry) => entry.projectile.id,
        () => createSimpleNode(),
        () => {},
        projectileFallbackLayer
      );
      if (pixiParticleSystem && typeof pixiParticleSystem.renderWorldEmitter === "function") {
        for (const entry of frameViewModel.projectileViews) {
          const config = getProjectileParticleConfig(entry.projectile, entry.projectileHook);
          if (!config) {
            continue;
          }
          pixiParticleSystem.renderWorldEmitter({
            key: `pixi:projectile:${entry.projectile.id}`,
            x: Number(entry.projectile.x) + 0.5,
            y: Number(entry.projectile.y) + 0.5,
            cameraX,
            cameraY,
            now: frameNow,
            densityScale: particleDensityScale,
            worldToScreen: (worldX, worldY, localCameraX, localCameraY) => worldToScreen(worldX, worldY, localCameraX, localCameraY, width, height),
            config
          });
        }
      }

      syncFloatingDamageTexts(frameViewModel, cameraX, cameraY, width, height);
      pruneHumanoidRuntimes(frameNow);

      updateTooltip(frameViewModel);
      const particleStats =
        pixiParticleSystem && typeof pixiParticleSystem.getDebugStats === "function"
          ? pixiParticleSystem.getDebugStats()
          : { emitterCount: 0, particleCount: 0, pooledSpriteCount: 0 };
      lastDebugStats = {
        mode: "pixi",
        players: (Array.isArray(frameViewModel.playerViews) ? frameViewModel.playerViews.length : 0) + 1,
        mobs: Array.isArray(frameViewModel.mobViews) ? frameViewModel.mobViews.length : 0,
        projectiles: Array.isArray(frameViewModel.projectileViews) ? frameViewModel.projectileViews.length : 0,
        lootBags: Array.isArray(frameViewModel.lootBagViews) ? frameViewModel.lootBagViews.length : 0,
        areaEffects: Array.isArray(frameViewModel.areaEffects) ? frameViewModel.areaEffects.length : 0,
        activeSpriteNodes:
          playerNodes.size +
          mobNodes.size +
          projectileNodes.size +
          explosionNodes.size +
          lootNodes.size +
          areaUnderlayNodes.size +
          areaOverlayNodes.size +
          activeFloatingDamageTexts.length +
          (vendorNode ? 1 : 0) +
          questNpcNodes.size,
        pooledSprites:
          spritePools.loot.length +
          spritePools.explosion.length +
          spritePools.projectile.length +
          spritePools.areaUnderlay.length +
          spritePools.areaOverlay.length +
          floatingDamageTextPool.length +
          Number(particleStats.pooledSpriteCount || 0),
        particleEmitters: Number(particleStats.emitterCount || 0),
        particleSprites: Number(particleStats.particleCount || 0),
        fallbackNodes: lootFallbackNodes.size + projectileFallbackNodes.size,
        questNpcCount: questNpcNodes.size,
        questNpcSamples: Array.from(questNpcNodes.entries()).slice(0, 8).map(([id, node]) => ({
          id,
          label: String(node && node.nameText && node.nameText.text || ""),
          visible: !!(node && node.container && node.container.visible),
          x: node && node.container ? Math.round(Number(node.container.position.x) || 0) : 0,
          y: node && node.container ? Math.round(Number(node.container.position.y) || 0) : 0,
          onScreen: !!(
            node &&
            node.container &&
            Number(node.container.position.x) >= -64 &&
            Number(node.container.position.x) <= width + 64 &&
            Number(node.container.position.y) >= -96 &&
            Number(node.container.position.y) <= height + 96
          ),
          spriteVisible: !!(node && node.sprite && node.sprite.visible),
          spriteKey: String(
            node &&
            node.sprite &&
            node.sprite.texture &&
            node.sprite.texture.baseTexture &&
            node.sprite.texture.baseTexture.resource &&
            node.sprite.texture.baseTexture.resource.source &&
            node.sprite.texture.baseTexture.resource.source.__vibeSpriteKey || ""
          )
        })),
        projectileSamples: projectileSpriteEntries.slice(0, 12).map((item) => ({
          id: Number(item.entry && item.entry.projectile && item.entry.projectile.id) || 0,
          abilityId: String(item.entry && item.entry.projectile && item.entry.projectile.abilityId || ""),
          hook: String(item.projectileHook || ""),
          genericFallback: !!item.isGenericFallback,
          spriteKey: getSpriteCanvasDebugKey(item.spriteFrame),
          width:
            item.spriteFrame && item.spriteFrame.canvas && Number(item.spriteFrame.canvas.width)
              ? Number(item.spriteFrame.canvas.width)
              : 0,
          height:
            item.spriteFrame && item.spriteFrame.canvas && Number(item.spriteFrame.canvas.height)
              ? Number(item.spriteFrame.canvas.height)
              : 0
        }))
      };
      app.renderer.render(stage);
    }

    return {
      isAvailable: () => !!PIXI,
      resize,
      show,
      hide,
      renderWorldFrame,
      getDebugStats: () => ({ ...lastDebugStats })
    };
  }

  globalScope.VibeClientPixiWorldRenderer = Object.freeze({
    createPixiWorldRenderer
  });
})(globalThis);
