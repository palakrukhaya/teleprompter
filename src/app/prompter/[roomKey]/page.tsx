"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  QrCode,
  ArrowUp,
  ArrowDown,
  FlipHorizontal,
  ChevronLeft,
  Settings,
  WifiOff,
  Smartphone,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { QRCodeModal } from "@/components/QRCodeModal";
import { useTeleprompterSocket, ControlAction, ControlPayload } from "@/hooks/useTeleprompterSocket";
import { cn } from "@/lib/utils";

interface SessionData {
  room_key: string;
  script_id: string;
  status: string;
  title: string;
  content: string;
}

export default function PrompterPage() {
  const params = useParams();
  const router = useRouter();
  const roomKey = (params?.roomKey as string)?.toUpperCase() || "";

  // Data fetching
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Prompter Configuration State
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2); // 0.5 to 10
  const [fontSize, setFontSize] = useState(48); // 24 to 96
  const [lineSpacing, setLineSpacing] = useState(1.6);
  const [isMirrored, setIsMirrored] = useState(false);
  const [showFocusGuide, setShowFocusGuide] = useState(true);
  const [textColor, setTextColor] = useState("#FFFFFF"); // Default bright white
  const [isFullScreen, setIsFullScreen] = useState(false);

  // UI Visibility States
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // References
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const accumulatedScrollRef = useRef<number>(0);

  // Fetch Session & Script from API
  useEffect(() => {
    if (!roomKey) return;
    const fetchSession = async () => {
      try {
        setIsLoadingSession(true);
        const res = await fetch(`/api/sessions/${roomKey}`);
        if (!res.ok) {
          throw new Error("Invalid Room Key or session has ended.");
        }
        const data = await res.json();
        setSession(data.session);
      } catch (err: unknown) {
        setSessionError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setIsLoadingSession(false);
      }
    };
    fetchSession();
  }, [roomKey]);

  // Handle incoming commands from paired remotes
  const handleControlReceived = useCallback((action: ControlAction, payload?: ControlPayload) => {
    console.log("[Prompter] Control received:", action, payload);

    switch (action) {
      case "play":
        setIsPlaying(true);
        break;
      case "pause":
        setIsPlaying(false);
        break;
      case "togglePlay":
        setIsPlaying((prev) => !prev);
        break;
      case "up":
        // Manual nudge up
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollBy({ top: -120, behavior: "smooth" });
        }
        break;
      case "down":
        // Manual nudge down
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollBy({ top: 120, behavior: "smooth" });
        }
        break;
      case "speedUp":
        setScrollSpeed((prev) => Math.min(10, Math.round((prev + 0.5) * 10) / 10));
        break;
      case "speedDown":
        setScrollSpeed((prev) => Math.max(0.5, Math.round((prev - 0.5) * 10) / 10));
        break;
      case "setSpeed":
        if (typeof payload?.speed === "number") {
          setScrollSpeed(Math.max(0.5, Math.min(10, payload.speed)));
        }
        break;
      case "fontSizeUp":
        setFontSize((prev) => Math.min(96, prev + 4));
        break;
      case "fontSizeDown":
        setFontSize((prev) => Math.max(20, prev - 4));
        break;
      case "setFontSize":
        if (typeof payload?.fontSize === "number") {
          setFontSize(Math.max(20, Math.min(96, payload.fontSize)));
        }
        break;
      case "reset":
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
        accumulatedScrollRef.current = 0;
        setIsPlaying(false);
        break;
      case "toggleMirror":
        setIsMirrored((prev) => !prev);
        break;
      case "endSession":
        alert("This session has been ended.");
        router.push("/");
        break;
    }
  }, [router]);

  // WebSocket Connection
  const {
    isConnected,
    remoteCount,
    sendControl,
    updateState,
  } = useTeleprompterSocket({
    roomKey,
    role: "prompter",
    onControlReceived: handleControlReceived,
    onSessionEnded: () => {
      alert("Session ended by remote.");
      router.push("/");
    },
  });

  // Keep WebSocket state synced when local state changes
  useEffect(() => {
    updateState({
      isPlaying,
      scrollSpeed,
      fontSize,
      mirrored: isMirrored,
    });
  }, [isPlaying, scrollSpeed, fontSize, isMirrored, updateState]);

  // Smooth Auto-Scrolling Engine using requestAnimationFrame
  const scrollStep = useCallback(() => {
    if (!isPlaying || !scrollContainerRef.current) return;

    const el = scrollContainerRef.current;
    const maxScroll = el.scrollHeight - el.clientHeight;

    if (el.scrollTop >= maxScroll - 2) {
      // Reached the bottom of the script
      setIsPlaying(false);
      sendControl("pause");
      return;
    }

    // Scroll speed maps to fractional pixels per frame for fluid 60fps scrolling
    // speed 1 = ~0.6px/frame, speed 5 = ~3px/frame, speed 10 = ~6px/frame
    const pixelsPerFrame = scrollSpeed * 0.75;
    accumulatedScrollRef.current += pixelsPerFrame;

    if (accumulatedScrollRef.current >= 1) {
      const step = Math.floor(accumulatedScrollRef.current);
      el.scrollTop += step;
      accumulatedScrollRef.current -= step;
    }

    animationFrameRef.current = requestAnimationFrame(scrollStep);
  }, [isPlaying, scrollSpeed, sendControl]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(scrollStep);
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, scrollStep]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPlaying((prev) => {
            const next = !prev;
            sendControl(next ? "play" : "pause");
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ top: -80, behavior: "smooth" });
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ top: 80, behavior: "smooth" });
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          setScrollSpeed((prev) => Math.min(10, Math.round((prev + 0.5) * 10) / 10));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setScrollSpeed((prev) => Math.max(0.5, Math.round((prev - 0.5) * 10) / 10));
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "KeyM":
          e.preventDefault();
          setIsMirrored((prev) => !prev);
          break;
        case "KeyR":
          e.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
          }
          setIsPlaying(false);
          sendControl("pause");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sendControl]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.error(err));
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Auto-hide Controls on Inactivity
  const resetControlsTimer = useCallback(() => {
    setIsControlsVisible(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsControlsVisible(false);
        setIsSettingsOpen(false);
      }
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const handleMouseMove = () => resetControlsTimer();
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [resetControlsTimer]);

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-400 font-mono text-sm">Initializing Prompter Session...</p>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-400">
          <WifiOff size={32} />
        </div>
        <h2 className="text-2xl font-bold">Session Not Available</h2>
        <p className="text-neutral-400 max-w-md text-sm">{sessionError || "Room not found."}</p>
        <Button
          onClick={() => router.push("/")}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-screen w-screen overflow-hidden bg-black select-none transition-colors duration-300",
        isMirrored && "scale-x-[-1]"
      )}
    >
      {/* Eye-Focus Guide Overlay */}
      {showFocusGuide && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex items-center justify-between px-6 opacity-40">
          <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
          <div className="px-3 text-xs font-mono font-bold uppercase tracking-widest text-amber-400 bg-neutral-950/80 rounded border border-amber-500/30">
            EYE FOCUS LINE
          </div>
          <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
        </div>
      )}

      {/* Top Floating Header (Room Key & Status) */}
      <header
        className={cn(
          "absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between transition-opacity duration-300 pointer-events-auto",
          !isControlsVisible && isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push("/")}
            className="text-neutral-400 hover:text-white hover:bg-neutral-900 h-9 px-3"
          >
            <ChevronLeft size={18} className="mr-1" /> Dashboard
          </Button>

          <div className="h-4 w-px bg-neutral-800" />

          <h1 className="text-sm font-bold text-neutral-300 max-w-xs truncate">
            {session.title}
          </h1>
        </div>

        {/* Room Key Badge & QR Code */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setIsQRModalOpen(true)}
            className="group cursor-pointer flex items-center gap-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 px-3.5 py-1.5 rounded-xl shadow-lg transition-all"
            title="Click to display QR code for mobile pairing"
          >
            <Smartphone size={16} className="text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                ROOM KEY
              </span>
              <span className="font-mono text-base font-black tracking-widest text-amber-400 leading-none">
                {roomKey}
              </span>
            </div>
            <QrCode size={18} className="text-neutral-400 group-hover:text-amber-400 transition-colors ml-1" />
          </div>

          {/* Connection Status Badge */}
          <Badge
            variant={isConnected ? (remoteCount > 0 ? "success" : "warning") : "destructive"}
            className="h-8 px-3 flex items-center gap-1.5"
          >
            {isConnected ? (
              remoteCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span>{remoteCount} Remote Connected</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Waiting for Remote</span>
                </>
              )
            ) : (
              <>
                <WifiOff size={14} />
                <span>Offline</span>
              </>
            )}
          </Badge>
        </div>
      </header>

      {/* Main Scrolling Text Content */}
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-auto px-12 md:px-32 lg:px-48 pt-[35vh] pb-[60vh] scroll-smooth no-scrollbar"
        style={{
          color: textColor,
          fontSize: `${fontSize}px`,
          lineHeight: lineSpacing,
        }}
      >
        <div className="max-w-4xl mx-auto space-y-8 font-sans font-medium tracking-normal text-left whitespace-pre-wrap">
          {session.content.split("\n\n").map((paragraph, idx) => (
            <p key={idx} className="transition-opacity duration-200">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div
        className={cn(
          "absolute bottom-6 inset-x-0 z-30 flex justify-center transition-all duration-300 pointer-events-none",
          !isControlsVisible && isPlaying ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0"
        )}
      >
        <div className="pointer-events-auto flex items-center gap-3 bg-neutral-900/95 border border-neutral-700/80 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md">
          {/* Play/Pause Button */}
          <Button
            size="lg"
            onClick={() => {
              const next = !isPlaying;
              setIsPlaying(next);
              sendControl(next ? "play" : "pause");
            }}
            className={cn(
              "h-12 px-6 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg",
              isPlaying
                ? "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
                : "bg-white hover:bg-neutral-200 text-black"
            )}
          >
            {isPlaying ? (
              <>
                <Pause size={18} fill="currentColor" /> Pause (Space)
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" /> Play (Space)
              </>
            )}
          </Button>

          {/* Reset Button */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => handleControlReceived("reset")}
            title="Reset to Beginning (R)"
            className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 h-11 w-11 rounded-xl"
          >
            <RotateCcw size={18} />
          </Button>

          {/* Manual Nudge Buttons */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => handleControlReceived("up")}
            title="Scroll Up (Arrow Up)"
            className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 h-11 w-11 rounded-xl"
          >
            <ArrowUp size={18} />
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => handleControlReceived("down")}
            title="Scroll Down (Arrow Down)"
            className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 h-11 w-11 rounded-xl"
          >
            <ArrowDown size={18} />
          </Button>

          {/* Speed Indicator & Controls */}
          <div className="flex items-center gap-2 px-3 py-1 bg-neutral-950 border border-neutral-800 rounded-xl">
            <span className="text-xs text-neutral-400 font-semibold uppercase">Speed</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleControlReceived("speedDown")}
              className="h-7 w-7 p-0 text-white font-bold"
            >
              -
            </Button>
            <span className="font-mono text-sm font-bold text-amber-400 min-w-[36px] text-center">
              {scrollSpeed}x
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleControlReceived("speedUp")}
              className="h-7 w-7 p-0 text-white font-bold"
            >
              +
            </Button>
          </div>

          {/* Settings Popover / Drawer Toggle */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            title="Teleprompter Settings"
            className={cn(
              "border-neutral-700 h-11 w-11 rounded-xl transition-colors",
              isSettingsOpen ? "bg-amber-500 text-black border-amber-500" : "text-neutral-300 hover:bg-neutral-800"
            )}
          >
            <Settings size={18} />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            size="icon"
            variant="outline"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen (F)"
            className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 h-11 w-11 rounded-xl"
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </Button>
        </div>
      </div>

      {/* Settings Panel Flyout */}
      {isSettingsOpen && (
        <div className="absolute bottom-24 right-6 z-40 w-80 bg-neutral-950 border border-neutral-800 p-5 rounded-2xl shadow-2xl space-y-4 text-neutral-100">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <Settings size={15} className="text-amber-400" /> Prompter Settings
            </h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-neutral-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          {/* Font Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-neutral-400">
              <span>Font Size</span>
              <span className="font-mono text-amber-400">{fontSize}px</span>
            </div>
            <Slider
              value={[fontSize]}
              min={24}
              max={96}
              step={2}
              onValueChange={([val]) => {
                setFontSize(val);
                sendControl("setFontSize", { fontSize: val });
              }}
            />
          </div>

          {/* Scroll Speed */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-neutral-400">
              <span>Scroll Speed</span>
              <span className="font-mono text-amber-400">{scrollSpeed}x</span>
            </div>
            <Slider
              value={[scrollSpeed]}
              min={0.5}
              max={10}
              step={0.5}
              onValueChange={([val]) => {
                setScrollSpeed(val);
                sendControl("setSpeed", { speed: val });
              }}
            />
          </div>

          {/* Line Spacing */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-neutral-400">
              <span>Line Spacing</span>
              <span className="font-mono text-amber-400">{lineSpacing}</span>
            </div>
            <Slider
              value={[lineSpacing]}
              min={1.2}
              max={2.5}
              step={0.1}
              onValueChange={([val]) => setLineSpacing(val)}
            />
          </div>

          {/* Text Color Options */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">Text Contrast</label>
            <div className="flex gap-2">
              {[
                { label: "Crisp White", color: "#FFFFFF" },
                { label: "Studio Yellow", color: "#FFE600" },
                { label: "High-Vis Green", color: "#4ADE80" },
                { label: "Soft Cyan", color: "#38BDF8" },
              ].map((opt) => (
                <button
                  key={opt.color}
                  onClick={() => setTextColor(opt.color)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    textColor === opt.color
                      ? "border-amber-400 bg-neutral-900"
                      : "border-neutral-800 hover:border-neutral-700 bg-neutral-950 text-neutral-400"
                  )}
                  style={{ color: opt.color }}
                >
                  {opt.label.split(" ")[1]}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <FlipHorizontal size={14} className="text-amber-400" /> Mirror Mode (Glass)
            </span>
            <Button
              size="sm"
              variant={isMirrored ? "default" : "outline"}
              onClick={() => setIsMirrored((p) => !p)}
              className={cn("h-7 px-3 text-xs", isMirrored && "bg-amber-500 text-black font-bold")}
            >
              {isMirrored ? "ON" : "OFF"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Eye size={14} className="text-amber-400" /> Focus Guide Line
            </span>
            <Button
              size="sm"
              variant={showFocusGuide ? "default" : "outline"}
              onClick={() => setShowFocusGuide((p) => !p)}
              className={cn("h-7 px-3 text-xs", showFocusGuide && "bg-amber-500 text-black font-bold")}
            >
              {showFocusGuide ? "ON" : "OFF"}
            </Button>
          </div>
        </div>
      )}

      {/* QR Code Modal for Mobile Pairing */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomKey={roomKey}
      />
    </div>
  );
}
