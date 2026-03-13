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
    await page.selectOption("#classType", "mage");
    await page.click("#join-form button[type='submit']");
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest && window.__vibemmoTest.getState();
      return !!(state && state.self);
    });

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

