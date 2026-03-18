(function initVibeClientCanvasCoordinates(globalScope) {
  "use strict";

  function clientPointToCanvasPoint(canvas, clientX, clientY) {
    if (!canvas) {
      return {
        x: Number(clientX) || 0,
        y: Number(clientY) || 0
      };
    }

    const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
    const canvasWidth = Math.max(1, Number(canvas.width) || 0);
    const canvasHeight = Math.max(1, Number(canvas.height) || 0);
    const rectWidth = Math.max(1, Number(rect && rect.width) || canvasWidth);
    const rectHeight = Math.max(1, Number(rect && rect.height) || canvasHeight);
    const left = Number(rect && rect.left) || 0;
    const top = Number(rect && rect.top) || 0;

    return {
      x: (Number(clientX) - left) * (canvasWidth / rectWidth),
      y: (Number(clientY) - top) * (canvasHeight / rectHeight)
    };
  }

  globalScope.VibeClientCanvasCoordinates = Object.freeze({
    clientPointToCanvasPoint
  });
})(globalThis);
