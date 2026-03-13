function cloneModifier(modifier) {
  if (!modifier || typeof modifier !== "object") {
    return null;
  }
  return {
    stat: String(modifier.stat || ""),
    value: Number(modifier.value) || 0
  };
}

function cloneAffix(affix) {
  if (!affix || typeof affix !== "object") {
    return null;
  }
  return {
    id: String(affix.id || ""),
    name: String(affix.name || ""),
    kind: String(affix.kind || ""),
    modifiers: (Array.isArray(affix.modifiers) ? affix.modifiers : []).map(cloneModifier).filter(Boolean)
  };
}

function cloneItemEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const copy = {
    itemId: String(entry.itemId || ""),
    qty: Math.max(0, Math.floor(Number(entry.qty) || 0))
  };
  const passthroughKeys = [
    "instanceId",
    "name",
    "rarity",
    "slot",
    "weaponClass",
    "itemLevel",
    "isEquipment"
  ];
  for (const key of passthroughKeys) {
    if (entry[key] !== undefined && entry[key] !== null && entry[key] !== "") {
      copy[key] = entry[key];
    }
  }
  if (Array.isArray(entry.tags)) {
    copy.tags = entry.tags.map((value) => String(value || "")).filter(Boolean);
  }
  if (entry.baseStats && typeof entry.baseStats === "object") {
    copy.baseStats = { ...entry.baseStats };
  }
  if (Array.isArray(entry.affixes)) {
    copy.affixes = entry.affixes.map(cloneAffix).filter(Boolean);
  }
  if (Array.isArray(entry.prefixes)) {
    copy.prefixes = entry.prefixes.map(cloneAffix).filter(Boolean);
  }
  if (Array.isArray(entry.suffixes)) {
    copy.suffixes = entry.suffixes.map(cloneAffix).filter(Boolean);
  }
  return copy;
}

function createEquipmentTools(options = {}) {
  const equipmentConfigProvider =
    typeof options.equipmentConfigProvider === "function" ? options.equipmentConfigProvider : () => null;
  const getServerConfig = typeof options.getServerConfig === "function" ? options.getServerConfig : () => ({});
  const getTalentStats = typeof options.getTalentStats === "function" ? options.getTalentStats : () => ({});
  const allocateItemInstanceId =
    typeof options.allocateItemInstanceId === "function" ? options.allocateItemInstanceId : () => String(Date.now());
  const randomInt =
    typeof options.randomInt === "function"
      ? options.randomInt
      : (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clamp =
    typeof options.clamp === "function" ? options.clamp : (value, min, max) => Math.max(min, Math.min(max, value));
  const mapWidth = Math.max(1, Number(options.mapWidth) || 1);
  const mapHeight = Math.max(1, Number(options.mapHeight) || 1);
  const getAbilityDamageRange =
    typeof options.getAbilityDamageRange === "function" ? options.getAbilityDamageRange : () => [0, 0];
  const getAbilityDotDamageRange =
    typeof options.getAbilityDotDamageRange === "function" ? options.getAbilityDotDamageRange : () => [0, 0];

  function getEquipmentConfig() {
    const config = equipmentConfigProvider();
    return config && typeof config === "object" ? config : null;
  }

  function getSlotFamily(slotId) {
    const normalized = String(slotId || "").trim();
    if (normalized === "ring1" || normalized === "ring2") {
      return "ring";
    }
    if (normalized === "trinket1" || normalized === "trinket2") {
      return "trinket";
    }
    return normalized;
  }

  function createEmptyEquipmentSlots() {
    const config = getEquipmentConfig();
    const slots = {};
    const slotIds =
      config && Array.isArray(config.equipmentSlotIds)
        ? config.equipmentSlotIds
        : config && Array.isArray(config.clientEquipmentConfig?.itemSlots)
          ? config.clientEquipmentConfig.itemSlots
          : config && Array.isArray(config.itemSlots)
            ? config.itemSlots
            : [];
    for (const slotId of slotIds) {
      slots[slotId] = null;
    }
    return slots;
  }

  function isEquipmentItemId(itemId) {
    const config = getEquipmentConfig();
    return !!(config && config.baseItemsById instanceof Map && config.baseItemsById.has(String(itemId || "")));
  }

  function getBaseItem(itemId) {
    const config = getEquipmentConfig();
    return config && config.baseItemsById instanceof Map ? config.baseItemsById.get(String(itemId || "")) || null : null;
  }

  function isEquipmentEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    if (entry.instanceId !== undefined && entry.instanceId !== null) {
      return true;
    }
    return isEquipmentItemId(entry.itemId);
  }

  function rollModifierValue(modifier) {
    const min = Number(modifier.rollMin) || 0;
    const max = Number(modifier.rollMax) || min;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const areIntegers = Math.abs(low - Math.round(low)) < 0.001 && Math.abs(high - Math.round(high)) < 0.001;
    if (areIntegers) {
      return randomInt(Math.round(low), Math.round(high));
    }
    const raw = low + Math.random() * (high - low);
    return Math.round(raw * 100) / 100;
  }

  function chooseWeighted(entries) {
    const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!list.length) {
      return null;
    }
    let totalWeight = 0;
    for (const entry of list) {
      totalWeight += Math.max(0.0001, Number(entry.dropWeight) || 0.0001);
    }
    let roll = Math.random() * totalWeight;
    for (const entry of list) {
      roll -= Math.max(0.0001, Number(entry.dropWeight) || 0.0001);
      if (roll <= 0) {
        return entry;
      }
    }
    return list[list.length - 1];
  }

  function pickUniqueEntries(pool, count) {
    const available = Array.isArray(pool) ? pool.slice() : [];
    const results = [];
    let remaining = Math.max(0, Math.floor(Number(count) || 0));
    while (remaining > 0 && available.length > 0) {
      const index = randomInt(0, available.length - 1);
      results.push(available[index]);
      available.splice(index, 1);
      remaining -= 1;
    }
    return results;
  }

  function buildAffixInstances(entries, kind) {
    return entries.map((affix) => ({
      id: affix.id,
      name: affix.name,
      kind,
      modifiers: affix.modifiers.map((modifier) => ({
        stat: modifier.stat,
        value: rollModifierValue(modifier)
      }))
    }));
  }

  function getDropItemLevel(x, y) {
    const config = getEquipmentConfig();
    const maxItemLevel = Math.max(1, Number(config?.maxItemLevel) || 1);
    const cx = mapWidth * 0.5;
    const cy = mapHeight * 0.5;
    const maxRadius = Math.max(1, Math.hypot(cx, cy));
    const dist = Math.hypot((Number(x) || 0) - cx, (Number(y) || 0) - cy);
    const ratio = clamp(dist / maxRadius, 0, 1);
    return clamp(Math.round(1 + ratio * (maxItemLevel - 1)), 1, maxItemLevel);
  }

  function pickBaseItemForLevel(slotId, itemLevel) {
    const config = getEquipmentConfig();
    const candidates = (Array.isArray(config?.baseItems) ? config.baseItems : []).filter((entry) => entry.slot === slotId && !entry.starterOnly);
    if (!candidates.length) {
      return null;
    }
    const exact = candidates.filter((entry) => itemLevel >= entry.itemLevelRange[0] && itemLevel <= entry.itemLevelRange[1]);
    if (exact.length) {
      return exact[randomInt(0, exact.length - 1)];
    }
    let best = candidates[0];
    let bestDistance = Infinity;
    for (const entry of candidates) {
      const mid = (entry.itemLevelRange[0] + entry.itemLevelRange[1]) * 0.5;
      const delta = Math.abs(mid - itemLevel);
      if (delta < bestDistance) {
        bestDistance = delta;
        best = entry;
      }
    }
    return best;
  }

  function filterAffixPool(pool, baseItem, itemLevel) {
    return (Array.isArray(pool) ? pool : []).filter((entry) => {
      if (!entry || itemLevel < entry.minItemLevel) {
        return false;
      }
      if (Array.isArray(entry.allowedSlots) && entry.allowedSlots.length && !entry.allowedSlots.includes(baseItem.slot)) {
        return false;
      }
      if (Array.isArray(entry.requiredItemTagsAny) && entry.requiredItemTagsAny.length) {
        const tagSet = new Set(Array.isArray(baseItem.tags) ? baseItem.tags : []);
        let matched = false;
        for (const tag of entry.requiredItemTagsAny) {
          if (tagSet.has(tag)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          return false;
        }
      }
      return true;
    });
  }

  function buildEquipmentDisplayName(baseItem, prefixes, suffixes) {
    const prefixText = prefixes.map((entry) => entry.name).filter(Boolean).join(" ");
    const suffixText = suffixes.map((entry) => entry.name).filter(Boolean).join(" ");
    const parts = [];
    if (prefixText) {
      parts.push(prefixText);
    }
    parts.push(baseItem.name);
    if (suffixText) {
      parts.push(suffixText);
    }
    return parts.join(" ");
  }

  function createEquipmentEntryFromBaseItem(itemId, options = {}) {
    const baseItem = getBaseItem(itemId);
    if (!baseItem) {
      return null;
    }
    const requestedLevel = Math.floor(Number(options.itemLevel) || baseItem.itemLevelRange[0] || 1);
    const itemLevel = clamp(requestedLevel, baseItem.itemLevelRange[0], baseItem.itemLevelRange[1]);
    const rarityId = String(options.rarity || "normal").trim() || "normal";
    return {
      itemId: baseItem.id,
      qty: 1,
      instanceId: String(allocateItemInstanceId()),
      name: String(options.name || baseItem.name),
      rarity: rarityId,
      slot: baseItem.slot,
      weaponClass: baseItem.weaponClass,
      itemLevel,
      isEquipment: true,
      tags: Array.isArray(baseItem.tags) ? [...baseItem.tags] : [],
      baseStats: { ...baseItem.baseStats },
      affixes: [],
      prefixes: [],
      suffixes: []
    };
  }

  function rollEquipmentItemAt(x, y) {
    const config = getEquipmentConfig();
    if (!config || !Array.isArray(config.itemSlots) || !config.itemSlots.length) {
      return null;
    }
    const slotId = config.itemSlots[randomInt(0, config.itemSlots.length - 1)];
    const itemLevel = getDropItemLevel(x, y);
    const baseItem = pickBaseItemForLevel(slotId, itemLevel);
    if (!baseItem) {
      return null;
    }
    const rarity = chooseWeighted(config.rarityEntries);
    if (!rarity) {
      return null;
    }

    const prefixPool = filterAffixPool(config.prefixes, baseItem, itemLevel);
    const suffixPool = filterAffixPool(config.suffixes, baseItem, itemLevel);
    const prefixCount = randomInt(rarity.prefixMin, rarity.prefixMax);
    const suffixCount = randomInt(rarity.suffixMin, rarity.suffixMax);
    const prefixes = buildAffixInstances(pickUniqueEntries(prefixPool, prefixCount), "prefix");
    const suffixes = buildAffixInstances(pickUniqueEntries(suffixPool, suffixCount), "suffix");
    const affixes = [...prefixes, ...suffixes];

    return {
      itemId: baseItem.id,
      qty: 1,
      instanceId: String(allocateItemInstanceId()),
      name: buildEquipmentDisplayName(baseItem, prefixes, suffixes),
      rarity: rarity.id,
      slot: baseItem.slot,
      weaponClass: baseItem.weaponClass,
      itemLevel,
      isEquipment: true,
      tags: Array.isArray(baseItem.tags) ? [...baseItem.tags] : [],
      baseStats: { ...baseItem.baseStats },
      affixes,
      prefixes,
      suffixes
    };
  }

  function rollEquipmentDropsAt(x, y) {
    const baseChance = 0.2;
    const chanceMultiplier = Math.max(0, Number(getServerConfig()?.dropChanceMultiplier) || 1);
    const effectiveChance = baseChance * chanceMultiplier;
    const guaranteed = Math.max(0, Math.floor(effectiveChance));
    const fractional = effectiveChance - guaranteed;
    const extra = Math.random() < fractional ? 1 : 0;
    const count = guaranteed + extra;
    const drops = [];
    for (let i = 0; i < count; i += 1) {
      const rolled = rollEquipmentItemAt(x, y);
      if (rolled) {
        drops.push(rolled);
      }
    }
    return drops;
  }

  function getEquippedEntries(player) {
    const equipmentSlots = player && player.equipmentSlots && typeof player.equipmentSlots === "object" ? player.equipmentSlots : {};
    return Object.values(equipmentSlots).filter(Boolean);
  }

  function getEquippedBaseStatTotal(player, statKey) {
    const target = String(statKey || "").trim();
    if (!target) {
      return 0;
    }
    let total = 0;
    for (const entry of getEquippedEntries(player)) {
      const baseStats =
        entry && entry.baseStats && typeof entry.baseStats === "object"
          ? entry.baseStats
          : getBaseItem(entry?.itemId)?.baseStats || null;
      if (!baseStats) {
        continue;
      }
      total += Number(baseStats[target]) || 0;
    }
    return total;
  }

  function getEquippedStatTotal(player, statPath) {
    const target = String(statPath || "").trim();
    if (!target) {
      return 0;
    }
    let total = 0;
    for (const entry of getEquippedEntries(player)) {
      for (const affix of Array.isArray(entry.affixes) ? entry.affixes : []) {
        for (const modifier of Array.isArray(affix.modifiers) ? affix.modifiers : []) {
          if (String(modifier.stat || "") !== target) {
            continue;
          }
          total += Number(modifier.value) || 0;
        }
      }
    }
    return total;
  }

  function getPlayerEquipmentDerivedStats(player) {
    const baseArmor = Math.max(0, getEquippedBaseStatTotal(player, "armor"));
    const armorPercent = getEquippedStatTotal(player, "armor.percent");
    const baseBlockChance = Math.max(0, getEquippedBaseStatTotal(player, "blockChance"));
    const talentStats = getTalentStats(player);
    return {
      maxHealthFlat: getEquippedStatTotal(player, "maxHealth.flat") + (talentStats["maxHp.flat"] || 0),
      maxHealthPercent: getEquippedStatTotal(player, "maxHealth.percent") + (talentStats["maxHp.percent"] || 0),
      maxManaFlat: getEquippedStatTotal(player, "maxMana.flat") + (talentStats["maxMana.flat"] || 0),
      maxManaPercent: getEquippedStatTotal(player, "maxMana.percent") + (talentStats["maxMana.percent"] || 0),
      healthRegenFlat: getEquippedStatTotal(player, "healthRegen.flat") + (talentStats["healthRegen.flat"] || 0),
      healthRegenPercent: getEquippedStatTotal(player, "healthRegen.percent") + (talentStats["healthRegen.percent"] || 0),
      manaRegenFlat: getEquippedStatTotal(player, "manaRegen.flat") + (talentStats["manaRegen.flat"] || 0),
      manaRegenPercent: getEquippedStatTotal(player, "manaRegen.percent") + (talentStats["manaRegen.percent"] || 0),
      moveSpeedPercent: getEquippedStatTotal(player, "moveSpeed.percent") + (talentStats["moveSpeed.percent"] || 0),
      critChancePercent: getEquippedStatTotal(player, "critChance.percent") + (talentStats["critChance.percent"] || 0),
      critDamagePercent: getEquippedStatTotal(player, "critDamage.percent") + (talentStats["critDamage.percent"] || 0),
      lifeStealPercent: getEquippedStatTotal(player, "lifeSteal.percent") + (talentStats["lifeSteal.percent"] || 0),
      manaStealPercent: getEquippedStatTotal(player, "manaSteal.percent") + (talentStats["manaSteal.percent"] || 0),
      lifeOnKillFlat: getEquippedStatTotal(player, "lifeOnKill.flat") + (talentStats["lifeOnKill.flat"] || 0),
      manaOnKillFlat: getEquippedStatTotal(player, "manaOnKill.flat") + (talentStats["manaOnKill.flat"] || 0),
      thornsFlat: getEquippedStatTotal(player, "thorns.flat") + (talentStats["thorns.flat"] || 0),
      attackSpeedPercent: getEquippedStatTotal(player, "attackSpeed.percent") + (talentStats["attackSpeed.percent"] || 0),
      castSpeedPercent: getEquippedStatTotal(player, "castSpeed.percent") + (talentStats["castSpeed.percent"] || 0),
      armor: Math.max(0, Math.round(baseArmor * (1 + armorPercent / 100))) + Math.round(talentStats["armor.flat"] || 0),
      blockChance: clamp(baseBlockChance, 0, 0.75),
      meleeDamagePercent: getEquippedStatTotal(player, "meleeDamage.percent") + (talentStats["meleeDamage.percent"] || 0),
      spellPower: getEquippedStatTotal(player, "spellPower.flat") + (talentStats["spellPower.flat"] || 0)
    };
  }

  function inferAbilityTags(abilityDef) {
    const tags = new Set();
    for (const tag of Array.isArray(abilityDef?.tags) ? abilityDef.tags : []) {
      const normalized = String(tag || "").trim().toLowerCase();
      if (normalized) {
        tags.add(normalized);
      }
    }
    const kind = String(abilityDef?.kind || "").trim().toLowerCase();
    if (kind === "projectile") {
      tags.add("projectile");
    } else if (kind === "area" || kind === "selfarea") {
      tags.add("area");
    } else if (kind === "beam") {
      tags.add("beam");
    } else if (kind === "meleecone") {
      tags.add("melee");
    }
    return Array.from(tags);
  }

  function inferAbilitySchool(abilityDef, fallback = "") {
    const normalizedFallback = String(fallback || "").trim().toLowerCase();
    if (normalizedFallback && normalizedFallback !== "generic") {
      return normalizedFallback;
    }
    const directSchool = String(abilityDef && abilityDef.damageSchool || "").trim().toLowerCase();
    if (directSchool) {
      return directSchool;
    }
    const tags = inferAbilityTags(abilityDef);
    for (const school of ["fire", "frost", "arcane", "physical"]) {
      if (tags.includes(school)) {
        return school;
      }
    }
    return "";
  }

  function getPlayerAbilityModifierTotal(player, abilityDef, statPath) {
    const target = String(statPath || "").trim();
    if (!target) {
      return 0;
    }
    let total = getEquippedStatTotal(player, target);
    const school = inferAbilitySchool(abilityDef);
    if (school) {
      total += getEquippedStatTotal(player, `damageSchool.${school}.${target}`);
    }
    for (const tag of inferAbilityTags(abilityDef)) {
      total += getEquippedStatTotal(player, `spellTag.${tag}.${target}`);
    }
    return total;
  }

  function applyDamageBonusesToRange(baseRange, percentBonus, flatMin, flatMax) {
    const min = Math.max(0, Number(baseRange[0]) || 0);
    const max = Math.max(min, Number(baseRange[1]) || min);
    const scale = Math.max(0, 1 + percentBonus / 100);
    const nextMin = Math.max(0, Math.floor((min + flatMin) * scale));
    const nextMax = Math.max(nextMin, Math.ceil((max + flatMax) * scale));
    return [nextMin, nextMax];
  }

  function getPlayerModifiedAbilityDamageRange(player, abilityDef, abilityLevel) {
    const baseRange = getAbilityDamageRange(abilityDef, abilityLevel);
    const school = inferAbilitySchool(abilityDef);
    const tags = inferAbilityTags(abilityDef);
    let percentBonus = getEquippedStatTotal(player, "damage.global.percent");
    if (school) {
      percentBonus += getEquippedStatTotal(player, `damageSchool.${school}.percent`);
    }
    for (const tag of tags) {
      percentBonus += getEquippedStatTotal(player, `spellTag.${tag}.damagePercent`);
    }
    if (tags.includes("melee")) {
      percentBonus += Math.max(0, Number(player && player.meleeDamageBonusPercent) || 0);
    }
    const flatMin = school ? getEquippedStatTotal(player, `damage.${school}.flatMin`) : 0;
    const flatMax = school ? getEquippedStatTotal(player, `damage.${school}.flatMax`) : 0;
    return applyDamageBonusesToRange(baseRange, percentBonus, flatMin, flatMax);
  }

  function getPlayerModifiedAbilityDotDamageRange(player, abilityDef, abilityLevel) {
    const baseRange = getAbilityDotDamageRange(abilityDef, abilityLevel);
    const school = inferAbilitySchool(abilityDef, abilityDef && abilityDef.dotSchool);
    let percentBonus = getEquippedStatTotal(player, "damage.global.percent");
    if (school) {
      percentBonus += getEquippedStatTotal(player, `damageSchool.${school}.percent`);
    }
    for (const tag of inferAbilityTags(abilityDef)) {
      percentBonus += getEquippedStatTotal(player, `spellTag.${tag}.damagePercent`);
    }
    return applyDamageBonusesToRange(baseRange, percentBonus, 0, 0);
  }

  function getPlayerModifiedAbilityChainStats(player, abilityDef) {
    return {
      jumpCountBonus: getPlayerAbilityModifierTotal(player, abilityDef, "jumpCount"),
      jumpDamageReductionPercent: getPlayerAbilityModifierTotal(player, abilityDef, "jumpDamageReductionPercent")
    };
  }

  function recomputePlayerDerivedStats(player) {
    if (!player) {
      return;
    }
    const derived = getPlayerEquipmentDerivedStats(player);

    const nextMaxHp = clamp(
      Math.round(
        (Math.max(1, Number(player.baseHealth) || 1) + derived.maxHealthFlat) * (1 + derived.maxHealthPercent / 100)
      ),
      1,
      255
    );
    const nextMaxMana = Math.max(
      0,
      Math.round((Math.max(0, Number(player.baseMana) || 0) + derived.maxManaFlat) * (1 + derived.maxManaPercent / 100))
    );
    const nextHealthRegen = Math.max(
      0,
      (
        Math.max(0, Number(player.baseHealthRegen) || 0) +
        derived.healthRegenFlat +
        Math.max(0, Number(player.buffHealthRegenFlat) || 0)
      ) * (1 + derived.healthRegenPercent / 100)
    );
    const nextManaRegen = Math.max(
      0,
      (Math.max(0, Number(player.baseManaRegen) || 0) + derived.manaRegenFlat) * (1 + derived.manaRegenPercent / 100)
    );
    const nextMoveSpeed = Math.max(
      0.1,
      Math.max(0.1, Number(player.baseMoveSpeed) || 0.1) * (1 + derived.moveSpeedPercent / 100)
    );

    player.maxHp = nextMaxHp;
    player.hp = clamp(Number(player.hp) || 0, 0, player.maxHp);
    player.maxMana = nextMaxMana;
    player.mana = clamp(Number(player.mana) || 0, 0, player.maxMana);
    player.healthRegen = nextHealthRegen;
    player.manaRegen = nextManaRegen;
    player.moveSpeed = nextMoveSpeed;
    player.armor = derived.armor;
    player.blockChance = derived.blockChance;
    player.critChance = Math.max(0, derived.critChancePercent);
    player.critDamage = Math.max(0, derived.critDamagePercent);
    player.lifeSteal = Math.max(0, derived.lifeStealPercent);
    player.manaSteal = Math.max(0, derived.manaStealPercent);
    player.lifeOnKill = Math.max(0, derived.lifeOnKillFlat);
    player.manaOnKill = Math.max(0, derived.manaOnKillFlat);
    player.thorns = Math.max(0, derived.thornsFlat);
    player.attackSpeedMultiplier = Math.max(0.1, 1 + derived.attackSpeedPercent / 100);
    player.castSpeedMultiplier = Math.max(0.1, 1 + derived.castSpeedPercent / 100);
    player.meleeDamageBonusPercent = Math.max(0, derived.meleeDamagePercent);
    player.spellPower = Math.max(0, derived.spellPower);
    
    // Handle conditional talent effects (e.g., damage reduction when HP below 30%)
    const hpPercent = player.hp / Math.max(1, player.maxHp);
    player.damageReductionPercent = Math.max(0, derived.damageReductionPercent || 0);
    if (hpPercent < 0.3 && derived.conditionalDamageReductionPercent) {
      player.damageReductionPercent += derived.conditionalDamageReductionPercent;
    }
  }

  function getPlayerModifiedAbilityCooldownMs(player, abilityDef, abilityLevel, getBaseCooldownMs) {
    const baseCooldownMs = Math.max(
      0,
      typeof getBaseCooldownMs === "function" ? Number(getBaseCooldownMs(abilityDef, abilityLevel)) || 0 : 0
    );
    if (!player || !abilityDef || baseCooldownMs <= 0) {
      return baseCooldownMs;
    }
    const kind = String(abilityDef.kind || "").trim().toLowerCase();
    if (kind !== "meleecone") {
      return baseCooldownMs;
    }
    return Math.max(0, Math.round(baseCooldownMs / Math.max(0.1, Number(player.attackSpeedMultiplier) || 1)));
  }

  function getPlayerModifiedAbilityCastMs(player, abilityDef) {
    const baseCastMs = Math.max(0, Math.round(Number(abilityDef && abilityDef.castMs) || 0));
    if (!player || !abilityDef || baseCastMs <= 0) {
      return baseCastMs;
    }
    return Math.max(0, Math.round(baseCastMs / Math.max(0.1, Number(player.castSpeedMultiplier) || 1)));
  }

  function resolveEntrySlot(entry) {
    const directSlot = String(entry?.slot || "").trim();
    if (directSlot) {
      return getSlotFamily(directSlot);
    }
    const baseItem = getBaseItem(entry?.itemId);
    return baseItem ? getSlotFamily(baseItem.slot) : "";
  }

  function canEquipEntryToSlot(entry, slotId) {
    if (!isEquipmentEntry(entry)) {
      return false;
    }
    return resolveEntrySlot(entry) === getSlotFamily(slotId);
  }

  function equipInventoryItem(player, inventoryIndex, slotId) {
    if (!player || !Array.isArray(player.inventorySlots) || !player.equipmentSlots) {
      return false;
    }
    if (!Number.isInteger(inventoryIndex) || inventoryIndex < 0 || inventoryIndex >= player.inventorySlots.length) {
      return false;
    }
    const targetSlot = String(slotId || "").trim();
    if (!targetSlot || !(targetSlot in player.equipmentSlots)) {
      return false;
    }

    const sourceEntry = player.inventorySlots[inventoryIndex];
    if (!canEquipEntryToSlot(sourceEntry, targetSlot)) {
      return false;
    }

    const equippedEntry = player.equipmentSlots[targetSlot];
    player.equipmentSlots[targetSlot] = cloneItemEntry(sourceEntry);
    player.inventorySlots[inventoryIndex] = equippedEntry ? cloneItemEntry(equippedEntry) : null;
    recomputePlayerDerivedStats(player);
    return true;
  }

  function unequipEquipmentItem(player, slotId, targetIndex = null) {
    if (!player || !Array.isArray(player.inventorySlots) || !player.equipmentSlots) {
      return false;
    }
    const sourceSlot = String(slotId || "").trim();
    if (!sourceSlot || !(sourceSlot in player.equipmentSlots)) {
      return false;
    }
    const equippedEntry = player.equipmentSlots[sourceSlot];
    if (!equippedEntry) {
      return false;
    }

    let destinationIndex = Number.isInteger(targetIndex) ? targetIndex : -1;
    if (
      destinationIndex >= 0 &&
      destinationIndex < player.inventorySlots.length &&
      !player.inventorySlots[destinationIndex]
    ) {
      player.inventorySlots[destinationIndex] = cloneItemEntry(equippedEntry);
      player.equipmentSlots[sourceSlot] = null;
      recomputePlayerDerivedStats(player);
      return true;
    }

    destinationIndex = player.inventorySlots.findIndex((slot) => !slot);
    if (destinationIndex < 0) {
      return false;
    }

    player.inventorySlots[destinationIndex] = cloneItemEntry(equippedEntry);
    player.equipmentSlots[sourceSlot] = null;
    recomputePlayerDerivedStats(player);
    return true;
  }

  return {
    cloneItemEntry,
    createEmptyEquipmentSlots,
    createEquipmentEntryFromBaseItem,
    isEquipmentItemId,
    isEquipmentEntry,
    rollEquipmentDropsAt,
    getEquippedBaseStatTotal,
    getEquippedStatTotal,
    getPlayerModifiedAbilityDamageRange,
    getPlayerModifiedAbilityDotDamageRange,
    getPlayerModifiedAbilityChainStats,
    getPlayerModifiedAbilityCooldownMs,
    getPlayerModifiedAbilityCastMs,
    recomputePlayerDerivedStats,
    equipInventoryItem,
    unequipEquipmentItem
  };
}

module.exports = {
  createEquipmentTools
};
