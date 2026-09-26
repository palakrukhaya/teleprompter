import WebSocket from "ws";

async function main() {
  console.log("=== Starting End-to-End WebSocket & API Verification ===");

  const baseUrl = "http://localhost:3001";
  const wsBaseUrl = "ws://localhost:3001";

  // 1. Check Health
  console.log("\n1. Testing Backend Health Endpoint...");
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthData = await healthRes.json();
  if (healthData.status !== "ok") {
    throw new Error("Health check failed: " + JSON.stringify(healthData));
  }
  console.log("✓ Health endpoint OK:", healthData);

  // 2. Fetch Scripts
  console.log("\n2. Testing Scripts Retrieval...");
  const scriptsRes = await fetch(`${baseUrl}/api/scripts`);
  const scriptsData = await scriptsRes.json();
  if (!Array.isArray(scriptsData.scripts) || scriptsData.scripts.length === 0) {
    throw new Error("No scripts retrieved or invalid format");
  }
  const sampleScript = scriptsData.scripts[0];
  console.log(`✓ Retrieved ${scriptsData.scripts.length} scripts. Using: "${sampleScript.title}"`);

  // 3. Start a Prompter Session
  console.log("\n3. Starting Prompter Session...");
  const sessionRes = await fetch(`${baseUrl}/api/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scriptId: sampleScript.id }),
  });
  const sessionData = await sessionRes.json();
  const roomKey = sessionData.session?.room_key;
  if (!roomKey) {
    throw new Error("Failed to generate room key: " + JSON.stringify(sessionData));
  }
  console.log(`✓ Session started with Room Key: ${roomKey}`);

  // 4. Connect Prompter WebSocket Client
  console.log("\n4. Connecting Prompter WebSocket Client...");
  const prompterWs = new WebSocket(`${wsBaseUrl}/ws/${roomKey}?role=prompter`);

  await new Promise<void>((resolve, reject) => {
    prompterWs.on("open", () => {
      console.log("✓ Prompter WebSocket connected successfully.");
      resolve();
    });
    prompterWs.on("error", reject);
  });

  // 5. Connect Remote WebSocket Client
  console.log("\n5. Connecting Remote WebSocket Client...");
  const remoteWs = new WebSocket(`${wsBaseUrl}/ws/${roomKey}?role=remote`);

  await new Promise<void>((resolve, reject) => {
    remoteWs.on("open", () => {
      console.log("✓ Remote WebSocket connected successfully.");
      resolve();
    });
    remoteWs.on("error", reject);
  });

  // Track received commands on Prompter
  const receivedOnPrompter: string[] = [];
  prompterWs.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "control") {
      receivedOnPrompter.push(msg.action);
      console.log(`  [Prompter Received Control] action: ${msg.action}, speed: ${msg.state?.scrollSpeed}`);
    }
  });

  // 6. Test Control Commands from Remote
  console.log("\n6. Sending Remote Control Commands...");
  const sendRemoteAction = (action: string, payload?: any) => {
    remoteWs.send(JSON.stringify({ type: "control", action, payload }));
  };

  sendRemoteAction("play");
  await new Promise((r) => setTimeout(r, 100));

  sendRemoteAction("speedUp");
  await new Promise((r) => setTimeout(r, 100));

  sendRemoteAction("up");
  await new Promise((r) => setTimeout(r, 100));

  sendRemoteAction("pause");
  await new Promise((r) => setTimeout(r, 100));

  sendRemoteAction("reset");
  await new Promise((r) => setTimeout(r, 200));

  console.log("\nCommands received by Prompter:", receivedOnPrompter);
  const expected = ["play", "speedUp", "up", "pause", "reset"];
  const allReceived = expected.every((cmd) => receivedOnPrompter.includes(cmd));
  if (!allReceived) {
    throw new Error(`Expected commands ${expected.join(", ")} but received ${receivedOnPrompter.join(", ")}`);
  }
  console.log("✓ All remote control commands dispatched and received synchronously!");

  // 7. Cleanup
  console.log("\n7. Closing WebSockets and Ending Session...");
  prompterWs.close();
  remoteWs.close();

  const endRes = await fetch(`${baseUrl}/api/sessions/${roomKey}/end`, { method: "POST" });
  console.log("✓ Session ended via API:", (await endRes.json()).success);

  console.log("\n=============================================");
  console.log("🎉 ALL E2E VERIFICATION CHECKS PASSED!");
  console.log("=============================================\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
