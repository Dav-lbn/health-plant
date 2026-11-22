import { afterEach, describe, test, expect, vi } from 'vitest';
import { gemini } from '../src/lib/ai/gemini';
import { mistral } from '../src/lib/ai/mistral';
import { toAiError, pickDefaultModel, setRetryDelays } from '../src/lib/ai/provider';
import { AiError } from '../src/lib/ai/parse';

const img = { mimeType: 'image/jpeg', base64: 'AAAA' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

setRetryDelays([0, 0]);
afterEach(() => vi.unstubAllGlobals());

describe('Gemini', () => {
  test('generateJson construit la bonne requête', async () => {
    const f = vi.fn(async () => json({ candidates: [{ content: { parts: [{ text: '{"a":' }, { text: '1}' }] } }] }));
    vi.stubGlobal('fetch', f);
    const out = await gemini.generateJson({ key: 'K', model: 'gemini-x-flash', prompt: 'P', images: [img] });
    expect(out).toBe('{"a":1}');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x-flash:generateContent');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('K');
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe('P');
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'AAAA' });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  test('listModels filtre les modèles utilisables', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-2.0-flash-live', supportedGenerationMethods: ['bidiGenerateContent'] },
      ],
    })));
    expect(await gemini.listModels('K')).toEqual(['gemini-2.5-flash']);
  });
});

describe('Mistral', () => {
  test('generateJson via relais', async () => {
    const f = vi.fn(async () => json({ choices: [{ message: { content: '{"ok":true}' } }] }));
    vi.stubGlobal('fetch', f);
    const out = await mistral('https://relais.example/').generateJson({ key: 'K', model: 'mistral-small-latest', prompt: 'P', images: [img] });
    expect(out).toBe('{"ok":true}');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://relais.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer K');
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content[0]).toEqual({ type: 'text', text: 'P' });
    expect(body.messages[0].content[1].image_url).toBe('data:image/jpeg;base64,AAAA');
  });

  test('listModels garde les modèles avec vision', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      data: [
        { id: 'mistral-small-latest', capabilities: { vision: true } },
        { id: 'codestral-latest', capabilities: { vision: false } },
        { id: 'pixtral-12b-latest', capabilities: { vision: true } },
      ],
    })));
    expect(await mistral('https://api.mistral.ai').listModels('K')).toEqual(['mistral-small-latest', 'pixtral-12b-latest']);
  });
});

describe('erreurs', () => {
  test.each([
    [401, 'cle'], [403, 'cle'], [404, 'modele'], [429, 'quota'], [500, 'surcharge'], [503, 'surcharge'], [413, 'reponse'],
  ])('HTTP %i → %s', (status, kind) => {
    expect(toAiError(status).kind).toBe(kind);
  });

  test('HTTP 400 clé invalide → cle', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400)));
    await expect(gemini.listModels('K')).rejects.toMatchObject({ kind: 'cle' });
  });

  test('fetch rejeté → reseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const err = await gemini.generateJson({ key: 'K', model: 'm', prompt: 'P', images: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.kind).toBe('reseau');
  });

  test('HTTP 429 → quota', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: {} }, 429)));
    await expect(mistral('https://api.mistral.ai').generateJson({ key: 'K', model: 'm', prompt: 'P', images: [] })).rejects.toMatchObject({ kind: 'quota' });
  });
});

describe('pickDefaultModel', () => {
  test('Gemini : flash stable le plus récent', () => {
    expect(pickDefaultModel('gemini', ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-3.0-flash-preview', 'gemini-2.5-flash'])).toBe('gemini-2.5-flash');
    expect(pickDefaultModel('gemini', ['gemini-3-flash', 'gemini-2.5-flash'])).toBe('gemini-3-flash');
    expect(pickDefaultModel('gemini', ['gemini-3.0-flash-preview'])).toBe('gemini-3.0-flash-preview');
  });
  test('Mistral : small en priorité', () => {
    expect(pickDefaultModel('mistral', ['pixtral-12b-latest', 'mistral-small-latest'])).toBe('mistral-small-latest');
    expect(pickDefaultModel('mistral', ['pixtral-12b-latest', 'x'])).toBe('pixtral-12b-latest');
  });
  test('liste vide → null', () => expect(pickDefaultModel('gemini', [])).toBeNull());
});

describe('surcharge et détails', () => {
  test('503 répété → surcharge avec détail, 3 tentatives', async () => {
    const f = vi.fn(async () => json({ error: { message: 'The model is overloaded. Please try again later.' } }, 503));
    vi.stubGlobal('fetch', f);
    const err = await gemini.generateJson({ key: 'K', model: 'm', prompt: 'P', images: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.kind).toBe('surcharge');
    expect(err.message).toBe('L’IA est surchargée pour le moment. Réessayez dans quelques instants.');
    expect(err.detail).toBe('HTTP 503 — The model is overloaded. Please try again later.');
    expect(f).toHaveBeenCalledTimes(3);
  });

  test('503 puis succès → réponse renvoyée', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: 'overloaded' } }, 503))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }));
    vi.stubGlobal('fetch', f);
    expect(await gemini.generateJson({ key: 'K', model: 'm', prompt: 'P', images: [] })).toBe('{"a":1}');
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('429 non réessayé, détail conservé', async () => {
    const f = vi.fn(async () => json({ error: { message: 'Resource has been exhausted' } }, 429));
    vi.stubGlobal('fetch', f);
    const err = await gemini.generateJson({ key: 'K', model: 'm', prompt: 'P', images: [] }).catch((e) => e);
    expect(err.kind).toBe('quota');
    expect(err.detail).toBe('HTTP 429 — Resource has been exhausted');
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('erreur réseau : détail technique', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const err = await gemini.listModels('K').catch((e) => e);
    expect(err.kind).toBe('reseau');
    expect(err.detail).toBe('TypeError: Failed to fetch');
  });

  test('400 autre → reponse avec détail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { message: 'Request payload size exceeds the limit' } }, 400)));
    const err = await gemini.generateJson({ key: 'K', model: 'm', prompt: 'P', images: [] }).catch((e) => e);
    expect(err.kind).toBe('requete');
    expect(err.detail).toBe('HTTP 400 — Request payload size exceeds the limit');
  });
});
