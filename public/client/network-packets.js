(function initVibeClientNetworkPackets(globalScope) {
  "use strict";

  function fallbackClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createNetworkPacketParsers(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const clamp = typeof deps.clamp === "function" ? deps.clamp : fallbackClamp;
    const textDecoder = deps.textDecoder instanceof TextDecoder ? deps.textDecoder : new TextDecoder();
    const normalizeMobRenderStyle =
      typeof deps.normalizeMobRenderStyle === "function" ? deps.normalizeMobRenderStyle : () => null;
    const getDefaultClassId =
      typeof deps.getDefaultClassId === "function" ? deps.getDefaultClassId : () => "mage";
    const dequantizePos =
      typeof deps.dequantizePos === "function"
        ? deps.dequantizePos
        : (valueQ) => (Number(valueQ) || 0) / (Number(deps.POS_SCALE) || 64);
    const decodeDamageEventFlags =
      typeof deps.decodeDamageEventFlags === "function"
        ? deps.decodeDamageEventFlags
        : (flags) => ({ targetType: flags & (1 << 0) ? "player" : "mob", fromSelf: !!(flags & (1 << 1)) });
    const decodeUnitDirectionComponent =
      typeof deps.decodeUnitDirectionComponent === "function"
        ? deps.decodeUnitDirectionComponent
        : (value) => clamp((Number(value) || 0) / 127, -1, 1);
    const resolveAbilityIdHash =
      typeof deps.resolveAbilityIdHash === "function" ? deps.resolveAbilityIdHash : () => "";

    const areaEffectProtoType = Number.isFinite(Number(deps.AREA_EFFECT_PROTO_TYPE)) ? Number(deps.AREA_EFFECT_PROTO_TYPE) : 3;
    const areaEffectProtoVersion = Number.isFinite(Number(deps.AREA_EFFECT_PROTO_VERSION))
      ? Number(deps.AREA_EFFECT_PROTO_VERSION)
      : 2;
    const areaEffectOpUpsert = Number.isFinite(Number(deps.AREA_EFFECT_OP_UPSERT)) ? Number(deps.AREA_EFFECT_OP_UPSERT) : 1;
    const areaEffectOpRemove = Number.isFinite(Number(deps.AREA_EFFECT_OP_REMOVE)) ? Number(deps.AREA_EFFECT_OP_REMOVE) : 2;
    const areaEffectKindArea = Number.isFinite(Number(deps.AREA_EFFECT_KIND_AREA)) ? Number(deps.AREA_EFFECT_KIND_AREA) : 0;
    const areaEffectKindBeam = Number.isFinite(Number(deps.AREA_EFFECT_KIND_BEAM)) ? Number(deps.AREA_EFFECT_KIND_BEAM) : 1;
    const areaEffectKindSummon = Number.isFinite(Number(deps.AREA_EFFECT_KIND_SUMMON)) ? Number(deps.AREA_EFFECT_KIND_SUMMON) : 2;

    const {
      ENTITY_PROTO_TYPE,
      ENTITY_PROTO_VERSION,
      MOB_EFFECT_PROTO_TYPE,
      MOB_EFFECT_PROTO_VERSION,
      MOB_META_PROTO_TYPE,
      MOB_META_PROTO_VERSION,
      PROJECTILE_META_PROTO_TYPE,
      PROJECTILE_META_PROTO_VERSION,
      DAMAGE_EVENT_PROTO_TYPE,
      DAMAGE_EVENT_PROTO_VERSION,
      PLAYER_META_PROTO_TYPE,
      PLAYER_META_PROTO_VERSION,
      LOOTBAG_META_PROTO_TYPE,
      LOOTBAG_META_PROTO_VERSION,
      PLAYER_SWING_PROTO_TYPE,
      PLAYER_SWING_PROTO_VERSION,
      CAST_EVENT_PROTO_TYPE,
      CAST_EVENT_PROTO_VERSION,
      PLAYER_EFFECT_PROTO_TYPE,
      PLAYER_EFFECT_PROTO_VERSION,
      MOB_BITE_PROTO_TYPE,
      MOB_BITE_PROTO_VERSION,
      EXPLOSION_EVENT_PROTO_TYPE,
      EXPLOSION_EVENT_PROTO_VERSION,
      PROJECTILE_HIT_EVENT_PROTO_TYPE,
      PROJECTILE_HIT_EVENT_PROTO_VERSION,
      MOB_DEATH_EVENT_PROTO_TYPE,
      MOB_DEATH_EVENT_PROTO_VERSION,
      CAST_EVENT_KIND_PLAYER,
      CAST_EVENT_KIND_MOB,
      CAST_EVENT_KIND_SELF,
      CAST_EVENT_FLAG_ACTIVE,
      MOB_EFFECT_FLAG_STUN,
      MOB_EFFECT_FLAG_SLOW,
      MOB_EFFECT_FLAG_REMOVE,
      MOB_EFFECT_FLAG_BURN,
      MOB_EFFECT_FLAG_BLOOD_WRATH,
      POS_SCALE,
      MANA_SCALE,
      HEAL_SCALE,
      DELTA_FLAG_HP_CHANGED,
      DELTA_FLAG_MAX_HP_CHANGED,
      DELTA_FLAG_REMOVED,
      DELTA_FLAG_COPPER_CHANGED,
      DELTA_FLAG_PROGRESS_CHANGED,
      DELTA_FLAG_MANA_CHANGED,
      DELTA_FLAG_MAX_MANA_CHANGED,
      DELTA_FLAG_PENDING_HEAL_CHANGED,
      SELF_FLAG_PENDING_MANA_CHANGED,
      SELF_MODE_FULL,
      SELF_MODE_DELTA
    } = deps;

    const entityRuntime = deps.entityRuntime;
    const gameState = deps.gameState;

    if (!entityRuntime || !gameState) {
      return {
        parseEntityBinaryPacket: () => {},
        parseMobEffectBinaryPacket: () => {},
        parseAreaEffectBinaryPacket: () => {},
        parseMobMetaBinaryPacket: () => {},
        parseProjectileMetaBinaryPacket: () => {},
        parseDamageEventBinaryPacket: () => {},
        parsePlayerMetaBinaryPacket: () => {},
        parseLootBagMetaBinaryPacket: () => {},
        parsePlayerSwingBinaryPacket: () => {},
        parseCastEventBinaryPacket: () => {},
        parsePlayerEffectBinaryPacket: () => {},
        parseMobBiteBinaryPacket: () => {},
        parseExplosionEventBinaryPacket: () => {},
        parseProjectileHitEventBinaryPacket: () => {},
        parseMobDeathEventBinaryPacket: () => {},
        parseBinaryPacket: () => {}
      };
    }

    const remotePlayerCasts = deps.remotePlayerCasts;
    const remotePlayerStuns = deps.remotePlayerStuns;
    const remotePlayerSlows = deps.remotePlayerSlows;
    const remotePlayerBurns = deps.remotePlayerBurns;
    const remoteMobCasts = deps.remoteMobCasts;
    const remoteMobStuns = deps.remoteMobStuns;
    const remoteMobSlows = deps.remoteMobSlows;
    const remoteMobBurns = deps.remoteMobBurns;
    const activeAreaEffectsById = deps.activeAreaEffectsById;

    const stopMobCastSpatialLoop =
      typeof deps.stopMobCastSpatialLoop === "function" ? deps.stopMobCastSpatialLoop : () => {};
    const stopProjectileFlightSpatialLoop =
      typeof deps.stopProjectileFlightSpatialLoop === "function" ? deps.stopProjectileFlightSpatialLoop : () => {};
    const syncEntityArraysToGameState =
      typeof deps.syncEntityArraysToGameState === "function" ? deps.syncEntityArraysToGameState : () => {};
    const syncSelfToGameState = typeof deps.syncSelfToGameState === "function" ? deps.syncSelfToGameState : () => {};
    const pushSnapshot = typeof deps.pushSnapshot === "function" ? deps.pushSnapshot : () => {};
    const upsertAreaEffectState =
      typeof deps.upsertAreaEffectState === "function" ? deps.upsertAreaEffectState : () => {};
    const addFloatingDamageEvents =
      typeof deps.addFloatingDamageEvents === "function" ? deps.addFloatingDamageEvents : () => {};
    const applyPlayerMetaEntries =
      typeof deps.applyPlayerMetaEntries === "function" ? deps.applyPlayerMetaEntries : () => {};
    const applyLootBagMetaEntries =
      typeof deps.applyLootBagMetaEntries === "function" ? deps.applyLootBagMetaEntries : () => {};
    const applyPlayerCastStates =
      typeof deps.applyPlayerCastStates === "function" ? deps.applyPlayerCastStates : () => {};
    const applyMobCastStates =
      typeof deps.applyMobCastStates === "function" ? deps.applyMobCastStates : () => {};
    const applyPlayerEffects =
      typeof deps.applyPlayerEffects === "function" ? deps.applyPlayerEffects : () => {};
    const applyNearbyPlayerEffects =
      typeof deps.applyNearbyPlayerEffects === "function" ? deps.applyNearbyPlayerEffects : () => {};
    const triggerRemotePlayerSwing =
      typeof deps.triggerRemotePlayerSwing === "function" ? deps.triggerRemotePlayerSwing : () => {};
    const triggerRemoteMobBite =
      typeof deps.triggerRemoteMobBite === "function" ? deps.triggerRemoteMobBite : () => {};
    const addExplosionEvents =
      typeof deps.addExplosionEvents === "function" ? deps.addExplosionEvents : () => {};
    const addProjectileHitEvents =
      typeof deps.addProjectileHitEvents === "function" ? deps.addProjectileHitEvents : () => {};
    const addMobDeathEvents =
      typeof deps.addMobDeathEvents === "function" ? deps.addMobDeathEvents : () => {};

    function parseEntityBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 20) {
        return;
      }
      if (view.getUint8(0) !== ENTITY_PROTO_TYPE || view.getUint8(1) !== ENTITY_PROTO_VERSION) {
        return;
      }

      const selfMode = view.getUint8(2);
      const selfFlags = view.getUint8(3);
      const fullPlayersCount = view.getUint16(4, true);
      const deltaPlayersCount = view.getUint16(6, true);
      const fullMobsCount = view.getUint16(8, true);
      const deltaMobsCount = view.getUint16(10, true);
      const fullProjectilesCount = view.getUint16(12, true);
      const deltaProjectilesCount = view.getUint16(14, true);
      const fullLootBagsCount = view.getUint16(16, true);
      const deltaLootBagsCount = view.getUint16(18, true);

      let offset = 20;

      if (selfMode === SELF_MODE_FULL) {
        const xq = view.getUint16(offset, true);
        const yq = view.getUint16(offset + 2, true);
        const hp = view.getUint16(offset + 4, true);
        const maxHp = view.getUint16(offset + 6, true);
        const mana = view.getUint16(offset + 8, true) / MANA_SCALE;
        const maxMana = view.getUint16(offset + 10, true) / MANA_SCALE;
        const pendingHeal = view.getUint16(offset + 12, true) / HEAL_SCALE;
        const pendingMana = view.getUint16(offset + 14, true) / MANA_SCALE;
        const copper = view.getUint16(offset + 16, true);
        const level = view.getUint16(offset + 18, true);
        const exp = view.getUint32(offset + 20, true);
        const expToNext = view.getUint32(offset + 24, true);
        offset += 28;
        const prevSelf = entityRuntime.self;
        entityRuntime.self = {
          x: xq / POS_SCALE,
          y: yq / POS_SCALE,
          hp,
          maxHp,
          pendingHeal,
          pendingMana,
          mana,
          maxMana,
          copper: prevSelf ? prevSelf.copper : copper,
          level: prevSelf ? prevSelf.level : level,
          exp: prevSelf ? prevSelf.exp : exp,
          expToNext: prevSelf ? prevSelf.expToNext : expToNext,
          skillPoints: prevSelf ? prevSelf.skillPoints : 0,
          abilityLevels:
            prevSelf && prevSelf.abilityLevels && typeof prevSelf.abilityLevels === "object"
              ? { ...prevSelf.abilityLevels }
              : {},
          _xq: xq,
          _yq: yq
        };
      } else if (selfMode === SELF_MODE_DELTA) {
        const base = entityRuntime.self || {
          x: 0,
          y: 0,
          hp: 0,
          maxHp: 0,
          pendingHeal: 0,
          pendingMana: 0,
          mana: 0,
          maxMana: 0,
          copper: 0,
          level: 1,
          exp: 0,
          expToNext: 20,
          skillPoints: 0,
          abilityLevels: {},
          _xq: 0,
          _yq: 0
        };
        const dx = view.getInt8(offset);
        const dy = view.getInt8(offset + 1);
        offset += 2;
        base._xq = clamp(base._xq + dx, 0, 65535);
        base._yq = clamp(base._yq + dy, 0, 65535);
        if (selfFlags & DELTA_FLAG_HP_CHANGED) {
          base.hp = view.getUint16(offset, true);
          offset += 2;
        }
        if (selfFlags & DELTA_FLAG_MAX_HP_CHANGED) {
          base.maxHp = view.getUint16(offset, true);
          offset += 2;
        }
        if (selfFlags & DELTA_FLAG_MANA_CHANGED) {
          base.mana = view.getUint16(offset, true) / MANA_SCALE;
          offset += 2;
        }
        if (selfFlags & DELTA_FLAG_MAX_MANA_CHANGED) {
          base.maxMana = view.getUint16(offset, true) / MANA_SCALE;
          offset += 2;
        }
        if (selfFlags & DELTA_FLAG_PENDING_HEAL_CHANGED) {
          base.pendingHeal = view.getUint16(offset, true) / HEAL_SCALE;
          offset += 2;
        }
        if (selfFlags & SELF_FLAG_PENDING_MANA_CHANGED) {
          base.pendingMana = view.getUint16(offset, true) / MANA_SCALE;
          offset += 2;
        }
        if (selfFlags & DELTA_FLAG_COPPER_CHANGED) {
          const packetCopper = view.getUint16(offset, true);
          if (base.copper === undefined || base.copper === null) {
            base.copper = packetCopper;
          }
          offset += 2;
        }
        if (selfFlags & DELTA_FLAG_PROGRESS_CHANGED) {
          const packetLevel = view.getUint16(offset, true);
          const packetExp = view.getUint32(offset + 2, true);
          const packetExpToNext = view.getUint32(offset + 6, true);
          if (base.level === undefined || base.level === null) {
            base.level = packetLevel;
          }
          if (base.exp === undefined || base.exp === null) {
            base.exp = packetExp;
          }
          if (base.expToNext === undefined || base.expToNext === null) {
            base.expToNext = packetExpToNext;
          }
          offset += 10;
        }
        base.x = base._xq / POS_SCALE;
        base.y = base._yq / POS_SCALE;
        entityRuntime.self = base;
      }

      for (let i = 0; i < fullPlayersCount; i += 1) {
        const id = view.getUint16(offset, true);
        const xq = view.getUint16(offset + 2, true);
        const yq = view.getUint16(offset + 4, true);
        const hp = view.getUint16(offset + 6, true);
        const maxHp = view.getUint16(offset + 8, true);
        offset += 10;

        const meta = entityRuntime.playerMeta.get(id);
        entityRuntime.players.set(id, {
          id,
          x: xq / POS_SCALE,
          y: yq / POS_SCALE,
          hp,
          maxHp,
          name: (meta && meta.name) || `P${id}`,
          classType: String((meta && meta.classType) || getDefaultClassId()),
          _xq: xq,
          _yq: yq
        });
      }

      for (let i = 0; i < deltaPlayersCount; i += 1) {
        const id = view.getUint8(offset);
        const dx = view.getInt8(offset + 1);
        const dy = view.getInt8(offset + 2);
        const flags = view.getUint8(offset + 3);
        offset += 4;

        if (flags & DELTA_FLAG_REMOVED) {
          entityRuntime.players.delete(id);
          remotePlayerCasts && remotePlayerCasts.delete(id);
          remotePlayerStuns && remotePlayerStuns.delete(id);
          remotePlayerSlows && remotePlayerSlows.delete(id);
          remotePlayerBurns && remotePlayerBurns.delete(id);
          continue;
        }

        const meta = entityRuntime.playerMeta.get(id);
        const entity = entityRuntime.players.get(id) || {
          id,
          x: 0,
          y: 0,
          hp: 0,
          maxHp: 0,
          name: (meta && meta.name) || `P${id}`,
          classType: String((meta && meta.classType) || getDefaultClassId()),
          _xq: 0,
          _yq: 0
        };
        entity._xq = clamp(entity._xq + dx, 0, 65535);
        entity._yq = clamp(entity._yq + dy, 0, 65535);
        if (flags & DELTA_FLAG_HP_CHANGED) {
          entity.hp = view.getUint16(offset, true);
          offset += 2;
        }
        if (flags & DELTA_FLAG_MAX_HP_CHANGED) {
          entity.maxHp = view.getUint16(offset, true);
          offset += 2;
        }
        entity.x = entity._xq / POS_SCALE;
        entity.y = entity._yq / POS_SCALE;
        entityRuntime.players.set(id, entity);
      }

      for (let i = 0; i < fullMobsCount; i += 1) {
        const id = view.getUint16(offset, true);
        const xq = view.getUint16(offset + 2, true);
        const yq = view.getUint16(offset + 4, true);
        const hp = view.getUint16(offset + 6, true);
        const maxHp = view.getUint16(offset + 8, true);
        offset += 10;
        const meta = entityRuntime.mobMeta.get(id);

        entityRuntime.mobs.set(id, {
          id,
          name: (meta && meta.name) || `Mob ${id}`,
          level: Math.max(1, Math.floor(Number((meta && meta.level) || 1))),
          renderStyle: (meta && meta.renderStyle) || null,
          x: xq / POS_SCALE,
          y: yq / POS_SCALE,
          hp,
          maxHp,
          _xq: xq,
          _yq: yq
        });
      }

      for (let i = 0; i < deltaMobsCount; i += 1) {
        const id = view.getUint8(offset);
        const dx = view.getInt8(offset + 1);
        const dy = view.getInt8(offset + 2);
        const flags = view.getUint8(offset + 3);
        offset += 4;

        if (flags & DELTA_FLAG_REMOVED) {
          entityRuntime.mobs.delete(id);
          stopMobCastSpatialLoop(id);
          remoteMobCasts && remoteMobCasts.delete(id);
          remoteMobStuns && remoteMobStuns.delete(id);
          remoteMobSlows && remoteMobSlows.delete(id);
          remoteMobBurns && remoteMobBurns.delete(id);
          continue;
        }

        const entity = entityRuntime.mobs.get(id) || {
          id,
          name: ((entityRuntime.mobMeta.get(id) || {}).name) || `Mob ${id}`,
          level: Math.max(1, Math.floor(Number(((entityRuntime.mobMeta.get(id) || {}).level) || 1))),
          renderStyle: ((entityRuntime.mobMeta.get(id) || {}).renderStyle) || null,
          x: 0,
          y: 0,
          hp: 0,
          maxHp: 0,
          _xq: 0,
          _yq: 0
        };
        entity._xq = clamp(entity._xq + dx, 0, 65535);
        entity._yq = clamp(entity._yq + dy, 0, 65535);
        if (flags & DELTA_FLAG_HP_CHANGED) {
          entity.hp = view.getUint16(offset, true);
          offset += 2;
        }
        if (flags & DELTA_FLAG_MAX_HP_CHANGED) {
          entity.maxHp = view.getUint16(offset, true);
          offset += 2;
        }
        entity.x = entity._xq / POS_SCALE;
        entity.y = entity._yq / POS_SCALE;
        if (!entity.renderStyle) {
          const meta = entityRuntime.mobMeta.get(id);
          entity.renderStyle = (meta && meta.renderStyle) || null;
        }
        entityRuntime.mobs.set(id, entity);
      }

      for (let i = 0; i < fullProjectilesCount; i += 1) {
        const id = view.getUint16(offset, true);
        const xq = view.getUint16(offset + 2, true);
        const yq = view.getUint16(offset + 4, true);
        offset += 6;
        const meta = entityRuntime.projectileMeta.get(id);

        entityRuntime.projectiles.set(id, {
          id,
          x: xq / POS_SCALE,
          y: yq / POS_SCALE,
          abilityId: meta ? String(meta.abilityId || "") : "",
          _xq: xq,
          _yq: yq
        });
      }

      for (let i = 0; i < deltaProjectilesCount; i += 1) {
        const id = view.getUint8(offset);
        const dx = view.getInt8(offset + 1);
        const dy = view.getInt8(offset + 2);
        const flags = view.getUint8(offset + 3);
        offset += 4;

        if (flags & DELTA_FLAG_REMOVED) {
          entityRuntime.projectiles.delete(id);
          stopProjectileFlightSpatialLoop(id);
          continue;
        }

        const meta = entityRuntime.projectileMeta.get(id);
        const entity = entityRuntime.projectiles.get(id) || {
          id,
          x: 0,
          y: 0,
          abilityId: meta ? String(meta.abilityId || "") : "",
          _xq: 0,
          _yq: 0
        };
        entity._xq = clamp(entity._xq + dx, 0, 65535);
        entity._yq = clamp(entity._yq + dy, 0, 65535);
        entity.x = entity._xq / POS_SCALE;
        entity.y = entity._yq / POS_SCALE;
        if (meta) {
          entity.abilityId = String(meta.abilityId || "");
        }
        entityRuntime.projectiles.set(id, entity);
      }

      for (let i = 0; i < fullLootBagsCount; i += 1) {
        const id = view.getUint16(offset, true);
        const xq = view.getUint16(offset + 2, true);
        const yq = view.getUint16(offset + 4, true);
        offset += 6;
        const meta = entityRuntime.lootBagMeta.get(id);

        entityRuntime.lootBags.set(id, {
          id,
          x: xq / POS_SCALE,
          y: yq / POS_SCALE,
          items: meta ? meta.items : [],
          _xq: xq,
          _yq: yq
        });
      }

      for (let i = 0; i < deltaLootBagsCount; i += 1) {
        const id = view.getUint8(offset);
        const dx = view.getInt8(offset + 1);
        const dy = view.getInt8(offset + 2);
        const flags = view.getUint8(offset + 3);
        offset += 4;

        if (flags & DELTA_FLAG_REMOVED) {
          entityRuntime.lootBags.delete(id);
          entityRuntime.lootBagMeta.delete(id);
          continue;
        }

        const meta = entityRuntime.lootBagMeta.get(id);
        const entity = entityRuntime.lootBags.get(id) || {
          id,
          x: 0,
          y: 0,
          items: meta ? meta.items : [],
          _xq: 0,
          _yq: 0
        };
        entity._xq = clamp(entity._xq + dx, 0, 65535);
        entity._yq = clamp(entity._yq + dy, 0, 65535);
        entity.x = entity._xq / POS_SCALE;
        entity.y = entity._yq / POS_SCALE;
        entity.items = meta ? meta.items : entity.items || [];
        entityRuntime.lootBags.set(id, entity);
      }

      syncEntityArraysToGameState();
      syncSelfToGameState();
      if (gameState.self) {
        pushSnapshot({
          self: gameState.self,
          players: gameState.players,
          projectiles: gameState.projectiles,
          mobs: gameState.mobs,
          lootBags: gameState.lootBags
        });
      }
    }

    function parseMobEffectBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== MOB_EFFECT_PROTO_TYPE || view.getUint8(1) !== MOB_EFFECT_PROTO_VERSION) {
        return;
      }

      const eventCount = view.getUint16(2, true);
      let offset = 4;
      const now = performance.now();
      for (let i = 0; i < eventCount; i += 1) {
        if (offset + 2 > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const flags = view.getUint8(offset + 1);
        offset += 2;

        if (flags & MOB_EFFECT_FLAG_REMOVE) {
          remoteMobStuns && remoteMobStuns.delete(id);
          remoteMobSlows && remoteMobSlows.delete(id);
          remoteMobBurns && remoteMobBurns.delete(id);
          continue;
        }

        if (flags & MOB_EFFECT_FLAG_STUN) {
          if (offset + 2 > view.byteLength) {
            break;
          }
          const stunnedMs = Math.max(1, view.getUint16(offset, true));
          offset += 2;
          remoteMobStuns &&
            remoteMobStuns.set(id, {
              endsAt: now + stunnedMs
            });
        } else {
          remoteMobStuns && remoteMobStuns.delete(id);
        }

        if (flags & MOB_EFFECT_FLAG_SLOW) {
          if (offset + 4 > view.byteLength) {
            break;
          }
          const slowedMs = Math.max(1, view.getUint16(offset, true));
          const slowMultiplierQ = Math.max(1, view.getUint16(offset + 2, true));
          offset += 4;
          remoteMobSlows &&
            remoteMobSlows.set(id, {
              endsAt: now + slowedMs,
              multiplier: clamp(slowMultiplierQ / 1000, 0.1, 1)
            });
        } else {
          remoteMobSlows && remoteMobSlows.delete(id);
        }

        if (flags & MOB_EFFECT_FLAG_BURN) {
          if (offset + 2 > view.byteLength) {
            break;
          }
          const burningMs = Math.max(1, view.getUint16(offset, true));
          offset += 2;
          remoteMobBurns &&
            remoteMobBurns.set(id, {
              endsAt: now + burningMs
            });
        } else {
          remoteMobBurns && remoteMobBurns.delete(id);
        }
      }
    }

    function parseAreaEffectBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== areaEffectProtoType || view.getUint8(1) !== areaEffectProtoVersion) {
        return;
      }

      const eventCount = view.getUint16(2, true);
      let offset = 4;
      const now = performance.now();

      for (let i = 0; i < eventCount; i += 1) {
        if (offset + 5 > view.byteLength) {
          break;
        }
        const op = view.getUint8(offset);
        const numericId = view.getUint32(offset + 1, true);
        offset += 5;
        const id = String(numericId);

        if (op === areaEffectOpRemove) {
          activeAreaEffectsById && activeAreaEffectsById.delete(id);
          continue;
        }
        if (op !== areaEffectOpUpsert) {
          continue;
        }

        if (offset + 12 > view.byteLength) {
          break;
        }
        const kindByte = view.getUint8(offset);
        const x = dequantizePos(view.getUint16(offset + 1, true));
        const y = dequantizePos(view.getUint16(offset + 3, true));
        const radius = dequantizePos(view.getUint16(offset + 5, true));
        const remainingMs = view.getUint16(offset + 7, true);
        const durationMs = view.getUint16(offset + 9, true);
        const abilityLen = view.getUint8(offset + 11);
        offset += 12;

        if (offset + abilityLen > view.byteLength) {
          break;
        }
        const abilityBytes = new Uint8Array(arrayBuffer, offset, abilityLen);
        const abilityId = textDecoder.decode(abilityBytes).trim().toLowerCase();
        offset += abilityLen;

        const payload = {
          id,
          x,
          y,
          radius,
          remainingMs,
          durationMs,
          abilityId,
          kind:
            kindByte === areaEffectKindBeam
              ? "beam"
              : kindByte === areaEffectKindSummon
                ? "summon"
                : "area"
        };

        if (kindByte === areaEffectKindBeam) {
          if (offset + 12 > view.byteLength) {
            break;
          }
          payload.startX = dequantizePos(view.getUint16(offset, true));
          payload.startY = dequantizePos(view.getUint16(offset + 2, true));
          payload.dx = view.getInt16(offset + 4, true) / 1000;
          payload.dy = view.getInt16(offset + 6, true) / 1000;
          payload.length = dequantizePos(view.getUint16(offset + 8, true));
          payload.width = dequantizePos(view.getUint16(offset + 10, true));
          offset += 12;
        } else if (kindByte === areaEffectKindSummon) {
          if (offset + 7 > view.byteLength) {
            break;
          }
          payload.summonCount = view.getUint8(offset);
          payload.attackIntervalMs = view.getUint16(offset + 1, true);
          payload.attackRange = dequantizePos(view.getUint16(offset + 3, true));
          payload.formationRadius = dequantizePos(view.getUint16(offset + 5, true));
          offset += 7;
        }

        upsertAreaEffectState(payload, now);
      }
    }

    function parseMobMetaBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== MOB_META_PROTO_TYPE) {
        return;
      }
      const version = view.getUint8(1);
      if (version !== 1 && version !== MOB_META_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      for (let i = 0; i < count; i += 1) {
        const headerSize = version >= 2 ? 6 : 4;
        if (offset + headerSize > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const nameLen = view.getUint8(offset + 1);
        const level = version >= 2 ? view.getUint16(offset + 2, true) : 1;
        const styleLen = view.getUint16(offset + (version >= 2 ? 4 : 2), true);
        offset += headerSize;
        if (offset + nameLen + styleLen > view.byteLength) {
          break;
        }

        const nameBytes = new Uint8Array(arrayBuffer, offset, nameLen);
        const name = textDecoder.decode(nameBytes).trim() || `Mob ${id}`;
        offset += nameLen;

        let renderStyle = null;
        if (styleLen > 0) {
          const styleBytes = new Uint8Array(arrayBuffer, offset, styleLen);
          const styleJson = textDecoder.decode(styleBytes);
          try {
            renderStyle = normalizeMobRenderStyle(JSON.parse(styleJson));
          } catch (_error) {
            renderStyle = null;
          }
          offset += styleLen;
        }

        entityRuntime.mobMeta.set(id, { name, level, renderStyle });
        const existing = entityRuntime.mobs.get(id);
        if (existing) {
          existing.name = name;
          existing.level = level;
          existing.renderStyle = renderStyle;
          entityRuntime.mobs.set(id, existing);
        }
      }

      syncEntityArraysToGameState();
    }

    function parseProjectileMetaBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== PROJECTILE_META_PROTO_TYPE) {
        return;
      }
      const version = view.getUint8(1);
      if (version !== 1 && version !== 2 && version !== PROJECTILE_META_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      for (let i = 0; i < count; i += 1) {
        let id = 0;
        let abilityId = "";
        if (version >= 3) {
          if (offset + 6 > view.byteLength) {
            break;
          }
          id = view.getUint16(offset, true);
          abilityId = resolveAbilityIdHash(view.getUint32(offset + 2, true));
          offset += 6;
        } else if (version >= 2) {
          if (offset + 5 > view.byteLength) {
            break;
          }
          id = view.getUint8(offset);
          abilityId = resolveAbilityIdHash(view.getUint32(offset + 1, true));
          offset += 5;
        } else {
          if (offset + 2 > view.byteLength) {
            break;
          }
          id = view.getUint8(offset);
          const abilityLen = view.getUint8(offset + 1);
          offset += 2;
          if (offset + abilityLen > view.byteLength) {
            break;
          }
          const abilityBytes = new Uint8Array(arrayBuffer, offset, abilityLen);
          abilityId = textDecoder.decode(abilityBytes).trim().toLowerCase();
          offset += abilityLen;
        }

        entityRuntime.projectileMeta.set(id, { abilityId });
        const existing = entityRuntime.projectiles.get(id);
        if (existing) {
          existing.abilityId = abilityId;
          entityRuntime.projectiles.set(id, existing);
        }
      }

      syncEntityArraysToGameState();
    }

    function parsePlayerMetaBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      const packetType = view.getUint8(0);
      const version = view.getUint8(1);
      if (packetType !== PLAYER_META_PROTO_TYPE || (version !== PLAYER_META_PROTO_VERSION && version !== 1)) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      const players = [];
      for (let index = 0; index < count; index += 1) {
        const headerSize = version >= 2 ? 5 : 3;
        if (offset + headerSize > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const nameLen = view.getUint8(offset + 1);
        const classLen = view.getUint8(offset + 2);
        const appearanceLen = version >= 2 ? view.getUint16(offset + 3, true) : 0;
        offset += headerSize;
        if (offset + nameLen + classLen + appearanceLen > view.byteLength) {
          break;
        }
        const name = textDecoder.decode(new Uint8Array(arrayBuffer, offset, nameLen)).trim() || `P${id}`;
        offset += nameLen;
        const classType = textDecoder.decode(new Uint8Array(arrayBuffer, offset, classLen)).trim() || getDefaultClassId();
        offset += classLen;
        let appearance = null;
        if (appearanceLen > 0) {
          const appearanceJson = textDecoder.decode(new Uint8Array(arrayBuffer, offset, appearanceLen)).trim();
          offset += appearanceLen;
          if (appearanceJson) {
            try {
              appearance = JSON.parse(appearanceJson);
            } catch (_error) {
              appearance = null;
            }
          }
        }
        players.push({ id, name, classType, appearance });
      }

      if (players.length) {
        applyPlayerMetaEntries(players);
        syncEntityArraysToGameState();
      }
    }

    function parseLootBagMetaBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== LOOTBAG_META_PROTO_TYPE || view.getUint8(1) !== LOOTBAG_META_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      const bags = [];
      for (let bagIndex = 0; bagIndex < count; bagIndex += 1) {
        if (offset + 2 > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const itemCount = view.getUint8(offset + 1);
        offset += 2;
        const items = [];
        for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
          if (offset + 3 > view.byteLength) {
            break;
          }
          const qty = view.getUint16(offset, true);
          const itemIdLen = view.getUint8(offset + 2);
          offset += 3;
          if (offset + itemIdLen > view.byteLength) {
            break;
          }
          const itemId = textDecoder.decode(new Uint8Array(arrayBuffer, offset, itemIdLen)).trim();
          offset += itemIdLen;
          items.push({ itemId, qty });
        }
        bags.push({ id, items });
      }

      if (bags.length) {
        applyLootBagMetaEntries(bags);
        syncEntityArraysToGameState();
      }
    }

    function parsePlayerSwingBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== PLAYER_SWING_PROTO_TYPE || view.getUint8(1) !== PLAYER_SWING_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      for (let index = 0; index < count; index += 1) {
        if (offset + 3 > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const dx = decodeUnitDirectionComponent(view.getInt8(offset + 1));
        const dy = decodeUnitDirectionComponent(view.getInt8(offset + 2));
        offset += 3;
        triggerRemotePlayerSwing(id, dx, dy);
      }
    }

    function parseCastEventBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== CAST_EVENT_PROTO_TYPE || view.getUint8(1) !== CAST_EVENT_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      const playerCasts = [];
      const mobCasts = [];
      let selfCast = null;
      for (let index = 0; index < count; index += 1) {
        if (offset + 3 > view.byteLength) {
          break;
        }
        const kind = view.getUint8(offset);
        const id = view.getUint8(offset + 1);
        const flags = view.getUint8(offset + 2);
        offset += 3;
        const active = !!(flags & CAST_EVENT_FLAG_ACTIVE);
        const isCharge = !!(flags & CAST_EVENT_FLAG_CHARGE);
        
        if (active && offset + 8 > view.byteLength) {
          break;
        }
        
        let target;
        if (active) {
          target = {
            id,
            active: true,
            abilityId: resolveAbilityIdHash(view.getUint32(offset, true)),
            durationMs: view.getUint16(offset + 4, true),
            elapsedMs: view.getUint16(offset + 6, true)
          };
          offset += 8;
          
          if (isCharge && offset + 8 > view.byteLength) {
            break;
          }
          if (isCharge) {
            target.isCharge = true;
            target.chargeStartX = dequantizePos(view.getUint16(offset, true));
            target.chargeStartY = dequantizePos(view.getUint16(offset + 2, true));
            target.chargeTargetX = dequantizePos(view.getUint16(offset + 4, true));
            target.chargeTargetY = dequantizePos(view.getUint16(offset + 6, true));
            offset += 8;
          }
        } else {
          target = { id, active: false };
        }

        if (kind === CAST_EVENT_KIND_SELF) {
          selfCast = active ? { active: true, abilityId: target.abilityId, durationMs: target.durationMs, elapsedMs: target.elapsedMs, isCharge: target.isCharge, chargeStartX: target.chargeStartX, chargeStartY: target.chargeStartY, chargeTargetX: target.chargeTargetX, chargeTargetY: target.chargeTargetY } : { active: false };
        } else if (kind === CAST_EVENT_KIND_MOB) {
          mobCasts.push(target);
        } else if (kind === CAST_EVENT_KIND_PLAYER) {
          playerCasts.push(target);
        }
      }

      if (playerCasts.length || selfCast) {
        applyPlayerCastStates({
          casts: playerCasts,
          self: selfCast
        });
      }
      if (mobCasts.length) {
        applyMobCastStates({ casts: mobCasts });
      }
    }

    function parsePlayerEffectBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 5) {
        return;
      }
      if (view.getUint8(0) !== PLAYER_EFFECT_PROTO_TYPE || view.getUint8(1) !== PLAYER_EFFECT_PROTO_VERSION) {
        return;
      }

      const selfFlags = view.getUint8(2);
      const count = view.getUint16(3, true);
      let offset = 5;

      function readEffectPayload(flags, target) {
        if (flags & MOB_EFFECT_FLAG_STUN) {
          target.stunnedMs = view.getUint16(offset, true);
          target.stunDurationMs = view.getUint16(offset + 2, true);
          offset += 4;
        }
        if (flags & MOB_EFFECT_FLAG_SLOW) {
          target.slowedMs = view.getUint16(offset, true);
          target.slowDurationMs = view.getUint16(offset + 2, true);
          target.slowMultiplierQ = view.getUint16(offset + 4, true);
          offset += 6;
        }
        if (flags & MOB_EFFECT_FLAG_BURN) {
          target.burningMs = view.getUint16(offset, true);
          target.burnDurationMs = view.getUint16(offset + 2, true);
          offset += 4;
        }
        if (flags & MOB_EFFECT_FLAG_BLOOD_WRATH) {
          target.bloodWrathMs = view.getUint16(offset, true);
          offset += 2;
        }
      }

      if (selfFlags) {
        if (selfFlags === MOB_EFFECT_FLAG_REMOVE) {
          applyPlayerEffects({});
        } else {
          const selfEffect = {};
          readEffectPayload(selfFlags, selfEffect);
          applyPlayerEffects(selfEffect);
        }
      }

      const effects = [];
      for (let index = 0; index < count; index += 1) {
        if (offset + 2 > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const flags = view.getUint8(offset + 1);
        offset += 2;
        const effect = { id };
        if (flags !== MOB_EFFECT_FLAG_REMOVE) {
          readEffectPayload(flags, effect);
        }
        effects.push(effect);
      }

      if (effects.length) {
        applyNearbyPlayerEffects({ effects });
      }
    }

    function parseMobBiteBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== MOB_BITE_PROTO_TYPE || view.getUint8(1) !== MOB_BITE_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      for (let index = 0; index < count; index += 1) {
        if (offset + 7 > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const dx = decodeUnitDirectionComponent(view.getInt8(offset + 1));
        const dy = decodeUnitDirectionComponent(view.getInt8(offset + 2));
        const abilityId = resolveAbilityIdHash(view.getUint32(offset + 3, true));
        offset += 7;
        triggerRemoteMobBite(id, dx, dy, abilityId);
      }
    }

    function parseExplosionEventBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== EXPLOSION_EVENT_PROTO_TYPE || view.getUint8(1) !== EXPLOSION_EVENT_PROTO_VERSION) {
        return;
      }
      const count = view.getUint16(2, true);
      let offset = 4;
      const events = [];
      for (let index = 0; index < count; index += 1) {
        if (offset + 10 > view.byteLength) {
          break;
        }
        events.push({
          x: dequantizePos(view.getUint16(offset, true)),
          y: dequantizePos(view.getUint16(offset + 2, true)),
          radius: dequantizePos(view.getUint16(offset + 4, true)),
          abilityId: resolveAbilityIdHash(view.getUint32(offset + 6, true))
        });
        offset += 10;
      }
      if (events.length) {
        addExplosionEvents(events);
      }
    }

    function parseProjectileHitEventBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (
        view.getUint8(0) !== PROJECTILE_HIT_EVENT_PROTO_TYPE ||
        view.getUint8(1) !== PROJECTILE_HIT_EVENT_PROTO_VERSION
      ) {
        return;
      }
      const count = view.getUint16(2, true);
      let offset = 4;
      const events = [];
      for (let index = 0; index < count; index += 1) {
        if (offset + 8 > view.byteLength) {
          break;
        }
        events.push({
          x: dequantizePos(view.getUint16(offset, true)),
          y: dequantizePos(view.getUint16(offset + 2, true)),
          abilityId: resolveAbilityIdHash(view.getUint32(offset + 4, true))
        });
        offset += 8;
      }
      if (events.length) {
        addProjectileHitEvents(events);
      }
    }

    function parseMobDeathEventBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== MOB_DEATH_EVENT_PROTO_TYPE || view.getUint8(1) !== MOB_DEATH_EVENT_PROTO_VERSION) {
        return;
      }
      const count = view.getUint16(2, true);
      let offset = 4;
      const events = [];
      for (let index = 0; index < count; index += 1) {
        if (offset + 5 > view.byteLength) {
          break;
        }
        const x = dequantizePos(view.getUint16(offset, true));
        const y = dequantizePos(view.getUint16(offset + 2, true));
        const mobTypeLen = view.getUint8(offset + 4);
        offset += 5;
        if (offset + mobTypeLen > view.byteLength) {
          break;
        }
        const mobType = textDecoder.decode(new Uint8Array(arrayBuffer, offset, mobTypeLen)).trim() || "Mob";
        offset += mobTypeLen;
        events.push({ x, y, mobType });
      }
      if (events.length) {
        addMobDeathEvents(events);
      }
    }

    function parseDamageEventBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== DAMAGE_EVENT_PROTO_TYPE || view.getUint8(1) !== DAMAGE_EVENT_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      const events = [];
      for (let i = 0; i < count; i += 1) {
        if (offset + 7 > view.byteLength) {
          break;
        }
        const x = dequantizePos(view.getUint16(offset, true));
        const y = dequantizePos(view.getUint16(offset + 2, true));
        const amount = view.getUint16(offset + 4, true);
        const flags = view.getUint8(offset + 6);
        offset += 7;
        const decodedFlags = decodeDamageEventFlags(flags);
        events.push({
          x,
          y,
          amount,
          targetType: decodedFlags.targetType,
          fromSelf: decodedFlags.fromSelf
        });
      }

      if (events.length) {
        addFloatingDamageEvents(events);
      }
    }

    function parseBinaryPacket(arrayBuffer) {
      if (!(arrayBuffer instanceof ArrayBuffer)) {
        return;
      }
      if (arrayBuffer.byteLength < 2) {
        return;
      }
      const type = new DataView(arrayBuffer).getUint8(0);
      if (type === ENTITY_PROTO_TYPE) {
        parseEntityBinaryPacket(arrayBuffer);
        return;
      }
      if (type === MOB_EFFECT_PROTO_TYPE) {
        parseMobEffectBinaryPacket(arrayBuffer);
        return;
      }
      if (type === AREA_EFFECT_PROTO_TYPE) {
        parseAreaEffectBinaryPacket(arrayBuffer);
        return;
      }
      if (type === MOB_META_PROTO_TYPE) {
        parseMobMetaBinaryPacket(arrayBuffer);
        return;
      }
      if (type === PROJECTILE_META_PROTO_TYPE) {
        parseProjectileMetaBinaryPacket(arrayBuffer);
        return;
      }
      if (type === PLAYER_META_PROTO_TYPE) {
        parsePlayerMetaBinaryPacket(arrayBuffer);
        return;
      }
      if (type === LOOTBAG_META_PROTO_TYPE) {
        parseLootBagMetaBinaryPacket(arrayBuffer);
        return;
      }
      if (type === PLAYER_SWING_PROTO_TYPE) {
        parsePlayerSwingBinaryPacket(arrayBuffer);
        return;
      }
      if (type === CAST_EVENT_PROTO_TYPE) {
        parseCastEventBinaryPacket(arrayBuffer);
        return;
      }
      if (type === PLAYER_EFFECT_PROTO_TYPE) {
        parsePlayerEffectBinaryPacket(arrayBuffer);
        return;
      }
      if (type === MOB_BITE_PROTO_TYPE) {
        parseMobBiteBinaryPacket(arrayBuffer);
        return;
      }
      if (type === EXPLOSION_EVENT_PROTO_TYPE) {
        parseExplosionEventBinaryPacket(arrayBuffer);
        return;
      }
      if (type === PROJECTILE_HIT_EVENT_PROTO_TYPE) {
        parseProjectileHitEventBinaryPacket(arrayBuffer);
        return;
      }
      if (type === MOB_DEATH_EVENT_PROTO_TYPE) {
        parseMobDeathEventBinaryPacket(arrayBuffer);
        return;
      }
      if (type === DAMAGE_EVENT_PROTO_TYPE) {
        parseDamageEventBinaryPacket(arrayBuffer);
      }
    }

    return {
      parseEntityBinaryPacket,
      parseMobEffectBinaryPacket,
      parseAreaEffectBinaryPacket,
      parseMobMetaBinaryPacket,
      parseProjectileMetaBinaryPacket,
      parsePlayerMetaBinaryPacket,
      parseLootBagMetaBinaryPacket,
      parsePlayerSwingBinaryPacket,
      parseCastEventBinaryPacket,
      parsePlayerEffectBinaryPacket,
      parseMobBiteBinaryPacket,
      parseExplosionEventBinaryPacket,
      parseProjectileHitEventBinaryPacket,
      parseMobDeathEventBinaryPacket,
      parseDamageEventBinaryPacket,
      parseBinaryPacket
    };
  }

  globalScope.VibeClientNetworkPackets = Object.freeze({
    createNetworkPacketParsers
  });
})(globalThis);
