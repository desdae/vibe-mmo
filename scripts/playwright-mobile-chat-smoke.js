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
  await page.fill("#name", "pw-mobile-chat");
  await page.selectOption("#classType", "mage");
  await page.click("#join-form button[type='submit']");
  await page.waitForFunction(() => {
    const state = window.__vibemmoTest.getState();
    return !!(state && state.self);
  });
}

async function getLayoutSnapshot(page) {
  return page.evaluate(() => {
    const chatPanel = document.getElementById("chat-panel");
    const actionUi = document.getElementById("action-ui");
    const chatToggleLabel = document.getElementById("chat-toggle-label");
    const unreadBadge = document.getElementById("chat-unread-badge");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");
    if (!chatPanel || !actionUi) {
      return null;
    }
    const chatRect = chatPanel.getBoundingClientRect();
    const actionRect = actionUi.getBoundingClientRect();
    const style = window.getComputedStyle(chatPanel);
    return {
      mobileCollapsed: chatPanel.classList.contains("mobile-collapsed"),
      chatTop: Math.round(chatRect.top),
      chatBottom: Math.round(chatRect.bottom),
      chatHeight: Math.round(chatRect.height),
      chatWidth: Math.round(chatRect.width),
      actionTop: Math.round(actionRect.top),
      actionBottom: Math.round(actionRect.bottom),
      overlapPx: Math.max(0, Math.round(chatRect.bottom - actionRect.top)),
      toggleLabel: chatToggleLabel ? String(chatToggleLabel.textContent || "") : "",
      unreadBadgeVisible: !!(unreadBadge && !unreadBadge.classList.contains("hidden")),
      inputVisible: !!(chatInput && chatInput.offsetParent),
      messagesVisible: !!(chatMessages && chatMessages.offsetParent),
      bottomCss: style.bottom
    };
  });
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

    await page.waitForFunction(() => {
      const panel = document.getElementById("chat-panel");
      return !!(panel && panel.classList.contains("mobile-collapsed"));
    });

    const collapsed = await getLayoutSnapshot(page);
    if (!collapsed) {
      throw new Error("Failed to capture collapsed mobile chat layout.");
    }
    if (!collapsed.mobileCollapsed) {
      throw new Error(`Expected chat to start collapsed on mobile. Snapshot=${JSON.stringify(collapsed)}`);
    }
    if (collapsed.overlapPx > 0) {
      throw new Error(`Collapsed chat overlaps action UI by ${collapsed.overlapPx}px. Snapshot=${JSON.stringify(collapsed)}`);
    }

    await page.click("#chat-toggle");
    await page.waitForFunction(() => {
      const panel = document.getElementById("chat-panel");
      return !!(panel && !panel.classList.contains("mobile-collapsed"));
    });

    const expanded = await getLayoutSnapshot(page);
    if (!expanded) {
      throw new Error("Failed to capture expanded mobile chat layout.");
    }
    if (expanded.mobileCollapsed) {
      throw new Error(`Expected chat to expand on toggle. Snapshot=${JSON.stringify(expanded)}`);
    }
    if (expanded.overlapPx > 0) {
      throw new Error(`Expanded chat overlaps action UI by ${expanded.overlapPx}px. Snapshot=${JSON.stringify(expanded)}`);
    }
    if (!expanded.inputVisible || !expanded.messagesVisible) {
      throw new Error(`Expanded chat should show messages and input. Snapshot=${JSON.stringify(expanded)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      collapsed,
      expanded
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
