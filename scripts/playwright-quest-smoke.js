const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_URL = "http://127.0.0.1:3000/";
const SERVER_STARTUP_MS = 1500;
const MOVE_STEP_MS = 150;
const MAX_MOVE_STEPS = 140;
const COMBAT_STEP_MS = 750;

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
  if (!len) {
    return null;
  }
  return {
    dx: dx / len,
    dy: dy / len
  };
}

async function getState(page) {
  return page.evaluate(() => window.__vibemmoTest.getState());
}

async function stopMove(page) {
  await page.evaluate(() => window.__vibemmoTest.stopMove());
}

async function moveNearWorld(page, targetX, targetY, threshold = 0.9, maxSteps = MAX_MOVE_STEPS) {
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
      return state;
    }
    const dir = normalizeDirection(dx, dy);
    if (!dir) {
      await stopMove(page);
      return state;
    }
    await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), dir);
    await sleep(MOVE_STEP_MS);
  }
  await stopMove(page);
  const state = await getState(page);
  throw new Error(
    `Failed to reach (${targetX.toFixed(2)}, ${targetY.toFixed(2)}). ` +
      `Current position: (${Number(state.self && state.self.x).toFixed(2)}, ${Number(state.self && state.self.y).toFixed(2)}).`
  );
}

async function joinGame(page) {
  await page.goto(SERVER_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__vibemmoTest && document.querySelector("#classType option[value]"));
  await page.fill("#name", "pw-quests");
  await page.selectOption("#classType", "mage");
  await page.check("#isAdmin");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest && window.__vibemmoTest.getState();
    return !!(state && state.self && state.town && state.town.vendor && Array.isArray(state.town.questGivers));
  });

  await page.evaluate(() => window.__vibemmoTest.send({ type: "admin_set_level", level: 10 }));
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state.self && Number(state.self.level) >= 10);
  });
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(() => window.__vibemmoTest.send({ type: "level_up_ability", abilityId: "lightningBeam" }));
    await sleep(80);
  }
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state.self && state.self.abilityLevels && Number(state.self.abilityLevels.lightningBeam) >= 5);
  });
}

async function clickDialogueButton(page, name) {
  const button = page.getByRole("button", { name, exact: true });
  await button.waitFor({ state: "visible", timeout: 5000 });
  await button.click();
}

async function openQuestNpcDialogue(page, npc) {
  await moveNearWorld(page, Number(npc.x) + 0.5, Number(npc.y) + 0.5, 0.95);
  await page.evaluate((coords) => window.__vibemmoTest.dispatchContextMenuAtWorld(coords.x, coords.y), {
    x: Number(npc.x) + 0.5,
    y: Number(npc.y) + 0.5
  });
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state.dialogue && state.dialogue.visible);
  });
}

async function getDialogueChoiceTexts(page) {
  return page.evaluate(() => {
    const state = window.__vibemmoTest.getState();
    const node = state && state.dialogue ? state.dialogue.node : null;
    return Array.isArray(node && node.choices)
      ? node.choices.map((choice) => String(choice && choice.text || "")).filter(Boolean)
      : [];
  });
}

async function getActiveQuestByTitle(page, title) {
  return page.evaluate((expectedTitle) => {
    const state = window.__vibemmoTest.getState();
    return Array.isArray(state.questState && state.questState.active)
      ? state.questState.active.find((quest) => String(quest && quest.title || "") === expectedTitle) || null
      : null;
  }, title);
}

async function closeVendorPanelIfOpen(page) {
  const dialogueVisible = await page.evaluate(() => {
    const panel = document.getElementById("dialogue-panel");
    return !!(panel && !panel.classList.contains("hidden"));
  });
  if (dialogueVisible) {
    const leaveButton = page.getByRole("button", { name: "Leave", exact: true });
    if (await leaveButton.isVisible().catch(() => false)) {
      await leaveButton.click();
      await page.waitForFunction(() => {
        const panel = document.getElementById("dialogue-panel");
        return !panel || panel.classList.contains("hidden");
      });
    }
  }

  const closeButton = page.locator("#vendor-close");
  if (await closeButton.count()) {
    const hidden = await page.evaluate(() => {
      const panel = document.getElementById("vendor-panel");
      return !panel || panel.classList.contains("hidden");
    });
    if (!hidden) {
      await closeButton.click();
      await page.waitForFunction(() => {
        const panel = document.getElementById("vendor-panel");
        return !panel || panel.classList.contains("hidden");
      });
    }
  }
}

async function ensureQuestAccepted(page, questId) {
  await page.waitForFunction((expectedQuestId) => {
    const state = window.__vibemmoTest.getState();
    return Array.isArray(state.questState && state.questState.active) &&
      state.questState.active.some((quest) => String(quest && quest.questId || "") === expectedQuestId);
  }, questId);
}

async function ensureQuestCompleted(page, questId) {
  await page.waitForFunction((expectedQuestId) => {
    const state = window.__vibemmoTest.getState();
    return Array.isArray(state.questState && state.questState.completed) &&
      state.questState.completed.includes(expectedQuestId);
  }, questId);
}

async function ensureObjectiveComplete(page, questId, textFragment) {
  await page.waitForFunction(({ expectedQuestId, expectedText }) => {
    const state = window.__vibemmoTest.getState();
    const quest = Array.isArray(state.questState && state.questState.active)
      ? state.questState.active.find((entry) => String(entry && entry.questId || "") === expectedQuestId)
      : null;
    if (!quest || !Array.isArray(quest.objectives)) {
      return false;
    }
    const objective = quest.objectives.find((entry) => String(entry && entry.description || "").includes(expectedText));
    return !!(objective && objective.complete);
  }, { expectedQuestId: questId, expectedText: textFragment });
}

async function ensurePixiQuestNpcVisible(page, expectedNpcId) {
  await page.evaluate(() => window.__vibemmoTest.setRendererMode("pixi"));
  await page.waitForFunction(() => window.__vibemmoTest.getRendererMode() === "pixi");
  let lastState = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    lastState = await getState(page);
    const stats = lastState && lastState.rendererStats ? lastState.rendererStats : null;
    const samples = Array.isArray(stats && stats.questNpcSamples) ? stats.questNpcSamples : [];
    const sample = samples.find((entry) => String(entry && entry.id || "") === expectedNpcId);
    if (
      stats &&
      stats.mode === "pixi" &&
      Number(stats.questNpcCount) >= 1 &&
      sample &&
      sample.visible &&
      sample.spriteVisible &&
      sample.onScreen &&
      String(sample.label || "").includes("Town Herald")
    ) {
      return;
    }
    await sleep(250);
  }
  throw new Error(
    `Town Herald was not visible in Pixi renderer. Last renderer snapshot:\n${JSON.stringify(
      lastState && lastState.rendererStats ? lastState.rendererStats : lastState,
      null,
      2
    )}`
  );
}

function findNearestMob(state, matcher) {
  if (!state || !state.self || !Array.isArray(state.mobs)) {
    return null;
  }
  let best = null;
  let bestDist = Infinity;
  for (const mob of state.mobs) {
    if (!matcher(mob)) {
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

async function completeZombieObjective(page, questId) {
  const searchDirections = [
    { dx: 1, dy: 0 },
    { dx: 1, dy: 0.35 },
    { dx: 1, dy: -0.35 },
    { dx: 0.8, dy: 0.6 },
    { dx: 0.8, dy: -0.6 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = await getState(page);
    const activeQuest = Array.isArray(state.questState && state.questState.active)
      ? state.questState.active.find((quest) => String(quest && quest.questId || "") === questId)
      : null;
    const zombieObjective = activeQuest && Array.isArray(activeQuest.objectives)
      ? activeQuest.objectives.find((objective) => String(objective && objective.description || "").includes("Kill 3 zombies"))
      : null;
    if (zombieObjective && zombieObjective.complete) {
      return;
    }

    const zombie = findNearestMob(state, (mob) => String(mob && mob.name || "").toLowerCase().includes("zombie"));
    if (zombie) {
      const zombieDistance = Math.hypot(Number(zombie.x) - Number(state.self.x), Number(zombie.y) - Number(state.self.y));
      if (zombieDistance > 7.5) {
        const dir = normalizeDirection(Number(zombie.x) - Number(state.self.x), Number(zombie.y) - Number(state.self.y));
        if (dir) {
          await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), dir);
          await sleep(350);
          await stopMove(page);
          await sleep(100);
          continue;
        }
      }
    }

    if (zombie && Number(state.self && state.self.mana) > 0) {
      await page.evaluate((target) => window.__vibemmoTest.castAtWorld("lightningBeam", target.x, target.y), {
        x: zombie.x,
        y: zombie.y
      });
      await sleep(COMBAT_STEP_MS);
      continue;
    }

    const sweepDir = searchDirections[attempt % searchDirections.length];
    await page.evaluate((moveDir) => window.__vibemmoTest.setMove(moveDir.dx, moveDir.dy), sweepDir);
    await sleep(600);
    await stopMove(page);
    await sleep(150);
  }

  const state = await getState(page);
  throw new Error(
    `Failed to complete zombie objective. Visible mobs: ${state.mobs.map((mob) => mob.name).join(", ")}\n` +
      `Final quest state: ${JSON.stringify(state.questState, null, 2)}`
  );
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

    await joinGame(page);
    await ensurePixiQuestNpcVisible(page, "town_herald");

    const initialState = await getState(page);
    const town = initialState.town;
    const vendor = town && town.vendor ? town.vendor : null;
    const herald = town && Array.isArray(town.questGivers)
      ? town.questGivers.find((npc) => String(npc && npc.id || "") === "town_herald")
      : null;
    if (!vendor || !herald) {
      throw new Error(`Missing town vendor or herald in automation snapshot: ${JSON.stringify(town, null, 2)}`);
    }

    await moveNearWorld(page, Number(herald.x) + 0.5, Number(herald.y) - 5.5, 0.7);
    await page.evaluate((coords) => window.__vibemmoTest.dispatchContextMenuAtWorld(coords.x, coords.y), {
      x: Number(herald.x) + 0.5,
      y: Number(herald.y) + 0.5
    });

    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!(
        (state.autoMove && state.autoMove.active && state.autoMove.questNpcId === "town_herald") ||
        (state.dialogue && state.dialogue.visible && state.dialogue.npcName === "Town Herald")
      );
    });
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!(state.dialogue && state.dialogue.visible && state.dialogue.npcName === "Town Herald");
    });

    await clickDialogueButton(page, "Continue");
    await clickDialogueButton(page, "I'll help!");
    await clickDialogueButton(page, "Accept Quest");

    await ensureQuestAccepted(page, "quest_first_steps");

    await page.keyboard.press("KeyQ");
    await page.waitForFunction(() => {
      const panel = document.getElementById("quest-panel");
      return !!(panel && !panel.classList.contains("hidden") && panel.textContent.includes("First Steps"));
    });
    await page.keyboard.press("KeyQ");
    await page.waitForFunction(() => {
      const panel = document.getElementById("quest-panel");
      return !!(panel && panel.classList.contains("hidden"));
    });

    await moveNearWorld(page, Number(vendor.x) + 0.5, Number(vendor.y) + 0.5, 0.8);
    await page.evaluate((coords) => window.__vibemmoTest.dispatchContextMenuAtWorld(coords.x, coords.y), {
      x: Number(vendor.x) + 0.5,
      y: Number(vendor.y) + 0.5
    });
    await ensureObjectiveComplete(page, "quest_first_steps", "Quartermaster");
    const leaveButton = page.getByRole("button", { name: "Leave", exact: true });
    if (await leaveButton.count()) {
      const dialogueVisible = await page.evaluate(() => {
        const state = window.__vibemmoTest.getState();
        return !!(state.dialogue && state.dialogue.visible);
      });
      if (dialogueVisible) {
        await leaveButton.click();
      }
    }
    await closeVendorPanelIfOpen(page);

    await page.evaluate(() => window.__vibemmoTest.send({ type: "admin_complete_quest", questId: "quest_first_steps" }));
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      const quest = Array.isArray(state.questState && state.questState.active)
        ? state.questState.active.find((entry) => String(entry && entry.questId || "") === "quest_first_steps")
        : null;
      return !!(quest && Array.isArray(quest.objectives) && quest.objectives.every((objective) => objective.complete));
    });

    await moveNearWorld(page, Number(herald.x) + 0.5, Number(herald.y) + 0.5, 0.95);
    await page.evaluate((coords) => window.__vibemmoTest.dispatchContextMenuAtWorld(coords.x, coords.y), {
      x: Number(herald.x) + 0.5,
      y: Number(herald.y) + 0.5
    });
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!(state.dialogue && state.dialogue.visible && state.dialogue.node && state.dialogue.node.questComplete);
    });
    await clickDialogueButton(page, "Complete Quest");
    await ensureQuestCompleted(page, "quest_first_steps");

    await openQuestNpcDialogue(page, herald);
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      const node = state.dialogue && state.dialogue.node;
      return !!(node && Array.isArray(node.choices) && node.choices.length >= 3);
    });
    const questChoiceTexts = await getDialogueChoiceTexts(page);
    const scoutingChoice =
      questChoiceTexts.find((label) => /scout|survey|check/i.test(label)) ||
      questChoiceTexts[0];
    if (!scoutingChoice) {
      throw new Error(`Expected at least one generated quest choice, got: ${JSON.stringify(questChoiceTexts)}`);
    }
    await clickDialogueButton(page, scoutingChoice);
    await clickDialogueButton(page, "I'll take this one.");
    await clickDialogueButton(page, "Accept Quest");

    await page.waitForFunction((expectedTitle) => {
      const state = window.__vibemmoTest.getState();
      return Array.isArray(state.questState && state.questState.active) &&
        state.questState.active.some((quest) => String(quest && quest.title || "") === expectedTitle);
    }, scoutingChoice);
    const generatedQuest = await getActiveQuestByTitle(page, scoutingChoice);
    if (!generatedQuest || !generatedQuest.questId) {
      throw new Error(`Failed to find accepted generated scouting quest: ${JSON.stringify(generatedQuest)}`);
    }

    await page.evaluate((questId) => window.__vibemmoTest.send({ type: "admin_complete_quest", questId }), generatedQuest.questId);
    await page.waitForFunction((questId) => {
      const state = window.__vibemmoTest.getState();
      const quest = Array.isArray(state.questState && state.questState.active)
        ? state.questState.active.find((entry) => String(entry && entry.questId || "") === questId)
        : null;
      return !!(quest && Array.isArray(quest.objectives) && quest.objectives.every((objective) => objective.complete));
    }, generatedQuest.questId);

    await openQuestNpcDialogue(page, herald);
    await page.waitForFunction((questId) => {
      const state = window.__vibemmoTest.getState();
      return !!(
        state.dialogue &&
        state.dialogue.visible &&
        state.dialogue.questId === questId &&
        state.dialogue.node &&
        state.dialogue.node.questComplete
      );
    }, generatedQuest.questId);
    await clickDialogueButton(page, "Complete Quest");
    await page.waitForFunction((questId) => {
      const state = window.__vibemmoTest.getState();
      return Array.isArray(state.questState && state.questState.active) &&
        !state.questState.active.some((entry) => String(entry && entry.questId || "") === questId);
    }, generatedQuest.questId);

    if (consoleErrors.length > 0) {
      throw new Error(`Browser console errors detected:\n${consoleErrors.join("\n")}`);
    }

    const finalState = await getState(page);
    console.log(JSON.stringify({
      ok: true,
      completedQuestIds: finalState.questState.completed,
      activeQuestCount: Array.isArray(finalState.questState.active) ? finalState.questState.active.length : 0,
      generatedQuestChoiceCount: questChoiceTexts.length,
      generatedQuestTitle: generatedQuest.title
    }, null, 2));
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
