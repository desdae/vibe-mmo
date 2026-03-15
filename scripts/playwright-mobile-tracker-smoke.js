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
  await page.fill("#name", "pw-mobile-tracker");
  await page.selectOption("#classType", "warrior");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.self);
  });
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.questState && Array.isArray(state.questState.active) && state.questState.active.length > 0);
  }, null, { timeout: 20000 });
}

async function getTrackerSnapshot(page) {
  return page.evaluate(() => {
    const tracker = document.getElementById("quest-tracker-panel");
    const button = document.getElementById("mobile-tracker-button");
    const actionUi = document.getElementById("action-ui");
    const state = window.__vibemmoTest.getState();
    if (!tracker || !button || !actionUi) {
      return null;
    }
    const trackerRect = tracker.getBoundingClientRect();
    const actionRect = actionUi.getBoundingClientRect();
    return {
      activeQuestCount: state && state.questState && Array.isArray(state.questState.active) ? state.questState.active.length : 0,
      trackerHidden: tracker.classList.contains("hidden"),
      trackerTop: Math.round(trackerRect.top),
      trackerBottom: Math.round(trackerRect.bottom),
      trackerWidth: Math.round(trackerRect.width),
      trackerHeight: Math.round(trackerRect.height),
      overlapPx: Math.max(0, Math.round(trackerRect.bottom - actionRect.top)),
      buttonHidden: button.classList.contains("hidden"),
      buttonActive: button.classList.contains("active"),
      buttonAttention: button.classList.contains("attention"),
      buttonLabel: String(button.textContent || "").trim()
    };
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

    const initial = await getTrackerSnapshot(page);
    if (!initial) {
      throw new Error("Failed to capture initial mobile tracker state.");
    }
    if (initial.activeQuestCount <= 0) {
      throw new Error(`Expected active mobile quests for tracker toggle. Snapshot=${JSON.stringify(initial)}`);
    }
    if (initial.buttonHidden) {
      throw new Error(`Expected tracker toggle button to be visible. Snapshot=${JSON.stringify(initial)}`);
    }
    if (!initial.trackerHidden) {
      throw new Error(`Expected mobile quest tracker to start collapsed. Snapshot=${JSON.stringify(initial)}`);
    }

    await page.click("#mobile-tracker-button");
    await page.waitForFunction(() => {
      const tracker = document.getElementById("quest-tracker-panel");
      return !!(tracker && !tracker.classList.contains("hidden"));
    });

    const opened = await getTrackerSnapshot(page);
    if (!opened || opened.trackerHidden) {
      throw new Error(`Expected mobile quest tracker to open. Snapshot=${JSON.stringify(opened)}`);
    }
    if (opened.overlapPx > 0) {
      throw new Error(`Expected mobile quest tracker to avoid action UI overlap. Snapshot=${JSON.stringify(opened)}`);
    }

    await page.click("#mobile-tracker-button");
    await page.waitForFunction(() => {
      const tracker = document.getElementById("quest-tracker-panel");
      return !!(tracker && tracker.classList.contains("hidden"));
    });

    const closed = await getTrackerSnapshot(page);
    if (!closed || !closed.trackerHidden) {
      throw new Error(`Expected mobile quest tracker to close again. Snapshot=${JSON.stringify(closed)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      initial,
      opened,
      closed
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
