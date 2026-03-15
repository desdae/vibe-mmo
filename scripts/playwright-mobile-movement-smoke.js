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
  await page.fill("#name", "pw-mobile-move");
  await page.selectOption("#classType", "mage");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.self);
  });
}

async function getState(page) {
  return page.evaluate(() => window.__vibemmoTest.getState());
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

    const touchSetup = await page.evaluate(() => {
      const canvas = document.getElementById("game");
      if (!canvas) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
      return {
        tapPoint: {
          clientX: rect.left + rect.width * 0.78,
          clientY: rect.top + rect.height * 0.34,
          expectedSx: rect.width * 0.78 * scaleX,
          expectedSy: rect.height * 0.34 * scaleY
        },
        joystickPoint: {
          clientX: rect.left + rect.width * 0.2,
          clientY: rect.top + rect.height * 0.82
        }
      };
    });
    if (!touchSetup || !touchSetup.tapPoint || !touchSetup.joystickPoint) {
      throw new Error("Failed to resolve mobile touch test points.");
    }

    const touchPoint = touchSetup.tapPoint;
    const joystickPoint = touchSetup.joystickPoint;

    await page.evaluate((point) => {
      window.__vibemmoTest.dispatchTouchEventAtClient("touchstart", point.clientX, point.clientY, 11);
    }, touchPoint);

    const tapState = await getState(page);
    if (!tapState || !tapState.mouse) {
      throw new Error(`Missing mouse state after touch start. State=${JSON.stringify(tapState)}`);
    }
    const tapDx = Math.abs(Number(tapState.mouse.sx) - Number(touchPoint.expectedSx));
    const tapDy = Math.abs(Number(tapState.mouse.sy) - Number(touchPoint.expectedSy));
    if (tapDx > 6 || tapDy > 6) {
      throw new Error(
        `Expected non-joystick touch to update mobile cursor. Expected≈${JSON.stringify({ sx: touchPoint.expectedSx, sy: touchPoint.expectedSy })} Actual=${JSON.stringify(tapState.mouse)}`
      );
    }

    await page.evaluate((point) => {
      window.__vibemmoTest.dispatchTouchEventAtClient("touchcancel", point.clientX, point.clientY, 11);
    }, touchPoint);

    await page.evaluate((point) => {
      window.__vibemmoTest.dispatchTouchEventAtClient("touchstart", point.clientX, point.clientY, 22);
    }, joystickPoint);
    const joystickState = await getState(page);
    await page.evaluate((point) => {
      window.__vibemmoTest.dispatchTouchEventAtClient("touchcancel", point.clientX, point.clientY, 22);
    }, joystickPoint);

    const mouseDx = Math.abs(Number(joystickState.mouse.sx) - Number(tapState.mouse.sx));
    const mouseDy = Math.abs(Number(joystickState.mouse.sy) - Number(tapState.mouse.sy));
    if (mouseDx > 2 || mouseDy > 2) {
      throw new Error(
        `Expected joystick touch to preserve mobile cursor target. Before=${JSON.stringify(tapState.mouse)} After=${JSON.stringify(joystickState.mouse)}`
      );
    }

    console.log(JSON.stringify({
      ok: true,
      touchMouse: tapState.mouse,
      joystickMouse: joystickState.mouse
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
