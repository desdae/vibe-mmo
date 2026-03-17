const path = require("path");

function createPixiStub() {
  const graphicsInstances = [];

  class Container {
    constructor() {
      this.children = [];
      this.parent = null;
      this.visible = true;
      this.position = {
        x: 0,
        y: 0,
        set: (x = 0, y = 0) => {
          this.position.x = x;
          this.position.y = y;
        }
      };
      this.scale = {
        x: 1,
        y: 1,
        set: (x = 1, y = x) => {
          this.scale.x = x;
          this.scale.y = y;
        }
      };
    }

    addChild(...children) {
      for (const child of children) {
        if (!child) {
          continue;
        }
        child.parent = this;
        this.children.push(child);
      }
      return children[children.length - 1] || null;
    }

    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
      if (child) {
        child.parent = null;
      }
      return child;
    }

    destroy() {}
  }

  class Graphics extends Container {
    constructor() {
      super();
      this.clearCalls = 0;
      graphicsInstances.push(this);
    }

    clear() {
      this.clearCalls += 1;
      return this;
    }

    beginFill() { return this; }
    endFill() { return this; }
    lineStyle() { return this; }
    drawRect() { return this; }
    drawRoundedRect() { return this; }
    drawCircle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    quadraticCurveTo() { return this; }
    arc() { return this; }
  }

  class Sprite extends Container {
    constructor(texture) {
      super();
      this.texture = texture;
      this.anchor = { set: () => {} };
      this.rotation = 0;
      this.alpha = 1;
      this.roundPixels = false;
      this.tilePosition = { set: () => {} };
    }
  }

  class TilingSprite extends Sprite {
    constructor(texture, width, height) {
      super(texture);
      this.width = width;
      this.height = height;
      this.tilePosition = { set: () => {} };
    }
  }

  class Text extends Container {
    constructor(text = "", style = {}) {
      super();
      this.text = text;
      this.style = { ...style };
      this.anchor = { set: () => {} };
    }

    getLocalBounds() {
      return { width: 0, height: 0 };
    }
  }

  const applicationInstances = [];
  function Application(options) {
    this.view = { style: {} };
    this.renderer = {
      width: options.width,
      height: options.height,
      resolution: options.resolution || 1,
      render: jest.fn(),
      resize: jest.fn((width, height) => {
        this.renderer.width = width;
        this.renderer.height = height;
      })
    };
    this.stage = new Container();
    this.ticker = { stop: jest.fn() };
    applicationInstances.push(this);
  }

  const Texture = {
    WHITE: { kind: "white" },
    EMPTY: { kind: "empty" },
    from: (canvas) => ({
      baseTexture: {
        update: jest.fn(),
        scaleMode: 0,
        resource: {
          source: canvas
        }
      },
      update: jest.fn()
    })
  };

  return {
    PIXI: {
      Application,
      Container,
      Graphics,
      Sprite,
      Text,
      TilingSprite,
      Texture,
      SCALE_MODES: {
        NEAREST: 0,
        LINEAR: 1
      }
    },
    applicationInstances,
    graphicsInstances
  };
}

function createMockCanvasContext() {
  const gradientFactory = () => ({
    addColorStop: () => {}
  });
  const context = {
    clearRect: () => {},
    fillRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    createLinearGradient: gradientFactory,
    createRadialGradient: gradientFactory,
    measureText: () => ({ width: 0 })
  };
  return new Proxy(context, {
    get(target, property) {
      if (property in target) {
        return target[property];
      }
      target[property] = () => {};
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
}

function createMockDocument() {
  return {
    body: {
      appendChild: () => {}
    },
    createElement: (tagName) => {
      if (tagName !== "canvas") {
        return { style: {} };
      }
      const context = createMockCanvasContext();
      return {
        width: 0,
        height: 0,
        style: {},
        getContext: () => context
      };
    }
  };
}

function collectTextNodes(root, target = []) {
  if (!root || typeof root !== "object") {
    return target;
  }
  if (Object.prototype.hasOwnProperty.call(root, "text")) {
    target.push(root);
  }
  if (Array.isArray(root.children)) {
    for (const child of root.children) {
      collectTextNodes(child, target);
    }
  }
  return target;
}

describe("VibeClientPixiWorldRenderer", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/pixi-world-renderer.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientPixiWorldRenderer;
    delete globalThis.VibeClientRenderHumanoids;
    delete global.document;
  });

  afterEach(() => {
    delete globalThis.VibeClientPixiWorldRenderer;
    delete globalThis.VibeClientRenderHumanoids;
    delete global.document;
    jest.restoreAllMocks();
  });

  test("skips renderer resize work when dimensions are unchanged", () => {
    require(modulePath);

    const { PIXI, applicationInstances } = createPixiStub();
    const renderer = globalThis.VibeClientPixiWorldRenderer.createPixiWorldRenderer({
      PIXI,
      canvasElement: {
        style: {},
        parentNode: {
          insertBefore: () => {}
        }
      },
      windowObject: {
        devicePixelRatio: 1
      }
    });

    renderer.resize(800, 600);
    renderer.resize(800, 600);
    renderer.resize(1024, 600);

    expect(applicationInstances).toHaveLength(1);
    expect(applicationInstances[0].renderer.resize).toHaveBeenCalledTimes(1);
    expect(applicationInstances[0].renderer.resize).toHaveBeenCalledWith(1024, 600);
  });

  test("reuses humanoid sprite frames across nearby render passes", () => {
    require(modulePath);

    const { PIXI, applicationInstances } = createPixiStub();
    const drawHumanoid = jest.fn();
    globalThis.VibeClientRenderHumanoids = {
      createHumanoidRenderTools: () => ({
        drawHumanoid
      })
    };
    global.document = createMockDocument();
    let now = 100;
    jest.spyOn(global.performance, "now").mockImplementation(() => now);

    const canvasElement = {
      width: 800,
      height: 600,
      style: {},
      parentNode: {
        insertBefore: () => {}
      }
    };
    const renderer = globalThis.VibeClientPixiWorldRenderer.createPixiWorldRenderer({
      PIXI,
      canvasElement,
      windowObject: {
        devicePixelRatio: 1
      }
    });

    const self = {
      id: "self",
      x: 4,
      y: 6,
      classType: "mage",
      hp: 10,
      maxHp: 10,
      name: "Self"
    };
    const frameViewModel = {
      frameNow: 100,
      cameraX: 4.5,
      cameraY: 6.5,
      self,
      selfView: {
        player: self,
        isSelf: true,
        attackState: null,
        castVisual: null,
        statusVisual: null
      },
      playerViews: [],
      mobViews: [],
      projectileViews: [],
      lootBagViews: [],
      resourceNodeViews: [],
      areaEffects: [],
      explosionViews: [],
      floatingDamageViews: [],
      townVendor: null,
      townQuestGivers: [],
      hoveredMob: null,
      hoveredBag: null,
      hoveredResourceNode: null,
      hoveredVendor: null,
      hoveredQuestNpc: null
    };

    renderer.renderWorldFrame(frameViewModel);
    now = 110;
    renderer.renderWorldFrame({ ...frameViewModel, frameNow: 110 });
    now = 150;
    renderer.renderWorldFrame({ ...frameViewModel, frameNow: 150 });

    expect(applicationInstances).toHaveLength(1);
    expect(drawHumanoid).toHaveBeenCalledTimes(2);
    expect(applicationInstances[0].renderer.render).toHaveBeenCalledTimes(3);
  });

  test("keeps self and remote player nodes distinct when ids collide", () => {
    require(modulePath);

    const { PIXI, applicationInstances } = createPixiStub();
    globalThis.VibeClientRenderHumanoids = {
      createHumanoidRenderTools: () => ({
        drawHumanoid: () => {}
      })
    };
    global.document = createMockDocument();

    const renderer = globalThis.VibeClientPixiWorldRenderer.createPixiWorldRenderer({
      PIXI,
      canvasElement: {
        width: 800,
        height: 600,
        style: {},
        parentNode: {
          insertBefore: () => {}
        }
      },
      windowObject: {
        devicePixelRatio: 1
      }
    });

    const self = {
      id: "1",
      x: 4,
      y: 6,
      classType: "mage",
      hp: 10,
      maxHp: 10,
      name: "Self"
    };
    const other = {
      id: 1,
      x: 6,
      y: 6,
      classType: "mage",
      hp: 10,
      maxHp: 10,
      name: "Other"
    };
    renderer.renderWorldFrame({
      frameNow: 100,
      cameraX: 5,
      cameraY: 6.5,
      self,
      selfView: {
        player: self,
        isSelf: true,
        attackState: null,
        castVisual: null,
        statusVisual: null
      },
      playerViews: [
        {
          player: other,
          isSelf: false,
          attackState: null,
          castVisual: null,
          statusVisual: null
        }
      ],
      mobViews: [],
      projectileViews: [],
      lootBagViews: [],
      resourceNodeViews: [],
      areaEffects: [],
      explosionViews: [],
      floatingDamageViews: [],
      townVendor: null,
      townQuestGivers: [],
      hoveredMob: null,
      hoveredBag: null,
      hoveredResourceNode: null,
      hoveredVendor: null,
      hoveredQuestNpc: null
    });

    expect(applicationInstances).toHaveLength(1);
    const textLabels = collectTextNodes(applicationInstances[0].stage).map((node) => node.text);
    expect(textLabels).toEqual(expect.arrayContaining(["Self", "Other"]));
  });

  test("skips overlay redraws when labeled sprite state is unchanged", () => {
    require(modulePath);

    const { PIXI, graphicsInstances } = createPixiStub();
    globalThis.VibeClientRenderHumanoids = {
      createHumanoidRenderTools: () => ({
        drawHumanoid: () => {}
      })
    };
    global.document = createMockDocument();
    let now = 200;
    jest.spyOn(global.performance, "now").mockImplementation(() => now);

    const renderer = globalThis.VibeClientPixiWorldRenderer.createPixiWorldRenderer({
      PIXI,
      canvasElement: {
        width: 800,
        height: 600,
        style: {},
        parentNode: {
          insertBefore: () => {}
        }
      },
      windowObject: {
        devicePixelRatio: 1
      }
    });

    const baseSelf = {
      id: "self",
      x: 8,
      y: 9,
      classType: "warrior",
      hp: 10,
      maxHp: 12,
      name: "Overlay Tester"
    };
    const createFrame = (player, frameNow) => ({
      frameNow,
      cameraX: 8.5,
      cameraY: 9.5,
      self: player,
      selfView: {
        player,
        isSelf: true,
        attackState: null,
        castVisual: null,
        statusVisual: null
      },
      playerViews: [],
      mobViews: [],
      projectileViews: [],
      lootBagViews: [],
      resourceNodeViews: [],
      areaEffects: [],
      explosionViews: [],
      floatingDamageViews: [],
      townVendor: null,
      townQuestGivers: [],
      hoveredMob: null,
      hoveredBag: null,
      hoveredResourceNode: null,
      hoveredVendor: null,
      hoveredQuestNpc: null
    });
    const getClearTotal = () => graphicsInstances.reduce((sum, entry) => sum + entry.clearCalls, 0);

    renderer.renderWorldFrame(createFrame(baseSelf, 200));
    const afterFirst = getClearTotal();
    now = 230;
    renderer.renderWorldFrame(createFrame(baseSelf, 230));
    const afterSecond = getClearTotal();
    now = 260;
    renderer.renderWorldFrame(createFrame({ ...baseSelf, hp: 7 }, 260));
    const afterThird = getClearTotal();

    const unchangedDelta = afterSecond - afterFirst;
    const changedDelta = afterThird - afterSecond;
    expect(changedDelta).toBeGreaterThan(unchangedDelta);
    expect(changedDelta - unchangedDelta).toBeGreaterThanOrEqual(5);
  });
});
