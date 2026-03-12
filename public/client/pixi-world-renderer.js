(function initVibeClientPixiWorldRenderer(globalScope) {
  "use strict";

  function createPixiWorldRenderer(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const PIXI = deps.PIXI || globalScope.PIXI;
    const canvasElement = deps.canvasElement;
    const windowObject = deps.windowObject || globalScope;
    const tileSize = Math.max(8, Number(deps.tileSize) || 32);
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
    if (!PIXI || !canvasElement) {
      return null;
    }

    let app = null;
    let view = null;
    let stage = null;
    let root = null;
    let backgroundLayer = null;
    let areaUnderlayLayer = null;
    let lootLayer = null;
    let mobLayer = null;
    let playerLayer = null;
    let projectileLayer = null;
    let vendorLayer = null;
    let areaOverlayLayer = null;
    let tooltipLayer = null;
    let backgroundGraphics = null;
    let areaUnderlayGraphics = null;
    let areaOverlayGraphics = null;
    let tooltipGraphics = null;
    let tooltipText = null;
    let playerNodes = new Map();
    let mobNodes = new Map();
    let projectileNodes = new Map();
    let lootNodes = new Map();
    let vendorNode = null;
    const canvasTextureCache = new WeakMap();

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
      lootLayer = new PIXI.Container();
      mobLayer = new PIXI.Container();
      playerLayer = new PIXI.Container();
      projectileLayer = new PIXI.Container();
      vendorLayer = new PIXI.Container();
      areaOverlayLayer = new PIXI.Container();
      tooltipLayer = new PIXI.Container();

      backgroundGraphics = new PIXI.Graphics();
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

      backgroundLayer.addChild(backgroundGraphics);
      areaUnderlayLayer.addChild(areaUnderlayGraphics);
      areaOverlayLayer.addChild(areaOverlayGraphics);
      root.addChild(backgroundLayer, areaUnderlayLayer, lootLayer, vendorLayer, mobLayer, playerLayer, projectileLayer, areaOverlayLayer, tooltipLayer);
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

    function createSpriteNode() {
      const container = new PIXI.Container();
      const graphics = new PIXI.Graphics();
      const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      container.addChild(graphics, sprite);
      return { container, graphics, sprite };
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

    function drawTownAndGrid(frameViewModel) {
      const width = app.renderer.width / (app.renderer.resolution || 1);
      const height = app.renderer.height / (app.renderer.resolution || 1);
      const cameraX = frameViewModel.cameraX;
      const cameraY = frameViewModel.cameraY;
      backgroundGraphics.clear();
      backgroundGraphics.beginFill(0x0a1621, 1);
      backgroundGraphics.drawRect(0, 0, width, height);
      backgroundGraphics.endFill();
      backgroundGraphics.lineStyle(1, 0x17364f, 0.7);
      const tilesX = Math.ceil(width / tileSize) + 2;
      const tilesY = Math.ceil(height / tileSize) + 2;
      const startX = Math.floor(cameraX - tilesX / 2);
      const startY = Math.floor(cameraY - tilesY / 2);
      for (let x = startX; x < startX + tilesX; x += 1) {
        const screen = worldToScreen(x, 0, cameraX, cameraY, width, height);
        backgroundGraphics.moveTo(screen.x, 0);
        backgroundGraphics.lineTo(screen.x, height);
      }
      for (let y = startY; y < startY + tilesY; y += 1) {
        const screen = worldToScreen(0, y, cameraX, cameraY, width, height);
        backgroundGraphics.moveTo(0, screen.y);
        backgroundGraphics.lineTo(width, screen.y);
      }

      const townLayout = deps.townClientState && deps.townClientState.layout ? deps.townClientState.layout : null;
      const wallTiles = deps.townClientState && Array.isArray(deps.townClientState.wallTiles) ? deps.townClientState.wallTiles : [];
      if (!townLayout) {
        return;
      }
      for (let x = Number(townLayout.minX) || 0; x <= (Number(townLayout.maxX) || 0); x += 1) {
        for (let y = Number(townLayout.minY) || 0; y <= (Number(townLayout.maxY) || 0); y += 1) {
          const p = worldToScreen(x, y, cameraX, cameraY, width, height);
          backgroundGraphics.beginFill(0x2d261e, 1);
          backgroundGraphics.drawRect(p.x, p.y, tileSize, tileSize);
          backgroundGraphics.endFill();
          backgroundGraphics.beginFill(0x3b3328, 0.35);
          backgroundGraphics.drawRect(p.x + 2, p.y + 2, tileSize - 4, tileSize - 4);
          backgroundGraphics.endFill();
        }
      }
      for (const tile of wallTiles) {
        const p = worldToScreen(Number(tile.x) || 0, Number(tile.y) || 0, cameraX, cameraY, width, height);
        backgroundGraphics.beginFill(0x7e6041, 1);
        backgroundGraphics.drawRect(p.x, p.y, tileSize, tileSize);
        backgroundGraphics.endFill();
        backgroundGraphics.beginFill(0x4d3c2a, 0.5);
        backgroundGraphics.drawRect(p.x + 1, p.y + 1, tileSize - 2, 6);
        backgroundGraphics.endFill();
      }
    }

    function drawAreaEffects(frameViewModel) {
      const width = app.renderer.width / (app.renderer.resolution || 1);
      const height = app.renderer.height / (app.renderer.resolution || 1);
      const cameraX = frameViewModel.cameraX;
      const cameraY = frameViewModel.cameraY;
      const now = frameViewModel.frameNow;
      areaUnderlayGraphics.clear();
      areaOverlayGraphics.clear();
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
        if (String(effect.kind || "") === "summon" && globalScope.VibeSummonLayout && typeof globalScope.VibeSummonLayout.computeSummonFormationPositions === "function") {
          const positions = globalScope.VibeSummonLayout.computeSummonFormationPositions(
            Number(effect.x) + 0.5,
            Number(effect.y) + 0.5,
            Math.max(1, Math.round(Number(effect.summonCount) || 1)),
            Math.max(0, Number(effect.formationRadius) || 0.9)
          );
          for (const point of positions) {
            const screen = worldToScreen(point.x, point.y, cameraX, cameraY, width, height);
            targetGraphics.beginFill(color, 0.95);
            targetGraphics.drawCircle(screen.x, screen.y, 5 + Math.sin(now * 0.01 + point.index) * 0.5);
            targetGraphics.endFill();
          }
        }
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

      drawTownAndGrid(frameViewModel);
      drawAreaEffects(frameViewModel);

      syncNodeMap(
        lootNodes,
        frameViewModel.lootBagViews,
        (entry) => entry.bag.id,
        () => createSpriteNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.bag.x) + 0.5, Number(entry.bag.y) + 0.5, cameraX, cameraY, width, height);
          const bagId = String((entry.bag && entry.bag.id) || `${entry.bag.x}:${entry.bag.y}`);
          const seed = hashString(`lootbag:${bagId}`);
          const spriteCanvas = getLootBagSprite ? getLootBagSprite(seed) : null;
          updateSpriteNode(
            node,
            p.x,
            p.y,
            spriteCanvas
              ? {
                  canvas: spriteCanvas,
                  rotation: 0
                }
              : null,
            (graphics) => drawLootGraphic(graphics, entry.bag, frameNow)
          );
        },
        lootLayer
      );

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
        () => createLabeledNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.mob.x) + 0.5, Number(entry.mob.y) + 0.5, cameraX, cameraY, width, height);
          updateLabeledNode(node, p.x, p.y, String(entry.mob.name || "Mob"), entry.mob.hp, entry.mob.maxHp, (graphics) => drawMobGraphic(graphics, entry.mob));
        },
        mobLayer
      );

      syncNodeMap(
        playerNodes,
        [...frameViewModel.playerViews, frameViewModel.selfView],
        (entry) => entry.player.id,
        () => createLabeledNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.player.x) + 0.5, Number(entry.player.y) + 0.5, cameraX, cameraY, width, height);
          updateLabeledNode(node, p.x, p.y, String(entry.player.name || "Player"), entry.player.hp, entry.player.maxHp, (graphics) =>
            drawPlayerGraphic(graphics, entry.player, !!entry.isSelf)
          );
        },
        playerLayer
      );

      syncNodeMap(
        projectileNodes,
        frameViewModel.projectileViews,
        (entry) => entry.projectile.id,
        () => createSpriteNode(),
        (node, entry) => {
          const p = worldToScreen(Number(entry.projectile.x) + 0.5, Number(entry.projectile.y) + 0.5, cameraX, cameraY, width, height);
          const spriteFrame = getProjectileSpriteFrame ? getProjectileSpriteFrame(entry.projectile, frameNow) : null;
          updateSpriteNode(
            node,
            p.x,
            p.y,
            spriteFrame,
            (graphics) => drawProjectileGraphic(graphics, entry.projectile, frameNow)
          );
        },
        projectileLayer
      );

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
