(function initVibeClientInputBootstrap(globalScope) {
  "use strict";

  function createInputBootstrap(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    if (!deps.canvas || !deps.joinForm || !deps.document || !deps.windowObject) {
      return null;
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
      if (changed) {
        deps.sendMove();
      }
      deps.mouseState.leftDown = false;
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
      deps.executeBoundAction("mouse_right");
    }

    function onJoinSubmit(event) {
      event.preventDefault();
      deps.resumeSpatialAudioContext();
      const formData = new FormData(deps.joinForm);
      const name = String(formData.get("name") || "").trim();
      const selectedClass = String(formData.get("classType") || "").trim();
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
      deps.connectAndJoin(name, classType);
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
      deps.joinForm.addEventListener("submit", onJoinSubmit);

      globalScope.setInterval(deps.updateDebugPanel, 250);
      globalScope.setInterval(deps.updateDpsPanel, 250);
      globalScope.setInterval(deps.tryPrimaryAutoAction, 50);
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
