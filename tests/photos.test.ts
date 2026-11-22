import { test, expect } from 'vitest';
import { fitWithin } from '../src/lib/photos';

test.each([
  [8160, 6120, 1280, { width: 1280, height: 960 }],
  [6120, 8160, 1280, { width: 960, height: 1280 }],
  [800, 600, 1280, { width: 800, height: 600 }],
  [1280, 1280, 320, { width: 320, height: 320 }],
])('fitWithin(%i, %i, %i)', (w, h, max, expected) => {
  expect(fitWithin(w, h, max)).toEqual(expected);
});
