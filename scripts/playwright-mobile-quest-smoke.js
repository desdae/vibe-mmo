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

async function getDialogueLayoutSnapshot(page) {
  return page.evaluate(() => {
    const dialoguePanel = document.getElementById("dialogue-panel");
    const dialogueContent = dialoguePanel ? dialoguePanel.querySelector(".dialogue-content") : null;
    const actionUi = document.getElementById("action-ui");
    if (!dialoguePanel || !actionUi) {
      return null;
    }
    const panelRect = dialoguePanel.getBoundingClientRect();
    const actionRect = actionUi.getBoundingClientRect();
    return {
      top: Math.round(panelRect.top),
      bottom: Math.round(panelRect.bottom),
      height: Math.round(panelRect.height),
      width: Math.round(panelRect.width),
      viewportHeight: window.innerHeight,
      actionTop: Math.round(actionRect.top),
      overlapPx: Math.max(0, Math.round(panelRect.bottom - actionRect.top)),
      contentScrollable: !!(dialogueContent && dialogueContent.scrollHeight > dialogueContent.clientHeight + 2),
      contentClientHeight: dialogueContent ? Math.round(dialogueContent.clientHeight) : 0,
      contentScrollHeight: dialogueContent ? Math.round(dialogueContent.scrollHeight) : 0
    };
  });
}

async function getQuestGiverTapPoint(page) {
  return page.evaluate(() => {
    const state = window.__vibemmoTest.getState();
    const questGiver = Array.isArray(state && state.town && state.town.questGivers) ? state.town.questGivers[0] : null;
    return questGiver ? { questGiver } : null;
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
      return window.__vibemmoTest.dispatchTouchTapAtWorld(
        Number(tapState.questGiver.x) + 0.5,
        Number(tapState.questGiver.y) + 0.5
      );
    }, tapPoint);

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!(state && state.dialogue && state.dialogue.visible);
    }, null, { timeout: 20000 });

    const finalState = await getState(page);
    const dialogue = finalState && finalState.dialogue ? finalState.dialogue : null;
    if (!dialogue || !dialogue.visible) {
      throw new Error(`Expected mobile tap to open quest dialogue. Final state=${JSON.stringify(finalState)}`);
    }
    const layout = await getDialogueLayoutSnapshot(page);
    if (!layout) {
      throw new Error("Failed to capture mobile quest dialogue layout.");
    }
    if (layout.top < 0) {
      throw new Error(`Expected mobile quest dialogue to stay on-screen. Layout=${JSON.stringify(layout)}`);
    }
    if (layout.overlapPx > 0) {
      throw new Error(`Expected mobile quest dialogue to clear action UI. Layout=${JSON.stringify(layout)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      questGiverId: String(tapPoint.questGiver && tapPoint.questGiver.id || ""),
      dialogueNpcName: String(dialogue.npcName || ""),
      dialogueType: String(dialogue.dialogueType || ""),
      layout,
      tappedWorld: {
        x: Number(tapPoint.questGiver && tapPoint.questGiver.x) + 0.5 || 0,
        y: Number(tapPoint.questGiver && tapPoint.questGiver.y) + 0.5 || 0
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
