(function initVibeClientVfxRuntime(globalScope) {
  "use strict";

  function createVfxRuntimeTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const floatingDamageNumbers = deps.floatingDamageNumbers;
    const activeExplosions = deps.activeExplosions;
    const activeAreaEffectsById = deps.activeAreaEffectsById;
    const idState = deps.idState;
    if (!floatingDamageNumbers || !activeExplosions || !activeAreaEffectsById || !idState) {
      return null;
    }

    const damageFloatDurationMs = Math.max(1, Number(deps.damageFloatDurationMs) || 850);
    const addDpsSample = typeof deps.addDpsSample === "function" ? deps.addDpsSample : () => {};
    const toAbilityAudioId = typeof deps.toAbilityAudioId === "function" ? deps.toAbilityAudioId : () => "";
    const playAbilityAudioEvent =
      typeof deps.playAbilityAudioEvent === "function" ? deps.playAbilityAudioEvent : () => {};
    const normalizeDirection = typeof deps.normalizeDirection === "function" ? deps.normalizeDirection : () => null;
    const hashString = typeof deps.hashString === "function" ? deps.hashString : () => 0;
    const playMobEventSound = typeof deps.playMobEventSound === "function" ? deps.playMobEventSound : () => {};

    function addFloatingDamageEvents(events) {
      if (!Array.isArray(events) || !events.length) {
        return;
      }

      const now = performance.now();
      for (const event of events) {
        if (!event) {
          continue;
        }
        const x = Number(event.x);
        const y = Number(event.y);
        const amount = Math.max(0, Math.round(Number(event.amount) || 0));
        if (!Number.isFinite(x) || !Number.isFinite(y) || amount <= 0) {
          continue;
        }
        if (event.fromSelf) {
          addDpsSample(amount, now);
        }

        floatingDamageNumbers.push({
          id: Number(idState.nextDamageFloatId) || 1,
          x,
          y,
          amount,
          targetType: event.targetType === "player" ? "player" : "mob",
          createdAt: now,
          durationMs: damageFloatDurationMs,
          jitterX: (Math.random() - 0.5) * 0.34,
          riseOffset: Math.random() * 0.25
        });
        idState.nextDamageFloatId = (Number(idState.nextDamageFloatId) || 1) + 1;
      }
    }

    function addExplosionEvents(events) {
      if (!Array.isArray(events) || !events.length) {
        return;
      }

      const now = performance.now();
      const abilitiesToPlay = new Set();
      for (const event of events) {
        if (!event) {
          continue;
        }
        const x = Number(event.x);
        const y = Number(event.y);
        const radius = Math.max(0, Number(event.radius) || 0);
        if (!Number.isFinite(x) || !Number.isFinite(y) || radius <= 0) {
          continue;
        }

        activeExplosions.push({
          id: Number(idState.nextExplosionFxId) || 1,
          x,
          y,
          radius,
          abilityId: String(event.abilityId || ""),
          createdAt: now,
          durationMs: 380
        });
        idState.nextExplosionFxId = (Number(idState.nextExplosionFxId) || 1) + 1;

        const abilityId = toAbilityAudioId(event.abilityId);
        if (abilityId) {
          abilitiesToPlay.add(abilityId);
        }
      }

      for (const abilityId of abilitiesToPlay) {
        playAbilityAudioEvent(abilityId, "hit", now);
      }
    }

    function upsertAreaEffectState(raw, now = performance.now()) {
      if (!raw) {
        return;
      }
      const id = String(raw.id || "").trim();
      const x = Number(raw.x);
      const y = Number(raw.y);
      const radius = Math.max(0, Number(raw.radius) || 0);
      const remainingMs = Math.max(1, Math.floor(Number(raw.remainingMs) || 0));
      const durationMs = Math.max(1, Math.floor(Number(raw.durationMs) || remainingMs));
      const abilityId = String(raw.abilityId || "").toLowerCase();
      const kind = String(raw.kind || (abilityId === "arcanebeam" ? "beam" : "area")).toLowerCase();
      if (!id || !Number.isFinite(x) || !Number.isFinite(y) || radius <= 0) {
        return;
      }
      const existing = activeAreaEffectsById.get(id);
      const parsedDx = Number(raw.dx);
      const parsedDy = Number(raw.dy);
      const parsedLength = Math.max(0, Number(raw.length) || 0);
      const parsedWidth = Math.max(0, Number(raw.width) || 0);
      const normalizedDir = normalizeDirection(parsedDx, parsedDy);
      activeAreaEffectsById.set(id, {
        id,
        x,
        y,
        radius,
        kind,
        abilityId,
        durationMs,
        startedAt: existing ? existing.startedAt : now - Math.max(0, durationMs - remainingMs),
        endsAt: now + remainingMs,
        seed: existing ? existing.seed : hashString(`area:${id}`),
        startX: Number.isFinite(Number(raw.startX))
          ? Number(raw.startX)
          : existing && Number.isFinite(existing.startX)
            ? existing.startX
            : x,
        startY: Number.isFinite(Number(raw.startY))
          ? Number(raw.startY)
          : existing && Number.isFinite(existing.startY)
            ? existing.startY
            : y,
        dx: normalizedDir ? normalizedDir.dx : existing && Number.isFinite(existing.dx) ? existing.dx : 0,
        dy: normalizedDir ? normalizedDir.dy : existing && Number.isFinite(existing.dy) ? existing.dy : 1,
        length: parsedLength > 0 ? parsedLength : existing && Number.isFinite(existing.length) ? existing.length : 0,
        width: parsedWidth > 0 ? parsedWidth : existing && Number.isFinite(existing.width) ? existing.width : 0
      });
    }

    function applyAreaEffects(events) {
      if (!Array.isArray(events)) {
        return;
      }
      const now = performance.now();
      for (const raw of events) {
        upsertAreaEffectState(raw, now);
      }
    }

    function addProjectileHitEvents(events) {
      if (!Array.isArray(events) || !events.length) {
        return;
      }
      const now = performance.now();
      const abilitiesToPlay = new Set();
      for (const event of events) {
        if (!event) {
          continue;
        }
        const abilityId = toAbilityAudioId(event.abilityId);
        if (abilityId) {
          abilitiesToPlay.add(abilityId);
        }
      }
      for (const abilityId of abilitiesToPlay) {
        playAbilityAudioEvent(abilityId, "hit", now);
      }
    }

    function addMobDeathEvents(events) {
      if (!Array.isArray(events) || !events.length) {
        return;
      }
      const now = performance.now();
      for (const event of events) {
        if (!event) {
          continue;
        }
        const mobType = String(event.mobType || "").trim();
        const x = Number(event.x);
        const y = Number(event.y);
        if (!mobType || !Number.isFinite(x) || !Number.isFinite(y)) {
          continue;
        }
        playMobEventSound(mobType, "death", x, y, now, 0.8, 60);
      }
    }

    return {
      addFloatingDamageEvents,
      addExplosionEvents,
      upsertAreaEffectState,
      applyAreaEffects,
      addProjectileHitEvents,
      addMobDeathEvents
    };
  }

  globalScope.VibeClientVfxRuntime = Object.freeze({
    createVfxRuntimeTools
  });
})(globalThis);
