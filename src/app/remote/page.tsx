"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, ArrowRight, Radio, AlertCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RemotePairingPage() {
  const router = useRouter();
  const [roomKey, setRoomKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentRooms, setRecentRooms] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tp_recent_rooms");
      if (stored) {
        setRecentRooms(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handlePair = async (keyToUse?: string) => {
    const key = (keyToUse || roomKey).trim().toUpperCase();
    if (!key) return;

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/sessions/${key}`);
      if (!res.ok) {
        throw new Error("Room not found or session has ended. Check the code and try again.");
      }

      // Save to recent rooms in localStorage
      try {
        const updated = Array.from(new Set([key, ...recentRooms])).slice(0, 5);
        localStorage.setItem("tp_recent_rooms", JSON.stringify(updated));
      } catch {}

      router.push(`/remote/${key}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect to room.");
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-between p-6 select-none">
      {/* Top Branding */}
      <div className="w-full max-w-sm pt-8 flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-black font-black">
          <Radio size={18} />
        </div>
        <h1 className="text-base font-black tracking-tight text-white">
          TELEPROMPTER <span className="text-amber-400">REMOTE</span>
        </h1>
      </div>

      {/* Center Pairing Card */}
      <div className="w-full max-w-sm space-y-6 bg-neutral-900/60 border border-neutral-800 p-6 rounded-3xl shadow-2xl backdrop-blur-md">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Smartphone size={28} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Pair Your Device</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Enter the 6-character Room Key displayed on your main teleprompter screen.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePair();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="e.g. 8K2M9P"
              value={roomKey}
              onChange={(e) => {
                setRoomKey(e.target.value.toUpperCase());
                setErrorMessage(null);
              }}
              maxLength={8}
              autoFocus
              className="h-16 text-center font-mono text-2xl font-black tracking-widest text-amber-400 uppercase bg-neutral-950 border-neutral-700 rounded-2xl focus-visible:ring-amber-500"
            />

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/40 border border-red-900/60 p-2.5 rounded-xl">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={!roomKey.trim() || isVerifying}
            className="w-full h-14 text-base font-bold rounded-2xl bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              "Connecting..."
            ) : (
              <>
                Connect Remote <ArrowRight size={18} />
              </>
            )}
          </Button>
        </form>

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <div className="pt-4 border-t border-neutral-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              <History size={13} /> Recent Rooms
            </div>
            <div className="flex flex-wrap gap-2">
              {recentRooms.map((key) => (
                <button
                  key={key}
                  onClick={() => handlePair(key)}
                  className="font-mono text-xs font-bold text-neutral-300 bg-neutral-800 hover:bg-neutral-700 hover:text-amber-400 px-3 py-1.5 rounded-xl border border-neutral-700 transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="w-full max-w-sm text-center pb-4 text-xs text-neutral-500">
        Make sure this device and the teleprompter screen are connected to the same network.
      </div>
    </div>
  );
}
