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

    const {
      ENTITY_PROTO_TYPE,
      ENTITY_PROTO_VERSION,
      MOB_EFFECT_PROTO_TYPE,
      MOB_EFFECT_PROTO_VERSION,
      AREA_EFFECT_PROTO_TYPE,
      AREA_EFFECT_PROTO_VERSION,
      MOB_META_PROTO_TYPE,
      MOB_META_PROTO_VERSION,
      PROJECTILE_META_PROTO_TYPE,
      PROJECTILE_META_PROTO_VERSION,
      DAMAGE_EVENT_PROTO_TYPE,
      DAMAGE_EVENT_PROTO_VERSION,
      MOB_EFFECT_FLAG_STUN,
      MOB_EFFECT_FLAG_SLOW,
      MOB_EFFECT_FLAG_REMOVE,
      MOB_EFFECT_FLAG_BURN,
      AREA_EFFECT_OP_UPSERT,
      AREA_EFFECT_OP_REMOVE,
      AREA_EFFECT_KIND_BEAM,
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
        const hp = view.getUint8(offset + 4);
        const maxHp = view.getUint8(offset + 5);
        const mana = view.getUint16(offset + 6, true) / MANA_SCALE;
        const maxMana = view.getUint16(offset + 8, true) / MANA_SCALE;
        const pendingHeal = view.getUint16(offset + 10, true) / HEAL_SCALE;
        const pendingMana = view.getUint16(offset + 12, true) / MANA_SCALE;
        const copper = view.getUint16(offset + 14, true);
        const level = view.getUint16(offset + 16, true);
        const exp = view.getUint32(offset + 18, true);
        const expToNext = view.getUint32(offset + 22, true);
        offset += 26;
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
          base.hp = view.getUint8(offset);
          offset += 1;
        }
        if (selfFlags & DELTA_FLAG_MAX_HP_CHANGED) {
          base.maxHp = view.getUint8(offset);
          offset += 1;
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
        const hp = view.getUint8(offset + 6);
        const maxHp = view.getUint8(offset + 7);
        offset += 8;

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
          entity.hp = view.getUint8(offset);
          offset += 1;
        }
        if (flags & DELTA_FLAG_MAX_HP_CHANGED) {
          entity.maxHp = view.getUint8(offset);
          offset += 1;
        }
        entity.x = entity._xq / POS_SCALE;
        entity.y = entity._yq / POS_SCALE;
        entityRuntime.players.set(id, entity);
      }

      for (let i = 0; i < fullMobsCount; i += 1) {
        const id = view.getUint16(offset, true);
        const xq = view.getUint16(offset + 2, true);
        const yq = view.getUint16(offset + 4, true);
        const hp = view.getUint8(offset + 6);
        const maxHp = view.getUint8(offset + 7);
        offset += 8;
        const meta = entityRuntime.mobMeta.get(id);

        entityRuntime.mobs.set(id, {
          id,
          name: (meta && meta.name) || `Mob ${id}`,
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
          entity.hp = view.getUint8(offset);
          offset += 1;
        }
        if (flags & DELTA_FLAG_MAX_HP_CHANGED) {
          entity.maxHp = view.getUint8(offset);
          offset += 1;
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
      if (view.getUint8(0) !== AREA_EFFECT_PROTO_TYPE || view.getUint8(1) !== AREA_EFFECT_PROTO_VERSION) {
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

        if (op === AREA_EFFECT_OP_REMOVE) {
          activeAreaEffectsById && activeAreaEffectsById.delete(id);
          continue;
        }
        if (op !== AREA_EFFECT_OP_UPSERT) {
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
          kind: kindByte === AREA_EFFECT_KIND_BEAM ? "beam" : "area"
        };

        if (kindByte === AREA_EFFECT_KIND_BEAM) {
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
        }

        upsertAreaEffectState(payload, now);
      }
    }

    function parseMobMetaBinaryPacket(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      if (view.byteLength < 4) {
        return;
      }
      if (view.getUint8(0) !== MOB_META_PROTO_TYPE || view.getUint8(1) !== MOB_META_PROTO_VERSION) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      for (let i = 0; i < count; i += 1) {
        if (offset + 4 > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const nameLen = view.getUint8(offset + 1);
        const styleLen = view.getUint16(offset + 2, true);
        offset += 4;
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

        entityRuntime.mobMeta.set(id, { name, renderStyle });
        const existing = entityRuntime.mobs.get(id);
        if (existing) {
          existing.name = name;
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
      if (
        view.getUint8(0) !== PROJECTILE_META_PROTO_TYPE ||
        view.getUint8(1) !== PROJECTILE_META_PROTO_VERSION
      ) {
        return;
      }

      const count = view.getUint16(2, true);
      let offset = 4;
      for (let i = 0; i < count; i += 1) {
        if (offset + 2 > view.byteLength) {
          break;
        }
        const id = view.getUint8(offset);
        const abilityLen = view.getUint8(offset + 1);
        offset += 2;
        if (offset + abilityLen > view.byteLength) {
          break;
        }
        const abilityBytes = new Uint8Array(arrayBuffer, offset, abilityLen);
        const abilityId = textDecoder.decode(abilityBytes).trim().toLowerCase();
        offset += abilityLen;

        entityRuntime.projectileMeta.set(id, { abilityId });
        const existing = entityRuntime.projectiles.get(id);
        if (existing) {
          existing.abilityId = abilityId;
          entityRuntime.projectiles.set(id, existing);
        }
      }

      syncEntityArraysToGameState();
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
        if (offset + 6 > view.byteLength) {
          break;
        }
        const x = dequantizePos(view.getUint16(offset, true));
        const y = dequantizePos(view.getUint16(offset + 2, true));
        const amount = view.getUint8(offset + 4);
        const flags = view.getUint8(offset + 5);
        offset += 6;
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
      parseDamageEventBinaryPacket,
      parseBinaryPacket
    };
  }

  globalScope.VibeClientNetworkPackets = Object.freeze({
    createNetworkPacketParsers
  });
})(globalThis);
