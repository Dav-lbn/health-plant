import { describe, test, expect } from 'vitest';
import { extractJson, parseDiagnosis, parseSpeciesSheet, AiError } from '../src/lib/ai/parse';
import { season } from '../src/lib/season';

test.each([
  ['2026-01-15', 'hiver'],
  ['2026-12-01', 'hiver'],
  ['2026-03-01', 'printemps'],
  ['2026-08-31', 'été'],
  ['2026-11-22', 'automne'],
])('season(%s) = %s', (d, s) => expect(season(d)).toBe(s));

describe('extractJson', () => {
  test('JSON pur', () => expect(extractJson('{"a":1}')).toEqual({ a: 1 }));
  test('bloc ```json', () => expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 }));
  test('texte autour', () => expect(extractJson('Voici : {"a":{"b":2}} fin')).toEqual({ a: { b: 2 } }));
  test('rien → AiError reponse', () => {
    try {
      extractJson('rien du tout');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AiError);
      expect((e as AiError).kind).toBe('reponse');
      expect((e as AiError).message).toBe('Réponse de l’IA illisible. Réessayez.');
    }
  });
});

describe('parseDiagnosis', () => {
  const full = {
    state: 'malade', summary: 'Feuilles jaunes', confidence: 0.82, trend: 'mieux', suggestedSpecies: 'Monstera deliciosa',
    problems: [{ name: 'Excès d’eau', cause: 'Arrosage trop fréquent', severity: 'forte' }],
    actions: [{ action: 'Espacer les arrosages', careType: 'arrosage', priority: 'haute', delayDays: 2 }],
    questions: [],
  };

  test('réponse complète conservée', () => {
    const r = parseDiagnosis(full);
    expect(r.state).toBe('malade');
    expect(r.confidence).toBe(0.82);
    expect(r.trend).toBe('mieux');
    expect(r.problems[0]).toEqual({ name: 'Excès d’eau', cause: 'Arrosage trop fréquent', severity: 'forte' });
    expect(r.actions[0]).toEqual({ action: 'Espacer les arrosages', careType: 'arrosage', priority: 'haute', delayDays: 2, doneAt: null });
    expect(r.suggestedSpecies).toBe('Monstera deliciosa');
  });

  test('valeurs hors liste normalisées', () => {
    const r = parseDiagnosis({
      state: 'excellent', confidence: 3, summary: 'x',
      problems: [{ name: 'p', cause: 'c', severity: 'énorme' }],
      actions: [{ action: 'a', careType: 'arroser', priority: 'urgente', delayDays: -2 }],
    });
    expect(r.state).toBe('surveiller');
    expect(r.confidence).toBe(1);
    expect(r.trend).toBe('inconnue');
    expect(r.problems[0].severity).toBe('moyenne');
    expect(r.actions[0]).toEqual({ action: 'a', careType: null, priority: 'moyenne', delayDays: 0, doneAt: null });
    expect(r.questions).toEqual([]);
    expect(r.suggestedSpecies).toBeNull();
  });

  test('confiance absente → 0.5, questions limitées à 3', () => {
    const r = parseDiagnosis({ summary: 's', questions: ['1', '2', '3', '4', '5'] });
    expect(r.confidence).toBe(0.5);
    expect(r.questions).toEqual(['1', '2', '3']);
  });

  test('réponse vide refusée', () => {
    expect(() => parseDiagnosis({})).toThrow(AiError);
    expect(() => parseDiagnosis(null)).toThrow(AiError);
  });
});

test('parseSpeciesSheet garde les fréquences valides', () => {
  const s = parseSpeciesSheet({
    species: 'Monstera deliciosa', light: 'Lumière vive', water: 'Quand la terre est sèche', humidity: '60 %',
    temperature: '18–27 °C', toxicity: 'Toxique pour chats et chiens', tips: ['Tuteurer'],
    frequencies: { arrosage: 7, engrais: 0, rempotage: 730, taille: 'souvent', traitement: 30.4 },
  });
  expect(s.species).toBe('Monstera deliciosa');
  expect(s.frequencies).toEqual({ arrosage: 7, traitement: 30 });
  expect(s.tips).toEqual(['Tuteurer']);
});
