const {
  normalizeId,
  normalizePlayerId,
  normalizeMobId,
  normalizeProjectileId,
  mapGet,
  mapHas,
  mapDelete
} = require('../utils/id-utils');

describe('id-utils', () => {
  describe('normalizeId', () => {
    test('returns null for null input', () => {
      expect(normalizeId(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(normalizeId(undefined)).toBeNull();
    });

    test('converts number to string', () => {
      expect(normalizeId(123)).toBe('123');
    });

    test('converts string to string', () => {
      expect(normalizeId('456')).toBe('456');
    });

    test('converts object with toString to string', () => {
      expect(normalizeId({ toString: () => '789' })).toBe('789');
    });
  });

  describe('normalizePlayerId', () => {
    test('delegates to normalizeId', () => {
      expect(normalizePlayerId(42)).toBe('42');
    });
  });

  describe('normalizeMobId', () => {
    test('delegates to normalizeId', () => {
      expect(normalizeMobId(99)).toBe('99');
    });
  });

  describe('normalizeProjectileId', () => {
    test('delegates to normalizeId', () => {
      expect(normalizeProjectileId(7)).toBe('7');
    });
  });

  describe('mapGet', () => {
    test('returns undefined for invalid map', () => {
      expect(mapGet(null, 'key')).toBeUndefined();
      expect(mapGet(undefined, 'key')).toBeUndefined();
      expect(mapGet('not a map', 'key')).toBeUndefined();
    });

    test('returns value for existing key', () => {
      const map = new Map([['1', { id: 1 }]]);
      expect(mapGet(map, 1)).toEqual({ id: 1 });
    });

    test('returns value for numeric key', () => {
      const map = new Map([['42', { id: 42 }]]);
      expect(mapGet(map, 42)).toEqual({ id: 42 });
    });

    test('returns undefined for non-existing key', () => {
      const map = new Map();
      expect(mapGet(map, 'nonexistent')).toBeUndefined();
    });
  });

  describe('mapHas', () => {
    test('returns false for invalid map', () => {
      expect(mapHas(null, 'key')).toBe(false);
      expect(mapHas(undefined, 'key')).toBe(false);
    });

    test('returns true for existing key', () => {
      const map = new Map([['1', { id: 1 }]]);
      expect(mapHas(map, 1)).toBe(true);
    });

    test('returns false for non-existing key', () => {
      const map = new Map();
      expect(mapHas(map, 'nonexistent')).toBe(false);
    });
  });

  describe('mapDelete', () => {
    test('returns false for invalid map', () => {
      expect(mapDelete(null, 'key')).toBe(false);
      expect(mapDelete(undefined, 'key')).toBe(false);
    });

    test('deletes existing key', () => {
      const map = new Map([['1', { id: 1 }]]);
      expect(mapDelete(map, 1)).toBe(true);
      expect(map.has('1')).toBe(false);
    });

    test('returns false for non-existing key', () => {
      const map = new Map();
      expect(mapDelete(map, 'nonexistent')).toBe(false);
    });
  });
});
