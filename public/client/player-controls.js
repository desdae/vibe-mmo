(function initVibeClientPlayerControls(globalScope) {
  "use strict";

  function createPlayerControlTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const keys = deps.keys || {};
    const movementSync = deps.movementSync || { lastDx: 0, lastDy: 0, lastSentAt: 0 };
    const mouseState = deps.mouseState || { sx: 0, sy: 0 };
    const touchJoystickState =
      deps.touchJoystickState && typeof deps.touchJoystickState === "object"
        ? deps.touchJoystickState
        : { active: false, vectorDx: 0, vectorDy: 0 };
    const gameState = deps.gameState || {};
    const autoMoveTarget =
      deps.autoMoveTarget && typeof deps.autoMoveTarget === "object"
        ? deps.autoMoveTarget
        : { active: false, x: 0, y: 0, stopDistance: 0.1 };
    const canvas = deps.canvas || null;
    const tileSize = Math.max(1, Number(deps.tileSize) || 32);
    const sendJsonMessage = typeof deps.sendJsonMessage === "function" ? deps.sendJsonMessage : () => false;

    function clientPointToCanvasPoint(localCanvas, clientX, clientY) {
      const sharedCanvasCoordinates = globalScope.VibeClientCanvasCoordinates || null;
      if (
        sharedCanvasCoordinates &&
        typeof sharedCanvasCoordinates.clientPointToCanvasPoint === "function"
      ) {
        return sharedCanvasCoordinates.clientPointToCanvasPoint(localCanvas, clientX, clientY);
      }
      return {
        x: Number(clientX) || 0,
        y: Number(clientY) || 0
      };
    }

    function getCurrentInputVector() {
      const left = keys.ArrowLeft || keys.KeyA;
      const right = keys.ArrowRight || keys.KeyD;
      const up = keys.ArrowUp || keys.KeyW;
      const down = keys.ArrowDown || keys.KeyS;

      const rawDx = (right ? 1 : 0) - (left ? 1 : 0);
      const rawDy = (down ? 1 : 0) - (up ? 1 : 0);
      const len = Math.hypot(rawDx, rawDy);

      if (!len) {
        const touchDx = Number(touchJoystickState.vectorDx) || 0;
        const touchDy = Number(touchJoystickState.vectorDy) || 0;
        const touchLen = Math.hypot(touchDx, touchDy);
        if (touchJoystickState.active && touchLen > 0.0001) {
          return {
            dx: touchDx / touchLen,
            dy: touchDy / touchLen
          };
        }
        return { dx: 0, dy: 0 };
      }

      return { dx: rawDx / len, dy: rawDy / len };
    }

    function getAutoMoveVector() {
      if (!autoMoveTarget.active || !gameState.self) {
        return { dx: 0, dy: 0 };
      }
      const targetX = Number(autoMoveTarget.x);
      const targetY = Number(autoMoveTarget.y);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        return { dx: 0, dy: 0 };
      }
      const dx = targetX - Number(gameState.self.x || 0);
      const dy = targetY - Number(gameState.self.y || 0);
      const dist = Math.hypot(dx, dy);
      if (!dist || dist <= Math.max(0, Number(autoMoveTarget.stopDistance) || 0)) {
        return { dx: 0, dy: 0 };
      }
      return {
        dx: dx / dist,
        dy: dy / dist
      };
    }

    function getCurrentMovementVector() {
      const manual = getCurrentInputVector();
      if (manual.dx || manual.dy) {
        return manual;
      }
      return getAutoMoveVector();
    }

    function sendMove(socket) {
      if (!socket || socket.readyState !== globalScope.WebSocket.OPEN || !gameState.self) {
        return;
      }

      const { dx, dy } = getCurrentMovementVector();
      const changed = dx !== movementSync.lastDx || dy !== movementSync.lastDy;
      if (!changed) {
        return;
      }

      sendJsonMessage({
        type: "move",
        dx,
        dy
      });

      movementSync.lastDx = dx;
      movementSync.lastDy = dy;
      movementSync.lastSentAt = performance.now();
    }

    function setAutoMoveTarget(x, y, stopDistance = 0.1) {
      autoMoveTarget.active = true;
      autoMoveTarget.x = Number(x) || 0;
      autoMoveTarget.y = Number(y) || 0;
      autoMoveTarget.stopDistance = Math.max(0, Number(stopDistance) || 0);
    }

    function clearAutoMoveTarget() {
      autoMoveTarget.active = false;
      autoMoveTarget.x = 0;
      autoMoveTarget.y = 0;
      autoMoveTarget.stopDistance = 0.1;
    }

    function updateMouseScreenPosition(event) {
      if (!canvas || !event) {
        return;
      }
      const point = clientPointToCanvasPoint(canvas, event.clientX, event.clientY);
      mouseState.sx = Number(point.x) || 0;
      mouseState.sy = Number(point.y) || 0;
    }

    function screenToWorld(sx, sy, self) {
      if (!self || !canvas) {
        return { x: 0, y: 0 };
      }
      const cameraX = self.x + 0.5;
      const cameraY = self.y + 0.5;
      return {
        x: cameraX + (sx - canvas.width / 2) / tileSize,
        y: cameraY + (sy - canvas.height / 2) / tileSize
      };
    }

    return {
      getCurrentInputVector,
      getCurrentMovementVector,
      sendMove,
      setAutoMoveTarget,
      clearAutoMoveTarget,
      updateMouseScreenPosition,
      screenToWorld
    };
  }

  globalScope.VibeClientPlayerControls = Object.freeze({
    createPlayerControlTools
  });
})(globalThis);
