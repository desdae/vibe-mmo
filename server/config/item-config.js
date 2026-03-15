const fs = require("fs");
const { clamp } = require("../gameplay/number-utils");

function loadItemConfigFromDisk(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [];

  const itemDefs = new Map();
  const clientItemDefs = [];

  for (const entry of items) {
    const id = String(entry?.id || "").trim();
    if (!id) {
      continue;
    }
    const name = String(entry?.name || id).trim().slice(0, 48);
    const stackSize = clamp(Math.round(Number(entry?.stackSize) || 1), 1, 65535);
    const description = String(entry?.description || "").slice(0, 240);
    const icon = String(entry?.icon || "").slice(0, 120);
    const tags = Array.isArray(entry?.tags)
      ? entry.tags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const effect = entry && typeof entry.effect === "object" ? entry.effect : null;
    const vendorValue = Math.max(0, Math.floor(Number(entry?.vendorValue) || 0));
    const toolTagsAny = Array.isArray(entry?.toolTagsAny)
      ? entry.toolTagsAny.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const toolTier = Math.max(0, Math.floor(Number(entry?.toolTier) || 0));
    let normalizedEffect = null;
    if (effect && typeof effect.type === "string") {
      normalizedEffect = {
        type: String(effect.type),
        value: Number(effect.value) || 0,
        duration: Number(effect.duration) || 0
      };
      for (const [effectKey, effectValue] of Object.entries(effect)) {
        if (effectKey === "type" || effectKey === "value" || effectKey === "duration") {
          continue;
        }
        if (typeof effectValue === "number" && Number.isFinite(effectValue) && effectValue > 0) {
          normalizedEffect[effectKey] = effectValue;
        }
      }
    }

    const def = {
      id,
      name,
      stackSize,
      description,
      icon,
      tags,
      effect: normalizedEffect,
      vendorValue
    };
    if (toolTagsAny.length > 0) {
      def.toolTagsAny = toolTagsAny;
      def.toolTier = toolTier > 0 ? toolTier : 1;
    }
    itemDefs.set(id, def);
    clientItemDefs.push(def);
  }

  if (!itemDefs.size) {
    throw new Error(`No valid item definitions in ${configPath}`);
  }

  return {
    itemDefs,
    clientItemDefs
  };
}

module.exports = {
  loadItemConfigFromDisk
};
