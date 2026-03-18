const path = require("path");

describe("VibeClientConfigBootstrap", () => {
  const modulePath = path.resolve(__dirname, "../../public/client/config-bootstrap.js");

  beforeEach(() => {
    jest.resetModules();
    delete globalThis.VibeClientConfigBootstrap;
  });

  afterEach(() => {
    delete globalThis.VibeClientConfigBootstrap;
  });

  test("deduplicates concurrent join config loads", async () => {
    require(modulePath);

    const loadJoinConfig = jest.fn(async () => {
      await Promise.resolve();
      return true;
    });
    const tools = globalThis.VibeClientConfigBootstrap.createConfigBootstrapTools({
      loadJoinConfig,
      loadInitialConfig: async () => true,
      scheduleTask: () => {}
    });

    const first = tools.ensureJoinConfig();
    const second = tools.ensureJoinConfig();
    const third = tools.ensureJoinConfig();

    expect(first).toBe(second);
    expect(second).toBe(third);
    await expect(first).resolves.toBe(true);
    expect(loadJoinConfig).toHaveBeenCalledTimes(1);
  });

  test("deduplicates concurrent initial config loads", async () => {
    require(modulePath);

    const loadInitialConfig = jest.fn(async () => {
      await Promise.resolve();
      return true;
    });
    const tools = globalThis.VibeClientConfigBootstrap.createConfigBootstrapTools({
      loadJoinConfig: async () => true,
      loadInitialConfig,
      scheduleTask: () => {}
    });

    const first = tools.ensureInitialGameConfig();
    const second = tools.ensureInitialGameConfig();

    expect(first).toBe(second);
    await expect(first).resolves.toBe(true);
    expect(loadInitialConfig).toHaveBeenCalledTimes(1);
  });

  test("queues deferred audio preload only once until it runs", () => {
    require(modulePath);

    const scheduledTasks = [];
    const preloadAudio = jest.fn();
    const tools = globalThis.VibeClientConfigBootstrap.createConfigBootstrapTools({
      loadJoinConfig: async () => true,
      loadInitialConfig: async () => true,
      scheduleTask: (task) => {
        scheduledTasks.push(task);
      }
    });

    expect(tools.scheduleAbilityAudioPreload(preloadAudio)).toBe(true);
    expect(tools.scheduleAbilityAudioPreload(preloadAudio)).toBe(false);
    expect(scheduledTasks).toHaveLength(1);

    scheduledTasks[0]();

    expect(preloadAudio).toHaveBeenCalledTimes(1);
    expect(tools.scheduleAbilityAudioPreload(preloadAudio)).toBe(true);
    expect(scheduledTasks).toHaveLength(2);
  });
});
