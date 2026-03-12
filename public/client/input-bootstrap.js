(function initVibeClientInputBootstrap(globalScope) {
  "use strict";

  function createInputBootstrap(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    if (!deps.canvas || !deps.joinForm || !deps.document || !deps.windowObject) {
      return null;
    }

    function getCanvasTouchPoint(touch) {
      const rect = deps.canvas.getBoundingClientRect();
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }

    function onKeyDown(event) {
      deps.resumeSpatialAudioContext();
      if (event.repeat) {
        return;
      }

      if (event.code === "F3") {
        deps.toggleDebugPanel();
        event.preventDefault();
        return;
      }

      if (event.code === "KeyI" && !deps.gameUI.classList.contains("hidden")) {
        deps.toggleInventoryPanel();
        event.preventDefault();
        return;
      }

      if (event.code === "KeyC" && !deps.gameUI.classList.contains("hidden")) {
        deps.toggleEquipmentPanel();
        event.preventDefault();
        return;
      }

      if (event.code === "KeyP" && !deps.gameUI.classList.contains("hidden")) {
        deps.toggleSpellbookPanel();
        event.preventDefault();
        return;
      }

      if (event.code === "KeyK" && !deps.gameUI.classList.contains("hidden")) {
        deps.toggleDpsPanel();
        event.preventDefault();
        return;
      }

      if (event.code.startsWith("Digit")) {
        const slot = event.code.replace("Digit", "");
        if (slot >= "1" && slot <= "9" && !deps.gameUI.classList.contains("hidden")) {
          deps.executeBoundAction(slot);
          event.preventDefault();
          return;
        }
      }

      if (event.code in deps.keys) {
        deps.cancelAutoVendorInteraction();
        deps.cancelAutoLootPickup();
        deps.keys[event.code] = true;
        deps.sendMove();
        event.preventDefault();
      }
    }

    function onKeyUp(event) {
      if (event.code in deps.keys) {
        deps.keys[event.code] = false;
        deps.sendMove();
        event.preventDefault();
      }
    }

    function onBlur() {
      let changed = false;
      for (const key in deps.keys) {
        if (deps.keys[key]) {
          deps.keys[key] = false;
          changed = true;
        }
      }
      if (typeof deps.resetTouchJoystick === "function" && deps.resetTouchJoystick()) {
        changed = true;
      }
      if (changed) {
        deps.sendMove();
      }
      deps.mouseState.leftDown = false;
      deps.cancelAutoVendorInteraction();
      deps.cancelAutoLootPickup();
      deps.clearDragState();
      deps.resetAbilityChanneling();
      deps.stopAllSpatialLoops();
    }

    function onMouseMove(event) {
      deps.updateMouseScreenPosition(event);
    }

    function onMouseDown(event) {
      deps.resumeSpatialAudioContext();
      if (event.button !== 0) {
        return;
      }

      deps.updateMouseScreenPosition(event);
      deps.cancelAutoVendorInteraction();
      deps.cancelAutoLootPickup();
      deps.mouseState.leftDown = true;
      deps.tryPrimaryAutoAction(true);
    }

    function onMouseUp(event) {
      if (event.button === 0) {
        deps.mouseState.leftDown = false;
      }
    }

    function onContextMenu(event) {
      deps.resumeSpatialAudioContext();
      event.preventDefault();
      deps.updateMouseScreenPosition(event);
      if (deps.tryContextVendorInteraction()) {
        return;
      }
      if (deps.tryContextLootPickup()) {
        return;
      }
      deps.executeBoundAction("mouse_right");
    }

    function onTouchStart(event) {
      if (typeof deps.isTouchJoystickEnabled === "function" && !deps.isTouchJoystickEnabled()) {
        return;
      }
      if (typeof deps.hasActiveTouchJoystick === "function" && deps.hasActiveTouchJoystick()) {
        return;
      }
      const touch = event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : null;
      if (!touch) {
        return;
      }
      const point = getCanvasTouchPoint(touch);
      deps.resumeSpatialAudioContext();
      deps.cancelAutoVendorInteraction();
      deps.cancelAutoLootPickup();
      if (typeof deps.beginTouchJoystick === "function") {
        deps.beginTouchJoystick(touch.identifier, point.x, point.y);
        deps.sendMove();
        event.preventDefault();
      }
    }

    function onTouchMove(event) {
      if (typeof deps.hasActiveTouchJoystick !== "function" || !deps.hasActiveTouchJoystick()) {
        return;
      }
      const activeId = typeof deps.getActiveTouchJoystickId === "function" ? deps.getActiveTouchJoystickId() : null;
      if (activeId === null || activeId === undefined) {
        return;
      }
      const touches = event.changedTouches || [];
      for (let index = 0; index < touches.length; index += 1) {
        const touch = touches[index];
        if (touch.identifier !== activeId) {
          continue;
        }
        const point = getCanvasTouchPoint(touch);
        if (typeof deps.updateTouchJoystick === "function") {
          deps.updateTouchJoystick(point.x, point.y);
          deps.sendMove();
          event.preventDefault();
        }
        return;
      }
    }

    function onTouchEnd(event) {
      if (typeof deps.hasActiveTouchJoystick !== "function" || !deps.hasActiveTouchJoystick()) {
        return;
      }
      const activeId = typeof deps.getActiveTouchJoystickId === "function" ? deps.getActiveTouchJoystickId() : null;
      if (activeId === null || activeId === undefined) {
        return;
      }
      const touches = event.changedTouches || [];
      for (let index = 0; index < touches.length; index += 1) {
        const touch = touches[index];
        if (touch.identifier !== activeId) {
          continue;
        }
        if (typeof deps.endTouchJoystick === "function") {
          deps.endTouchJoystick();
          deps.sendMove();
          event.preventDefault();
        }
        return;
      }
    }

    function onJoinSubmit(event) {
      event.preventDefault();
      deps.resumeSpatialAudioContext();
      const formData = new FormData(deps.joinForm);
      const name = String(formData.get("name") || "").trim();
      const selectedClass = String(formData.get("classType") || "").trim();
      const isAdmin = formData.get("isAdmin") !== null;
      const firstClassId = deps.classDefsById.size ? deps.classDefsById.keys().next().value : "";
      const classType = selectedClass || firstClassId;

      if (!name) {
        deps.setStatus("Please enter a name.");
        return;
      }
      if (!classType) {
        deps.setStatus("Class data is not loaded yet.");
        return;
      }

      deps.setStatus("Connecting...");
      deps.connectAndJoin(name, classType, isAdmin);
    }

    function bind() {
      const requestFrame =
        typeof deps.requestAnimationFrame === "function"
          ? deps.requestAnimationFrame.bind(deps.windowObject)
          : deps.windowObject.requestAnimationFrame.bind(deps.windowObject);

      deps.windowObject.addEventListener("resize", deps.resizeCanvas);
      deps.resizeCanvas();

      deps.document.addEventListener("keydown", onKeyDown);
      deps.document.addEventListener("keyup", onKeyUp);
      deps.windowObject.addEventListener("blur", onBlur);
      deps.canvas.addEventListener("mousemove", onMouseMove);
      deps.canvas.addEventListener("mousedown", onMouseDown);
      deps.windowObject.addEventListener("mouseup", onMouseUp);
      deps.canvas.addEventListener("contextmenu", onContextMenu);
      deps.canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      deps.windowObject.addEventListener("touchmove", onTouchMove, { passive: false });
      deps.windowObject.addEventListener("touchend", onTouchEnd, { passive: false });
      deps.windowObject.addEventListener("touchcancel", onTouchEnd, { passive: false });
      deps.joinForm.addEventListener("submit", onJoinSubmit);

      globalScope.setInterval(deps.updateDebugPanel, 250);
      globalScope.setInterval(deps.updateDpsPanel, 250);
      globalScope.setInterval(deps.refreshAdminBotList, 1500);
      globalScope.setInterval(deps.tryPrimaryAutoAction, 50);
      globalScope.setInterval(deps.updateAutoVendorInteraction, 75);
      globalScope.setInterval(deps.updateAutoLootPickup, 75);
      deps.initializeDpsPanel();
      deps.loadInitialGameConfig();
      requestFrame(deps.render);
    }

    return {
      bind
    };
  }

  globalScope.VibeClientInputBootstrap = Object.freeze({
    createInputBootstrap
  });
})(globalThis);
