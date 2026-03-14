const { createWorldState } = require('../runtime/world-state');

describe('world-state', () => {
  let worldState;

  beforeEach(() => {
    worldState = createWorldState();
  });

  describe('initial state', () => {
    test('creates empty players map', () => {
      expect(worldState.players).toBeInstanceOf(Map);
      expect(worldState.players.size).toBe(0);
    });

    test('creates empty mobs map', () => {
      expect(worldState.mobs).toBeInstanceOf(Map);
      expect(worldState.mobs.size).toBe(0);
    });

    test('creates empty projectiles map', () => {
      expect(worldState.projectiles).toBeInstanceOf(Map);
      expect(worldState.projectiles.size).toBe(0);
    });

    test('creates empty lootBags map', () => {
      expect(worldState.lootBags).toBeInstanceOf(Map);
      expect(worldState.lootBags.size).toBe(0);
    });

    test('creates empty activeAreaEffects map', () => {
      expect(worldState.activeAreaEffects).toBeInstanceOf(Map);
      expect(worldState.activeAreaEffects.size).toBe(0);
    });
  });

  describe('allocatePlayerId', () => {
    test('returns string IDs starting from 1', () => {
      expect(worldState.allocatePlayerId()).toBe('1');
      expect(worldState.allocatePlayerId()).toBe('2');
      expect(worldState.allocatePlayerId()).toBe('3');
    });

    test('returns unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(worldState.allocatePlayerId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('allocateMobId', () => {
    test('returns string IDs and increments', () => {
      const freshWorldState = createWorldState();
      const id1 = freshWorldState.allocateMobId();
      const id2 = freshWorldState.allocateMobId();
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
    });
  });

  describe('allocateProjectileId', () => {
    test('returns string IDs', () => {
      expect(typeof worldState.allocateProjectileId()).toBe('string');
    });
  });

  describe('allocateLootBagId', () => {
    test('returns string IDs', () => {
      expect(typeof worldState.allocateLootBagId()).toBe('string');
    });
  });

  describe('allocateAreaEffectId', () => {
    test('returns string IDs', () => {
      expect(typeof worldState.allocateAreaEffectId()).toBe('string');
    });
  });

  describe('allocateItemInstanceId', () => {
    test('returns string IDs', () => {
      expect(typeof worldState.allocateItemInstanceId()).toBe('string');
    });
  });

  describe('getPlayer', () => {
    test('returns undefined for empty map', () => {
      expect(worldState.getPlayer('1')).toBeUndefined();
    });

    test('returns player when found', () => {
      const player = { id: '1', name: 'Test' };
      worldState.players.set('1', player);
      expect(worldState.getPlayer(1)).toEqual(player);
    });

    test('returns player with numeric key', () => {
      const player = { id: '1', name: 'Test' };
      worldState.players.set('1', player);
      expect(worldState.getPlayer(1)).toEqual(player);
    });
  });

  describe('hasPlayer', () => {
    test('returns false for empty map', () => {
      expect(worldState.hasPlayer('1')).toBe(false);
    });

    test('returns true when player exists', () => {
      worldState.players.set('1', { id: '1' });
      expect(worldState.hasPlayer(1)).toBe(true);
    });
  });

  describe('getMob', () => {
    test('returns undefined when not found', () => {
      expect(worldState.getMob('1')).toBeUndefined();
    });

    test('finds mob with numeric key', () => {
      const mob = { id: '1', hp: 100 };
      worldState.mobs.set('1', mob);
      expect(worldState.getMob(1)).toEqual(mob);
    });
  });

  describe('hasMob', () => {
    test('returns false when not found', () => {
      expect(worldState.hasMob('1')).toBe(false);
    });

    test('returns true when found', () => {
      worldState.mobs.set('1', { id: '1' });
      expect(worldState.hasMob(1)).toBe(true);
    });
  });

  describe('getProjectile', () => {
    test('returns undefined when not found', () => {
      expect(worldState.getProjectile('1')).toBeUndefined();
    });
  });

  describe('getLootBag', () => {
    test('returns undefined when not found', () => {
      expect(worldState.getLootBag('1')).toBeUndefined();
    });
  });

  describe('getAreaEffect', () => {
    test('returns undefined when not found', () => {
      expect(worldState.getAreaEffect('1')).toBeUndefined();
    });
  });
});
