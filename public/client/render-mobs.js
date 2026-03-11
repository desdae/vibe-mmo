(function initVibeClientRenderMobs(globalScope) {
  "use strict";

  function createMobRenderTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const clamp = typeof deps.clamp === "function" ? deps.clamp : (v, min, max) => Math.max(min, Math.min(max, v));
    const entityRuntime = deps.entityRuntime;

    function detectMobSpriteTypeFromName(name) {
      const lower = String(name || "").toLowerCase();
      if (lower.includes("skeleton") && lower.includes("archer")) {
        return "skeleton_archer";
      }
      if (lower.includes("skeleton")) {
        return "skeleton";
      }
      if (lower.includes("creeper")) {
        return "creeper";
      }
      if (lower.includes("spider")) {
        return "spider";
      }
      if (lower.includes("zombie")) {
        return "zombie";
      }
      if (lower.includes("orc") || lower.includes("berserker")) {
        return "orc";
      }
      return "basic";
    }

    function getMobRenderStyle(mob) {
      if (mob && mob.renderStyle && typeof mob.renderStyle === "object") {
        return mob.renderStyle;
      }
      const meta = entityRuntime && entityRuntime.mobMeta ? entityRuntime.mobMeta.get(mob && mob.id) : null;
      if (meta && meta.renderStyle && typeof meta.renderStyle === "object") {
        return meta.renderStyle;
      }
      return null;
    }

    function getMobSpriteType(mob) {
      const style = getMobRenderStyle(mob);
      const configured = String((style && style.spriteType) || "").toLowerCase();
      const normalized = configured === "orcberserker" || configured === "orc_berserker" ? "orc" : configured;
      if (
        normalized === "zombie" ||
        normalized === "skeleton" ||
        normalized === "skeleton_archer" ||
        normalized === "creeper" ||
        normalized === "spider" ||
        normalized === "orc" ||
        normalized === "basic"
      ) {
        return normalized;
      }
      return detectMobSpriteTypeFromName(mob && mob.name);
    }

    function getMobAttackVisualType(mob) {
      const style = getMobRenderStyle(mob);
      const configured = String((style && style.attackVisual) || "").toLowerCase();
      if (
        configured === "bite" ||
        configured === "sword" ||
        configured === "dual_axes" ||
        configured === "ignition" ||
        configured === "bow" ||
        configured === "none"
      ) {
        return configured;
      }
      const spriteType = getMobSpriteType(mob);
      if (spriteType === "skeleton_archer") {
        return "bow";
      }
      if (spriteType === "skeleton") {
        return "sword";
      }
      if (spriteType === "creeper") {
        return "ignition";
      }
      if (spriteType === "orc") {
        return "dual_axes";
      }
      return "bite";
    }

    function isHumanoidMob(mob) {
      const style = getMobRenderStyle(mob);
      if (deps.humanoidRenderTools && typeof deps.humanoidRenderTools.isHumanoidStyle === "function") {
        return deps.humanoidRenderTools.isHumanoidStyle(style);
      }
      if (deps.humanoidRenderTools && typeof deps.humanoidRenderTools.isHumanoidSpriteType === "function") {
        return deps.humanoidRenderTools.isHumanoidSpriteType(getMobSpriteType(mob));
      }
      return false;
    }

    function buildHumanoidMobStyle(mob) {
      const baseStyle = getMobRenderStyle(mob);
      if (!baseStyle || typeof baseStyle !== "object") {
        return {
          rigType: "humanoid",
          species: "human"
        };
      }
      if (deps.humanoidRenderTools && typeof deps.humanoidRenderTools.isHumanoidStyle === "function" && deps.humanoidRenderTools.isHumanoidStyle(baseStyle)) {
        return baseStyle;
      }
      const spriteType = getMobSpriteType(mob);
      if (spriteType === "zombie") {
        return {
          ...baseStyle,
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
          ...baseStyle,
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
          ...baseStyle,
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
          ...baseStyle,
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
        ...baseStyle,
        rigType: "humanoid",
        species: "human"
      };
    }

    function getMobStyleNumber(style, key, fallback, min, max) {
      const n = Number(style && style[key]);
      if (!Number.isFinite(n)) {
        return fallback;
      }
      return clamp(n, min, max);
    }

    function getMobStyleCacheKey(style) {
      if (!style || typeof style !== "object") {
        return "";
      }
      try {
        return JSON.stringify(style);
      } catch {
        return "";
      }
    }

    function applyMobPaletteOverrides(basePalette, style) {
      const palette = { ...basePalette };
      const source = style && style.palette && typeof style.palette === "object" ? style.palette : null;
      if (!source) {
        return palette;
      }
      for (const [key, value] of Object.entries(source)) {
        if (!(key in palette)) {
          continue;
        }
        const color = deps.sanitizeCssColor(value);
        if (!color) {
          continue;
        }
        palette[key] = color;
      }
      return palette;
    }

    function createMobSprite(typeName, style = null) {
      const normalizedType = String(typeName || "mob").trim().toLowerCase();
      const cacheKey = `${normalizedType}|${getMobStyleCacheKey(style)}`;
      const cached = deps.mobSpriteCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const sprite = document.createElement("canvas");
      const sizeScale = getMobStyleNumber(style, "sizeScale", 1, 0.5, 3);
      const spriteSize = Math.max(20, Math.round(deps.MOB_SPRITE_SIZE * sizeScale));
      sprite.width = spriteSize;
      sprite.height = spriteSize;
      const sctx = sprite.getContext("2d");
      const center = spriteSize / 2;
      const radius = Math.max(7, spriteSize * 0.27);
      const bodyColor = getMobStyleNumber(style, "bodyLightness", 58, 10, 95);
      const outlineColor = getMobStyleNumber(style, "outlineLightness", 22, 0, 70);
      const accentColor = getMobStyleNumber(style, "accentHue", 50, 0, 360);

      const basePalette = {
        body: `hsl(95 20% ${bodyColor}%)`,
        outline: `hsl(210 20% ${outlineColor}%)`,
        accent: `hsl(${accentColor} 70% 58%)`,
        eye: "#f5f7ff"
      };
      const palette = applyMobPaletteOverrides(basePalette, style);

      sctx.save();
      sctx.translate(center, center);

      sctx.fillStyle = palette.body;
      sctx.strokeStyle = palette.outline;
      sctx.lineWidth = Math.max(1.5, spriteSize * 0.06);
      deps.drawRoundedRect(sctx, -10, -10, 20, 20, 6);
      sctx.fill();
      sctx.stroke();

      sctx.fillStyle = palette.eye;
      sctx.beginPath();
      sctx.arc(-3.2, -2.5, 1.8, 0, Math.PI * 2);
      sctx.arc(3.2, -2.5, 1.8, 0, Math.PI * 2);
      sctx.fill();

      sctx.fillStyle = palette.outline;
      sctx.beginPath();
      sctx.arc(-3.2, -2.5, 0.8, 0, Math.PI * 2);
      sctx.arc(3.2, -2.5, 0.8, 0, Math.PI * 2);
      sctx.fill();

      sctx.strokeStyle = palette.accent;
      sctx.lineWidth = Math.max(1, spriteSize * 0.05);
      sctx.beginPath();
      sctx.moveTo(-5, 4);
      sctx.lineTo(5, 4);
      sctx.stroke();

      sctx.restore();
      deps.mobSpriteCache.set(cacheKey, sprite);
      return sprite;
    }

    function drawMobHpBar(mob, p) {
      if (!mob || !p) {
        return;
      }
      const hp = Math.max(0, Number(mob.hp) || 0);
      const maxHp = Math.max(1, Number(mob.maxHp) || 1);
      if (hp >= maxHp) {
        return;
      }
      const width = 22;
      const height = 4;
      const x = Math.round(p.x - width / 2);
      const y = Math.round(p.y - 23);
      const ratio = clamp(hp / maxHp, 0, 1);

      deps.ctx.fillStyle = "rgba(10, 14, 22, 0.85)";
      deps.ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
      deps.ctx.fillStyle = "rgba(62, 16, 19, 0.95)";
      deps.ctx.fillRect(x, y, width, height);
      deps.ctx.fillStyle = "rgba(111, 219, 112, 0.95)";
      deps.ctx.fillRect(x, y, width * ratio, height);
    }

    function getHoveredMob(mobs, cameraX, cameraY) {
      let best = null;
      let bestDist = Infinity;
      for (const mob of mobs) {
        const p = deps.worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
        const dx = deps.mouseState.sx - p.x;
        const dy = deps.mouseState.sy - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 17 * 17 || distSq >= bestDist) {
          continue;
        }
        bestDist = distSq;
        best = { mob, p };
      }
      return best;
    }

    function getHoveredLootBag(lootBags, cameraX, cameraY) {
      let best = null;
      let bestDist = Infinity;
      for (const bag of lootBags) {
        const p = deps.worldToScreen(bag.x + 0.5, bag.y + 0.5, cameraX, cameraY);
        const dx = deps.mouseState.sx - p.x;
        const dy = deps.mouseState.sy - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 15 * 15 || distSq >= bestDist) {
          continue;
        }
        bestDist = distSq;
        best = { bag, p };
      }
      return best;
    }

    function drawMob(mob, cameraX, cameraY, attackState = null) {
      const p = deps.worldToScreen(mob.x + 0.5, mob.y + 0.5, cameraX, cameraY);
      if (isHumanoidMob(mob) && deps.humanoidRenderTools && typeof deps.humanoidRenderTools.drawHumanoid === "function") {
        const activeCastState =
          deps.remoteMobCasts && typeof deps.getCastProgress === "function" ? deps.remoteMobCasts.get(mob.id) || null : null;
        const castProgress =
          activeCastState && typeof deps.getCastProgress === "function" ? deps.getCastProgress(activeCastState, performance.now()) : null;
        deps.humanoidRenderTools.drawHumanoid({
          entity: mob,
          entityKey: `mob:${String(mob.id ?? "0")}`,
          p,
          style: buildHumanoidMobStyle(mob),
          equipmentSlots: {},
          attackState,
          castState: castProgress ? { active: true, progress: castProgress.ratio, abilityId: activeCastState.abilityId || "" } : null,
          aimWorldX: typeof deps.getCurrentSelf === "function" && deps.getCurrentSelf() ? deps.getCurrentSelf().x + 0.5 : NaN,
          aimWorldY: typeof deps.getCurrentSelf === "function" && deps.getCurrentSelf() ? deps.getCurrentSelf().y + 0.5 : NaN,
          isSelf: false
        });
        drawMobHpBar(mob, p);
        return;
      }
      const mobStyle = getMobRenderStyle(mob);
      const mobName = String(mob.name || "Mob");
      const spriteType = getMobSpriteType(mob);
      const skeletonArcherIncludeBow = !attackState;
      const skeletonIncludeSword = !attackState;
      const orcIncludeAxes = !attackState;
      const sprite =
        spriteType === "skeleton_archer"
          ? deps.getSkeletonArcherWalkSprite(mob, skeletonArcherIncludeBow)
          : spriteType === "skeleton"
            ? deps.getSkeletonWalkSprite(mob, skeletonIncludeSword)
            : spriteType === "creeper"
              ? deps.getCreeperWalkSprite(mob)
              : spriteType === "spider"
                ? deps.getSpiderWalkSprite(mob)
                : spriteType === "zombie"
                  ? deps.getZombieWalkSprite(mob)
                  : spriteType === "orc"
                    ? deps.getOrcWalkSprite(mob, orcIncludeAxes)
                    : createMobSprite(mobName, mobStyle);

      const sizeScale = getMobStyleNumber(mobStyle, "sizeScale", 1, 0.5, 3);
      const drawSize = Math.round(deps.MOB_SPRITE_SIZE * sizeScale);
      const half = drawSize / 2;
      deps.ctx.drawImage(sprite, Math.round(p.x - half), Math.round(p.y - half), drawSize, drawSize);
      drawMobHpBar(mob, p);
    }

    return {
      detectMobSpriteTypeFromName,
      getMobRenderStyle,
      getMobSpriteType,
      isHumanoidMob,
      getMobAttackVisualType,
      getMobStyleNumber,
      getMobStyleCacheKey,
      applyMobPaletteOverrides,
      createMobSprite,
      drawMobHpBar,
      getHoveredMob,
      getHoveredLootBag,
      drawMob
    };
  }

  globalScope.VibeClientRenderMobs = Object.freeze({
    createMobRenderTools
  });
})(globalThis);
