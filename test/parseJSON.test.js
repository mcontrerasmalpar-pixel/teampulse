// @ts-check
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseJSON } from '../src/utils/parseJSON.js';

test('parseJSON: JSON directo', () => {
  const input = '{"a":1,"b":[2,3]}';
  const out = parseJSON(input);
  assert.deepEqual(out, { a: 1, b: [2, 3] });
});

test('parseJSON: fenced json', () => {
  const input = 'Aqui va el JSON:\n\n```json\n{"x":1}\n```\nFin.';
  const out = parseJSON(input);
  assert.deepEqual(out, { x: 1 });
});

test('parseJSON: JSON con prosa alrededor', () => {
  const input = 'Respuesta:\n{"summary":"OK","tasks":[]}\nEspero que sirva.';
  const out = parseJSON(input);
  assert.equal(out.summary, 'OK');
  assert.deepEqual(out.tasks, []);
});

test('parseJSON: error en entrada vacia', () => {
  assert.throws(() => parseJSON(''), /Entrada vacia/);
});

test('parseJSON: error en texto sin JSON', () => {
  assert.throws(() => parseJSON('Hola mundo'), /No se pudo extraer JSON/);
});
