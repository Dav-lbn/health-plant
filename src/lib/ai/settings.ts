import { db } from '../db';
import type { ProviderId } from '../types';
import { AiError } from './parse';
import type { AnalysisProvider } from './provider';
import { gemini } from './gemini';
import { mistral, MISTRAL_API } from './mistral';
import { loadRelay } from '../relay';

export interface AiSettings {
  defaultProvider: ProviderId;
  gemini: { key: string; model: string };
  mistral: { key: string; model: string; base: string };
}

const KEY = 'ai';

export function defaultAiSettings(): AiSettings {
  return {
    defaultProvider: 'gemini',
    gemini: { key: '', model: '' },
    mistral: { key: '', model: '', base: MISTRAL_API },
  };
}

export async function loadAiSettings(): Promise<AiSettings> {
  const d = defaultAiSettings();
  const stored = (await db.meta.get(KEY))?.value as Partial<AiSettings> | undefined;
  const relay = await loadRelay();
  const base = relay || MISTRAL_API;
  if (!stored) return { ...d, mistral: { ...d.mistral, base } };
  return {
    defaultProvider: stored.defaultProvider === 'mistral' ? 'mistral' : 'gemini',
    gemini: { ...d.gemini, ...stored.gemini },
    mistral: { ...d.mistral, ...stored.mistral, base },
  };
}

export async function saveAiSettings(s: AiSettings): Promise<void> {
  await db.meta.put({ key: KEY, value: JSON.parse(JSON.stringify(s)) });
}

export function providerInstance(id: ProviderId, s: AiSettings): AnalysisProvider {
  return id === 'gemini' ? gemini : mistral(s.mistral.base);
}

export function hasKey(id: ProviderId, s: AiSettings): boolean {
  return !!s[id].key.trim();
}

export function providerFor(id: ProviderId, s: AiSettings): { provider: AnalysisProvider; key: string; model: string } {
  const conf = s[id];
  if (!conf.key.trim()) throw new AiError('cle');
  if (!conf.model.trim()) throw new AiError('modele');
  return { provider: providerInstance(id, s), key: conf.key.trim(), model: conf.model.trim() };
}
