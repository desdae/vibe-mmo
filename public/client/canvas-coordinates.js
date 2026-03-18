(function initVibeClientCanvasCoordinates(globalScope) {
  "use strict";

  function getCanvasClientRect(canvas) {
    if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
      return {
        left: 0,
        top: 0,
        width: Math.max(1, Number(canvas && canvas.width) || 0),
        height: Math.max(1, Number(canvas && canvas.height) || 0)
      };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      left: Number(rect && rect.left) || 0,
      top: Number(rect && rect.top) || 0,
      width: Math.max(1, Number(rect && rect.width) || Number(canvas && canvas.width) || 0),
      height: Math.max(1, Number(rect && rect.height) || Number(canvas && canvas.height) || 0)
    };
  }

  function clientPointToCanvasPoint(canvas, clientX, clientY) {
    if (!canvas) {
      return {
        x: Number(clientX) || 0,
        y: Number(clientY) || 0
      };
    }

    const rect = getCanvasClientRect(canvas);
    const canvasWidth = Math.max(1, Number(canvas.width) || 0);
    const canvasHeight = Math.max(1, Number(canvas.height) || 0);
    const rectWidth = Math.max(1, Number(rect.width) || canvasWidth);
    const rectHeight = Math.max(1, Number(rect.height) || canvasHeight);
    const left = Number(rect.left) || 0;
    const top = Number(rect.top) || 0;

    return {
      x: (Number(clientX) - left) * (canvasWidth / rectWidth),
      y: (Number(clientY) - top) * (canvasHeight / rectHeight)
    };
  }

  function getCanvasClientCenter(canvas) {
    const rect = getCanvasClientRect(canvas);
    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5
    };
  }

  globalScope.VibeClientCanvasCoordinates = Object.freeze({
    clientPointToCanvasPoint,
    getCanvasClientCenter
  });
})(globalThis);
