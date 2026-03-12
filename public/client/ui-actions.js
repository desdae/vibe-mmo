(function initVibeClientUiActions(globalScope) {
  "use strict";

  function fallbackClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createUiActionTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const clamp = typeof deps.clamp === "function" ? deps.clamp : fallbackClamp;
    const actionBindings = deps.actionBindings;
    const abilityRuntime = deps.abilityRuntime;
    const abilityChannel = deps.abilityChannel;
    const mouseState = deps.mouseState;
    if (!actionBindings || !abilityRuntime || !abilityChannel || !mouseState) {
      return null;
    }

    const getPrimaryClassAbilityId =
      typeof deps.getPrimaryClassAbilityId === "function" ? deps.getPrimaryClassAbilityId : () => "none";
    const getDefaultClassAbilityIds =
      typeof deps.getDefaultClassAbilityIds === "function" ? deps.getDefaultClassAbilityIds : () => [];
    const getCurrentSelf = typeof deps.getCurrentSelf === "function" ? deps.getCurrentSelf : () => null;
    const screenToWorld = typeof deps.screenToWorld === "function" ? deps.screenToWorld : () => null;
    const sendUseItem = typeof deps.sendUseItem === "function" ? deps.sendUseItem : () => {};
    const sendPickupBag = typeof deps.sendPickupBag === "function" ? deps.sendPickupBag : () => {};
    const useAbilityAt = typeof deps.useAbilityAt === "function" ? deps.useAbilityAt : () => false;
    const getActionDefById = typeof deps.getActionDefById === "function" ? deps.getActionDefById : () => ({ id: "none" });
    const getAbilityEffectiveCooldownMsForSelf =
      typeof deps.getAbilityEffectiveCooldownMsForSelf === "function"
        ? deps.getAbilityEffectiveCooldownMsForSelf
        : () => 0;
    const getCastProgress = typeof deps.getCastProgress === "function" ? deps.getCastProgress : () => null;
    const resetAbilityChanneling =
      typeof deps.resetAbilityChanneling === "function" ? deps.resetAbilityChanneling : () => {};
    const isTouchJoystickEnabled =
      typeof deps.isTouchJoystickEnabled === "function" ? deps.isTouchJoystickEnabled : () => false;

    function makeActionBinding(actionId) {
      return `action:${String(actionId || "none")}`;
    }

    function makeItemBinding(itemId) {
      return `item:${String(itemId || "")}`;
    }

    function parseActionBinding(binding) {
      const raw = String(binding || "");
      if (raw.startsWith("item:")) {
        return {
          kind: "item",
          id: raw.slice(5) || ""
        };
      }
      if (raw.startsWith("action:")) {
        return {
          kind: "action",
          id: raw.slice(7) || "none"
        };
      }
      return {
        kind: "action",
        id: raw || "none"
      };
    }

    function applyDefaultActionBindings(classType) {
      const resolvedClass = String(classType || "").trim();
      const primary = getPrimaryClassAbilityId(resolvedClass);
      const defaultAbilityIds = getDefaultClassAbilityIds(resolvedClass);
      const useMobileDefaults = isTouchJoystickEnabled();

      actionBindings.clear();
      for (let i = 1; i <= 9; i += 1) {
        actionBindings.set(String(i), makeActionBinding("none"));
      }
      actionBindings.set("mouse_left", makeActionBinding(primary));
      actionBindings.set("mouse_right", makeActionBinding("pickup_bag"));
      if (useMobileDefaults) {
        let slotIndex = 1;
        for (const abilityId of defaultAbilityIds) {
          if (slotIndex > 9) {
            break;
          }
          actionBindings.set(String(slotIndex), makeActionBinding(abilityId));
          slotIndex += 1;
        }
        if (slotIndex === 1 && primary !== "none") {
          actionBindings.set("1", makeActionBinding(primary));
        }
      } else {
        actionBindings.set("1", makeActionBinding(primary));
      }
      return resolvedClass;
    }

    function ensureActionBindingsForClass(classType, currentClassType = "") {
      const resolvedClass = String(classType || "").trim();
      if (currentClassType !== resolvedClass || !actionBindings.size) {
        return applyDefaultActionBindings(resolvedClass);
      }
      return currentClassType;
    }

    function getActionVisualState(binding, self, now) {
      const parsed = parseActionBinding(binding);
      if (parsed.kind !== "action") {
        return { type: "cooldown", ratio: 0 };
      }

      const actionId = parsed.id;
      if (abilityChannel.active && abilityChannel.abilityId === actionId && abilityChannel.durationMs > 0) {
        const castProgress = getCastProgress(abilityChannel, now);
        if (castProgress) {
          return {
            type: "channel",
            ratio: castProgress.ratio
          };
        }
        resetAbilityChanneling();
      }

      const _def = getActionDefById(actionId);
      const cooldownMs = Math.max(0, getAbilityEffectiveCooldownMsForSelf(actionId, self));
      if (cooldownMs <= 0) {
        return { type: "cooldown", ratio: 0 };
      }
      const runtime = abilityRuntime.get(String(actionId || "").toLowerCase());
      const lastUsedAt = runtime ? Number(runtime.lastUsedAt) : NaN;
      if (!Number.isFinite(lastUsedAt) || lastUsedAt <= 0) {
        return { type: "cooldown", ratio: 0 };
      }
      const remaining = cooldownMs - (now - lastUsedAt);
      if (remaining > 0) {
        return {
          type: "cooldown",
          ratio: clamp(remaining / cooldownMs, 0, 1)
        };
      }
      return { type: "cooldown", ratio: 0 };
    }

    function getActionTargetWorld() {
      const self = getCurrentSelf();
      if (!self) {
        return null;
      }
      return screenToWorld(mouseState.sx, mouseState.sy, self);
    }

    function resolveTargetWorld(explicitTarget) {
      if (
        explicitTarget &&
        Number.isFinite(Number(explicitTarget.x)) &&
        Number.isFinite(Number(explicitTarget.y))
      ) {
        return {
          x: Number(explicitTarget.x),
          y: Number(explicitTarget.y)
        };
      }
      return getActionTargetWorld();
    }

    function executeParsedBinding(binding, explicitTarget = null, options = {}) {
      const self = getCurrentSelf();
      if (!self || self.hp <= 0 || !binding) {
        return false;
      }

      if (binding.kind === "item") {
        if (!binding.id) {
          return false;
        }
        sendUseItem(binding.id);
        return true;
      }

      const actionId = binding.id;
      const target = resolveTargetWorld(explicitTarget);
      if (!target) {
        return false;
      }

      if (actionId === "pickup_bag") {
        sendPickupBag(target.x, target.y);
        return true;
      }
      if (actionId === "none") {
        return false;
      }
      return useAbilityAt(actionId, target.x, target.y, options);
    }

    function executeBoundAction(slotId) {
      const binding = parseActionBinding(actionBindings.get(slotId) || makeActionBinding("none"));
      return executeParsedBinding(binding);
    }

    function executeBoundActionAt(slotId, worldX, worldY, options = {}) {
      const binding = parseActionBinding(actionBindings.get(slotId) || makeActionBinding("none"));
      return executeParsedBinding(
        binding,
        {
          x: worldX,
          y: worldY
        },
        options
      );
    }

    function tryPrimaryAutoAction(force = false) {
      if (!mouseState.leftDown && !force) {
        return;
      }

      const self = getCurrentSelf();
      if (!self || self.hp <= 0) {
        return;
      }
      const binding = parseActionBinding(actionBindings.get("mouse_left") || makeActionBinding("none"));
      if (binding.kind !== "action" || binding.id === "none") {
        if (force) {
          executeBoundAction("mouse_left");
        }
        return;
      }
      if (abilityChannel.active) {
        return;
      }
      executeBoundAction("mouse_left");
    }

    return {
      makeActionBinding,
      makeItemBinding,
      parseActionBinding,
      applyDefaultActionBindings,
      ensureActionBindingsForClass,
      getActionVisualState,
      getActionTargetWorld,
      executeBoundAction,
      executeBoundActionAt,
      tryPrimaryAutoAction
    };
  }

  globalScope.VibeClientUiActions = Object.freeze({
    createUiActionTools
  });
})(globalThis);
