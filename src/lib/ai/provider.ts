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
  if (status === 401 || status === 403) return new AiError('cle');
  if (status === 400 && /api.?key|unauthori[sz]ed|invalid.*key/i.test(message)) return new AiError('cle');
  if (status === 404) return new AiError('modele');
  if (status === 429) return new AiError('quota');
  if (status === 400) return new AiError('reponse');
  return new AiError('reseau');
}

/** fetch qui convertit toute erreur réseau ou HTTP en AiError, et renvoie le JSON. */
export async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new AiError('reseau');
  }
  if (!res.ok) {
    let message = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } | string; message?: string };
      message = typeof body.error === 'string' ? body.error : (body.error?.message ?? body.message ?? '');
    } catch {
      /* corps illisible */
    }
    throw toAiError(res.status, message);
  }
  try {
    return await res.json();
  } catch {
    throw new AiError('reponse');
  }
}

function geminiVersion(id: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(id);
  return m ? Number(m[1]) : 0;
}

export function pickDefaultModel(provider: ProviderId, models: string[]): string | null {
  if (!models.length) return null;
  if (provider === 'gemini') {
    const stable = models.filter((m) => /flash/.test(m) && !/lite|preview|exp/.test(m));
    const pool = stable.length ? stable : models;
    return [...pool].sort((a, b) => geminiVersion(b) - geminiVersion(a))[0];
  }
  for (const pref of ['mistral-small-latest', 'pixtral-12b-latest']) if (models.includes(pref)) return pref;
  return models[0];
}
