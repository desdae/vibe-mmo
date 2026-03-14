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

async function ensurePanelVisible(page, panelSelector, toggleKey) {
  const isHidden = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    return !el || el.classList.contains("hidden");
  }, panelSelector);
  if (!isHidden) {
    return;
  }
  await page.keyboard.press(toggleKey);
  await page.waitForFunction((selector) => {
    const el = document.querySelector(selector);
    return !!(el && !el.classList.contains("hidden"));
  }, panelSelector);
}

async function ensurePanelHidden(page, panelSelector, toggleKey) {
  const isHidden = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    return !el || el.classList.contains("hidden");
  }, panelSelector);
  if (isHidden) {
    return;
  }
  await page.keyboard.press(toggleKey);
  await page.waitForFunction((selector) => {
    const el = document.querySelector(selector);
    return !!(el && el.classList.contains("hidden"));
  }, panelSelector);
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
  await ensurePanelVisible(page, "#inventory-panel", "KeyI");
  await ensurePanelHidden(page, "#equipment-panel", "KeyC");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const snapshot = await getState(page);
    const inventoryIndex = snapshot.inventory.findIndex((slot) => slot && slot.isEquipment);
    if (inventoryIndex < 0) {
      throw new Error("No equipment item found in inventory.");
    }
    const wantedInstanceId = snapshot.inventory[inventoryIndex].instanceId ? String(snapshot.inventory[inventoryIndex].instanceId) : "";
    const wantedItemId = String(snapshot.inventory[inventoryIndex].itemId || "");
    await page.click(`#inventory-grid .inventory-slot[data-index="${inventoryIndex}"]`, {
      button: "right",
      force: true
    });
    await sleep(300);
    const nextSnapshot = await getState(page);
    const equippedSlot = Object.entries(nextSnapshot.equipment || {}).find(([_slotId, entry]) => {
      if (!entry || !entry.itemId) {
        return false;
      }
      if (wantedInstanceId) {
        return String(entry.instanceId || "") === wantedInstanceId;
      }
      return String(entry.itemId || "") === wantedItemId;
    });
    if (equippedSlot) {
      return {
        slot: equippedSlot[0],
        inventoryIndex,
        state: nextSnapshot
      };
    }
  }

  throw new Error("Failed to equip looted item.");
}

async function grantEquipmentItem(page, { minAffixes = 1 } = {}) {
  await page.evaluate((minAffixesValue) => {
    window.__vibemmoTest.send({
      type: "admin_grant_equipment_item",
      minAffixes: minAffixesValue
    });
  }, Math.max(0, Math.floor(Number(minAffixes) || 0)));

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const snapshot = await getState(page);
    if (!snapshot.self) {
      throw new Error("Missing player state while granting equipment.");
    }
    if (!snapshot.self.isAdmin) {
      throw new Error(`Expected admin join for equipment smoke, got isAdmin=${snapshot.self.isAdmin}.`);
    }
    const statusText = String(snapshot.status || "").trim();
    if (statusText && statusText.toLowerCase().includes("failed")) {
      throw new Error(`Server reported failure while granting equipment: ${statusText}`);
    }
    if (statusText && statusText.toLowerCase().includes("error")) {
      throw new Error(`Server reported error while granting equipment: ${statusText}`);
    }
    if (statusText && statusText.toLowerCase().includes("admin rights required")) {
      throw new Error(`Server reported missing admin rights while granting equipment: ${statusText}`);
    }
    const equipmentIndex = snapshot.inventory.findIndex((slot) => {
      if (!slot || !slot.isEquipment) {
        return false;
      }
      const affixes = Array.isArray(slot.affixes)
        ? slot.affixes
        : [
            ...(Array.isArray(slot.prefixes) ? slot.prefixes : []),
            ...(Array.isArray(slot.suffixes) ? slot.suffixes : [])
          ];
      return affixes.length >= minAffixes;
    });
    if (equipmentIndex >= 0) {
      return snapshot;
    }
    await sleep(100);
  }

  throw new Error("Failed to grant an equipment item into inventory.");
}

async function assertNoDuplicateTooltipAffixes(page, inventoryIndex) {
  await ensurePanelVisible(page, "#inventory-panel", "KeyI");
  await page.hover(`#inventory-grid .inventory-slot[data-index="${inventoryIndex}"]`);
  await page.waitForSelector("#hover-tooltip:not(.hidden)");

  const result = await page.evaluate((slotIndex) => {
    const slotData = window.__vibemmoTest.getState().inventory[slotIndex];
    const tooltipEl = document.querySelector("#hover-tooltip");
    const tooltipAffixEls = tooltipEl ? Array.from(tooltipEl.querySelectorAll(".tooltip-affix")) : [];
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
      tooltipText: tooltipEl ? String(tooltipEl.textContent || "") : "",
      tooltipAffixCount: tooltipAffixEls.length,
      expectedAffixCount: expectedKeys.size
    };
  }, inventoryIndex);

  if (result.tooltipAffixCount !== result.expectedAffixCount) {
    throw new Error(
      `Tooltip affix count mismatch. expected=${result.expectedAffixCount} actual=${result.tooltipAffixCount}\n${result.tooltipText}`
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
    await page.check("#isAdmin");
    await page.click("#join-form button[type='submit']");
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest && window.__vibemmoTest.getState();
      return !!(state && state.self);
    });

    const grantedState = await grantEquipmentItem(page, { minAffixes: 1 });
    const inventoryIndex = grantedState.inventory.findIndex((slot) => slot && slot.isEquipment);
    if (inventoryIndex < 0) {
      throw new Error("No equipment item in inventory after grant.");
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
  } catch (error) {
    const logs = server.getLogs ? server.getLogs() : { stdout: "", stderr: "" };
    const stdout = String(logs.stdout || "").trim();
    const stderr = String(logs.stderr || "").trim();
    if (stdout) {
      console.error(`Server stdout:\n${stdout}`);
    }
    if (stderr) {
      console.error(`Server stderr:\n${stderr}`);
    }
    throw error;
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
