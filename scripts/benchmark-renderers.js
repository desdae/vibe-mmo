const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT, ".tmp");
const SERVER_SCRIPT = path.join(ROOT, "server.js");
const PORT_BASE = 3140;
const SAMPLE_INTERVAL_MS = 500;
const TOTAL_SAMPLES = 28;
function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForServerReady(port, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const http = require("http");
    function tryOnce() {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`Timed out waiting for server on port ${port}`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    }
    tryOnce();
  });
}

function startServer(port, label) {
  ensureTmpDir();
  const outPath = path.join(TMP_DIR, `${label}.out`);
  const errPath = path.join(TMP_DIR, `${label}.err`);
  const out = fs.openSync(outPath, "w");
  const err = fs.openSync(errPath, "w");
  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", out, err],
    windowsHide: true
  });
  return { child, outPath, errPath };
}

async function stopServer(serverHandle) {
  if (!serverHandle || !serverHandle.child || serverHandle.child.killed) {
    return;
  }
  serverHandle.child.kill();
  await delay(1000);
  if (!serverHandle.child.killed) {
    serverHandle.child.kill("SIGKILL");
  }
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, ratio) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

async function runScenario(port, rendererMode) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon.ico")) {
      consoleErrors.push(msg.text());
    }
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/?renderer=${rendererMode}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.__vibemmoTest && typeof window.__vibemmoTest.connectAndJoin === "function");
    await page.evaluate(
      ({ rendererMode }) => {
        window.__vibemmoTest.connectAndJoin(`bench-${rendererMode}`, "mage", true);
      },
      { rendererMode }
    );
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return !!state.self && state.self.isAdmin === true;
    }, null, { timeout: 20000 });
    await page.evaluate((rendererMode) => window.__vibemmoTest.setRendererMode(rendererMode), rendererMode);
    await page.waitForFunction((rendererMode) => window.__vibemmoTest.getRendererMode() === rendererMode, rendererMode);

    await page.evaluate(() => window.__vibemmoTest.setMove(0, -1));
    await delay(4200);
    await page.evaluate(() => window.__vibemmoTest.stopMove());
    await delay(1200);
    await page.evaluate(() => window.__vibemmoTest.send({ type: "admin_spawn_benchmark_scene" }));
    await page.waitForFunction(() => {
      const state = window.__vibemmoTest.getState();
      return Array.isArray(state.mobs) && state.mobs.length >= 16 && Array.isArray(state.players) && state.players.length >= 6;
    }, null, { timeout: 12000 });
    await delay(1200);

    const samples = [];
    for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
      const snapshot = await page.evaluate(() => {
        const state = window.__vibemmoTest.getState();
        if (state.self) {
          window.__vibemmoTest.castAtWorld("fireball", Number(state.self.x) + 6, Number(state.self.y) - 6);
        }
        return {
          debugMetrics: state.debugMetrics || null,
          projectileCount: Array.isArray(state.projectiles) ? state.projectiles.length : 0,
          lootCount: Array.isArray(state.lootBags) ? state.lootBags.length : 0,
          playerCount: Array.isArray(state.players) ? state.players.length : 0,
          mobCountVisible: Array.isArray(state.mobs) ? state.mobs.length : 0
        };
      });
      samples.push(snapshot);
      await delay(SAMPLE_INTERVAL_MS);
    }

    const fpsSamples = samples.map((sample) => Number(sample.debugMetrics && sample.debugMetrics.fps) || 0);
    const downSamples = samples.map((sample) => Number(sample.debugMetrics && sample.debugMetrics.downKbps) || 0);
    const upSamples = samples.map((sample) => Number(sample.debugMetrics && sample.debugMetrics.upKbps) || 0);
    const projectileSamples = samples.map((sample) => Number(sample.projectileCount) || 0);
    const visibleMobSamples = samples.map((sample) => Number(sample.mobCountVisible) || 0);
    const totalMobSamples = samples.map((sample) => Number(sample.debugMetrics && sample.debugMetrics.mobCount) || 0);

    return {
      rendererMode,
      sampleCount: samples.length,
      avgFps: average(fpsSamples),
      p5Fps: percentile(fpsSamples, 0.05),
      avgDownKbps: average(downSamples),
      peakDownKbps: Math.max(...downSamples, 0),
      avgUpKbps: average(upSamples),
      avgProjectileCount: average(projectileSamples),
      peakProjectileCount: Math.max(...projectileSamples, 0),
      avgVisibleMobCount: average(visibleMobSamples),
      avgTotalMobCount: average(totalMobSamples),
      consoleErrors,
      pageErrors
    };
  } finally {
    await browser.close();
  }
}

async function runBenchmarkPass(rendererMode, port) {
  const serverLabel = `renderer-benchmark-${rendererMode}`;
  const serverHandle = startServer(port, serverLabel);
  try {
    await waitForServerReady(port);
    const result = await runScenario(port, rendererMode);
    result.serverLog = {
      out: path.relative(ROOT, serverHandle.outPath),
      err: path.relative(ROOT, serverHandle.errPath)
    };
    return result;
  } finally {
    await stopServer(serverHandle);
  }
}

function buildMarkdownReport(results) {
  const lines = [
    "# Renderer Benchmark",
    "",
    "| Renderer | Avg FPS | P5 FPS | Avg Down kbps | Peak Down kbps | Avg Up kbps | Avg Projectiles | Peak Projectiles | Avg Visible Mobs | Avg Total Mobs | Errors |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
  ];
  for (const result of results) {
    lines.push(
      `| ${result.rendererMode} | ${result.avgFps.toFixed(2)} | ${result.p5Fps.toFixed(2)} | ${result.avgDownKbps.toFixed(2)} | ${result.peakDownKbps.toFixed(2)} | ${result.avgUpKbps.toFixed(2)} | ${result.avgProjectileCount.toFixed(1)} | ${result.peakProjectileCount} | ${result.avgVisibleMobCount.toFixed(1)} | ${result.avgTotalMobCount.toFixed(1)} | ${result.consoleErrors.length + result.pageErrors.length} |`
    );
  }
  lines.push("");
  for (const result of results) {
    lines.push(`## ${result.rendererMode}`);
    lines.push("");
    lines.push(`- server log out: \`${result.serverLog.out}\``);
    lines.push(`- server log err: \`${result.serverLog.err}\``);
    lines.push(`- console errors: ${result.consoleErrors.length}`);
    lines.push(`- page errors: ${result.pageErrors.length}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  ensureTmpDir();
  const results = [];
  const renderers = ["canvas", "pixi"];
  for (let i = 0; i < renderers.length; i += 1) {
    const rendererMode = renderers[i];
    results.push(await runBenchmarkPass(rendererMode, PORT_BASE + i));
  }
  const output = {
    generatedAt: new Date().toISOString(),
    results
  };
  const jsonPath = path.join(TMP_DIR, "renderer-benchmark.json");
  const mdPath = path.join(TMP_DIR, "renderer-benchmark.md");
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  fs.writeFileSync(mdPath, buildMarkdownReport(results));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
