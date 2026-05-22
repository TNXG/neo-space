import { spawn } from "node:child_process";

const shutdownSignals = ["SIGINT", "SIGTERM"];
let isShuttingDown = false;

const turboProcess = spawn(
  "pnpm",
  ["turbo", "run", "dev", "--concurrency=20"],
  {
    detached: true,
    stdio: "inherit",
  },
);

function stopTurboProcess(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (turboProcess.pid) {
    try {
      process.kill(-turboProcess.pid, signal);
    }
    catch (error) {
      if (error.code !== "ESRCH") {
        throw error;
      }
    }
  }

  const forceKillTimer = setTimeout(() => {
    if (turboProcess.pid) {
      try {
        process.kill(-turboProcess.pid, "SIGKILL");
      }
      catch (error) {
        if (error.code !== "ESRCH") {
          throw error;
        }
      }
    }
  }, 5_000);

  forceKillTimer.unref();
}

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    stopTurboProcess(signal);
  });
}

turboProcess.on("exit", (code, signal) => {
  if (!isShuttingDown) {
    process.exitCode = code ?? (signal ? 1 : 0);
  }
});

turboProcess.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
