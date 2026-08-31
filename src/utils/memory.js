// @ts-check
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const MEMORY_DIR = join(process.env.HOME || process.env.USERPROFILE || '.', '.teampulse');
const MEMORY_PATH = join(MEMORY_DIR, 'memory.json');

/**
 * @typedef {Object} MeetingEntry
 * @property {string} id
 * @property {string} file
 * @property {string} hash
 * @property {number} timestamp
 * @property {string} summary
 */

/**
 * @typedef {Object} MemoryData
 * @property {number} _version
 * @property {MeetingEntry[]} meetings
 */

/**
 * @returns {Promise<MemoryData>}
 */
export async function loadMemory() {
  await ensureDir();

  try {
    const content = await fs.readFile(MEMORY_PATH, 'utf-8');
    const data = JSON.parse(content);

    if (typeof data._version !== 'number') {
      data._version = 1;
    }
    if (!Array.isArray(data.meetings)) {
      data.meetings = [];
    }
    return data;
  } catch (err) {
    if (err.code === 'ENOENT') {
      const fresh = { _version: 1, meetings: [] };
      await saveMemory(fresh);
      return fresh;
    }

    try {
      const backupPath = `${MEMORY_PATH}.corrupt.${Date.now()}`;
      await fs.rename(MEMORY_PATH, backupPath);
    } catch {
      // si no se puede respaldar, continuar de todos modos
    }

    const fresh = { _version: 1, meetings: [] };
    await saveMemory(fresh);
    return fresh;
  }
}

/**
 * @param {MemoryData} data
 * @returns {Promise<void>}
 */
export async function saveMemory(data) {
  await ensureDir();

  const tempPath = `${MEMORY_PATH}.tmp.${process.pid}.${Date.now()}`;
  const payload = JSON.stringify(data, null, 2);

  await fs.writeFile(tempPath, payload, { encoding: 'utf-8', mode: 0o600 });
  await fs.rename(tempPath, MEMORY_PATH);

  try {
    await fs.chmod(MEMORY_PATH, 0o600);
  } catch {
    // en algunos sistemas de archivos esto puede fallar; no es critico
  }
}

async function ensureDir() {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true, mode: 0o700 });
  } catch {
    // ya existe
  }
}

/**
 * @param {string} file
 * @param {string} hash
 * @param {string} summary
 * @returns {Promise<MeetingEntry>}
 */
export async function addMeeting(file, hash, summary) {
  const memory = await loadMemory();
  const existing = memory.meetings.find(m => m.hash === hash);
  if (existing) {
    return existing;
  }

  const entry = {
    id: randomUUID(),
    file,
    hash,
    timestamp: Date.now(),
    summary,
  };

  memory.meetings.push(entry);
  await saveMemory(memory);
  return entry;
}

/**
 * @param {string} hash
 * @returns {Promise<MeetingEntry | null>}
 */
export async function getMeetingByHash(hash) {
  const memory = await loadMemory();
  return memory.meetings.find(m => m.hash === hash) || null;
}

export default { loadMemory, saveMemory, addMeeting, getMeetingByHash };
