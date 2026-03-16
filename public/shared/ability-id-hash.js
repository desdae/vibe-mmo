(function initAbilityIdHash(rootFactory) {
  if (typeof module === "object" && module.exports) {
    module.exports = rootFactory();
    return;
  }
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.VibeAbilityIdHash = rootFactory();
})(function buildAbilityIdHashTools() {
  function fallbackHashString32(value) {
    const input = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index) & 0xff;
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function normalizeAbilityId(value) {
    return String(value || "").trim();
  }

  function normalizeAbilityHashSource(value) {
    return normalizeAbilityId(value).toLowerCase();
  }

  function hashAbilityId(value, hashFn = fallbackHashString32) {
    const normalized = normalizeAbilityHashSource(value);
    if (!normalized) {
      return 0;
    }
    return (typeof hashFn === "function" ? hashFn(normalized) : fallbackHashString32(normalized)) >>> 0;
  }

  function registerAbilityIdHash(targetMap, abilityId, resolvedAbilityId = "", hashFn = fallbackHashString32) {
    if (!(targetMap instanceof Map)) {
      return false;
    }
    const sourceId = normalizeAbilityId(abilityId);
    const canonicalId = normalizeAbilityId(resolvedAbilityId || sourceId);
    if (!sourceId || !canonicalId) {
      return false;
    }

    const exactHash = hashAbilityId(sourceId, hashFn);
    if (exactHash) {
      targetMap.set(exactHash, canonicalId);
    }

    const sourceLower = sourceId.toLowerCase();
    const canonicalLower = canonicalId.toLowerCase();
    if (sourceLower && sourceLower !== sourceId) {
      targetMap.set(hashAbilityId(sourceLower, hashFn), canonicalId);
    }
    if (canonicalLower && canonicalLower !== sourceLower) {
      targetMap.set(hashAbilityId(canonicalLower, hashFn), canonicalId);
    }
    return exactHash !== 0;
  }

  return Object.freeze({
    normalizeAbilityId,
    normalizeAbilityHashSource,
    hashAbilityId,
    registerAbilityIdHash
  });
});
