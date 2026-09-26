import { spawn } from "node:child_process";

const mainPort = process.env.PORT || "3000";
const internalNextPort = process.env.NEXT_PORT || "3002";

console.log("==================================================");
console.log("🚀 Starting Teleprompter Pro Production Server");
console.log(`📡 Public Gateway (Hono + WebSockets): port ${mainPort}`);
console.log(`💻 Internal Frontend (Next.js): port ${internalNextPort}`);
console.log("==================================================");

// 1. Start Next.js on internal port
const nextProcess = spawn("npx", ["next", "start", "-p", internalNextPort], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PORT: internalNextPort,
  },
});

// 2. Start Hono on the public port (Render's PORT)
const serverProcess = spawn("npx", ["tsx", "server/index.ts"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PORT: mainPort,
    NEXT_PORT: internalNextPort,
  },
});

function shutdown() {
  console.log("\n[Shutdown] Terminating processes gracefully...");
  try {
    nextProcess.kill("SIGTERM");
  } catch {}
  try {
    serverProcess.kill("SIGTERM");
  } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

nextProcess.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`Next.js process exited with code ${code}`);
    shutdown();
  }
});

serverProcess.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`Hono backend process exited with code ${code}`);
    shutdown();
  }
});
