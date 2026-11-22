import { test, expect } from 'vitest';
import { parseHash, toHash } from '../src/lib/router';

test('parseHash', () => {
  expect(parseHash('#/plante/abc')).toEqual({ name: 'plant', id: 'abc' });
  expect(parseHash('#/plante/abc/modifier')).toEqual({ name: 'plant-edit', id: 'abc' });
  expect(parseHash('#/nouvelle-plante')).toEqual({ name: 'plant-new' });
  expect(parseHash('#/reglages')).toEqual({ name: 'settings' });
  expect(parseHash('')).toEqual({ name: 'today' });
  expect(parseHash('#/')).toEqual({ name: 'today' });
  expect(parseHash('#/plantes')).toEqual({ name: 'plants' });
  expect(parseHash('#/nimporte')).toEqual({ name: 'today' });
});

test.each(['#/plante/abc', '#/plante/abc/modifier', '#/nouvelle-plante', '#/reglages', '#/', '#/plantes'])(
  'aller-retour %s',
  (h) => {
    expect(toHash(parseHash(h))).toBe(h);
  },
);

test('routes de diagnostic', () => {
  expect(parseHash('#/plante/abc/diagnostic')).toEqual({ name: 'diagnose', id: 'abc' });
  expect(parseHash('#/plante/abc/diagnostic/d1')).toEqual({ name: 'diagnosis', id: 'abc', diagId: 'd1' });
  for (const h of ['#/plante/abc/diagnostic', '#/plante/abc/diagnostic/d1']) expect(toHash(parseHash(h))).toBe(h);
});
