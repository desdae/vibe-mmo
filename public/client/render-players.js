(function initVibeClientRenderPlayers(globalScope) {
  "use strict";

  function createPlayerRenderTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    if (!ctx) {
      return null;
    }
    const clamp = typeof deps.clamp === "function" ? deps.clamp : (v, min, max) => Math.max(min, Math.min(max, v));
    const lerp = typeof deps.lerp === "function" ? deps.lerp : (a, b, t) => a + (b - a) * t;
    const hashString = typeof deps.hashString === "function" ? deps.hashString : (value) => {
      const text = String(value || "");
      let hash = 0;
      for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
      }
      return hash >>> 0;
    };

    function getSelfVisualEffectState(effectKey, frameNow) {
      const state = deps.selfNegativeEffects[effectKey];
      if (!state) {
        return null;
      }
      if ((Number(state.endsAt) || 0) <= frameNow) {
        deps.selfNegativeEffects[effectKey] = null;
        return null;
      }
      return state;
    }

    function drawPlayer(player, cameraX, cameraY, isSelf) {
      const p = deps.worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);

      if (player.classType === "warrior") {
        drawWarriorPlayer(player, p, isSelf);
      } else if (player.classType === "ranger") {
        drawRangerPlayer(player, p, isSelf);
      } else {
        drawMagePlayer(player, p, isSelf);
      }

      ctx.fillStyle = "#f5f7fa";
      ctx.font = "12px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(player.name, p.x, p.y - (isSelf ? 21 : 19) - 7);
    }

    function drawPlayerCastBar(player, cameraX, cameraY, isSelf, frameNow) {
      const castState = isSelf ? deps.abilityChannel : deps.remotePlayerCasts.get(player.id);
      const cast = deps.getCastProgress(castState, frameNow);
      if (!cast) {
        if (!isSelf && castState && castState.active) {
          deps.remotePlayerCasts.delete(player.id);
        }
        return;
      }

      const p = deps.worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
      const width = 34;
      const height = 5;
      const x = Math.round(p.x - width / 2);
      const y = Math.round(p.y + 20);
      const fillWidth = Math.round(width * cast.ratio);

      ctx.fillStyle = "rgba(4, 10, 18, 0.9)";
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "rgba(63, 173, 255, 0.95)";
      ctx.fillRect(x, y, fillWidth, height);
      ctx.strokeStyle = "rgba(166, 218, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
    }

    function drawPlayerStunEffect(player, cameraX, cameraY, isSelf, frameNow) {
      const state = isSelf ? getSelfVisualEffectState("stun", frameNow) : deps.remotePlayerStuns.get(player.id);
      if (!state) {
        return;
      }
      if ((Number(state.endsAt) || 0) <= frameNow) {
        if (!isSelf) {
          deps.remotePlayerStuns.delete(player.id);
        }
        return;
      }

      const p = deps.worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
      const centerX = p.x;
      const centerY = p.y - 18;
      const t = frameNow * 0.0065;

      ctx.save();
      ctx.strokeStyle = "rgba(243, 252, 255, 0.92)";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i += 1) {
        const a = t + i * ((Math.PI * 2) / 3);
        const baseX = centerX + Math.cos(a) * 7;
        const baseY = centerY + Math.sin(a) * 3.2;
        ctx.beginPath();
        for (let s = 0; s <= 20; s += 1) {
          const u = s / 20;
          const ang = a + u * Math.PI * 2.2;
          const r = 2.2 * (1 - u);
          const x = baseX + Math.cos(ang) * r;
          const y = baseY + Math.sin(ang) * r;
          if (s === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPlayerSlowTint(player, cameraX, cameraY, isSelf, frameNow) {
      const state = isSelf ? getSelfVisualEffectState("slow", frameNow) : deps.remotePlayerSlows.get(player.id);
      if (!state) {
        return;
      }
      if ((Number(state.endsAt) || 0) <= frameNow) {
        if (!isSelf) {
          deps.remotePlayerSlows.delete(player.id);
        }
        return;
      }

      const p = deps.worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
      const multiplier = isSelf
        ? clamp((Number(state.multiplierQ) || 1000) / 1000, 0.1, 1)
        : clamp(Number(state.multiplier) || 1, 0.1, 1);
      const strength = clamp(1 - multiplier, 0, 1);
      const phaseSeed = Number.isFinite(Number(player.id)) ? Number(player.id) : 0;
      const pulse = 0.6 + Math.sin(frameNow * 0.016 + (phaseSeed % 7)) * 0.4;
      const alpha = clamp(0.16 + strength * 0.28, 0.12, 0.42) * (0.75 + pulse * 0.25);
      const radius = 14 + strength * 3;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, radius);
      grad.addColorStop(0, "rgba(214, 247, 255, 0.86)");
      grad.addColorStop(0.52, "rgba(118, 194, 255, 0.56)");
      grad.addColorStop(1, "rgba(78, 155, 235, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawPlayerBurnEffect(player, cameraX, cameraY, isSelf, frameNow) {
      const state = isSelf ? getSelfVisualEffectState("burn", frameNow) : deps.remotePlayerBurns.get(player.id);
      if (!state) {
        return;
      }
      if ((Number(state.endsAt) || 0) <= frameNow) {
        if (!isSelf) {
          deps.remotePlayerBurns.delete(player.id);
        }
        return;
      }

      const p = deps.worldToScreen(player.x + 0.5, player.y + 0.5, cameraX, cameraY);
      const phaseSeed = Number.isFinite(Number(player.id)) ? Number(player.id) : 0;
      const pulse = 0.58 + Math.sin(frameNow * 0.019 + (phaseSeed % 9)) * 0.42;
      const alpha = 0.24 + pulse * 0.2;
      const radius = 12 + pulse * 2.2;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(p.x, p.y + 1, 1.8, p.x, p.y + 1, radius);
      grad.addColorStop(0, "rgba(255, 244, 170, 0.95)");
      grad.addColorStop(0.4, "rgba(255, 153, 69, 0.68)");
      grad.addColorStop(0.78, "rgba(255, 77, 34, 0.48)");
      grad.addColorStop(1, "rgba(255, 45, 22, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 1, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawPlayerEffectAnimations(player, cameraX, cameraY, isSelf, frameNow) {
      drawPlayerSlowTint(player, cameraX, cameraY, isSelf, frameNow);
      drawPlayerBurnEffect(player, cameraX, cameraY, isSelf, frameNow);
      drawPlayerStunEffect(player, cameraX, cameraY, isSelf, frameNow);
    }

    function getWarriorSwingState(player, isSelf) {
      const now = performance.now();
      if (isSelf) {
        const timeLeft = deps.swordSwing.activeUntil - now;
        if (timeLeft <= 0) {
          return null;
        }
        return {
          angle: deps.swordSwing.angle,
          progress: 1 - timeLeft / deps.swordSwing.durationMs
        };
      }

      const swing = deps.remotePlayerSwings.get(player.id);
      if (!swing) {
        return null;
      }
      const timeLeft = swing.activeUntil - now;
      if (timeLeft <= 0) {
        deps.remotePlayerSwings.delete(player.id);
        return null;
      }
      return {
        angle: swing.angle,
        progress: 1 - timeLeft / swing.durationMs
      };
    }

    function getWarriorMotionState(player, isSelf) {
      const now = performance.now();
      const key = `${isSelf ? "self" : "player"}:${String(player.id ?? "0")}`;
      const existing = deps.warriorAnimRuntime.get(key);
      const seed = ((Number(player.id) || hashString(key)) % 628) / 100;
      const state =
        existing ||
        {
          lastX: player.x,
          lastY: player.y,
          lastT: now,
          phase: seed,
          idlePhase: seed,
          lastSeenAt: now
        };

      const dt = Math.max(0.001, (now - state.lastT) / 1000);
      const moved = Math.hypot(player.x - state.lastX, player.y - state.lastY);
      const speed = moved / dt;
      const moving = speed > 0.035;

      if (moving) {
        state.phase = (state.phase + dt * 7.4) % (Math.PI * 2);
      } else {
        state.idlePhase = (state.idlePhase + dt * 2.1) % (Math.PI * 2);
      }

      state.lastX = player.x;
      state.lastY = player.y;
      state.lastT = now;
      state.lastSeenAt = now;
      deps.warriorAnimRuntime.set(key, state);

      const walk = Math.sin(state.phase);
      const idle = Math.sin(state.idlePhase);
      return {
        moving,
        walk,
        bob: moving ? Math.abs(Math.sin(state.phase)) * 1.05 : idle * 0.35,
        sway: moving ? walk * 0.9 : idle * 0.22,
        shieldBob: moving ? Math.sin(state.phase + Math.PI / 2) * 0.45 : idle * 0.12
      };
    }

    function pruneWarriorAnimRuntime() {
      const now = performance.now();
      for (const [key, state] of deps.warriorAnimRuntime.entries()) {
        if (now - state.lastSeenAt > 3000) {
          deps.warriorAnimRuntime.delete(key);
        }
      }
      if (deps.rangerAnimRuntime && typeof deps.rangerAnimRuntime.entries === "function") {
        for (const [key, state] of deps.rangerAnimRuntime.entries()) {
          if (now - state.lastSeenAt > 3000) {
            deps.rangerAnimRuntime.delete(key);
          }
        }
      }
    }

    function drawWarriorPlayer(player, p, isSelf) {
      const motion = getWarriorMotionState(player, isSelf);
      const swing = getWarriorSwingState(player, isSelf);
      const outline = "#111822";
      const armor = isSelf ? "#edf2f8" : "#e5ebf3";
      const armorDark = isSelf ? "#a2aec0" : "#98a4b8";
      const cloth = isSelf ? "#566a8f" : "#4f6080";
      const leather = "#86613f";
      const boot = "#222831";
      const skin = "#d9b18f";

      const cx = p.x + motion.sway * 0.08;
      const cy = p.y + motion.bob * 0.18;

      // Legs.
      const legBaseY = cy + 8.8;
      const legStep = motion.moving ? motion.walk * 1.7 : 0;
      ctx.strokeStyle = cloth;
      ctx.lineWidth = 4.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 2.6, legBaseY - 0.5);
      ctx.lineTo(cx - 4.2 - legStep * 0.45, legBaseY + 7.1);
      ctx.moveTo(cx + 2.6, legBaseY - 0.5);
      ctx.lineTo(cx + 4.2 + legStep * 0.45, legBaseY + 7.1);
      ctx.stroke();

      ctx.fillStyle = boot;
      ctx.beginPath();
      ctx.ellipse(cx - 4.2 - legStep * 0.45, legBaseY + 8.2, 2.2, 1.8, -0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + 4.2 + legStep * 0.45, legBaseY + 8.2, 2.2, 1.8, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Torso.
      ctx.fillStyle = armor;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3.3, 8.7, 7.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Belt.
      ctx.strokeStyle = leather;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 6.1, cy + 6.2);
      ctx.lineTo(cx + 6.1, cy + 6.2);
      ctx.stroke();

      // Head + helmet dome.
      ctx.fillStyle = armor;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy - 6.0, 9.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Visor.
      ctx.fillStyle = "#0f131c";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 3.6, 6.2, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Helmet straps.
      ctx.strokeStyle = armorDark;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx - 7.8, cy - 5.6);
      ctx.lineTo(cx + 7.8, cy - 5.6);
      ctx.moveTo(cx, cy - 14.5);
      ctx.lineTo(cx, cy + 0.8);
      ctx.stroke();

      // Rivets.
      ctx.fillStyle = outline;
      ctx.beginPath();
      ctx.arc(cx - 4.8, cy - 5.6, 0.8, 0, Math.PI * 2);
      ctx.arc(cx, cy - 5.6, 0.8, 0, Math.PI * 2);
      ctx.arc(cx + 4.8, cy - 5.6, 0.8, 0, Math.PI * 2);
      ctx.arc(cx, cy - 9.9, 0.8, 0, Math.PI * 2);
      ctx.arc(cx, cy - 1.5, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Left arm (sword arm).
      const leftShoulderX = cx - 5.8;
      const leftShoulderY = cy - 1.7;
      let armAngle = -2.05 - motion.walk * 0.12;
      if (swing) {
        const start = swing.angle - 1.0;
        const end = swing.angle + 0.45;
        armAngle = lerp(start, end, swing.progress);
      }
      const armLength = 8.6;
      const handX = leftShoulderX + Math.cos(armAngle) * armLength;
      const handY = leftShoulderY + Math.sin(armAngle) * armLength;

      ctx.beginPath();
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3.8;
      ctx.lineCap = "round";
      ctx.moveTo(leftShoulderX, leftShoulderY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(handX, handY, 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Sword.
      const swordAngle = armAngle + 0.12;
      const bladeLength = swing ? 15.2 : 13.0;
      const bladeX = handX + Math.cos(swordAngle) * bladeLength;
      const bladeY = handY + Math.sin(swordAngle) * bladeLength;

      ctx.beginPath();
      ctx.strokeStyle = "#7f8b9e";
      ctx.lineWidth = 3.4;
      ctx.moveTo(handX, handY);
      ctx.lineTo(bladeX, bladeY);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "#edf2fb";
      ctx.lineWidth = 1.3;
      ctx.moveTo(handX + Math.cos(swordAngle + 0.05), handY + Math.sin(swordAngle + 0.05));
      ctx.lineTo(bladeX, bladeY);
      ctx.stroke();

      const guardAngle = swordAngle + Math.PI / 2;
      const guardHalf = 2.9;
      ctx.beginPath();
      ctx.strokeStyle = "#606a78";
      ctx.lineWidth = 2;
      ctx.moveTo(handX + Math.cos(guardAngle) * guardHalf, handY + Math.sin(guardAngle) * guardHalf);
      ctx.lineTo(handX - Math.cos(guardAngle) * guardHalf, handY - Math.sin(guardAngle) * guardHalf);
      ctx.stroke();

      // Right arm and shield.
      const rightShoulderX = cx + 5.5;
      const rightShoulderY = cy - 1.1;
      const rightArmAngle = 0.45 + motion.walk * 0.08;
      const rightHandX = rightShoulderX + Math.cos(rightArmAngle) * 6.4;
      const rightHandY = rightShoulderY + Math.sin(rightArmAngle) * 6.4;

      ctx.beginPath();
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3.8;
      ctx.moveTo(rightShoulderX, rightShoulderY);
      ctx.lineTo(rightHandX, rightHandY);
      ctx.stroke();

      const shieldX = rightHandX + 2.9;
      const shieldY = rightHandY + 1.4 + motion.shieldBob;
      const shieldRadius = 6.1;
      ctx.fillStyle = armor;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, shieldRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = armorDark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, shieldRadius - 1.1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#8f99aa";
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawMagePlayer(_player, p, isSelf) {
      const bodyFill = isSelf ? "#f0f7ff" : "#ecf2fa";
      const hatFill = isSelf ? "#1d2f5f" : "#17264d";
      const capeFill = isSelf ? "#1e2743" : "#191f36";
      const staffColor = "#443628";
      const outline = "#0f1322";

      const headRadius = isSelf ? 10.5 : 9.5;
      const bodyRadiusX = isSelf ? 11 : 10;
      const bodyRadiusY = isSelf ? 12.5 : 11.5;

      // Back cape wings.
      ctx.beginPath();
      ctx.fillStyle = capeFill;
      ctx.moveTo(p.x - 2, p.y + 6);
      ctx.quadraticCurveTo(p.x - 20, p.y + 5, p.x - 17, p.y + 20);
      ctx.quadraticCurveTo(p.x - 10, p.y + 17, p.x - 2, p.y + 8);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p.x + 1, p.y + 6);
      ctx.quadraticCurveTo(p.x + 23, p.y + 8, p.x + 21, p.y + 23);
      ctx.quadraticCurveTo(p.x + 10, p.y + 19, p.x + 1, p.y + 8);
      ctx.fill();

      // Staff arm.
      const shoulderY = p.y + 1;
      const leftShoulderX = p.x - 9;
      ctx.beginPath();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.moveTo(leftShoulderX, shoulderY);
      ctx.lineTo(leftShoulderX - 10, shoulderY - 6);
      ctx.stroke();

      // Staff.
      ctx.beginPath();
      ctx.strokeStyle = staffColor;
      ctx.lineWidth = 4;
      ctx.moveTo(p.x - 18, p.y - 4);
      ctx.lineTo(p.x - 26, p.y + 31);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = outline;
      ctx.arc(p.x - 18, p.y - 4, 3.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = "#d9e9ff";
      ctx.lineWidth = 2;
      ctx.arc(p.x - 18, p.y - 17, 6.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = "rgba(168, 210, 255, 0.35)";
      ctx.arc(p.x - 18, p.y - 17, 5.2, 0, Math.PI * 2);
      ctx.fill();

      // Head and body.
      ctx.beginPath();
      ctx.fillStyle = bodyFill;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.4;
      ctx.arc(p.x, p.y, headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 13, bodyRadiusX, bodyRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hat brim and cone with star dots.
      ctx.beginPath();
      ctx.fillStyle = hatFill;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.6;
      ctx.ellipse(p.x + 1, p.y - 8, 18, 7, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p.x - 10, p.y - 8);
      ctx.lineTo(p.x + 2, p.y - 28);
      ctx.lineTo(p.x + 14, p.y - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f5f8ff";
      ctx.beginPath();
      ctx.arc(p.x + 3, p.y - 18, 1.1, 0, Math.PI * 2);
      ctx.arc(p.x + 7, p.y - 14, 1, 0, Math.PI * 2);
      ctx.arc(p.x - 1, p.y - 13, 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Small star on hat.
      ctx.beginPath();
      ctx.strokeStyle = "#f5f8ff";
      ctx.lineWidth = 1.5;
      ctx.moveTo(p.x + 8, p.y - 22);
      ctx.lineTo(p.x + 8, p.y - 18);
      ctx.moveTo(p.x + 6, p.y - 20);
      ctx.lineTo(p.x + 10, p.y - 20);
      ctx.stroke();

      // Casting arm and fire orb.
      ctx.beginPath();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.moveTo(p.x + 8, p.y + 2);
      ctx.lineTo(p.x + 21, p.y + 8);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = outline;
      ctx.arc(p.x + 21, p.y + 8, 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 149, 64, 0.9)";
      ctx.arc(p.x + 28, p.y + 6, 6.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 220, 120, 0.88)";
      ctx.arc(p.x + 29.5, p.y + 4.8, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Legs.
      ctx.beginPath();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 3;
      ctx.moveTo(p.x - 3, p.y + 23);
      ctx.lineTo(p.x - 9, p.y + 31);
      ctx.moveTo(p.x + 3, p.y + 23);
      ctx.lineTo(p.x + 10, p.y + 31);
      ctx.stroke();
    }

    function drawRangerPlayer(player, p, isSelf) {
      const now = performance.now();
      const key = `ranger:${String(player.id ?? "0")}`;
      const seed = (hashString(key) % 628) / 100;
      const runtime =
        deps.rangerAnimRuntime.get(key) ||
        {
          lastX: player.x,
          lastY: player.y,
          lastT: now,
          phase: seed,
          lastSeenAt: now
        };
      const dt = Math.max(0.001, (now - runtime.lastT) / 1000);
      const moved = Math.hypot(player.x - runtime.lastX, player.y - runtime.lastY);
      const moving = moved / dt > 0.035;
      runtime.phase = (runtime.phase + dt * (moving ? 7.8 : 1.9)) % (Math.PI * 2);
      runtime.lastX = player.x;
      runtime.lastY = player.y;
      runtime.lastT = now;
      runtime.lastSeenAt = now;
      deps.rangerAnimRuntime.set(key, runtime);

      const walk = Math.sin(runtime.phase);
      const bob = moving ? Math.abs(walk) * 1.15 : Math.sin(runtime.phase * 0.6) * 0.32;
      const sway = moving ? walk * 0.95 : Math.sin(runtime.phase * 0.6) * 0.18;
      const cx = p.x + sway * 0.08;
      const cy = p.y + bob * 0.16;
      const outline = "#0c1017";
      const cloak = isSelf ? "#355b49" : "#2b4f40";
      const hood = isSelf ? "#284436" : "#223a2d";
      const leather = isSelf ? "#7f6a4b" : "#705d43";
      const bracer = "#a28d69";
      const bowWood = "#b88c5a";
      const bowEdge = "#f2d7a0";
      const skin = "#d5b18a";

      ctx.fillStyle = cloak;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 7.8, 9.8, 12.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = hood;
      ctx.beginPath();
      ctx.arc(cx, cy - 4.8, 8.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(244, 233, 214, 0.92)";
      ctx.beginPath();
      ctx.arc(cx, cy - 3.2, 5.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#11151d";
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 4.2, 1, 0, Math.PI * 2);
      ctx.arc(cx + 2, cy - 4.2, 1, 0, Math.PI * 2);
      ctx.fill();

      // Quiver.
      ctx.save();
      ctx.translate(cx - 8.5, cy - 1.2);
      ctx.rotate(-0.4);
      ctx.fillStyle = leather;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-3, -8, 6, 12, 2.4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#e3d4bb";
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 3; i += 1) {
        const off = -3 + i * 2.2;
        ctx.beginPath();
        ctx.moveTo(off, -8);
        ctx.lineTo(off, -12.5);
        ctx.stroke();
      }
      ctx.restore();

      // Legs.
      const legStep = moving ? walk * 1.5 : 0;
      ctx.strokeStyle = leather;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 2.6, cy + 15.5);
      ctx.lineTo(cx - 5 - legStep * 0.35, cy + 23.2);
      ctx.moveTo(cx + 2.6, cy + 15.5);
      ctx.lineTo(cx + 5 + legStep * 0.35, cy + 23.2);
      ctx.stroke();

      ctx.fillStyle = outline;
      ctx.beginPath();
      ctx.ellipse(cx - 5 - legStep * 0.35, cy + 24.6, 2.2, 1.5, -0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + 5 + legStep * 0.35, cy + 24.6, 2.2, 1.5, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Bow arm.
      const leftShoulderX = cx - 6.2;
      const leftShoulderY = cy + 0.2;
      const leftHandX = leftShoulderX - 9.2;
      const leftHandY = leftShoulderY + 0.8;
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(leftShoulderX, leftShoulderY);
      ctx.lineTo(leftHandX, leftHandY);
      ctx.stroke();

      // Draw arm.
      const rightShoulderX = cx + 5.8;
      const rightShoulderY = cy + 0.4;
      const drawPull = moving ? Math.abs(walk) * 0.8 : 0.4;
      const rightHandX = rightShoulderX + 7.4;
      const rightHandY = rightShoulderY - 1.6 - drawPull;
      ctx.beginPath();
      ctx.moveTo(rightShoulderX, rightShoulderY);
      ctx.lineTo(rightHandX, rightHandY);
      ctx.stroke();

      ctx.fillStyle = bracer;
      ctx.beginPath();
      ctx.arc(leftHandX, leftHandY, 1.7, 0, Math.PI * 2);
      ctx.arc(rightHandX, rightHandY, 1.7, 0, Math.PI * 2);
      ctx.fill();

      // Bow.
      ctx.save();
      ctx.translate(cx + 11.2, cy + 1.2);
      ctx.rotate(0.06 + sway * 0.015);
      ctx.strokeStyle = bowWood;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-1.2, -13.5);
      ctx.quadraticCurveTo(-9.5, 0, -1.2, 13.5);
      ctx.stroke();
      ctx.strokeStyle = bowEdge;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-0.2, -13.2);
      ctx.lineTo(-0.2, 13.2);
      ctx.stroke();
      ctx.restore();
    }

    return {
      drawPlayer,
      drawPlayerCastBar,
      drawPlayerStunEffect,
      drawPlayerSlowTint,
      drawPlayerBurnEffect,
      drawPlayerEffectAnimations,
      pruneWarriorAnimRuntime,
      drawWarriorPlayer,
      drawRangerPlayer,
      drawMagePlayer
    };
  }

  globalScope.VibeClientRenderPlayers = Object.freeze({
    createPlayerRenderTools
  });
})(globalThis);
