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
    const getLootBagSprite = typeof deps.getLootBagSprite === "function" ? deps.getLootBagSprite : null;
    const getProjectileSpriteFrame = typeof deps.getProjectileSpriteFrame === "function" ? deps.getProjectileSpriteFrame : null;
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
    let particleLayer = null;
    let mobLayer = null;
    let playerLayer = null;
    let projectileSpriteLayer = null;
    let projectileFallbackLayer = null;
    let vendorLayer = null;
    let areaOverlayLayer = null;
    let areaOverlaySpriteLayer = null;
    let tooltipLayer = null;
    let backgroundGraphics = null;
    let gridSprite = null;
    let townSprite = null;
    let areaUnderlayGraphics = null;
    let areaOverlayGraphics = null;
    let tooltipGraphics = null;
    let tooltipText = null;
    let playerNodes = new Map();
    let mobNodes = new Map();
    let projectileNodes = new Map();
    let lootNodes = new Map();
    let lootFallbackNodes = new Map();
    let areaUnderlayNodes = new Map();
    let areaOverlayNodes = new Map();
    let projectileFallbackNodes = new Map();
    let vendorNode = null;
    let pixiParticleSystem = null;
    const canvasTextureCache = new WeakMap();
    const humanoidCanvasCache = new Map();
    const areaEffectCanvasCache = new Map();
    const backgroundTextureCache = new Map();
    const spritePools = {
      loot: [],
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
      const minX = Number(townLayout.minX) || 0;
      const minY = Number(townLayout.minY) || 0;
      const maxX = Number(townLayout.maxX) || 0;
      const maxY = Number(townLayout.maxY) || 0;
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
      for (let x = 0; x < widthTiles; x += 1) {
        for (let y = 0; y < heightTiles; y += 1) {
          const px = x * tileSize;
          const py = y * tileSize;
          ctx.fillStyle = "#2d261e";
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = "rgba(59,51,40,0.35)";
          ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        }
      }
      for (const tile of wallTiles || []) {
        const px = (Number(tile.x) - minX) * tileSize;
        const py = (Number(tile.y) - minY) * tileSize;
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
          continue;
        }
        ctx.fillStyle = "#7e6041";
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.fillStyle = "rgba(77,60,42,0.50)";
        ctx.fillRect(px + 1, py + 1, tileSize - 2, 6);
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
      areaUnderlaySpriteLayer = new PIXI.ParticleContainer(512, {
        position: true,
        rotation: true,
        alpha: true,
        scale: true,
        uvs: true
      });
      areaUnderlayFallbackLayer = new PIXI.Container();
      lootSpriteLayer = new PIXI.ParticleContainer(1024, {
        position: true,
        rotation: true,
        alpha: true,
        scale: true,
        uvs: true
      });
      lootFallbackLayer = new PIXI.Container();
      particleLayer = new PIXI.ParticleContainer(4096, {
        position: true,
        rotation: true,
        alpha: true,
        scale: true,
        uvs: true
      });
      mobLayer = new PIXI.Container();
      playerLayer = new PIXI.Container();
      projectileSpriteLayer = new PIXI.ParticleContainer(4096, {
        position: true,
        rotation: true,
        alpha: true,
        scale: true,
        uvs: true
      });
      projectileFallbackLayer = new PIXI.Container();
      vendorLayer = new PIXI.Container();
      areaOverlayLayer = new PIXI.Container();
      areaOverlaySpriteLayer = new PIXI.ParticleContainer(512, {
        position: true,
        rotation: true,
        alpha: true,
        scale: true,
        uvs: true
      });
      tooltipLayer = new PIXI.Container();

      backgroundGraphics = new PIXI.Graphics();
      gridSprite = new PIXI.TilingSprite(PIXI.Texture.WHITE, Math.max(1, width | 0), Math.max(1, height | 0));
      gridSprite.alpha = 0.78;
      townSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
      townSprite.visible = false;
      areaUnderlayGraphics = new PIXI.Graphics();
      areaOverlayGraphics = new PIXI.Graphics();
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
      root.addChild(
        backgroundLayer,
        areaUnderlayLayer,
        lootSpriteLayer,
        lootFallbackLayer,
        particleLayer,
        vendorLayer,
        mobLayer,
        playerLayer,
        projectileSpriteLayer,
        projectileFallbackLayer,
        areaOverlayLayer,
        tooltipLayer
      );
      pixiParticleSystem = createPixiParticleSystem
        ? createPixiParticleSystem({
            PIXI,
            parentContainer: particleLayer,
            hashString
          })
        : null;
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
      const nameText = new PIXI.Text("", {
        fontFamily: "Segoe UI",
        fontSize: 12,
        fill: 0xf5f7fa
      });
      nameText.anchor.set(0.5, 1);
      container.addChild(graphics, sprite, hpBack, hpFill, nameText);
      return { container, graphics, sprite, hpBack, hpFill, nameText };
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

    function getTextureFromCanvas(canvas) {
      if (!canvas || typeof canvas.getContext !== "function") {
        return null;
      }
      const cached = canvasTextureCache.get(canvas);
      if (cached) {
        return cached;
      }
      const texture = PIXI.Texture.from(canvas);
      canvasTextureCache.set(canvas, texture);
      return texture;
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

    function getHumanoidSpriteCanvas(cacheKey, renderOptions) {
      const cached = humanoidCanvasCache.get(cacheKey);
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
        sanitizeCssColor
      });
      if (!tools || typeof tools.drawHumanoid !== "function") {
        return null;
      }
      tools.drawHumanoid({
        ...renderOptions,
        p: {
          x: spriteCanvas.width * 0.5,
          y: spriteCanvas.height * 0.62
        }
      });
      humanoidCanvasCache.set(cacheKey, spriteCanvas);
      return spriteCanvas;
    }

    function getPlayerSpriteFrame(player, isSelf) {
      const style = buildPlayerHumanoidStyle(player);
      const equipmentSlots = typeof deps.getPlayerVisualEquipment === "function" ? deps.getPlayerVisualEquipment(player, isSelf) : {};
      let aimSide = "center";
      if (String(style?.defaults?.mainHand || "").toLowerCase() === "bow" && typeof deps.screenToWorld === "function" && deps.mouseState) {
        const self = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf() : null;
        const world = self ? deps.screenToWorld(Number(deps.mouseState.sx) || 0, Number(deps.mouseState.sy) || 0, self) : null;
        if (world && Number.isFinite(world.x)) {
          aimSide = world.x >= Number(player && player.x) ? "right" : "left";
        }
      }
      const cacheKey = [
        "player",
        String(player && player.classType || ""),
        stableStringify(style),
        stableStringify(equipmentSlots),
        aimSide,
        isSelf ? "self" : "other"
      ].join("|");
      const canvas = getHumanoidSpriteCanvas(cacheKey, {
        entity: player,
        entityKey: `pixi-player:${cacheKey}`,
        style,
        equipmentSlots,
        useDefaultGearFallback: false,
        aimWorldX: aimSide === "center" ? NaN : Number(player && player.x) + (aimSide === "right" ? 2 : -2),
        aimWorldY: Number(player && player.y) || 0,
        isSelf
      });
      return canvas ? { canvas, rotation: 0 } : null;
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
      const aimWorldX = currentSelf && Number.isFinite(Number(currentSelf.x)) ? Number(currentSelf.x) : Number(mob.x) + 1;
      const aimWorldY = currentSelf && Number.isFinite(Number(currentSelf.y)) ? Number(currentSelf.y) : Number(mob.y);
      const cacheKey = [
        "mob",
        String(mob.name || ""),
        stableStringify(style),
        stableStringify(attackState),
        currentSelf ? (aimWorldX >= Number(mob.x) ? "right" : "left") : "center"
      ].join("|");
      const canvas = getHumanoidSpriteCanvas(cacheKey, {
        entity: mob,
        entityKey: `pixi-mob:${cacheKey}`,
        style,
        equipmentSlots: {},
        useDefaultGearFallback: true,
        attackState,
        aimWorldX,
        aimWorldY,
        isSelf: false
      });
      return canvas ? { canvas, rotation: 0 } : null;
    }

    function getProjectileParticleConfig(projectile) {
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

    function getAreaEffectSpriteFrame(effect, frameNow) {
      if (String(effect && effect.kind || "") === "beam") {
        return null;
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

      const result = { canvas, rotation: 0 };
      areaEffectCanvasCache.set(key, result);
      return result;
    }

    function getBeamAreaEffectSpriteFrame(effect) {
      const visual = getAreaEffectVisualConfig(effect);
      const key = `beam:${visual.stroke}:${visual.glow}`;
      let cached = areaEffectCanvasCache.get(key);
      if (!cached) {
        const width = 32;
        const height = 128;
        const canvas = createRuntimeCanvas(width, height);
        if (!canvas) {
          return null;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return null;
        }
        const midX = width * 0.5;
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, "rgba(255,255,255,0)");
        gradient.addColorStop(0.12, visual.stroke);
        gradient.addColorStop(0.5, "#ffffff");
        gradient.addColorStop(0.88, visual.stroke);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = visual.glow;
        ctx.strokeStyle = gradient;
        ctx.lineCap = "round";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(midX, 10);
        ctx.lineTo(midX, height - 10);
        ctx.stroke();
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (let y = 12; y < height - 12; y += 16) {
          const jitter = ((y / 16) % 2 === 0 ? -1 : 1) * 3;
          if (y === 12) {
            ctx.moveTo(midX, y);
          } else {
            ctx.lineTo(midX + jitter, y);
          }
        }
        ctx.stroke();
        ctx.restore();
        cached = { canvas };
        areaEffectCanvasCache.set(key, cached);
      }
      const startX = Number(effect && effect.x) + 0.5;
      const startY = Number(effect && effect.y) + 0.5;
      const endX = Number(effect && effect.targetX) + 0.5;
      const endY = Number(effect && effect.targetY) + 0.5;
      const dx = endX - startX;
      const dy = endY - startY;
      const lengthPx = Math.max(8, Math.hypot(dx, dy) * tileSize);
      return {
        canvas: cached.canvas,
        rotation: Math.atan2(dy, dx) + Math.PI / 2,
        scaleX: 1,
        scaleY: lengthPx / 128,
        alpha: 0.96
      };
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
        const texture = getTextureFromCanvas(spriteFrame.canvas);
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

    function updateSprite(sprite, x, y, spriteFrame) {
      const texture = spriteFrame && spriteFrame.canvas ? getTextureFromCanvas(spriteFrame.canvas) : null;
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
      return true;
    }

    function updateLabeledNode(node, x, y, label, hp, maxHp, drawFn) {
      node.container.position.set(x, y);
      drawFn(node.graphics);
      node.nameText.text = label;
      node.nameText.position.set(0, -18);
      node.hpBack.clear();
      node.hpFill.clear();
      const currentHp = Number(hp) || 0;
      const totalHp = Math.max(1, Number(maxHp) || 1);
      if (currentHp < totalHp) {
        node.hpBack.beginFill(0x09111a, 0.84);
        node.hpBack.drawRoundedRect(-11, -30, 22, 4, 2);
        node.hpBack.endFill();
        node.hpFill.beginFill(0x64d37a, 1);
        node.hpFill.drawRoundedRect(-11, -30, Math.max(0, (currentHp / totalHp) * 22), 4, 2);
        node.hpFill.endFill();
      }
    }

    function updateLabeledSpriteNode(node, x, y, label, hp, maxHp, spriteFrame, drawFallback) {
      node.container.position.set(x, y);
      if (spriteFrame && spriteFrame.canvas) {
        const texture = getTextureFromCanvas(spriteFrame.canvas);
        if (texture) {
          node.graphics.clear();
          node.sprite.visible = true;
          node.sprite.texture = texture;
          node.sprite.rotation = Number(spriteFrame.rotation) || 0;
          node.sprite.scale.set(1, 1);
        } else {
          node.sprite.visible = false;
          drawFallback(node.graphics);
        }
      } else {
        node.sprite.visible = false;
        drawFallback(node.graphics);
      }
      node.nameText.text = label;
      node.nameText.position.set(0, -18);
      node.hpBack.clear();
      node.hpFill.clear();
      const currentHp = Number(hp) || 0;
      const totalHp = Math.max(1, Number(maxHp) || 1);
      if (currentHp < totalHp) {
        node.hpBack.beginFill(0x09111a, 0.84);
        node.hpBack.drawRoundedRect(-11, -30, 22, 4, 2);
        node.hpBack.endFill();
        node.hpFill.beginFill(0x64d37a, 1);
        node.hpFill.drawRoundedRect(-11, -30, Math.max(0, (currentHp / totalHp) * 22), 4, 2);
        node.hpFill.endFill();
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
      const minX = Number(townLayout.minX) || 0;
      const minY = Number(townLayout.minY) || 0;
      const maxX = Number(townLayout.maxX) || 0;
      const maxY = Number(townLayout.maxY) || 0;
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
        const spriteFrame = getAreaEffectSpriteFrame(effect, now);
        if (String(effect.kind || "") === "beam") {
          const beamFrame = getBeamAreaEffectSpriteFrame(effect);
          if (beamFrame) {
            const endX = Number(effect.targetX) + 0.5;
            const endY = Number(effect.targetY) + 0.5;
            const end = worldToScreen(endX, endY, cameraX, cameraY, width, height);
            underlaySpriteEffects.push({
              effect,
              center: {
                x: (center.x + end.x) * 0.5,
                y: (center.y + end.y) * 0.5
              },
              spriteFrame: beamFrame
            });
            continue;
          }
        }
        if (spriteFrame) {
          (String(effect.kind || "") === "summon" ? overlaySpriteEffects : underlaySpriteEffects).push({
            effect,
            center,
            spriteFrame
          });
          continue;
        }
        targetGraphics.lineStyle(2, color, 0.9);
        targetGraphics.beginFill(color, String(effect.kind || "") === "summon" ? 0.1 : 0.08);
        if (String(effect.kind || "") === "beam") {
          const endX = Number(effect.targetX) + 0.5;
          const endY = Number(effect.targetY) + 0.5;
          const end = worldToScreen(endX, endY, cameraX, cameraY, width, height);
          targetGraphics.moveTo(center.x, center.y);
          targetGraphics.lineTo(end.x, end.y);
        } else {
          targetGraphics.drawCircle(center.x, center.y, radius);
          targetGraphics.endFill();
        }
      }
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
          updateSprite(sprite, p.x, p.y, item.spriteFrame);
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
          vendorNode = createLabeledNode();
          vendorLayer.addChild(vendorNode.container);
        }
        const p = worldToScreen(Number(vendor.x) + 0.5, Number(vendor.y) + 0.5, cameraX, cameraY, width, height);
        updateLabeledNode(vendorNode, p.x, p.y, String(vendor.name || "Quartermaster"), 1, 1, (graphics) => {
          graphics.clear();
          graphics.beginFill(0x6c3e22, 1);
          graphics.drawCircle(0, -4, 7);
          graphics.endFill();
          graphics.beginFill(0xe4c45e, 1);
          graphics.drawCircle(5, 0, 3);
          graphics.endFill();
        });
        vendorNode.hpBack.clear();
        vendorNode.hpFill.clear();
      }

      syncNodeMap(
        mobNodes,
        frameViewModel.mobViews,
        (entry) => entry.mob.id,
        () => createLabeledSpriteNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.mob.x) + 0.5, Number(entry.mob.y) + 0.5, cameraX, cameraY, width, height);
          const spriteFrame = entry.isHumanoid ? getMobSpriteFrame(entry) : null;
          updateLabeledSpriteNode(
            node,
            p.x,
            p.y,
            String(entry.mob.name || "Mob"),
            entry.mob.hp,
            entry.mob.maxHp,
            spriteFrame,
            (graphics) => drawMobGraphic(graphics, entry.mob)
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
          const spriteFrame = getPlayerSpriteFrame(entry.player, !!entry.isSelf);
          updateLabeledSpriteNode(
            node,
            p.x,
            p.y,
            String(entry.player.name || "Player"),
            entry.player.hp,
            entry.player.maxHp,
            spriteFrame,
            (graphics) => drawPlayerGraphic(graphics, entry.player, !!entry.isSelf)
          );
        },
        playerLayer
      );

      const projectileSpriteEntries = [];
      const projectileFallbackEntries = [];
      for (const entry of frameViewModel.projectileViews) {
        const spriteFrame = getProjectileSpriteFrame ? getProjectileSpriteFrame(entry.projectile, frameNow) : null;
        if (spriteFrame && spriteFrame.canvas) {
          projectileSpriteEntries.push({ entry, spriteFrame });
        } else {
          projectileFallbackEntries.push(entry);
        }
      }
      syncSpriteMap(
        projectileNodes,
        projectileSpriteEntries,
        (item) => item.entry.projectile.id,
        (sprite, item) => {
          const p = worldToScreen(Number(item.entry.projectile.x) + 0.5, Number(item.entry.projectile.y) + 0.5, cameraX, cameraY, width, height);
          updateSprite(sprite, p.x, p.y, item.spriteFrame);
        },
        projectileSpriteLayer,
        spritePools.projectile
      );
      syncNodeMap(
        projectileFallbackNodes,
        projectileFallbackEntries,
        (entry) => entry.projectile.id,
        () => createSimpleNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.projectile.x) + 0.5, Number(entry.projectile.y) + 0.5, cameraX, cameraY, width, height);
          updateSimpleNode(node, p.x, p.y, (graphics) => drawProjectileGraphic(graphics, entry.projectile, frameNow));
        },
        projectileFallbackLayer
      );
      if (pixiParticleSystem && typeof pixiParticleSystem.renderWorldEmitter === "function") {
        for (const entry of frameViewModel.projectileViews) {
          const config = getProjectileParticleConfig(entry.projectile);
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

      updateTooltip(frameViewModel);
      app.renderer.render(stage);
    }

    return {
      isAvailable: () => !!PIXI,
      resize,
      show,
      hide,
      renderWorldFrame
    };
  }

  globalScope.VibeClientPixiWorldRenderer = Object.freeze({
    createPixiWorldRenderer
  });
})(globalThis);
