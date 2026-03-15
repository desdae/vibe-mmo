const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_URL = "http://127.0.0.1:3000/";
const SERVER_STARTUP_MS = 1500;
const MOVE_STEP_MS = 150;
const MAX_MOVE_STEPS = 120;

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

function normalizeDirection(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (!len) {
    return null;
  }
  return {
    dx: dx / len,
    dy: dy / len
  };
}

async function stopMove(page) {
  await page.evaluate(() => window.__vibemmoTest.stopMove());
}

async function moveNearWorld(page, targetX, targetY, threshold = 2.8, maxSteps = MAX_MOVE_STEPS) {
  for (let step = 0; step < maxSteps; step += 1) {
    const state = await getState(page);
    if (!state.self) {
      throw new Error("Missing self state while moving.");
    }
    const dx = Number(targetX) - Number(state.self.x);
    const dy = Number(targetY) - Number(state.self.y);
    const dist = Math.hypot(dx, dy);
    if (dist <= threshold) {
      await stopMove(page);
      return;
    }
    const dir = normalizeDirection(dx, dy);
    if (!dir) {
      await stopMove(page);
      return;
    }
    await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), dir);
    await sleep(MOVE_STEP_MS);
  }
  await stopMove(page);
}

async function joinGame(page) {
  await page.goto(SERVER_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__vibemmoTest && document.querySelector("#classType option[value]"));
  await page.fill("#name", "pw-resources");
  await page.selectOption("#classType", "mage");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.self);
  });
}

async function waitForResources(page) {
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return Array.isArray(state && state.resourceNodes) && state.resourceNodes.length > 0;
  });
}

function findNearestResource(state, matcher) {
  if (!state || !state.self || !Array.isArray(state.resourceNodes)) {
    return null;
  }
  let best = null;
  let bestDist = Infinity;
  for (const node of state.resourceNodes) {
    if (matcher && !matcher(node)) {
      continue;
    }
    const dist = Math.hypot(Number(node.x) - Number(state.self.x), Number(node.y) - Number(state.self.y));
    if (dist < bestDist) {
      best = node;
      bestDist = dist;
    }
  }
  return best;
}

async function main() {
  const server = startServer();
  await sleep(SERVER_STARTUP_MS);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await joinGame(page);
    await waitForResources(page);

    let state = await getState(page);
    const resource = findNearestResource(
      state,
      (node) => String(node && node.skillId || "") === "woodcutting" && Number(node.requiredLevel) <= 1
    ) || findNearestResource(state);
    if (!resource) {
      throw new Error("No visible resource node found.");
    }
    await moveNearWorld(page, Number(resource.x) + 0.5, Number(resource.y) + 0.5, 3.2);
    state = await getState(page);

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return state.rendererStats && Number(state.rendererStats.resources || 0) > 0;
    });

    await page.evaluate(() => window.__vibemmoTest.setRendererMode("pixi"));
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return state.rendererMode === "pixi" && state.rendererStats && Number(state.rendererStats.resources || 0) > 0;
    });

    const beforeExp = Number((state.self && state.self.skills && state.self.skills.woodcutting && state.self.skills.woodcutting.exp) || 0);
    await page.evaluate((target) => window.__vibemmoTest.dispatchContextMenuAtWorld(target.x + 0.5, target.y + 0.5), {
      x: Number(resource.x) || 0,
      y: Number(resource.y) || 0
    });

    await page.waitForFunction((expectedNodeId) => {
      const state = window.__vibemmoTest.getState();
      const skillExp = Number((state.self && state.self.skills && state.self.skills.woodcutting && state.self.skills.woodcutting.exp) || 0);
      const inventory = Array.isArray(state.inventory) ? state.inventory.filter(Boolean) : [];
      const hasWood = inventory.some((entry) => ["oakLog", "birchLog", "pineLog", "sap", "resin"].includes(String(entry && entry.itemId || "")));
      const nodeStillVisible = Array.isArray(state.resourceNodes) && state.resourceNodes.some((node) => String(node && node.id || "") === String(expectedNodeId));
      return skillExp > 0 && hasWood && !nodeStillVisible;
    }, String(resource.id || ""), { timeout: 20000 });

    state = await getState(page);
    const afterExp = Number((state.self && state.self.skills && state.self.skills.woodcutting && state.self.skills.woodcutting.exp) || 0);
    if (afterExp <= beforeExp) {
      throw new Error(`Expected woodcutting XP to increase. Before=${beforeExp} After=${afterExp}`);
    }
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
