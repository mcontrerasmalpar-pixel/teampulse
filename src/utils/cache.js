// @ts-check
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const CACHE_DIR = join(process.env.HOME || process.env.USERPROFILE || '.', '.teampulse', 'cache');

/**
 * @param {Buffer|string} content
 * @returns {Promise<string>}
 */
export async function hashFile(content) {
  const hash = createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true, mode: 0o700 });
  } catch {
    // ya existe
  }
}

/**
 * @param {string} hash
 * @returns {Promise<any | null>}
 */
export async function getCache(hash) {
  await ensureCacheDir();
  const path = join(CACHE_DIR, `${hash}.json`);
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * @param {string} hash
 * @param {any} data
 * @returns {Promise<void>}
 */
export async function saveCache(hash, data) {
  await ensureCacheDir();
  const path = join(CACHE_DIR, `${hash}.json`);
  const tempPath = `${path}.tmp.${process.pid}.${Date.now()}`;
  const payload = JSON.stringify(data, null, 2);

  await fs.writeFile(tempPath, payload, { encoding: 'utf-8', mode: 0o600 });
  await fs.rename(tempPath, path);
}

export default { hashFile, getCache, saveCache };
