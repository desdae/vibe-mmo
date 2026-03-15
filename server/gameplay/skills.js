const fs = require("fs");
const path = require("path");

function createSkillTools(options = {}) {
  const skillDataPath = options.skillDataPath
    ? path.resolve(String(options.skillDataPath))
    : path.resolve(__dirname, "../../data/skills.json");
  const sendSelfProgress = typeof options.sendSelfProgress === "function" ? options.sendSelfProgress : null;
  let loadedData = null;

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function loadSkillData() {
    if (loadedData) {
      return loadedData;
    }
    try {
      loadedData = JSON.parse(fs.readFileSync(skillDataPath, "utf8"));
    } catch (error) {
      console.error("[skills] Failed to load skills data:", error.message);
      loadedData = { xpCurves: {}, skills: [] };
    }
    return loadedData;
  }

  function getSkillDefs() {
    const data = loadSkillData();
    return Array.isArray(data.skills) ? data.skills : [];
  }

  function getSkillDef(skillId) {
    const normalizedId = normalizeId(skillId);
    return getSkillDefs().find((entry) => normalizeId(entry && entry.id) === normalizedId) || null;
  }

  function getCurveDef(curveId) {
    const data = loadSkillData();
    const curveMap = data && data.xpCurves && typeof data.xpCurves === "object" ? data.xpCurves : {};
    return curveMap[normalizeId(curveId)] || null;
  }

  function expNeededForSkillLevel(skillDef, level) {
    const curve = getCurveDef(skillDef && skillDef.curveId) || {};
    const baseExpToNext = Math.max(1, Number(curve.baseExpToNext) || 25);
    const growthFactor = Math.max(1, Number(curve.growthFactor) || 1.15);
    return Math.max(1, Math.ceil(baseExpToNext * Math.pow(growthFactor, Math.max(0, Number(level) - 1))));
  }

  function ensurePlayerSkillsState(player) {
    if (!player || typeof player !== "object") {
      return {};
    }
    if (!player.skills || typeof player.skills !== "object") {
      player.skills = {};
    }
    for (const skillDef of getSkillDefs()) {
      const skillId = normalizeId(skillDef && skillDef.id);
      if (!skillId) {
        continue;
      }
      const existing = player.skills[skillId];
      const level = Math.max(1, Math.floor(Number(existing && existing.level) || 1));
      player.skills[skillId] = {
        level,
        exp: Math.max(0, Math.floor(Number(existing && existing.exp) || 0)),
        expToNext: Math.max(1, Math.floor(Number(existing && existing.expToNext) || expNeededForSkillLevel(skillDef, level)))
      };
    }
    return player.skills;
  }

  function getPlayerSkillState(player, skillId) {
    const state = ensurePlayerSkillsState(player);
    return state[normalizeId(skillId)] || null;
  }

  function getPlayerSkillLevel(player, skillId) {
    const state = getPlayerSkillState(player, skillId);
    return state ? Math.max(1, Math.floor(Number(state.level) || 1)) : 1;
  }

  function serializePlayerSkills(player) {
    const state = ensurePlayerSkillsState(player);
    return getSkillDefs()
      .map((skillDef) => {
        const skillId = normalizeId(skillDef && skillDef.id);
        const skillState = state[skillId];
        if (!skillId || !skillState) {
          return null;
        }
        return {
          id: skillId,
          name: String(skillDef.name || skillId),
          category: String(skillDef.category || ""),
          level: Math.max(1, Math.floor(Number(skillState.level) || 1)),
          exp: Math.max(0, Math.floor(Number(skillState.exp) || 0)),
          expToNext: Math.max(1, Math.floor(Number(skillState.expToNext) || 1))
        };
      })
      .filter(Boolean);
  }

  function grantPlayerSkillExp(player, skillId, amount) {
    const skillDef = getSkillDef(skillId);
    if (!player || !skillDef || amount <= 0) {
      return { changed: false, leveledUp: false, skill: null };
    }
    const state = getPlayerSkillState(player, skillId);
    const curve = getCurveDef(skillDef.curveId) || {};
    const maxLevel = Math.max(1, Math.floor(Number(curve.maxLevel) || 100));
    if (!state) {
      return { changed: false, leveledUp: false, skill: null };
    }
    state.exp += Math.max(0, Math.floor(Number(amount) || 0));
    let leveledUp = false;
    while (state.level < maxLevel && state.exp >= state.expToNext) {
      state.exp -= state.expToNext;
      state.level += 1;
      state.expToNext = expNeededForSkillLevel(skillDef, state.level);
      leveledUp = true;
    }
    if (sendSelfProgress) {
      sendSelfProgress(player);
    }
    return {
      changed: true,
      leveledUp,
      skill: {
        id: normalizeId(skillDef.id),
        level: state.level,
        exp: state.exp,
        expToNext: state.expToNext
      }
    };
  }

  return {
    loadSkillData,
    getSkillDefs,
    getSkillDef,
    getCurveDef,
    expNeededForSkillLevel,
    ensurePlayerSkillsState,
    getPlayerSkillState,
    getPlayerSkillLevel,
    serializePlayerSkills,
    grantPlayerSkillExp
  };
}

module.exports = {
  createSkillTools
};
