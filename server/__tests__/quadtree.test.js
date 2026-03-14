const { Quadtree, createQuadtree } = require('../utils/quadtree');

describe('quadtree', () => {
  describe('createQuadtree', () => {
    test('creates a quadtree with default settings', () => {
      const qt = createQuadtree();
      expect(qt).toBeDefined();
    });

    test('creates a quadtree with custom settings', () => {
      const qt = createQuadtree({ worldSize: 500, maxObjects: 5, maxLevels: 3 });
      expect(qt).toBeDefined();
    });
  });

  describe('Quadtree', () => {
    let qt;

    beforeEach(() => {
      qt = createQuadtree({ worldSize: 100, maxObjects: 4, maxLevels: 4 });
    });

    describe('insert', () => {
      test('inserts a point', () => {
        qt.insert({ x: 0, y: 0 });
        const results = qt.queryRadius(0, 0, 10);
        expect(results.length).toBe(1);
      });

      test('inserts multiple points', () => {
        for (let i = 0; i < 10; i++) {
          qt.insert({ x: i, y: i });
        }
        const results = qt.queryRadius(5, 5, 10);
        expect(results.length).toBeGreaterThan(0);
      });

      test('splits when maxObjects is exceeded', () => {
        // Insert 5 objects into a quadtree with maxObjects of 4
        for (let i = 0; i < 5; i++) {
          qt.insert({ x: i * 2, y: i * 2 });
        }
        // Should have split
        expect(qt.nodes.length).toBe(4);
      });
    });

    describe('queryRange', () => {
      beforeEach(() => {
        // Insert test objects in a grid pattern
        for (let x = -50; x <= 50; x += 10) {
          for (let y = -50; y <= 50; y += 10) {
            qt.insert({ x, y, id: `${x}_${y}` });
          }
        }
      });

      test('finds objects in rectangular range', () => {
        const results = qt.queryRange(-20, -20, 20, 20);
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThan(100); // Not all objects
      });

      test('returns empty array when no objects in range', () => {
        const qt2 = createQuadtree({ worldSize: 10 });
        const results = qt2.queryRange(100, 100, 200, 200);
        expect(results).toHaveLength(0);
      });
    });

    describe('queryRadius', () => {
      beforeEach(() => {
        qt.insert({ x: 0, y: 0 });
        qt.insert({ x: 5, y: 5 });
        qt.insert({ x: 100, y: 100 });
      });

      test('finds objects within radius', () => {
        const results = qt.queryRadius(0, 0, 10);
        expect(results.length).toBe(2); // (0,0) and (5,5)
      });

      test('excludes objects outside radius', () => {
        const results = qt.queryRadius(0, 0, 3);
        expect(results.length).toBe(1); // Only (0,0)
      });
    });

    describe('findNearest', () => {
      beforeEach(() => {
        qt.insert({ x: 0, y: 0, id: 'a' });
        qt.insert({ x: 10, y: 0, id: 'b' });
        qt.insert({ x: 30, y: 0, id: 'c' });
      });

      test('finds nearest object', () => {
        // (1,0) is closest to (0,0) - distance 1
        const nearest = qt.findNearest(1, 0, 50);
        expect(nearest.id).toBe('a');
      });

      test('returns null when nothing in range', () => {
        const nearest = qt.findNearest(1, 0, 0.5);
        expect(nearest).toBeNull();
      });

      test('respects filter function', () => {
        const nearest = qt.findNearest(1, 0, 50, obj => obj.id === 'c');
        expect(nearest.id).toBe('c');
      });
    });

    describe('findAllSorted', () => {
      beforeEach(() => {
        qt.insert({ x: 0, y: 0, id: 'a' });
        qt.insert({ x: 10, y: 0, id: 'b' });
        qt.insert({ x: 5, y: 0, id: 'c' });
      });

      test('returns objects sorted by distance', () => {
        const results = qt.findAllSorted(0, 0, 50);
        expect(results[0].id).toBe('a');
        expect(results[1].id).toBe('c');
        expect(results[2].id).toBe('b');
      });
    });

    describe('remove', () => {
      test('removes an object', () => {
        const obj = { x: 5, y: 5 };
        qt.insert(obj);
        qt.remove(obj);
        
        const results = qt.queryRadius(5, 5, 1);
        expect(results).toHaveLength(0);
      });
    });

    describe('clear', () => {
      test('clears all objects', () => {
        qt.insert({ x: 0, y: 0 });
        qt.insert({ x: 10, y: 10 });
        
        qt.clear();
        
        expect(qt.queryRadius(0, 0, 50)).toHaveLength(0);
      });
    });

    describe('intersections', () => {
      test('correctly identifies intersecting bounds', () => {
        const qt2 = createQuadtree({ worldSize: 100 });
        // qt2 at (0,0) with halfWidth 50 covers [-50, 50] x [-50, 50]
        
        // This range intersects
        expect(qt2.intersectsBounds(-25, -25, 25, 25)).toBe(true);
        
        // This range does not intersect
        expect(qt2.intersectsBounds(100, 100, 200, 200)).toBe(false);
      });
    });

    describe('performance', () => {
      test('handles large number of objects', () => {
        const largeQt = createQuadtree({ worldSize: 1000, maxObjects: 16, maxLevels: 8 });
        
        // Insert 1000 random points within the quadtree bounds
        for (let i = 0; i < 1000; i++) {
          largeQt.insert({
            x: (Math.random() - 0.5) * 800,
            y: (Math.random() - 0.5) * 800
          });
        }
        
        // Query should still be fast
        const start = Date.now();
        const results = largeQt.queryRadius(0, 0, 100);
        const elapsed = Date.now() - start;
        
        expect(results.length).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(50); // Should be very fast
      });
    });
  });
});
