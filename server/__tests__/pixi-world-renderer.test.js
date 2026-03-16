const path = require("path");

function createPixiStub() {
  class Container {
    constructor() {
      this.children = [];
      this.parent = null;
      this.visible = true;
      this.position = { set: () => {} };
      this.scale = { set: () => {} };
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
    clear() { return this; }
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
    from: () => ({
      baseTexture: {
        update: jest.fn(),
        scaleMode: 0
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
    applicationInstances
  };
}

describe("VibeClientPixiWorldRenderer", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/pixi-world-renderer.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientPixiWorldRenderer;
  });

  afterEach(() => {
    delete globalThis.VibeClientPixiWorldRenderer;
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
});
