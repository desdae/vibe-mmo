(function initVibeClientPixiParticleSystem(globalScope) {
  "use strict";

  function createPixiParticleSystem(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const PIXI = deps.PIXI || globalScope.PIXI;
    const parentContainer = deps.parentContainer || null;
    const hashString =
      typeof deps.hashString === "function"
        ? deps.hashString
        : (value) => {
            const text = String(value || "");
            let hash = 0;
            for (let i = 0; i < text.length; i += 1) {
              hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
            }
            return hash >>> 0;
          };
    if (!PIXI || !parentContainer) {
      return null;
    }

    const emittersByKey = new Map();
    const textureCache = new Map();

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function seededUnit(seed) {
      const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return x - Math.floor(x);
    }

    function getRangeValue(range, seed, fallbackMin, fallbackMax) {
      if (Array.isArray(range) && range.length >= 2) {
        const min = Number(range[0]);
        const max = Number(range[1]);
        if (Number.isFinite(min) && Number.isFinite(max)) {
          return min + (max - min) * seededUnit(seed);
        }
      }
      const numeric = Number(range);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
      return fallbackMin + (fallbackMax - fallbackMin) * seededUnit(seed);
    }

    function getListValue(values, seed, fallback) {
      if (!Array.isArray(values) || !values.length) {
        return fallback;
      }
      const index = Math.max(0, Math.min(values.length - 1, Math.floor(seededUnit(seed) * values.length)));
      return values[index];
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

    function createParticleTexture(particle) {
      const shape = String(particle.shape || "sparkle");
      const size = Math.max(1.25, Number(particle.sizePx) || 0);
      const color = String(particle.color || "#ffffff");
      const glowColor = String(particle.glowColor || "");
      const key = `${shape}|${Math.round(size * 10) / 10}|${color}|${glowColor}`;
      if (textureCache.has(key)) {
        return textureCache.get(key);
      }
      const spriteSize = Math.max(14, Math.ceil(size * 12));
      const surface = createRuntimeCanvas(spriteSize, spriteSize);
      if (!surface) {
        textureCache.set(key, PIXI.Texture.WHITE);
        return PIXI.Texture.WHITE;
      }
      const ctx = surface.getContext("2d");
      if (!ctx) {
        textureCache.set(key, PIXI.Texture.WHITE);
        return PIXI.Texture.WHITE;
      }
      const center = spriteSize * 0.5;
      ctx.save();
      ctx.translate(center, center);
      if (glowColor) {
        ctx.shadowBlur = size * 3.5;
        ctx.shadowColor = glowColor;
      }
      if (shape === "dot") {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1, size * 0.24);
        const longArm = size * 1.35;
        const shortArm = longArm * 0.55;
        ctx.beginPath();
        ctx.moveTo(0, -longArm);
        ctx.lineTo(0, longArm);
        ctx.moveTo(-longArm, 0);
        ctx.lineTo(longArm, 0);
        ctx.stroke();
        ctx.lineWidth = Math.max(0.8, size * 0.15);
        ctx.beginPath();
        ctx.moveTo(-shortArm, -shortArm);
        ctx.lineTo(shortArm, shortArm);
        ctx.moveTo(shortArm, -shortArm);
        ctx.lineTo(-shortArm, shortArm);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.8, size * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      const texture = PIXI.Texture.from(surface);
      textureCache.set(key, texture);
      return texture;
    }

    function destroyEmitter(emitter) {
      if (!emitter) {
        return;
      }
      for (const particle of emitter.particles) {
        if (particle.sprite && particle.sprite.parent) {
          particle.sprite.parent.removeChild(particle.sprite);
        }
        if (particle.sprite && typeof particle.sprite.destroy === "function") {
          particle.sprite.destroy();
        }
      }
      emitter.particles.length = 0;
    }

    function spawnParticle(emitter, now, config) {
      emitter.spawnIndex += 1;
      const seedBase = emitter.seed + emitter.spawnIndex * 97.13;
      const spawnBox = config.spawnBox && typeof config.spawnBox === "object" ? config.spawnBox : {};
      const velocity = config.velocity && typeof config.velocity === "object" ? config.velocity : {};
      const acceleration = config.acceleration && typeof config.acceleration === "object" ? config.acceleration : {};
      const particle = {
        createdAt: now,
        lifeMs: Math.max(120, getRangeValue(config.lifeMs, seedBase + 2, 650, 1100)),
        offsetX: getRangeValue([spawnBox.minX, spawnBox.maxX], seedBase + 3, -0.1, 0.1),
        offsetY: getRangeValue([spawnBox.minY, spawnBox.maxY], seedBase + 4, -0.2, 0),
        vx: getRangeValue([velocity.minX, velocity.maxX], seedBase + 5, -0.01, 0.01),
        vy: getRangeValue([velocity.minY, velocity.maxY], seedBase + 6, -0.1, -0.03),
        ax: getRangeValue([acceleration.minX, acceleration.maxX], seedBase + 7, 0, 0),
        ay: getRangeValue([acceleration.minY, acceleration.maxY], seedBase + 8, 0.02, 0.06),
        sizePx: Math.max(0.8, getRangeValue(config.sizePx, seedBase + 9, 2, 4)),
        alpha: clamp(getRangeValue(config.alpha, seedBase + 10, 0.45, 0.95), 0, 1),
        twinkle: Math.max(0.3, getRangeValue(config.twinkle, seedBase + 11, 0.6, 1.2)),
        rotation: getRangeValue(config.rotation, seedBase + 12, 0, Math.PI * 2),
        spin: getRangeValue(config.spin, seedBase + 13, -1.2, 1.2),
        phase: getRangeValue(config.phase, seedBase + 14, 0, Math.PI * 2),
        color: String(getListValue(config.colors, seedBase + 15, "#ffe7a6") || "#ffe7a6"),
        glowColor: String(getListValue(config.glowColors, seedBase + 16, "") || ""),
        shape: String(getListValue(config.shapes, seedBase + 1, config.shape || "sparkle") || "sparkle"),
        sprite: null
      };
      const texture = createParticleTexture(particle);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = true;
      parentContainer.addChild(sprite);
      particle.sprite = sprite;
      emitter.particles.push(particle);
    }

    function syncEmitter(emitter, now, config) {
      const previousUpdatedAt = Number(emitter.updatedAt) || now;
      const dtSec = Math.max(0, (now - previousUpdatedAt) / 1000);
      emitter.updatedAt = now;
      emitter.lastSeenAt = now;

      const alive = [];
      for (const particle of emitter.particles) {
        const progress = (now - particle.createdAt) / particle.lifeMs;
        if (progress >= 1) {
          if (particle.sprite && particle.sprite.parent) {
            particle.sprite.parent.removeChild(particle.sprite);
          }
          if (particle.sprite && typeof particle.sprite.destroy === "function") {
            particle.sprite.destroy();
          }
          continue;
        }
        alive.push(particle);
      }
      emitter.particles = alive;

      const maxParticles = Math.max(0, Math.floor(Number(config.maxParticles) || 0));
      if (!emitter.initialized) {
        emitter.initialized = true;
        const burstCount = Math.max(0, Math.floor(Number(config.burstCount) || 0));
        for (let i = 0; i < burstCount && emitter.particles.length < maxParticles; i += 1) {
          spawnParticle(emitter, now - seededUnit(emitter.seed + i) * 220, config);
        }
      }
      emitter.spawnCarry += dtSec * Math.max(0, Number(config.spawnRate) || 0);
      while (emitter.spawnCarry >= 1 && emitter.particles.length < maxParticles) {
        emitter.spawnCarry -= 1;
        spawnParticle(emitter, now, config);
      }
    }

    function renderWorldEmitter(raw) {
      const options = raw && typeof raw === "object" ? raw : {};
      const key = String(options.key || "").trim();
      const worldToScreen = typeof options.worldToScreen === "function" ? options.worldToScreen : null;
      const config = options.config && typeof options.config === "object" ? options.config : null;
      const now = Number(options.now) || 0;
      if (!key || !worldToScreen || !config || !Number.isFinite(now)) {
        return;
      }
      let emitter = emittersByKey.get(key);
      if (!emitter) {
        emitter = {
          key,
          seed: hashString(key),
          particles: [],
          spawnCarry: 0,
          spawnIndex: 0,
          updatedAt: now,
          lastSeenAt: now,
          idleTimeoutMs: Math.max(300, Number(config.idleTimeoutMs) || 1600),
          initialized: false,
          originX: Number(options.x) || 0,
          originY: Number(options.y) || 0
        };
        emittersByKey.set(key, emitter);
      }
      emitter.originX = Number(options.x) || 0;
      emitter.originY = Number(options.y) || 0;
      emitter.idleTimeoutMs = Math.max(300, Number(config.idleTimeoutMs) || 1600);

      syncEmitter(emitter, now, config);
      for (const particle of emitter.particles) {
        if (!particle.sprite) {
          continue;
        }
        const ageSec = (now - particle.createdAt) / 1000;
        const progress = clamp((now - particle.createdAt) / particle.lifeMs, 0, 1);
        const worldX = emitter.originX + particle.offsetX + particle.vx * ageSec + 0.5 * particle.ax * ageSec * ageSec;
        const worldY = emitter.originY + particle.offsetY + particle.vy * ageSec + 0.5 * particle.ay * ageSec * ageSec;
        const screen = worldToScreen(worldX, worldY, options.cameraX, options.cameraY);
        if (!screen) {
          particle.sprite.visible = false;
          continue;
        }
        const twinkle =
          particle.shape === "dot"
            ? 1
            : 0.65 + Math.sin(progress * Math.PI * 2 + particle.phase) * 0.25 + Number(particle.twinkle) * 0.2;
        particle.sprite.visible = true;
        particle.sprite.position.set(screen.x, screen.y);
        particle.sprite.rotation = Number(particle.rotation) + Number(particle.spin || 0) * ageSec;
        particle.sprite.alpha = clamp(Number(particle.alpha) || 0.7, 0, 1) * (1 - progress * 0.85);
        particle.sprite.scale.set(clamp(twinkle, 0.45, 1.4));
      }
    }

    function pruneEmitters(now = performance.now()) {
      for (const [key, emitter] of emittersByKey.entries()) {
        const idleTimeoutMs = Math.max(300, Number(emitter && emitter.idleTimeoutMs) || 1600);
        if (now - (Number(emitter && emitter.lastSeenAt) || 0) > idleTimeoutMs) {
          destroyEmitter(emitter);
          emittersByKey.delete(key);
        }
      }
    }

    function clearEmitters() {
      for (const [, emitter] of emittersByKey.entries()) {
        destroyEmitter(emitter);
      }
      emittersByKey.clear();
    }

    return {
      renderWorldEmitter,
      pruneEmitters,
      clearEmitters
    };
  }

  globalScope.VibeClientPixiParticleSystem = Object.freeze({
    createPixiParticleSystem
  });
})(globalThis);
