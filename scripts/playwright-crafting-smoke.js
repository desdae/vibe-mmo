const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_URL = "http://127.0.0.1:3000/";
const SERVER_STARTUP_MS = 1500;
const MOVE_STEP_MS = 150;

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

function normalizeDirection(dx, dy) {
  const len = Math.hypot(dx, dy);
  return len > 0 ? { dx: dx / len, dy: dy / len } : null;
}

async function getState(page) {
  return page.evaluate(() => window.__vibemmoTest.getState());
}

async function stopMove(page) {
  await page.evaluate(() => window.__vibemmoTest.stopMove());
}

async function moveNearWorld(page, targetX, targetY, threshold = 3, maxSteps = 120) {
  for (let step = 0; step < maxSteps; step += 1) {
    const state = await getState(page);
    const self = state && state.self;
    if (!self) {
      throw new Error("Missing self state while moving.");
    }
    const dx = Number(targetX) - Number(self.x);
    const dy = Number(targetY) - Number(self.y);
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
  await page.fill("#name", "pw-crafting");
  await page.selectOption("#classType", "mage");
  await page.check("#isAdmin");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.self && Array.isArray(state.resourceNodes));
  });
}

function getInventoryCount(state, itemId) {
  return (Array.isArray(state && state.inventory) ? state.inventory.filter(Boolean) : []).reduce((sum, entry) => {
    if (String(entry && entry.itemId || "") !== String(itemId || "")) {
      return sum;
    }
    return sum + Math.max(0, Number(entry && entry.qty) || 0);
  }, 0);
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

async function gatherNearest(page, matcher, completionCheck, maxAttempts = 8, waypoints = []) {
  for (const waypoint of waypoints) {
    await moveNearWorld(page, waypoint.x, waypoint.y, 6.5, 90);
    const waypointState = await getState(page);
    if (completionCheck(waypointState)) {
      return;
    }
  }
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = await getState(page);
    if (completionCheck(state)) {
      return;
    }
    const node = findNearestResource(state, matcher);
    if (!node) {
      await sleep(300);
      continue;
    }
    await moveNearWorld(page, Number(node.x) + 0.5, Number(node.y) + 0.5, 3.2);
    await page.evaluate((target) => window.__vibemmoTest.dispatchContextMenuAtWorld(target.x + 0.5, target.y + 0.5), {
      x: Number(node.x) || 0,
      y: Number(node.y) || 0
    });
    await sleep(1400);
  }
  throw new Error("Failed to gather required crafting materials in time.");
}

async function main() {
  const server = startServer();
  await sleep(SERVER_STARTUP_MS);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await joinGame(page);

    await page.evaluate(() => {
      window.__vibemmoTest.send({ type: "admin_grant_item", itemId: "oakLog", qty: 3 });
      window.__vibemmoTest.send({ type: "admin_grant_item", itemId: "sap", qty: 1 });
      window.__vibemmoTest.send({ type: "admin_grant_item", itemId: "roughStone", qty: 2 });
    });
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      const inventory = Array.isArray(state.inventory) ? state.inventory.filter(Boolean) : [];
      const countOf = (itemId) => inventory.reduce((sum, entry) => sum + (String(entry && entry.itemId || "") === itemId ? Number(entry && entry.qty) || 0 : 0), 0);
      return countOf("oakLog") >= 3 && countOf("sap") >= 1 && countOf("roughStone") >= 2;
    });

    await page.keyboard.press("o");
    await page.waitForFunction(() => {
      const panel = document.getElementById("crafting-panel");
      return !!(panel && !panel.classList.contains("hidden"));
    });
    const recipeEntry = page.locator("#crafting-item-list .crafting-item-entry").filter({ hasText: "Crude Pickaxe" }).first();
    await recipeEntry.locator("button", { hasText: "Craft" }).click();

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      const inventory = Array.isArray(state.inventory) ? state.inventory.filter(Boolean) : [];
      return inventory.some((entry) => String(entry && entry.itemId || "") === "crudePickaxe");
    }, null, { timeout: 12000 });
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
