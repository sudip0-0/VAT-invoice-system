const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..");
const requestedPort = Number(process.env.VITE_DEV_PORT || "8080");
let port = requestedPort;
let rendererUrl = process.env.ELECTRON_RENDERER_URL || `http://127.0.0.1:${port}`;
const npmCommand = process.platform === "win32" ? "npm" : "npm";

let shuttingDown = false;
let renderer = null;
let electron = null;
let rendererReadyResolve = null;
let rendererReadyReject = null;
const rendererReady = new Promise((resolve, reject) => {
  rendererReadyResolve = resolve;
  rendererReadyReject = reject;
});

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (electron && !electron.killed) {
    electron.kill();
  }

  if (renderer && !renderer.killed) {
    renderer.kill();
  }

  process.exit(exitCode);
}

function startRenderer() {
  console.log(`[desktop-dev] Starting Vite on ${rendererUrl}`);

  renderer = spawn(
    `${npmCommand} run dev:renderer -- --host 127.0.0.1 --port ${port} --strictPort`,
    {
      cwd: projectRoot,
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    }
  );

  const handleStdout = (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);

    if (
      text.includes("ready in") ||
      text.includes("Local:") ||
      text.includes(`http://127.0.0.1:${port}`) ||
      text.includes(`http://localhost:${port}`)
    ) {
      rendererReadyResolve();
    }
  };

  const handleStderr = (chunk) => {
    process.stderr.write(chunk.toString());
  };

  renderer.stdout.on("data", handleStdout);
  renderer.stderr.on("data", handleStderr);

  renderer.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    rendererReadyReject(new Error(`Vite exited before Electron could start (code ${code ?? 1})`));

    if (code !== 0) {
      console.error(
        `[desktop-dev] Vite failed to start on port ${port}. If another app is using that port, close it and try again.`
      );
    }

    shutdown(code ?? 1);
  });
}

function isPortAvailable(candidatePort) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(candidatePort, "127.0.0.1");
  });
}

async function choosePort(startPort) {
  for (let candidate = startPort; candidate < startPort + 50; candidate += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find an open port starting from ${startPort}`);
}

function startElectron() {
  console.log(`[desktop-dev] Launching Electron against ${rendererUrl}`);

  electron = spawn(`${npmCommand} exec electron .`, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
    },
  });

  electron.on("exit", (code) => {
    shutdown(code ?? 0);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

(async () => {
  try {
    port = await choosePort(requestedPort);
    rendererUrl = process.env.ELECTRON_RENDERER_URL || `http://127.0.0.1:${port}`;
    if (port !== requestedPort) {
      console.log(`[desktop-dev] Port ${requestedPort} is busy, using ${port} instead.`);
    }
    startRenderer();
    await rendererReady;
    startElectron();
  } catch (error) {
    console.error(`[desktop-dev] Failed to start Electron dev mode: ${error.message}`);
    shutdown(1);
  }
})();
