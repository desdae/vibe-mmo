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
    const rarityRankById = Object.freeze({
      normal: 0,
      magic: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      mythic: 5,
      divine: 6
    });
    const rarityColorById = Object.freeze({
      normal: "#c4d0da",
      magic: "#58a6ff",
      rare: "#f3d26b",
      epic: "#be7dff",
      legendary: "#ff9747",
      mythic: "#ff5fc8",
      divine: "#fff1b5"
    });
    const themeAccentById = Object.freeze({
      fire: "#ff8d52",
      frost: "#7fd9ff",
      arcane: "#b58cff",
      lightning: "#ffe06a",
      poison: "#89d96d",
      shadow: "#7b73af",
      holy: "#fff0a4",
      vitality: "#71d5a1",
      guard: "#d3dbe7",
      wind: "#9fe2d4",
      precision: "#ffd1a1"
    });
    const slotAuraThresholds = Object.freeze({
      head: 3,
      chest: 2,
      mainHand: 2,
      offHand: 3
    });

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

    function hexToRgb(color) {
      const raw = sanitizeCssColor(color).replace("#", "");
      if (!raw) {
        return { r: 255, g: 255, b: 255 };
      }
      const expanded =
        raw.length === 3
          ? raw
              .split("")
              .map((part) => part + part)
              .join("")
          : raw.slice(0, 6);
      return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16)
      };
    }

    function rgbToCss(rgb, alpha = 1) {
      return `rgba(${clamp(Math.round(rgb.r || 0), 0, 255)}, ${clamp(Math.round(rgb.g || 0), 0, 255)}, ${clamp(
        Math.round(rgb.b || 0),
        0,
        255
      )}, ${clamp(alpha, 0, 1)})`;
    }

    function mixColors(colorA, colorB, ratio = 0.5, alpha = 1) {
      const a = hexToRgb(colorA);
      const b = hexToRgb(colorB);
      const t = clamp(ratio, 0, 1);
      return rgbToCss(
        {
          r: lerp(a.r, b.r, t),
          g: lerp(a.g, b.g, t),
          b: lerp(a.b, b.b, t)
        },
        alpha
      );
    }

    function tintHex(colorA, colorB, ratio = 0.5) {
      const a = hexToRgb(colorA);
      const b = hexToRgb(colorB);
      const t = clamp(ratio, 0, 1);
      const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
      return (
        "#" +
        toHex(lerp(a.r, b.r, t)) +
        toHex(lerp(a.g, b.g, t)) +
        toHex(lerp(a.b, b.b, t))
      );
    }

    function getAppearanceThemeList(entry) {
      if (Array.isArray(entry?.appearanceThemes) && entry.appearanceThemes.length) {
        return entry.appearanceThemes.map((value) => toLowerWord(value)).filter(Boolean).slice(0, 3);
      }
      const themes = new Set();
      const text = `${String(entry?.name || "")} ${String(entry?.itemId || "")}`.toLowerCase();
      const tagValues = Array.isArray(entry?.tags) ? entry.tags.map((value) => toLowerWord(value)).filter(Boolean) : [];
      for (const tag of tagValues) {
        if (themeAccentById[tag]) {
          themes.add(tag);
        }
      }
      for (const themeId of Object.keys(themeAccentById)) {
        if (text.includes(themeId)) {
          themes.add(themeId);
        }
      }
      return Array.from(themes).slice(0, 3);
    }

    function getAppearanceSeed(entry, fallbackKey) {
      const explicitSeed = Number(entry?.appearanceSeed);
      if (Number.isFinite(explicitSeed) && explicitSeed > 0) {
        return explicitSeed >>> 0;
      }
      return hashString(`${fallbackKey || "slot"}|${String(entry?.itemId || "")}|${String(entry?.name || "")}`);
    }

    function getRarityId(entry) {
      const rarityId = toLowerWord(entry?.rarity);
      return rarityRankById[rarityId] !== undefined ? rarityId : "normal";
    }

    function getAppearancePower(entry) {
      const explicitPower = Number(entry?.appearancePower);
      if (Number.isFinite(explicitPower) && explicitPower > 0) {
        return explicitPower;
      }
      return 0;
    }

    function createSlotVisual(entry, fallbackKey, slotId, extra = {}) {
      const themes = getAppearanceThemeList(entry);
      const rarityId = getRarityId(entry);
      const seed = getAppearanceSeed(entry, `${slotId}|${fallbackKey}`);
      const primaryTheme = themes[0] || "";
      const accentColor = themeAccentById[primaryTheme] || rarityColorById[rarityId] || "#d5ddea";
      const rarityColor = rarityColorById[rarityId] || rarityColorById.normal;
      const appearancePower = getAppearancePower(entry);
      const auraStrength = clamp(
        (Math.max(0, rarityRankById[rarityId] - 2) * 0.18) + Math.min(0.28, appearancePower / 120),
        0,
        0.8
      );
      return {
        slotId,
        seed,
        variant: seed % 5,
        variantMinor: (seed >>> 3) % 7,
        rarityId,
        rarityRank: rarityRankById[rarityId] || 0,
        rarityColor,
        themes,
        primaryTheme,
        accentColor,
        trimColor: tintHex(rarityColor, accentColor, 0.32),
        auraStrength,
        appearancePower,
        itemId: String(entry?.itemId || ""),
        nameText: getNameText(entry),
        tags: getTagSet(entry),
        ...extra
      };
    }

    function getVisualMaterialColors(profile, palette, material) {
      const styleVariant = profile?.styleVariant || "simple";
      const rarityRank = profile?.rarityRank || 0;
      const itemLevel = profile?.itemLevel || 1;
      const accentColor = profile?.accentColor || palette.accent;
      const trimColor = profile?.trimColor || palette.outline;

      // Base colors by material
      let basePrimary, baseSecondary;
      if (material === "plate") {
        basePrimary = palette.metal;
        baseSecondary = palette.metalDark;
      } else if (material === "leather") {
        basePrimary = palette.leather;
        baseSecondary = palette.leatherDark;
      } else {
        basePrimary = palette.cloth;
        baseSecondary = palette.clothDark;
      }

      // Style variant tints
      const variantTint = getStyleVariantTint(styleVariant, accentColor, rarityRank);
      basePrimary = tintHex(basePrimary, variantTint, 0.15);
      baseSecondary = tintHex(baseSecondary, variantTint, 0.1);

      // Rarity-based glow/shine boost
      const rarityBoost = rarityRank >= 3 ? 0.2 + (rarityRank - 3) * 0.08 : 0;
      const accentRatio = clamp(
        0.12 + rarityRank * 0.04 + (profile?.appearancePower || 0) / 240 + rarityBoost,
        0.08,
        0.55
      );

      // Item level brightness (higher level = slightly brighter)
      const levelBrightness = Math.min(0.15, itemLevel / 100);

      return {
        primary: tintHex(basePrimary, accentColor, accentRatio),
        secondary: tintHex(baseSecondary, accentColor, accentRatio * 0.65),
        trim: tintHex(trimColor || profile?.rarityColor || baseSecondary, "#ffffff", 0.1 + levelBrightness),
        glow: rarityRank >= 2 ? tintHex(accentColor, "#ffffff", 0.3) : null,
        shine: rarityRank >= 3 ? tintHex("#ffffff", accentColor, 0.7) : null,
        styleVariant,
        rarityRank,
        itemLevel
      };
    }

    function getStyleVariantTint(styleVariant, accentColor, rarityRank) {
      // Return a tint color based on the style variant
      const variantTints = {
        ornate: "#ffd774",
        royal: "#e8c5ff",
        crystalline: "#a8e8ff",
        runeforged: "#ff8dc4",
        gothic: "#4a5568",
        field: "#8b9dc3",
        fullplate: "#c5d0dc",
        chainmail: "#94a3b8",
        scale: "#7d8f9e",
        brigandine: "#6b7f8f",
        studded: "#8b7355",
        reinforced: "#6b5f5f",
        supple: "#a08060",
        worn: "#7a6f65",
        dragonscale: "#8b4545",
        bone: "#e8dcc8",
        embroidered: "#c9a86c",
        layered: "#a89f94",
        simple: "#b8c0c8",
        ethereal: "#d4c5ff",
        runed: "#ff9d6c"
      };

      const baseTint = variantTints[styleVariant] || "#b8c0c8";
      // Blend with accent color based on rarity
      if (rarityRank >= 2) {
        return tintHex(baseTint, accentColor, 0.2 + rarityRank * 0.05);
      }
      return baseTint;
    }

    function drawItemAura(x, y, profile, scale, spreadScale = 1) {
      if (!profile) {
        return;
      }
      const threshold = slotAuraThresholds[profile.slotId] ?? 4;
      if (profile.rarityRank < threshold && profile.auraStrength < 0.24) {
        return;
      }
      const seed = profile.seed || 0;
      const particleCount = Math.min(4, 2 + Math.floor(profile.rarityRank / 2));
      const now = performance.now() / 1000;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let index = 0; index < particleCount; index += 1) {
        const angle = now * (0.8 + ((seed + index) % 7) * 0.09) + (Math.PI * 2 * index) / particleCount + ((seed >>> 4) % 31) * 0.07;
        const radius = (5 + index * 2.1 + ((seed >>> (index + 3)) % 5)) * scale * spreadScale;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius * 0.72;
        const glowRadius = (1.1 + ((seed >>> (index + 7)) % 3) * 0.45) * scale;
        ctx.fillStyle = mixColors(profile.accentColor, "#ffffff", 0.45, clamp(0.28 + profile.auraStrength * 0.55, 0.22, 0.74));
        ctx.beginPath();
        ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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
      const tags = getTagSet(entry);
      if (nameText.includes("hood")) {
        return "hood";
      }
      if (
        nameText.includes("cap") ||
        nameText.includes("coif") ||
        nameText.includes("skullcap") ||
        nameText.includes("helmcap")
      ) {
        return "cap";
      }
      if (
        nameText.includes("hat") ||
        nameText.includes("oracle") ||
        nameText.includes("wizard") ||
        nameText.includes("sorcer") ||
        nameText.includes("magus")
      ) {
        return "wizard_hat";
      }
      if (
        nameText.includes("crown") ||
        nameText.includes("circlet") ||
        nameText.includes("diadem") ||
        nameText.includes("tiara")
      ) {
        return "crown";
      }
      if (
        nameText.includes("horn") ||
        nameText.includes("antler") ||
        nameText.includes("viking")
      ) {
        return "horned_helmet";
      }
      if (
        nameText.includes("mask") ||
        nameText.includes("visor") ||
        nameText.includes("faceguard") ||
        nameText.includes("barbute") ||
        nameText.includes("sallet")
      ) {
        return "mask_helmet";
      }
      if (
        nameText.includes("greathelm") ||
        nameText.includes("great helm") ||
        nameText.includes("full helm") ||
        nameText.includes("plate helm") ||
        (
          (nameText.includes("helm") || nameText.includes("helmet")) &&
          (
            nameText.includes("plate") ||
            nameText.includes("iron") ||
            nameText.includes("steel") ||
            nameText.includes("knight") ||
            nameText.includes("guardian") ||
            nameText.includes("warden") ||
            nameText.includes("recruit")
          )
        )
      ) {
        return "greathelm";
      }
      if (nameText.includes("helm") || nameText.includes("helmet")) {
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
      if (archetype === "ranger" || tags.has("light") || tags.has("medium")) {
        return nameText.includes("cap") ? "cap" : "hood";
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

    function buildArmorVisual(entry, fallback, slotId) {
      const material = resolveArmorMaterial(entry, fallback);
      const itemLevel = Number(entry?.itemLevel) || 1;
      const rarityRank = rarityRankById[getRarityId(entry)] || 0;
      const affixCount = Array.isArray(entry?.affixes) ? entry.affixes.length : 0;
      const styleVariant = resolveArmorStyleVariant(entry, material, itemLevel, rarityRank, affixCount);
      return createSlotVisual(entry, fallback, slotId, { material, styleVariant, itemLevel, affixCount });
    }

    function resolveArmorStyleVariant(entry, material, itemLevel, rarityRank, affixCount) {
      const nameText = getNameText(entry);
      const tags = getTagSet(entry);
      const seed = getAppearanceSeed(entry, `variant|${material}`);
      const baseVariant = seed % 4;

      // High item level or rarity unlocks more ornate styles
      const isHighLevel = itemLevel >= 15;
      const isMidLevel = itemLevel >= 8;
      const isHighRarity = rarityRank >= 3; // epic+
      const isMagicPlus = rarityRank >= 1; // magic+

      // Ornate/royal styles for high rarity/level
      if (isHighRarity && (isHighLevel || affixCount >= 2)) {
        const ornateTypes = ["ornate", "royal", "crystalline", "runeforged"];
        return ornateTypes[seed % ornateTypes.length];
      }

      // Material-specific variants
      if (material === "plate") {
        if (isHighLevel) {
          const variants = ["fullplate", "gothic", "field", "ornate"];
          return variants[baseVariant % variants.length];
        }
        if (isMidLevel) {
          const variants = ["fullplate", "chainmail", "brigandine"];
          return variants[baseVariant % variants.length];
        }
        const variants = ["fullplate", "chainmail", "scale", "brigandine"];
        return variants[baseVariant % variants.length];
      }

      if (material === "leather") {
        if (isHighLevel) {
          const variants = ["studded", "scaled", "bone", "dragonscale"];
          return variants[baseVariant % variants.length];
        }
        if (isMagicPlus) {
          const variants = ["studded", "reinforced", "supple"];
          return variants[baseVariant % variants.length];
        }
        const variants = ["studded", "reinforced", "worn", "supple"];
        return variants[baseVariant % variants.length];
      }

      if (material === "robe") {
        if (isHighRarity) {
          const variants = ["ornate", "crystalline", "ethereal", "runed"];
          return variants[baseVariant % variants.length];
        }
        if (isMidLevel) {
          const variants = ["reinforced", "embroidered", "layered"];
          return variants[baseVariant % variants.length];
        }
        const variants = ["simple", "layered", "worn", "embroidered"];
        return variants[baseVariant % variants.length];
      }

      // Default variants
      const variants = ["simple", "reinforced", "ornate", "worn"];
      return variants[baseVariant % variants.length];
    }

    function buildHeadVisual(entry, fallback, style) {
      const kind = resolveHeadStyle(entry, fallback, style);
      return createSlotVisual(entry, kind, "head", { kind });
    }

    function buildHeldItemVisual(entry, fallback, slotId) {
      const held = resolveHeldItem(entry, fallback, slotId);
      const profile = createSlotVisual(entry, held.type || fallback, slotId, held);
      return profile;
    }

    function buildLoadout(style, equipmentSlots, useDefaultGearFallback = true) {
      const defaults =
        useDefaultGearFallback && style?.defaults && typeof style.defaults === "object"
          ? style.defaults
          : {
              head: "none",
              chest: "none",
              shoulders: "none",
              gloves: "none",
              bracers: "none",
              belt: "none",
              pants: "none",
              boots: "none",
              mainHand: "none",
              offHand: "none"
            };
      const chestEntry = getSlotEntry(equipmentSlots, "chest");
      const pantsEntry = getSlotEntry(equipmentSlots, "pants");
      const bootsEntry = getSlotEntry(equipmentSlots, "boots");
      const chestStyle = resolveArmorMaterial(chestEntry, defaults.chest);
      const pantsStyle = resolveArmorMaterial(pantsEntry, defaults.pants || chestStyle);
      const bootsStyle = resolveArmorMaterial(bootsEntry, defaults.boots || pantsStyle);
      const mainHand = resolveHeldItem(getSlotEntry(equipmentSlots, "mainHand"), defaults.mainHand, "mainHand");
      const offHand = resolveHeldItem(getSlotEntry(equipmentSlots, "offHand"), defaults.offHand, "offHand");
      const headVisual = buildHeadVisual(getSlotEntry(equipmentSlots, "head"), defaults.head, style);
      const shouldersVisual = buildArmorVisual(getSlotEntry(equipmentSlots, "shoulders"), defaults.shoulders || chestStyle, "shoulders");
      const chestVisual = buildArmorVisual(chestEntry, defaults.chest, "chest");
      const glovesVisual = buildArmorVisual(getSlotEntry(equipmentSlots, "gloves"), defaults.gloves || chestStyle, "gloves");
      const bracersVisual = buildArmorVisual(getSlotEntry(equipmentSlots, "bracers"), defaults.bracers || chestStyle, "bracers");
      const beltVisual = buildArmorVisual(getSlotEntry(equipmentSlots, "belt"), defaults.belt || chestStyle, "belt");
      const pantsVisual = buildArmorVisual(pantsEntry, defaults.pants || chestStyle, "pants");
      const bootsVisual = buildArmorVisual(bootsEntry, defaults.boots || pantsStyle, "boots");
      const mainHandVisual = buildHeldItemVisual(getSlotEntry(equipmentSlots, "mainHand"), defaults.mainHand, "mainHand");
      const offHandVisual = mainHand.twoHanded
        ? createSlotVisual(null, "none", "offHand", { type: "none", twoHanded: false, slotId: "offHand" })
        : buildHeldItemVisual(getSlotEntry(equipmentSlots, "offHand"), defaults.offHand, "offHand");
      return {
        head: headVisual.kind,
        headVisual,
        shoulders: shouldersVisual.material,
        shouldersVisual,
        chest: chestStyle,
        chestVisual,
        gloves: glovesVisual.material,
        glovesVisual,
        bracers: bracersVisual.material,
        bracersVisual,
        belt: beltVisual.material,
        beltVisual,
        pants: pantsStyle,
        pantsVisual,
        boots: bootsStyle,
        bootsVisual,
        mainHand,
        mainHandVisual,
        offHand: mainHand.twoHanded ? { type: "none", twoHanded: false, slotId: "offHand" } : offHand,
        offHandVisual
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

    function drawBowWeapon(mainHandPose, drawHandPose, side, palette, pull, scale, profile = null) {
      if (!mainHandPose) {
        return;
      }
      const sign = side === "left" ? -1 : 1;
      const curveDir = sign;
      const bowColor = tintHex(palette.bow || palette.leather, profile?.accentColor || palette.accent, 0.12 + (profile?.rarityRank || 0) * 0.04);
      const bowDark = tintHex(palette.bowDark || palette.leatherDark, profile?.trimColor || palette.outline, 0.2);
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
      drawItemAura(gripX + curveDir * 2.2 * scale, gripY, profile, scale, 0.7);

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

    function drawHeldItem(handX, handY, type, side, palette, attackVisual, scale, armPose = null, profile = null) {
      if (!type || type === "none") {
        return;
      }
      const sign = side === "left" ? -1 : 1;
      const forearmAngle = armPose ? Math.atan2(handY - armPose.elbowY, handX - armPose.elbowX) : side === "left" ? 2.18 : 0.96;
      const forearmUnitX = Math.cos(forearmAngle);
      const forearmUnitY = Math.sin(forearmAngle);
      const perpX = -forearmUnitY;
      const perpY = forearmUnitX;
      const metalPrimary = tintHex(palette.metal, profile?.accentColor || palette.accent, 0.08 + (profile?.rarityRank || 0) * 0.05);
      const metalSecondary = tintHex(palette.metalDark, profile?.trimColor || palette.outline, 0.22);
      const leatherPrimary = tintHex(palette.leather, profile?.accentColor || palette.accent, 0.14);
      const leatherSecondary = tintHex(palette.leatherDark, profile?.trimColor || palette.outline, 0.18);
      const variant = Number(profile?.variant || 0);
      drawItemAura(handX + sign * 2.8 * scale, handY - 1.5 * scale, profile, scale, 0.54);
      if (type === "shield") {
        const shieldRadiusX = (variant % 2 === 0 ? 5.1 : 4.4) * scale;
        const shieldRadiusY = (variant % 3 === 0 ? 5.6 : 4.7) * scale;
        const shieldCenterX = handX - sign * 1.6 * scale - forearmUnitX * 1.1 * scale;
        const shieldCenterY = handY - 2.2 * scale - forearmUnitY * 0.7 * scale;
        ctx.fillStyle = metalPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        if (variant % 2 === 0) {
          ctx.arc(shieldCenterX, shieldCenterY, shieldRadiusX, 0, Math.PI * 2);
        } else {
          ctx.ellipse(shieldCenterX, shieldCenterY, shieldRadiusX, shieldRadiusY, sign * 0.18, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = metalSecondary;
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        if (variant % 2 === 0) {
          ctx.arc(shieldCenterX, shieldCenterY, 4 * scale, 0, Math.PI * 2);
        } else {
          ctx.ellipse(shieldCenterX, shieldCenterY, 3.25 * scale, 4.1 * scale, sign * 0.18, 0, Math.PI * 2);
        }
        ctx.stroke();
        return;
      }
      if (type === "staff" || type === "wand") {
        const len = (type === "staff" ? 18 + variant * 0.8 : 13 + variant * 0.6) * scale;
        drawLine(handX, handY, handX + sign * 2.2 * scale, handY - len, leatherSecondary, 2.4 * scale);
        ctx.fillStyle = profile?.accentColor || palette.accent;
        ctx.beginPath();
        ctx.arc(handX + sign * 2.2 * scale, handY - len - 2.5 * scale, (type === "staff" ? 4.2 : 2.8) * scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (type === "orb") {
        ctx.fillStyle = profile?.accentColor || palette.accent;
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
        const len = (11.5 + variant * 0.9) * scale;
        const gripX = handX - forearmUnitX * 1.3 * scale + perpX * sign * 0.55 * scale;
        const gripY = handY - forearmUnitY * 1.3 * scale + perpY * sign * 0.55 * scale;
        const haftAngle =
          forearmAngle +
          (attackVisual && attackVisual.kind === "dual_axes"
            ? side === "left"
              ? -0.44
              : 0.44
            : side === "left"
              ? -0.62
              : 0.62);
        const tipX = gripX + Math.cos(haftAngle) * len;
        const tipY = gripY + Math.sin(haftAngle) * len;
        drawLine(gripX, gripY, tipX, tipY, leatherSecondary, 2.2 * scale);
        ctx.fillStyle = metalPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.2 * scale;
        const bladePerpX = -Math.sin(haftAngle);
        const bladePerpY = Math.cos(haftAngle);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + bladePerpX * (5.2 + variant * 0.55) * scale, tipY + bladePerpY * (5.2 + variant * 0.55) * scale);
        ctx.lineTo(
          tipX + bladePerpX * (2 + variant * 0.2) * scale - Math.cos(haftAngle) * (4.1 + variant * 0.5) * scale,
          tipY + bladePerpY * (2 + variant * 0.2) * scale - Math.sin(haftAngle) * (4.1 + variant * 0.5) * scale
        );
        ctx.lineTo(tipX - Math.cos(haftAngle) * 3.2 * scale, tipY - Math.sin(haftAngle) * 3.2 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        return;
      }
      if (type === "sword") {
        const len = (13 + variant * 1.15) * scale;
        const gripX = handX - forearmUnitX * 1.15 * scale + perpX * sign * 0.4 * scale;
        const gripY = handY - forearmUnitY * 1.15 * scale + perpY * sign * 0.4 * scale;
        const bladeAngle =
          attackVisual && attackVisual.kind === "swing"
            ? forearmAngle + (side === "left" ? -0.68 : 0.68)
            : side === "left"
              ? -2.18
              : -0.96;
        const tipX = gripX + Math.cos(bladeAngle) * len;
        const tipY = gripY + Math.sin(bladeAngle) * len;
        const bladePerpX = -Math.sin(bladeAngle);
        const bladePerpY = Math.cos(bladeAngle);
        drawLine(gripX, gripY, tipX, tipY, metalSecondary, 2.4 * scale);
        drawLine(gripX + bladePerpX * 0.35 * scale, gripY + bladePerpY * 0.35 * scale, tipX + bladePerpX * 0.35 * scale, tipY + bladePerpY * 0.35 * scale, mixColors("#f3f6fb", profile?.accentColor || "#f3f6fb", 0.18), 1 * scale);
        drawLine(
          gripX - bladePerpX * (1.7 + variant * 0.42) * scale,
          gripY - bladePerpY * (1.7 + variant * 0.42) * scale,
          gripX + bladePerpX * (2.1 + variant * 0.52) * scale,
          gripY + bladePerpY * (2.1 + variant * 0.52) * scale,
          metalSecondary,
          1.6 * scale
        );
        drawLine(
          gripX - Math.cos(bladeAngle) * 2.2 * scale,
          gripY - Math.sin(bladeAngle) * 2.2 * scale,
          gripX - Math.cos(bladeAngle) * 0.5 * scale,
          gripY - Math.sin(bladeAngle) * 0.5 * scale,
          leatherPrimary,
          1.55 * scale
        );
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

    function drawHeadgear(cx, headY, headRadius, styleName, palette, scale, profile = null) {
      if (!styleName || styleName === "none") {
        return;
      }
      const variant = Number(profile?.variant || 0);
      const variantMinor = Number(profile?.variantMinor || 0);
      const clothPrimary = tintHex(palette.cloth, profile?.accentColor || palette.accent, 0.18 + (profile?.rarityRank || 0) * 0.04);
      const clothSecondary = tintHex(palette.clothDark, profile?.trimColor || palette.outline, 0.18);
      const metalPrimary = tintHex(styleName === "rusty_helmet" ? palette.helmetMetal || "#8f674d" : palette.metal, profile?.accentColor || palette.accent, 0.1 + (profile?.rarityRank || 0) * 0.04);
      const metalDark = tintHex(styleName === "rusty_helmet" ? palette.helmetMetalDark || "#5f4131" : palette.metalDark, profile?.trimColor || palette.outline, 0.18);
      const metalTrim = tintHex(profile?.trimColor || palette.accent || "#f3e3b2", "#ffffff", 0.14);
      const leatherPrimary = tintHex(palette.leather, profile?.accentColor || palette.accent, 0.16);
      const leatherDark = tintHex(palette.leatherDark, profile?.trimColor || palette.outline, 0.18);
      const regalPrimary = tintHex("#d8b15a", profile?.accentColor || palette.accent, 0.26);
      const regalDark = tintHex("#7f5825", profile?.trimColor || palette.outline, 0.24);
      const faceShadow = mixColors("#0f141d", profile?.trimColor || "#0f141d", 0.12, 0.96);
      const fillAndStroke = () => {
        ctx.fill();
        ctx.stroke();
      };
      const drawGem = (x, y, radius, color = profile?.accentColor || palette.accent) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius * 0.9, y);
        ctx.lineTo(x, y + radius);
        ctx.lineTo(x - radius * 0.9, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.beginPath();
        ctx.arc(x + radius * 0.16, y - radius * 0.28, radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
      };
      const drawPlume = (x, y, sign = 1, height = 6.4) => {
        ctx.fillStyle = tintHex(profile?.accentColor || palette.accent, "#ffffff", 0.14);
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 2.2 * sign * scale, y - height * 0.42 * scale, x + 1.1 * sign * scale, y - height * scale);
        ctx.quadraticCurveTo(x + 0.4 * sign * scale, y - height * 1.12 * scale, x - 0.9 * sign * scale, y - height * 0.48 * scale);
        ctx.closePath();
        fillAndStroke();
      };

      drawItemAura(cx, headY - 2 * scale, profile, scale, 0.64);

      if (styleName === "wizard_hat") {
        const brimWidth = (10.6 + variant * 1.05) * scale;
        const brimDepth = (3.6 + (variantMinor % 3) * 0.5) * scale;
        const coneHeight = (15.8 + variant * 1.35) * scale;
        const tilt = (variant % 2 === 0 ? 1 : -1) * (1.8 + (variantMinor % 3) * 0.45) * scale;
        ctx.fillStyle = clothPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.ellipse(cx + 0.4 * scale, headY - 2.8 * scale, brimWidth, brimDepth, -0.12, 0, Math.PI * 2);
        fillAndStroke();
        ctx.beginPath();
        ctx.moveTo(cx - (6.8 + variant * 0.35) * scale, headY - 3 * scale);
        ctx.quadraticCurveTo(cx - 1.2 * scale, headY - coneHeight * 0.6, cx + tilt * 0.35, headY - coneHeight);
        ctx.quadraticCurveTo(cx + (4.5 + variant * 0.3) * scale + tilt, headY - coneHeight * 0.58, cx + (9.1 + variant * 0.55) * scale, headY - (4.2 + (variantMinor % 2) * 0.6) * scale);
        ctx.closePath();
        fillAndStroke();
        ctx.fillStyle = clothSecondary;
        ctx.beginPath();
        ctx.ellipse(cx + 0.7 * scale, headY - 4.8 * scale, (6.8 + variant * 0.55) * scale, 1.7 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        if (variantMinor % 2 === 0) {
          drawGem(cx + 2.6 * scale, headY - 5.2 * scale, 1.3 * scale);
        } else {
          drawPlume(cx + 5.4 * scale, headY - 7 * scale, 1, 5.8 + variant);
        }
        ctx.fillStyle = "#f5f8ff";
        ctx.beginPath();
        ctx.arc(cx + 4.8 * scale + tilt * 0.08, headY - 11.4 * scale, 1.05 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 0.9 * scale, headY - 8.4 * scale, 0.88 * scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (styleName === "hood") {
        const hoodWidth = (9 + variant * 0.55) * scale;
        const hoodHeight = (13.8 + variant * 0.8) * scale;
        ctx.fillStyle = clothSecondary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - hoodWidth, headY - 1.8 * scale);
        ctx.quadraticCurveTo(cx - 1.6 * scale, headY - hoodHeight, cx, headY - (hoodHeight + 1.4 * scale));
        ctx.quadraticCurveTo(cx + 2.6 * scale, headY - hoodHeight * 0.82, cx + hoodWidth, headY - 1.8 * scale);
        ctx.lineTo(cx + (7 + variant * 0.4) * scale, headY + (6.7 + (variantMinor % 2) * 0.8) * scale);
        ctx.quadraticCurveTo(cx + 1.2 * scale, headY + (9.7 + (variantMinor % 3) * 0.7) * scale, cx - (7.5 + variant * 0.38) * scale, headY + (6.9 + (variantMinor % 2) * 0.8) * scale);
        ctx.closePath();
        fillAndStroke();
        ctx.fillStyle = faceShadow;
        ctx.beginPath();
        ctx.moveTo(cx - (4.8 + variant * 0.25) * scale, headY - 0.4 * scale);
        ctx.quadraticCurveTo(cx, headY - (7.8 + (variantMinor % 3) * 0.6) * scale, cx + (4.3 + variant * 0.25) * scale, headY - 0.7 * scale);
        ctx.lineTo(cx + 3.1 * scale, headY + 4.6 * scale);
        ctx.quadraticCurveTo(cx, headY + (6.3 + (variantMinor % 2) * 0.45) * scale, cx - 3.5 * scale, headY + 4.8 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = mixColors(clothPrimary, metalTrim, 0.3, 1);
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - hoodWidth * 0.72, headY - 0.9 * scale);
        ctx.quadraticCurveTo(cx, headY - (11.6 + variant * 0.45) * scale, cx + hoodWidth * 0.72, headY - 1 * scale);
        ctx.stroke();
        if (variantMinor % 2 === 0) {
          drawGem(cx, headY + 6.1 * scale, 1.05 * scale, metalTrim);
        }
        return;
      }

      if (styleName === "cap") {
        ctx.fillStyle = leatherPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.7 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - (8.2 + variant * 0.35) * scale, headY + 2.8 * scale);
        ctx.quadraticCurveTo(cx - (8.6 + variantMinor * 0.08) * scale, headY - 7.4 * scale, cx - 2.2 * scale, headY - (10.4 + (variantMinor % 2) * 0.5) * scale);
        ctx.quadraticCurveTo(cx + (4.6 + variant * 0.22) * scale, headY - (10.6 + (variantMinor % 3) * 0.45) * scale, cx + (8.4 + variant * 0.4) * scale, headY - 1.4 * scale);
        ctx.lineTo(cx + (7 + variant * 0.25) * scale, headY + (5.2 + (variantMinor % 2) * 0.55) * scale);
        ctx.lineTo(cx + (4.3 + variant * 0.2) * scale, headY + (8.1 + (variantMinor % 2) * 0.45) * scale);
        ctx.lineTo(cx - (4.8 + variant * 0.2) * scale, headY + (8.1 + (variantMinor % 2) * 0.45) * scale);
        ctx.lineTo(cx - (7.1 + variant * 0.24) * scale, headY + (5 + (variantMinor % 2) * 0.55) * scale);
        ctx.closePath();
        fillAndStroke();
        ctx.strokeStyle = leatherDark;
        ctx.lineWidth = 1.1 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 6.2 * scale, headY - 1.6 * scale);
        ctx.quadraticCurveTo(cx, headY - (5.5 + (variantMinor % 3) * 0.5) * scale, cx + 6.4 * scale, headY - 1.8 * scale);
        ctx.stroke();
        if (variantMinor % 2 === 0) {
          ctx.fillStyle = metalDark;
          ctx.beginPath();
          ctx.arc(cx - 4.2 * scale, headY - 3.1 * scale, 1.8 * scale, 0, Math.PI * 2);
          ctx.arc(cx + 4.2 * scale, headY - 3.1 * scale, 1.8 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = metalTrim;
          ctx.lineWidth = 0.9 * scale;
          ctx.beginPath();
          ctx.arc(cx - 4.2 * scale, headY - 3.1 * scale, 1 * scale, 0, Math.PI * 2);
          ctx.arc(cx + 4.2 * scale, headY - 3.1 * scale, 1 * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }

      if (styleName === "crown") {
        ctx.fillStyle = regalPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.6 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 8.4 * scale, headY + 1.6 * scale);
        ctx.lineTo(cx - 7.1 * scale, headY - 4.1 * scale);
        ctx.lineTo(cx - 3.2 * scale, headY - 1.2 * scale);
        ctx.lineTo(cx, headY - 6.7 * scale);
        ctx.lineTo(cx + 3.2 * scale, headY - 1.2 * scale);
        ctx.lineTo(cx + 7.1 * scale, headY - 4.1 * scale);
        ctx.lineTo(cx + 8.4 * scale, headY + 1.6 * scale);
        ctx.lineTo(cx + 6.4 * scale, headY + 5.2 * scale);
        ctx.lineTo(cx - 6.4 * scale, headY + 5.2 * scale);
        ctx.closePath();
        fillAndStroke();
        ctx.strokeStyle = regalDark;
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 6.2 * scale, headY + 2.8 * scale);
        ctx.lineTo(cx + 6.2 * scale, headY + 2.8 * scale);
        ctx.stroke();
        drawGem(cx, headY - 1.3 * scale, 1.25 * scale, profile?.accentColor || "#e45757");
        drawGem(cx - 4.4 * scale, headY - 0.2 * scale, 0.95 * scale, metalTrim);
        drawGem(cx + 4.4 * scale, headY - 0.2 * scale, 0.95 * scale, metalTrim);
        return;
      }

      if (styleName === "greathelm" || styleName === "mask_helmet" || styleName === "horned_helmet") {
        ctx.fillStyle = metalPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - (headRadius + 2.8 * scale), headY + 2.4 * scale);
        ctx.quadraticCurveTo(cx - (headRadius + 1.2 * scale), headY - (headRadius + 3.8 * scale), cx - 1.8 * scale, headY - (headRadius + 4.6 * scale));
        ctx.quadraticCurveTo(cx + (1.8 + (variantMinor % 2) * 0.4) * scale, headY - (headRadius + 5.2 * scale), cx + (headRadius + 2.7 * scale), headY + (1.8 + (variantMinor % 2) * 0.35) * scale);
        ctx.lineTo(cx + (headRadius + 1.6 * scale), headY + (8.8 + (variantMinor % 2) * 0.5) * scale);
        ctx.lineTo(cx - (headRadius + 1.9 * scale), headY + (8.8 + (variantMinor % 2) * 0.5) * scale);
        ctx.closePath();
        fillAndStroke();
        ctx.strokeStyle = metalDark;
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 6.4 * scale, headY - 1.2 * scale);
        ctx.lineTo(cx + 6.4 * scale, headY - 1.2 * scale);
        ctx.moveTo(cx, headY - (headRadius + 3.6 * scale));
        ctx.lineTo(cx, headY + 7.4 * scale);
        ctx.stroke();
        ctx.fillStyle = faceShadow;
        if (styleName === "mask_helmet") {
          ctx.beginPath();
          ctx.moveTo(cx - 4.2 * scale, headY - 0.8 * scale);
          ctx.lineTo(cx - 1.4 * scale, headY - 4.4 * scale);
          ctx.lineTo(cx + 1.4 * scale, headY - 4.4 * scale);
          ctx.lineTo(cx + 4.2 * scale, headY - 0.8 * scale);
          ctx.lineTo(cx + 2.6 * scale, headY + 5.8 * scale);
          ctx.lineTo(cx - 2.6 * scale, headY + 5.8 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = metalTrim;
          ctx.lineWidth = 0.95 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 4.1 * scale, headY + 2.4 * scale);
          ctx.lineTo(cx + 4.1 * scale, headY + 2.4 * scale);
          ctx.stroke();
        } else {
          ctx.fillRect(cx - 4.8 * scale, headY - 0.1 * scale, 9.6 * scale, 1.5 * scale);
          if (variantMinor % 2 === 0) {
            ctx.fillRect(cx - 1.1 * scale, headY - 3.9 * scale, 2.2 * scale, 6.7 * scale);
          } else {
            ctx.fillRect(cx - 4.2 * scale, headY + 2.1 * scale, 8.4 * scale, 1.2 * scale);
          }
        }
        if (styleName === "horned_helmet") {
          ctx.fillStyle = tintHex("#d9cfb1", profile?.trimColor || "#d9cfb1", 0.12);
          ctx.strokeStyle = palette.outline;
          ctx.lineWidth = 1.1 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 6 * scale, headY - 4.8 * scale);
          ctx.quadraticCurveTo(cx - 12.5 * scale, headY - 8.8 * scale, cx - 11.4 * scale, headY - 1.4 * scale);
          ctx.quadraticCurveTo(cx - 8.4 * scale, headY - 3.1 * scale, cx - 5.7 * scale, headY - 0.6 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.beginPath();
          ctx.moveTo(cx + 6 * scale, headY - 4.8 * scale);
          ctx.quadraticCurveTo(cx + 12.5 * scale, headY - 8.8 * scale, cx + 11.4 * scale, headY - 1.4 * scale);
          ctx.quadraticCurveTo(cx + 8.4 * scale, headY - 3.1 * scale, cx + 5.7 * scale, headY - 0.6 * scale);
          ctx.closePath();
          fillAndStroke();
        } else if (styleName === "greathelm" && variantMinor % 2 === 0) {
          drawPlume(cx, headY - (headRadius + 4.8 * scale), variant % 2 === 0 ? 1 : -1, 7 + variant * 0.5);
        }
        if (styleName === "greathelm") {
          ctx.strokeStyle = metalTrim;
          ctx.lineWidth = 1 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 6.2 * scale, headY - (headRadius + 1.1 * scale));
          ctx.lineTo(cx + 6.2 * scale, headY - (headRadius + 1.1 * scale));
          ctx.stroke();
        } else if (styleName === "mask_helmet") {
          drawGem(cx, headY - (headRadius + 0.8 * scale), 0.9 * scale, metalTrim);
        }
        return;
      }

      if (styleName === "rusty_helmet") {
        ctx.fillStyle = metalPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx, headY - 0.4 * scale, headRadius + (1.2 + (variant % 2) * 0.55) * scale, Math.PI, Math.PI * 2);
        ctx.lineTo(cx + headRadius + (1.6 + (variantMinor % 2) * 0.35) * scale, headY + 2.2 * scale);
        ctx.lineTo(cx + (6.8 + variant * 0.25) * scale, headY + (6.4 + (variantMinor % 2) * 0.5) * scale);
        ctx.lineTo(cx - (7 + variant * 0.2) * scale, headY + (6.2 + (variantMinor % 2) * 0.55) * scale);
        ctx.lineTo(cx - headRadius - (1.8 + ((variant + 1) % 3) * 0.28) * scale, headY + 2.2 * scale);
        ctx.closePath();
        fillAndStroke();
        ctx.fillStyle = faceShadow;
        ctx.beginPath();
        ctx.moveTo(cx - 5.1 * scale, headY - 0.5 * scale);
        ctx.lineTo(cx - 1.3 * scale, headY - 4.2 * scale);
        ctx.lineTo(cx + 3.8 * scale, headY - 2.6 * scale);
        ctx.lineTo(cx + 4.8 * scale, headY + 4.6 * scale);
        ctx.lineTo(cx - 3.2 * scale, headY + 5 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = metalDark;
        ctx.lineWidth = 1.35 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 6.2 * scale, headY - 0.3 * scale);
        ctx.lineTo(cx + 5.2 * scale, headY - 1.5 * scale);
        ctx.stroke();
        ctx.fillStyle = "rgba(168, 108, 74, 0.28)";
        ctx.beginPath();
        ctx.arc(cx - 3.2 * scale, headY - 2.2 * scale, 1.15 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 2.8 * scale, headY + 0.7 * scale, 0.95 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 0.9 * scale, headY + 3.8 * scale, 0.78 * scale, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (styleName === "helmet") {
        const family = variant % 7;
        const isHighRarity = (profile?.rarityRank || 0) >= 3;
        ctx.fillStyle = metalPrimary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        if (family === 0) {
          // Classic closed helm
          ctx.beginPath();
          ctx.arc(cx, headY - 0.2 * scale, headRadius + 1.3 * scale, Math.PI, Math.PI * 2);
          ctx.lineTo(cx + (9.6 + (variantMinor % 2) * 0.5) * scale, headY + 2.1 * scale);
          ctx.lineTo(cx + 6 * scale, headY + 6.4 * scale);
          ctx.lineTo(cx - 6 * scale, headY + 6.4 * scale);
          ctx.lineTo(cx - (9.6 + (variantMinor % 2) * 0.5) * scale, headY + 2.1 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.fillStyle = faceShadow;
          ctx.fillRect(cx - 4.2 * scale, headY + 0.4 * scale, 8.4 * scale, 1.4 * scale);
          ctx.fillRect(cx - 0.9 * scale, headY - 4.1 * scale, 1.8 * scale, 7.3 * scale);
          ctx.strokeStyle = metalDark;
          ctx.lineWidth = 1.2 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 6.2 * scale, headY - 0.3 * scale);
          ctx.lineTo(cx + 6.2 * scale, headY - 0.3 * scale);
          ctx.stroke();
        } else if (family === 1) {
          // Winged helm
          ctx.beginPath();
          ctx.arc(cx, headY - 0.5 * scale, headRadius + 1 * scale, Math.PI, Math.PI * 2);
          ctx.lineTo(cx + 8.6 * scale, headY + 2.2 * scale);
          ctx.lineTo(cx + 4.8 * scale, headY + 7.1 * scale);
          ctx.lineTo(cx - 4.8 * scale, headY + 7.1 * scale);
          ctx.lineTo(cx - 8.6 * scale, headY + 2.2 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.fillStyle = faceShadow;
          ctx.beginPath();
          ctx.moveTo(cx - 4.8 * scale, headY + 0.1 * scale);
          ctx.lineTo(cx - 1.6 * scale, headY - 4.8 * scale);
          ctx.lineTo(cx + 1.5 * scale, headY - 4.8 * scale);
          ctx.lineTo(cx + 4.9 * scale, headY + 0.1 * scale);
          ctx.lineTo(cx + 2.6 * scale, headY + 5.5 * scale);
          ctx.lineTo(cx - 2.6 * scale, headY + 5.5 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = metalTrim;
          ctx.beginPath();
          ctx.moveTo(cx - 8.4 * scale, headY - 4.8 * scale);
          ctx.lineTo(cx - 11.8 * scale, headY - 8.2 * scale);
          ctx.lineTo(cx - 8.6 * scale, headY - 1.8 * scale);
          ctx.closePath();
          ctx.moveTo(cx + 8.4 * scale, headY - 4.8 * scale);
          ctx.lineTo(cx + 11.8 * scale, headY - 8.2 * scale);
          ctx.lineTo(cx + 8.6 * scale, headY - 1.8 * scale);
          ctx.closePath();
          ctx.fill();
        } else if (family === 2) {
          // Plumed helm
          ctx.beginPath();
          ctx.moveTo(cx - 8.4 * scale, headY + 2.4 * scale);
          ctx.quadraticCurveTo(cx - 7.6 * scale, headY - 8.2 * scale, cx, headY - (headRadius + 4.5 * scale));
          ctx.quadraticCurveTo(cx + 7.6 * scale, headY - 8.1 * scale, cx + 8.4 * scale, headY + 2.4 * scale);
          ctx.lineTo(cx + 6.4 * scale, headY + 7 * scale);
          ctx.lineTo(cx - 6.4 * scale, headY + 7 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.strokeStyle = metalDark;
          ctx.lineWidth = 1.15 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 5.8 * scale, headY - 0.8 * scale);
          ctx.lineTo(cx, headY - (headRadius + 3.2 * scale));
          ctx.lineTo(cx + 5.8 * scale, headY - 0.8 * scale);
          ctx.stroke();
          ctx.fillStyle = faceShadow;
          ctx.beginPath();
          ctx.moveTo(cx - 4.6 * scale, headY + 0.2 * scale);
          ctx.lineTo(cx, headY - 3.6 * scale);
          ctx.lineTo(cx + 4.6 * scale, headY + 0.2 * scale);
          ctx.lineTo(cx + 2.9 * scale, headY + 5.9 * scale);
          ctx.lineTo(cx - 2.9 * scale, headY + 5.9 * scale);
          ctx.closePath();
          ctx.fill();
          drawPlume(cx, headY - (headRadius + 4.2 * scale), variantMinor % 2 === 0 ? 1 : -1, 6.6 + variantMinor * 0.18);
        } else if (family === 3) {
          // Asymmetric helm
          ctx.beginPath();
          ctx.moveTo(cx - 9 * scale, headY + 2.6 * scale);
          ctx.quadraticCurveTo(cx - 8.5 * scale, headY - 8 * scale, cx - 2.2 * scale, headY - (headRadius + 4.1 * scale));
          ctx.quadraticCurveTo(cx + 2.6 * scale, headY - (headRadius + 4.8 * scale), cx + 9.1 * scale, headY + 2.2 * scale);
          ctx.lineTo(cx + 6 * scale, headY + 8 * scale);
          ctx.lineTo(cx - 5.7 * scale, headY + 8 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.fillStyle = faceShadow;
          ctx.beginPath();
          ctx.moveTo(cx - 3.5 * scale, headY - 0.4 * scale);
          ctx.lineTo(cx - 0.9 * scale, headY - 4.6 * scale);
          ctx.lineTo(cx + 1.3 * scale, headY - 4.6 * scale);
          ctx.lineTo(cx + 3.9 * scale, headY - 0.4 * scale);
          ctx.lineTo(cx + 2.2 * scale, headY + 5.8 * scale);
          ctx.lineTo(cx - 2.3 * scale, headY + 5.8 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = metalTrim;
          ctx.lineWidth = 0.95 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 6.2 * scale, headY + 1.6 * scale);
          ctx.lineTo(cx + 6 * scale, headY + 1.6 * scale);
          ctx.stroke();
        } else if (family === 4) {
          // Horned helm
          ctx.beginPath();
          ctx.arc(cx, headY - 0.3 * scale, headRadius + 1.1 * scale, Math.PI, Math.PI * 2);
          ctx.lineTo(cx + 8.2 * scale, headY + 2.4 * scale);
          ctx.lineTo(cx + 5.4 * scale, headY + 6.8 * scale);
          ctx.lineTo(cx - 5.4 * scale, headY + 6.8 * scale);
          ctx.lineTo(cx - 8.2 * scale, headY + 2.4 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.fillStyle = faceShadow;
          ctx.beginPath();
          ctx.moveTo(cx - 4.4 * scale, headY + 0.3 * scale);
          ctx.lineTo(cx - 1.8 * scale, headY - 4.4 * scale);
          ctx.lineTo(cx + 1.8 * scale, headY - 4.4 * scale);
          ctx.lineTo(cx + 4.4 * scale, headY + 0.3 * scale);
          ctx.lineTo(cx + 2.4 * scale, headY + 5.2 * scale);
          ctx.lineTo(cx - 2.4 * scale, headY + 5.2 * scale);
          ctx.closePath();
          ctx.fill();
          // Horns
          ctx.fillStyle = isHighRarity ? metalTrim : "#e8dcc8";
          ctx.strokeStyle = palette.outline;
          ctx.lineWidth = 1.4 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 6.8 * scale, headY - 3.2 * scale);
          ctx.quadraticCurveTo(cx - 10.2 * scale, headY - 6.8 * scale, cx - 11.4 * scale, headY - 9.6 * scale);
          ctx.quadraticCurveTo(cx - 9.8 * scale, headY - 7.2 * scale, cx - 7.2 * scale, headY - 4.8 * scale);
          ctx.closePath();
          ctx.moveTo(cx + 6.8 * scale, headY - 3.2 * scale);
          ctx.quadraticCurveTo(cx + 10.2 * scale, headY - 6.8 * scale, cx + 11.4 * scale, headY - 9.6 * scale);
          ctx.quadraticCurveTo(cx + 9.8 * scale, headY - 7.2 * scale, cx + 7.2 * scale, headY - 4.8 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (family === 5) {
          // Crowned helm (high rarity)
          ctx.beginPath();
          ctx.arc(cx, headY - 0.4 * scale, headRadius + 1.2 * scale, Math.PI, Math.PI * 2);
          ctx.lineTo(cx + 9.2 * scale, headY + 2.6 * scale);
          ctx.lineTo(cx + 6.8 * scale, headY + 7.4 * scale);
          ctx.lineTo(cx - 6.8 * scale, headY + 7.4 * scale);
          ctx.lineTo(cx - 9.2 * scale, headY + 2.6 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.fillStyle = faceShadow;
          ctx.beginPath();
          ctx.moveTo(cx - 4.6 * scale, headY + 0.2 * scale);
          ctx.lineTo(cx - 1.4 * scale, headY - 4.6 * scale);
          ctx.lineTo(cx + 1.4 * scale, headY - 4.6 * scale);
          ctx.lineTo(cx + 4.6 * scale, headY + 0.2 * scale);
          ctx.lineTo(cx + 2.8 * scale, headY + 5.6 * scale);
          ctx.lineTo(cx - 2.8 * scale, headY + 5.6 * scale);
          ctx.closePath();
          ctx.fill();
          // Crown spikes
          ctx.fillStyle = regalPrimary;
          ctx.strokeStyle = metalTrim;
          ctx.lineWidth = 1.2 * scale;
          for (let i = -2; i <= 2; i++) {
            const spikeX = cx + i * 3.2 * scale;
            const spikeHeight = 4.2 + Math.abs(i) * 0.8;
            ctx.beginPath();
            ctx.moveTo(spikeX, headY - (headRadius + 1.2) * scale);
            ctx.lineTo(spikeX - 1.4 * scale, headY - (headRadius + 1.2 + spikeHeight * 0.6) * scale);
            ctx.lineTo(spikeX, headY - (headRadius + 1.2 + spikeHeight) * scale);
            ctx.lineTo(spikeX + 1.4 * scale, headY - (headRadius + 1.2 + spikeHeight * 0.6) * scale);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          drawGem(cx, headY - (headRadius + 5.8) * scale, 1.4 * scale, isHighRarity ? "#ff6b9d" : metalTrim);
        } else {
          // Dragon helm (epic+)
          ctx.beginPath();
          ctx.arc(cx - 0.7 * scale, headY - 0.6 * scale, headRadius + 0.95 * scale, Math.PI * 0.98, Math.PI * 1.98);
          ctx.lineTo(cx + 9.8 * scale, headY + 2.8 * scale);
          ctx.lineTo(cx + 7.8 * scale, headY + 7.8 * scale);
          ctx.lineTo(cx - 4.8 * scale, headY + 8.4 * scale);
          ctx.lineTo(cx - 9.4 * scale, headY + 3.6 * scale);
          ctx.closePath();
          fillAndStroke();
          ctx.fillStyle = faceShadow;
          ctx.beginPath();
          ctx.moveTo(cx - 5 * scale, headY + 0.2 * scale);
          ctx.quadraticCurveTo(cx - 1.6 * scale, headY - 5.2 * scale, cx + 4.2 * scale, headY - 2.8 * scale);
          ctx.lineTo(cx + 4.6 * scale, headY + 2.8 * scale);
          ctx.lineTo(cx - 3.1 * scale, headY + 5.6 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = metalDark;
          ctx.lineWidth = 1.05 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - 4.1 * scale, headY + 7.8 * scale);
          ctx.lineTo(cx - 4.1 * scale, headY + 11.1 * scale);
          ctx.moveTo(cx - 1.2 * scale, headY + 7.9 * scale);
          ctx.lineTo(cx - 1.2 * scale, headY + 11.1 * scale);
          ctx.moveTo(cx + 1.7 * scale, headY + 7.6 * scale);
          ctx.lineTo(cx + 1.7 * scale, headY + 10.9 * scale);
          ctx.stroke();
          // Dragon crest
          ctx.fillStyle = isHighRarity ? "#c94848" : metalDark;
          ctx.beginPath();
          ctx.moveTo(cx, headY - (headRadius + 1) * scale);
          ctx.quadraticCurveTo(cx + 2.8 * scale, headY - (headRadius + 4) * scale, cx + 3.2 * scale, headY - (headRadius + 8) * scale);
          ctx.quadraticCurveTo(cx + 2.4 * scale, headY - (headRadius + 5) * scale, cx + 0.8 * scale, headY - (headRadius + 2.4) * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        if (variantMinor % 3 === 1 && family !== 1) {
          drawGem(cx, headY - (headRadius + 1.1 * scale), 0.95 * scale, metalTrim);
        }
      }
    }

    function drawChargeDashEffect(cx, cy, castState, palette, scale, entityId) {
      if (!castState || !castState.active) return;

      const progress = clamp(Number(castState.ratio) || 0, 0, 1);
      const elapsedMs = Number(castState.elapsedMs) || 0;
      const durationMs = Number(castState.durationMs) || 1;

      // Get charge positions from cast state
      const startX = castState.chargeStartX;
      const startY = castState.chargeStartY;
      const targetX = castState.chargeTargetX;
      const targetY = castState.chargeTargetY;

      // Interpolate current position
      let currentX = cx;
      let currentY = cy;
      if (startX !== undefined && targetX !== undefined) {
        currentX = startX + (targetX - startX) * progress;
        currentY = startY + (targetY - startY) * progress;
      }

      // Speed lines trailing behind the charging player
      const time = performance.now() / 1000;
      const flicker = 0.5 + 0.5 * Math.sin(time * 20 + entityId);

      ctx.save();
      ctx.globalAlpha = 0.6 * flicker;
      ctx.globalCompositeOperation = "lighter";

      // Draw speed lines
      ctx.strokeStyle = "rgba(255, 200, 100, 0.6)";
      ctx.lineWidth = 2 * scale;
      ctx.lineCap = "round";

      const lineCount = 5;
      for (let i = 0; i < lineCount; i++) {
        const offset = ((i / lineCount) + (time * 2) % 1) * 12 - 6;
        const lineLen = 4 + (i % 3) * 2;
        const yOffset = (i - lineCount / 2) * 3 * scale;

        ctx.beginPath();
        ctx.moveTo(currentX - offset * scale - lineLen * scale, currentY + yOffset);
        ctx.lineTo(currentX - offset * scale, currentY + yOffset);
        ctx.stroke();
      }

      // Dust cloud at feet
      ctx.fillStyle = "rgba(200, 180, 150, 0.4)";
      ctx.beginPath();
      ctx.ellipse(currentX, currentY + 8 * scale, 6 * scale, 3 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
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
      const chestProfile = loadout.chestVisual || null;
      const shoulderProfile = loadout.shouldersVisual || null;
      const chestColors = getVisualMaterialColors(chestProfile, palette, chestType);
      const shoulderColors = getVisualMaterialColors(shoulderProfile, palette, shouldersType);
      const armorColor = chestColors.primary;
      const armorDark = chestColors.secondary;
      const armorTrim = chestColors.trim;
      const bodyColor = species === "skeleton" ? palette.bone : palette.skin;
      const chestVariant = Number(chestProfile?.variant || 0);
      const styleVariant = chestColors.styleVariant || "simple";
      const rarityRank = chestColors.rarityRank || 0;
      drawItemAura(cx, cy - 0.5 * scale, chestProfile, scale, 0.88);

      if (species === "skeleton" && (chestType === "ribcage" || chestType === "none" || !chestType)) {
        drawRibCage(cx, cy, palette, scale);
      } else if (chestType === "none" || !chestType) {
        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.ellipse(cx, cy, (7.4 + chestVariant * 0.3) * scale, (6.4 + (chestVariant % 2) * 0.45) * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (chestType === "robe") {
        drawRobeChest(cx, cy, chestProfile, chestColors, palette, species, scale);
      } else {
        drawArmoredChest(cx, cy, chestType, styleVariant, chestProfile, chestColors, palette, species, scale);
      }

      // Draw shine effect for high rarity items
      if (chestColors.shine && rarityRank >= 3) {
        drawChestShine(cx, cy, chestColors, scale, chestVariant);
      }

      if (shouldersType === "plate") {
        ctx.fillStyle = shoulderColors.primary;
        ctx.strokeStyle = palette.outline;
        ctx.lineWidth = 1.4 * scale;
        ctx.beginPath();
        ctx.ellipse(cx - 7.6 * scale, cy - 3 * scale, (3.4 + (shoulderProfile?.variant || 0) * 0.3) * scale, 2.7 * scale, -0.35, 0, Math.PI * 2);
        ctx.ellipse(cx + 7.6 * scale, cy - 3 * scale, (3.4 + (shoulderProfile?.variant || 0) * 0.3) * scale, 2.7 * scale, 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (loadout.belt && loadout.belt !== "none") {
        ctx.strokeStyle = loadout.belt === "plate" ? palette.leatherDark : palette.leather;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 6.2 * scale, cy + 4.8 * scale);
        ctx.lineTo(cx + 6.2 * scale, cy + 4.8 * scale);
        ctx.stroke();
      }
    }

    function drawRobeChest(cx, cy, profile, colors, palette, species, scale) {
      const variant = Number(profile?.variant || 0);
      const variantMinor = Number(profile?.variantMinor || 0);
      const armorColor = colors.primary;
      const armorDark = colors.secondary;
      const armorTrim = colors.trim;

      ctx.fillStyle = armorColor;
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - (7 + variant * 0.55) * scale, cy - 6 * scale);
      ctx.quadraticCurveTo(cx, cy - (10.5 + (variant % 2) * 1.2) * scale, cx + (7 + variant * 0.55) * scale, cy - 6 * scale);
      ctx.lineTo(cx + (9.3 + variant * 0.45) * scale, cy + (10.2 + (variant % 3) * 1.1) * scale);
      ctx.quadraticCurveTo(cx, cy + (15 + (variant % 2) * 1.1) * scale, cx - (9.3 + variant * 0.45) * scale, cy + (10.2 + (variant % 3) * 1.1) * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Robe folds
      drawLine(cx, cy - 4 * scale, cx, cy + 11.5 * scale, armorDark, 1.1 * scale);

      // Style-specific details
      if (colors.styleVariant === "embroidered" || colors.styleVariant === "ornate") {
        // Decorative trim along edges
        ctx.strokeStyle = armorTrim;
        ctx.lineWidth = 0.8 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - (5 + variant * 0.3) * scale, cy - 4 * scale);
        ctx.quadraticCurveTo(cx, cy - 8 * scale, cx + (5 + variant * 0.3) * scale, cy - 4 * scale);
        ctx.stroke();
      }

      if (colors.styleVariant === "runed" || colors.styleVariant === "ethereal") {
        // Glowing runes
        ctx.fillStyle = colors.glow || armorTrim;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < 3; i++) {
          const runeY = cy - 2 * scale + i * 4 * scale;
          ctx.beginPath();
          ctx.arc(cx, runeY, 1.2 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (variant % 2 === 1) {
        drawLine(cx - 5.5 * scale, cy - 2 * scale, cx + 5.5 * scale, cy - 0.8 * scale, armorTrim, 1 * scale);
      }
    }

    function drawArmoredChest(cx, cy, chestType, styleVariant, profile, colors, palette, species, scale) {
      const variant = Number(profile?.variant || 0);
      const variantMinor = Number(profile?.variantMinor || 0);
      const armorColor = colors.primary;
      const armorDark = colors.secondary;
      const armorTrim = colors.trim;

      ctx.fillStyle = species === "zombie" ? palette.skin : armorColor;
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.ellipse(cx, cy, (7.8 + variant * 0.45) * scale, (6.8 + (variant % 2) * 0.65) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw style-specific armor details
      if (chestType === "plate") {
        drawPlateChestDetails(cx, cy, styleVariant, colors, palette, scale, variant, variantMinor);
      } else if (chestType === "leather") {
        drawLeatherChestDetails(cx, cy, styleVariant, colors, palette, scale, variant, variantMinor);
      } else {
        // Default chainmail/scale pattern
        ctx.strokeStyle = armorDark;
        ctx.lineWidth = 0.9 * scale;
        for (let row = 0; row < 4; row++) {
          const rowY = cy - 4 * scale + row * 2.8 * scale;
          const offset = (row % 2) * 1.5 * scale;
          for (let col = -2; col <= 2; col++) {
            const colX = cx + col * 3 * scale + offset;
            ctx.beginPath();
            ctx.arc(colX, rowY, 1.1 * scale, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    function drawPlateChestDetails(cx, cy, styleVariant, colors, palette, scale, variant, variantMinor) {
      const armorDark = colors.secondary;
      const armorTrim = colors.trim;
      const glowColor = colors.glow;

      // Base plate lines
      drawLine(cx - 6 * scale, cy + 3.8 * scale, cx + 6 * scale, cy + 3.8 * scale, armorDark, 1.4 * scale);

      if (styleVariant === "gothic") {
        // Gothic fluting lines
        ctx.strokeStyle = armorTrim;
        ctx.lineWidth = 0.8 * scale;
        for (let i = -2; i <= 2; i++) {
          const x = cx + i * 2.5 * scale;
          drawLine(x, cy - 5 * scale, x, cy + 4 * scale, armorTrim, 0.7 * scale);
        }
        // Central ridge
        drawLine(cx, cy - 5.2 * scale, cx, cy + 5 * scale, armorTrim, 1.6 * scale);
      } else if (styleVariant === "ornate" || styleVariant === "royal") {
        // Ornate filigree
        ctx.strokeStyle = glowColor || armorTrim;
        ctx.lineWidth = 1.1 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - 4 * scale, cy - 3 * scale);
        ctx.quadraticCurveTo(cx, cy - 6 * scale, cx + 4 * scale, cy - 3 * scale);
        ctx.stroke();
        // Central emblem
        ctx.fillStyle = glowColor || armorTrim;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4.5 * scale);
        ctx.lineTo(cx - 2 * scale, cy - 1 * scale);
        ctx.lineTo(cx + 2 * scale, cy - 1 * scale);
        ctx.closePath();
        ctx.fill();
        drawLine(cx, cy - 5.2 * scale, cx, cy + 5 * scale, armorTrim, 1.2 * scale);
      } else if (styleVariant === "field") {
        // Simple field plate with rivets
        drawLine(cx, cy - 5.2 * scale, cx, cy + 5 * scale, armorTrim, 1.2 * scale);
        // Rivets
        ctx.fillStyle = armorDark;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(cx + i * 4 * scale, cy - 2 * scale, 0.7 * scale, 0, Math.PI * 2);
          ctx.arc(cx + i * 4 * scale, cy + 2 * scale, 0.7 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Standard fullplate
        if (variant % 2 === 0) {
          drawLine(cx, cy - 5.2 * scale, cx, cy + 5 * scale, armorTrim, 1.2 * scale);
        }
      }

      // High rarity glow overlay
      if (glowColor && colors.rarityRank >= 3) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 5 * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawLeatherChestDetails(cx, cy, styleVariant, colors, palette, scale, variant, variantMinor) {
      const armorDark = colors.secondary;
      const armorTrim = colors.trim;

      if (styleVariant === "studded") {
        // Studs pattern
        ctx.fillStyle = armorDark;
        for (let row = 0; row < 3; row++) {
          const rowY = cy - 3 * scale + row * 3 * scale;
          for (let col = -2; col <= 2; col++) {
            const colX = cx + col * 3.2 * scale + (row % 2) * 1.6 * scale;
            ctx.beginPath();
            ctx.arc(colX, rowY, 0.6 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // Diagonal strap
        drawLine(cx - 5.2 * scale, cy - 4.8 * scale, cx + 4.6 * scale, cy + 4.6 * scale, armorTrim, 1.2 * scale);
      } else if (styleVariant === "scaled" || styleVariant === "dragonscale") {
        // Scale mail pattern
        const scaleColor = colors.primary;
        const scaleOutline = armorDark;
        ctx.fillStyle = scaleColor;
        ctx.strokeStyle = scaleOutline;
        ctx.lineWidth = 0.5 * scale;
        for (let row = 0; row < 5; row++) {
          const rowY = cy - 5 * scale + row * 2.5 * scale;
          const offset = (row % 2) * 2 * scale;
          for (let col = -3; col <= 3; col++) {
            const colX = cx + col * 2.2 * scale + offset;
            ctx.beginPath();
            ctx.arc(colX, rowY, 1.3 * scale, Math.PI, 0);
            ctx.fill();
            ctx.stroke();
          }
        }
      } else if (styleVariant === "bone") {
        // Bone plates
        ctx.fillStyle = colors.trim;
        for (let i = -1; i <= 1; i++) {
          const plateX = cx + i * 4 * scale;
          ctx.beginPath();
          ctx.ellipse(plateX, cy, 2.2 * scale, 4 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        // Standard leather
        drawLine(cx - 5.2 * scale, cy - 4.8 * scale, cx + 4.6 * scale, cy + 4.6 * scale, armorTrim, 1 * scale);
        if (variant % 2 === 1) {
          drawLine(cx + 5.2 * scale, cy - 4.8 * scale, cx - 4.6 * scale, cy + 4.6 * scale, armorDark, 0.9 * scale);
        }
      }
    }

    function drawChestShine(cx, cy, colors, scale, variant) {
      const shineColor = colors.shine;
      if (!shineColor) return;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 + (colors.rarityRank - 3) * 0.1;

      // Animated shine based on time
      const time = performance.now() / 1000;
      const shinePhase = (time * 0.7 + variant * 0.3) % 1;
      const shineX = cx + (shinePhase - 0.5) * 10 * scale;

      // Diagonal shine sweep
      ctx.strokeStyle = shineColor;
      ctx.lineWidth = 2 * scale;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(shineX - 3 * scale, cy - 4 * scale);
      ctx.lineTo(shineX + 3 * scale, cy + 4 * scale);
      ctx.stroke();

      // Radial glow
      const gradientAlpha = 0.2 + Math.sin(time * 2) * 0.1;
      ctx.globalAlpha = gradientAlpha;
      ctx.fillStyle = shineColor;
      ctx.beginPath();
      ctx.arc(cx, cy - 2 * scale, 3 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
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
            const idleUpper = 2.34;
            const idleLower = 2.08;
            const raisedUpper = 4.72;
            const raisedLower = 3.84;
            const slashUpper = 1.1;
            const slashLower = 0.56;
            upperAngle = attackVisual.progress < 0.34 ? lerp(idleUpper, raisedUpper, raiseT) : lerp(raisedUpper, slashUpper, slashT);
            lowerAngle = attackVisual.progress < 0.34 ? lerp(idleLower, raisedLower, raiseT) : lerp(raisedLower, slashLower, slashT);
          } else {
            const idleUpper = 0.88;
            const idleLower = 1.2;
            const raisedUpper = -2.46;
            const raisedLower = -1.42;
            const slashUpper = 1.96;
            const slashLower = 1.36;
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
            upperAngle = 2.54;
            lowerAngle = 3.06;
          } else {
            upperAngle = 0.62;
            lowerAngle = 0.08;
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
      const loadout = buildLoadout(style, equipmentSlots, options.useDefaultGearFallback !== false);
      const attackVisual = resolveAttackState(style, loadout, attackState, castState);
      const runtimeState = motion.runtimeState || null;
      const targetBowPull = loadout.mainHand.type === "bow" && attackVisual.kind === "bow" ? clamp(Number(attackVisual.progress) || 0, 0, 1) : 0;
      const bowPull =
        runtimeState
          ? (runtimeState.bowPull = lerp(Number(runtimeState.bowPull) || 0, targetBowPull, targetBowPull > (Number(runtimeState.bowPull) || 0) ? 0.28 : 0.18))
          : targetBowPull;
      const bowHandSide = loadout.mainHand.type === "bow" ? resolveBowHandSide(entity, options) : "left";
      const mainHandSide = loadout.mainHand.type === "bow" ? bowHandSide : resolvePrimaryHandSide(entity, attackVisual, options);

      // Handle charge position interpolation
      let chargeCurrentX = null;
      let chargeCurrentY = null;
      if (castState && castState.active) {
        const actionDef = getActionDefById(castState.abilityId);
        if (actionDef && String(actionDef.kind || "").toLowerCase() === "charge") {
          const progress = clamp(Number(castState.ratio) || 0, 0, 1);
          const startX = castState.chargeStartX;
          const startY = castState.chargeStartY;
          const targetX = castState.chargeTargetX;
          const targetY = castState.chargeTargetY;
          if (startX !== undefined && targetX !== undefined && startY !== undefined && targetY !== undefined) {
            chargeCurrentX = startX + (targetX - startX) * progress;
            chargeCurrentY = startY + (targetY - startY) * progress;
          }
        }
      }

      const cx = (chargeCurrentX !== null ? chargeCurrentX : p.x) + motion.sway * 0.12;
      const cy = (chargeCurrentY !== null ? chargeCurrentY : p.y) + motion.bob * 0.2;
      const headY = cy - 8.3 * scale;
      const shoulderY = cy - 0.5 * scale;
      const hipY = cy + 7.8 * scale;
      const shoulderSpread = 5.9 * scale;
      const hipSpread = 3 * scale;
      const pantsColors = getVisualMaterialColors(loadout.pantsVisual || null, palette, loadout.pants);
      const bootsColors = getVisualMaterialColors(loadout.bootsVisual || null, palette, loadout.boots);
      const bootVariant = Number(loadout.bootsVisual?.variant || 0);

      // Draw charge dash effect
      if (castState && castState.active) {
        const actionDef = getActionDefById(castState.abilityId);
        if (actionDef && String(actionDef.kind || "").toLowerCase() === "charge") {
          drawChargeDashEffect(cx, cy, castState, palette, scale, entity.id);
        }
      }

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
          species === "skeleton"
            ? palette.boneDark
            : loadout.pants === "none" || !loadout.pants
              ? palette.skinDark
              : loadout.pants === "plate"
              ? pantsColors.secondary
              : loadout.pants === "leather"
                ? pantsColors.primary
                : loadout.pants === "robe"
                  ? pantsColors.primary
                  : pantsColors.primary;
        drawLine(hipX, hipY, kneeX, kneeY, legColor, 2.9 * scale);
        drawLine(kneeX, kneeY, ankleX, ankleY, legColor, 2.7 * scale);
        drawLine(ankleX, ankleY, toeX, toeY, legColor, 2.2 * scale);
        drawJoint(kneeX, kneeY, 1.18 * scale, legColor, palette.outline, 0.8 * scale);
        drawJoint(ankleX, ankleY, 0.92 * scale, legColor, palette.outline, 0.72 * scale);
        ctx.fillStyle =
          loadout.boots === "none" || !loadout.boots
            ? palette.skinDark
            : loadout.boots === "plate"
              ? bootsColors.primary
              : loadout.boots === "leather"
                ? bootsColors.secondary
                : bootsColors.secondary;
        ctx.beginPath();
        ctx.ellipse(
          toeX,
          toeY + 0.9 * scale,
          (2.2 + (bootVariant % 3) * 0.22) * scale,
          (1.35 + (bootVariant % 2) * 0.18) * scale,
          pose.footAngle,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      drawChest(cx, cy + 3.2 * scale, loadout, palette, species, scale);
      const headRadius = drawHead(cx, headY, palette, species, scale);
      drawHeadgear(cx, headY, headRadius, loadout.head, palette, scale, loadout.headVisual);

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
        drawBowWeapon(bowHandPose, drawHandPose, bowHandSide, palette, bowPull, scale, loadout.mainHandVisual);
      } else {
        const offHandSide = mainHandSide === "left" ? "right" : "left";
        for (const side of ["left", "right"]) {
          const handPose = armPoseBySide[side];
          const handItem = side === mainHandSide ? loadout.mainHand : side === offHandSide ? loadout.offHand : { type: "none" };
          const handProfile =
            side === mainHandSide ? loadout.mainHandVisual : side === offHandSide ? loadout.offHandVisual : null;
          drawHeldItem(handPose.handX, handPose.handY, handItem.type, side, palette, attackVisual, scale, handPose, handProfile);
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
