/**
 * Spatial hash grid for efficient range queries on a 2D map.
 *
 * Entities are bucketed into square cells.  A range query only inspects the
 * cells that overlap the query rectangle, turning O(N) full-scan visibility
 * checks into O(k) where k is the number of nearby entities.
 */

function createSpatialGrid(cellSize) {
  const cs = Math.max(1, Number(cellSize) || 1);
  /** @type {Map<string, Set<string|number>>} */
  const cells = new Map();
  /** @type {Map<string|number, string>} cellKey by entity id */
  const entityCell = new Map();

  function cellKey(x, y) {
    return Math.floor(x / cs) + "," + Math.floor(y / cs);
  }

  function insert(id, x, y) {
    const key = cellKey(x, y);
    entityCell.set(id, key);
    let bucket = cells.get(key);
    if (!bucket) {
      bucket = new Set();
      cells.set(key, bucket);
    }
    bucket.add(id);
  }

  function remove(id) {
    const key = entityCell.get(id);
    if (key === undefined) {
      return;
    }
    entityCell.delete(id);
    const bucket = cells.get(key);
    if (bucket) {
      bucket.delete(id);
      if (bucket.size === 0) {
        cells.delete(key);
      }
    }
  }

  function update(id, x, y) {
    const newKey = cellKey(x, y);
    const oldKey = entityCell.get(id);
    if (oldKey === newKey) {
      return;
    }
    if (oldKey !== undefined) {
      const oldBucket = cells.get(oldKey);
      if (oldBucket) {
        oldBucket.delete(id);
        if (oldBucket.size === 0) {
          cells.delete(oldKey);
        }
      }
    }
    entityCell.set(id, newKey);
    let bucket = cells.get(newKey);
    if (!bucket) {
      bucket = new Set();
      cells.set(newKey, bucket);
    }
    bucket.add(id);
  }

  /**
   * Return all entity IDs whose cell overlaps the axis-aligned box
   * centred on (cx, cy) with half-width `range`.
   *
   * This intentionally returns a superset — the caller still does the
   * precise distance / box check per entity, but the candidate set is
   * drastically smaller than iterating everything.
   */
  function queryRect(cx, cy, range) {
    const minCellX = Math.floor((cx - range) / cs);
    const maxCellX = Math.floor((cx + range) / cs);
    const minCellY = Math.floor((cy - range) / cs);
    const maxCellY = Math.floor((cy + range) / cs);

    const result = [];
    for (let gx = minCellX; gx <= maxCellX; gx++) {
      for (let gy = minCellY; gy <= maxCellY; gy++) {
        const bucket = cells.get(gx + "," + gy);
        if (bucket) {
          for (const id of bucket) {
            result.push(id);
          }
        }
      }
    }
    return result;
  }

  /**
   * Rebuild the entire grid from a Map of entities.
   * Each entity must have numeric `x` and `y` properties.
   * An optional `filterFn(entity)` can skip entries (e.g. dead mobs).
   */
  function rebuildFromMap(entityMap, filterFn) {
    cells.clear();
    entityCell.clear();
    for (const entity of entityMap.values()) {
      if (filterFn && !filterFn(entity)) {
        continue;
      }
      insert(entity.id, entity.x, entity.y);
    }
  }

  function clear() {
    cells.clear();
    entityCell.clear();
  }

  return {
    insert,
    remove,
    update,
    queryRect,
    rebuildFromMap,
    clear
  };
}

module.exports = {
  createSpatialGrid
};
