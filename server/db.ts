import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "teleprompter.db");
export const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma("journal_mode = WAL");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prompter_sessions (
    room_key TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    FOREIGN KEY(script_id) REFERENCES scripts(id) ON DELETE CASCADE
  );
`);

export interface Script {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface PrompterSession {
  room_key: string;
  script_id: string;
  status: "active" | "ended";
  created_at: number;
  last_active_at: number;
  title?: string;
  content?: string;
}

function generateId(prefix: string = "scr"): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function generateRoomKey(): string {
  // Generate a distinct, easily readable 6-character code (avoid confusing chars like 0/O, 1/I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let key = "";
  for (let i = 0; i < 6; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export const scriptRepo = {
  getAll(): Script[] {
    const stmt = db.prepare("SELECT * FROM scripts ORDER BY updated_at DESC");
    return stmt.all() as Script[];
  },

  getById(id: string): Script | undefined {
    const stmt = db.prepare("SELECT * FROM scripts WHERE id = ?");
    return stmt.get(id) as Script | undefined;
  },

  create(title: string, content: string): Script {
    const id = generateId("scr");
    const now = Date.now();
    const stmt = db.prepare(
      "INSERT INTO scripts (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(id, title.trim() || "Untitled Script", content, now, now);
    return { id, title: title.trim() || "Untitled Script", content, created_at: now, updated_at: now };
  },

  update(id: string, title: string, content: string): Script | undefined {
    const now = Date.now();
    const stmt = db.prepare(
      "UPDATE scripts SET title = ?, content = ?, updated_at = ? WHERE id = ?"
    );
    const result = stmt.run(title.trim(), content, now, id);
    if (result.changes === 0) return undefined;
    return scriptRepo.getById(id);
  },

  delete(id: string): boolean {
    const stmt = db.prepare("DELETE FROM scripts WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

export const sessionRepo = {
  create(scriptId: string): PrompterSession {
    let roomKey = generateRoomKey();
    // Ensure roomKey uniqueness
    while (sessionRepo.get(roomKey)) {
      roomKey = generateRoomKey();
    }

    const now = Date.now();
    const stmt = db.prepare(
      "INSERT INTO prompter_sessions (room_key, script_id, status, created_at, last_active_at) VALUES (?, ?, 'active', ?, ?)"
    );
    stmt.run(roomKey, scriptId, now, now);

    const script = scriptRepo.getById(scriptId);
    return {
      room_key: roomKey,
      script_id: scriptId,
      status: "active",
      created_at: now,
      last_active_at: now,
      title: script?.title,
      content: script?.content,
    };
  },

  get(roomKey: string): PrompterSession | undefined {
    const stmt = db.prepare(`
      SELECT s.*, sc.title, sc.content
      FROM prompter_sessions s
      JOIN scripts sc ON s.script_id = sc.id
      WHERE s.room_key = ?
    `);
    return stmt.get(roomKey.toUpperCase()) as PrompterSession | undefined;
  },

  touch(roomKey: string): void {
    const stmt = db.prepare(
      "UPDATE prompter_sessions SET last_active_at = ? WHERE room_key = ?"
    );
    stmt.run(Date.now(), roomKey.toUpperCase());
  },

  end(roomKey: string): boolean {
    const stmt = db.prepare(
      "UPDATE prompter_sessions SET status = 'ended', last_active_at = ? WHERE room_key = ?"
    );
    const result = stmt.run(Date.now(), roomKey.toUpperCase());
    return result.changes > 0;
  },
};

// Seed sample scripts if database is empty
const count = db.prepare("SELECT count(*) as count FROM scripts").get() as { count: number };
if (count.count === 0) {
  const sample1 = `Welcome everyone, and thank you for joining us today.

Over the past year, our team has been working tirelessly on a breakthrough in agentic systems. We asked ourselves a fundamental question: What if computers didn't just calculate answers, but actively partnered with us to solve creative and technical challenges?

Today, I am thrilled to unveil the next phase of our journey.

First, let's talk about ergonomics and real-time collaboration. When you are presenting, your audience is everything. Any distraction, any friction in controlling your tempo can disrupt the magic.

That is why we designed this remote-first teleprompter. It synchronizes seamlessly between your main stage monitor and your handheld device with zero perceptible latency.

Notice how easily the speed adapts to the speaker's natural breathing cadence. When you need to pause for emphasis, a single tap pauses the scroll instantly.

We believe that great technology gets out of your way and lets your natural voice shine through.

Thank you, and enjoy the rest of today's demo!`;

  const sample2 = `Hey what's going on everyone! Welcome back to the channel.

In today's video, we're taking a deep dive into the ultimate desk setup for 2026.

If you've been following the channel for a while, you know that I am obsessed with clean lines, cable management, and high-productivity workflows.

Today, we're testing three new monitors, an ultra-quiet mechanical keyboard, and a customized teleprompter setup that lets you look straight into the camera lens while reading your talking points.

Before we get into the specs, make sure to hit that subscribe button down below and ring the bell so you never miss another tech breakdown.

Alright, let's jump right into chapter one: The Display.`;

  const sample3 = `Good morning team and distinguished guests.

Today marks a major milestone for our company. As we reflect on what we have achieved together over the past quarter, one theme stands out above all else: resilience and focused execution.

Every team member brought their absolute best, pushing boundaries and overcoming every hurdle.

As we look toward the remainder of the year, our priorities remain clear:
1. Customer delight and reliability.
2. Rapid, responsible innovation.
3. Cultivating a collaborative culture where every idea can flourish.

Let's keep this momentum going!`;

  scriptRepo.create("Keynote Presentation: The Future of Agentic Systems", sample1);
  scriptRepo.create("YouTube Video Script: Ultimate 2026 Desk Setup", sample2);
  scriptRepo.create("Executive All-Hands Address", sample3);
}
