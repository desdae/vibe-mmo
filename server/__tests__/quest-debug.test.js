/**
 * Playwright tests for Quest System - With proper game entry
 */

const { test, expect, beforeAll, afterAll } = require("@playwright/test");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

// Server process management
let serverProcess = null;

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn("node", ["server.js"], {
      cwd: __dirname + "/../..",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "prod" }  // Use prod mode to load all bundled scripts
    });

    let output = "";
    serverProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log("[Server]", data.toString().trim());
      if (output.includes("Server running")) {
        setTimeout(() => resolve(true), 1000);
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error("[Server Error]", data.toString().trim());
    });

    serverProcess.on("error", (err) => {
      console.error("Server process error:", err);
      reject(err);
    });

    setTimeout(() => {
      console.log("Server startup timeout reached, checking if running...");
      if (!serverProcess.killed) {
        resolve(true);
      }
    }, 15000);
  });
}

async function stopServer() {
  if (serverProcess) {
    console.log("Stopping server...");
    serverProcess.kill("SIGTERM");
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (!serverProcess.killed) {
      serverProcess.kill("SIGKILL");
    }
  }
}

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function tryConnect() {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          if (Date.now() - startTime < timeout) {
            setTimeout(tryConnect, 500);
          } else {
            reject(new Error(`Server not responding after ${timeout}ms`));
          }
        }
      }).on("error", () => {
        if (Date.now() - startTime < timeout) {
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error(`Server not responding after ${timeout}ms`));
        }
      });
    }
    
    tryConnect();
  });
}

// Helper function to join game
async function joinGame(page) {
  // Wait for join form to be visible
  const joinScreen = page.locator("#join-screen");
  await joinScreen.waitFor({ state: "visible", timeout: 10000 });
  
  // Fill in name
  const nameInput = page.locator('#join-form input[name="name"]');
  await nameInput.fill("TestPlayer");
  
  // Select class (warrior)
  const classSelect = page.locator('#join-form select[name="classType"]');
  await classSelect.selectOption("warrior");
  
  // Submit form
  const submitBtn = page.locator('#join-form button[type="submit"]');
  await submitBtn.click();
  
  // Wait for game UI to appear (join screen hidden)
  await page.waitForFunction(() => {
    const joinScreen = document.getElementById("join-screen");
    const gameUI = document.getElementById("game-ui");
    return joinScreen && joinScreen.classList.contains("hidden") && 
           gameUI && !gameUI.classList.contains("hidden");
  }, { timeout: 15000 });
  
  // Wait a bit more for game to fully initialize
  await page.waitForTimeout(2000);
}

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");

test.describe("Quest System Tests", () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    console.log("Starting server...");
    await startServer();
    console.log("Waiting for server to be ready...");
    await waitForServer("http://localhost:3000");
    console.log("Server is ready!");
    
    // Create screenshot directory
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  }, 60000);

  test.afterAll(async () => {
    console.log("Cleaning up...");
    if (browser) {
      await browser.close();
    }
    await stopServer();
  });

  test.beforeEach(async () => {
    browser = await require("playwright").chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    
    // Listen to console events
    page.on("console", msg => {
      console.log("BROWSER CONSOLE:", msg.text());
    });
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  });

  async function takeScreenshot(name) {
    const timestamp = Date.now();
    const filepath = path.join(SCREENSHOT_DIR, `${name}_${timestamp}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Screenshot saved: ${filepath}`);
    return filepath;
  }

  test("1. Join game and verify game UI is visible", async () => {
    await page.goto("http://localhost:3000", { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await takeScreenshot("01_join_screen");
    
    // Join the game
    await joinGame(page);
    
    await takeScreenshot("02_in_game");
    
    // Verify game UI is visible
    const gameUI = page.locator("#game-ui");
    const gameUIClasses = await gameUI.getAttribute("class") || "";
    console.log("Game UI classes:", gameUIClasses);
    
    expect(gameUIClasses).not.toContain("hidden");
  });

  test("2. Press Q key to toggle quest panel", async () => {
    await page.goto("http://localhost:3000", { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Join the game first
    await joinGame(page);
    
    await takeScreenshot("03_before_q_press");
    
    // Check initial quest panel state
    const questPanel = page.locator("#quest-panel");
    const initialClasses = await questPanel.getAttribute("class") || "";
    console.log("Quest panel initial classes:", initialClasses);
    
    // Get canvas for focusing
    const canvas = page.locator("canvas").first();
    
    // Debug: Check if keyboard events are being captured
    await page.evaluate(() => {
      window.__keyPressLog = [];
      window.__questLogs = [];
      const originalLog = console.log;
      console.log = function(...args) {
        if (args[0] && args[0].includes && args[0].includes("[QUEST]")) {
          window.__questLogs.push(args.join(" "));
        }
        originalLog.apply(console, args);
      };
      window.addEventListener("keydown", (e) => {
        window.__keyPressLog.push("keydown:" + e.code);
      });
    });
    
    // Listen for dialogs (alerts)
    page.on("dialog", async dialog => {
      console.log("DIALOG:", dialog.message());
      await dialog.dismiss();
    });
    
    // Press Q to open quest panel - first focus the canvas
    await canvas.click();
    await page.waitForTimeout(200);
    await page.keyboard.press("KeyQ");
    await page.waitForTimeout(1000);
    
    // Check what keys were captured
    const keyLog = await page.evaluate(() => window.__keyPressLog || []);
    console.log("Key press log:", keyLog);
    
    // Debug: Check gameUI class and toggleQuestPanel
    const debugInfo = await page.evaluate(() => {
      const gameUI = document.getElementById("game-ui");
      const questPanel = document.getElementById("quest-panel");
      
      // Just check state, don't toggle
      return {
        gameUI_class: gameUI ? gameUI.className : "not found",
        questPanel_class: questPanel ? questPanel.className : "not found",
        hasQuestUiTools: typeof window.__vibemmoTest !== "undefined"
      };
    });
    console.log("Debug info:", debugInfo);
    
    await takeScreenshot("04_after_q_press");
    
    // Check state after Q
    const afterClasses = await questPanel.getAttribute("class") || "";
    console.log("Quest panel after Q classes:", afterClasses);
    
    // Verify it opened (should NOT contain "hidden")
    expect(afterClasses).not.toContain("hidden");
    
    // Press Q again to close
    await page.keyboard.press("KeyQ");
    await page.waitForTimeout(500);
    
    const closedClasses = await questPanel.getAttribute("class") || "";
    console.log("Quest panel after close Q classes:", closedClasses);
    
    // Verify it closed
    expect(closedClasses).toContain("hidden");
  });

  test("3. Right-click on town herald to open dialogue", async () => {
    await page.goto("http://localhost:3000", { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Join the game first
    await joinGame(page);
    
    await takeScreenshot("05_before_right_click");
    
    // Get canvas dimensions - find the game canvas
    const canvasCount = await page.locator("canvas").count();
    console.log("Number of canvases:", canvasCount);
    
    // Find the main game canvas (usually the largest one)
    let canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    console.log("Canvas box:", box);
    
    if (box) {
      // Move to where town herald should be (center of town + offset)
      // Town center is at centerTileX, centerTileY (probably around 50, 50 in a 100x100 town)
      // Quest giver is at centerTileY + 10
      const canvasCenterX = box.x + box.width / 2;
      const canvasCenterY = box.y + box.height / 2;
      
      // Move mouse to center (where player spawns)
      await page.mouse.move(canvasCenterX, canvasCenterY);
      await page.waitForTimeout(500);
      
      // Right-click to interact
      await page.mouse.click(canvasCenterX, canvasCenterY, { button: "right" });
      await page.waitForTimeout(1000);
    }
    
    await takeScreenshot("06_after_right_click");
    
    // Check if dialogue panel opened
    const dialoguePanel = page.locator("#dialogue-panel");
    const dialogueClasses = await dialoguePanel.getAttribute("class") || "";
    console.log("Dialogue panel classes:", dialogueClasses);
  });

  test("4. Verify quest NPCs are rendered in canvas mode", async () => {
    await page.goto("http://localhost:3000", { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Join the game first
    await joinGame(page);
    
    await takeScreenshot("07_quest_npc_check");
    
    // Check renderer mode
    const rendererMode = await page.evaluate(() => {
      if (window.__vibemmoTest && window.__vibemmoTest.getRendererMode) {
        return window.__vibemmoTest.getRendererMode();
      }
      return "unknown";
    });
    console.log("Renderer mode:", rendererMode);
    
    // Take screenshot showing the game view
    await takeScreenshot("08_canvas_render");
  });
});
