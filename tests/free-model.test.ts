import { describe, test, expect } from 'vitest';
import { rankModels, findFreeModel, toAiError } from '../src/lib/ai/provider';
import type { AnalysisProvider } from '../src/lib/ai/provider';
import { AiError } from '../src/lib/ai/parse';

describe('rankModels', () => {
  test('Gemini : flash stables récents, puis alias latest, puis lite, puis préversions', () => {
    expect(
      rankModels('gemini', [
        'gemini-3.0-flash-preview', 'gemini-flash-lite-latest', 'gemini-2.0-flash', 'gemini-2.5-flash-lite',
        'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3-flash',
      ]),
    ).toEqual([
      'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest',
      'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.0-flash-preview',
    ]);
  });
  test('Mistral : small, pixtral, puis le reste', () => {
    expect(rankModels('mistral', ['x', 'pixtral-12b-latest', 'mistral-small-latest'])).toEqual(['mistral-small-latest', 'pixtral-12b-latest', 'x']);
  });
});

function fake(byModel: Record<string, string | AiError>) {
  const tried: string[] = [];
  const provider: AnalysisProvider = {
    id: 'gemini',
    listModels: async () => Object.keys(byModel),
    generateJson: async ({ model }) => {
      tried.push(model);
      const r = byModel[model];
      if (r instanceof AiError) throw r;
      return r;
    },
  };
  return { provider, tried };
}

describe('findFreeModel', () => {
  test('saute les modèles sans quota gratuit', async () => {
    const { provider, tried } = fake({
      'gemini-3-flash': new AiError('payant'),
      'gemini-2.5-flash': new AiError('quota'),
      'gemini-flash-lite-latest': '{"ok":true}',
    });
    const r = await findFreeModel(provider, 'K', ['gemini-3-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest']);
    expect(r).toBe('gemini-flash-lite-latest');
    expect(tried).toEqual(['gemini-3-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest']);
  });

  test('clé refusée → arrêt immédiat', async () => {
    const { provider, tried } = fake({ a: new AiError('cle'), b: '{}' });
    await expect(findFreeModel(provider, 'K', ['a', 'b'])).rejects.toMatchObject({ kind: 'cle' });
    expect(tried).toEqual(['a']);
  });

  test('aucun modèle utilisable → null', async () => {
    const { provider } = fake({ a: new AiError('payant'), b: new AiError('modele') });
    expect(await findFreeModel(provider, 'K', ['a', 'b'])).toBeNull();
  });

  test('au plus 6 essais', async () => {
    const models = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`m${i}`, new AiError('quota')]));
    const { provider, tried } = fake(models);
    expect(await findFreeModel(provider, 'K', Object.keys(models))).toBeNull();
    expect(tried).toHaveLength(6);
  });
});

test('429 avec limite 0 → payant', () => {
  const e = toAiError(429, 'You exceeded your current quota... Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3-flash');
  expect(e.kind).toBe('payant');
  expect(e.message).toBe('Ce modèle n’est pas inclus dans l’offre gratuite. Dans les Réglages, touchez « Tester » pour en choisir un gratuit.');
});

test('429 ordinaire → quota', () => {
  expect(toAiError(429, 'Resource has been exhausted (e.g. check quota).').kind).toBe('quota');
});
