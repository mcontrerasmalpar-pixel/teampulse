// @ts-check
import { test, expect } from 'vitest';
import { parseJSON } from '../src/utils/parseJSON.js';

test('parseJSON: JSON directo', () => {
  const input = '{"a":1,"b":[2,3]}';
  const out = parseJSON(input);
  expect(out).toEqual({ a: 1, b: [2, 3] });
});

test('parseJSON: fenced json', () => {
  const input = 'Aqui va el JSON:\n\n```json\n{"x":1}\n```\nFin.';
  const out = parseJSON(input);
  expect(out).toEqual({ x: 1 });
});

test('parseJSON: JSON con prosa alrededor', () => {
  const input = 'Respuesta:\n{"summary":"OK","tasks":[]}\nEspero que sirva.';
  const out = parseJSON(input);
  expect(out.summary).toBe('OK');
  expect(out.tasks).toEqual([]);
});

test('parseJSON: error en entrada vacia', () => {
  expect(() => parseJSON('')).toThrow(/Entrada vacia/);
});

test('parseJSON: error en texto sin JSON', () => {
  expect(() => parseJSON('Hola mundo')).toThrow(/No se pudo extraer JSON/);
});
