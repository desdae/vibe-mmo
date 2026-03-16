const path = require("path");

function createMockSurfaceContext(metrics, bucket) {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    clearRect: () => {
      metrics[bucket].clearRect += 1;
    },
    beginPath: () => {
      metrics[bucket].beginPath += 1;
    },
    moveTo: () => {
      metrics[bucket].moveTo += 1;
    },
    lineTo: () => {
      metrics[bucket].lineTo += 1;
    },
    stroke: () => {
      metrics[bucket].stroke += 1;
    },
    drawImage: () => {
      metrics[bucket].drawImage += 1;
    },
    fillRect: () => {
      metrics[bucket].fillRect += 1;
    },
    rect: () => {
      metrics[bucket].rect += 1;
    },
    clip: () => {
      metrics[bucket].clip += 1;
    },
    save: () => {
      metrics[bucket].save += 1;
    },
    restore: () => {
      metrics[bucket].restore += 1;
    },
    translate: () => {
      metrics[bucket].translate += 1;
    }
  };
}

describe("VibeClientCanvasBackgroundCache", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/canvas-background-cache.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientCanvasBackgroundCache;
  });

  afterEach(() => {
    delete globalThis.VibeClientCanvasBackgroundCache;
  });

  test("caches the prerendered town surface across frames", () => {
    require(modulePath);

    const metrics = {
      main: { clearRect: 0, beginPath: 0, moveTo: 0, lineTo: 0, stroke: 0, drawImage: 0, fillRect: 0, rect: 0, clip: 0, save: 0, restore: 0, translate: 0 },
      surface: { clearRect: 0, beginPath: 0, moveTo: 0, lineTo: 0, stroke: 0, drawImage: 0, fillRect: 0, rect: 0, clip: 0, save: 0, restore: 0, translate: 0 }
    };
    const layout = {
      enabled: true,
      minTileX: 0,
      minTileY: 0,
      maxTileX: 1,
      maxTileY: 1
    };
    const wallTiles = [{ x: 0, y: 0 }];
    let spriteLookups = 0;
    let surfacesCreated = 0;
    const cache = globalThis.VibeClientCanvasBackgroundCache.createCanvasBackgroundCache({
      ctx: {
        ...createMockSurfaceContext(metrics, "main"),
        createPattern: () => ({ kind: "grid" })
      },
      canvas: { width: 640, height: 480 },
      tileSize: 32,
      worldToScreen: (worldX, worldY) => ({ x: worldX * 32, y: worldY * 32 }),
      getTownLayout: () => layout,
      getTownWallTiles: () => wallTiles,
      getTownTileSprite: () => {
        spriteLookups += 1;
        return { width: 32, height: 32 };
      },
      isTownGateTileAt: (x, y) => x === 1 && y === 1,
      getMapWidth: () => 100,
      getMapHeight: () => 100,
      createCanvas: (width, height) => {
        surfacesCreated += 1;
        const context = createMockSurfaceContext(metrics, "surface");
        return {
          width,
          height,
          getContext: () => context
        };
      }
    });

    cache.drawTown(0, 0);
    cache.drawTown(0, 0);

    expect(surfacesCreated).toBe(1);
    expect(spriteLookups).toBe(4);
    expect(metrics.surface.drawImage).toBe(4);
    expect(metrics.main.drawImage).toBe(2);
  });

  test("reuses the grid pattern across frames", () => {
    require(modulePath);

    let createPatternCalls = 0;
    const cache = globalThis.VibeClientCanvasBackgroundCache.createCanvasBackgroundCache({
      ctx: {
        ...createMockSurfaceContext(
          {
            main: { clearRect: 0, beginPath: 0, moveTo: 0, lineTo: 0, stroke: 0, drawImage: 0, fillRect: 0, rect: 0, clip: 0, save: 0, restore: 0, translate: 0 }
          },
          "main"
        ),
        createPattern: () => {
          createPatternCalls += 1;
          return { kind: "grid" };
        }
      },
      canvas: { width: 640, height: 480 },
      tileSize: 32,
      worldToScreen: (worldX, worldY, cameraX, cameraY) => ({
        x: (worldX - cameraX) * 32,
        y: (worldY - cameraY) * 32
      }),
      getTownLayout: () => null,
      getTownWallTiles: () => [],
      getTownTileSprite: () => ({ width: 32, height: 32 }),
      isTownGateTileAt: () => false,
      getMapWidth: () => 50,
      getMapHeight: () => 50,
      createCanvas: (width, height) => ({
        width,
        height,
        getContext: () =>
          createMockSurfaceContext(
            {
              offscreen: { clearRect: 0, beginPath: 0, moveTo: 0, lineTo: 0, stroke: 0, drawImage: 0, fillRect: 0, rect: 0, clip: 0, save: 0, restore: 0, translate: 0 }
            },
            "offscreen"
          )
      })
    });

    cache.drawGrid(0, 0);
    cache.drawGrid(1, 1);

    expect(createPatternCalls).toBe(1);
  });
});
