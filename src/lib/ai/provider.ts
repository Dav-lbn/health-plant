import { AiError } from './parse';
import type { ProviderId } from '../types';

export interface AiImage {
  mimeType: string;
  base64: string;
}

export interface GenerateOptions {
  key: string;
  model: string;
  prompt: string;
  images: AiImage[];
}

export interface AnalysisProvider {
  id: ProviderId;
  listModels(key: string): Promise<string[]>;
  generateJson(opts: GenerateOptions): Promise<string>;
}

export function toAiError(status: number, message = ''): AiError {
  const detail = `HTTP ${status}${message ? ` — ${message}` : ''}`;
  if (status === 401 || status === 403) return new AiError('cle', detail);
  if (status === 400 && /api.?key|unauthori[sz]ed|invalid.*key/i.test(message)) return new AiError('cle', detail);
  if (status === 404) return new AiError('modele', detail);
  if (status === 429) return new AiError(/limit:\s*0\b/.test(message) ? 'payant' : 'quota', detail);
  if (status >= 500) return new AiError('surcharge', detail);
  if (status === 400) return new AiError('requete', detail);
  return new AiError('reponse', detail);
}

let retryDelays = [1500, 4000];
/** Délais entre les tentatives après une surcharge (tests : [0, 0]). */
export function setRetryDelays(d: number[]): void {
  retryDelays = d;
}

async function once(url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new AiError('reseau', e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }
  if (!res.ok) {
    let message = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } | string; message?: string };
      message = typeof body.error === 'string' ? body.error : (body.error?.message ?? body.message ?? '');
    } catch {
      /* corps illisible */
    }
    throw toAiError(res.status, message.trim().slice(0, 800));
  }
  try {
    return await res.json();
  } catch {
    throw new AiError('reponse', 'Corps de réponse non JSON');
  }
}

/** fetch → JSON ; toute erreur devient AiError ; réessaie en cas de surcharge (5xx). */
export async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await once(url, init);
    } catch (e) {
      if (e instanceof AiError && e.kind === 'surcharge' && attempt < retryDelays.length) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      throw e;
    }
  }
}

function geminiVersion(id: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Ordre d'essai des modèles, du plus souhaitable au moins souhaitable. */
export function rankModels(provider: ProviderId, models: string[]): string[] {
  if (provider === 'mistral') {
    const prefs = ['mistral-small-latest', 'pixtral-12b-latest'];
    return [...prefs.filter((p) => models.includes(p)), ...models.filter((m) => !prefs.includes(m))];
  }
  const tier = (m: string) => {
    if (/preview|exp/.test(m)) return 4;
    const lite = /lite/.test(m);
    const alias = /latest/.test(m);
    return (lite ? 2 : 0) + (alias ? 1 : 0);
  };
  return [...models].sort((a, b) => tier(a) - tier(b) || geminiVersion(b) - geminiVersion(a) || a.localeCompare(b));
}

export function pickDefaultModel(provider: ProviderId, models: string[]): string | null {
  return rankModels(provider, models)[0] ?? null;
}

const PROBE_PROMPT = 'Réponds uniquement avec ce JSON : {"ok": true}';
const SKIP: AiError['kind'][] = ['quota', 'payant', 'modele', 'requete', 'surcharge', 'reponse'];

/**
 * Essaie les modèles dans l'ordre (6 au plus) avec une toute petite demande
 * et renvoie le premier qui répond : un modèle réellement utilisable gratuitement.
 */
export async function findFreeModel(provider: AnalysisProvider, key: string, ordered: string[], max = 6): Promise<string | null> {
  for (const model of ordered.slice(0, max)) {
    try {
      await provider.generateJson({ key, model, prompt: PROBE_PROMPT, images: [] });
      return model;
    } catch (e) {
      if (e instanceof AiError && SKIP.includes(e.kind)) continue;
      throw e;
    }
  }
  return null;
}
