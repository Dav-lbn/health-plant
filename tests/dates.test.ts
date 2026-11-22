import { describe, test, expect } from 'vitest';
import { todayLocal, daysBetween, parseAmount, formatDateFr } from '../src/lib/dates';

describe('todayLocal', () => {
  test('juste avant minuit reste le jour même', () => {
    expect(todayLocal(new Date(2026, 10, 22, 23, 59))).toBe('2026-11-22');
  });
  test('juste après minuit passe au lendemain', () => {
    expect(todayLocal(new Date(2026, 10, 23, 0, 1))).toBe('2026-11-23');
  });
});

describe('daysBetween', () => {
  test('compte les jours', () => {
    expect(daysBetween('2026-11-20', '2026-11-22')).toBe(2);
  });
  test('à travers le changement d’heure', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('parseAmount', () => {
  test.each([
    ['250', 250],
    [' 250,5 ', 250.5],
    ['', null],
    ['abc', null],
    ['-3', null],
    ['12abc', null],
  ])('%j → %j', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

test('formatDateFr', () => {
  expect(formatDateFr('2026-11-22')).toBe('22 nov. 2026');
});
