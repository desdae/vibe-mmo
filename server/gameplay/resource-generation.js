function createResourceGenerationTools(options = {}) {
  const resourceNodes = options.resourceNodes instanceof Map ? options.resourceNodes : null;
  const allocateResourceNodeId =
    typeof options.allocateResourceNodeId === "function" ? options.allocateResourceNodeId : null;
  const resourceRegistry = options.resourceRegistry || null;
  const biomeResolver = options.biomeResolver || null;
  const skillTools = options.skillTools || null;
  const getToolTierForPlayer =
    typeof options.getToolTierForPlayer === "function" ? options.getToolTierForPlayer : () => 0;
  const addItemsToInventory =
    typeof options.addItemsToInventory === "function"
      ? options.addItemsToInventory
      : () => ({ added: [], leftover: [], changed: false });
  const sendInventoryState =
    typeof options.sendInventoryState === "function" ? options.sendInventoryState : () => {};
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
  const mapWidth = Math.max(64, Math.floor(Number(options.mapWidth) || 1000));
  const mapHeight = Math.max(64, Math.floor(Number(options.mapHeight) || 1000));
  const townLayout = options.townLayout || null;
  const cellSize = Math.max(8, Math.floor(Number(options.cellSize) || 22));
  const familyLimits =
    options.familyLimits && typeof options.familyLimits === "object"
      ? { ...options.familyLimits }
      : { tree: 130, ore_vein: 90 };

  if (!(resourceNodes instanceof Map)) {
    throw new Error("createResourceGenerationTools requires resourceNodes map");
  }
  if (!allocateResourceNodeId) {
    throw new Error("createResourceGenerationTools requires allocateResourceNodeId");
  }
  if (!resourceRegistry || typeof resourceRegistry.getCandidatesForBiome !== "function") {
    throw new Error("createResourceGenerationTools requires resourceRegistry");
  }
  if (!biomeResolver || typeof biomeResolver.resolveBiomeAt !== "function") {
    throw new Error("createResourceGenerationTools requires biomeResolver");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function hashUnit(seedText) {
    const text = String(seedText || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function isPointExcludedByTown(x, y) {
    if (!townLayout || townLayout.enabled === false) {
      return false;
    }
    const padding = 4;
    const px = Number(x) || 0;
    const py = Number(y) || 0;
    return (
      px >= Number(townLayout.minTileX) - padding &&
      px < Number(townLayout.maxTileX) + 1 + padding &&
      py >= Number(townLayout.minTileY) - padding &&
      py < Number(townLayout.maxTileY) + 1 + padding
    );
  }

  function rollQuantity(yieldDef, seedText) {
    const min = Math.max(1, Math.floor(Number(yieldDef && yieldDef.qtyMin) || 1));
    const max = Math.max(min, Math.floor(Number(yieldDef && yieldDef.qtyMax) || min));
    if (max <= min) {
      return min;
    }
    return min + Math.floor(hashUnit(`${seedText}:qty`) * (max - min + 1));
  }

  function rollNodeItems(resourceDef, seedText) {
    const items = [];
    for (const yieldDef of Array.isArray(resourceDef && resourceDef.yields) ? resourceDef.yields : []) {
      const chance = Math.max(0, Math.min(1, Number(yieldDef.chance) || 0));
      if (chance <= 0 || hashUnit(`${seedText}:${yieldDef.itemId}:chance`) > chance) {
        continue;
      }
      items.push({
        itemId: yieldDef.itemId,
        qty: rollQuantity(yieldDef, `${seedText}:${yieldDef.itemId}`),
        name: yieldDef.itemName
      });
    }
    return items;
  }

  function pickCandidateForFamily(biomeInfo, familyId, seedText) {
    const candidates = resourceRegistry.getCandidatesForBiome(biomeInfo, familyId);
    if (!candidates.length) {
      return null;
    }
    const weighted = [];
    let totalWeight = 0;
    for (const candidate of candidates) {
      const familyWeight = Math.max(0.05, Number(biomeInfo && biomeInfo.resourceWeights && biomeInfo.resourceWeights[familyId]) || 0);
      const weight = Math.max(0.01, Number(candidate.spawnWeight) || 1) * Math.max(0.05, familyWeight);
      weighted.push({ candidate, weight });
      totalWeight += weight;
    }
    if (totalWeight <= 0) {
      return weighted[0].candidate;
    }
    let pick = hashUnit(seedText) * totalWeight;
    for (const entry of weighted) {
      pick -= entry.weight;
      if (pick <= 0) {
        return entry.candidate;
      }
    }
    return weighted[weighted.length - 1].candidate;
  }

  function createNodeFromCell(cellX, cellY, familyId, familyIndex) {
    const baseX = cellX * cellSize;
    const baseY = cellY * cellSize;
    const jitterSeed = `${cellX}:${cellY}:${familyId}:${familyIndex}`;
    const centerX = clamp(baseX + cellSize * (0.2 + hashUnit(`${jitterSeed}:x`) * 0.6), 0, mapWidth - 1);
    const centerY = clamp(baseY + cellSize * (0.2 + hashUnit(`${jitterSeed}:y`) * 0.6), 0, mapHeight - 1);
    if (isPointExcludedByTown(centerX, centerY)) {
      return null;
    }
    const biomeInfo = biomeResolver.resolveBiomeAt(centerX, centerY);
    const familyWeight = Math.max(
      0,
      Math.min(1, Number(biomeInfo && biomeInfo.resourceWeights && biomeInfo.resourceWeights[familyId]) || 0)
    );
    if (familyWeight <= 0) {
      return null;
    }
    const candidate = pickCandidateForFamily(biomeInfo, familyId, `${jitterSeed}:candidate`);
    if (!candidate) {
      return null;
    }
    const density = clamp(Number(candidate.density) || 0, 0, 1);
    const presenceChance = density * clamp(0.45 + familyWeight * 0.7, 0, 1);
    if (hashUnit(`${jitterSeed}:presence`) > presenceChance) {
      return null;
    }
    const items = rollNodeItems(candidate, `${jitterSeed}:items`);
    if (!items.length) {
      return null;
    }
    return buildNodeFromCandidate(candidate, centerX, centerY, biomeInfo, items);
  }

  function buildNodeFromCandidate(candidate, x, y, biomeInfo, items) {
    return {
      id: String(allocateResourceNodeId()),
      resourceId: candidate.id,
      name: candidate.name,
      family: candidate.family,
      skillId: candidate.skillId,
      requiredLevel: candidate.requiredLevel,
      requiredToolTier: Math.max(0, Math.floor(Number(candidate.requiredToolTier) || 0)),
      x: Number(x) || 0,
      y: Number(y) || 0,
      interactRange: candidate.interactRange,
      xp: candidate.xp,
      items,
      visual: candidate.visual ? { ...candidate.visual } : {},
      biome: {
        bandId: normalizeId(biomeInfo && biomeInfo.bandId),
        sectorId: normalizeId(biomeInfo && biomeInfo.sectorId),
        primaryBiomeId: normalizeId(biomeInfo && biomeInfo.primaryBiomeId)
      },
      available: true,
      depletedUntil: 0,
      metaVersion: 1,
      respawnSecondsMin: candidate.respawnSecondsMin,
      respawnSecondsMax: candidate.respawnSecondsMax
    };
  }

  function createNodeAtPoint(x, y, familyId, seedSuffix = "manual") {
    const clampedX = clamp(Number(x) || 0, 0, mapWidth - 1);
    const clampedY = clamp(Number(y) || 0, 0, mapHeight - 1);
    if (isPointExcludedByTown(clampedX, clampedY)) {
      return null;
    }
    const biomeInfo = biomeResolver.resolveBiomeAt(clampedX, clampedY);
    const candidate = pickCandidateForFamily(biomeInfo, familyId, `${familyId}:${seedSuffix}:${clampedX}:${clampedY}`);
    if (!candidate) {
      return null;
    }
    const items = rollNodeItems(candidate, `${candidate.id}:${seedSuffix}:${clampedX}:${clampedY}`);
    if (!items.length) {
      return null;
    }
    return buildNodeFromCandidate(candidate, clampedX, clampedY, biomeInfo, items);
  }

  function createSpecificNodeAtPoint(resourceId, x, y, seedSuffix = "manual") {
    const candidate =
      resourceRegistry && typeof resourceRegistry.getResourceDef === "function"
        ? resourceRegistry.getResourceDef(resourceId)
        : null;
    if (!candidate) {
      return null;
    }
    const clampedX = clamp(Number(x) || 0, 0, mapWidth - 1);
    const clampedY = clamp(Number(y) || 0, 0, mapHeight - 1);
    if (isPointExcludedByTown(clampedX, clampedY)) {
      return null;
    }
    const biomeInfo = biomeResolver.resolveBiomeAt(clampedX, clampedY);
    const items = rollNodeItems(candidate, `${candidate.id}:${seedSuffix}:${clampedX}:${clampedY}`);
    if (!items.length) {
      return null;
    }
    return buildNodeFromCandidate(candidate, clampedX, clampedY, biomeInfo, items);
  }

  function hasNearbyFamilyNode(x, y, familyId, maxDistance) {
    const distanceLimit = Math.max(0, Number(maxDistance) || 0);
    for (const node of resourceNodes.values()) {
      if (!node || String(node.family || "") !== String(familyId || "")) {
        continue;
      }
      if (Math.hypot((Number(node.x) || 0) - Number(x || 0), (Number(node.y) || 0) - Number(y || 0)) <= distanceLimit) {
        return true;
      }
    }
    return false;
  }

  function ensureStarterOutskirtsResources() {
    if (!townLayout) {
      return;
    }
    const centerX = Number(townLayout.centerTileX) + 0.5;
    const centerY = Number(townLayout.centerTileY) + 0.5;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
      return;
    }
    const ringDistance = Math.max(
      10,
      Math.max(
        Math.abs((Number(townLayout.maxTileX) || centerX) - centerX),
        Math.abs((Number(townLayout.maxTileY) || centerY) - centerY)
      ) + 6
    );
    const starterNodes = [
      { resourceId: "oak_tree", familyId: "tree", x: centerX - ringDistance, y: centerY - 2 },
      { resourceId: "birch_tree", familyId: "tree", x: centerX + ringDistance, y: centerY + 2 },
      { resourceId: "copper_vein", familyId: "ore_vein", x: centerX + ringDistance, y: centerY - 3 },
      { resourceId: "copper_vein", familyId: "ore_vein", x: centerX - ringDistance, y: centerY + 3 }
    ];
    for (let index = 0; index < starterNodes.length; index += 1) {
      const entry = starterNodes[index];
      if (hasNearbyFamilyNode(entry.x, entry.y, entry.familyId, 7)) {
        continue;
      }
      const node = createSpecificNodeAtPoint(entry.resourceId, entry.x, entry.y, `starter:${entry.resourceId}:${index}`);
      if (node) {
        resourceNodes.set(node.id, node);
      }
    }
  }

  function initializeResourceNodes() {
    resourceNodes.clear();
    const familyCounts = {};
    for (let cellY = 0; cellY * cellSize < mapHeight; cellY += 1) {
      for (let cellX = 0; cellX * cellSize < mapWidth; cellX += 1) {
        for (const familyId of ["tree", "ore_vein"]) {
          familyCounts[familyId] = Math.max(0, Math.floor(Number(familyCounts[familyId]) || 0));
          if (familyCounts[familyId] >= Math.max(0, Math.floor(Number(familyLimits[familyId]) || 0))) {
            continue;
          }
          const node = createNodeFromCell(cellX, cellY, familyId, familyCounts[familyId]);
          if (!node) {
            continue;
          }
          resourceNodes.set(node.id, node);
          familyCounts[familyId] += 1;
        }
      }
    }
    ensureStarterOutskirtsResources();
    const finalFamilyCounts = {};
    for (const node of resourceNodes.values()) {
      const familyId = String(node.family || "");
      finalFamilyCounts[familyId] = (Number(finalFamilyCounts[familyId]) || 0) + 1;
    }
    return {
      total: resourceNodes.size,
      families: { ...finalFamilyCounts }
    };
  }

  function getVisibleResourceNodesForPlayer(player, inVisibilityRange, extents = null) {
    const visible = [];
    for (const node of resourceNodes.values()) {
      if (!node || !node.available) {
        continue;
      }
      if (
        typeof inVisibilityRange === "function" &&
        !inVisibilityRange(player, node, extents && typeof extents === "object" ? extents : undefined)
      ) {
        continue;
      }
      visible.push(node);
    }
    return visible;
  }

  function serializeResourceNode(node) {
    if (!node) {
      return null;
    }
    return {
      id: String(node.id || ""),
      resourceId: String(node.resourceId || ""),
      name: String(node.name || "Resource"),
      family: String(node.family || ""),
      skillId: String(node.skillId || ""),
      requiredLevel: Math.max(1, Math.floor(Number(node.requiredLevel) || 1)),
      requiredToolTier: Math.max(0, Math.floor(Number(node.requiredToolTier) || 0)),
      x: Number(node.x) || 0,
      y: Number(node.y) || 0,
      interactRange: Math.max(0.5, Number(node.interactRange) || 1.75),
      visual: node.visual && typeof node.visual === "object" ? { ...node.visual } : {},
      biome: node.biome && typeof node.biome === "object" ? { ...node.biome } : {},
      items: Array.isArray(node.items) ? node.items.map((entry) => ({ ...entry })) : []
    };
  }

  function findResourceNodeForInteraction(player, target) {
    if (!player) {
      return null;
    }
    const targetId = normalizeId(target && target.id);
    let best = null;
    let bestDist = Infinity;
    for (const node of resourceNodes.values()) {
      if (!node || !node.available) {
        continue;
      }
      if (targetId && normalizeId(node.id) !== targetId) {
        continue;
      }
      const dx = Number(node.x) + 0.5 - Number(player.x);
      const dy = Number(node.y) + 0.5 - Number(player.y);
      const dist = Math.hypot(dx, dy);
      if (dist > Math.max(0.5, Number(node.interactRange) || 1.75)) {
        continue;
      }
      const clickScore =
        Number.isFinite(Number(target && target.x)) && Number.isFinite(Number(target && target.y))
          ? Math.hypot(Number(node.x) - Number(target.x), Number(node.y) - Number(target.y))
          : 0;
      const score = dist + clickScore * 0.15;
      if (score < bestDist) {
        bestDist = score;
        best = node;
      }
    }
    return best;
  }

  function interactWithResourceNode(player, target = {}) {
    const node = findResourceNodeForInteraction(player, target);
    if (!node) {
      return { ok: false, message: "You are too far away." };
    }
    const skillLevel =
      skillTools && typeof skillTools.getPlayerSkillLevel === "function"
        ? skillTools.getPlayerSkillLevel(player, node.skillId)
        : 1;
    if (skillLevel < Math.max(1, Number(node.requiredLevel) || 1)) {
      return {
        ok: false,
        message: `${String(node.skillId || "skill")} ${Math.max(1, Number(node.requiredLevel) || 1)} required.`,
        node
      };
    }
    const requiredToolTier = Math.max(0, Math.floor(Number(node.requiredToolTier) || 0));
    if (requiredToolTier > 0) {
      const playerToolTier = Math.max(0, Math.floor(Number(getToolTierForPlayer(player, node.skillId)) || 0));
      if (playerToolTier < requiredToolTier) {
        return {
          ok: false,
          message: `A tier ${requiredToolTier} ${String(node.skillId || "gathering")} tool is required.`,
          node
        };
      }
    }
    const transfer = addItemsToInventory(player, node.items);
    if (!transfer || !Array.isArray(transfer.added) || !transfer.added.length) {
      return {
        ok: false,
        message: "Inventory is full.",
        node
      };
    }
    sendInventoryState(player);
    const skillResult =
      skillTools && typeof skillTools.grantPlayerSkillExp === "function"
        ? skillTools.grantPlayerSkillExp(player, node.skillId, Math.max(1, Number(node.xp) || 1))
        : { changed: false, skill: null, leveledUp: false };
    node.available = false;
    node.metaVersion = (Number(node.metaVersion) || 0) + 1;
    const respawnMin = Math.max(5, Number(node.respawnSecondsMin) || 60);
    const respawnMax = Math.max(respawnMin, Number(node.respawnSecondsMax) || respawnMin);
    const respawnRoll = hashUnit(`${node.id}:${Date.now()}:respawn`);
    node.depletedUntil = Date.now() + Math.round((respawnMin + (respawnMax - respawnMin) * respawnRoll) * 1000);
    sendJson(player.ws, {
      type: "resource_gathered",
      nodeId: node.id,
      resourceId: node.resourceId,
      resourceName: node.name,
      itemsGained: transfer.added,
      skill: skillResult && skillResult.skill ? { ...skillResult.skill } : null,
      leveledUp: !!(skillResult && skillResult.leveledUp)
    });
    return {
      ok: true,
      node,
      itemsGained: transfer.added,
      skill: skillResult && skillResult.skill ? { ...skillResult.skill } : null,
      leveledUp: !!(skillResult && skillResult.leveledUp)
    };
  }

  function tickResourceNodes(now = Date.now()) {
    for (const node of resourceNodes.values()) {
      if (!node || node.available || Number(node.depletedUntil) > now) {
        continue;
      }
      node.available = true;
      node.depletedUntil = 0;
      node.metaVersion = (Number(node.metaVersion) || 0) + 1;
    }
  }

  return {
    initializeResourceNodes,
    getVisibleResourceNodesForPlayer,
    serializeResourceNode,
    findResourceNodeForInteraction,
    interactWithResourceNode,
    tickResourceNodes
  };
}

module.exports = {
  createResourceGenerationTools
};
