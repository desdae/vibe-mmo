const path = require("path");
const { spawn, spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const buildScript = path.join(__dirname, "build-client-bundle.js");
const serverEntry = path.join(projectRoot, "server.js");

const buildResult = spawnSync(process.execPath, [buildScript], {
  stdio: "inherit"
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status || 1);
}

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    APP_MODE: "production"
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}
