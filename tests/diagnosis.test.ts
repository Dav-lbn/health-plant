// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, test, expect } from 'vitest';
import { db } from '../src/lib/db';
import { createPlant, getPlant, listCare, logCare, getDiagnosis } from '../src/lib/repo';
import { startDiagnosis, runDiagnosis, answerQuestions, markActionDone, generateSpeciesSheet } from '../src/lib/diagnosis';
import type { AnalysisProvider, GenerateOptions } from '../src/lib/ai/provider';
import { AiError } from '../src/lib/ai/parse';
import { defaultAiSettings } from '../src/lib/ai/settings';
import type { Photo } from '../src/lib/types';

const settings = { ...defaultAiSettings(), gemini: { key: 'K', model: 'gemini-test' } };

function fakeProvider(...responses: (string | AiError)[]) {
  const calls: GenerateOptions[] = [];
  const provider: AnalysisProvider = {
    id: 'gemini',
    listModels: async () => [],
    generateJson: async (opts) => {
      calls.push(opts);
      const r = responses[Math.min(calls.length - 1, responses.length - 1)];
      if (r instanceof AiError) throw r;
      return r;
    },
  };
  return { provider, calls };
}

const RESULT_OK = JSON.stringify({
  state: 'malade', summary: 'Excès d’eau', confidence: 0.85, trend: 'inconnue',
  problems: [{ name: 'Pourriture', cause: 'Trop d’eau', severity: 'forte' }],
  actions: [
    { action: 'Arroser légèrement', careType: 'arrosage', priority: 'haute', delayDays: 0 },
    { action: 'Déplacer près de la fenêtre', careType: null, priority: 'basse', delayDays: 3 },
  ],
  questions: [],
});
const RESULT_UNSURE = JSON.stringify({ state: 'surveiller', summary: 'Incertain', confidence: 0.4, questions: ['La terre est-elle humide ?', 'Y a-t-il des insectes ?'] });

const storePhoto = async (plantId: string, file: Blob): Promise<Photo> => {
  const photo = { id: crypto.randomUUID(), plantId, blob: file, thumb: file, takenAt: new Date().toISOString() };
  await db.photos.add(photo);
  return photo;
};
const jpeg = () => new Blob([new Uint8Array([255, 216, 255, 1, 2, 3])], { type: 'image/jpeg' });

async function plant() {
  return createPlant({ name: 'Monstera', species: null, roomId: null, exposure: 'mi-ombre', waterAmountMl: 250, notes: '', photoId: null, careFrequencyDays: { arrosage: 10 } });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('diagnostic', () => {
  test('startDiagnosis avec 2 photos → terminé', async () => {
    const p = await plant();
    const { provider, calls } = fakeProvider(RESULT_OK);
    const d = await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }, { kind: 'dessous', file: jpeg() }], 'gemini', { settings, providerOverride: provider, storePhoto });
    expect(d.status).toBe('termine');
    expect(d.photoIds).toHaveLength(2);
    expect(d.photoKinds).toEqual(['ensemble', 'dessous']);
    expect(d.provider).toBe('gemini');
    expect(d.model).toBe('gemini-test');
    expect(d.result?.state).toBe('malade');
    expect(calls[0].images).toHaveLength(2);
    expect(calls[0].images[0].mimeType).toBe('image/jpeg');
    expect(calls[0].prompt).toContain('Monstera');
    expect((await getDiagnosis(d.id))?.status).toBe('termine');
  });

  test('confiance basse → questions, puis réponses → terminé', async () => {
    const p = await plant();
    const { provider, calls } = fakeProvider(RESULT_UNSURE, RESULT_UNSURE);
    const d = await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }], 'gemini', { settings, providerOverride: provider, storePhoto });
    expect(d.status).toBe('questions');
    expect(d.result?.questions).toHaveLength(2);
    const d2 = await answerQuestions(d.id, [{ question: 'La terre est-elle humide ?', answer: 'Oui' }], { settings, providerOverride: provider });
    expect(d2.status).toBe('termine');
    expect(d2.answers).toEqual([{ question: 'La terre est-elle humide ?', answer: 'Oui' }]);
    expect(calls[1].prompt).toContain('La terre est-elle humide ? → Oui');
  });

  test('diagnostic précédent → photo précédente ajoutée', async () => {
    const p = await plant();
    const { provider, calls } = fakeProvider(RESULT_OK);
    await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }], 'gemini', { settings, providerOverride: provider, storePhoto });
    await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }], 'gemini', { settings, providerOverride: provider, storePhoto });
    expect(calls[1].images).toHaveLength(2);
    expect(calls[1].prompt).toContain('photo précédente');
    expect(calls[1].prompt).toContain('Excès d’eau');
  });

  test('erreur quota → statut erreur, photos gardées, relance OK', async () => {
    const p = await plant();
    const bad = fakeProvider(new AiError('quota'));
    const d = await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }], 'gemini', { settings, providerOverride: bad.provider, storePhoto });
    expect(d.status).toBe('erreur');
    expect(d.error).toBe('Quota gratuit atteint. Réessayez plus tard ou changez d’IA.');
    expect(await db.photos.count()).toBe(1);
    const good = fakeProvider(RESULT_OK);
    const d2 = await runDiagnosis(d.id, { settings, providerOverride: good.provider });
    expect(d2.status).toBe('termine');
    expect(d2.error).toBeNull();
  });

  test('clé absente → erreur clé, sans appel', async () => {
    const p = await plant();
    const d = await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }], 'mistral', { settings, storePhoto });
    expect(d.status).toBe('erreur');
    expect(d.error).toContain('Clé API');
  });

  test('réponse illisible → erreur reponse', async () => {
    const p = await plant();
    const { provider } = fakeProvider('pas du json');
    const d = await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }], 'gemini', { settings, providerOverride: provider, storePhoto });
    expect(d.status).toBe('erreur');
    expect(d.error).toContain('illisible');
  });

  test('markActionDone : arrosage enregistré, action sans type sans soin', async () => {
    const p = await plant();
    const { provider } = fakeProvider(RESULT_OK);
    const d = await startDiagnosis(p.id, [{ kind: 'ensemble', file: jpeg() }], 'gemini', { settings, providerOverride: provider, storePhoto });
    await markActionDone(d.id, 0);
    await markActionDone(d.id, 1);
    const saved = await getDiagnosis(d.id);
    expect(saved?.result?.actions[0].doneAt).toBeTruthy();
    expect(saved?.result?.actions[1].doneAt).toBeTruthy();
    const care = await listCare(p.id);
    expect(care).toHaveLength(1);
    expect(care[0].type).toBe('arrosage');
    expect(care[0].amountMl).toBe(250);
    expect(care[0].notes).toBe('Arroser légèrement');
  });
});

describe('fiche d’espèce', () => {
  test('complète espèce et fréquences vides seulement', async () => {
    const p = await plant();
    await logCare({ plantId: p.id, type: 'arrosage', date: '2026-11-20', amountMl: 200, notes: '' });
    const { provider, calls } = fakeProvider(JSON.stringify({
      species: 'Monstera deliciosa', light: 'Vive', water: 'Modéré', humidity: '60 %', temperature: '18–27 °C',
      toxicity: 'Toxique pour les animaux', tips: ['Tuteurer'], frequencies: { arrosage: 7, engrais: 30 },
    }));
    const sheet = await generateSpeciesSheet(p.id, { settings, providerOverride: provider });
    expect(sheet.species).toBe('Monstera deliciosa');
    expect(sheet.provider).toBe('gemini');
    const saved = await getPlant(p.id);
    expect(saved?.species).toBe('Monstera deliciosa');
    expect(saved?.careFrequencyDays).toEqual({ arrosage: 10, engrais: 30 });
    expect(saved?.speciesSheet?.toxicity).toBe('Toxique pour les animaux');
    expect(calls[0].images).toHaveLength(0);
  });
});
