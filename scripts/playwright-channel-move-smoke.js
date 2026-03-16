const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_URL = "http://127.0.0.1:3000/";
const SERVER_STARTUP_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return {
    child,
    getLogs() {
      return { stdout, stderr };
    }
  };
}

async function getState(page) {
  return page.evaluate(() => window.__vibemmoTest.getState());
}

async function joinGame(page) {
  await page.goto(SERVER_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__vibemmoTest && document.querySelector("#classType option[value]"));
  await page.fill("#name", "pw-channel-move");
  await page.selectOption("#classType", "mage");
  await page.check("#isAdmin");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => !!(window.__vibemmoTest.getState() || {}).self);
  await page.evaluate(() => window.__vibemmoTest.send({ type: "admin_set_level", level: 10 }));
  await page.waitForFunction(() => Number((window.__vibemmoTest.getState().self || {}).level) >= 10);
  for (let index = 0; index < 4; index += 1) {
    await page.evaluate(() => window.__vibemmoTest.send({ type: "level_up_ability", abilityId: "lightningBeam" }));
    await sleep(80);
  }
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state.self && state.self.abilityLevels && Number(state.self.abilityLevels.lightningBeam) >= 5);
  });
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await sleep(SERVER_STARTUP_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await joinGame(page);

    await page.evaluate(() => {
      const state = window.__vibemmoTest.getState();
      const self = state.self;
      if (!self) {
        return false;
      }
      return window.__vibemmoTest.castAtWorld("lightningBeam", Number(self.x) + 8, Number(self.y));
    });

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!(state.castChannel && state.castChannel.active && state.castChannel.abilityId === "lightningBeam");
    });

    await page.evaluate(() => window.__vibemmoTest.setMove(1, 0));

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!(state.castChannel && state.castChannel.active === false);
    });

    const finalState = await getState(page);
    console.log(JSON.stringify({
      ok: true,
      castChannel: finalState.castChannel,
      self: finalState.self
        ? {
            x: Number(finalState.self.x) || 0,
            y: Number(finalState.self.y) || 0
          }
        : null
    }, null, 2));
  } catch (error) {
    const logs = server.getLogs();
    throw new Error(`${error.message}\n\nServer stdout:\n${logs.stdout}\n\nServer stderr:\n${logs.stderr}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await new Promise((resolve) => {
      server.child.once("exit", resolve);
      server.child.kill();
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
