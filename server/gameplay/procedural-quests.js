const fs = require("fs");
const path = require("path");
const { createQuestContentRegistry } = require("./quest-content-registry");

/*
Data model

Quest template:
{
  id,
  npcGiverId,
  npcCompleteId,
  repeatable,
  minLevel,
  objectives: [
    {
      type: "kill" | "collect" | "explore",
      countRange?,
      target: {
        kind: "mobByTags" | "dropItemByTags" | "gatherItemByTags" | "regionByTags",
        tagsAll?,
        tagsAny?,
        tagsNone?,
        itemTagsAll?,
        itemTagsAny?,
        itemTagsNone?,
        sourceMobTagsAll?,
        sourceMobTagsAny?,
        sourceMobTagsNone?,
        sourceResourceTagsAll?,
        sourceResourceTagsAny?,
        sourceResourceTagsNone?,
        sourceSkillId?,
        maxSpawnRange?,
        maxRequiredLevel?
      }
    }
  ],
  rewards,
  text
}

Generated quest instance:
{
  id,
  templateId,
  generated: true,
  npcGiverId,
  npcCompleteId,
  title,
  description,
  objectives,
  rewards,
  dialogue
}

Module API:
- loadTemplateData()
- getTemplateDefs()
- getGeneratedQuestById(player, questId)
- getAvailableQuestsForNpc(player, npcId)
- markQuestAccepted(player, questId)
- recordGeneratedCompletion(player, quest)
*/

function createProceduralQuestTools(options = {}) {
  const templateDataPath = options.templateDataPath
    ? path.resolve(String(options.templateDataPath))
    : path.resolve(__dirname, "../../data/quest-templates.json");
  const registry = createQuestContentRegistry({
    townLayout: options.townLayout || null,
    mapWidth: options.mapWidth,
    mapHeight: options.mapHeight,
    mobConfigProvider: typeof options.mobConfigProvider === "function" ? options.mobConfigProvider : () => null,
    itemDefsProvider: typeof options.itemDefsProvider === "function" ? options.itemDefsProvider : () => null,
    regionDataPath: options.regionDataPath,
    resourceDataPath: options.resourceDataPath,
    resourceRegistryProvider: options.resourceRegistryProvider
  });

  let loadedTemplateData = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeQuestLookupId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function hashString(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRng(seed) {
    let state = hashString(seed) || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 1000000) / 1000000;
    };
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "quest";
  }

  function pluralizeName(value) {
    const text = normalizeText(value);
    if (!text) {
      return "targets";
    }
    if (/[^aeiou]y$/i.test(text)) {
      return `${text.slice(0, -1)}ies`;
    }
    if (/(s|x|z|ch|sh)$/i.test(text)) {
      return `${text}es`;
    }
    return `${text}s`;
  }

  function formatList(values) {
    const items = (Array.isArray(values) ? values : []).map((entry) => normalizeText(entry)).filter(Boolean);
    if (items.length <= 1) {
      return items[0] || "";
    }
    if (items.length === 2) {
      return `${items[0]} and ${items[1]}`;
    }
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  }

  function capitalizeFirst(value) {
    const text = normalizeText(value);
    if (!text) {
      return "";
    }
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  }

  function pickVariant(rng, variants, fallback) {
    const list = Array.isArray(variants) ? variants.map((entry) => normalizeText(entry)).filter(Boolean) : [];
    if (!list.length) {
      return normalizeText(fallback);
    }
    const index = clamp(Math.floor(rng() * list.length), 0, list.length - 1);
    return list[index] || normalizeText(fallback);
  }

  function interpolateText(text, tokens) {
    return String(text || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      if (!tokens || !Object.prototype.hasOwnProperty.call(tokens, key)) {
        return "";
      }
      return String(tokens[key]);
    });
  }

  function loadTemplateData() {
    if (loadedTemplateData) {
      return loadedTemplateData;
    }
    try {
      const raw = fs.readFileSync(templateDataPath, "utf8");
      loadedTemplateData = JSON.parse(raw);
    } catch (error) {
      console.error("[procedural-quests] Failed to load quest templates:", error.message);
      loadedTemplateData = { maxOffersPerNpc: 1, templates: [] };
    }
    return loadedTemplateData;
  }

  function getTemplateDefs() {
    const data = loadTemplateData();
    return Array.isArray(data.templates) ? data.templates : [];
  }

  function getMaxOffersPerNpc() {
    const data = loadTemplateData();
    return clamp(Math.floor(Number(data && data.maxOffersPerNpc) || 1), 1, 8);
  }

  function getPlayerGeneratedState(player) {
    if (!player) {
      return null;
    }
    if (!player.questState || typeof player.questState !== "object") {
      player.questState = { active: {}, completed: [] };
    }
    if (!player.questState.generated || typeof player.questState.generated !== "object") {
      player.questState.generated = {};
    }
    const generated = player.questState.generated;
    if (!Number.isFinite(Number(generated.nextQuestSerial)) || Number(generated.nextQuestSerial) < 1) {
      generated.nextQuestSerial = 1;
    } else {
      generated.nextQuestSerial = Math.floor(Number(generated.nextQuestSerial));
    }
    if (!generated.offersByNpc || typeof generated.offersByNpc !== "object") {
      generated.offersByNpc = {};
    }
    if (!generated.definitions || typeof generated.definitions !== "object") {
      generated.definitions = {};
    }
    if (!generated.completedTemplates || typeof generated.completedTemplates !== "object") {
      generated.completedTemplates = {};
    }
    return generated;
  }

  function getGeneratedQuestById(player, questId) {
    const generated = getPlayerGeneratedState(player);
    if (!generated) {
      return null;
    }
    const normalizedQuestId = normalizeText(questId);
    return normalizedQuestId ? generated.definitions[normalizedQuestId] || null : null;
  }

  function getOfferIdsForNpc(generatedState, npcId) {
    const ids = generatedState && generatedState.offersByNpc && Array.isArray(generatedState.offersByNpc[npcId])
      ? generatedState.offersByNpc[npcId]
      : [];
    return ids.filter((questId) => generatedState.definitions && generatedState.definitions[questId]);
  }

  function getActiveTemplateIds(player) {
    const active = player && player.questState && player.questState.active && typeof player.questState.active === "object"
      ? Object.keys(player.questState.active)
      : [];
    const ids = new Set();
    for (const questId of active) {
      const quest = getGeneratedQuestById(player, questId);
      if (quest && quest.templateId) {
        ids.add(String(quest.templateId));
      }
    }
    return ids;
  }

  function countTemplateCompletions(player, templateId) {
    const generated = getPlayerGeneratedState(player);
    if (!generated || !templateId) {
      return 0;
    }
    return Math.max(0, Number(generated.completedTemplates[String(templateId)] || 0));
  }

  function calculateCount(rng, countRange, fallbackMin, fallbackMax) {
    const range = Array.isArray(countRange) ? countRange : [fallbackMin, fallbackMax];
    const minCount = Math.max(1, Math.floor(Number(range[0]) || fallbackMin));
    const maxCount = Math.max(minCount, Math.floor(Number(range[1]) || fallbackMax || minCount));
    return clamp(minCount + Math.floor(rng() * (maxCount - minCount + 1)), minCount, maxCount);
  }

  function chooseCandidate(rng, candidates, scorer) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }
    const ranked = candidates
      .map((entry) => ({
        entry,
        score: typeof scorer === "function" ? Number(scorer(entry)) || 0 : 0
      }))
      .sort((left, right) => left.score - right.score)
      .slice(0, Math.min(4, candidates.length));
    const index = clamp(Math.floor(rng() * ranked.length), 0, ranked.length - 1);
    return ranked[index] ? ranked[index].entry : null;
  }

  function buildObjectiveSelection(player, template, objectiveSpec, rng, usedSelections) {
    const spec = objectiveSpec && typeof objectiveSpec === "object" ? objectiveSpec : {};
    const type = normalizeText(spec.type).toLowerCase();
    const target = spec.target && typeof spec.target === "object" ? spec.target : {};
    const targetKind = normalizeText(target.kind).toLowerCase();
    const maxSpawnRange = Number.isFinite(Number(target.maxSpawnRange)) ? Number(target.maxSpawnRange) : null;

    if (type === "kill") {
      const playerLevel = Math.max(1, Number(player && player.level) || 1);
      const desiredDistance = clamp(90 + playerLevel * 22, 70, maxSpawnRange || 260);
      const candidates = registry.findMobs({
        tagsAll: target.tagsAll,
        tagsAny: target.tagsAny,
        tagsNone: target.tagsNone,
        maxSpawnRange
      }).filter((entry) => !usedSelections.mobIds.has(entry.id));
      const mob = chooseCandidate(rng, candidates, (entry) => {
        const distanceMid = (Number(entry.spawnRangeMin) + Number(entry.spawnRangeMax)) * 0.5;
        return Math.abs(distanceMid - desiredDistance) + Number(entry.health || 0) * 0.3;
      });
      if (!mob) {
        return null;
      }
      usedSelections.mobIds.add(mob.id);
      const count = calculateCount(rng, spec.countRange, 3, 6);
      return {
        objective: {
          type: "kill",
          mobId: mob.id,
          count,
          description: `Kill ${count} ${String(pluralizeName(mob.name)).toLowerCase()}`
        },
        tokens: {
          targetName: mob.name,
          targetNamePlural: pluralizeName(mob.name),
          count,
          distanceScore: Math.round((Number(mob.spawnRangeMin) + Number(mob.spawnRangeMax)) * 0.5)
        },
        summary: `kill ${count} ${String(pluralizeName(mob.name)).toLowerCase()}`,
        rewardUnits: count,
        rewardDistance: Math.round((Number(mob.spawnRangeMin) + Number(mob.spawnRangeMax)) * 0.5)
      };
    }

    if (type === "collect") {
      const candidates =
        targetKind === "gatheritembytags"
          ? registry.findGatherItems({
              itemTagsAll: target.itemTagsAll,
              itemTagsAny: target.itemTagsAny,
              itemTagsNone: target.itemTagsNone,
              sourceResourceTagsAll: target.sourceResourceTagsAll,
              sourceResourceTagsAny: target.sourceResourceTagsAny,
              sourceResourceTagsNone: target.sourceResourceTagsNone,
              sourceSkillId: target.sourceSkillId,
              maxRequiredLevel: target.maxRequiredLevel
            }).filter((entry) => !usedSelections.itemIds.has(entry.itemId))
          : registry.findDropItems({
              itemTagsAll: target.itemTagsAll,
              itemTagsAny: target.itemTagsAny,
              itemTagsNone: target.itemTagsNone,
              sourceMobTagsAll: target.sourceMobTagsAll,
              sourceMobTagsAny: target.sourceMobTagsAny,
              sourceMobTagsNone: target.sourceMobTagsNone,
              maxSpawnRange
            }).filter((entry) => !usedSelections.itemIds.has(entry.itemId));
      const item = chooseCandidate(rng, candidates, (entry) => {
        if (targetKind === "gatheritembytags") {
          const source = Array.isArray(entry.sourceResources) && entry.sourceResources.length > 0
            ? entry.sourceResources[0]
            : null;
          return source ? Number(source.requiredLevel) || 0 : 0;
        }
        const source = Array.isArray(entry.sourceMobs) && entry.sourceMobs.length > 0 ? entry.sourceMobs[0] : null;
        return source ? Number(source.spawnRangeMin) || 0 : 0;
      });
      if (!item) {
        return null;
      }
      usedSelections.itemIds.add(item.itemId);
      const count = calculateCount(rng, spec.countRange, 5, 8);
      const itemPlural = pluralizeName(item.itemName);
      if (targetKind === "gatheritembytags") {
        const primarySource = Array.isArray(item.sourceResources) && item.sourceResources.length > 0
          ? item.sourceResources[0]
          : null;
        const sourceNamePlural = primarySource ? pluralizeName(primarySource.resourceName) : "resource nodes";
        return {
          objective: {
            type: "collect",
            itemId: item.itemId,
            count,
            description: `Gather ${count} ${String(itemPlural).toLowerCase()}`
          },
          tokens: {
            itemName: item.itemName,
            itemNamePlural: itemPlural,
            sourceName: primarySource ? primarySource.resourceName : "resource node",
            sourceNamePlural,
            skillName: capitalizeFirst(primarySource ? primarySource.skillId : ""),
            count,
            distanceScore: Math.max(0, Number(primarySource && primarySource.requiredLevel) || 0) * 18
          },
          summary: `gather ${count} ${String(itemPlural).toLowerCase()} from ${String(sourceNamePlural).toLowerCase()}`,
          rewardUnits: count,
          rewardDistance: Math.max(0, Number(primarySource && primarySource.requiredLevel) || 0) * 18
        };
      }
      const primarySource = Array.isArray(item.sourceMobs) && item.sourceMobs.length > 0 ? item.sourceMobs[0] : null;
      const sourceNamePlural = primarySource ? pluralizeName(primarySource.mobName) : "creatures";
      return {
        objective: {
          type: "collect",
          itemId: item.itemId,
          count,
          description: `Gather ${count} ${String(itemPlural).toLowerCase()}`
        },
        tokens: {
          itemName: item.itemName,
          itemNamePlural: itemPlural,
          sourceName: primarySource ? primarySource.mobName : "monsters",
          sourceNamePlural,
          count,
          distanceScore: primarySource
            ? Math.round((Number(primarySource.spawnRangeMin) + Number(primarySource.spawnRangeMax)) * 0.5)
            : 0
        },
        summary: `gather ${count} ${String(itemPlural).toLowerCase()} from ${String(sourceNamePlural).toLowerCase()}`,
        rewardUnits: count,
        rewardDistance: primarySource
          ? Math.round((Number(primarySource.spawnRangeMin) + Number(primarySource.spawnRangeMax)) * 0.5)
          : 0
      };
    }

    if (type === "explore") {
      const candidates = registry.findRegions({
        tagsAll: target.tagsAll,
        tagsAny: target.tagsAny,
        tagsNone: target.tagsNone
      }).filter((entry) => !usedSelections.regionIds.has(entry.id));
      const townAnchor = registry.getTownAnchor();
      const region = chooseCandidate(rng, candidates, (entry) => {
        return Math.hypot(Number(entry.x) - Number(townAnchor.x), Number(entry.y) - Number(townAnchor.y));
      });
      if (!region) {
        return null;
      }
      usedSelections.regionIds.add(region.id);
      return {
        objective: {
          type: "explore",
          x: region.x,
          y: region.y,
          radius: Math.max(4, Number(region.radius) || 16),
          description: `Scout ${region.name} at (${region.x}, ${region.y})`
        },
        tokens: {
          regionName: region.name,
          targetX: region.x,
          targetY: region.y,
          distanceScore: Math.round(Math.hypot(Number(region.x) - Number(townAnchor.x), Number(region.y) - Number(townAnchor.y)))
        },
        summary: `scout ${region.name} at (${region.x}, ${region.y})`,
        rewardUnits: 1,
        rewardDistance: Math.round(Math.hypot(Number(region.x) - Number(townAnchor.x), Number(region.y) - Number(townAnchor.y)))
      };
    }

    return null;
  }

  function aggregateQuestRewards(template, selections) {
    const rewards = template && template.rewards && typeof template.rewards === "object" ? template.rewards : {};
    const totalUnits = selections.reduce((sum, entry) => sum + Math.max(0, Number(entry.rewardUnits) || 0), 0);
    const maxDistance = selections.reduce((max, entry) => Math.max(max, Math.max(0, Number(entry.rewardDistance) || 0)), 0);
    const exp = Math.max(
      10,
      Math.round(
        (Number(rewards.baseExp) || 0) +
        totalUnits * (Number(rewards.expPerTarget) || 0) +
        maxDistance * (Number(rewards.distanceExpFactor) || 0)
      )
    );
    return {
      exp,
      items: Array.isArray(rewards.items) ? rewards.items.map((entry) => ({ ...entry })) : []
    };
  }

  function buildQuestTokens(template, selections) {
    const tokens = {};
    const summaries = selections.map((entry) => entry.summary).filter(Boolean);
    tokens.objectiveSummary = summaries[0] || "";
    tokens.objectiveSummaryCapitalized = capitalizeFirst(tokens.objectiveSummary);
    tokens.objectiveList = formatList(summaries);
    tokens.objectiveListCapitalized = capitalizeFirst(tokens.objectiveList);
    selections.forEach((selection, index) => {
      const prefix = index === 0 ? "primary" : index === 1 ? "secondary" : `objective${index + 1}`;
      for (const [key, value] of Object.entries(selection.tokens || {})) {
        const tokenKey = `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        tokens[tokenKey] = value;
        if (index === 0 && !tokens[key]) {
          tokens[key] = value;
        }
      }
    });
    return tokens;
  }

  function buildOfferDialogue(quest, tokens, rng) {
    const textConfig = quest && quest.textConfig && typeof quest.textConfig === "object" ? quest.textConfig : {};
    const intro = interpolateText(
      pickVariant(rng, textConfig.offerIntroVariants, "I have work for you."),
      tokens
    );
    const detail = interpolateText(
      pickVariant(rng, textConfig.offerDetailVariants, "I need you to {objectiveSummary}."),
      tokens
    );
    const accept = interpolateText(
      pickVariant(rng, textConfig.acceptVariants, "Return when the work is done."),
      tokens
    );
    return [
      {
        id: "start",
        text: intro,
        speaker: "Town Herald",
        choices: [
          { text: "Tell me more", next: "details" },
          { text: "I'll handle it.", next: "accept" },
          { text: "Maybe later.", next: "decline" }
        ]
      },
      {
        id: "details",
        text: detail,
        speaker: "Town Herald",
        choices: [
          { text: "I'm in.", next: "accept" },
          { text: "Not right now.", next: "decline" }
        ]
      },
      {
        id: "accept",
        text: accept,
        speaker: "Town Herald",
        questStart: true,
        questId: quest.id
      },
      {
        id: "decline",
        text: "Very well. Return if you change your mind.",
        speaker: "Town Herald"
      }
    ];
  }

  function buildQuestDefinitionFromTemplate(player, npcId, template, serial) {
    if (!template || normalizeText(template.npcGiverId) !== normalizeText(npcId)) {
      return null;
    }
    const playerLevel = Math.max(1, Number(player && player.level) || 1);
    if (playerLevel < Math.max(1, Number(template.minLevel) || 1)) {
      return null;
    }

    const rng = createSeededRng(`${player && player.id}:${npcId}:${template.id}:${serial}`);
    const usedSelections = {
      mobIds: new Set(),
      itemIds: new Set(),
      regionIds: new Set()
    };
    const objectiveSpecs = Array.isArray(template.objectives) ? template.objectives : [];
    const selections = [];
    for (const objectiveSpec of objectiveSpecs) {
      const selection = buildObjectiveSelection(player, template, objectiveSpec, rng, usedSelections);
      if (!selection) {
        return null;
      }
      selections.push(selection);
    }
    if (!selections.length) {
      return null;
    }

    const tokens = buildQuestTokens(template, selections);
    const title = interpolateText(
      pickVariant(rng, template.text && template.text.titleVariants, "Field Assignment"),
      tokens
    );
    const description = interpolateText(
      pickVariant(rng, template.text && template.text.offerDetailVariants, "I need you to {objectiveSummary}."),
      tokens
    );
    const questId = `proc_${slugify(npcId)}_${slugify(template.id)}_${serial}`;
    const rewards = aggregateQuestRewards(template, selections);
    const inProgressText = interpolateText(
      pickVariant(rng, template.text && template.text.inProgressVariants, "You still need to {objectiveSummary}."),
      tokens
    );
    const completeText = interpolateText(
      pickVariant(rng, template.text && template.text.completeVariants, "Good work."),
      tokens
    );

    const quest = {
      id: questId,
      templateId: String(template.id || ""),
      generated: true,
      repeatable: template.repeatable !== false,
      minLevel: Math.max(1, Number(template.minLevel) || 1),
      npcGiverId: String(template.npcGiverId || npcId),
      npcCompleteId: String(template.npcCompleteId || npcId),
      title,
      description,
      objectives: selections.map((entry) => ({ ...entry.objective })),
      rewards,
      textConfig: template.text || {},
      dialogue: {
        offer: [],
        inProgress: [
          {
            id: "in_progress",
            text: inProgressText,
            speaker: "Town Herald"
          }
        ],
        complete: [
          {
            id: "complete",
            text: completeText,
            speaker: "Town Herald",
            questComplete: true,
            questId
          }
        ]
      }
    };
    quest.dialogue.offer = buildOfferDialogue(quest, tokens, rng);
    return quest;
  }

  function getAvailableQuestsForNpc(player, npcId) {
    const generated = getPlayerGeneratedState(player);
    if (!generated) {
      return [];
    }
    const normalizedNpcId = normalizeText(npcId);
    if (!normalizedNpcId) {
      return [];
    }

    const existingOffers = getOfferIdsForNpc(generated, normalizedNpcId)
      .map((questId) => generated.definitions[questId])
      .filter(Boolean);
    const maxOffers = getMaxOffersPerNpc();
    if (existingOffers.length >= maxOffers) {
      return existingOffers.slice(0, maxOffers);
    }

    const templates = getTemplateDefs().filter((entry) => normalizeText(entry && entry.npcGiverId) === normalizedNpcId);
    if (!templates.length) {
      return existingOffers;
    }

    const activeTemplateIds = getActiveTemplateIds(player);
    const offeredTemplateIds = new Set(existingOffers.map((entry) => String(entry && entry.templateId || "")));
    let serial = generated.nextQuestSerial;
    let attempts = 0;
    while (existingOffers.length < maxOffers && attempts < templates.length * 3) {
      const template = templates[(serial - 1) % templates.length];
      attempts += 1;
      serial += 1;
      if (!template || activeTemplateIds.has(String(template.id || "")) || offeredTemplateIds.has(String(template.id || ""))) {
        continue;
      }
      const quest = buildQuestDefinitionFromTemplate(player, normalizedNpcId, template, serial - 1);
      if (!quest) {
        continue;
      }
      existingOffers.push(quest);
      offeredTemplateIds.add(String(quest.templateId || ""));
      generated.definitions[quest.id] = quest;
    }
    generated.offersByNpc[normalizedNpcId] = existingOffers.map((entry) => entry.id);
    generated.nextQuestSerial = serial;
    return existingOffers;
  }

  function markQuestAccepted(player, questId) {
    const generated = getPlayerGeneratedState(player);
    if (!generated) {
      return;
    }
    const normalizedQuestId = normalizeText(questId);
    if (!normalizedQuestId) {
      return;
    }
    for (const [npcId, questIds] of Object.entries(generated.offersByNpc)) {
      if (!Array.isArray(questIds)) {
        continue;
      }
      const nextIds = questIds.filter((entry) => normalizeText(entry) !== normalizedQuestId);
      if (nextIds.length > 0) {
        generated.offersByNpc[npcId] = nextIds;
      } else {
        delete generated.offersByNpc[npcId];
      }
    }
  }

  function recordGeneratedCompletion(player, quest) {
    const generated = getPlayerGeneratedState(player);
    if (!generated || !quest || !quest.templateId) {
      return;
    }
    const templateId = String(quest.templateId || "");
    generated.completedTemplates[templateId] = countTemplateCompletions(player, templateId) + 1;
  }

  return {
    loadTemplateData,
    getTemplateDefs,
    getGeneratedQuestById,
    getAvailableQuestsForNpc,
    markQuestAccepted,
    recordGeneratedCompletion
  };
}

module.exports = { createProceduralQuestTools };
