(function initVibeClientPlayerControls(globalScope) {
  "use strict";

  function createPlayerControlTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const keys = deps.keys || {};
    const movementSync = deps.movementSync || { lastDx: 0, lastDy: 0, lastSentAt: 0 };
    const mouseState = deps.mouseState || { sx: 0, sy: 0 };
    const gameState = deps.gameState || {};
    const canvas = deps.canvas || null;
    const tileSize = Math.max(1, Number(deps.tileSize) || 32);
    const sendJsonMessage = typeof deps.sendJsonMessage === "function" ? deps.sendJsonMessage : () => false;

    function getCurrentInputVector() {
      const left = keys.ArrowLeft || keys.KeyA;
      const right = keys.ArrowRight || keys.KeyD;
      const up = keys.ArrowUp || keys.KeyW;
      const down = keys.ArrowDown || keys.KeyS;

      const rawDx = (right ? 1 : 0) - (left ? 1 : 0);
      const rawDy = (down ? 1 : 0) - (up ? 1 : 0);
      const len = Math.hypot(rawDx, rawDy);

      if (!len) {
        return { dx: 0, dy: 0 };
      }

      return { dx: rawDx / len, dy: rawDy / len };
    }

    function sendMove(socket) {
      if (!socket || socket.readyState !== globalScope.WebSocket.OPEN || !gameState.self) {
        return;
      }

      const { dx, dy } = getCurrentInputVector();
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

    function updateMouseScreenPosition(event) {
      if (!canvas || !event) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      mouseState.sx = event.clientX - rect.left;
      mouseState.sy = event.clientY - rect.top;
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
      sendMove,
      updateMouseScreenPosition,
      screenToWorld
    };
  }

  globalScope.VibeClientPlayerControls = Object.freeze({
    createPlayerControlTools
  });
})(globalThis);
