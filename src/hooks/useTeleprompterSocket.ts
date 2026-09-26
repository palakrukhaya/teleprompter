"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import PartySocket from "partysocket";

export interface RoomState {
  isPlaying: boolean;
  scrollSpeed: number;
  fontSize: number;
  lineSpacing: number;
  progress: number;
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

export interface ControlPayload {
  speed?: number;
  fontSize?: number;
  lineSpacing?: number;
  [key: string]: unknown;
}

export interface WebSocketMessage {
  type: "init" | "sync" | "control" | "state" | "peerUpdate" | "endSession";
  action?: ControlAction;
  payload?: ControlPayload;
  state?: Partial<RoomState>;
  peerCount?: number;
  hasPrompter?: boolean;
  remoteCount?: number;
  message?: string;
  senderId?: string;
}

export function useTeleprompterSocket({
  roomKey,
  role,
  onControlReceived,
  onSessionEnded,
}: {
  roomKey: string;
  role: "prompter" | "remote";
  onControlReceived?: (action: ControlAction, payload?: ControlPayload) => void;
  onSessionEnded?: () => void;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [hasPrompter, setHasPrompter] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const [state, setState] = useState<RoomState>({
    isPlaying: false,
    scrollSpeed: 2,
    fontSize: 48,
    lineSpacing: 1.6,
    progress: 0,
    currentLine: 0,
    textColor: "#FFFFFF",
    bgColor: "#000000",
    mirrored: false,
  });

  const socketRef = useRef<PartySocket | null>(null);

  // Store latest callbacks in refs so changes never trigger socket reconnections
  const onControlReceivedRef = useRef(onControlReceived);
  onControlReceivedRef.current = onControlReceived;

  const onSessionEndedRef = useRef(onSessionEnded);
  onSessionEndedRef.current = onSessionEnded;

  useEffect(() => {
    if (!roomKey || typeof window === "undefined") return;

    let host = process.env.NEXT_PUBLIC_WS_HOST || "";
    if (!host) {
      if (
        window.location.port === "3000" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        host = `${window.location.hostname}:${process.env.NEXT_PUBLIC_WS_PORT || "3001"}`;
      } else {
        // In production with reverse proxy or custom port
        host = process.env.NEXT_PUBLIC_WS_PORT
          ? `${window.location.hostname}:${process.env.NEXT_PUBLIC_WS_PORT}`
          : window.location.host;
      }
    }

    console.log(`[PartySocket] Initializing PartySocket for room: ${roomKey} on ${host}`);

    const ws = new PartySocket({
      host,
      party: "controls",
      room: roomKey.toUpperCase(),
      query: { role },
    });
    socketRef.current = ws;

    const handleOpen = () => {
      console.log(`[PartySocket] Connected to room: ${roomKey} as ${role}`);
      setIsConnected(true);
    };

    const handleClose = () => {
      console.log(`[PartySocket] Disconnected from room: ${roomKey}`);
      setIsConnected(false);
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);

        if (data.type === "init") {
          if (data.state) setState((prev) => ({ ...prev, ...data.state }));
          if (typeof data.peerCount === "number") setPeerCount(data.peerCount);
          if (typeof data.hasPrompter === "boolean") setHasPrompter(data.hasPrompter);
          if (typeof data.remoteCount === "number") setRemoteCount(data.remoteCount);
        } else if (data.type === "peerUpdate") {
          if (typeof data.peerCount === "number") setPeerCount(data.peerCount);
          if (typeof data.hasPrompter === "boolean") setHasPrompter(data.hasPrompter);
          if (typeof data.remoteCount === "number") setRemoteCount(data.remoteCount);
        } else if (data.type === "state" || data.type === "sync") {
          if (data.state) setState((prev) => ({ ...prev, ...data.state }));
        } else if (data.type === "control") {
          if (data.state) setState((prev) => ({ ...prev, ...data.state }));
          if (data.action && onControlReceivedRef.current) {
            onControlReceivedRef.current(data.action, data.payload);
          }
        } else if (data.type === "endSession") {
          if (onSessionEndedRef.current) {
            onSessionEndedRef.current();
          }
        }
      } catch (err) {
        console.error("[PartySocket] Error parsing incoming message:", err);
      }
    };

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("close", handleClose);
    ws.addEventListener("message", handleMessage);

    return () => {
      console.log(`[PartySocket] Closing PartySocket for room: ${roomKey}`);
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("message", handleMessage);
      ws.close();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [roomKey, role]);

  const sendControl = useCallback(
    (action: ControlAction, payload?: ControlPayload) => {
      if (socketRef.current) {
        socketRef.current.send(
          JSON.stringify({
            type: "control",
            action,
            payload,
          })
        );
      }
    },
    []
  );

  const updateState = useCallback((partialState: Partial<RoomState>) => {
    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          type: "stateUpdate",
          state: partialState,
        })
      );
    }
  }, []);

  const endSession = useCallback(() => {
    sendControl("endSession");
  }, [sendControl]);

  return {
    isConnected,
    peerCount,
    hasPrompter,
    remoteCount,
    state,
    setState,
    sendControl,
    updateState,
    endSession,
    socket: socketRef.current,
  };
}
