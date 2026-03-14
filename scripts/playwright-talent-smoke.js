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

    await page.goto(SERVER_URL, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__vibemmoTest && document.querySelector("#classType option[value]"));
    await page.fill("#name", "pw-talents");
    await page.selectOption("#classType", "warrior");
    await page.check("#isAdmin");
    await page.click("#join-form button[type='submit']");
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest && window.__vibemmoTest.getState();
      return !!(state && state.self);
    });

    // Grant enough talent points to unlock and max Charge Mastery (requires Juggernaut rank 3).
    await page.evaluate(() => window.__vibemmoTest.send({ type: "admin_set_level", level: 9 }));
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest && window.__vibemmoTest.getState();
      return !!(state && state.self && state.self.level >= 9);
    });

    // Spend talents: Juggernaut x3, Charge Mastery x5.
    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => window.__vibemmoTest.send({ type: "spend_talent_point", talentId: "juggernaut" }));
      await sleep(80);
    }
    for (let i = 0; i < 5; i += 1) {
      await page.evaluate(() => window.__vibemmoTest.send({ type: "spend_talent_point", talentId: "charge_mastery" }));
      await sleep(80);
    }

    // Tooltips should reflect the modified cooldown and range.
    await page.waitForFunction(() => {
      const tooltip = String(window.buildAbilityTooltip && window.buildAbilityTooltip("charge") || "");
      return tooltip.includes("Cooldown: 5.5s") && tooltip.includes("Range: 8.50");
    });
    const chargeTooltip = await page.evaluate(() => String(window.buildAbilityTooltip && window.buildAbilityTooltip("charge") || ""));
    if (!chargeTooltip.includes("Cooldown: 5.5s")) {
      throw new Error(`Expected Charge tooltip cooldown to be reduced (got: ${chargeTooltip})`);
    }
    if (!chargeTooltip.includes("Range: 8.50")) {
      throw new Error(`Expected Charge tooltip range to be increased (got: ${chargeTooltip})`);
    }

    // Gameplay should reflect the increased Charge range.
    const firstStart = await page.evaluate(() => {
      const state = window.__vibemmoTest.getState();
      return { x: Number(state.self.x) || 0, y: Number(state.self.y) || 0 };
    });
    await page.evaluate(() => {
      const state = window.__vibemmoTest.getState();
      window.__vibemmoTest.castAtWorld("charge", state.self.x + 100, state.self.y);
    });
    await sleep(1000);
    const firstEnd = await page.evaluate(() => {
      const state = window.__vibemmoTest.getState();
      return { x: Number(state.self.x) || 0, y: Number(state.self.y) || 0 };
    });
    const firstDistance = Math.hypot(firstEnd.x - firstStart.x, firstEnd.y - firstStart.y);
    if (Math.abs(firstDistance - 8.5) > 0.35) {
      throw new Error(`Expected Charge to travel ~8.5 units, traveled ${firstDistance.toFixed(2)}.`);
    }

    // Cooldown should allow another Charge after ~5.5s (base is 8s).
    await sleep(6100);
    const secondStart = firstEnd;
    await page.evaluate(() => {
      const state = window.__vibemmoTest.getState();
      window.__vibemmoTest.castAtWorld("charge", state.self.x + 100, state.self.y);
    });
    await sleep(1000);
    const secondEnd = await page.evaluate(() => {
      const state = window.__vibemmoTest.getState();
      return { x: Number(state.self.x) || 0, y: Number(state.self.y) || 0 };
    });
    const secondDistance = Math.hypot(secondEnd.x - secondStart.x, secondEnd.y - secondStart.y);
    if (Math.abs(secondDistance - 8.5) > 0.35) {
      throw new Error(`Expected second Charge to travel ~8.5 units, traveled ${secondDistance.toFixed(2)}.`);
    }

    await page.keyboard.press("KeyT");
    await sleep(200);
    await page.waitForFunction(() => {
      const panel = document.getElementById("talent-panel");
      return !!(panel && !panel.classList.contains("hidden"));
    });

    const treeHtml = await page.$eval("#talent-tree-container", (el) => String(el.innerHTML || ""));
    if (treeHtml.includes("No talent tree available")) {
      throw new Error("Talent tree container rendered the fallback message.");
    }
    const talentNodeCount = await page.locator(".talent-node").count();
    if (talentNodeCount <= 0) {
      throw new Error("Expected at least one .talent-node, got 0.");
    }

    if (consoleErrors.length) {
      throw new Error(`Browser console errors detected:\n${consoleErrors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          talentNodeCount
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
