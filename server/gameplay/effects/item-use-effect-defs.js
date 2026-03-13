function normalizeNumeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeEffectType(value) {
  return String(value || "").trim().toLowerCase();
}

function buildItemUseEffectDefsFromItemDef(itemDef) {
  if (!itemDef || typeof itemDef !== "object") {
    return [];
  }
  const effect = itemDef.effect && typeof itemDef.effect === "object" ? itemDef.effect : null;
  if (!effect) {
    return [];
  }

  const type = normalizeEffectType(effect.type);
  if (type !== "heal" && type !== "mana") {
    return [];
  }

  const amount = Math.max(0, normalizeNumeric(effect.amount ?? effect.value, 0));
  const duration = Math.max(0, normalizeNumeric(effect.duration, 0));
  if (amount <= 0) {
    return [];
  }

  return [
    {
      type,
      amount,
      duration,
      trigger: "onUse"
    }
  ];
}

module.exports = {
  buildItemUseEffectDefsFromItemDef
};

