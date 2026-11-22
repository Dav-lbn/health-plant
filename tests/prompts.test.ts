import { test, expect } from 'vitest';
import { buildDiagnosisPrompt, buildSpeciesPrompt } from '../src/lib/ai/prompts';
import type { DiagnosisContext } from '../src/lib/ai/prompts';

const ctx: DiagnosisContext = {
  plantName: 'Monstera du salon', species: 'Monstera deliciosa', exposure: 'mi-ombre', waterAmountMl: 300,
  recentCare: [{ type: 'arrosage', date: '2026-11-18' }], today: '2026-11-22', previous: null,
  photoKinds: ['ensemble', 'dessous'], hasPreviousPhoto: false, answers: [],
};

test('le prompt contient le contexte', () => {
  const p = buildDiagnosisPrompt(ctx);
  expect(p).toContain('Monstera du salon');
  expect(p).toContain('Monstera deliciosa');
  expect(p).toContain('Mi-ombre');
  expect(p).toContain('automne');
  expect(p).toContain('300 mL');
  expect(p).toContain('2026-11-18');
  expect(p).toContain('Dessous des feuilles');
  expect(p).not.toContain('photo précédente');
});

test('réponses et photo précédente', () => {
  const p = buildDiagnosisPrompt({
    ...ctx, hasPreviousPhoto: true,
    previous: { date: '2026-11-01', summary: 'Quelques taches', state: 'surveiller' },
    answers: [{ question: 'La terre est-elle humide ?', answer: 'Oui' }],
  });
  expect(p).toContain('photo précédente');
  expect(p).toContain('Quelques taches');
  expect(p).toContain('La terre est-elle humide ?');
  expect(p).toContain('Oui');
});

test('prompt fiche d’espèce', () => {
  const p = buildSpeciesPrompt('Monstera', null);
  expect(p).toContain('Monstera');
  expect(p).toContain('toxicity');
});
