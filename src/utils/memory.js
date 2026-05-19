import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const DB_DIR = join(homedir(), '.teampulse');
const DB_PATH = join(DB_DIR, 'memory.json');

let db = null;

export async function initDB() {
  if (db) return db;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const adapter = new JSONFile(DB_PATH);
  db = new Low(adapter, { meetings: [] });
  try {
    await db.read();
  } catch {
    // Corrupted JSON — reset to empty state
    db.data = { meetings: [] };
  }
  db.data ||= { meetings: [] };
  if (!Array.isArray(db.data.meetings)) db.data.meetings = [];
  await db.write();
  return db;
}

export function generateMeetingId(filename) {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const ts = Date.now().toString(36);
  return `${base}-${ts}`.slice(0, 32);
}

export async function saveMeeting(record) {
  const database = await initDB();
  const existing = database.data.meetings.findIndex(m => m.id === record.id);
  if (existing >= 0) {
    database.data.meetings[existing] = record;
  } else {
    database.data.meetings.push(record);
  }
  await database.write();
}

export async function getMeetings(limit = 20) {
  const database = await initDB();
  return [...database.data.meetings]
    .sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt))
    .slice(0, limit);
}

export async function getMeetingById(id) {
  const database = await initDB();
  return database.data.meetings.find(m => m.id === id) || null;
}

export async function getRecentContext(n = 5) {
  const meetings = await getMeetings(n);
  return meetings.map(m => ({
    id: m.id,
    title: m.title,
    analyzedAt: m.analyzedAt,
    skill: m.skill,
    analysis: m.analysis
  }));
}

export async function getAllMeetings() {
  const database = await initDB();
  return [...database.data.meetings].sort(
    (a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt)
  );
}
