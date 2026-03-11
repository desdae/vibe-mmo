(function initVibeClientParticleSystem(globalScope) {
  "use strict";

  function defaultClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createRuntimeCanvas(width, height) {
    const w = Math.max(1, Math.ceil(Number(width) || 1));
    const h = Math.max(1, Math.ceil(Number(height) || 1));
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(w, h);
    }
    if (typeof document !== "undefined" && document && typeof document.createElement === "function") {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      return canvas;
    }
    return null;
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

  function drawSparkleParticleVector(ctx, x, y, particle, progress) {
    const size = Math.max(1.25, Number(particle.sizePx) || 0);
    const twinkle = 0.65 + Math.sin(progress * Math.PI * 2 + particle.phase) * 0.25 + Number(particle.twinkle) * 0.2;
    const longArm = size * defaultClamp(twinkle, 0.45, 1.4);
    const shortArm = longArm * 0.55;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Number(particle.rotation) || 0);
    ctx.globalAlpha = defaultClamp(Number(particle.alpha) || 0.7, 0, 1) * (1 - progress * 0.85);
    ctx.strokeStyle = particle.color || "#ffe8a6";
    ctx.fillStyle = particle.color || "#fff6d8";
    if (particle.glowColor) {
      ctx.shadowBlur = size * 4;
      ctx.shadowColor = particle.glowColor;
    }
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, size * 0.22);

    ctx.beginPath();
    ctx.moveTo(0, -longArm);
    ctx.lineTo(0, longArm);
    ctx.moveTo(-longArm, 0);
    ctx.lineTo(longArm, 0);
    ctx.stroke();

    ctx.lineWidth = Math.max(0.8, size * 0.14);
    ctx.beginPath();
    ctx.moveTo(-shortArm, -shortArm);
    ctx.lineTo(shortArm, shortArm);
    ctx.moveTo(shortArm, -shortArm);
    ctx.lineTo(-shortArm, shortArm);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.8, size * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDotParticleVector(ctx, x, y, particle, progress) {
    const size = Math.max(0.8, Number(particle.sizePx) || 0);
    ctx.save();
    ctx.globalAlpha = defaultClamp(Number(particle.alpha) || 0.5, 0, 1) * (1 - progress * 0.9);
    ctx.fillStyle = particle.color || "#ffffff";
    if (particle.glowColor) {
      ctx.shadowBlur = size * 4;
      ctx.shadowColor = particle.glowColor;
    }
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function createParticleSystemTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const emittersByKey = deps.emittersByKey;
    if (!(emittersByKey instanceof Map)) {
      return null;
    }

    const clamp = typeof deps.clamp === "function" ? deps.clamp : defaultClamp;
    const hashString = typeof deps.hashString === "function" ? deps.hashString : (value) => String(value || "").length;
    const particleSpriteCache = new Map();
    const globalMaxParticles = Math.max(32, Math.floor(Number(deps.globalMaxParticles) || 320));

    function buildParticleSpriteCacheKey(particle) {
      const shape = String(particle.shape || "sparkle");
      const size = Math.max(1, Math.round((Number(particle.sizePx) || 0) * 10) / 10);
      const color = String(particle.color || "");
      const glow = String(particle.glowColor || "");
      return `${shape}|${size}|${color}|${glow}`;
    }

    function getCachedParticleSprite(particle) {
      const key = buildParticleSpriteCacheKey(particle);
      if (particleSpriteCache.has(key)) {
        return particleSpriteCache.get(key);
      }

      const size = Math.max(1.25, Number(particle.sizePx) || 0);
      const padding = Math.max(6, Math.ceil(size * 3.8));
      const spriteSize = Math.max(8, Math.ceil(size * 8 + padding * 2));
      const surface = createRuntimeCanvas(spriteSize, spriteSize);
      if (!surface) {
        particleSpriteCache.set(key, null);
        return null;
      }
      const spriteCtx = surface.getContext("2d");
      if (!spriteCtx) {
        particleSpriteCache.set(key, null);
        return null;
      }

      const spriteParticle = {
        ...particle,
        alpha: 1,
        phase: 0,
        rotation: 0,
        twinkle: 1
      };
      const center = spriteSize * 0.5;
      if (spriteParticle.shape === "dot") {
        drawDotParticleVector(spriteCtx, center, center, spriteParticle, 0);
      } else {
        drawSparkleParticleVector(spriteCtx, center, center, spriteParticle, 0);
      }

      const sprite = {
        image: surface,
        halfSize: spriteSize * 0.5
      };
      particleSpriteCache.set(key, sprite);
      return sprite;
    }

    function spawnParticle(emitter, now, config) {
      emitter.spawnIndex += 1;
      const seedBase = emitter.seed + emitter.spawnIndex * 97.13;
      const spawnBox = config.spawnBox && typeof config.spawnBox === "object" ? config.spawnBox : {};
      const velocity = config.velocity && typeof config.velocity === "object" ? config.velocity : {};
      const acceleration = config.acceleration && typeof config.acceleration === "object" ? config.acceleration : {};
      const shape = String(getListValue(config.shapes, seedBase + 1, config.shape || "sparkle") || "sparkle");

      emitter.particles.push({
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
        shape
      });
    }

    function syncEmitter(emitter, now, config, originX, originY) {
      const previousUpdatedAt = Number(emitter.updatedAt) || now;
      const dtSec = Math.max(0, (now - previousUpdatedAt) / 1000);
      emitter.updatedAt = now;
      emitter.lastSeenAt = now;
      emitter.originX = Number(originX) || 0;
      emitter.originY = Number(originY) || 0;

      const particles = [];
      for (const particle of emitter.particles) {
        const progress = (now - particle.createdAt) / particle.lifeMs;
        if (progress >= 1) {
          continue;
        }
        particles.push(particle);
      }
      emitter.particles = particles;

      const configuredMaxParticles = Math.max(0, Math.floor(Number(config.maxParticles) || 0));
      const emitterCount = Math.max(1, emittersByKey.size || 1);
      const perEmitterBudget = Math.max(1, Math.floor(globalMaxParticles / emitterCount));
      const maxParticles = Math.min(configuredMaxParticles, perEmitterBudget);
      const spawnScale =
        configuredMaxParticles > 0 ? clamp(perEmitterBudget / configuredMaxParticles, 0.15, 1) : 0;
      const spawnRate = Math.max(0, Number(config.spawnRate) || 0) * spawnScale;
      if (!emitter.initialized) {
        emitter.initialized = true;
        const burstCount = Math.max(0, Math.floor(Number(config.burstCount) || 0));
        for (let i = 0; i < burstCount && emitter.particles.length < maxParticles; i += 1) {
          spawnParticle(emitter, now - seededUnit(emitter.seed + i) * 300, config);
        }
      }
      emitter.spawnCarry += dtSec * spawnRate;
      while (emitter.spawnCarry >= 1 && emitter.particles.length < maxParticles) {
        emitter.spawnCarry -= 1;
        spawnParticle(emitter, now, config);
      }
    }

    function drawParticle(ctx, particle, screenX, screenY, progress) {
      const sprite = getCachedParticleSprite(particle);
      if (sprite && sprite.image) {
        const twinkle =
          particle.shape === "dot"
            ? 1
            : 0.65 + Math.sin(progress * Math.PI * 2 + particle.phase) * 0.25 + Number(particle.twinkle) * 0.2;
        const alpha = clamp(Number(particle.alpha) || 0.7, 0, 1) * (1 - progress * 0.85);
        const scale = particle.shape === "dot" ? 1 : clamp(twinkle, 0.45, 1.4);
        ctx.save();
        ctx.translate(screenX, screenY);
        if (particle.shape !== "dot") {
          ctx.rotate(Number(particle.rotation) || 0);
        }
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          sprite.image,
          -sprite.halfSize * scale,
          -sprite.halfSize * scale,
          sprite.halfSize * 2 * scale,
          sprite.halfSize * 2 * scale
        );
        ctx.restore();
        return;
      }
      if (particle.shape === "dot") {
        drawDotParticleVector(ctx, screenX, screenY, particle, progress);
        return;
      }
      drawSparkleParticleVector(ctx, screenX, screenY, particle, progress);
    }

    function drawWorldEmitter(raw) {
      const options = raw && typeof raw === "object" ? raw : {};
      const key = String(options.key || "").trim();
      const worldToScreen = typeof options.worldToScreen === "function" ? options.worldToScreen : null;
      const ctx = options.ctx;
      const config = options.config && typeof options.config === "object" ? options.config : null;
      const now = Number(options.now) || 0;
      if (!key || !ctx || !worldToScreen || !config || !Number.isFinite(now)) {
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
          originX: Number(options.x) || 0,
          originY: Number(options.y) || 0,
          initialized: false
        };
        emittersByKey.set(key, emitter);
      }
      emitter.idleTimeoutMs = Math.max(300, Number(config.idleTimeoutMs) || 1600);

      syncEmitter(emitter, now, config, options.x, options.y);

      for (const particle of emitter.particles) {
        const ageSec = (now - particle.createdAt) / 1000;
        const progress = clamp((now - particle.createdAt) / particle.lifeMs, 0, 1);
        const worldX = emitter.originX + particle.offsetX + particle.vx * ageSec + 0.5 * particle.ax * ageSec * ageSec;
        const worldY = emitter.originY + particle.offsetY + particle.vy * ageSec + 0.5 * particle.ay * ageSec * ageSec;
        const screen = worldToScreen(worldX, worldY, options.cameraX, options.cameraY);
        if (!screen) {
          continue;
        }
        drawParticle(ctx, particle, screen.x, screen.y, progress);
      }
    }

    function pruneEmitters(now = performance.now()) {
      for (const [key, emitter] of emittersByKey.entries()) {
        const idleTimeoutMs = Math.max(300, Number(emitter && emitter.idleTimeoutMs) || 1600);
        if (now - (Number(emitter && emitter.lastSeenAt) || 0) > idleTimeoutMs) {
          emittersByKey.delete(key);
        }
      }
    }

    function clearEmitters() {
      emittersByKey.clear();
    }

    return {
      drawWorldEmitter(raw) {
        const options = raw && typeof raw === "object" ? raw : {};
        const config = options.config && typeof options.config === "object" ? options.config : {};
        const key = String(options.key || "").trim();
        let emitter = emittersByKey.get(key);
        if (emitter) {
          emitter.idleTimeoutMs = Math.max(300, Number(config.idleTimeoutMs) || 1600);
        }
        drawWorldEmitter(options);
      },
      pruneEmitters,
      clearEmitters
    };
  }

  globalScope.VibeClientParticleSystem = Object.freeze({
    createParticleSystemTools
  });
})(globalThis);
