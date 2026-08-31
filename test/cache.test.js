// @ts-check
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hashFile } from '../src/utils/cache.js';

test('hashFile: mismo contenido produce mismo hash', async () => {
  const h1 = await hashFile('contenido de prueba');
  const h2 = await hashFile('contenido de prueba');
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
});

test('hashFile: contenido distinto produce hash distinto', async () => {
  const h1 = await hashFile('contenido A');
  const h2 = await hashFile('contenido B');
  assert.notEqual(h1, h2);
});
