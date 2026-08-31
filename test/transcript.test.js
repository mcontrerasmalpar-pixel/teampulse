// @ts-check
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeTranscript } from '../src/utils/transcript.js';

test('normalizeTranscript: srt elimina timestamps', () => {
  const input = `1
00:00:01,000 --> 00:00:04,000
Hola a todos

2
00:00:05,200 --> 00:00:08,000
Bienvenidos`;
  const out = normalizeTranscript(input, 'srt');
  assert.ok(!out.includes('00:00:01,000'));
  assert.ok(!out.includes('00:00:05,200'));
  assert.ok(out.includes('Hola a todos'));
  assert.ok(out.includes('Bienvenidos'));
});

test('normalizeTranscript: vtt elimina cabecera y timestamps', () => {
  const input = `WEBVTT
Kind: captions
Language: es

00:00:01.000 --> 00:00:03.000
Inicio de reunion

00:00:04.500 --> 00:00:07.000
Segundo bloque`;
  const out = normalizeTranscript(input, 'vtt');
  assert.ok(!out.includes('WEBVTT'));
  assert.ok(!out.includes('00:00:01.000'));
  assert.ok(out.includes('Inicio de reunion'));
  assert.ok(out.includes('Segundo bloque'));
});

test('normalizeTranscript: txt normaliza saltos de linea', () => {
  const input = 'Hola\n\n\nMundo';
  const out = normalizeTranscript(input, 'txt');
  assert.equal(out, 'Hola\n\nMundo');
});
