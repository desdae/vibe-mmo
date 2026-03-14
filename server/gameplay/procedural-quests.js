const fs = require("fs");
const path = require("path");

/*
Data model

Template:
{
  id,
  npcGiverId,
  npcCompleteId,
  repeatable,
  minLevel,
  objective: {
    type: "kill" | "explore",
    countRange?,
    distanceRange?,
    radius?,
    targetSource?
  },
  rewards: {
    baseExp,
    expPerTarget?,
    distanceExpFactor?
  },
  text: {
    titleVariants,
    offerIntroVariants,
    offerDetailVariants,
    acceptVariants,
    inProgressVariants,
    completeVariants
  }
}

Generated quest definition:
{
  id,
  templateId,
  generated: true,
  repeatable,
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
*/

function createProceduralQuestTools(options = {}) {
  const townLayout = options.townLayout || null;
  const mapWidth = Math.max(64, Math.floor(Number(options.mapWidth) || 1000));
  const mapHeight = Math.max(64, Math.floor(Number(options.mapHeight) || 1000));
  const mobConfigProvider =
    typeof options.mobConfigProvider === "function" ? options.mobConfigProvider : () => null;
  const templateDataPath = options.templateDataPath
    ? path.resolve(String(options.templateDataPath))
    : path.resolve(__dirname, "../../data/quest-templates.json");

  let loadedTemplateData = null;

  function loadTemplateData() {
    if (loadedTemplateData) {
      return loadedTemplateData;
    }
    try {
      const raw = fs.readFileSync(templateDataPath, "utf8");
      loadedTemplateData = JSON.parse(raw);
    } catch (error) {
      console.error("[procedural-quests] Failed to load quest templates:", error.message);
      loadedTemplateData = { templates: [] };
    }
    return loadedTemplateData;
  }

  function getTemplateDefs() {
    const data = loadTemplateData();
    return Array.isArray(data.templates) ? data.templates : [];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hashString(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
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

  function pickVariant(rng, variants, fallback) {
    const list = Array.isArray(variants) ? variants.filter(Boolean) : [];
    if (!list.length) {
      return String(fallback || "");
    }
    const index = clamp(Math.floor(rng() * list.length), 0, list.length - 1);
    return String(list[index] || fallback || "");
  }

  function interpolateText(text, tokens) {
    return String(text || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      if (!tokens || !Object.prototype.hasOwnProperty.call(tokens, key)) {
        return "";
      }
      return String(tokens[key]);
    });
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "quest";
  }

  function pluralizeName(value) {
    const text = String(value || "").trim();
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

  function toObjectiveKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getNpcPosition(npcId) {
    const normalizedId = String(npcId || "").trim();
    if (!normalizedId || !townLayout) {
      return null;
    }
    if (townLayout.vendor && String(townLayout.vendor.id || "") === normalizedId) {
      return {
        x: Number(townLayout.vendor.x) || Math.floor(mapWidth * 0.5),
        y: Number(townLayout.vendor.y) || Math.floor(mapHeight * 0.5)
      };
    }
    if (Array.isArray(townLayout.questGivers)) {
      const questGiver = townLayout.questGivers.find((entry) => String(entry && entry.id || "") === normalizedId);
      if (questGiver) {
        return {
          x: Number(questGiver.x) || Math.floor(mapWidth * 0.5),
          y: Number(questGiver.y) || Math.floor(mapHeight * 0.5)
        };
      }
    }
    return {
      x: Number(townLayout.centerTileX) || Math.floor(mapWidth * 0.5),
      y: Number(townLayout.centerTileY) || Math.floor(mapHeight * 0.5)
    };
  }

  function getPlayerGeneratedState(player) {
    if (!player) {
      return null;
    }
    if (!player.questState) {
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

  function getMobCatalog() {
    const mobConfig = mobConfigProvider();
    if (!mobConfig || !Array.isArray(mobConfig.clusterDefs)) {
      return [];
    }
    const byName = new Map();
    for (const cluster of mobConfig.clusterDefs) {
      const members = Array.isArray(cluster && cluster.members) ? cluster.members : [];
      for (const mobDef of members) {
        const name = String(mobDef && mobDef.name || "").trim();
        if (!name) {
          continue;
        }
        const existing = byName.get(name) || {
          name,
          objectiveKey: toObjectiveKey(name),
          spawnRangeMin: Number(cluster.spawnRangeMin) || 0,
          spawnRangeMax: Number(cluster.spawnRangeMax) || 0,
          health: Number(mobDef.health) || 1,
          damageMax: Number(mobDef.damageMax) || 1
        };
        existing.spawnRangeMin = Math.min(existing.spawnRangeMin, Number(cluster.spawnRangeMin) || existing.spawnRangeMin);
        existing.spawnRangeMax = Math.max(existing.spawnRangeMax, Number(cluster.spawnRangeMax) || existing.spawnRangeMax);
        existing.health = Math.max(existing.health, Number(mobDef.health) || existing.health);
        existing.damageMax = Math.max(existing.damageMax, Number(mobDef.damageMax) || existing.damageMax);
        byName.set(name, existing);
      }
    }
    return Array.from(byName.values()).sort((left, right) => {
      const leftMid = (left.spawnRangeMin + left.spawnRangeMax) * 0.5;
      const rightMid = (right.spawnRangeMin + right.spawnRangeMax) * 0.5;
      return leftMid - rightMid;
    });
  }

  function buildDialogue(textConfig, tokens, questStart, questComplete) {
    return [
      {
        id: "start",
        text: interpolateText(textConfig.offerIntro, tokens),
        speaker: "Town Herald",
        choices: [
          { text: "Tell me more", next: "details" },
          { text: "I'll handle it.", next: "accept" },
          { text: "Maybe later.", next: "decline" }
        ]
      },
      {
        id: "details",
        text: interpolateText(textConfig.offerDetail, tokens),
        speaker: "Town Herald",
        choices: [
          { text: "I'm on it.", next: "accept" },
          { text: "Not right now.", next: "decline" }
        ]
      },
      {
        id: "accept",
        text: interpolateText(textConfig.accept, tokens),
        speaker: "Town Herald",
        questStart: !!questStart
      },
      {
        id: "decline",
        text: "Very well. Return if you change your mind.",
        speaker: "Town Herald"
      }
    ];
  }

  function buildKillQuestDefinition(player, npcId, template, serial) {
    const objectiveConfig = template && template.objective && typeof template.objective === "object" ? template.objective : {};
    const rewardConfig = template && template.rewards && typeof template.rewards === "object" ? template.rewards : {};
    const textConfig = template && template.text && typeof template.text === "object" ? template.text : {};
    const maxSpawnRange = Math.max(50, Number(objectiveConfig.targetSource && objectiveConfig.targetSource.maxSpawnRange) || 240);
    const playerLevel = Math.max(1, Number(player && player.level) || 1);
    const desiredDistance = clamp(80 + playerLevel * 24, 80, maxSpawnRange);
    const candidates = getMobCatalog().filter((entry) => Number(entry.spawnRangeMin) <= maxSpawnRange);
    if (!candidates.length) {
      return null;
    }
    const ranked = candidates
      .map((entry) => ({
        entry,
        score:
          Math.abs(((Number(entry.spawnRangeMin) + Number(entry.spawnRangeMax)) * 0.5) - desiredDistance) +
          Number(entry.health || 1) * 0.2 +
          Number(entry.damageMax || 1) * 3
      }))
      .sort((left, right) => left.score - right.score)
      .slice(0, 4);
    if (!ranked.length) {
      return null;
    }
    const rng = createSeededRng(`${player && player.id}:${npcId}:${template.id}:${serial}`);
    const target = ranked[clamp(Math.floor(rng() * ranked.length), 0, ranked.length - 1)].entry;
    const countRange = Array.isArray(objectiveConfig.countRange) ? objectiveConfig.countRange : [3, 5];
    const minCount = Math.max(1, Math.floor(Number(countRange[0]) || 1));
    const maxCount = Math.max(minCount, Math.floor(Number(countRange[1]) || minCount));
    const count = clamp(minCount + Math.floor(rng() * (maxCount - minCount + 1)), minCount, maxCount);
    const distanceMid = (Number(target.spawnRangeMin) + Number(target.spawnRangeMax)) * 0.5;
    const expReward =
      Math.max(
        10,
        Math.round(
          (Number(rewardConfig.baseExp) || 0) +
          count * (Number(rewardConfig.expPerTarget) || 0) +
          distanceMid * (Number(rewardConfig.distanceExpFactor) || 0)
        )
      );
    const targetNamePlural = pluralizeName(target.name);
    const tokens = {
      count,
      targetName: target.name,
      targetNamePlural
    };
    const questId = `proc_${slugify(npcId)}_${slugify(template.id)}_${serial}`;
    return {
      id: questId,
      templateId: String(template.id || ""),
      generated: true,
      repeatable: template.repeatable !== false,
      minLevel: template.minLevel || 1,
      npcGiverId: String(template.npcGiverId || npcId),
      npcCompleteId: String(template.npcCompleteId || npcId),
      title: interpolateText(pickVariant(rng, textConfig.titleVariants, "Hunt {targetNamePlural}"), tokens),
      description: interpolateText(
        pickVariant(
          rng,
          textConfig.offerDetailVariants,
          "Hunt down {count} {targetNamePlural} threatening the roads near town."
        ),
        tokens
      ),
      objectives: [
        {
          type: "kill",
          mobId: target.name,
          count,
          description: `Kill ${count} ${String(targetNamePlural).toLowerCase()}`
        }
      ],
      rewards: {
        exp: expReward
      },
      dialogue: {
        offer: buildDialogue(
          {
            offerIntro: pickVariant(rng, textConfig.offerIntroVariants, "I need help dealing with {targetNamePlural}."),
            offerDetail: pickVariant(
              rng,
              textConfig.offerDetailVariants,
              "Hunt down {count} {targetNamePlural} threatening the roads near town."
            ),
            accept: pickVariant(rng, textConfig.acceptVariants, "Return when the job is done.")
          },
          tokens,
          true,
          false
        ),
        inProgress: [
          {
            id: "in_progress",
            text: interpolateText(
              pickVariant(rng, textConfig.inProgressVariants, "You still have work to finish."),
              tokens
            ),
            speaker: "Town Herald"
          }
        ],
        complete: [
          {
            id: "complete",
            text: interpolateText(
              pickVariant(rng, textConfig.completeVariants, "You've done the town a service."),
              tokens
            ),
            speaker: "Town Herald",
            questComplete: true
          }
        ]
      }
    };
  }

  function buildExploreQuestDefinition(player, npcId, template, serial) {
    const objectiveConfig = template && template.objective && typeof template.objective === "object" ? template.objective : {};
    const rewardConfig = template && template.rewards && typeof template.rewards === "object" ? template.rewards : {};
    const textConfig = template && template.text && typeof template.text === "object" ? template.text : {};
    const anchor = getNpcPosition(npcId);
    if (!anchor) {
      return null;
    }
    const distanceRange = Array.isArray(objectiveConfig.distanceRange) ? objectiveConfig.distanceRange : [80, 200];
    const minDistance = Math.max(40, Math.floor(Number(distanceRange[0]) || 80));
    const maxDistance = Math.max(minDistance, Math.floor(Number(distanceRange[1]) || minDistance));
    const radius = Math.max(6, Math.floor(Number(objectiveConfig.radius) || 16));
    const serialSeed = `${player && player.id}:${npcId}:${template.id}:${serial}`;
    const rng = createSeededRng(serialSeed);
    const directions = [
      { name: "northern approach", dx: 0, dy: -1 },
      { name: "eastern road", dx: 1, dy: 0 },
      { name: "southern outskirts", dx: 0, dy: 1 },
      { name: "western path", dx: -1, dy: 0 },
      { name: "northeastern rise", dx: 0.8, dy: -0.8 },
      { name: "northwestern ridge", dx: -0.8, dy: -0.8 }
    ];
    const direction = directions[clamp(Math.floor(rng() * directions.length), 0, directions.length - 1)];
    const distance = clamp(minDistance + Math.floor(rng() * (maxDistance - minDistance + 1)), minDistance, maxDistance);
    const targetX = clamp(Math.round(anchor.x + direction.dx * distance), 12, mapWidth - 12);
    const targetY = clamp(Math.round(anchor.y + direction.dy * distance), 12, mapHeight - 12);
    const expReward = Math.max(
      10,
      Math.round((Number(rewardConfig.baseExp) || 0) + distance * (Number(rewardConfig.distanceExpFactor) || 0))
    );
    const tokens = {
      regionName: direction.name,
      targetX,
      targetY
    };
    const questId = `proc_${slugify(npcId)}_${slugify(template.id)}_${serial}`;
    return {
      id: questId,
      templateId: String(template.id || ""),
      generated: true,
      repeatable: template.repeatable !== false,
      minLevel: template.minLevel || 1,
      npcGiverId: String(template.npcGiverId || npcId),
      npcCompleteId: String(template.npcCompleteId || npcId),
      title: interpolateText(pickVariant(rng, textConfig.titleVariants, "Scout the {regionName}"), tokens),
      description: interpolateText(
        pickVariant(
          rng,
          textConfig.offerDetailVariants,
          "Travel to ({targetX}, {targetY}) and survey the area."
        ),
        tokens
      ),
      objectives: [
        {
          type: "explore",
          x: targetX,
          y: targetY,
          radius,
          description: `Scout the marked location at (${targetX}, ${targetY})`
        }
      ],
      rewards: {
        exp: expReward
      },
      dialogue: {
        offer: buildDialogue(
          {
            offerIntro: pickVariant(rng, textConfig.offerIntroVariants, "I need someone to scout the {regionName}."),
            offerDetail: pickVariant(
              rng,
              textConfig.offerDetailVariants,
              "Travel to ({targetX}, {targetY}) and survey the area."
            ),
            accept: pickVariant(rng, textConfig.acceptVariants, "Go there and return once the route is clear.")
          },
          tokens,
          true,
          false
        ),
        inProgress: [
          {
            id: "in_progress",
            text: interpolateText(
              pickVariant(rng, textConfig.inProgressVariants, "You still need to scout that location."),
              tokens
            ),
            speaker: "Town Herald"
          }
        ],
        complete: [
          {
            id: "complete",
            text: interpolateText(
              pickVariant(rng, textConfig.completeVariants, "Good work bringing back fresh reconnaissance."),
              tokens
            ),
            speaker: "Town Herald",
            questComplete: true
          }
        ]
      }
    };
  }

  function buildQuestDefinitionFromTemplate(player, npcId, template, serial) {
    if (!template || String(template.npcGiverId || "") !== String(npcId || "")) {
      return null;
    }
    const minLevel = Math.max(1, Number(template.minLevel) || 1);
    const playerLevel = Math.max(1, Number(player && player.level) || 1);
    if (playerLevel < minLevel) {
      return null;
    }
    const objectiveType = String(template.objective && template.objective.type || "").trim().toLowerCase();
    if (objectiveType === "kill") {
      return buildKillQuestDefinition(player, npcId, template, serial);
    }
    if (objectiveType === "explore") {
      return buildExploreQuestDefinition(player, npcId, template, serial);
    }
    return null;
  }

  function getGeneratedQuestById(player, questId) {
    const generated = getPlayerGeneratedState(player);
    if (!generated) {
      return null;
    }
    const id = String(questId || "").trim();
    if (!id) {
      return null;
    }
    const quest = generated.definitions[id];
    return quest && typeof quest === "object" ? quest : null;
  }

  function getOfferIdsForNpc(generatedState, npcId) {
    const ids = generatedState && generatedState.offersByNpc && Array.isArray(generatedState.offersByNpc[npcId])
      ? generatedState.offersByNpc[npcId]
      : [];
    return ids.filter((questId) => generatedState.definitions && generatedState.definitions[questId]);
  }

  function getAvailableQuestsForNpc(player, npcId) {
    const generated = getPlayerGeneratedState(player);
    if (!generated) {
      return [];
    }
    const normalizedNpcId = String(npcId || "").trim();
    if (!normalizedNpcId) {
      return [];
    }
    const existingOfferIds = getOfferIdsForNpc(generated, normalizedNpcId);
    if (existingOfferIds.length > 0) {
      return existingOfferIds.map((questId) => generated.definitions[questId]).filter(Boolean);
    }
    const templates = getTemplateDefs().filter((entry) => String(entry && entry.npcGiverId || "") === normalizedNpcId);
    if (!templates.length) {
      return [];
    }
    const serial = generated.nextQuestSerial;
    const startIndex = (serial - 1) % templates.length;
    for (let offset = 0; offset < templates.length; offset += 1) {
      const template = templates[(startIndex + offset) % templates.length];
      const quest = buildQuestDefinitionFromTemplate(player, normalizedNpcId, template, serial);
      if (!quest) {
        continue;
      }
      generated.definitions[quest.id] = quest;
      generated.offersByNpc[normalizedNpcId] = [quest.id];
      generated.nextQuestSerial = serial + 1;
      return [quest];
    }
    return [];
  }

  function markQuestAccepted(player, questId) {
    const generated = getPlayerGeneratedState(player);
    if (!generated) {
      return;
    }
    const normalizedQuestId = String(questId || "").trim();
    if (!normalizedQuestId) {
      return;
    }
    for (const [npcId, questIds] of Object.entries(generated.offersByNpc)) {
      if (!Array.isArray(questIds)) {
        continue;
      }
      const nextQuestIds = questIds.filter((entry) => String(entry || "") !== normalizedQuestId);
      if (nextQuestIds.length > 0) {
        generated.offersByNpc[npcId] = nextQuestIds;
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
    generated.completedTemplates[templateId] = (Math.max(0, Number(generated.completedTemplates[templateId]) || 0) + 1);
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
