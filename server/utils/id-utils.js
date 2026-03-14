/**
 * ID Utility Functions
 * 
 * Provides consistent ID handling across the codebase to prevent
 * type coercion bugs when looking up entities in Maps.
 * 
 * All IDs in the game world are normalized to strings for consistency.
 */

function normalizeId(id) {
  if (id === null || id === undefined) {
    return null;
  }
  return String(id);
}

function normalizePlayerId(id) {
  return normalizeId(id);
}

function normalizeMobId(id) {
  return normalizeId(id);
}

function normalizeProjectileId(id) {
  return normalizeId(id);
}

function normalizeLootBagId(id) {
  return normalizeId(id);
}

function normalizeAreaEffectId(id) {
  return normalizeId(id);
}

/**
 * Safely get a value from a Map using string-normalized keys
 * @param {Map} map - The Map to search
 * @param {*} key - The key to look up (will be normalized to string)
 * @returns {*} The value at that key, or undefined
 */
function mapGet(map, key) {
  if (!map || !(map instanceof Map)) {
    return undefined;
  }
  return map.get(normalizeId(key));
}

/**
 * Check if a Map has a key (normalized to string)
 * @param {Map} map - The Map to check
 * @param {*} key - The key to check (will be normalized to string)
 * @returns {boolean} Whether the key exists
 */
function mapHas(map, key) {
  if (!map || !(map instanceof Map)) {
    return false;
  }
  return map.has(normalizeId(key));
}

/**
 * Delete a key from a Map (normalized to string)
 * @param {Map} map - The Map to modify
 * @param {*} key - The key to delete (will be normalized to string)
 * @returns {boolean} Whether the key was deleted
 */
function mapDelete(map, key) {
  if (!map || !(map instanceof Map)) {
    return false;
  }
  return map.delete(normalizeId(key));
}

module.exports = {
  normalizeId,
  normalizePlayerId,
  normalizeMobId,
  normalizeProjectileId,
  normalizeLootBagId,
  normalizeAreaEffectId,
  mapGet,
  mapHas,
  mapDelete
};
