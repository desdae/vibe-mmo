const PLAYER_VISUAL_SLOTS = Object.freeze([
  "head",
  "shoulders",
  "chest",
  "gloves",
  "bracers",
  "belt",
  "pants",
  "boots",
  "mainHand",
  "offHand"
]);

function serializeAppearanceEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const serialized = {
    itemId: String(entry.itemId || "").trim()
  };
  if (!serialized.itemId) {
    return null;
  }
  if (typeof entry.name === "string" && entry.name.trim()) {
    serialized.name = entry.name.trim();
  }
  if (typeof entry.slot === "string" && entry.slot.trim()) {
    serialized.slot = entry.slot.trim();
  }
  if (typeof entry.weaponClass === "string" && entry.weaponClass.trim()) {
    serialized.weaponClass = entry.weaponClass.trim();
  }
  if (typeof entry.rarity === "string" && entry.rarity.trim()) {
    serialized.rarity = entry.rarity.trim();
  }
  if (Array.isArray(entry.tags) && entry.tags.length) {
    serialized.tags = entry.tags.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 12);
  }
  return serialized;
}

function serializePlayerAppearance(player) {
  const equipmentSlots =
    player && player.equipmentSlots && typeof player.equipmentSlots === "object" ? player.equipmentSlots : null;
  if (!equipmentSlots) {
    return null;
  }
  const appearance = {};
  for (const slotId of PLAYER_VISUAL_SLOTS) {
    const entry = serializeAppearanceEntry(equipmentSlots[slotId]);
    if (entry) {
      appearance[slotId] = entry;
    }
  }
  return Object.keys(appearance).length ? appearance : null;
}

function serializePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    classType: player.classType,
    appearance: serializePlayerAppearance(player),
    x: player.x,
    y: player.y,
    hp: player.hp,
    maxHp: player.maxHp
  };
}

function serializeMob(mob) {
  return {
    id: mob.id,
    name: mob.type || "Mob",
    level: Math.max(1, Math.floor(Number(mob.level) || 1)),
    renderStyle: mob.renderStyle || null,
    x: mob.x,
    y: mob.y,
    hp: mob.hp,
    maxHp: mob.maxHp
  };
}

function serializeLootBag(bag) {
  return {
    id: bag.id,
    x: bag.x,
    y: bag.y
  };
}

module.exports = {
  serializePlayer,
  serializeMob,
  serializeLootBag
};
