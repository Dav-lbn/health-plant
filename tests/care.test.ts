import { test, expect } from 'vitest';
import { daysSinceLast, buildTimeline } from '../src/lib/care';
import type { CareEvent, Photo } from '../src/lib/types';

const ev = (id: string, type: CareEvent['type'], date: string): CareEvent => ({
  id, plantId: 'p', type, date, amountMl: null, notes: '', createdAt: `${date}T10:00:00Z`,
});
const ph = (id: string, takenAt: string): Photo => ({
  id, plantId: 'p', blob: new Blob(), thumb: new Blob(), takenAt,
});

test('daysSinceLast sans soin → null', () => {
  expect(daysSinceLast([], 'arrosage', '2026-11-22')).toBeNull();
});

test('daysSinceLast prend le plus récent du bon type', () => {
  const events = [ev('a', 'arrosage', '2026-11-15'), ev('b', 'arrosage', '2026-11-20'), ev('c', 'engrais', '2026-11-22')];
  expect(daysSinceLast(events, 'arrosage', '2026-11-22')).toBe(2);
  expect(daysSinceLast(events, 'taille', '2026-11-22')).toBeNull();
});

test('buildTimeline trie décroissant, soins avant photos à date égale', () => {
  const items = buildTimeline(
    [ev('a', 'arrosage', '2026-11-15'), ev('b', 'engrais', '2026-11-20')],
    [ph('x', '2026-11-20T08:00:00Z'), ph('y', '2026-11-18T08:00:00Z')],
  );
  expect(items.map((i) => (i.kind === 'care' ? i.event.id : i.photo.id))).toEqual(['b', 'x', 'y', 'a']);
  expect(items[1].date).toBe('2026-11-20');
});
