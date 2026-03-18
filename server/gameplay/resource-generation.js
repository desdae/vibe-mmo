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
  const sendSelfProgress =
    typeof options.sendSelfProgress === "function" ? options.sendSelfProgress : () => {};
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
  const mapWidth = Math.max(64, Math.floor(Number(options.mapWidth) || 1000));
  const mapHeight = Math.max(64, Math.floor(Number(options.mapHeight) || 1000));
  const townLayout = options.townLayout || null;
  const cellSize = Math.max(8, Math.floor(Number(options.cellSize) || 22));
  const mapArea = mapWidth * mapHeight;
  const defaultFamilyLimits = {
    tree: Math.max(220, Math.round(mapArea / 2400)),
    ore_vein: Math.max(150, Math.round(mapArea / 3400))
  };
  const familyLimits =
    options.familyLimits && typeof options.familyLimits === "object"
      ? { ...options.familyLimits }
      : defaultFamilyLimits;
  const familyMinSpacing =
    options.familyMinSpacing && typeof options.familyMinSpacing === "object"
      ? { ...options.familyMinSpacing }
      : {
          tree: Math.max(6, Math.round(cellSize * 0.42)),
          ore_vein: Math.max(8, Math.round(cellSize * 0.5))
        };
  const placementAttemptsPerTarget = Math.max(
    3,
    Math.floor(Number(options.placementAttemptsPerTarget) || 12)
  );

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

  function normalizeAngleDeg(angleDeg) {
    let angle = Number(angleDeg) || 0;
    while (angle < 0) {
      angle += 360;
    }
    while (angle >= 360) {
      angle -= 360;
    }
    return angle;
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

  function isPointWithinMap(x, y) {
    const px = Number(x);
    const py = Number(y);
    return Number.isFinite(px) && Number.isFinite(py) && px >= 0 && px < mapWidth && py >= 0 && py < mapHeight;
  }

  function getMapRadiusLimit(origin) {
    const corners = [
      { x: 0, y: 0 },
      { x: mapWidth - 1, y: 0 },
      { x: 0, y: mapHeight - 1 },
      { x: mapWidth - 1, y: mapHeight - 1 }
    ];
    let maxDistance = 0;
    for (const corner of corners) {
      maxDistance = Math.max(
        maxDistance,
        Math.hypot((Number(corner.x) || 0) - Number(origin && origin.x), (Number(corner.y) || 0) - Number(origin && origin.y))
      );
    }
    return Math.max(1, maxDistance);
  }

  function getSectorSpanDeg(sector) {
    const min = normalizeAngleDeg(Number(sector && sector.angleMinDeg) || 0);
    const max = normalizeAngleDeg(Number(sector && sector.angleMaxDeg) || 0);
    const span = (max - min + 360) % 360;
    return {
      min,
      span: span <= 0 ? 360 : span
    };
  }

  function pointFromPolar(origin, radius, angleDeg) {
    const radians = ((Number(angleDeg) || 0) - 90) * (Math.PI / 180);
    return {
      x: Number(origin && origin.x) + Math.cos(radians) * Number(radius || 0),
      y: Number(origin && origin.y) + Math.sin(radians) * Number(radius || 0)
    };
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
      const densityWeight = Math.max(0.05, Number(candidate.density) || 0);
      const weight =
        Math.max(0.01, Number(candidate.spawnWeight) || 1) *
        Math.max(0.05, familyWeight) *
        densityWeight;
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

  function getGenerationRegions() {
    const origin =
      biomeResolver && typeof biomeResolver.getOrigin === "function"
        ? biomeResolver.getOrigin()
        : { x: mapWidth * 0.5, y: mapHeight * 0.5 };
    const bands =
      biomeResolver && typeof biomeResolver.getBands === "function" ? biomeResolver.getBands() : [];
    const sectors =
      biomeResolver && typeof biomeResolver.getSectors === "function" ? biomeResolver.getSectors() : [];
    const effectiveBands = bands.length
      ? bands
      : [{ id: "all", distanceMin: 0, distanceMax: getMapRadiusLimit(origin), tags: [], biomeWeights: {} }];
    const effectiveSectors = sectors.length
      ? sectors
      : [{ id: "all", angleMinDeg: 0, angleMaxDeg: 0, tags: [], biomeWeights: {} }];
    const mapRadiusLimit = getMapRadiusLimit(origin);
    const regions = [];
    for (const band of effectiveBands) {
      const radiusMin = Math.max(0, Number(band && band.distanceMin) || 0);
      const radiusMax = Math.min(mapRadiusLimit, Math.max(radiusMin + 1, Number(band && band.distanceMax) || mapRadiusLimit));
      if (radiusMax <= radiusMin) {
        continue;
      }
      for (const sector of effectiveSectors) {
        const sectorWindow = getSectorSpanDeg(sector);
        const sampleRadius = radiusMin + (radiusMax - radiusMin) * 0.58;
        const sampleAngle = normalizeAngleDeg(sectorWindow.min + sectorWindow.span * 0.5);
        const samplePoint = pointFromPolar(origin, sampleRadius, sampleAngle);
        const sampleBiome = biomeResolver.resolveBiomeAt(samplePoint.x, samplePoint.y);
        const area = (sectorWindow.span / 360) * Math.PI * (radiusMax * radiusMax - radiusMin * radiusMin);
        regions.push({
          bandId: normalizeId(sampleBiome && sampleBiome.bandId) || normalizeId(band && band.id),
          sectorId: normalizeId(sampleBiome && sampleBiome.sectorId) || normalizeId(sector && sector.id),
          radiusMin,
          radiusMax,
          angleMinDeg: sectorWindow.min,
          angleSpanDeg: sectorWindow.span,
          area,
          origin,
          sampleBiome
        });
      }
    }
    return regions.filter((region) => region.area > 0);
  }

  function getFamilyPlacementScore(region, familyId) {
    const biomeInfo = region && region.sampleBiome;
    const familyWeight = clamp(
      Number(biomeInfo && biomeInfo.resourceWeights && biomeInfo.resourceWeights[familyId]) || 0,
      0,
      1
    );
    if (familyWeight <= 0) {
      return 0;
    }
    const candidates = resourceRegistry.getCandidatesForBiome(biomeInfo, familyId);
    if (!candidates.length) {
      return 0;
    }
    let weightedDensity = 0;
    let totalCandidateWeight = 0;
    for (const candidate of candidates) {
      const candidateWeight = Math.max(0.01, Number(candidate.spawnWeight) || 1);
      weightedDensity += candidateWeight * clamp(Number(candidate.density) || 0, 0.05, 1);
      totalCandidateWeight += candidateWeight;
    }
    const averageDensity = totalCandidateWeight > 0 ? weightedDensity / totalCandidateWeight : 0.1;
    return Math.max(0, Number(region.area) || 0) * familyWeight * Math.max(0.1, averageDensity);
  }

  function allocateFamilyTargets(limit, regions, familyId) {
    const familyLimit = Math.max(0, Math.floor(Number(limit) || 0));
    if (familyLimit <= 0) {
      return [];
    }
    const scoredRegions = regions
      .map((region) => ({
        region,
        score: getFamilyPlacementScore(region, familyId)
      }))
      .filter((entry) => entry.score > 0);
    if (!scoredRegions.length) {
      return [];
    }
    const totalScore = scoredRegions.reduce((sum, entry) => sum + entry.score, 0);
    let assigned = 0;
    const targets = scoredRegions.map((entry) => {
      const raw = totalScore > 0 ? (entry.score / totalScore) * familyLimit : 0;
      const count = Math.floor(raw);
      assigned += count;
      return {
        ...entry,
        raw,
        count,
        remainder: raw - count
      };
    });
    const sortedRemainders = [...targets].sort((left, right) => right.remainder - left.remainder);
    for (let index = 0; index < sortedRemainders.length && assigned < familyLimit; index += 1) {
      sortedRemainders[index].count += 1;
      assigned += 1;
    }
    return targets.filter((entry) => entry.count > 0);
  }

  function samplePointInRegion(region, seedText) {
    const radiusMinSq = region.radiusMin * region.radiusMin;
    const radiusMaxSq = region.radiusMax * region.radiusMax;
    const radius = Math.sqrt(radiusMinSq + (radiusMaxSq - radiusMinSq) * hashUnit(`${seedText}:radius`));
    const angleDeg = normalizeAngleDeg(region.angleMinDeg + region.angleSpanDeg * hashUnit(`${seedText}:angle`));
    return pointFromPolar(region.origin, radius, angleDeg);
  }

  function placeNodesForRegion(region, familyId, targetCount, phase = "primary") {
    const familySpacing = Math.max(2, Number(familyMinSpacing[familyId]) || Math.round(cellSize * 0.6));
    const maxAttempts = Math.max(targetCount * placementAttemptsPerTarget, targetCount);
    let placed = 0;
    for (let attemptIndex = 0; attemptIndex < maxAttempts && placed < targetCount; attemptIndex += 1) {
      const seedText = `${phase}:${familyId}:${region.bandId}:${region.sectorId}:${targetCount}:${attemptIndex}`;
      const point = samplePointInRegion(region, seedText);
      if (!isPointWithinMap(point.x, point.y) || isPointExcludedByTown(point.x, point.y)) {
        continue;
      }
      if (hasNearbyFamilyNode(point.x, point.y, familyId, familySpacing)) {
        continue;
      }
      const node = createNodeAtPoint(point.x, point.y, familyId, seedText);
      if (!node) {
        continue;
      }
      if (
        normalizeId(node.biome && node.biome.bandId) !== normalizeId(region.bandId) ||
        normalizeId(node.biome && node.biome.sectorId) !== normalizeId(region.sectorId)
      ) {
        continue;
      }
      resourceNodes.set(node.id, node);
      placed += 1;
    }
    return placed;
  }

  function getFamilyIds() {
    const familyIds = [];
    const familyDefs =
      resourceRegistry && typeof resourceRegistry.getFamilyDefs === "function"
        ? resourceRegistry.getFamilyDefs()
        : [];
    for (const entry of familyDefs) {
      const familyId = normalizeId(entry && entry.id);
      if (familyId && !familyIds.includes(familyId)) {
        familyIds.push(familyId);
      }
    }
    for (const familyId of Object.keys(familyLimits)) {
      const normalizedFamilyId = normalizeId(familyId);
      if (normalizedFamilyId && !familyIds.includes(normalizedFamilyId)) {
        familyIds.push(normalizedFamilyId);
      }
    }
    return familyIds;
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
    const regions = getGenerationRegions();
    const familyCounts = {};
    for (const familyId of getFamilyIds()) {
      const familyLimit = Math.max(0, Math.floor(Number(familyLimits[familyId]) || 0));
      if (familyLimit <= 0) {
        continue;
      }
      const regionTargets = allocateFamilyTargets(familyLimit, regions, familyId);
      for (const entry of regionTargets) {
        familyCounts[familyId] = (Number(familyCounts[familyId]) || 0) + placeNodesForRegion(
          entry.region,
          familyId,
          entry.count,
          "band-sector"
        );
      }
      if ((Number(familyCounts[familyId]) || 0) >= familyLimit) {
        continue;
      }
      const fallbackRegions = [...regionTargets].sort((left, right) => right.score - left.score);
      for (const entry of fallbackRegions) {
        const remaining = familyLimit - (Number(familyCounts[familyId]) || 0);
        if (remaining <= 0) {
          break;
        }
        familyCounts[familyId] += placeNodesForRegion(entry.region, familyId, remaining, "band-sector-fill");
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
    const skillResult =
      skillTools && typeof skillTools.grantPlayerSkillExp === "function"
        ? skillTools.grantPlayerSkillExp(player, node.skillId, Math.max(1, Number(node.xp) || 1))
        : { changed: false, skill: null, leveledUp: false };
    sendInventoryState(player);
    sendSelfProgress(player);
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
