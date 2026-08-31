// @ts-check
import { test, expect } from 'vitest';
import { hashFile } from '../src/utils/cache.js';

test('hashFile: mismo contenido produce mismo hash', async () => {
  const h1 = await hashFile('contenido de prueba');
  const h2 = await hashFile('contenido de prueba');
  expect(h1).toBe(h2);
  expect(h1.length).toBe(64);
});

test('hashFile: contenido distinto produce hash distinto', async () => {
  const h1 = await hashFile('contenido A');
  const h2 = await hashFile('contenido B');
  expect(h1).not.toBe(h2);
});
