(function initVibeClientAbilityRuntime(globalScope) {
  "use strict";

  function fallbackClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createAbilityRuntimeTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const abilityRuntime = deps.abilityRuntime;
    const abilityChannel = deps.abilityChannel;
    if (!abilityRuntime || !abilityChannel) {
      return null;
    }

    const clamp = typeof deps.clamp === "function" ? deps.clamp : fallbackClamp;
    const getCurrentSelf = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf : () => null;
    const getActionDefById = typeof deps.getActionDefById === "function" ? deps.getActionDefById : () => ({ id: "none" });
    const sendAbilityUse = typeof deps.sendAbilityUse === "function" ? deps.sendAbilityUse : () => false;
    const getAbilityEffectiveCooldownMsForSelf =
      typeof deps.getAbilityEffectiveCooldownMsForSelf === "function"
        ? deps.getAbilityEffectiveCooldownMsForSelf
        : () => 0;
    const getAbilityEffectiveRangeForSelf =
      typeof deps.getAbilityEffectiveRangeForSelf === "function" ? deps.getAbilityEffectiveRangeForSelf : () => 0;
    const mouseState = deps.mouseState && typeof deps.mouseState === "object" ? deps.mouseState : { sx: 0, sy: 0 };
    const screenToWorld = typeof deps.screenToWorld === "function" ? deps.screenToWorld : () => ({ x: 0, y: 0 });
    const sendCastTargetUpdate =
      typeof deps.sendCastTargetUpdate === "function" ? deps.sendCastTargetUpdate : () => false;
    const playAbilityAudioEvent =
      typeof deps.playAbilityAudioEvent === "function" ? deps.playAbilityAudioEvent : () => {};
    const triggerSwordSwing = typeof deps.triggerSwordSwing === "function" ? deps.triggerSwordSwing : () => {};
    const stopAllAbilityChannelAudio =
      typeof deps.stopAllAbilityChannelAudio === "function" ? deps.stopAllAbilityChannelAudio : () => {};
    const resolveAbilityUseTarget =
      typeof deps.resolveAbilityUseTarget === "function"
        ? deps.resolveAbilityUseTarget
        : (_abilityId, worldX, worldY) => ({
            x: Number(worldX) || 0,
            y: Number(worldY) || 0
          });

    function getAbilityRuntimeKey(abilityId) {
      return String(abilityId || "").trim().toLowerCase();
    }

    function canUseAbilityNow(abilityId, now, self = null) {
      const cooldownMs = Math.max(0, getAbilityEffectiveCooldownMsForSelf(abilityId, self));
      if (cooldownMs <= 0) {
        return true;
      }
      const runtime = abilityRuntime.get(getAbilityRuntimeKey(abilityId));
      const lastUsedAt = runtime ? Number(runtime.lastUsedAt) : NaN;
      if (!Number.isFinite(lastUsedAt) || lastUsedAt <= 0) {
        return true;
      }
      return now - lastUsedAt >= cooldownMs;
    }

    function markAbilityUsedClient(abilityId, now) {
      const key = getAbilityRuntimeKey(abilityId);
      if (!key) {
        return;
      }
      const existing = abilityRuntime.get(key) || {};
      existing.lastUsedAt = now;
      abilityRuntime.set(key, existing);
    }

    function hasEnoughManaForAbility(self, abilityId) {
      const def = getActionDefById(abilityId);
      const manaCost = Math.max(0, Number(def.manaCost) || 0);
      const mana = Math.max(0, Number(self && self.mana) || 0);
      return mana + 1e-6 >= manaCost;
    }

    function captureCastStateSnapshot(castState) {
      return {
        active: !!(castState && castState.active),
        abilityId: String((castState && castState.abilityId) || "").toLowerCase(),
        startedAt: Number(castState && castState.startedAt) || 0,
        durationMs: Math.max(0, Number(castState && castState.durationMs) || 0)
      };
    }

    function stopAbilityChannelAudio(abilityId) {
      if (typeof deps.stopAbilityChannelAudio === "function") {
        deps.stopAbilityChannelAudio(abilityId);
      }
    }

    function syncLocalCastAudio(previousCast, nextCast) {
      const prev = previousCast || { active: false, abilityId: "", startedAt: 0, durationMs: 0 };
      const next = nextCast || { active: false, abilityId: "", startedAt: 0, durationMs: 0 };
      const prevAbility = getAbilityRuntimeKey(prev.abilityId);
      const nextAbility = getAbilityRuntimeKey(next.abilityId);
      const now = performance.now();

      if (prev.active && (!next.active || prevAbility !== nextAbility)) {
        stopAbilityChannelAudio(prevAbility);
      }

      if (next.active && (!prev.active || prevAbility !== nextAbility)) {
        playAbilityAudioEvent(nextAbility, "channel", now);
      }

      if (prev.active && !next.active) {
        const completion = prev.durationMs > 0 ? clamp((now - prev.startedAt) / prev.durationMs, 0, 1) : 0;
        if (completion >= 0.94) {
          playAbilityAudioEvent(prevAbility, "cast", now);
        }
      }
    }

    function resetAbilityChanneling() {
      stopAllAbilityChannelAudio();
      abilityChannel.active = false;
      abilityChannel.abilityId = "";
      abilityChannel.startedAt = 0;
      abilityChannel.durationMs = 0;
      abilityChannel.targetX = 0;
      abilityChannel.targetY = 0;
      abilityChannel.lastRetargetSentAt = 0;
      abilityChannel.lastSentTargetX = NaN;
      abilityChannel.lastSentTargetY = NaN;
      abilityChannel.trackPointer = false;
    }

    function applyServerCastState(targetState, payload) {
      if (!targetState || !payload || typeof payload !== "object") {
        return;
      }
      if (!payload.active) {
        targetState.active = false;
        targetState.abilityId = "";
        targetState.startedAt = 0;
        targetState.durationMs = 0;
        targetState.trackPointer = false;
        return;
      }

      const durationMs = Math.max(1, Math.floor(Number(payload.durationMs) || 0));
      const elapsedMs = clamp(Number(payload.elapsedMs) || 0, 0, durationMs);
      targetState.active = true;
      targetState.abilityId = String(payload.abilityId || "");
      targetState.durationMs = durationMs;
      targetState.startedAt = performance.now() - elapsedMs;
    }

    function getCastProgress(castState, now) {
      if (!castState || !castState.active || !castState.durationMs) {
        return null;
      }
      const elapsed = now - castState.startedAt;
      if (!Number.isFinite(elapsed) || elapsed < 0) {
        return { ratio: 0, elapsedMs: 0, durationMs: castState.durationMs };
      }
      if (elapsed >= castState.durationMs) {
        return null;
      }
      return {
        ratio: clamp(elapsed / castState.durationMs, 0, 1),
        elapsedMs: elapsed,
        durationMs: castState.durationMs
      };
    }

    function useAbilityAt(abilityId, worldX, worldY, options = {}) {
      const self = getCurrentSelf();
      if (!self || self.hp <= 0) {
        return false;
      }
      if (abilityChannel.active) {
        return false;
      }

      const resolvedAbilityId = String(abilityId || "").trim();
      const abilityDef = getActionDefById(resolvedAbilityId);
      if (!resolvedAbilityId || abilityDef.id === "none" || abilityDef.id === "pickup_bag") {
        return false;
      }
      if (!hasEnoughManaForAbility(self, resolvedAbilityId)) {
        return false;
      }

      const now = performance.now();
      if (!canUseAbilityNow(resolvedAbilityId, now, self)) {
        return false;
      }

      const resolvedTarget = resolveAbilityUseTarget(resolvedAbilityId, worldX, worldY, options);
      const targetX = Number(resolvedTarget && resolvedTarget.x);
      const targetY = Number(resolvedTarget && resolvedTarget.y);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        return false;
      }

      if (!sendAbilityUse(resolvedAbilityId, targetX, targetY)) {
        return false;
      }
      const castMs = Math.max(0, Number(abilityDef.castMs) || 0);
      const previousSelfCast = captureCastStateSnapshot(abilityChannel);
      if (castMs > 0) {
        const dx = targetX - self.x;
        const dy = targetY - self.y;
        const len = Math.hypot(dx, dy);
        abilityChannel.active = true;
        abilityChannel.abilityId = resolvedAbilityId;
        abilityChannel.startedAt = now;
        abilityChannel.durationMs = castMs;
        abilityChannel.lastRetargetSentAt = 0;
        abilityChannel.lastSentTargetX = NaN;
        abilityChannel.lastSentTargetY = NaN;
        abilityChannel.trackPointer = options.trackPointer !== false;
        if (len > 0) {
          const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(resolvedAbilityId, self) || len);
          const distance = castRange > 0 ? Math.min(len, castRange) : len;
          abilityChannel.targetX = self.x + (dx / len) * distance;
          abilityChannel.targetY = self.y + (dy / len) * distance;
        } else {
          abilityChannel.targetX = self.x;
          abilityChannel.targetY = self.y;
        }
        syncLocalCastAudio(previousSelfCast, abilityChannel);
      }
      if (castMs <= 0) {
        markAbilityUsedClient(resolvedAbilityId, now);
        playAbilityAudioEvent(resolvedAbilityId, "cast", now);
      }
      if (resolvedAbilityId === "slash") {
        triggerSwordSwing(targetX, targetY);
      }
      return true;
    }

    function updateLocalCastTargetFromMouse() {
      const self = getCurrentSelf();
      if (!self || !abilityChannel.active) {
        return false;
      }
      if (abilityChannel.trackPointer === false) {
        return false;
      }
      const targetWorld = screenToWorld(mouseState.sx, mouseState.sy, self);
      const worldX = Number(targetWorld && targetWorld.x);
      const worldY = Number(targetWorld && targetWorld.y);
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
        return false;
      }

      const dx = worldX - self.x;
      const dy = worldY - self.y;
      const len = Math.hypot(dx, dy);
      if (len <= 0.0001) {
        abilityChannel.targetX = self.x;
        abilityChannel.targetY = self.y;
        return true;
      }

      const castRange = Math.max(0, getAbilityEffectiveRangeForSelf(abilityChannel.abilityId, self) || len);
      const distance = castRange > 0 ? Math.min(len, castRange) : len;
      abilityChannel.targetX = self.x + (dx / len) * distance;
      abilityChannel.targetY = self.y + (dy / len) * distance;
      return true;
    }

    function maybeSendCastTargetUpdate(now) {
      const self = getCurrentSelf();
      if (!self || !abilityChannel.active) {
        return;
      }
      const targetX = Number(abilityChannel.targetX);
      const targetY = Number(abilityChannel.targetY);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        return;
      }

      const lastSentAt = Number(abilityChannel.lastRetargetSentAt) || 0;
      const lastSentTargetX = Number(abilityChannel.lastSentTargetX);
      const lastSentTargetY = Number(abilityChannel.lastSentTargetY);
      const changedEnough =
        !Number.isFinite(lastSentTargetX) ||
        !Number.isFinite(lastSentTargetY) ||
        Math.hypot(targetX - lastSentTargetX, targetY - lastSentTargetY) >= 0.08;
      if (!changedEnough || now - lastSentAt < 50) {
        return;
      }

      if (sendCastTargetUpdate(abilityChannel.abilityId, targetX, targetY)) {
        abilityChannel.lastRetargetSentAt = now;
        abilityChannel.lastSentTargetX = targetX;
        abilityChannel.lastSentTargetY = targetY;
      }
    }

    function updateAbilityChannel(now) {
      if (!abilityChannel.active) {
        return;
      }
      updateLocalCastTargetFromMouse();
      maybeSendCastTargetUpdate(now);
      const progress = getCastProgress(abilityChannel, now);
      if (!progress) {
        const previousSelfCast = captureCastStateSnapshot(abilityChannel);
        resetAbilityChanneling();
        syncLocalCastAudio(previousSelfCast, abilityChannel);
      }
    }

    return {
      getAbilityRuntimeKey,
      canUseAbilityNow,
      markAbilityUsedClient,
      hasEnoughManaForAbility,
      captureCastStateSnapshot,
      syncLocalCastAudio,
      resetAbilityChanneling,
      applyServerCastState,
      getCastProgress,
      useAbilityAt,
      updateAbilityChannel
    };
  }

  globalScope.VibeClientAbilityRuntime = Object.freeze({
    createAbilityRuntimeTools
  });
})(globalThis);
