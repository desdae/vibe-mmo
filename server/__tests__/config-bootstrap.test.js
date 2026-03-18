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

  test("deduplicates concurrent initial config loads", async () => {
    require(modulePath);

    const loadConfig = jest.fn(async () => {
      await Promise.resolve();
      return true;
    });
    const tools = globalThis.VibeClientConfigBootstrap.createConfigBootstrapTools({
      loadConfig,
      scheduleTask: () => {}
    });

    const first = tools.ensureInitialGameConfig();
    const second = tools.ensureInitialGameConfig();
    const third = tools.ensureInitialGameConfig();

    expect(first).toBe(second);
    expect(second).toBe(third);
    await expect(first).resolves.toBe(true);
    expect(loadConfig).toHaveBeenCalledTimes(1);
  });

  test("queues deferred audio preload only once until it runs", () => {
    require(modulePath);

    const scheduledTasks = [];
    const preloadAudio = jest.fn();
    const tools = globalThis.VibeClientConfigBootstrap.createConfigBootstrapTools({
      loadConfig: async () => true,
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
