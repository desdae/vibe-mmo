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

function hashString32(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function inferAppearanceThemes(entry) {
  const themes = new Set();
  const addTheme = (value) => {
    const theme = String(value || "").trim().toLowerCase();
    if (theme) {
      themes.add(theme);
    }
  };
  const text = `${String(entry?.itemId || "")} ${String(entry?.name || "")}`.toLowerCase();
  const modifierStats = [];
  for (const affix of Array.isArray(entry?.affixes) ? entry.affixes : []) {
    for (const modifier of Array.isArray(affix?.modifiers) ? affix.modifiers : []) {
      modifierStats.push(String(modifier?.stat || "").toLowerCase());
    }
    const affixText = String(affix?.name || "").toLowerCase();
    if (affixText.includes("fire") || affixText.includes("ember") || affixText.includes("flame")) addTheme("fire");
    if (affixText.includes("frost") || affixText.includes("ice") || affixText.includes("glacier")) addTheme("frost");
    if (affixText.includes("arcane") || affixText.includes("echo") || affixText.includes("mystic")) addTheme("arcane");
    if (affixText.includes("storm") || affixText.includes("lightning") || affixText.includes("thunder")) addTheme("lightning");
    if (affixText.includes("poison") || affixText.includes("venom") || affixText.includes("toxic")) addTheme("poison");
    if (affixText.includes("shadow") || affixText.includes("void") || affixText.includes("night")) addTheme("shadow");
    if (affixText.includes("life") || affixText.includes("vigor") || affixText.includes("mending")) addTheme("vitality");
    if (affixText.includes("guard") || affixText.includes("ward") || affixText.includes("fort")) addTheme("guard");
    if (affixText.includes("swift") || affixText.includes("wind") || affixText.includes("haste")) addTheme("wind");
  }
  for (const stat of modifierStats) {
    if (stat.includes("damageSchool.fire") || stat.includes("spellTag.fire")) addTheme("fire");
    if (stat.includes("damageSchool.frost") || stat.includes("spellTag.frost")) addTheme("frost");
    if (stat.includes("damageSchool.arcane") || stat.includes("spellTag.arcane") || stat.includes("spellPower")) addTheme("arcane");
    if (stat.includes("damageSchool.lightning") || stat.includes("spellTag.lightning")) addTheme("lightning");
    if (stat.includes("damageSchool.poison") || stat.includes("spellTag.poison")) addTheme("poison");
    if (stat.includes("damageSchool.shadow") || stat.includes("spellTag.shadow")) addTheme("shadow");
    if (stat.includes("health") || stat.includes("life")) addTheme("vitality");
    if (stat.includes("mana")) addTheme("arcane");
    if (stat.includes("armor") || stat.includes("block")) addTheme("guard");
    if (stat.includes("speed") || stat.includes("haste")) addTheme("wind");
    if (stat.includes("crit")) addTheme("precision");
  }
  if (text.includes("fire") || text.includes("ember") || text.includes("flame")) addTheme("fire");
  if (text.includes("frost") || text.includes("ice") || text.includes("glacier")) addTheme("frost");
  if (text.includes("arcane") || text.includes("mystic") || text.includes("mana")) addTheme("arcane");
  if (text.includes("storm") || text.includes("lightning") || text.includes("thunder")) addTheme("lightning");
  if (text.includes("poison") || text.includes("venom") || text.includes("toxic")) addTheme("poison");
  if (text.includes("shadow") || text.includes("void") || text.includes("night")) addTheme("shadow");
  if (text.includes("sun") || text.includes("holy") || text.includes("seraph")) addTheme("holy");
  if (text.includes("guard") || text.includes("ward") || text.includes("tower")) addTheme("guard");
  if (text.includes("swift") || text.includes("wind") || text.includes("hawk")) addTheme("wind");
  if (text.includes("vigor") || text.includes("mending") || text.includes("life")) addTheme("vitality");
  return Array.from(themes).slice(0, 3);
}

function getAppearancePower(entry) {
  let power = 0;
  for (const affix of Array.isArray(entry?.affixes) ? entry.affixes : []) {
    for (const modifier of Array.isArray(affix?.modifiers) ? affix.modifiers : []) {
      power += Math.abs(Number(modifier?.value) || 0);
    }
  }
  return Math.round(power * 100) / 100;
}

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
  if (Number.isFinite(Number(entry.itemLevel))) {
    serialized.itemLevel = Math.max(1, Math.floor(Number(entry.itemLevel)));
  }
  if (Array.isArray(entry.tags) && entry.tags.length) {
    serialized.tags = entry.tags.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 12);
  }
  const appearanceThemes = inferAppearanceThemes(entry);
  if (appearanceThemes.length) {
    serialized.appearanceThemes = appearanceThemes;
  }
  const appearancePower = getAppearancePower(entry);
  if (appearancePower > 0) {
    serialized.appearancePower = appearancePower;
  }
  serialized.appearanceSeed = hashString32(
    `${serialized.itemId}|${serialized.name || ""}|${serialized.rarity || ""}|${serialized.itemLevel || 1}`
  );
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
