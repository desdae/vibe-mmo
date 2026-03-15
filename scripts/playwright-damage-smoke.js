const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_URL = "http://127.0.0.1:3000/";
const SERVER_STARTUP_MS = 1500;
const MOVE_STEP_MS = 150;
const MAX_MOVE_STEPS = 160;
const COMBAT_STEP_MS = 700;

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
  const length = Math.hypot(dx, dy);
  return length > 0 ? { dx: dx / length, dy: dy / length } : null;
}

async function getState(page) {
  return page.evaluate(() => window.__vibemmoTest.getState());
}

async function stopMove(page) {
  await page.evaluate(() => window.__vibemmoTest.stopMove());
}

async function moveNearWorld(page, targetX, targetY, threshold = 6.2, maxSteps = MAX_MOVE_STEPS) {
  for (let step = 0; step < maxSteps; step += 1) {
    const state = await getState(page);
    const self = state && state.self;
    if (!self) {
      throw new Error("Missing self state while moving.");
    }
    const dx = Number(targetX) - Number(self.x);
    const dy = Number(targetY) - Number(self.y);
    const distance = Math.hypot(dx, dy);
    if (distance <= threshold) {
      await stopMove(page);
      return;
    }
    const direction = normalizeDirection(dx, dy);
    if (!direction) {
      await stopMove(page);
      return;
    }
    await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), direction);
    await sleep(MOVE_STEP_MS);
  }
  await stopMove(page);
  return;
}

async function joinGame(page) {
  await page.goto(SERVER_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__vibemmoTest && document.querySelector("#classType option[value]"));
  await page.fill("#name", "pw-damage");
  await page.selectOption("#classType", "mage");
  await page.check("#isAdmin");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => !!(window.__vibemmoTest.getState() || {}).self);

  await page.evaluate(() => window.__vibemmoTest.send({ type: "admin_set_level", level: 10 }));
  await page.waitForFunction(() => Number((window.__vibemmoTest.getState().self || {}).level) >= 10);

  for (let index = 0; index < 4; index += 1) {
    await page.evaluate(() => window.__vibemmoTest.send({ type: "level_up_ability", abilityId: "lightningBeam" }));
    await page.evaluate(() => window.__vibemmoTest.send({ type: "level_up_ability", abilityId: "fireball" }));
    await sleep(80);
  }

  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(
      state.self &&
      state.self.abilityLevels &&
      Number(state.self.abilityLevels.lightningBeam) >= 5 &&
      Number(state.self.abilityLevels.fireball) >= 5
    );
  });
}

function findNearestHuntable(state) {
  if (!state || !state.self || !Array.isArray(state.mobs)) {
    return null;
  }
  let best = null;
  let bestDistance = Infinity;
  for (const mob of state.mobs) {
    const name = String(mob && mob.name || "").toLowerCase();
    if (!["rabbit", "deer", "boar"].some((token) => name.includes(token))) {
      continue;
    }
    const distance = Math.hypot(Number(mob.x) - Number(state.self.x), Number(mob.y) - Number(state.self.y));
    if (distance < bestDistance) {
      best = mob;
      bestDistance = distance;
    }
  }
  return best;
}

async function findAndApproachHuntable(page) {
  const starterWaypoints = [
    { x: 526, y: 518 },
    { x: 470, y: 522 },
    { x: 524, y: 484 },
    { x: 476, y: 480 }
  ];

  for (const waypoint of starterWaypoints) {
    await moveNearWorld(page, waypoint.x, waypoint.y, 8.5, 90);
    const state = await getState(page);
    const target = findNearestHuntable(state);
    if (target) {
      await moveNearWorld(page, Number(target.x), Number(target.y), 7.2, 60);
      return target;
    }
  }

  throw new Error("Failed to find a visible huntable animal.");
}

async function ensureFloatingDamageVisible(page) {
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return Number(state && state.floatingDamageCount) > 0;
  }, null, { timeout: 15000 });
}

async function dealDamageToVisibleHuntable(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await getState(page);
    const target = findNearestHuntable(state);
    if (!target) {
      throw new Error("Lost huntable target before casting.");
    }
    await moveNearWorld(page, Number(target.x), Number(target.y), 4.5, 24);
    await page.evaluate((coords) => window.__vibemmoTest.castAtWorld("fireball", coords.x, coords.y), {
      x: Number(target.x),
      y: Number(target.y)
    });
    await page.evaluate((coords) => window.__vibemmoTest.castAtWorld("lightningBeam", coords.x, coords.y), {
      x: Number(target.x),
      y: Number(target.y)
    });
    await sleep(COMBAT_STEP_MS);
    const stateAfterCast = await getState(page);
    if (Number(stateAfterCast && stateAfterCast.floatingDamageCount) > 0) {
      return stateAfterCast;
    }
  }
  await ensureFloatingDamageVisible(page);
  return getState(page);
}

async function main() {
  const server = startServer();
  await sleep(SERVER_STARTUP_MS);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await joinGame(page);
    await page.evaluate(() => window.__vibemmoTest.setRendererMode("pixi"));
    await page.waitForFunction(() => window.__vibemmoTest.getRendererMode() === "pixi");

    const initialState = await getState(page);
    await findAndApproachHuntable(page);
    const finalState = await dealDamageToVisibleHuntable(page);

    if (Number(finalState && finalState.floatingDamageCount) <= 0) {
      throw new Error("Expected floating damage numbers to be visible after dealing damage.");
    }

    console.log(JSON.stringify({
      ok: true,
      rendererMode: String(finalState.rendererMode || ""),
      floatingDamageCount: Number(finalState.floatingDamageCount) || 0,
      visibleMobCount: Array.isArray(finalState.mobs) ? finalState.mobs.length : 0,
      playerPosition: initialState && initialState.self
        ? {
            x: Number(finalState.self && finalState.self.x) || 0,
            y: Number(finalState.self && finalState.self.y) || 0
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
