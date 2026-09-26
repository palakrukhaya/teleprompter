"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Plus,
  Trash2,
  Edit3,
  Smartphone,
  Clock,
  FileText,
  Radio,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Script {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteKeyInput, setRemoteKeyInput] = useState("");
  const [isLaunchingId, setIsLaunchingId] = useState<string | null>(null);

  // Script Create / Edit Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchScripts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/scripts");
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts || []);
      }
    } catch (err) {
      console.error("Failed to load scripts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const openNewScript = () => {
    setEditingScript(null);
    setTitleInput("");
    setContentInput("");
    setIsEditorOpen(true);
  };

  const openEditScript = (script: Script) => {
    setEditingScript(script);
    setTitleInput(script.title);
    setContentInput(script.content);
    setIsEditorOpen(true);
  };

  const handleSaveScript = async () => {
    if (!contentInput.trim()) return;
    setIsSaving(true);
    try {
      if (editingScript) {
        // Update existing
        const res = await fetch(`/api/scripts/${editingScript.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleInput.trim() || "Untitled Script",
            content: contentInput,
          }),
        });
        if (res.ok) {
          setIsEditorOpen(false);
          fetchScripts();
        }
      } else {
        // Create new
        const res = await fetch("/api/scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleInput.trim() || "Untitled Script",
            content: contentInput,
          }),
        });
        if (res.ok) {
          setIsEditorOpen(false);
          fetchScripts();
        }
      }
    } catch (err) {
      console.error("Error saving script:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScript = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this script?")) return;
    try {
      const res = await fetch(`/api/scripts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setScripts((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete script:", err);
    }
  };

  const handleLaunchPrompter = async (scriptId: string) => {
    try {
      setIsLaunchingId(scriptId);
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId }),
      });
      if (res.ok) {
        const data = await res.json();
        const roomKey = data.session.room_key;
        router.push(`/prompter/${roomKey}`);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsLaunchingId(null);
    }
  };

  const handleConnectRemote = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = remoteKeyInput.trim().toUpperCase();
    if (cleanKey) {
      router.push(`/remote/${cleanKey}`);
    }
  };

  // Helper stats
  const getWordCount = (text: string) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const getEstimatedReadTime = (text: string) => {
    const words = getWordCount(text);
    // Average speech rate is ~130-150 words per minute
    const minutes = Math.ceil(words / 140);
    return minutes < 1 ? "< 1 min" : `~${minutes} min`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Radio className="text-black w-5 h-5 font-bold" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                TELEPROMPTER <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">PRO</span>
              </h1>
              <p className="text-xs text-neutral-400">Wireless Remote Controlled Studio Prompter</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/remote")}
              className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:text-white hover:bg-neutral-800 flex items-center gap-1.5"
            >
              <Smartphone size={15} className="text-amber-400" />
              <span>Remote Mode</span>
            </Button>
            <Button
              size="sm"
              onClick={openNewScript}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Plus size={16} />
              <span>New Script</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {/* Quick Remote Pair Banner */}
        <section className="bg-gradient-to-r from-neutral-900 via-neutral-900/80 to-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                <Sparkles size={14} /> Instant Device Pairing
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Pair a Phone or Tablet as Remote Control
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Have a teleprompter session running on another screen? Enter its 6-digit Room Key below to take remote control immediately.
              </p>
            </div>

            <form onSubmit={handleConnectRemote} className="flex items-center gap-2 shrink-0">
              <Input
                placeholder="ENTER ROOM KEY"
                value={remoteKeyInput}
                onChange={(e) => setRemoteKeyInput(e.target.value.toUpperCase())}
                maxLength={8}
                className="w-48 font-mono text-center uppercase tracking-widest bg-neutral-950 border-neutral-700 h-11 text-base text-amber-400 font-bold focus-visible:ring-amber-500"
              />
              <Button
                type="submit"
                disabled={!remoteKeyInput.trim()}
                className="h-11 px-5 bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-1.5"
              >
                Connect <ArrowRight size={16} />
              </Button>
            </form>
          </div>
        </section>

        {/* Scripts Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="text-amber-400 w-5 h-5" /> Your Teleprompter Scripts
            </h2>
            <p className="text-sm text-neutral-400">
              Click &quot;Launch Prompter&quot; to generate a Room Key and begin live reading.
            </p>
          </div>
          <Badge variant="secondary" className="bg-neutral-900 text-neutral-400 border border-neutral-800">
            {scripts.length} {scripts.length === 1 ? "Script" : "Scripts"}
          </Badge>
        </div>

        {/* Script Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl border border-neutral-800 bg-neutral-900/30 animate-pulse"
              />
            ))}
          </div>
        ) : scripts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20 p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mx-auto text-neutral-500">
              <FileText size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">No scripts found</h3>
              <p className="text-sm text-neutral-400">
                Write or paste your first speech, presentation, or video script.
              </p>
            </div>
            <Button
              onClick={openNewScript}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              <Plus size={16} className="mr-1" /> Create Script
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {scripts.map((script) => {
              const words = getWordCount(script.content);
              const readTime = getEstimatedReadTime(script.content);

              return (
                <div
                  key={script.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 hover:border-neutral-700 hover:bg-neutral-900/70 transition-all duration-200 shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-lg text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                        {script.title}
                      </h3>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditScript(script)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                          title="Edit Script"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteScript(script.id, e)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Delete Script"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-neutral-400 line-clamp-4 leading-relaxed font-sans">
                      {script.content}
                    </p>
                  </div>

                  <div className="pt-5 mt-4 border-t border-neutral-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <FileText size={13} className="text-neutral-500" />
                        {words} words
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-neutral-500" />
                        {readTime}
                      </span>
                    </div>

                    <Button
                      onClick={() => handleLaunchPrompter(script.id)}
                      disabled={isLaunchingId === script.id}
                      className="w-full bg-neutral-100 hover:bg-amber-400 text-neutral-950 font-bold group-hover:bg-amber-500 group-hover:text-black transition-colors flex items-center justify-center gap-2"
                    >
                      <Play size={16} fill="currentColor" />
                      {isLaunchingId === script.id ? "Launching..." : "Launch Prompter"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Script Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-2xl bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="text-amber-400" />
              {editingScript ? "Edit Script" : "Create New Script"}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Type or paste your script text below. Use line breaks to separate paragraphs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs uppercase font-semibold text-neutral-400 tracking-wider">
                Script Title
              </label>
              <Input
                placeholder="e.g., Keynote Opening Speech"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="bg-neutral-900 border-neutral-800 text-white font-semibold text-base focus-visible:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-semibold text-neutral-400 tracking-wider">
                  Script Content
                </label>
                <span className="text-xs text-neutral-400">
                  {getWordCount(contentInput)} words · {getEstimatedReadTime(contentInput)}
                </span>
              </div>
              <Textarea
                placeholder="Write or paste your script content here..."
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                rows={12}
                className="bg-neutral-900 border-neutral-800 text-neutral-100 font-sans leading-relaxed text-base focus-visible:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
              className="border-neutral-800 text-neutral-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveScript}
              disabled={isSaving || !contentInput.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6"
            >
              {isSaving ? "Saving..." : editingScript ? "Save Changes" : "Create Script"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
