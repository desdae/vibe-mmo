(function initVibeClientRenderProjectiles(globalScope) {
  "use strict";

  function createProjectileRenderTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    if (!ctx) {
      return null;
    }

    const seededUnit =
      typeof deps.seededUnit === "function"
        ? deps.seededUnit
        : (seed, n) => {
            const x = Math.sin((seed + n * 374761393) * 0.000001) * 43758.5453;
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
    const FIREBALL_VARIANTS = 4;
    const FIREBALL_FRAMES = 6;
    const FIREBALL_FRAME_MS = 48;
    const FIRE_SPARK_VARIANTS = 4;
    const FIRE_SPARK_FRAMES = 5;
    const FIRE_SPARK_FRAME_MS = 42;
    const FROSTBOLT_VARIANTS = 4;
    const FROSTBOLT_FRAMES = 5;
    const FROSTBOLT_FRAME_MS = 54;
    const ARCANE_MISSILE_VARIANTS = 4;
    const ARCANE_MISSILE_FRAMES = 5;
    const ARCANE_MISSILE_FRAME_MS = 52;
    const BONE_ARROW_VARIANTS = 4;
    const BONE_ARROW_FRAMES = 4;
    const BONE_ARROW_FRAME_MS = 60;
    const ARROW_VARIANTS = 4;
    const ARROW_FRAMES = 4;
    const ARROW_FRAME_MS = 56;
    const GRENADE_VARIANTS = 3;
    const GRENADE_FRAMES = 5;
    const GRENADE_FRAME_MS = 64;

    function createSpriteCanvas(size) {
      const sprite = document.createElement("canvas");
      sprite.width = size;
      sprite.height = size;
      return sprite;
    }

    function getVariantIndex(seed, count) {
      return Math.abs((Number(seed) || 0) % Math.max(1, count | 0));
    }

    function getFrameIndex(now, frameCount, frameMs) {
      const count = Math.max(1, frameCount | 0);
      const duration = Math.max(1, frameMs | 0);
      return Math.floor(now / duration) % count;
    }

    function drawRotatedSprite(sprite, x, y, heading) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(heading);
      ctx.drawImage(sprite, Math.round(-sprite.width / 2), Math.round(-sprite.height / 2));
      ctx.restore();
    }

    function createFireballSprite(variantIndex, frameIndex) {
      const size = 74;
      const sprite = createSpriteCanvas(size);
      const sctx = sprite.getContext("2d");
      const cx = size / 2 + 8;
      const cy = size / 2;
      const phase = frameIndex / FIREBALL_FRAMES;
      const pulse = 1 + Math.sin(phase * Math.PI * 2 + variantIndex * 0.8) * 0.06;
      const coreR = 4.9 * pulse;

      sctx.save();
      sctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 8; i += 1) {
        const t = (i + 1) / 8;
        const wobble = Math.sin(phase * Math.PI * 2 + variantIndex * 0.65 + i * 1.27) * (1.2 - t * 0.75) * 2.2;
        const dist = 7 + t * 20;
        const px = cx - dist;
        const py = cy + wobble;
        const pr = Math.max(0.9, 2.7 - t * 2.0);
        const alpha = 0.42 * (1 - t) + 0.08;

        sctx.beginPath();
        sctx.fillStyle = `rgba(255, 166, 72, ${alpha.toFixed(3)})`;
        sctx.arc(px, py, pr, 0, Math.PI * 2);
        sctx.fill();
      }

      const glow = sctx.createRadialGradient(cx, cy, 1.5, cx, cy, 14);
      glow.addColorStop(0, "rgba(255, 252, 200, 0.98)");
      glow.addColorStop(0.28, "rgba(255, 154, 64, 0.95)");
      glow.addColorStop(0.68, "rgba(255, 70, 38, 0.64)");
      glow.addColorStop(1, "rgba(255, 70, 38, 0)");
      sctx.fillStyle = glow;
      sctx.beginPath();
      sctx.arc(cx, cy, 14, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      sctx.beginPath();
      sctx.fillStyle = "#b9241d";
      sctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      sctx.fill();

      sctx.beginPath();
      sctx.strokeStyle = "rgba(255, 226, 148, 0.78)";
      sctx.lineWidth = 1.4;
      sctx.arc(cx - 0.7, cy + 0.15, 2.45, -1.1, 1.95);
      sctx.stroke();
      sctx.beginPath();
      sctx.strokeStyle = "rgba(255, 115, 70, 0.8)";
      sctx.lineWidth = 1.1;
      sctx.arc(cx + 0.9, cy - 0.45, 1.7, 1.5, 4.3);
      sctx.stroke();

      sctx.save();
      sctx.translate(cx, cy);
      sctx.strokeStyle = "rgba(255, 168, 60, 0.96)";
      sctx.lineCap = "round";
      sctx.lineJoin = "round";
      sctx.lineWidth = 1.7;
      for (let i = 0; i < 12; i += 1) {
        const a = (Math.PI * 2 * i) / 12;
        const flicker = 1 + Math.sin(phase * Math.PI * 2 + i * 1.31 + variantIndex * 0.52) * 0.18;
        const r0 = 5.2 + (i % 2) * 0.6;
        const r1 = (6.8 + (i % 2 ? 1.8 : 2.6)) * flicker;
        sctx.beginPath();
        sctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        sctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        sctx.stroke();
      }
      sctx.restore();

      return sprite;
    }

    function createFireSparkSprite(variantIndex, frameIndex) {
      const size = 56;
      const sprite = createSpriteCanvas(size);
      const sctx = sprite.getContext("2d");
      const cx = size / 2 + 5;
      const cy = size / 2;
      const phase = frameIndex / FIRE_SPARK_FRAMES;

      sctx.save();
      sctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 10; i += 1) {
        const t = (i + 1) / 10;
        const jitter = Math.sin(phase * Math.PI * 2 + variantIndex * 0.7 + i * 0.9) * (1.4 - t) * 1.9;
        const dist = 4 + t * 20;
        const px = cx - dist;
        const py = cy + jitter;
        const r = Math.max(0.55, 1.8 - t * 1.25);
        const alpha = 0.42 * (1 - t) + 0.08;
        sctx.beginPath();
        sctx.fillStyle = `rgba(255, 143, 54, ${alpha.toFixed(3)})`;
        sctx.arc(px, py, r, 0, Math.PI * 2);
        sctx.fill();
      }

      const glow = sctx.createRadialGradient(cx, cy, 1, cx, cy, 9.5);
      glow.addColorStop(0, "rgba(255, 250, 195, 0.96)");
      glow.addColorStop(0.4, "rgba(255, 176, 81, 0.92)");
      glow.addColorStop(0.72, "rgba(255, 97, 39, 0.62)");
      glow.addColorStop(1, "rgba(255, 69, 32, 0)");
      sctx.fillStyle = glow;
      sctx.beginPath();
      sctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      sctx.save();
      sctx.translate(cx, cy);
      sctx.lineCap = "round";
      sctx.lineJoin = "round";

      sctx.beginPath();
      sctx.moveTo(5.2, 0);
      sctx.lineTo(-4.4, -2.6);
      sctx.lineTo(-2.2, 0);
      sctx.lineTo(-4.4, 2.6);
      sctx.closePath();
      sctx.fillStyle = "rgba(255, 131, 48, 0.95)";
      sctx.strokeStyle = "rgba(255, 213, 134, 0.9)";
      sctx.lineWidth = 1.1;
      sctx.fill();
      sctx.stroke();

      sctx.beginPath();
      sctx.arc(1.6, 0, 2.2, 0, Math.PI * 2);
      sctx.fillStyle = "rgba(255, 247, 194, 0.96)";
      sctx.fill();

      sctx.beginPath();
      sctx.strokeStyle = "rgba(255, 92, 42, 0.78)";
      sctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i += 1) {
        const y = -2.4 + i * 1.6;
        const len = 4.4 + (i % 2) * 1.3;
        sctx.moveTo(-2.5, y);
        sctx.lineTo(-2.5 - len, y);
      }
      sctx.stroke();
      sctx.restore();

      return sprite;
    }

    function tagSpriteCanvas(sprite, key) {
      if (!sprite || typeof sprite !== "object") {
        return sprite;
      }
      try {
        sprite.__vibeSpriteKey = String(key || "");
      } catch (_error) {
        // Canvas tagging is best-effort only.
      }
      return sprite;
    }

    function createVariantFrames(variantCount, frameCount, buildFrame, familyKey = "projectile") {
      return Array.from({ length: variantCount }, (_, variantIndex) =>
        Array.from({ length: frameCount }, (_, frameIndex) =>
          tagSpriteCanvas(buildFrame(variantIndex, frameIndex), `${familyKey}:v${variantIndex}:f${frameIndex}`)
        )
      );
    }

    function createFrostboltSprite(variantIndex, frameIndex) {
      const size = 68;
      const sprite = createSpriteCanvas(size);
      const sctx = sprite.getContext("2d");
      const cx = size * 0.56;
      const cy = size * 0.5;
      const phase = frameIndex / FROSTBOLT_FRAMES;

      sctx.save();
      sctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i += 1) {
        const t = (i + 1) / 9;
        const wobble = Math.sin(phase * Math.PI * 2 + variantIndex * 0.7 + i * 1.17) * (1.1 - t * 0.7) * 2.2;
        const dist = 7 + t * 24 + seededUnit(variantIndex + 17, i * 19 + frameIndex * 11) * 2;
        const px = cx - dist;
        const py = cy + wobble;
        const pr = Math.max(0.8, 2.4 - t * 1.7);
        const alpha = 0.36 * (1 - t) + 0.1;
        sctx.beginPath();
        sctx.fillStyle = `rgba(156, 223, 255, ${alpha.toFixed(3)})`;
        sctx.arc(px, py, pr, 0, Math.PI * 2);
        sctx.fill();
      }

      const glow = sctx.createRadialGradient(cx, cy, 1.2, cx, cy, 13.8);
      glow.addColorStop(0, "rgba(242, 253, 255, 0.97)");
      glow.addColorStop(0.35, "rgba(171, 233, 255, 0.9)");
      glow.addColorStop(0.7, "rgba(103, 185, 242, 0.48)");
      glow.addColorStop(1, "rgba(75, 157, 224, 0)");
      sctx.fillStyle = glow;
      sctx.beginPath();
      sctx.arc(cx, cy, 13.8, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      const spearLength = 17;
      const spearWidth = 4.6;
      const tipX = cx + spearLength;
      const tipY = cy;
      const backX = cx - 5.2;
      const backY = cy;
      const leftX = cx;
      const leftY = cy - spearWidth;
      const rightX = cx;
      const rightY = cy + spearWidth;

      sctx.beginPath();
      sctx.fillStyle = "rgba(198, 244, 255, 0.95)";
      sctx.strokeStyle = "rgba(107, 180, 231, 0.95)";
      sctx.lineWidth = 1.8;
      sctx.moveTo(tipX, tipY);
      sctx.lineTo(leftX, leftY);
      sctx.lineTo(backX, backY);
      sctx.lineTo(rightX, rightY);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      sctx.beginPath();
      sctx.strokeStyle = "rgba(236, 253, 255, 0.9)";
      sctx.lineWidth = 1.2;
      sctx.moveTo(backX + 1.4, backY);
      sctx.lineTo(tipX, tipY);
      sctx.stroke();

      sctx.strokeStyle = "rgba(209, 244, 255, 0.85)";
      sctx.lineWidth = 1.1;
      for (let i = 0; i < 5; i += 1) {
        const a = phase * Math.PI * 2 + i * ((Math.PI * 2) / 5) + variantIndex * 0.42;
        const r = 7 + (i % 2) * 2 + Math.sin(phase * Math.PI * 2 + i) * 0.8;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r;
        sctx.beginPath();
        sctx.moveTo(sx - 1.4, sy);
        sctx.lineTo(sx + 1.4, sy);
        sctx.moveTo(sx, sy - 1.4);
        sctx.lineTo(sx, sy + 1.4);
        sctx.stroke();
      }

      return sprite;
    }

    function createArcaneMissileSprite(variantIndex, frameIndex) {
      const size = 78;
      const sprite = createSpriteCanvas(size);
      const sctx = sprite.getContext("2d");
      const cx = size * 0.56;
      const cy = size * 0.5;
      const phase = frameIndex / ARCANE_MISSILE_FRAMES;

      sctx.save();
      sctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 11; i += 1) {
        const t = (i + 1) / 11;
        const dist = 6 + t * 22;
        const wobble =
          Math.sin(phase * Math.PI * 2 + variantIndex * 0.9 + i * 0.9) * (2.6 - t * 1.5) +
          (seededUnit(variantIndex + 31, i * 29 + frameIndex * 7) - 0.5) * 1.3;
        const px = cx - dist;
        const py = cy + wobble;
        const radius = Math.max(0.7, 2.2 - t * 1.6);
        const alpha = 0.35 * (1 - t) + 0.08;
        sctx.beginPath();
        sctx.fillStyle = `rgba(207, 176, 255, ${alpha.toFixed(3)})`;
        sctx.arc(px, py, radius, 0, Math.PI * 2);
        sctx.fill();
      }
      const glow = sctx.createRadialGradient(cx, cy, 1.2, cx, cy, 14.5);
      glow.addColorStop(0, "rgba(255, 246, 255, 0.98)");
      glow.addColorStop(0.35, "rgba(212, 186, 255, 0.9)");
      glow.addColorStop(0.7, "rgba(145, 100, 222, 0.5)");
      glow.addColorStop(1, "rgba(91, 63, 173, 0)");
      sctx.fillStyle = glow;
      sctx.beginPath();
      sctx.arc(cx, cy, 14.5, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      const tipX = cx + 15.5;
      const tipY = cy;
      const backX = cx - 6.2;
      const backY = cy;
      const wing = 4.8;
      sctx.beginPath();
      sctx.fillStyle = "rgba(242, 231, 255, 0.96)";
      sctx.strokeStyle = "rgba(146, 117, 214, 0.95)";
      sctx.lineWidth = 1.7;
      sctx.moveTo(tipX, tipY);
      sctx.lineTo(cx, cy - wing);
      sctx.lineTo(backX, backY);
      sctx.lineTo(cx, cy + wing);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      const coreGrad = sctx.createLinearGradient(backX, backY, tipX, tipY);
      coreGrad.addColorStop(0, "rgba(128, 93, 205, 0.55)");
      coreGrad.addColorStop(0.5, "rgba(252, 240, 255, 0.98)");
      coreGrad.addColorStop(1, "rgba(178, 140, 236, 0.78)");
      sctx.strokeStyle = coreGrad;
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.moveTo(backX + 1.2, backY);
      sctx.lineTo(tipX, tipY);
      sctx.stroke();

      sctx.lineCap = "round";
      for (let band = 0; band < 3; band += 1) {
        sctx.beginPath();
        sctx.strokeStyle = `rgba(232, 214, 255, ${(0.7 - band * 0.14).toFixed(3)})`;
        sctx.lineWidth = 1.2 + (2 - band) * 0.35;
        for (let i = 0; i <= 24; i += 1) {
          const t = i / 24;
          const dist = -8 + t * 30;
          const swirlPhase = phase * Math.PI * 2 + variantIndex * 1.1 + band * 2.0 + t * 11.5;
          const radius = (1 - Math.abs(t - 0.5) * 1.15) * (5.6 - band * 1.15);
          const swirl = Math.sin(swirlPhase) * radius;
          const x = cx - dist;
          const y = cy + swirl;
          if (i === 0) {
            sctx.moveTo(x, y);
          } else {
            sctx.lineTo(x, y);
          }
        }
        sctx.stroke();
      }

      sctx.strokeStyle = "rgba(244, 236, 255, 0.88)";
      sctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i += 1) {
        const a = phase * Math.PI * 2 * 0.8 + i * ((Math.PI * 2) / 6) + variantIndex * 0.35;
        const r = 7 + (i % 2) * 2 + Math.sin(phase * Math.PI * 2 + i) * 0.6;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r;
        sctx.beginPath();
        sctx.moveTo(sx - 1.4, sy);
        sctx.lineTo(sx + 1.4, sy);
        sctx.moveTo(sx, sy - 1.4);
        sctx.lineTo(sx, sy + 1.4);
        sctx.stroke();
      }

      return sprite;
    }

    function createBoneArrowSprite(variantIndex, frameIndex) {
      return createArrowSprite(variantIndex, frameIndex, {
        size: 54,
        length: 25,
        wing: 4.6,
        shaftColor: "#d8dde6",
        fletchColor: "#6d7581",
        headColor: "#c2ccd8",
        edgeColor: "#808a9a",
        glowColor: "rgba(228, 233, 242, 0.18)",
        accentColor: "rgba(255, 255, 255, 0.72)",
        tailColor: "rgba(226, 233, 242, ALPHA)"
      });
    }

    function createArrowSprite(variantIndex, frameIndex, options = {}) {
      const size = Math.max(40, Number(options.size) || 60);
      const sprite = createSpriteCanvas(size);
      const sctx = sprite.getContext("2d");
      const cx = size * 0.56;
      const cy = size * 0.5;
      const phase = frameIndex / ARROW_FRAMES;
      const trailAlpha = 0.16 + (Number(options.trailAlpha) || 0.2);
      const shaftColor = options.shaftColor || "#c8d3df";
      const fletchColor = options.fletchColor || "#8fa0b7";
      const headColor = options.headColor || "#e7eff8";
      const edgeColor = options.edgeColor || "#697a92";
      const glowColor = options.glowColor || "rgba(224, 236, 255, 0.55)";
      const accentColor = options.accentColor || "rgba(255,255,255,0.8)";
      const tailColor = options.tailColor || glowColor;
      const baseLength = Number(options.length) || size * 0.38;
      const wing = Number(options.wing) || size * 0.09;
      const shaftBack = cx - baseLength * 0.62;
      const headTip = cx + baseLength * 0.58;

      sctx.save();
      sctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i += 1) {
        const t = (i + 1) / 6;
        const dist = 4 + t * (baseLength * 0.95);
        const wobble = Math.sin(phase * Math.PI * 2 + variantIndex * 0.9 + i * 0.85) * (1.5 - t);
        const px = cx - dist;
        const py = cy + wobble;
        sctx.beginPath();
        sctx.fillStyle = tailColor.replace("ALPHA", (trailAlpha * (1 - t)).toFixed(3));
        sctx.arc(px, py, Math.max(0.5, 1.8 - t * 1.2), 0, Math.PI * 2);
        sctx.fill();
      }
      const glow = sctx.createRadialGradient(cx, cy, 1, cx, cy, size * 0.22);
      glow.addColorStop(0, accentColor);
      glow.addColorStop(0.52, glowColor);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      sctx.fillStyle = glow;
      sctx.beginPath();
      sctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      sctx.save();
      sctx.translate(cx, cy);
      sctx.lineCap = "round";
      sctx.lineJoin = "round";

      sctx.strokeStyle = shaftColor;
      sctx.lineWidth = 2.2;
      sctx.beginPath();
      sctx.moveTo(-baseLength * 0.54, 0);
      sctx.lineTo(baseLength * 0.42, 0);
      sctx.stroke();

      sctx.fillStyle = headColor;
      sctx.strokeStyle = edgeColor;
      sctx.lineWidth = 1.3;
      sctx.beginPath();
      sctx.moveTo(baseLength * 0.58, 0);
      sctx.lineTo(baseLength * 0.3, -wing);
      sctx.lineTo(baseLength * 0.38, 0);
      sctx.lineTo(baseLength * 0.3, wing);
      sctx.closePath();
      sctx.fill();
      sctx.stroke();

      sctx.fillStyle = fletchColor;
      sctx.beginPath();
      sctx.moveTo(-baseLength * 0.55, 0);
      sctx.lineTo(-baseLength * 0.78, -wing * 0.9);
      sctx.lineTo(-baseLength * 0.66, -wing * 0.1);
      sctx.closePath();
      sctx.moveTo(-baseLength * 0.55, 0);
      sctx.lineTo(-baseLength * 0.78, wing * 0.9);
      sctx.lineTo(-baseLength * 0.66, wing * 0.1);
      sctx.closePath();
      sctx.fill();

      if (options.ringColor) {
        sctx.strokeStyle = options.ringColor;
        sctx.lineWidth = 1.2;
        sctx.beginPath();
        sctx.moveTo(-baseLength * 0.08, -wing * 0.72);
        sctx.lineTo(-baseLength * 0.08, wing * 0.72);
        sctx.stroke();
      }
      sctx.restore();
      return sprite;
    }

    function createGrenadeSprite(variantIndex, frameIndex, options = {}) {
      const size = Math.max(44, Number(options.size) || 58);
      const sprite = createSpriteCanvas(size);
      const sctx = sprite.getContext("2d");
      const cx = size * 0.5;
      const cy = size * 0.5;
      const phase = frameIndex / GRENADE_FRAMES;
      const wobble = Math.sin(phase * Math.PI * 2 + variantIndex * 0.7) * 0.12;
      const bodyFill = options.bodyFill || "#556577";
      const bodyStroke = options.bodyStroke || "#d9e0ea";
      const bandFill = options.bandFill || "#c39d52";
      const fuseGlow = options.fuseGlow || "rgba(255, 176, 78, 0.7)";
      const fuseSpark = options.fuseSpark || "rgba(255, 241, 188, 0.92)";
      const trailColor = options.trailColor || "rgba(240, 228, 190, ALPHA)";

      sctx.save();
      sctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i += 1) {
        const t = (i + 1) / 6;
        const dist = 5 + t * 16;
        const px = cx - dist;
        const py = cy + Math.sin(phase * Math.PI * 2 + i * 1.1) * (1.6 - t);
        sctx.beginPath();
        sctx.fillStyle = trailColor.replace("ALPHA", (0.24 * (1 - t)).toFixed(3));
        sctx.arc(px, py, Math.max(0.4, 1.6 - t), 0, Math.PI * 2);
        sctx.fill();
      }
      sctx.restore();

      sctx.save();
      sctx.translate(cx, cy);
      sctx.rotate(wobble);

      sctx.fillStyle = bodyFill;
      sctx.strokeStyle = bodyStroke;
      sctx.lineWidth = 1.9;
      sctx.beginPath();
      sctx.roundRect(-10, -8, 20, 16, 5);
      sctx.fill();
      sctx.stroke();

      sctx.fillStyle = bandFill;
      sctx.fillRect(-11, -2.2, 22, 4.4);
      sctx.strokeStyle = "rgba(38, 31, 21, 0.5)";
      sctx.lineWidth = 1;
      sctx.strokeRect(-11, -2.2, 22, 4.4);

      sctx.strokeStyle = "#7b5d35";
      sctx.lineWidth = 1.6;
      sctx.beginPath();
      sctx.moveTo(4, -8);
      sctx.quadraticCurveTo(9, -12, 9, -17);
      sctx.stroke();

      const sparkX = 9;
      const sparkY = -17;
      const sparkGlow = sctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, 8);
      sparkGlow.addColorStop(0, fuseSpark);
      sparkGlow.addColorStop(0.4, fuseGlow);
      sparkGlow.addColorStop(1, "rgba(0,0,0,0)");
      sctx.fillStyle = sparkGlow;
      sctx.beginPath();
      sctx.arc(sparkX, sparkY, 8, 0, Math.PI * 2);
      sctx.fill();

      sctx.strokeStyle = "rgba(255, 219, 148, 0.9)";
      sctx.lineWidth = 1.1;
      for (let i = 0; i < 4; i += 1) {
        const a = (Math.PI * 2 * i) / 4 + phase * 0.6;
        sctx.beginPath();
        sctx.moveTo(sparkX + Math.cos(a) * 1.5, sparkY + Math.sin(a) * 1.5);
        sctx.lineTo(sparkX + Math.cos(a) * 4.1, sparkY + Math.sin(a) * 4.1);
        sctx.stroke();
      }
      sctx.restore();
      return sprite;
    }

    const fireballSprites = createVariantFrames(FIREBALL_VARIANTS, FIREBALL_FRAMES, createFireballSprite, "fireball");
    const fireSparkSprites = createVariantFrames(FIRE_SPARK_VARIANTS, FIRE_SPARK_FRAMES, createFireSparkSprite, "fire_spark");
    const frostboltSprites = createVariantFrames(FROSTBOLT_VARIANTS, FROSTBOLT_FRAMES, createFrostboltSprite, "frostbolt");
    const arcaneMissileSprites = createVariantFrames(
      ARCANE_MISSILE_VARIANTS,
      ARCANE_MISSILE_FRAMES,
      createArcaneMissileSprite,
      "arcane_missiles"
    );
    const boneArrowSprites = createVariantFrames(BONE_ARROW_VARIANTS, BONE_ARROW_FRAMES, createBoneArrowSprite, "bone_arrow");
    const rangerArrowSprites = createVariantFrames(ARROW_VARIANTS, ARROW_FRAMES, (variant, frame) =>
      createArrowSprite(variant, frame, {
        shaftColor: "#d9dfeb",
        fletchColor: "#89a0bf",
        headColor: "#f3f8ff",
        edgeColor: "#61728b",
        glowColor: "rgba(196, 215, 255, 0.36)",
        accentColor: "rgba(244, 250, 255, 0.84)",
        tailColor: "rgba(206, 221, 255, ALPHA)",
        ringColor: "rgba(244, 247, 255, 0.72)"
      })
    , "ranger_arrow");
    const poisonArrowSprites = createVariantFrames(ARROW_VARIANTS, ARROW_FRAMES, (variant, frame) =>
      createArrowSprite(variant, frame, {
        shaftColor: "#bfd8c1",
        fletchColor: "#4c7d4c",
        headColor: "#d8ffc3",
        edgeColor: "#6ba262",
        glowColor: "rgba(102, 212, 112, 0.34)",
        accentColor: "rgba(233, 255, 210, 0.88)",
        tailColor: "rgba(117, 226, 139, ALPHA)",
        ringColor: "rgba(190, 255, 184, 0.72)"
      })
    , "poison_arrow");
    const explosiveArrowSprites = createVariantFrames(ARROW_VARIANTS, ARROW_FRAMES, (variant, frame) =>
      createArrowSprite(variant, frame, {
        shaftColor: "#e8d2ba",
        fletchColor: "#9f6849",
        headColor: "#ffc18b",
        edgeColor: "#8e3222",
        glowColor: "rgba(255, 125, 62, 0.4)",
        accentColor: "rgba(255, 234, 176, 0.88)",
        tailColor: "rgba(255, 152, 76, ALPHA)",
        ringColor: "rgba(255, 204, 124, 0.72)"
      })
    , "explosive_arrow");
    const shrapnelShardSprites = createVariantFrames(ARROW_VARIANTS, ARROW_FRAMES, (variant, frame) =>
      createArrowSprite(variant, frame, {
        size: 50,
        length: 22,
        wing: 4.2,
        shaftColor: "#d6dde6",
        fletchColor: "#6a7584",
        headColor: "#eef4fa",
        edgeColor: "#7d8998",
        glowColor: "rgba(246, 222, 164, 0.2)",
        accentColor: "rgba(255, 251, 240, 0.74)",
        tailColor: "rgba(228, 216, 184, ALPHA)"
      })
    , "shrapnel_shard");
    const ballistaBoltSprites = createVariantFrames(ARROW_VARIANTS, ARROW_FRAMES, (variant, frame) =>
      createArrowSprite(variant, frame, {
        size: 66,
        length: 34,
        wing: 6.5,
        shaftColor: "#d6c39b",
        fletchColor: "#6c4333",
        headColor: "#edf4fb",
        edgeColor: "#708096",
        glowColor: "rgba(228, 214, 176, 0.24)",
        accentColor: "rgba(255, 250, 235, 0.8)",
        tailColor: "rgba(219, 208, 172, ALPHA)",
        ringColor: "rgba(171, 122, 71, 0.8)"
      })
    , "ballista_bolt");
    const shrapnelGrenadeSprites = createVariantFrames(GRENADE_VARIANTS, GRENADE_FRAMES, (variant, frame) =>
      createGrenadeSprite(variant, frame, {
        bodyFill: "#5e6673",
        bodyStroke: "#d9dfe8",
        bandFill: "#bf9150",
        fuseGlow: "rgba(255, 156, 88, 0.74)",
        fuseSpark: "rgba(255, 247, 196, 0.94)",
        trailColor: "rgba(255, 222, 172, ALPHA)"
      })
    , "shrapnel_grenade");

    function getProjectileVisualState(projectile, now) {
      const key = String(projectile.id ?? "");
      let state = deps.projectileVisualRuntime.get(key);
      if (!state) {
        state = {
          seed: deps.hashString(key || `${Math.random()}`),
          lastX: projectile.x,
          lastY: projectile.y,
          dirX: 0,
          dirY: -1,
          lastSeenAt: now
        };
      }

      const motion = normalizeDirection(projectile.x - state.lastX, projectile.y - state.lastY);
      if (motion) {
        const blendX = state.dirX * 0.68 + motion.dx * 0.32;
        const blendY = state.dirY * 0.68 + motion.dy * 0.32;
        const blended = normalizeDirection(blendX, blendY);
        if (blended) {
          state.dirX = blended.dx;
          state.dirY = blended.dy;
        }
      }

      state.lastX = projectile.x;
      state.lastY = projectile.y;
      state.lastSeenAt = now;
      deps.projectileVisualRuntime.set(key, state);
      return state;
    }

    function pruneProjectileVisualRuntime(now = performance.now()) {
      for (const [key, state] of deps.projectileVisualRuntime.entries()) {
        if (now - state.lastSeenAt > 1400) {
          deps.projectileVisualRuntime.delete(key);
        }
      }
    }

    function drawFireballProjectile(p, runtime, now) {
      const heading = Math.atan2(runtime.dirY, runtime.dirX);
      const variant = getVariantIndex(runtime.seed, FIREBALL_VARIANTS);
      const frame = getFrameIndex(now, FIREBALL_FRAMES, FIREBALL_FRAME_MS);
      drawRotatedSprite(fireballSprites[variant][frame], p.x, p.y, heading);
    }

    function drawFireSparkProjectile(p, runtime, now) {
      const heading = Math.atan2(runtime.dirY, runtime.dirX);
      const variant = getVariantIndex(runtime.seed, FIRE_SPARK_VARIANTS);
      const frame = getFrameIndex(now, FIRE_SPARK_FRAMES, FIRE_SPARK_FRAME_MS);
      drawRotatedSprite(fireSparkSprites[variant][frame], p.x, p.y, heading);
    }

    function drawCachedSpriteProjectile(spriteSets, variantCount, frameCount, frameMs, p, runtime, now, headingOffset = 0) {
      const heading = Math.atan2(runtime.dirY, runtime.dirX) + headingOffset;
      const variant = getVariantIndex(runtime.seed, variantCount);
      const frame = getFrameIndex(now, frameCount, frameMs);
      drawRotatedSprite(spriteSets[variant][frame], p.x, p.y, heading);
    }

    function drawRangerArrowProjectile(p, runtime, now) {
      drawCachedSpriteProjectile(rangerArrowSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, p, runtime, now);
    }

    function drawPoisonArrowProjectile(p, runtime, now) {
      drawCachedSpriteProjectile(poisonArrowSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, p, runtime, now);
    }

    function drawExplosiveArrowProjectile(p, runtime, now) {
      drawCachedSpriteProjectile(explosiveArrowSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, p, runtime, now);
    }

    function drawShrapnelGrenadeProjectile(p, runtime, now) {
      drawCachedSpriteProjectile(
        shrapnelGrenadeSprites,
        GRENADE_VARIANTS,
        GRENADE_FRAMES,
        GRENADE_FRAME_MS,
        p,
        runtime,
        now
      );
    }

    function drawShrapnelShardProjectile(p, runtime, now) {
      drawCachedSpriteProjectile(shrapnelShardSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, p, runtime, now);
    }

    function drawBallistaBoltProjectile(p, runtime, now) {
      drawCachedSpriteProjectile(ballistaBoltSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, p, runtime, now);
    }

    function getCachedProjectileSpriteFrame(spriteSets, variantCount, frameCount, frameMs, runtime, now, headingOffset = 0) {
      const heading = Math.atan2(runtime.dirY, runtime.dirX) + headingOffset;
      const variant = getVariantIndex(runtime.seed, variantCount);
      const frame = getFrameIndex(now, frameCount, frameMs);
      return {
        canvas: spriteSets[variant][frame],
        rotation: heading
      };
    }

    function drawFrostboltProjectile(p, runtime, now) {
      const dirX = runtime.dirX;
      const dirY = runtime.dirY;
      const perpX = -dirY;
      const perpY = dirX;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < 9; i += 1) {
        const t = (i + 1) / 9;
        const wobble =
          (seededUnit(runtime.seed, i * 17 + 3) - 0.5) * 3.2 +
          Math.sin(now * 0.01 + i * 1.2 + runtime.seed * 0.0005) * (1.1 - t * 0.7);
        const dist = 6 + t * 24 + seededUnit(runtime.seed, i * 19 + 7) * 2;
        const px = p.x - dirX * dist + perpX * wobble;
        const py = p.y - dirY * dist + perpY * wobble;
        const pr = Math.max(0.8, 2.4 - t * 1.7);
        const alpha = 0.36 * (1 - t) + 0.1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(156, 223, 255, ${alpha.toFixed(3)})`;
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      const glow = ctx.createRadialGradient(p.x, p.y, 1.2, p.x, p.y, 13.8);
      glow.addColorStop(0, "rgba(242, 253, 255, 0.97)");
      glow.addColorStop(0.35, "rgba(171, 233, 255, 0.9)");
      glow.addColorStop(0.7, "rgba(103, 185, 242, 0.48)");
      glow.addColorStop(1, "rgba(75, 157, 224, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const spearLength = 17;
      const spearWidth = 4.6;
      const tipX = p.x + dirX * spearLength;
      const tipY = p.y + dirY * spearLength;
      const backX = p.x - dirX * 5.2;
      const backY = p.y - dirY * 5.2;
      const leftX = p.x + perpX * spearWidth;
      const leftY = p.y + perpY * spearWidth;
      const rightX = p.x - perpX * spearWidth;
      const rightY = p.y - perpY * spearWidth;

      ctx.beginPath();
      ctx.fillStyle = "rgba(198, 244, 255, 0.95)";
      ctx.strokeStyle = "rgba(107, 180, 231, 0.95)";
      ctx.lineWidth = 1.8;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(backX, backY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(236, 253, 255, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.moveTo(backX + dirX * 1.4, backY + dirY * 1.4);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Sparkle flakes around the bolt.
      ctx.strokeStyle = "rgba(209, 244, 255, 0.85)";
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 5; i += 1) {
        const a = now * 0.004 + i * ((Math.PI * 2) / 5);
        const r = 7 + (i % 2) * 2 + Math.sin(now * 0.01 + i) * 0.8;
        const sx = p.x + Math.cos(a) * r;
        const sy = p.y + Math.sin(a) * r;
        ctx.beginPath();
        ctx.moveTo(sx - 1.4, sy);
        ctx.lineTo(sx + 1.4, sy);
        ctx.moveTo(sx, sy - 1.4);
        ctx.lineTo(sx, sy + 1.4);
        ctx.stroke();
      }
    }

    function drawArcaneMissileProjectile(p, runtime, now) {
      const dirX = runtime.dirX;
      const dirY = runtime.dirY;
      const perpX = -dirY;
      const perpY = dirX;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 11; i += 1) {
        const t = (i + 1) / 11;
        const dist = 6 + t * 22;
        const wobble =
          Math.sin(now * 0.015 + runtime.seed * 0.0011 + i * 0.9) * (2.6 - t * 1.5) +
          (seededUnit(runtime.seed, i * 29 + 11) - 0.5) * 1.3;
        const px = p.x - dirX * dist + perpX * wobble;
        const py = p.y - dirY * dist + perpY * wobble;
        const radius = Math.max(0.7, 2.2 - t * 1.6);
        const alpha = 0.35 * (1 - t) + 0.08;
        ctx.beginPath();
        ctx.fillStyle = `rgba(207, 176, 255, ${alpha.toFixed(3)})`;
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(p.x, p.y, 1.2, p.x, p.y, 14.5);
      glow.addColorStop(0, "rgba(255, 246, 255, 0.98)");
      glow.addColorStop(0.35, "rgba(212, 186, 255, 0.9)");
      glow.addColorStop(0.7, "rgba(145, 100, 222, 0.5)");
      glow.addColorStop(1, "rgba(91, 63, 173, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const tipX = p.x + dirX * 15.5;
      const tipY = p.y + dirY * 15.5;
      const backX = p.x - dirX * 6.2;
      const backY = p.y - dirY * 6.2;
      const wing = 4.8;
      ctx.beginPath();
      ctx.fillStyle = "rgba(242, 231, 255, 0.96)";
      ctx.strokeStyle = "rgba(146, 117, 214, 0.95)";
      ctx.lineWidth = 1.7;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(p.x + perpX * wing, p.y + perpY * wing);
      ctx.lineTo(backX, backY);
      ctx.lineTo(p.x - perpX * wing, p.y - perpY * wing);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const coreGrad = ctx.createLinearGradient(backX, backY, tipX, tipY);
      coreGrad.addColorStop(0, "rgba(128, 93, 205, 0.55)");
      coreGrad.addColorStop(0.5, "rgba(252, 240, 255, 0.98)");
      coreGrad.addColorStop(1, "rgba(178, 140, 236, 0.78)");
      ctx.strokeStyle = coreGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(backX + dirX * 1.2, backY + dirY * 1.2);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.lineCap = "round";
      for (let band = 0; band < 3; band += 1) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(232, 214, 255, ${(0.7 - band * 0.14).toFixed(3)})`;
        ctx.lineWidth = 1.2 + (2 - band) * 0.35;
        for (let i = 0; i <= 24; i += 1) {
          const t = i / 24;
          const dist = -8 + t * 30;
          const phase = now * 0.016 + runtime.seed * 0.0013 + band * 2.0 + t * 11.5;
          const radius = (1 - Math.abs(t - 0.5) * 1.15) * (5.6 - band * 1.15);
          const swirl = Math.sin(phase) * radius;
          const x = p.x - dirX * dist + perpX * swirl;
          const y = p.y - dirY * dist + perpY * swirl;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(244, 236, 255, 0.88)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i += 1) {
        const a = now * 0.0048 + i * ((Math.PI * 2) / 6) + runtime.seed * 0.0008;
        const r = 7 + (i % 2) * 2 + Math.sin(now * 0.01 + i) * 0.6;
        const sx = p.x + Math.cos(a) * r;
        const sy = p.y + Math.sin(a) * r;
        ctx.beginPath();
        ctx.moveTo(sx - 1.4, sy);
        ctx.lineTo(sx + 1.4, sy);
        ctx.moveTo(sx, sy - 1.4);
        ctx.lineTo(sx, sy + 1.4);
        ctx.stroke();
      }
    }

    function drawBoneArrowProjectile(p, runtime, now) {
      const dirX = runtime.dirX;
      const dirY = runtime.dirY;
      const perpX = -dirY;
      const perpY = dirX;
      const heading = Math.atan2(dirY, dirX);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i += 1) {
        const t = (i + 1) / 5;
        const dist = 4 + t * 14;
        const wobble = Math.sin(now * 0.012 + i * 1.1 + runtime.seed * 0.0007) * (1.2 - t * 0.7);
        const px = p.x - dirX * dist + perpX * wobble;
        const py = p.y - dirY * dist + perpY * wobble;
        const r = Math.max(0.45, 1.5 - t * 1.1);
        const alpha = 0.2 * (1 - t) + 0.06;
        ctx.beginPath();
        ctx.fillStyle = `rgba(226, 233, 242, ${alpha.toFixed(3)})`;
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(heading);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Shaft.
      ctx.strokeStyle = "rgba(216, 221, 230, 0.98)";
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-11.5, 0);
      ctx.lineTo(11, 0);
      ctx.stroke();

      // Head.
      ctx.fillStyle = "rgba(189, 199, 212, 0.98)";
      ctx.strokeStyle = "rgba(128, 138, 154, 0.95)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(13.8, 0);
      ctx.lineTo(9.2, -2.7);
      ctx.lineTo(10.2, 0);
      ctx.lineTo(9.2, 2.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fletching.
      ctx.fillStyle = "rgba(109, 117, 129, 0.95)";
      ctx.beginPath();
      ctx.moveTo(-11.3, 0);
      ctx.lineTo(-15.1, -2.5);
      ctx.lineTo(-13.3, -0.2);
      ctx.closePath();
      ctx.moveTo(-11.3, 0);
      ctx.lineTo(-15.1, 2.5);
      ctx.lineTo(-13.3, 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const ABILITY_PROJECTILE_RENDERERS = Object.freeze({
      fireball: drawFireballProjectile,
      fire_spark: drawFireSparkProjectile,
      frostbolt: drawFrostboltProjectile,
      arcane_missiles: drawArcaneMissileProjectile,
      bone_arrow: drawBoneArrowProjectile,
      ranger_arrow: drawRangerArrowProjectile,
      poison_arrow: drawPoisonArrowProjectile,
      explosive_arrow: drawExplosiveArrowProjectile,
      shrapnel_grenade: drawShrapnelGrenadeProjectile,
      shrapnel_shard: drawShrapnelShardProjectile,
      ballista_bolt: drawBallistaBoltProjectile
    });

    function getProjectileSpriteFrame(projectile, frameNow) {
      const now = Number.isFinite(frameNow) ? frameNow : performance.now();
      const runtime = getProjectileVisualState(projectile, now);
      const abilityId = String(projectile && projectile.abilityId || "");
      const actionDef = deps.getActionDefById(abilityId);
      const projectileHook = deps.getAbilityVisualHook(abilityId, actionDef, "projectileRenderer", "default");
      if (projectileHook === "fireball") {
        return getCachedProjectileSpriteFrame(fireballSprites, FIREBALL_VARIANTS, FIREBALL_FRAMES, FIREBALL_FRAME_MS, runtime, now);
      }
      if (projectileHook === "fire_spark") {
        return getCachedProjectileSpriteFrame(fireSparkSprites, FIRE_SPARK_VARIANTS, FIRE_SPARK_FRAMES, FIRE_SPARK_FRAME_MS, runtime, now);
      }
      if (projectileHook === "frostbolt") {
        return getCachedProjectileSpriteFrame(frostboltSprites, FROSTBOLT_VARIANTS, FROSTBOLT_FRAMES, FROSTBOLT_FRAME_MS, runtime, now);
      }
      if (projectileHook === "arcane_missiles") {
        return getCachedProjectileSpriteFrame(
          arcaneMissileSprites,
          ARCANE_MISSILE_VARIANTS,
          ARCANE_MISSILE_FRAMES,
          ARCANE_MISSILE_FRAME_MS,
          runtime,
          now
        );
      }
      if (projectileHook === "bone_arrow") {
        return getCachedProjectileSpriteFrame(boneArrowSprites, BONE_ARROW_VARIANTS, BONE_ARROW_FRAMES, BONE_ARROW_FRAME_MS, runtime, now);
      }
      if (projectileHook === "ranger_arrow") {
        return getCachedProjectileSpriteFrame(rangerArrowSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, runtime, now);
      }
      if (projectileHook === "poison_arrow") {
        return getCachedProjectileSpriteFrame(poisonArrowSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, runtime, now);
      }
      if (projectileHook === "explosive_arrow") {
        return getCachedProjectileSpriteFrame(explosiveArrowSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, runtime, now);
      }
      if (projectileHook === "shrapnel_grenade") {
        return getCachedProjectileSpriteFrame(shrapnelGrenadeSprites, GRENADE_VARIANTS, GRENADE_FRAMES, GRENADE_FRAME_MS, runtime, now);
      }
      if (projectileHook === "shrapnel_shard") {
        return getCachedProjectileSpriteFrame(shrapnelShardSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, runtime, now);
      }
      if (projectileHook === "ballista_bolt") {
        return getCachedProjectileSpriteFrame(ballistaBoltSprites, ARROW_VARIANTS, ARROW_FRAMES, ARROW_FRAME_MS, runtime, now);
      }
      return null;
    }

    function drawProjectile(projectile, cameraX, cameraY, frameNow) {
      const p = deps.worldToScreen(projectile.x + 0.5, projectile.y + 0.5, cameraX, cameraY);
      const now = Number.isFinite(frameNow) ? frameNow : performance.now();
      const runtime = getProjectileVisualState(projectile, now);
      const abilityId = String(projectile.abilityId || "");
      const actionDef = deps.getActionDefById(abilityId);
      const projectileHook = deps.getAbilityVisualHook(abilityId, actionDef, "projectileRenderer", "default");
      const drawProjectileEffect = ABILITY_PROJECTILE_RENDERERS[projectileHook];

      if (drawProjectileEffect) {
        drawProjectileEffect(p, runtime, now);
        return;
      }

      ctx.beginPath();
      ctx.fillStyle = "#c8d9ee";
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    return {
      pruneProjectileVisualRuntime,
      drawProjectile,
      getProjectileSpriteFrame
    };
  }

  globalScope.VibeClientRenderProjectiles = Object.freeze({
    createProjectileRenderTools
  });
})(globalThis);
