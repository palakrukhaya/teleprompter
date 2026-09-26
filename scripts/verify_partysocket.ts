import PartySocket from "partysocket";
import WS from "ws";

async function testPartySocket() {
  console.log("=== Testing PartySocket with Hono Backend ===");

  const roomKey = "TEST99";
  const host = "localhost:3001";

  console.log(`Connecting Prompter PartySocket to room: ${roomKey}...`);
  const prompterSocket = new PartySocket({
    host,
    party: "controls",
    room: roomKey,
    query: { role: "prompter" },
    WebSocket: WS as any,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Prompter connection timeout")), 5000);
    prompterSocket.addEventListener("open", () => {
      clearTimeout(timeout);
      console.log("✓ Prompter PartySocket connected!");
      resolve();
    });
  });

  console.log(`Connecting Remote PartySocket to room: ${roomKey}...`);
  const remoteSocket = new PartySocket({
    host,
    party: "controls",
    room: roomKey,
    query: { role: "remote" },
    WebSocket: WS as any,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Remote connection timeout")), 5000);
    remoteSocket.addEventListener("open", () => {
      clearTimeout(timeout);
      console.log("✓ Remote PartySocket connected!");
      resolve();
    });
  });

  const receivedActions: string[] = [];
  prompterSocket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "control") {
      receivedActions.push(data.action);
      console.log(`  [Prompter PartySocket Received] Action: ${data.action}`);
    }
  });

  console.log("Sending control actions from Remote PartySocket...");
  remoteSocket.send(JSON.stringify({ type: "control", action: "play" }));
  await new Promise((r) => setTimeout(r, 100));

  remoteSocket.send(JSON.stringify({ type: "control", action: "speedUp" }));
  await new Promise((r) => setTimeout(r, 100));

  remoteSocket.send(JSON.stringify({ type: "control", action: "pause" }));
  await new Promise((r) => setTimeout(r, 200));

  console.log("Received actions:", receivedActions);
  if (!receivedActions.includes("play") || !receivedActions.includes("pause")) {
    throw new Error("PartySocket messaging failed");
  }

  console.log("✓ PartySocket bidirectional messaging verified!");
  prompterSocket.close();
  remoteSocket.close();

  console.log("=== PartySocket Verification PASSED Successfully! ===");
  process.exit(0);
}

testPartySocket().catch((err) => {
  console.error("PartySocket test error:", err);
  process.exit(1);
});
