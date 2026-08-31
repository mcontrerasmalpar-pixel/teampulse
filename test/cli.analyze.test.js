// @ts-check
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { detectTranscriptFormat, normalizeTranscript } from '../src/utils/transcript.js';
import { fixtureAnalyze } from '../src/eval/fixture.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/standup.srt');

describe('CLI analyze fixtures', () => {
  it('detects srt and strips timestamps before fixture extract', async () => {
    const raw = await readFile(fixture, 'utf-8');
    expect(detectTranscriptFormat(fixture)).toBe('srt');
    const normalized = normalizeTranscript(raw, 'srt');
    expect(normalized).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(normalized).toContain('TASK: Fix production bug');

    const analysis = fixtureAnalyze(normalized);
    expect(analysis.tasks[0].title).toBe('Fix production bug');
    expect(analysis.tasks[0].owner).toBe('alice');
    expect(analysis.decisions[0].title).toBe('Adopt new CI/CD pipeline');
    expect(analysis.risks[0].title).toBe('Dependency delay from vendor');
  });
});
