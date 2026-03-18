const fs = require("fs");
const path = require("path");

describe("VibeClientPlayerControls", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/player-controls.js");
  const canvasCoordinatesPath = path.resolve(__dirname, "../../public/client/canvas-coordinates.js");
  const indexHtmlPath = path.resolve(__dirname, "../../public/index.html");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientPlayerControls;
    delete globalThis.VibeClientCanvasCoordinates;
    globalThis.WebSocket = { OPEN: 1 };
  });

  afterEach(() => {
    delete globalThis.VibeClientPlayerControls;
    delete globalThis.VibeClientCanvasCoordinates;
    delete globalThis.WebSocket;
  });

  test("uses canvas coordinate scaling even when the helper loads after player-controls", () => {
    require(modulePath);
    const mouseState = { sx: 0, sy: 0 };

    const tools = globalThis.VibeClientPlayerControls.createPlayerControlTools({
      canvas: {
        width: 1080,
        height: 2400,
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 360,
          height: 800
        })
      },
      mouseState,
      tileSize: 32
    });

    require(canvasCoordinatesPath);
    tools.updateMouseScreenPosition({
      clientX: 360,
      clientY: 400
    });

    expect(mouseState).toEqual({
      sx: 1080,
      sy: 1200
    });
  });

  test("classic index boot path loads canvas coordinates before player controls", () => {
    const html = fs.readFileSync(indexHtmlPath, "utf8");

    const canvasCoordinatesIndex = html.indexOf('/client/canvas-coordinates.js');
    const playerControlsIndex = html.indexOf('/client/player-controls.js');

    expect(canvasCoordinatesIndex).toBeGreaterThanOrEqual(0);
    expect(playerControlsIndex).toBeGreaterThan(canvasCoordinatesIndex);
  });
});
