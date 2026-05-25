import { spawn } from "node:child_process";
import { request } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.resolve(frontendRoot, "..", "backend");

const parsedBackendPort = Number.parseInt(
  process.env.VITE_DEV_BACKEND_PORT || process.env.BACKEND_PORT || "5001",
  10
);
const backendPort = Number.isNaN(parsedBackendPort) ? 5001 : parsedBackendPort;
const backendHost = process.env.VITE_DEV_BACKEND_HOST || "127.0.0.1";
const backendHealthPath = process.env.VITE_DEV_BACKEND_HEALTH_PATH || "/api/health";
const healthTimeoutMs = 2500;
const waitTimeoutMs = Number.parseInt(process.env.BACKEND_WAIT_TIMEOUT_MS || "45000", 10);
const pollIntervalMs = 1500;

let backendChild = null;
let frontendChild = null;
let startedBackendFromThisScript = false;
let shuttingDown = false;

const log = (message) => {
  console.log(`[dev] ${message}`);
};

const pingBackend = () =>
  new Promise((resolve) => {
    const req = request(
      {
        hostname: backendHost,
        port: backendPort,
        path: backendHealthPath,
        method: "GET",
        timeout: healthTimeoutMs,
      },
      (res) => {
        // Server is considered "up" even if health returns 5xx.
        res.resume();
        resolve(typeof res.statusCode === "number" && res.statusCode < 600);
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => resolve(false));
    req.end();
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForBackendReady = async (timeoutMs) => {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const isUp = await pingBackend();
    if (isUp) {
      return true;
    }

    attempt += 1;
    if (attempt % 4 === 0) {
      log(`Waiting for backend on http://${backendHost}:${backendPort}${backendHealthPath}...`);
    }
    await sleep(pollIntervalMs);
  }

  return false;
};

const killChildTree = (child, label) =>
  new Promise((resolve) => {
    if (!child || child.killed || child.exitCode !== null) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
      return;
    }

    child.kill("SIGTERM");
    resolve();
  });

const spawnNpmScript = (cwd, scriptName) => {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm run ${scriptName}`], {
      cwd,
      stdio: "inherit",
      shell: false,
    });
  }

  return spawn("npm", ["run", scriptName], {
    cwd,
    stdio: "inherit",
    shell: false,
  });
};

const shutdown = async (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.all([
    killChildTree(frontendChild, "frontend"),
    startedBackendFromThisScript ? killChildTree(backendChild, "backend") : Promise.resolve(),
  ]);

  process.exit(code);
};

const startFrontend = () => {
  log("Starting Vite dev server...");
  frontendChild = spawnNpmScript(frontendRoot, "dev:frontend");

  frontendChild.on("exit", async (code) => {
    await shutdown(code ?? 0);
  });
};

const ensureBackend = async () => {
  const alreadyUp = await pingBackend();
  if (alreadyUp) {
    log(`Backend already running on http://${backendHost}:${backendPort}`);
    return true;
  }

  const backendPkgPath = path.join(backendRoot, "package.json");
  if (!fs.existsSync(backendPkgPath)) {
    log(`Backend folder not found at ${backendRoot}`);
    return false;
  }

  log("Backend is not reachable. Starting backend with `npm run dev:5001`...");
  startedBackendFromThisScript = true;
  backendChild = spawnNpmScript(backendRoot, "dev:5001");

  backendChild.on("exit", async (code) => {
    if (!shuttingDown && code !== 0) {
      log(`Backend process exited early with code ${code}`);
      await shutdown(code ?? 1);
    }
  });

  const ready = await waitForBackendReady(waitTimeoutMs);
  if (!ready) {
    log(
      `Backend did not become reachable within ${waitTimeoutMs}ms at http://${backendHost}:${backendPort}${backendHealthPath}`
    );
    return false;
  }

  log("Backend is ready.");
  return true;
};

process.on("SIGINT", async () => {
  await shutdown(0);
});

process.on("SIGTERM", async () => {
  await shutdown(0);
});

const run = async () => {
  const backendReady = await ensureBackend();
  if (!backendReady) {
    await shutdown(1);
    return;
  }

  startFrontend();
};

run().catch(async (error) => {
  log(`Startup failed: ${error?.message || "unknown error"}`);
  await shutdown(1);
});
