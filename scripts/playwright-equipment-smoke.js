const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_STARTUP_MS = 1500;
const SEARCH_STEP_MS = 1500;
const CAST_INTERVAL_MS = 750;
const PICKUP_STEP_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function searchForVisibleMobs(page) {
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 }
  ];

  for (let step = 0; step < 18; step += 1) {
    const snapshot = await getState(page);
    if (snapshot.self && snapshot.mobs.length > 0) {
      return snapshot;
    }
    const dir = directions[step % directions.length];
    await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), dir);
    await sleep(SEARCH_STEP_MS);
    await page.evaluate(() => window.__vibemmoTest.stopMove());
    await sleep(150);
  }

  throw new Error("No visible mobs found during search.");
}

function getNearestEntity(self, list) {
  let best = null;
  let bestDist = Infinity;
  for (const entity of Array.isArray(list) ? list : []) {
    const dist = Math.hypot(Number(entity.x) - Number(self.x), Number(entity.y) - Number(self.y));
    if (dist < bestDist) {
      bestDist = dist;
      best = entity;
    }
  }
  return best;
}

async function killNearestMob(page) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const snapshot = await getState(page);
    if (snapshot.lootBags.length > 0) {
      return snapshot;
    }
    if (!snapshot.self || snapshot.mobs.length === 0) {
      await searchForVisibleMobs(page);
      continue;
    }

    const target = getNearestEntity(snapshot.self, snapshot.mobs);
    if (!target) {
      continue;
    }
    await page.evaluate((payload) => window.__vibemmoTest.castAtWorld("fireball", payload.x, payload.y), {
      x: target.x,
      y: target.y
    });
    await sleep(CAST_INTERVAL_MS);
  }

  throw new Error("Failed to kill a mob and produce a loot bag.");
}

async function moveToNearestBagAndLoot(page) {
  for (let step = 0; step < 70; step += 1) {
    const snapshot = await getState(page);
    if (snapshot.inventory.some((slot) => slot && slot.isEquipment)) {
      return snapshot;
    }
    if (!snapshot.self || snapshot.lootBags.length === 0) {
      await sleep(150);
      continue;
    }

    const bag = getNearestEntity(snapshot.self, snapshot.lootBags);
    const dir = normalizeDirection(bag.x - snapshot.self.x, bag.y - snapshot.self.y);
    const dist = Math.hypot(bag.x - snapshot.self.x, bag.y - snapshot.self.y);
    if (dist <= 2.25 || !dir) {
      await page.evaluate(() => window.__vibemmoTest.pickupNearestBag());
      await sleep(550);
      const nextSnapshot = await getState(page);
      if (nextSnapshot.inventory.some((slot) => slot && slot.isEquipment)) {
        return nextSnapshot;
      }
      continue;
    }

    await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), dir);
    await sleep(PICKUP_STEP_MS + 200);
    await page.evaluate(() => window.__vibemmoTest.stopMove());
    await page.evaluate(() => window.__vibemmoTest.pickupNearestBag());
    await sleep(100);
  }

  throw new Error("Failed to pick up an equipment drop.");
}

async function equipFirstEquipmentItem(page) {
  await page.keyboard.press("KeyI");
  await page.keyboard.press("KeyC");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const snapshot = await getState(page);
    if (!snapshot.equipmentVisible) {
      await sleep(100);
      continue;
    }
    const inventoryIndex = snapshot.inventory.findIndex((slot) => slot && slot.isEquipment && slot.slot);
    if (inventoryIndex < 0) {
      throw new Error("No equipment item found in inventory.");
    }
    const slot = snapshot.inventory[inventoryIndex].slot;
    await page.click(`#inventory-grid .inventory-slot[data-index="${inventoryIndex}"]`, { button: "right" });
    await sleep(300);
    const nextSnapshot = await getState(page);
    if (nextSnapshot.equipment && nextSnapshot.equipment[slot] && nextSnapshot.equipment[slot].itemId) {
      return {
        slot,
        inventoryIndex,
        state: nextSnapshot
      };
    }
  }

  throw new Error("Failed to equip looted item.");
}

async function assertNoDuplicateTooltipAffixes(page, inventoryIndex) {
  const result = await page.evaluate((slotIndex) => {
    const slotData = window.__vibemmoTest.getState().inventory[slotIndex];
    const slotEl = document.querySelector(`#inventory-grid .inventory-slot[data-index="${slotIndex}"]`);
    const title = slotEl ? String(slotEl.getAttribute("title") || "") : "";
    const tooltipAffixLines = title
      .split("\n")
      .filter((line) => line.trim().startsWith("- "))
      .map((line) => line.trim());
    const sourceAffixes = Array.isArray(slotData && slotData.affixes)
      ? slotData.affixes
      : [
          ...(Array.isArray(slotData && slotData.prefixes) ? slotData.prefixes : []),
          ...(Array.isArray(slotData && slotData.suffixes) ? slotData.suffixes : [])
        ];
    const expectedKeys = new Set(
      sourceAffixes.map((affix) => `${String(affix && (affix.id || affix.name || ""))}|${JSON.stringify(affix && affix.modifiers || [])}`)
    );
    return {
      title,
      tooltipAffixCount: tooltipAffixLines.length,
      expectedAffixCount: expectedKeys.size
    };
  }, inventoryIndex);

  if (result.tooltipAffixCount !== result.expectedAffixCount) {
    throw new Error(
      `Tooltip affix count mismatch. expected=${result.expectedAffixCount} actual=${result.tooltipAffixCount}\n${result.title}`
    );
  }
}

async function run() {
  const server = startServer();
  let browser;
  try {
    await sleep(SERVER_STARTUP_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    page.on("pageerror", (error) => {
      consoleErrors.push(String(error));
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__vibemmoTest && document.querySelector("#classType option[value]"));
    await page.fill("#name", "pw-mage");
    await page.selectOption("#classType", "mage");
    await page.click("#join-form button[type='submit']");
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest && window.__vibemmoTest.getState();
      return !!(state && state.self);
    });

    await searchForVisibleMobs(page);
    await killNearestMob(page);
    const lootState = await moveToNearestBagAndLoot(page);
    const inventoryIndex = lootState.inventory.findIndex((slot) => slot && slot.isEquipment);
    if (inventoryIndex < 0) {
      throw new Error("No equipment item in inventory after looting.");
    }
    await assertNoDuplicateTooltipAffixes(page, inventoryIndex);
    const equipResult = await equipFirstEquipmentItem(page);

    if (consoleErrors.length) {
      throw new Error(`Browser console errors detected:\n${consoleErrors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          equippedSlot: equipResult.slot,
          equippedItem: equipResult.state.equipment[equipResult.slot],
          status: equipResult.state.status
        },
        null,
        2
      )
    );
  } finally {
    if (browser) {
      await browser.close();
    }
    server.child.kill("SIGTERM");
    setTimeout(() => server.child.kill("SIGKILL"), 500).unref();
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
