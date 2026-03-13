function createTalentCommandTools(options = {}) {
  const talentSystem = typeof options.talentSystem === "object" ? options.talentSystem : null;
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
  const sendSelfProgress = typeof options.sendSelfProgress === "function" ? options.sendSelfProgress : () => {};
  const sendTalentUpdate = typeof options.sendTalentUpdate === "function" ? options.sendTalentUpdate : () => {};

  if (!talentSystem) {
    return {
      spendTalentPoint: () => ({ success: false, reason: "Talent system not available" }),
      getTalentInfo: () => null,
      getAvailableTalents: () => []
    };
  }

  function getTalentInfo(player, talentId) {
    if (!player || !player.classType) {
      return null;
    }
    return talentSystem.getTalentById(player.classType, talentId);
  }

  function getAvailableTalents(player) {
    if (!player || !player.classType) {
      return [];
    }
    return talentSystem.getAvailableTalents(player.classType, player.talents);
  }

  function spendTalentPoint(player, talentId) {
    console.log('[talent] spendTalentPoint called for:', player.name, 'talent:', talentId);
    if (!player || !player.classType) {
      console.log('[talent] Invalid player');
      return { success: false, reason: "Invalid player" };
    }

    const availablePoints = talentSystem.getAvailableTalentPoints(
      player.classType,
      player.level,
      player.talents
    );
    console.log('[talent] Available points:', availablePoints);

    if (availablePoints <= 0) {
      console.log('[talent] No points available');
      return { success: false, reason: "No talent points available" };
    }

    const result = talentSystem.spendTalentPoint(player.classType, player.talents, talentId);
    console.log('[talent] Talent system result:', result);
    if (!result.success) {
      return result;
    }

    player.talents = result.playerTalents;
    player.talentPoints = talentSystem.getAvailableTalentPoints(
      player.classType,
      player.level,
      player.talents
    );
    console.log('[talent] New talent points:', player.talentPoints);
    console.log('[talent] Sending talent update');

    sendTalentUpdate(player);
    return { success: true, reason: "", talentId, newRank: player.talents[talentId] };
  }

  function getTalentStats(player) {
    if (!player || !player.classType) {
      return {};
    }
    return talentSystem.calculateTalentStats(player.classType, player.talents);
  }

  function getTalentTreeData(player) {
    if (!player || !player.classType) {
      return null;
    }

    const talentTree = talentSystem.getTalentTreeForClass(player.classType);
    if (!talentTree) {
      return null;
    }

    const availablePoints = talentSystem.getAvailableTalentPoints(
      player.classType,
      player.level,
      player.talents
    );

    const totalPoints = talentSystem.getTotalTalentPoints(player.classType, player.level);
    const spentPoints = talentSystem.getSpentTalentPoints(player.talents);

    const talentsWithState = talentTree.talents.map(talent => {
      const talentId = String(talent.id || "").trim().toLowerCase();
      const currentRank = (player.talents && player.talents[talentId]) || 0;
      const maxRank = Math.max(1, Number(talent.maxRank) || 1);

      let prerequisitesMet = true;
      const prerequisites = Array.isArray(talent.prerequisites) ? talent.prerequisites : [];
      for (const prereq of prerequisites) {
        const prereqId = String(prereq.talentId || "").trim().toLowerCase();
        const minRank = Math.max(0, Number(prereq.minRank) || 0);
        const prereqRank = (player.talents && player.talents[prereqId]) || 0;
        if (prereqRank < minRank) {
          prerequisitesMet = false;
          break;
        }
      }

      return {
        ...talent,
        currentRank,
        maxRank,
        canUpgrade: prerequisitesMet && currentRank < maxRank && availablePoints > 0,
        prerequisitesMet
      };
    });

    return {
      className: talentTree.className,
      talents: talentsWithState,
      availablePoints,
      totalPoints,
      spentPoints
    };
  }

  return {
    getTalentInfo,
    getAvailableTalents,
    spendTalentPoint,
    getTalentStats,
    getTalentTreeData
  };
}

module.exports = {
  createTalentCommandTools
};
