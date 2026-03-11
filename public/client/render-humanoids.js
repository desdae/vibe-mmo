(function initVibeClientRenderHumanoids(globalScope) {
  "use strict";

  function createHumanoidRenderTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    if (!ctx) {
      return null;
    }

    const clamp = typeof deps.clamp === "function" ? deps.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
    const lerp = typeof deps.lerp === "function" ? deps.lerp : (a, b, t) => a + (b - a) * t;
    const hashString = typeof deps.hashString === "function"
      ? deps.hashString
      : (value) => {
          const text = String(value || "");
          let hash = 0;
          for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
          }
          return hash >>> 0;
        };
    const sanitizeCssColor =
      typeof deps.sanitizeCssColor === "function"
        ? deps.sanitizeCssColor
        : (value) => (/^#[0-9a-fA-F]{3,8}$/.test(String(value || "").trim()) ? String(value).trim() : "");

    const motionRuntime = new Map();
    const humanoidMobTypes = new Set(["zombie", "skeleton", "skeleton_archer", "orc"]);

    function toLowerWord(value) {
      return String(value || "").trim().toLowerCase();
    }

    function isHumanoidSpriteType(spriteType) {
      return humanoidMobTypes.has(toLowerWord(spriteType));
    }

    function isHumanoidStyle(style) {
      if (!style || typeof style !== "object") {
        return false;
      }
      if (toLowerWord(style.rigType) === "humanoid") {
        return true;
      }
      return isHumanoidSpriteType(style.spriteType) || ["human", "orc", "zombie", "skeleton"].includes(toLowerWord(style.species));
    }

    function getMotionState(entityKey, entity, style) {
      const now = performance.now();
      const key = String(entityKey || "");
      const existing = motionRuntime.get(key);
      const seed = ((Number(entity?.id) || hashString(key)) % 628) / 100;
      const state =
        existing ||
        {
          lastX: Number(entity?.x) || 0,
          lastY: Number(entity?.y) || 0,
          lastT: now,
          phase: seed,
          idlePhase: seed,
          bowPull: 0,
          lastSeenAt: now
        };

      const dt = Math.max(0.001, (now - state.lastT) / 1000);
      const moved = Math.hypot((Number(entity?.x) || 0) - state.lastX, (Number(entity?.y) || 0) - state.lastY);
      const speed = moved / dt;
      const moveThreshold = clamp(Number(style?.moveThreshold) || 0.03, 0, 2);
      const moving = speed > moveThreshold;
      const walkCycleSpeed = clamp(Number(style?.walkCycleSpeed) || 2.8, 0.1, 10);
      const idleCycleSpeed = clamp(Number(style?.idleCycleSpeed) || 1, 0, 10);

      if (moving) {
        state.phase = (state.phase + dt * walkCycleSpeed) % (Math.PI * 2);
      } else {
        state.idlePhase = (state.idlePhase + dt * idleCycleSpeed) % (Math.PI * 2);
      }

      state.lastX = Number(entity?.x) || 0;
      state.lastY = Number(entity?.y) || 0;
      state.lastT = now;
      state.lastSeenAt = now;
      motionRuntime.set(key, state);

      const walk = Math.sin(state.phase);
      const idle = Math.sin(state.idlePhase);
      return {
        moving,
        walk,
        idle,
        bob: moving ? Math.abs(walk) * 0.95 : idle * 0.18,
        sway: moving ? walk * 0.9 : idle * 0.15,
        runtimeState: state
      };
    }

    function pruneHumanoidMotionRuntime() {
      const now = performance.now();
      for (const [key, state] of motionRuntime.entries()) {
        if (now - state.lastSeenAt > 3000) {
          motionRuntime.delete(key);
        }
      }
    }

    function mergePalette(basePalette, overridePalette) {
      const palette = { ...basePalette };
      const source = overridePalette && typeof overridePalette === "object" ? overridePalette : null;
      if (!source) {
        return palette;
      }
      for (const [key, value] of Object.entries(source)) {
        const color = sanitizeCssColor(value);
        if (color) {
          palette[key] = color;
        }
      }
      return palette;
    }

    function getBasePalette(style, options = {}) {
      const species = toLowerWord(style?.species) || "human";
      const archetype = toLowerWord(style?.archetype);
      const isSelf = !!options.isSelf;
      let palette;
      if (species === "skeleton") {
        palette = {
          outline: "#171d26",
          skin: "#eef2f6",
          skinDark: "#c6ced8",
          cloth: archetype === "archer" ? "#2b3038" : "#d8dee7",
          clothDark: archetype === "archer" ? "#1f242c" : "#94a0af",
          leather: "#7e6243",
          leatherDark: "#5b452f",
          metal: "#dde3ec",
          metalDark: "#94a0b0",
          eye: "#0d1016",
          bone: "#eef2f6",
          boneDark: "#c6ced8",
          accent: "#d8c8a2",
          tusk: "#ece5cf"
        };
      } else if (species === "zombie") {
        palette = {
          outline: "#1b2517",
          skin: "#85ad68",
          skinDark: "#557740",
          cloth: "#6f5c43",
          clothDark: "#4b3b2a",
          leather: "#7e5e3d",
          leatherDark: "#5d452d",
          metal: "#91999d",
          metalDark: "#596267",
          eye: "#12170f",
          brain: "#a8bc84",
          accent: "#b7634a",
          tusk: "#efe1c1"
        };
      } else if (species === "orc") {
        palette = {
          outline: "#1b2317",
          skin: "#89bb61",
          skinDark: "#5e8242",
          cloth: "#7a4b3e",
          clothDark: "#55362d",
          leather: "#7e533f",
          leatherDark: "#59392d",
          metal: "#d89478",
          metalDark: "#996852",
          eye: "#190f11",
          accent: "#df7d66",
          tusk: "#ece4cf",
          spike: "#d9c4a4"
        };
      } else {
        palette = {
          outline: "#111822",
          skin: archetype === "mage" ? "#eed0b3" : "#ddb48f",
          skinDark: archetype === "mage" ? "#b48563" : "#b18158",
          cloth: archetype === "mage" ? "#2b3d74" : archetype === "ranger" ? "#355a46" : "#5f7395",
          clothDark: archetype === "mage" ? "#1c264e" : archetype === "ranger" ? "#22382c" : "#42536e",
          leather: archetype === "ranger" ? "#7d6a4b" : "#86613f",
          leatherDark: archetype === "ranger" ? "#5c4d36" : "#5f432b",
          metal: archetype === "warrior" ? "#edf2f8" : "#bdd3ea",
          metalDark: archetype === "warrior" ? "#8190a5" : "#8197ae",
          eye: "#12161e",
          accent: archetype === "mage" ? "#ffd174" : archetype === "ranger" ? "#9dd4ab" : "#c7d0dc",
          tusk: "#f0e3cb"
        };
      }
      if (isSelf) {
        palette.metal = palette.metal;
      }
      return mergePalette(palette, style?.palette);
    }

    function getSlotEntry(equipmentSlots, slotId) {
      if (!equipmentSlots || typeof equipmentSlots !== "object") {
        return null;
      }
      return equipmentSlots[slotId] && typeof equipmentSlots[slotId] === "object" ? equipmentSlots[slotId] : null;
    }

    function getNameText(entry) {
      return toLowerWord(entry?.name || entry?.itemId || "");
    }

    function getTagSet(entry) {
      return new Set(Array.isArray(entry?.tags) ? entry.tags.map((value) => toLowerWord(value)).filter(Boolean) : []);
    }

    function resolveArmorMaterial(entry, fallback) {
      const nameText = getNameText(entry);
      const tags = getTagSet(entry);
      if (
        nameText.includes("plate") ||
        nameText.includes("sabaton") ||
        nameText.includes("ironclad") ||
        nameText.includes("guardian") ||
        nameText.includes("colossus") ||
        nameText.includes("seraph") ||
        nameText.includes("warden") ||
        nameText.includes("mythic") ||
        nameText.includes("chain") ||
        nameText.includes("scale") ||
        tags.has("shield")
      ) {
        return "plate";
      }
      if (
        nameText.includes("hood") ||
        nameText.includes("leather") ||
        nameText.includes("vest") ||
        nameText.includes("scout") ||
        nameText.includes("hunter") ||
        nameText.includes("ranger") ||
        nameText.includes("trail") ||
        nameText.includes("field") ||
        nameText.includes("shadow") ||
        nameText.includes("hawk")
      ) {
        return "leather";
      }
      if (
        nameText.includes("robe") ||
        nameText.includes("silk") ||
        nameText.includes("oracle") ||
        nameText.includes("arcane") ||
        nameText.includes("tunic") ||
        nameText.includes("cloth") ||
        tags.has("caster")
      ) {
        return "robe";
      }
      return toLowerWord(fallback) || "cloth";
    }

    function resolveHeadStyle(entry, fallback, style) {
      const nameText = getNameText(entry);
      if (nameText.includes("hood")) {
        return "hood";
      }
      if (nameText.includes("hat") || nameText.includes("cap") || nameText.includes("oracle")) {
        return "wizard_hat";
      }
      if (nameText.includes("helm") || nameText.includes("helmet") || nameText.includes("crown")) {
        return "helmet";
      }
      const fallbackType = toLowerWord(fallback);
      if (fallbackType) {
        return fallbackType;
      }
      const archetype = toLowerWord(style?.archetype);
      if (archetype === "mage") {
        return "wizard_hat";
      }
      if (archetype === "ranger" || nameText.includes("hood")) {
        return "hood";
      }
      return "helmet";
    }

    function resolveHeldItem(entry, fallback, slotId) {
      const nameText = getNameText(entry);
      const tags = getTagSet(entry);
      const weaponClass = toLowerWord(entry?.weaponClass);
      const fallbackType = toLowerWord(fallback);
      const type =
        weaponClass ||
        (tags.has("shield") ? "shield" : "") ||
        (nameText.includes("shield") || nameText.includes("buckler") ? "shield" : "") ||
        fallbackType;
      if (!type) {
        return { type: "none", twoHanded: false };
      }
      return {
        type,
        twoHanded: tags.has("twohanded") || type === "staff" || type === "bow",
        slotId
      };
    }

    function buildLoadout(style, equipmentSlots) {
      const defaults = style?.defaults && typeof style.defaults === "object" ? style.defaults : {};
      const chestEntry = getSlotEntry(equipmentSlots, "chest");
      const pantsEntry = getSlotEntry(equipmentSlots, "pants");
      const bootsEntry = getSlotEntry(equipmentSlots, "boots");
      const chestStyle = resolveArmorMaterial(chestEntry, defaults.chest);
      const pantsStyle = resolveArmorMaterial(pantsEntry, defaults.pants || chestStyle);
      const bootsStyle = resolveArmorMaterial(bootsEntry, defaults.boots || pantsStyle);
      const mainHand = resolveHeldItem(getSlotEntry(equipmentSlots, "mainHand"), defaults.mainHand, "mainHand");
      const offHand = resolveHeldItem(getSlotEntry(equipmentSlots, "offHand"), defaults.offHand, "offHand");
      return {
        head: resolveHeadStyle(getSlotEntry(equipmentSlots, "head"), defaults.head, style),
        shoulders: resolveArmorMaterial(getSlotEntry(equipmentSlots, "shoulders"), defaults.shoulders || chestStyle),
        chest: chestStyle,
        gloves: resolveArmorMaterial(getSlotEntry(equipmentSlots, "gloves"), defaults.gloves || chestStyle),
        bracers: resolveArmorMaterial(getSlotEntry(equipmentSlots, "bracers"), defaults.bracers || chestStyle),
        belt: resolveArmorMaterial(getSlotEntry(equipmentSlots, "belt"), defaults.belt || chestStyle),
        pants: pantsStyle,
        boots: bootsStyle,
        mainHand,
        offHand: mainHand.twoHanded ? { type: "none", twoHanded: false, slotId: "offHand" } : offHand
      };
    }

    function resolveAttackState(style, loadout, attackState, castState) {
      const attackVisual = toLowerWord(style?.attackVisual);
      if (attackState) {
        return {
          kind: attackVisual === "bite" ? "bite" : attackVisual === "bow" || loadout.mainHand.type === "bow" ? "bow" : attackVisual === "dual_axes" ? "dual_axes" : "swing",
          progress: clamp(Number(attackState.progress) || 0, 0, 1),
          sequence: Math.max(0, Number(attackState.sequence) || 0)
        };
      }
      if (castState && castState.active) {
        return {
          kind: loadout.mainHand.type === "bow" ? "bow" : "cast",
          progress: clamp(Number(castState.progress) || 0, 0, 1),
          sequence: 0
        };
      }
      return { kind: "idle", progress: 0, sequence: 0 };
    }

    function drawLine(x0, y0, x1, y1, color, width) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    function drawJoint(x, y, radius, fillColor, outlineColor, lineWidth) {
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    function drawBowWeapon(mainHandPose, drawHandPose, side, palette, pull, scale) {
      if (!mainHandPose) {
        return;
      }
      const sign = side === "left" ? -1 : 1;
      const curveDir = sign;
      const bowColor = palette.bow || palette.leather;
      const bowDark = palette.bowDark || palette.leatherDark;
      const stringColor = "#edf2fb";
      const shaftColor = palette.arrowShaft || "#e8edf7";
      const headColor = palette.arrowHead || palette.metalDark || palette.outline;
      const fletchColor = palette.fletch || palette.accent || "#ffd174";
      const isDrawn = pull > 0.08;
      const gripX = mainHandPose.handX;
      const gripY = mainHandPose.handY;
      const topX = gripX + curveDir * 1.2 * scale;
      const topY = gripY - 9.4 * scale;
      const botX = gripX + curveDir * 1.2 * scale;
      const botY = gripY + 9.4 * scale;
      const controlX = gripX + curveDir * 5.9 * scale;
      const restStringX = gripX + curveDir * 0.12 * scale;
      const pullX = drawHandPose ? lerp(restStringX, drawHandPose.handX, 0.86) : restStringX;
      const pullY = drawHandPose ? lerp(gripY, drawHandPose.handY, 0.84) : gripY;
      const arrowY = lerp(gripY, pullY, 0.58);
      const arrowBackX = pullX + curveDir * 0.75 * scale;
      const arrowTipX = gripX + curveDir * (10.6 + pull * 3.8) * scale;

      ctx.strokeStyle = bowDark;
      ctx.lineWidth = 2.35 * scale;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(controlX, gripY, botX, botY);
      ctx.stroke();

      ctx.strokeStyle = bowColor;
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(topX + curveDir * 0.5 * scale, topY + 0.4 * scale);
      ctx.quadraticCurveTo(controlX - curveDir * 1.1 * scale, gripY, botX + curveDir * 0.5 * scale, botY - 0.4 * scale);
      ctx.stroke();

      ctx.strokeStyle = bowDark;
      ctx.lineWidth = 1.55 * scale;
      ctx.beginPath();
      ctx.moveTo(gripX - curveDir * 0.75 * scale, gripY - 2.8 * scale);
      ctx.lineTo(gripX + curveDir * 0.75 * scale, gripY + 2.8 * scale);
      ctx.stroke();

      ctx.strokeStyle = stringColor;
      ctx.lineWidth = 0.95 * scale;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      if (isDrawn) {
        ctx.lineTo(pullX, pullY);
        ctx.lineTo(botX, botY);
      } else {
        ctx.lineTo(botX, botY);
      }
      ctx.stroke();

      if (isDrawn) {
        ctx.strokeStyle = shaftColor;
        ctx.lineWidth = 1.3 * scale;
        ctx.beginPath();
        ctx.moveTo(arrowBackX, arrowY);
        ctx.lineTo(arrowTipX, arrowY);
        ctx.stroke();

        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.moveTo(arrowTipX, arrowY);
        ctx.lineTo(arrowTipX - curveDir * 3.2 * scale, arrowY - 1.5 * scale);
        ctx.lineTo(arrowTipX - curveDir * 3.2 * scale, arrowY + 1.5 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = fletchColor;
        ctx.lineWidth = 0.95 * scale;
        ctx.beginPath();
        ctx.moveTo(arrowBackX + curveDir * 0.25 * scale, arrowY);
        ctx.lineTo(arrowBackX + curveDir * 2.25 * scale, arrowY - 1.55 * scale);
        ctx.moveTo(arrowBackX + curveDir * 0.25 * scale, arrowY);
        ctx.lineTo(arrowBackX + curveDir * 2.25 * scale, arrowY + 1.55 * scale);
        ctx.stroke();
      }
    }

    function resolveBowHandSide(entity, options = {}) {
      const aimWorldX = Number(options.aimWorldX);
      const fallbackDx = Number(options.facingDx);
      let facingDx = Number.isFinite(aimWorldX) && entity ? aimWorldX - (Number(entity.x) + 0.5) : NaN;
      if (!Number.isFinite(facingDx) || Math.abs(facingDx) < 0.001) {
        facingDx = Number.isFinite(fallbackDx) ? fallbackDx : 1;
      }
      return facingDx >= 0 ? "right" : "left";
    }

    function resolvePrimaryHandSide(entity, attackVisual, options = {}) {
      const attackAngle = Number(attackVisual && attackVisual.angle);
      if (Number.isFinite(attackAngle)) {
        return Math.cos(attackAngle) >= 0 ? "right" : "left";
      }
      return resolveBowHandSide(entity, options);
    }

    function drawHeldItem(handX, handY, type, side, palette, attackVisual, scale, armPose = null) {
      if (!type || type === "none") {
        return;
      }
      const sign = side === "left" ? -1 : 1;
      const forearmAngle = armPose ? Math.atan2(handY - armPose.elbowY, handX - armPose.elbowX) : side === "left" ? 2.18 : 0.96;
      if (type === "shield") {
        ctx.fillStyle = palette.metal;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.arc(handX + sign * 4.2 * scale, handY + 1.4 * scale, 5.1 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = palette.metalDark;
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.arc(handX + sign * 4.2 * scale, handY + 1.4 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      if (type === "staff" || type === "wand") {
        const len = (type === "staff" ? 18 : 13) * scale;
        drawLine(handX, handY, handX + sign * 2.2 * scale, handY - len, "#5d422c", 2.4 * scale);
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(handX + sign * 2.2 * scale, handY - len - 2.5 * scale, (type === "staff" ? 4.2 : 2.8) * scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (type === "orb") {
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(handX + sign * 5.2 * scale, handY - 1.6 * scale, 4.1 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.58)";
        ctx.beginPath();
        ctx.arc(handX + sign * 6.2 * scale, handY - 3 * scale, 1.8 * scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (type === "axe") {
        const len = 12 * scale;
        const haftAngle = forearmAngle + (attackVisual && attackVisual.kind === "dual_axes" ? sign * 0.26 : sign * 0.12);
        const tipX = handX + Math.cos(haftAngle) * len;
        const tipY = handY + Math.sin(haftAngle) * len;
        drawLine(handX, handY, tipX, tipY, "#6f4c33", 2.2 * scale);
        ctx.fillStyle = palette.metal;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.2 * scale;
        const perpX = -Math.sin(haftAngle);
        const perpY = Math.cos(haftAngle);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + perpX * 5.6 * scale, tipY + perpY * 5.6 * scale);
        ctx.lineTo(tipX + perpX * 2.1 * scale - Math.cos(haftAngle) * 4.4 * scale, tipY + perpY * 2.1 * scale - Math.sin(haftAngle) * 4.4 * scale);
        ctx.lineTo(tipX - Math.cos(haftAngle) * 3.2 * scale, tipY - Math.sin(haftAngle) * 3.2 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        return;
      }
      if (type === "sword") {
        const len = 14 * scale;
        const bladeAngle =
          forearmAngle +
          (attackVisual && attackVisual.kind === "swing"
            ? side === "left"
              ? -0.9
              : 0.9
            : side === "left"
              ? -0.18
              : 0.18);
        const tipX = handX + Math.cos(bladeAngle) * len;
        const tipY = handY + Math.sin(bladeAngle) * len;
        const perpX = -Math.sin(bladeAngle);
        const perpY = Math.cos(bladeAngle);
        drawLine(handX, handY, tipX, tipY, palette.metalDark, 2.4 * scale);
        drawLine(handX + perpX * 0.35 * scale, handY + perpY * 0.35 * scale, tipX + perpX * 0.35 * scale, tipY + perpY * 0.35 * scale, "#f3f6fb", 1 * scale);
        drawLine(handX - perpX * 2.1 * scale, handY - perpY * 2.1 * scale, handX + perpX * 2.1 * scale, handY + perpY * 2.1 * scale, palette.metalDark, 1.6 * scale);
        return;
      }
      if (type === "claws" || type === "none") {
        if (attackVisual === "bite") {
          for (let i = 0; i < 3; i += 1) {
            const offset = (i - 1) * 1.2 * scale;
            drawLine(handX + sign * 0.5 * scale, handY + offset, handX + sign * 3.3 * scale, handY - 2.2 * scale + offset, palette.skinDark, 1.1 * scale);
          }
        }
      }
    }

    function drawHeadgear(cx, headY, headRadius, styleName, palette, scale) {
      if (!styleName || styleName === "none") {
        return;
      }
      if (styleName === "wizard_hat") {
        ctx.fillStyle = palette.cloth;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.ellipse(cx + 0.8 * scale, headY - 2.7 * scale, 13 * scale, 4.8 * scale, -0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 7 * scale, headY - 2.7 * scale);
        ctx.lineTo(cx + 1.8 * scale, headY - 19 * scale);
        ctx.lineTo(cx + 10.5 * scale, headY - 4.4 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f5f8ff";
        ctx.beginPath();
        ctx.arc(cx + 5 * scale, headY - 11 * scale, 1.1 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 1 * scale, headY - 8 * scale, 0.9 * scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (styleName === "hood") {
        ctx.fillStyle = palette.clothDark;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 9.5 * scale, headY - 1.5 * scale);
        ctx.quadraticCurveTo(cx, headY - 14.5 * scale, cx + 9.5 * scale, headY - 1.5 * scale);
        ctx.lineTo(cx + 7.2 * scale, headY + 6.8 * scale);
        ctx.quadraticCurveTo(cx, headY + 10.2 * scale, cx - 7.2 * scale, headY + 6.8 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        return;
      }
      if (styleName === "rusty_helmet") {
        const metal = palette.helmetMetal || "#8f674d";
        const metalDark = palette.helmetMetalDark || "#5f4131";
        ctx.fillStyle = metal;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx, headY, headRadius + 1.25 * scale, Math.PI, Math.PI * 2);
        ctx.lineTo(cx + headRadius + 1.2 * scale, headY + 1.9 * scale);
        ctx.lineTo(cx - headRadius - 1.2 * scale, headY + 1.9 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = metalDark;
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - (headRadius - 1.8) * scale, headY - 0.1 * scale);
        ctx.lineTo(cx + (headRadius - 1.8) * scale, headY - 0.1 * scale);
        ctx.moveTo(cx, headY - headRadius * scale);
        ctx.lineTo(cx, headY + headRadius * 0.4 * scale);
        ctx.stroke();
        ctx.fillStyle = "rgba(168, 108, 74, 0.28)";
        ctx.beginPath();
        ctx.arc(cx - 3.2 * scale, headY - 2.2 * scale, 1.15 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 2.8 * scale, headY + 0.7 * scale, 0.95 * scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (styleName === "helmet") {
        ctx.fillStyle = palette.metal;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx, headY, headRadius + 1.2 * scale, Math.PI, Math.PI * 2);
        ctx.lineTo(cx + headRadius + 1.2 * scale, headY + 1.8 * scale);
        ctx.lineTo(cx - headRadius - 1.2 * scale, headY + 1.8 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = palette.metalDark;
        ctx.lineWidth = 1.6 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - (headRadius - 2) * scale, headY - 0.2 * scale);
        ctx.lineTo(cx + (headRadius - 2) * scale, headY - 0.2 * scale);
        ctx.moveTo(cx, headY - headRadius * scale);
        ctx.lineTo(cx, headY + headRadius * 0.5 * scale);
        ctx.stroke();
      }
    }

    function drawRibCage(cx, cy, palette, scale) {
      drawLine(cx, cy - 7.4 * scale, cx, cy + 7.6 * scale, palette.boneDark, 1.7 * scale);
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 1.2 * scale;
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i += 1) {
        const y = cy - 3.8 * scale + i * 2.6 * scale;
        const ribReach = (5.4 - i * 0.6) * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 0.9 * scale, y);
        ctx.quadraticCurveTo(cx - ribReach * 0.55, y - 1.25 * scale, cx - ribReach, y + 0.4 * scale);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 0.9 * scale, y);
        ctx.quadraticCurveTo(cx + ribReach * 0.55, y - 1.25 * scale, cx + ribReach, y + 0.4 * scale);
        ctx.stroke();
      }
      ctx.fillStyle = palette.bone;
      ctx.beginPath();
      ctx.arc(cx, cy - 1 * scale, 2.35 * scale, 0, Math.PI * 2);
      ctx.fill();
      drawLine(cx - 3.3 * scale, cy + 7.2 * scale, cx + 3.3 * scale, cy + 7.2 * scale, palette.boneDark, 1.6 * scale);
    }

    function drawChest(cx, cy, loadout, palette, species, scale) {
      const chestType = loadout.chest;
      const shouldersType = loadout.shoulders;
      const armorColor =
        chestType === "plate" ? palette.metal : chestType === "leather" ? palette.leather : chestType === "robe" ? palette.cloth : palette.cloth;
      const armorDark =
        chestType === "plate" ? palette.metalDark : chestType === "leather" ? palette.leatherDark : palette.clothDark;
      const bodyColor = species === "skeleton" ? palette.bone : palette.skin;

      if (species === "skeleton" && (chestType === "ribcage" || chestType === "none" || !chestType)) {
        drawRibCage(cx, cy, palette, scale);
      } else if (chestType === "robe") {
        ctx.fillStyle = armorColor;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 7.5 * scale, cy - 6 * scale);
        ctx.quadraticCurveTo(cx, cy - 10.5 * scale, cx + 7.5 * scale, cy - 6 * scale);
        ctx.lineTo(cx + 10 * scale, cy + 10.5 * scale);
        ctx.quadraticCurveTo(cx, cy + 15.5 * scale, cx - 10 * scale, cy + 10.5 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        drawLine(cx, cy - 4 * scale, cx, cy + 11.5 * scale, armorDark, 1.1 * scale);
      } else {
        ctx.fillStyle = species === "zombie" ? bodyColor : armorColor;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8.5 * scale, 7.2 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (chestType === "plate") {
          drawLine(cx - 6 * scale, cy + 3.8 * scale, cx + 6 * scale, cy + 3.8 * scale, armorDark, 1.4 * scale);
        }
      }

      if (shouldersType === "plate") {
        ctx.fillStyle = palette.metal;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.4 * scale;
        ctx.beginPath();
        ctx.ellipse(cx - 7.6 * scale, cy - 3 * scale, 3.8 * scale, 2.7 * scale, -0.35, 0, Math.PI * 2);
        ctx.ellipse(cx + 7.6 * scale, cy - 3 * scale, 3.8 * scale, 2.7 * scale, 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.strokeStyle = loadout.belt === "plate" ? palette.leatherDark : palette.leather;
      ctx.lineWidth = 1.8 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 6.2 * scale, cy + 4.8 * scale);
      ctx.lineTo(cx + 6.2 * scale, cy + 4.8 * scale);
      ctx.stroke();
    }

    function drawHead(cx, cy, palette, species, scale) {
      const headRadius = species === "orc" ? 9.8 * scale : species === "skeleton" ? 8.9 * scale : 8.4 * scale;
      const headFill = species === "skeleton" ? palette.bone : palette.skin;
      ctx.fillStyle = headFill;
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (species === "skeleton") {
        ctx.fillStyle = palette.eye;
        ctx.beginPath();
        ctx.arc(cx - 3.2 * scale, cy - 1.2 * scale, 2 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 3.2 * scale, cy - 1.2 * scale, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 1.4 * scale);
        ctx.lineTo(cx - 1 * scale, cy + 3.5 * scale);
        ctx.lineTo(cx + 1 * scale, cy + 3.5 * scale);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = palette.eye;
        ctx.beginPath();
        ctx.arc(cx - 2.4 * scale, cy - 1.4 * scale, 0.9 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 2.4 * scale, cy - 1.4 * scale, 0.9 * scale, 0, Math.PI * 2);
        ctx.fill();
        if (species === "orc") {
          ctx.fillStyle = palette.tusk;
          ctx.beginPath();
          ctx.moveTo(cx - 2.2 * scale, cy + 4.2 * scale);
          ctx.lineTo(cx - 1 * scale, cy + 7.5 * scale);
          ctx.lineTo(cx - 0.2 * scale, cy + 4.4 * scale);
          ctx.closePath();
          ctx.moveTo(cx + 2.2 * scale, cy + 4.2 * scale);
          ctx.lineTo(cx + 1 * scale, cy + 7.5 * scale);
          ctx.lineTo(cx + 0.2 * scale, cy + 4.4 * scale);
          ctx.closePath();
          ctx.fill();
        }
      }

      return headRadius;
    }

    function getArmPose(side, attackVisual, motion, scale, mainHandSide = "right", loadout = null, style = null) {
      const sign = side === "left" ? -1 : 1;
      let upperAngle = side === "left" ? 2.18 : 0.96;
      let lowerAngle = side === "left" ? 1.88 : 1.28;
      const archetype = toLowerWord(style && style.archetype);
      const mainHandType = toLowerWord(loadout && loadout.mainHand && loadout.mainHand.type);
      const walkSwing = motion.moving ? motion.walk : motion.idle * 0.3;
      if (attackVisual.kind === "swing") {
        if (side === mainHandSide) {
          const raiseT = clamp(attackVisual.progress / 0.34, 0, 1);
          const slashT = clamp((attackVisual.progress - 0.34) / 0.66, 0, 1);
          if (side === "left") {
            const idleUpper = 2.28;
            const idleLower = 1.96;
            const raisedUpper = 4.88;
            const raisedLower = 4.08;
            const slashUpper = 1.34;
            const slashLower = 0.78;
            upperAngle = attackVisual.progress < 0.34 ? lerp(idleUpper, raisedUpper, raiseT) : lerp(raisedUpper, slashUpper, slashT);
            lowerAngle = attackVisual.progress < 0.34 ? lerp(idleLower, raisedLower, raiseT) : lerp(raisedLower, slashLower, slashT);
          } else {
            const idleUpper = 1.02;
            const idleLower = 1.34;
            const raisedUpper = -2.28;
            const raisedLower = -1.18;
            const slashUpper = 1.78;
            const slashLower = 1.14;
            upperAngle = attackVisual.progress < 0.34 ? lerp(idleUpper, raisedUpper, raiseT) : lerp(raisedUpper, slashUpper, slashT);
            lowerAngle = attackVisual.progress < 0.34 ? lerp(idleLower, raisedLower, raiseT) : lerp(raisedLower, slashLower, slashT);
          }
        } else if (side === "left") {
          upperAngle = 2.28;
          lowerAngle = 1.96;
        } else {
          upperAngle = 1.02;
          lowerAngle = 1.34;
        }
      } else if (attackVisual.kind === "dual_axes") {
        const leads = (attackVisual.sequence & 1) === 0;
        const thisLeading = side === (leads ? "left" : "right");
        if (thisLeading) {
          upperAngle = side === "left" ? lerp(2.18, 3.96, attackVisual.progress) : lerp(0.96, 5.48, attackVisual.progress);
          lowerAngle = upperAngle + (side === "left" ? -0.36 : 0.36);
        } else {
          upperAngle = side === "left" ? 2.24 : 0.92;
          lowerAngle = side === "left" ? 1.92 : 1.24;
        }
      } else if (attackVisual.kind === "bow") {
        if (side === "left") {
          upperAngle = lerp(2.86, 3.08, attackVisual.progress);
          lowerAngle = lerp(3.02, 3.15, attackVisual.progress);
        } else {
          upperAngle = lerp(0.82, 0.18, attackVisual.progress);
          lowerAngle = lerp(2.28, 3.06, attackVisual.progress);
        }
      } else if (attackVisual.kind === "bite") {
        upperAngle = side === "left" ? lerp(2.35, 3.18, attackVisual.progress) : lerp(0.82, -0.18, attackVisual.progress);
        lowerAngle = upperAngle + (side === "left" ? -0.08 : 0.08);
      } else if (attackVisual.kind === "cast") {
        if (side === "left") {
          upperAngle = 2.48;
          lowerAngle = 2.16;
        } else {
          upperAngle = lerp(0.72, -0.08, attackVisual.progress);
          lowerAngle = upperAngle + 0.14;
        }
      } else {
        if (mainHandType === "sword" && archetype === "warrior" && side === mainHandSide) {
          if (side === "left") {
            upperAngle = 2.28;
            lowerAngle = 1.96;
          } else {
            upperAngle = 1.02;
            lowerAngle = 1.34;
          }
        }
        upperAngle += walkSwing * 0.12 * sign;
        lowerAngle += walkSwing * 0.08 * sign;
      }
      return {
        upperAngle,
        lowerAngle,
        upperLen: 6 * scale,
        lowerLen: 5.9 * scale
      };
    }

    function getLegPose(side, motion, scale) {
      const sign = side === "left" ? -1 : 1;
      const walkSwing = motion.moving ? motion.walk : 0;
      const upperAngle = Math.PI * 0.52 + sign * walkSwing * 0.26;
      const lowerAngle = Math.PI * 0.6 - sign * walkSwing * 0.34;
      const footAngle = sign * 0.12 + walkSwing * sign * 0.08;
      return {
        upperAngle,
        lowerAngle,
        footAngle,
        upperLen: 5.9 * scale,
        lowerLen: 5.4 * scale,
        footLen: 2.9 * scale
      };
    }

    function drawHumanoid(options = {}) {
      const entity = options.entity || null;
      const p = options.p || null;
      const style = options.style && typeof options.style === "object" ? options.style : {};
      const equipmentSlots = options.equipmentSlots && typeof options.equipmentSlots === "object" ? options.equipmentSlots : {};
      const attackState = options.attackState || null;
      const castState = options.castState || null;
      const isSelf = !!options.isSelf;
      if (!entity || !p) {
        return;
      }

      const species = toLowerWord(style.species) || (isHumanoidSpriteType(style.spriteType) ? style.spriteType : "human");
      const scale = clamp(Number(style.sizeScale) || 1, 0.6, 2.4);
      const motion = getMotionState(options.entityKey || String(entity.id || "entity"), entity, style);
      const palette = getBasePalette(style, { isSelf });
      const loadout = buildLoadout(style, equipmentSlots);
      const attackVisual = resolveAttackState(style, loadout, attackState, castState);
      const runtimeState = motion.runtimeState || null;
      const targetBowPull = loadout.mainHand.type === "bow" && attackVisual.kind === "bow" ? clamp(Number(attackVisual.progress) || 0, 0, 1) : 0;
      const bowPull =
        runtimeState
          ? (runtimeState.bowPull = lerp(Number(runtimeState.bowPull) || 0, targetBowPull, targetBowPull > (Number(runtimeState.bowPull) || 0) ? 0.28 : 0.18))
          : targetBowPull;
      const bowHandSide = loadout.mainHand.type === "bow" ? resolveBowHandSide(entity, options) : "left";
      const mainHandSide = loadout.mainHand.type === "bow" ? bowHandSide : resolvePrimaryHandSide(entity, attackVisual, options);
      const cx = p.x + motion.sway * 0.12;
      const cy = p.y + motion.bob * 0.2;
      const headY = cy - 8.3 * scale;
      const shoulderY = cy - 0.5 * scale;
      const hipY = cy + 7.8 * scale;
      const shoulderSpread = 5.9 * scale;
      const hipSpread = 3 * scale;

      if (species !== "skeleton") {
        drawLine(cx, headY + 7.5 * scale, cx, shoulderY - 0.6 * scale, palette.outline, 2 * scale);
      }

      for (const side of ["left", "right"]) {
        const sign = side === "left" ? -1 : 1;
        const pose = getLegPose(side, motion, scale);
        const hipX = cx + sign * hipSpread;
        const kneeX = hipX + Math.cos(pose.upperAngle) * pose.upperLen;
        const kneeY = hipY + Math.sin(pose.upperAngle) * pose.upperLen;
        const ankleX = kneeX + Math.cos(pose.lowerAngle) * pose.lowerLen;
        const ankleY = kneeY + Math.sin(pose.lowerAngle) * pose.lowerLen;
        const toeX = ankleX + Math.cos(pose.footAngle) * pose.footLen;
        const toeY = ankleY + Math.sin(pose.footAngle) * pose.footLen;
        const legColor =
          loadout.pants === "plate" ? palette.metalDark : loadout.pants === "leather" ? palette.leather : loadout.pants === "robe" ? palette.cloth : species === "skeleton" ? palette.boneDark : palette.cloth;
        drawLine(hipX, hipY, kneeX, kneeY, legColor, 2.9 * scale);
        drawLine(kneeX, kneeY, ankleX, ankleY, legColor, 2.7 * scale);
        drawLine(ankleX, ankleY, toeX, toeY, legColor, 2.2 * scale);
        drawJoint(kneeX, kneeY, 1.18 * scale, legColor, palette.outline, 0.8 * scale);
        drawJoint(ankleX, ankleY, 0.92 * scale, legColor, palette.outline, 0.72 * scale);
        ctx.fillStyle = loadout.boots === "plate" ? palette.metal : loadout.boots === "leather" ? palette.leatherDark : palette.outline;
        ctx.beginPath();
        ctx.ellipse(toeX, toeY + 0.9 * scale, 2.45 * scale, 1.45 * scale, pose.footAngle, 0, Math.PI * 2);
        ctx.fill();
      }

      drawChest(cx, cy + 3.2 * scale, loadout, palette, species, scale);
      const headRadius = drawHead(cx, headY, palette, species, scale);
      drawHeadgear(cx, headY, headRadius, loadout.head, palette, scale);

      const armPoseBySide = {};
      for (const side of ["left", "right"]) {
        const sign = side === "left" ? -1 : 1;
        const pose = getArmPose(side, attackVisual, motion, scale, mainHandSide, loadout, style);
        const shoulderX = cx + sign * shoulderSpread;
        const elbowX = shoulderX + Math.cos(pose.upperAngle) * pose.upperLen;
        const elbowY = shoulderY + Math.sin(pose.upperAngle) * pose.upperLen;
        const handX = elbowX + Math.cos(pose.lowerAngle) * pose.lowerLen;
        const handY = elbowY + Math.sin(pose.lowerAngle) * pose.lowerLen;
        const armColor = species === "skeleton" ? palette.boneDark : palette.skin;
        drawLine(shoulderX, shoulderY, elbowX, elbowY, armColor, 2.7 * scale);
        drawLine(elbowX, elbowY, handX, handY, armColor, 2.7 * scale);
        drawJoint(elbowX, elbowY, 1.05 * scale, armColor, palette.outline, 0.75 * scale);
        drawJoint(handX, handY, 1.45 * scale, armColor, palette.outline, 0.7 * scale);
        armPoseBySide[side] = { elbowX, elbowY, handX, handY };
      }

      if (loadout.mainHand.type === "bow") {
        const bowHandPose = armPoseBySide[bowHandSide];
        const drawHandSide = bowHandSide === "left" ? "right" : "left";
        const drawHandPose = armPoseBySide[drawHandSide];
        drawBowWeapon(bowHandPose, drawHandPose, bowHandSide, palette, bowPull, scale);
      } else {
        const offHandSide = mainHandSide === "left" ? "right" : "left";
        for (const side of ["left", "right"]) {
          const handPose = armPoseBySide[side];
          const handItem = side === mainHandSide ? loadout.mainHand : side === offHandSide ? loadout.offHand : { type: "none" };
          drawHeldItem(handPose.handX, handPose.handY, handItem.type, side, palette, attackVisual, scale, handPose);
        }
      }

      if (attackVisual.kind === "cast" && (loadout.mainHand.type === "staff" || loadout.mainHand.type === "wand")) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255, 177, 84, 0.38)";
        ctx.beginPath();
        ctx.arc(cx + 13 * scale, cy - 2.5 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    return {
      isHumanoidSpriteType,
      isHumanoidStyle,
      drawHumanoid,
      pruneHumanoidMotionRuntime
    };
  }

  globalScope.VibeClientRenderHumanoids = Object.freeze({
    createHumanoidRenderTools
  });
})(globalThis);
