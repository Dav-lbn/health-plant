import { test, expect } from 'vitest';
import { parseHash, toHash } from '../src/lib/router';

test('parseHash', () => {
  expect(parseHash('#/plante/abc')).toEqual({ name: 'plant', id: 'abc' });
  expect(parseHash('#/plante/abc/modifier')).toEqual({ name: 'plant-edit', id: 'abc' });
  expect(parseHash('#/nouvelle-plante')).toEqual({ name: 'plant-new' });
  expect(parseHash('#/reglages')).toEqual({ name: 'settings' });
  expect(parseHash('')).toEqual({ name: 'plants' });
  expect(parseHash('#/nimporte')).toEqual({ name: 'plants' });
});

test.each(['#/plante/abc', '#/plante/abc/modifier', '#/nouvelle-plante', '#/reglages', '#/'])(
  'aller-retour %s',
  (h) => {
    expect(toHash(parseHash(h))).toBe(h);
  },
);
