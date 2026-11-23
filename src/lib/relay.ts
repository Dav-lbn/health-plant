import { db } from './db';

const KEY = 'relay';
const MISTRAL_API = 'https://api.mistral.ai';

const clean = (u: string) => u.trim().replace(/\/+$/, '');

/** Adresse du relais Cloudflare commun (Mistral et kDrive), '' si aucun. */
export async function loadRelay(): Promise<string> {
  const v = (await db.meta.get(KEY))?.value;
  if (typeof v === 'string') return clean(v);
  // Migration : ancien relais saisi dans les réglages Mistral.
  const ai = (await db.meta.get('ai'))?.value as { mistral?: { base?: string } } | undefined;
  const old = ai?.mistral?.base ? clean(ai.mistral.base) : '';
  return old && old !== MISTRAL_API ? old : '';
}

export async function saveRelay(url: string): Promise<void> {
  await db.meta.put({ key: KEY, value: clean(url) });
}
