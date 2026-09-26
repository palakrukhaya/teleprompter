"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronsUp,
  ChevronsDown,
  Type,
  Gauge,
  FlipHorizontal,
  LogOut,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useTeleprompterSocket, ControlAction, ControlPayload } from "@/hooks/useTeleprompterSocket";
import { cn } from "@/lib/utils";

interface SessionInfo {
  room_key: string;
  title: string;
}

export default function RemoteControlPage() {
  const params = useParams();
  const router = useRouter();
  const roomKey = (params?.roomKey as string)?.toUpperCase() || "";

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  // Haptic feedback utility
  const triggerHaptic = (duration: number = 30) => {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(duration);
      }
    } catch {}
  };

  // Fetch session metadata
  useEffect(() => {
    if (!roomKey) return;
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${roomKey}`);
        if (!res.ok) {
          alert("Session not found or already ended.");
          router.push("/remote");
          return;
        }
        const data = await res.json();
        setSessionInfo(data.session);
      } catch (err) {
        console.error("Error fetching session info:", err);
      }
    };
    fetchSession();
  }, [roomKey, router]);

  // WebSocket hook for remote
  const {
    isConnected,
    hasPrompter,
    state,
    sendControl,
    endSession,
  } = useTeleprompterSocket({
    roomKey,
    role: "remote",
    onSessionEnded: () => {
      alert("Prompter session has been ended.");
      router.push("/remote");
    },
  });

  const handleAction = useCallback(
    (action: ControlAction, payload?: ControlPayload, hapticMs: number = 25) => {
      triggerHaptic(hapticMs);
      sendControl(action, payload);
    },
    [sendControl]
  );

  const handleCloseSession = () => {
    if (confirm("Are you sure you want to end this teleprompter session?")) {
      handleAction("endSession", undefined, 60);
      endSession();
      router.push("/remote");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between max-w-md mx-auto select-none touch-manipulation">
      {/* Top Header */}
      <header className="p-4 border-b border-neutral-900 bg-neutral-950/90 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-mono font-bold tracking-widest text-amber-400"
            >
              {roomKey}
            </Badge>

            <Badge
              variant={isConnected ? (hasPrompter ? "success" : "warning") : "destructive"}
              className="h-7 text-[11px] px-2 flex items-center gap-1.5"
            >
              {isConnected ? (
                hasPrompter ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Prompter Idle</span>
                  </>
                )
              ) : (
                <>
                  <WifiOff size={12} />
                  <span>Reconnecting</span>
                </>
              )}
            </Badge>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCloseSession}
            className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8 px-2.5 text-xs flex items-center gap-1"
          >
            <LogOut size={14} />
            <span>End</span>
          </Button>
        </div>

        {/* Script Title & Current Status */}
        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white truncate max-w-[200px]">
            {sessionInfo?.title || "Live Teleprompter"}
          </h2>
          <div
            className={cn(
              "text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5",
              state.isPlaying
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-neutral-800 text-neutral-400 border border-neutral-700"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                state.isPlaying ? "bg-amber-400 animate-ping" : "bg-neutral-500"
              )}
            />
            {state.isPlaying ? "SCROLLING" : "PAUSED"}
          </div>
        </div>
      </header>

      {/* Main Thumb-Ergonomics Zone */}
      <main className="flex-1 flex flex-col justify-center px-6 py-6 space-y-8">
        {/* Restart / Reset Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("reset", undefined, 40)}
            className="border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 rounded-full px-5 py-2 flex items-center gap-2 text-xs font-semibold shadow-sm"
          >
            <RotateCcw size={14} className="text-amber-400" />
            <span>Restart to Top</span>
          </Button>
        </div>

        {/* Vertical Nudge Up Button */}
        <div className="flex justify-center">
          <button
            onClick={() => handleAction("up", undefined, 30)}
            className="w-20 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 active:bg-neutral-700 text-neutral-200 flex flex-col items-center justify-center shadow-lg transition-transform"
            aria-label="Scroll Up"
          >
            <ChevronsUp size={24} className="text-amber-400" />
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">UP</span>
          </button>
        </div>

        {/* Central Giant Play/Pause Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={() =>
              handleAction(state.isPlaying ? "pause" : "play", undefined, 45)
            }
            className={cn(
              "w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-200 active:scale-90 border-4",
              state.isPlaying
                ? "bg-amber-500 hover:bg-amber-400 border-amber-300 text-black shadow-amber-500/30"
                : "bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white shadow-neutral-900/50"
            )}
            aria-label={state.isPlaying ? "Pause Prompter" : "Play Prompter"}
          >
            {state.isPlaying ? (
              <>
                <Pause size={46} fill="currentColor" />
                <span className="text-xs font-black uppercase tracking-wider mt-1">PAUSE</span>
              </>
            ) : (
              <>
                <Play size={46} fill="currentColor" className="ml-1" />
                <span className="text-xs font-black uppercase tracking-wider mt-1">PLAY</span>
              </>
            )}
          </button>
        </div>

        {/* Vertical Nudge Down Button */}
        <div className="flex justify-center">
          <button
            onClick={() => handleAction("down", undefined, 30)}
            className="w-20 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 active:bg-neutral-700 text-neutral-200 flex flex-col items-center justify-center shadow-lg transition-transform"
            aria-label="Scroll Down"
          >
            <ChevronsDown size={24} className="text-amber-400" />
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">DOWN</span>
          </button>
        </div>
      </main>

      {/* Bottom Adjustment Controls (Speed & Font Size) */}
      <footer className="p-5 border-t border-neutral-900 bg-neutral-950/95 space-y-4">
        {/* Speed Adjustment Control */}
        <div className="bg-neutral-900/60 border border-neutral-800/80 p-3.5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Gauge size={14} className="text-amber-400" /> Scroll Speed
            </span>
            <span className="font-mono text-sm font-black text-amber-400">
              {state.scrollSpeed}x
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("speedDown", undefined, 20)}
              className="h-10 w-10 shrink-0 border-neutral-700 text-lg font-bold rounded-xl"
            >
              -
            </Button>
            <Slider
              value={[state.scrollSpeed]}
              min={0.5}
              max={10}
              step={0.5}
              onValueChange={([val]) => handleAction("setSpeed", { speed: val }, 15)}
              className="flex-1 py-2"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("speedUp", undefined, 20)}
              className="h-10 w-10 shrink-0 border-neutral-700 text-lg font-bold rounded-xl"
            >
              +
            </Button>
          </div>
        </div>

        {/* Font Size Adjustment Control */}
        <div className="bg-neutral-900/60 border border-neutral-800/80 p-3.5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Type size={14} className="text-amber-400" /> Font Size
            </span>
            <span className="font-mono text-sm font-black text-amber-400">
              {state.fontSize}px
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("fontSizeDown", undefined, 20)}
              className="h-10 w-10 shrink-0 border-neutral-700 font-bold rounded-xl text-xs"
            >
              A-
            </Button>
            <Slider
              value={[state.fontSize]}
              min={24}
              max={96}
              step={4}
              onValueChange={([val]) => handleAction("setFontSize", { fontSize: val }, 15)}
              className="flex-1 py-2"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("fontSizeUp", undefined, 20)}
              className="h-10 w-10 shrink-0 border-neutral-700 font-bold rounded-xl text-sm"
            >
              A+
            </Button>
          </div>
        </div>

        {/* Quick Pro Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("toggleMirror", undefined, 25)}
            className={cn(
              "flex-1 h-10 rounded-xl text-xs font-semibold border-neutral-800 flex items-center justify-center gap-1.5",
              state.mirrored ? "bg-amber-500 text-black border-amber-500 font-bold" : "text-neutral-400"
            )}
          >
            <FlipHorizontal size={14} />
            <span>Mirror: {state.mirrored ? "ON" : "OFF"}</span>
          </Button>
        </div>
      </footer>
    </div>
  );
}
