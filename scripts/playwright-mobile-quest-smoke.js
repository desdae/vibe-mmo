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

async function joinGame(page) {
  await page.goto(SERVER_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__vibemmoTest && document.querySelector("#classType option[value]"));
  await page.fill("#name", "pw-mobile-quest");
  await page.selectOption("#classType", "mage");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.self && state.town && Array.isArray(state.town.questGivers));
  });
}

async function getState(page) {
  return page.evaluate(() => window.__vibemmoTest.getState());
}

async function getQuestGiverTapPoint(page) {
  return page.evaluate(() => {
    const state = window.__vibemmoTest.getState();
    const questGiver = Array.isArray(state && state.town && state.town.questGivers) ? state.town.questGivers[0] : null;
    const self = state && state.self ? state.self : null;
    return questGiver && self ? { questGiver, self } : null;
  });
}

async function main() {
  const server = startServer();
  await sleep(SERVER_STARTUP_MS);

  let browser;
  let context;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    await joinGame(page);
    const tapPoint = await getQuestGiverTapPoint(page);
    if (!tapPoint) {
      throw new Error("Failed to resolve mobile tap point for the quest giver.");
    }

    await page.evaluate((tapState) => {
      return window.__vibemmoTest.dispatchTouchTapAtWorld(Number(tapState.self.x), Number(tapState.self.y));
    }, tapPoint);

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!(state && state.dialogue && state.dialogue.visible);
    }, null, { timeout: 12000 });

    const finalState = await getState(page);
    const dialogue = finalState && finalState.dialogue ? finalState.dialogue : null;
    if (!dialogue || !dialogue.visible) {
      throw new Error(`Expected mobile tap to open quest dialogue. Final state=${JSON.stringify(finalState)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      questGiverId: String(tapPoint.questGiver && tapPoint.questGiver.id || ""),
      dialogueNpcName: String(dialogue.npcName || ""),
      dialogueType: String(dialogue.dialogueType || ""),
      tappedWorld: {
        x: Number(tapPoint.self && tapPoint.self.x) || 0,
        y: Number(tapPoint.self && tapPoint.self.y) || 0
      },
      playerPosition: finalState && finalState.self
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
    if (context) {
      await context.close().catch(() => {});
    }
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
