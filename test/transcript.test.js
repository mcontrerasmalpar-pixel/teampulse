// @ts-check
import { test, expect } from 'vitest';
import { normalizeTranscript } from '../src/utils/transcript.js';

test('normalizeTranscript: srt elimina timestamps', () => {
  const input = `1\n00:00:01,000 --> 00:00:04,000\nHola a todos\n\n2\n00:00:05,200 --> 00:00:08,000\nBienvenidos`;
  const out = normalizeTranscript(input, 'srt');
  expect(out.includes('00:00:01,000')).toBe(false);
  expect(out.includes('Hola a todos')).toBe(true);
});

test('normalizeTranscript: vtt elimina cabecera y timestamps', () => {
  const input = `WEBVTT\nKind: captions\nLanguage: es\n\n00:00:01.000 --> 00:00:03.000\nInicio de reunion`;
  const out = normalizeTranscript(input, 'vtt');
  expect(out.includes('WEBVTT')).toBe(false);
  expect(out.includes('Inicio de reunion')).toBe(true);
});

test('normalizeTranscript: txt normaliza saltos de linea', () => {
  const out = normalizeTranscript('Hola\n\n\nMundo', 'txt');
  expect(out).toBe('Hola\n\nMundo');
});
