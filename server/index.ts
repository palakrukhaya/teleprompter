import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { scriptRepo, sessionRepo } from "./db";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Enable CORS for all routes
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Room State Definition
export interface RoomState {
  isPlaying: boolean;
  scrollSpeed: number; // 1 to 10
  fontSize: number; // 24 to 96
  lineSpacing: number; // 1.2 to 2.5
  progress: number; // 0 to 100
  currentLine: number;
  textColor: string;
  bgColor: string;
  mirrored: boolean;
}

export type ControlAction =
  | "play"
  | "pause"
  | "togglePlay"
  | "up"
  | "down"
  | "speedUp"
  | "speedDown"
  | "setSpeed"
  | "fontSizeUp"
  | "fontSizeDown"
  | "setFontSize"
  | "reset"
  | "toggleMirror"
  | "endSession";

interface ClientConnection {
  id: string;
  role: "prompter" | "remote";
  ws: any;
}

interface Room {
  roomKey: string;
  clients: Set<ClientConnection>;
  state: RoomState;
}

const defaultRoomState: RoomState = {
  isPlaying: false,
  scrollSpeed: 2,
  fontSize: 48,
  lineSpacing: 1.6,
  progress: 0,
  currentLine: 0,
  textColor: "#FFFFFF",
  bgColor: "#000000",
  mirrored: false,
};

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomKey: string): Room {
  const normalizedKey = roomKey.toUpperCase();
  let room = rooms.get(normalizedKey);
  if (!room) {
    room = {
      roomKey: normalizedKey,
      clients: new Set(),
      state: { ...defaultRoomState },
    };
    rooms.set(normalizedKey, room);
  }
  return room;
}

function broadcastToRoom(room: Room, message: any, excludeClientId?: string) {
  const payload = typeof message === "string" ? message : JSON.stringify(message);
  for (const client of room.clients) {
    if (excludeClientId && client.id === excludeClientId) continue;
    try {
      client.ws.send(payload);
    } catch (err) {
      console.error(`Failed to send message to client ${client.id}:`, err);
    }
  }
}

function sendPeerUpdate(room: Room) {
  const prompterCount = [...room.clients].filter((c) => c.role === "prompter").length;
  const remoteCount = [...room.clients].filter((c) => c.role === "remote").length;
  broadcastToRoom(room, {
    type: "peerUpdate",
    peerCount: room.clients.size,
    hasPrompter: prompterCount > 0,
    remoteCount,
  });
}

// REST Endpoints
app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// Scripts Endpoints
app.get("/api/scripts", (c) => {
  const scripts = scriptRepo.getAll();
  return c.json({ scripts });
});

app.get("/api/scripts/:id", (c) => {
  const id = c.req.param("id");
  const script = scriptRepo.getById(id);
  if (!script) {
    return c.json({ error: "Script not found" }, 404);
  }
  return c.json({ script });
});

app.post("/api/scripts", async (c) => {
  try {
    const body = await c.req.json();
    const { title, content } = body;
    if (!content && typeof content !== "string") {
      return c.json({ error: "Content is required" }, 400);
    }
    const script = scriptRepo.create(title || "Untitled Script", content);
    return c.json({ script }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.put("/api/scripts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { title, content } = body;
    const script = scriptRepo.update(id, title ?? "Untitled Script", content ?? "");
    if (!script) {
      return c.json({ error: "Script not found" }, 404);
    }
    return c.json({ script });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete("/api/scripts/:id", (c) => {
  const id = c.req.param("id");
  const deleted = scriptRepo.delete(id);
  if (!deleted) {
    return c.json({ error: "Script not found" }, 404);
  }
  return c.json({ success: true });
});

// Session Endpoints
app.post("/api/sessions/start", async (c) => {
  try {
    const body = await c.req.json();
    const { scriptId } = body;
    if (!scriptId) {
      return c.json({ error: "scriptId is required" }, 400);
    }
    const session = sessionRepo.create(scriptId);
    return c.json({ session });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/sessions/:roomKey", (c) => {
  const roomKey = c.req.param("roomKey");
  const session = sessionRepo.get(roomKey);
  if (!session) {
    return c.json({ error: "Session not found or invalid room key" }, 404);
  }
  return c.json({ session });
});

app.post("/api/sessions/:roomKey/end", (c) => {
  const roomKey = (c.req.param("roomKey") || "").toUpperCase();
  sessionRepo.end(roomKey);

  const room = rooms.get(roomKey);
  if (room) {
    broadcastToRoom(room, {
      type: "endSession",
      message: "Session ended by host",
    });
    for (const client of room.clients) {
      try {
        client.ws.close();
      } catch {}
    }
    rooms.delete(roomKey);
  }

  return c.json({ success: true });
});

// WebSocket Handler
const wsHandler = upgradeWebSocket((c) => {
  const rawKey = c.req.param("roomKey") || "";
  const roomKey = rawKey.toUpperCase();
  const roleParam = c.req.query("role") as "prompter" | "remote" | undefined;
    const role: "prompter" | "remote" = roleParam === "prompter" ? "prompter" : "remote";
    const clientId = `${role}_${Math.random().toString(36).substring(2, 9)}`;

    let currentRoom: Room;
    let clientRef: ClientConnection;

    return {
      onOpen(event, ws) {
        currentRoom = getOrCreateRoom(roomKey);
        clientRef = { id: clientId, role, ws };
        currentRoom.clients.add(clientRef);

        console.log(`[WS] ${role} connected to room ${roomKey}. Total: ${currentRoom.clients.size}`);
        sessionRepo.touch(roomKey);

        // Send initial state & metadata to newly joined client
        ws.send(
          JSON.stringify({
            type: "init",
            clientId,
            role,
            roomKey,
            state: currentRoom.state,
            peerCount: currentRoom.clients.size,
            hasPrompter: [...currentRoom.clients].some((client) => client.role === "prompter"),
            remoteCount: [...currentRoom.clients].filter((client) => client.role === "remote").length,
          })
        );

        // Notify other peers in room of updated client counts
        sendPeerUpdate(currentRoom);
      },

      onMessage(event, ws) {
        try {
          const raw = typeof event.data === "string" ? event.data : event.data.toString();
          const message = JSON.parse(raw);

          sessionRepo.touch(roomKey);

          switch (message.type) {
            case "control": {
              const action: ControlAction = message.action;
              const payload = message.payload;

              // Apply state updates on server
              if (action === "play") currentRoom.state.isPlaying = true;
              if (action === "pause") currentRoom.state.isPlaying = false;
              if (action === "togglePlay") currentRoom.state.isPlaying = !currentRoom.state.isPlaying;
              if (action === "speedUp") {
                currentRoom.state.scrollSpeed = Math.min(10, currentRoom.state.scrollSpeed + 0.5);
              }
              if (action === "speedDown") {
                currentRoom.state.scrollSpeed = Math.max(0.5, currentRoom.state.scrollSpeed - 0.5);
              }
              if (action === "setSpeed" && typeof payload?.speed === "number") {
                currentRoom.state.scrollSpeed = Math.max(0.5, Math.min(10, payload.speed));
              }
              if (action === "fontSizeUp") {
                currentRoom.state.fontSize = Math.min(96, currentRoom.state.fontSize + 4);
              }
              if (action === "fontSizeDown") {
                currentRoom.state.fontSize = Math.max(20, currentRoom.state.fontSize - 4);
              }
              if (action === "setFontSize" && typeof payload?.fontSize === "number") {
                currentRoom.state.fontSize = Math.max(20, Math.min(96, payload.fontSize));
              }
              if (action === "toggleMirror") {
                currentRoom.state.mirrored = !currentRoom.state.mirrored;
              }
              if (action === "reset") {
                currentRoom.state.isPlaying = false;
                currentRoom.state.progress = 0;
                currentRoom.state.currentLine = 0;
              }

              // Broadcast control action and updated state to everyone in the room
              broadcastToRoom(currentRoom, {
                type: "control",
                action,
                payload,
                state: currentRoom.state,
                senderId: clientId,
              });

              if (action === "endSession") {
                sessionRepo.end(roomKey);
                broadcastToRoom(currentRoom, {
                  type: "endSession",
                  message: "Session ended",
                });
                for (const client of currentRoom.clients) {
                  try {
                    client.ws.close();
                  } catch {}
                }
                rooms.delete(roomKey);
              }
              break;
            }

            case "stateUpdate": {
              // Prompter sends continuous progress or state sync
              if (message.state) {
                currentRoom.state = {
                  ...currentRoom.state,
                  ...message.state,
                };
                // Broadcast updated state to remotes
                broadcastToRoom(
                  currentRoom,
                  {
                    type: "state",
                    state: currentRoom.state,
                  },
                  clientId // exclude sender
                );
              }
              break;
            }

            case "requestSync": {
              ws.send(
                JSON.stringify({
                  type: "sync",
                  state: currentRoom.state,
                })
              );
              break;
            }

            default:
              console.log(`[WS] Unrecognized message type:`, message.type);
          }
        } catch (err) {
          console.error(`[WS] Error parsing message:`, err);
        }
      },

      onClose(event, ws) {
        if (currentRoom && clientRef) {
          currentRoom.clients.delete(clientRef);
          console.log(
            `[WS] ${role} disconnected from room ${roomKey}. Remaining: ${currentRoom.clients.size}`
          );
          if (currentRoom.clients.size === 0) {
            // Room is empty; schedule cleanup if inactive for 10 minutes
            setTimeout(() => {
              const r = rooms.get(roomKey);
              if (r && r.clients.size === 0) {
                rooms.delete(roomKey);
              }
            }, 600000);
          } else {
            sendPeerUpdate(currentRoom);
          }
        }
      },

      onError(event, ws) {
        console.error(`[WS] WebSocket error in room ${roomKey}:`, event);
      },
    };
  }
);

// Register routes for standard WebSockets and PartySocket
app.get("/ws/:roomKey", wsHandler);
app.get("/parties/controls/:roomKey", wsHandler);
app.get("/party/controls/:roomKey", wsHandler);
app.get("/parties/:party/:roomKey", wsHandler);
app.get("/party/:roomKey", wsHandler);

// In production (when NEXT_PORT is defined), proxy all other requests to Next.js
const nextPort = process.env.NEXT_PORT;
if (nextPort) {
  app.all("/*", async (c) => {
    const targetUrl = `http://127.0.0.1:${nextPort}${c.req.path}${
      c.req.raw.url.includes("?") ? c.req.raw.url.slice(c.req.raw.url.indexOf("?")) : ""
    }`;

    const reqHeaders = new Headers(c.req.raw.headers);
    reqHeaders.delete("host");
    reqHeaders.delete("connection");
    reqHeaders.delete("accept-encoding");

    try {
      const res = await fetch(targetUrl, {
        method: c.req.method,
        headers: reqHeaders,
        body: ["GET", "HEAD"].includes(c.req.method)
          ? undefined
          : await c.req.raw.arrayBuffer(),
        // @ts-ignore
        duplex: "half",
      });

      const responseHeaders = new Headers(res.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");

      return new Response(res.body, {
        status: res.status,
        headers: responseHeaders,
      });
    } catch (err) {
      console.error("[Proxy Error]:", err);
      return c.text("Frontend is starting up, please refresh in a moment...", 503);
    }
  });
}

const PORT = Number(process.env.PORT || 3001);
const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`> Hono Server running on http://localhost:${info.port}`);
  }
);

injectWebSocket(server);
