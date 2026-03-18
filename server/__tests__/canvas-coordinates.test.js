const path = require("path");

describe("VibeClientCanvasCoordinates", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/canvas-coordinates.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientCanvasCoordinates;
  });

  afterEach(() => {
    delete globalThis.VibeClientCanvasCoordinates;
  });

  test("maps client touch positions across the full scaled canvas width", () => {
    require(modulePath);

    const tools = globalThis.VibeClientCanvasCoordinates;
    const canvas = {
      width: 1080,
      height: 2400,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 360,
        height: 800
      })
    };

    const left = tools.clientPointToCanvasPoint(canvas, 0, 400);
    const middle = tools.clientPointToCanvasPoint(canvas, 180, 400);
    const right = tools.clientPointToCanvasPoint(canvas, 360, 400);

    expect(left).toEqual({ x: 0, y: 1200 });
    expect(middle).toEqual({ x: 540, y: 1200 });
    expect(right).toEqual({ x: 1080, y: 1200 });
  });

  test("falls back to raw coordinates when canvas metrics are unavailable", () => {
    require(modulePath);

    const tools = globalThis.VibeClientCanvasCoordinates;
    const point = tools.clientPointToCanvasPoint(null, 123, 456);

    expect(point).toEqual({ x: 123, y: 456 });
  });

  test("reports the visible canvas center in client coordinates for scaled mobile layouts", () => {
    require(modulePath);

    const tools = globalThis.VibeClientCanvasCoordinates;
    const canvas = {
      width: 1080,
      height: 2400,
      getBoundingClientRect: () => ({
        left: 12,
        top: 24,
        width: 360,
        height: 800
      })
    };

    expect(tools.getCanvasClientCenter(canvas)).toEqual({
      x: 192,
      y: 424
    });
  });
});
