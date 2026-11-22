import { beforeEach, test, expect } from 'vitest';
import { db } from '../src/lib/db';
import { loadAiSettings, saveAiSettings, providerFor } from '../src/lib/ai/settings';

beforeEach(async () => { await db.meta.clear(); });

test('défauts au premier chargement', async () => {
  expect(await loadAiSettings()).toEqual({
    defaultProvider: 'gemini',
    gemini: { key: '', model: '' },
    mistral: { key: '', model: '', base: 'https://api.mistral.ai' },
  });
});

test('aller-retour', async () => {
  const s = await loadAiSettings();
  s.defaultProvider = 'mistral';
  s.mistral.key = 'MK';
  s.mistral.model = 'mistral-small-latest';
  await saveAiSettings(s);
  expect(await loadAiSettings()).toEqual(s);
});

test('providerFor refuse clé ou modèle vide', async () => {
  const s = await loadAiSettings();
  expect(() => providerFor('gemini', s)).toThrow('Clé API refusée');
  s.gemini.key = 'K';
  expect(() => providerFor('gemini', s)).toThrow('Modèle indisponible');
  s.gemini.model = 'gemini-2.5-flash';
  const r = providerFor('gemini', s);
  expect(r.provider.id).toBe('gemini');
  expect(r.key).toBe('K');
});
