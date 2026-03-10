function createGameLoop(options = {}) {
  const tickMs = Math.max(1, Number(options.tickMs) || 50);
  const runTick = typeof options.runTick === "function" ? options.runTick : null;
  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => Date.now();
  const setIntervalFn = typeof options.setIntervalFn === "function" ? options.setIntervalFn : setInterval;
  const clearIntervalFn = typeof options.clearIntervalFn === "function" ? options.clearIntervalFn : clearInterval;

  if (!runTick) {
    throw new Error("createGameLoop requires a runTick function");
  }

  let intervalId = null;

  function tickOnce() {
    runTick(nowProvider());
  }

  function start() {
    if (intervalId !== null) {
      return false;
    }
    intervalId = setIntervalFn(tickOnce, tickMs);
    return true;
  }

  function stop() {
    if (intervalId === null) {
      return false;
    }
    clearIntervalFn(intervalId);
    intervalId = null;
    return true;
  }

  function isRunning() {
    return intervalId !== null;
  }

  return {
    tickMs,
    tickOnce,
    start,
    stop,
    isRunning
  };
}

module.exports = {
  createGameLoop
};
