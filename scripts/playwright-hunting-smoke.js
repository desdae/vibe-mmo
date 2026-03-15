const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_URL = "http://127.0.0.1:3000/";
const SERVER_STARTUP_MS = 1500;
const MOVE_STEP_MS = 150;
const COMBAT_STEP_MS = 700;
const MAX_MOVE_STEPS = 160;

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

async function moveNearWorld(page, targetX, targetY, threshold = 6.2, maxSteps = MAX_MOVE_STEPS) {
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
  await page.fill("#name", "pw-hunting");
  await page.selectOption("#classType", "mage");
  await page.check("#isAdmin");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.self);
  });
  await page.evaluate(() => window.__vibemmoTest.send({ type: "admin_set_level", level: 10 }));
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state.self && Number(state.self.level) >= 10);
  });
  for (let i = 0; i < 4; i += 1) {
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
  let bestDist = Infinity;
  for (const mob of state.mobs) {
    const name = String(mob && mob.name || "").toLowerCase();
    if (!["rabbit", "deer", "boar"].some((token) => name.includes(token))) {
      continue;
    }
    const dist = Math.hypot(Number(mob.x) - Number(state.self.x), Number(mob.y) - Number(state.self.y));
    if (dist < bestDist) {
      best = mob;
      bestDist = dist;
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
  const searchDirections = [
    { dx: 1, dy: 0 },
    { dx: 1, dy: 0.35 },
    { dx: 1, dy: -0.35 },
    { dx: 0.8, dy: 0.6 },
    { dx: 0.8, dy: -0.6 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  for (const waypoint of starterWaypoints) {
    await moveNearWorld(page, waypoint.x, waypoint.y, 8.5, 90);
    const state = await getState(page);
    const huntable = findNearestHuntable(state);
    if (huntable) {
      await moveNearWorld(page, Number(huntable.x), Number(huntable.y), 7.2);
      return huntable;
    }
  }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = await getState(page);
    const huntable = findNearestHuntable(state);
    if (huntable) {
      await moveNearWorld(page, Number(huntable.x), Number(huntable.y), 7.2);
      return huntable;
    }
    const dir = searchDirections[attempt % searchDirections.length];
    await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), dir);
    await sleep(550);
    await stopMove(page);
    await sleep(150);
  }
  throw new Error("Failed to find a visible huntable animal.");
}

async function killVisibleHuntable(page) {
  const sweepDirections = [
    { dx: 1, dy: 0 },
    { dx: 0.8, dy: 0.5 },
    { dx: 0.8, dy: -0.5 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = await getState(page);
    const target = findNearestHuntable(state);
    if (!target) {
      const dir = sweepDirections[attempt % sweepDirections.length];
      await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), dir);
      await sleep(240);
      await stopMove(page);
      continue;
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
    const afterState = await getState(page);
    if (Array.isArray(afterState.lootBags) && afterState.lootBags.length > 0) {
      return;
    }
  }
  throw new Error("Failed to kill the huntable target in time.");
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

    const beforeState = await getState(page);
    const beforeXp = Number((beforeState.self && beforeState.self.skills && beforeState.self.skills.hunting && beforeState.self.skills.hunting.exp) || 0);
    await findAndApproachHuntable(page);
    await killVisibleHuntable(page);

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return Array.isArray(state.lootBags) && state.lootBags.length > 0;
    }, null, { timeout: 20000 });
    const bagState = await getState(page);
    const bag = Array.isArray(bagState.lootBags) ? bagState.lootBags[0] : null;
    if (bag) {
      await moveNearWorld(page, Number(bag.x), Number(bag.y), 1.4, 60);
    }
    await page.evaluate(() => window.__vibemmoTest.pickupNearestBag());
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      const inventory = Array.isArray(state.inventory) ? state.inventory.filter(Boolean) : [];
      const hasInventoryItem = inventory.some((entry) =>
        ["rawMeat", "rabbitPelt", "lightHide", "deerAntler", "thickHide", "boarTusk"].includes(String(entry && entry.itemId || ""))
      );
      const bags = Array.isArray(state.lootBags) ? state.lootBags : [];
      const hasBagItem = bags.some((entry) =>
        Array.isArray(entry && entry.items) &&
        entry.items.some((item) =>
          ["rawMeat", "rabbitPelt", "lightHide", "deerAntler", "thickHide", "boarTusk"].includes(String(item && item.itemId || ""))
        )
      );
      return hasInventoryItem || hasBagItem;
    }, null, { timeout: 12000 });

    const finalState = await getState(page);
    const inventory = Array.isArray(finalState.inventory) ? finalState.inventory.filter(Boolean) : [];
    const bagItems = Array.isArray(finalState.lootBags)
      ? finalState.lootBags.flatMap((entry) => (Array.isArray(entry && entry.items) ? entry.items : []))
      : [];
    const hasHuntItem = inventory.concat(bagItems).some((entry) =>
        ["rawMeat", "rabbitPelt", "lightHide", "deerAntler", "thickHide", "boarTusk"].includes(String(entry && entry.itemId || ""))
    );
    if (!hasHuntItem) {
      throw new Error("Expected hunt loot to appear either in inventory or in the spawned loot bag.");
    }
    const afterXp = Number((finalState.self && finalState.self.skills && finalState.self.skills.hunting && finalState.self.skills.hunting.exp) || 0);
    if (afterXp <= beforeXp) {
      throw new Error(`Expected hunting XP to increase. Before=${beforeXp} After=${afterXp}`);
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
