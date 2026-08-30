/**
 * TeamPulse Memory Utility
 * Handles persistent storage with atomic writes and schema versioning
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the TeamPulse config directory
 */
function getConfigDir() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
  return path.join(homeDir, '.teampulse');
}

/**
 * Ensure config directory exists with secure permissions
 */
async function ensureConfigDir() {
  const configDir = getConfigDir();
  
  try {
    await fs.promises.access(configDir, fs.constants.F_OK);
  } catch {
    await fs.promises.mkdir(configDir, { mode: 0o700, recursive: true });
  }
  
  return configDir;
}

/**
 * Memory schema version
 */
const MEMORY_SCHEMA_VERSION = 1;

/**
 * Default memory structure
 */
function createDefaultMemory() {
  return {
    _version: MEMORY_SCHEMA_VERSION,
    _createdAt: new Date().toISOString(),
    _updatedAt: new Date().toISOString(),
    sessions: [],
    preferences: {
      defaultProvider: 'gemini',
      defaultModel: 'gemini-2.0-flash',
      streamingEnabled: true,
      maxContextLength: 10,
    },
    cache: {},
    metadata: {},
  };
}

/**
 * Validate memory schema
 */
function validateMemorySchema(memory) {
  if (!memory || typeof memory !== 'object') {
    return { valid: false, error: 'Memory is not an object' };
  }

  if (memory._version !== MEMORY_SCHEMA_VERSION) {
    return { 
      valid: false, 
      error: `Schema version mismatch. Expected ${MEMORY_SCHEMA_VERSION}, got ${memory._version || 'undefined'}`,
      needsMigration: true 
    };
  }

  const requiredFields = ['_version', '_createdAt', '_updatedAt', 'sessions', 'preferences'];
  for (const field of requiredFields) {
    if (!(field in memory)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  return { valid: true };
}

/**
 * Migrate memory from older schema versions
 */
function migrateMemory(memory) {
  const currentVersion = memory._version || 0;
  
  if (currentVersion >= MEMORY_SCHEMA_VERSION) {
    return memory;
  }

  console.log(`Migrating memory from version ${currentVersion} to ${MEMORY_SCHEMA_VERSION}`);
  
  let migrated = { ...memory };

  if (currentVersion < 1) {
    migrated = {
      ...migrated,
      _version: 1,
      _createdAt: migrated._createdAt || new Date().toISOString(),
      _updatedAt: new Date().toISOString(),
      sessions: migrated.sessions || [],
      preferences: {
        defaultProvider: 'gemini',
        defaultModel: 'gemini-2.0-flash',
        streamingEnabled: true,
        maxContextLength: 10,
        ...migrated.preferences,
      },
      cache: migrated.cache || {},
      metadata: migrated.metadata || {},
    };
  }

  return migrated;
}

/**
 * Load memory from disk with validation
 */
export async function loadMemory() {
  try {
    const configDir = await ensureConfigDir();
    const memoryPath = path.join(configDir, 'memory.json');
    
    try {
      await fs.promises.access(memoryPath, fs.constants.F_OK);
    } catch {
      console.log('Creating new memory file');
      return createDefaultMemory();
    }

    const content = await fs.promises.readFile(memoryPath, 'utf-8');
    const memory = JSON.parse(content);

    const validation = validateMemorySchema(memory);
    
    if (!validation.valid) {
      if (validation.needsMigration) {
        console.warn('Memory schema needs migration');
        const migrated = migrateMemory(memory);
        const updatedValidation = validateMemorySchema(migrated);
        if (!updatedValidation.valid) {
          console.error('Migration failed, using default memory');
          return createDefaultMemory();
        }
        return migrated;
      } else {
        console.error('Invalid memory schema:', validation.error);
        return createDefaultMemory();
      }
    }

    return memory;
  } catch (error) {
    console.error('Error loading memory:', error.message);
    return createDefaultMemory();
  }
}

/**
 * Save memory to disk with atomic write
 */
export async function saveMemory(memory) {
  try {
    const configDir = await ensureConfigDir();
    const memoryPath = path.join(configDir, 'memory.json');
    const tempPath = path.join(configDir, 'memory.json.tmp');

    memory._updatedAt = new Date().toISOString();
    memory._version = MEMORY_SCHEMA_VERSION;

    const validation = validateMemorySchema(memory);
    if (!validation.valid) {
      throw new Error(`Invalid memory schema: ${validation.error}`);
    }

    const content = JSON.stringify(memory, null, 2);
    await fs.promises.writeFile(tempPath, content, { 
      encoding: 'utf-8',
      mode: 0o600,
    });

    await fs.promises.rename(tempPath, memoryPath);

    try {
      await fs.promises.chmod(memoryPath, 0o600);
    } catch (chmodError) {
      if (process.platform !== 'win32') {
        console.warn('Warning: Could not set file permissions:', chmodError.message);
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving memory:', error.message);
    
    try {
      const configDir = await ensureConfigDir();
      const tempPath = path.join(configDir, 'memory.json.tmp');
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    
    throw error;
  }
}

/**
 * Update memory with partial changes
 */
export async function updateMemory(updates) {
  const memory = await loadMemory();
  
  const updated = {
    ...memory,
    ...updates,
    preferences: {
      ...memory.preferences,
      ...(updates.preferences || {}),
    },
    cache: {
      ...memory.cache,
      ...(updates.cache || {}),
    },
    metadata: {
      ...memory.metadata,
      ...(updates.metadata || {}),
    },
  };

  if (updates.sessions) {
    updated.sessions = [...memory.sessions, ...updates.sessions];
  }

  await saveMemory(updated);
  return updated;
}

/**
 * Get a specific session by ID
 */
export function getSessionById(memory, sessionId) {
  return memory.sessions.find(s => s.id === sessionId);
}

/**
 * Add or update a session
 */
export async function addOrUpdateSession(sessionData) {
  const memory = await loadMemory();
  
  const existingIndex = memory.sessions.findIndex(s => s.id === sessionData.id);
  
  if (existingIndex >= 0) {
    memory.sessions[existingIndex] = {
      ...memory.sessions[existingIndex],
      ...sessionData,
      updatedAt: new Date().toISOString(),
    };
  } else {
    memory.sessions.push({
      ...sessionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  await saveMemory(memory);
  return memory;
}

/**
 * Clear old sessions (older than maxAge days)
 */
export async function clearOldSessions(maxAge = 30) {
  const memory = await loadMemory();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAge);

  const filteredSessions = memory.sessions.filter(session => {
    const sessionDate = new Date(session.updatedAt || session.createdAt);
    return sessionDate > cutoff;
  });

  if (filteredSessions.length !== memory.sessions.length) {
    memory.sessions = filteredSessions;
    await saveMemory(memory);
    console.log(`Cleared ${memory.sessions.length - filteredSessions.length} old sessions`);
  }

  return memory;
}

/**
 * Get cache entry by key
 */
export function getCacheEntry(memory, key) {
  return memory.cache[key];
}

/**
 * Set cache entry with optional TTL
 */
export async function setCacheEntry(key, value, ttlMs = null) {
  const memory = await loadMemory();
  
  memory.cache[key] = {
    value,
    createdAt: new Date().toISOString(),
    ttlMs,
    expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
  };

  await saveMemory(memory);
  return memory;
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache() {
  const memory = await loadMemory();
  const now = new Date();

  const activeCache = {};
  for (const [key, entry] of Object.entries(memory.cache)) {
    if (!entry.expiresAt || new Date(entry.expiresAt) > now) {
      activeCache[key] = entry;
    }
  }

  if (Object.keys(activeCache).length !== Object.keys(memory.cache).length) {
    memory.cache = activeCache;
    await saveMemory(memory);
    console.log(`Cleared ${Object.keys(memory.cache).length - Object.keys(activeCache).length} expired cache entries`);
  }

  return memory;
}

export default {
  loadMemory,
  saveMemory,
  updateMemory,
  getSessionById,
  addOrUpdateSession,
  clearOldSessions,
  getCacheEntry,
  setCacheEntry,
  clearExpiredCache,
  MEMORY_SCHEMA_VERSION,
  createDefaultMemory,
};
