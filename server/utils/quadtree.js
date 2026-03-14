/**
 * Quadtree spatial index for efficient 2D range queries
 * Used for visibility checks, collision detection, and proximity searches
 */

class Quadtree {
  /**
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate  
   * @param {number} halfWidth - Half the width of the bounds
   * @param {number} halfHeight - Half the height of the bounds
   * @param {number} maxObjects - Max objects per node before split (default: 10)
   * @param {number} maxLevels - Max depth levels (default: 5)
   * @param {number} level - Current level (internal use)
   */
  constructor(x, y, halfWidth, halfHeight, maxObjects = 10, maxLevels = 5, level = 0) {
    this.x = x; // Center X
    this.y = y; // Center Y
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    
    this.objects = []; // Objects at this node
    this.nodes = []; // Child nodes (4 quadrants)
  }

  /**
   * Get the boundaries of this node
   */
  getBounds() {
    return {
      minX: this.x - this.halfWidth,
      minY: this.y - this.halfHeight,
      maxX: this.x + this.halfWidth,
      maxY: this.y + this.halfHeight
    };
  }

  /**
   * Check if a point is within this node's bounds
   */
  containsPoint(x, y) {
    return (
      x >= this.x - this.halfWidth &&
      x < this.x + this.halfWidth &&
      y >= this.y - this.halfHeight &&
      y < this.y + this.halfHeight
    );
  }

  /**
   * Check if this node intersects with a rectangular area
   */
  intersectsBounds(minX, minY, maxX, maxY) {
    const bounds = this.getBounds();
    return !(
      maxX < bounds.minX ||
      minX > bounds.maxX ||
      maxY < bounds.minY ||
      minY > bounds.maxY
    );
  }

  /**
   * Split the node into 4 sub-quadrants
   */
  split() {
    const newHalfWidth = this.halfWidth / 2;
    const newHalfHeight = this.halfHeight / 2;
    const nextLevel = this.level + 1;

    // Top-right (NE)
    this.nodes[0] = new Quadtree(
      this.x + newHalfWidth,
      this.y - newHalfHeight,
      newHalfWidth,
      newHalfHeight,
      this.maxObjects,
      this.maxLevels,
      nextLevel
    );

    // Top-left (NW)
    this.nodes[1] = new Quadtree(
      this.x - newHalfWidth,
      this.y - newHalfHeight,
      newHalfWidth,
      newHalfHeight,
      this.maxObjects,
      this.maxLevels,
      nextLevel
    );

    // Bottom-left (SW)
    this.nodes[2] = new Quadtree(
      this.x - newHalfWidth,
      this.y + newHalfHeight,
      newHalfWidth,
      newHalfHeight,
      this.maxObjects,
      this.maxLevels,
      nextLevel
    );

    // Bottom-right (SE)
    this.nodes[3] = new Quadtree(
      this.x + newHalfWidth,
      this.y + newHalfHeight,
      newHalfWidth,
      newHalfHeight,
      this.maxObjects,
      this.maxLevels,
      nextLevel
    );
  }

  /**
   * Get the index of the quadrant that contains the point
   * Returns -1 if the point doesn't fit in any child quadrant
   */
  getQuadrantIndex(x, y) {
    const midX = this.x;
    const midY = this.y;
    
    const top = y < midY;
    const bottom = y >= midY;
    const left = x < midX;
    const right = x >= midX;

    if (top && right) return 0;
    if (top && left) return 1;
    if (bottom && left) return 2;
    if (bottom && right) return 3;

    return -1; // Doesn't fit in any child
  }

  /**
   * Add an object to the quadtree
   * @param {Object} obj - Object with x, y properties
   */
  insert(obj) {
    // If we have child nodes, try to insert into them
    if (this.nodes.length > 0) {
      const index = this.getQuadrantIndex(obj.x, obj.y);
      if (index !== -1) {
        this.nodes[index].insert(obj);
        return;
      }
    }

    // Add to this node
    this.objects.push(obj);

    // Split if needed
    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (this.nodes.length === 0) {
        this.split();
      }

      // Redistribute objects to children
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getQuadrantIndex(this.objects[i].x, this.objects[i].y);
        if (index !== -1) {
          const removed = this.objects.splice(i, 1)[0];
          this.nodes[index].insert(removed);
        } else {
          i++;
        }
      }
    }
  }

  /**
   * Remove an object from the quadtree
   * @param {Object} obj - Object to remove
   * @returns {boolean} True if removed
   */
  remove(obj) {
    // Try to remove from children first
    if (this.nodes.length > 0) {
      const index = this.getQuadrantIndex(obj.x, obj.y);
      if (index !== -1 && this.nodes[index].remove(obj)) {
        return true;
      }
    }

    // Remove from this node
    const idx = this.objects.indexOf(obj);
    if (idx !== -1) {
      this.objects.splice(idx, 1);
      return true;
    }

    return false;
  }

  /**
   * Clear the quadtree
   */
  clear() {
    this.objects = [];
    for (const node of this.nodes) {
      node.clear();
    }
    this.nodes = [];
  }

  /**
   * Query objects within a rectangular area
   * @param {number} minX - Min X bound
   * @param {number} minY - Min Y bound
   * @param {number} maxX - Max X bound
   * @param {number} maxY - Max Y bound
   * @returns {Array} Objects within the bounds
   */
  queryRange(minX, minY, maxX, maxY) {
    const results = [];

    // Check if this node intersects with query bounds
    if (!this.intersectsBounds(minX, minY, maxX, maxY)) {
      return results;
    }

    // Add objects from this node that are within bounds
    for (const obj of this.objects) {
      if (obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY) {
        results.push(obj);
      }
    }

    // Query children
    for (const node of this.nodes) {
      results.push(...node.queryRange(minX, minY, maxX, maxY));
    }

    return results;
  }

  /**
   * Query objects within a circular radius
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} radius - Radius
   * @returns {Array} Objects within the radius
   */
  queryRadius(cx, cy, radius) {
    const minX = cx - radius;
    const minY = cy - radius;
    const maxX = cx + radius;
    const maxY = cy + radius;

    const candidates = this.queryRange(minX, minY, maxX, maxY);
    
    // Filter by exact radius
    const results = [];
    const radiusSq = radius * radius;
    
    for (const obj of candidates) {
      const dx = obj.x - cx;
      const dy = obj.y - cy;
      if (dx * dx + dy * dy <= radiusSq) {
        results.push(obj);
      }
    }

    return results;
  }

  /**
   * Get the nearest object within a max radius
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} maxRadius - Maximum search radius
   * @param {Function} filterFn - Optional filter function
   * @returns {Object|null} Nearest object or null
   */
  findNearest(x, y, maxRadius, filterFn = null) {
    const candidates = this.queryRadius(x, y, maxRadius);
    
    let nearest = null;
    let nearestDistSq = maxRadius * maxRadius;

    for (const obj of candidates) {
      if (filterFn && !filterFn(obj)) continue;
      
      const dx = obj.x - x;
      const dy = obj.y - y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = obj;
      }
    }

    return nearest;
  }

  /**
   * Get all objects sorted by distance from a point
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} maxRadius - Maximum search radius
   * @param {Function} filterFn - Optional filter function
   * @returns {Array} Objects sorted by distance
   */
  findAllSorted(x, y, maxRadius, filterFn = null) {
    const candidates = this.queryRadius(x, y, maxRadius);
    
    const results = [];
    for (const obj of candidates) {
      if (filterFn && !filterFn(obj)) continue;
      
      const dx = obj.x - x;
      const dy = obj.y - y;
      results.push({ obj, distSq: dx * dx + dy * dy });
    }

    // Sort by distance
    results.sort((a, b) => a.distSq - b.distSq);
    return results.map(r => r.obj);
  }
}

/**
 * Create a quadtree for the game world
 * @param {Object} options - Configuration options
 * @returns {Quadtree}
 */
function createQuadtree(options = {}) {
  const {
    worldSize = 1000, // Total world size (will be centered at 0,0)
    maxObjects = 10,
    maxLevels = 5
  } = options;

  const halfSize = worldSize / 2;
  return new Quadtree(0, 0, halfSize, halfSize, maxObjects, maxLevels);
}

/**
 * Update an object's position in the quadtree
 * Note: Requires object to be re-inserted after position change
 * @param {Quadtree} quadtree - The quadtree
 * @param {Object} obj - The object to update
 * @param {number} oldX - Old X position
 * @param {number} oldY - Old Y position
 */
function updateObjectPosition(quadtree, obj, oldX, oldY) {
  // Simple approach: remove and re-insert
  // For better performance with frequent updates, consider a more sophisticated approach
  if (oldX !== obj.x || oldY !== obj.y) {
    quadtree.remove({ ...obj, x: oldX, y: oldY });
    quadtree.insert(obj);
  }
}

module.exports = {
  Quadtree,
  createQuadtree,
  updateObjectPosition
};
