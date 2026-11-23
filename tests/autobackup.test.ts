// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, test, expect, vi } from 'vitest';
import { db } from '../src/lib/db';
import { createPlant, listPlants } from '../src/lib/repo';
import {
  backupNow, restoreFromKDrive, notifyChange, shouldBackupOnOpen, loadStatus, saveKDriveConfig, setBackupDeps, checkOnOpen,
} from '../src/lib/backup/autobackup';
import { loadRelay, saveRelay } from '../src/lib/relay';
import { loadAiSettings } from '../src/lib/ai/settings';
import type { KDriveClient } from '../src/lib/backup/kdrive';
import { KDriveError } from '../src/lib/backup/kdrive';

function memoryClient(opts: { failWith?: Error; delayMs?: number } = {}) {
  const files = new Map<string, string>();
  let puts = 0;
  const wait = () => new Promise((r) => setTimeout(r, opts.delayMs ?? 0));
  const client: KDriveClient = {
    check: async () => { if (opts.failWith) throw opts.failWith; },
    mkcol: async () => {},
    put: async (path, blob) => { await wait(); if (opts.failWith) throw opts.failWith; puts++; files.set(path, await blob.text()); },
    get: async (path) => { const t = files.get(path); if (t == null) throw new KDriveError('http', 'Erreur kDrive (HTTP 404).'); return new Blob([t]); },
    list: async () => [...files.keys()].filter((k) => k.includes('/historique/')).map((k) => k.split('/').pop()!),
    remove: async (path) => { files.delete(path); },
  };
  return { client, files, puts: () => puts };
}

const enable = () => saveKDriveConfig({ enabled: true, driveId: '123', email: 'a@b.c', password: 'p' });

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  setBackupDeps({});
});

test('shouldBackupOnOpen', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  expect(shouldBackupOnOpen(null, now)).toBe(true);
  expect(shouldBackupOnOpen('2026-11-22T13:00:00Z', now)).toBe(false);
  expect(shouldBackupOnOpen('2026-11-22T11:00:00Z', now)).toBe(true);
});

describe('backupNow', () => {
  test('désactivé → rien', async () => {
    const m = memoryClient();
    setBackupDeps({ client: () => m.client });
    expect(await backupNow()).toEqual({ ok: false, error: 'Sauvegarde kDrive désactivée.' });
    expect(m.puts()).toBe(0);
  });

  test('succès → statut mis à jour, fichier sans secret', async () => {
    await enable();
    await db.meta.put({ key: 'ai', value: { gemini: { key: 'CLE-SECRETE', model: 'm' } } });
    await createPlant({ name: 'Ficus', species: null, roomId: null, exposure: null, waterAmountMl: null, notes: '', photoId: null, careFrequencyDays: {} });
    const m = memoryClient();
    setBackupDeps({ client: () => m.client });
    expect(await backupNow()).toEqual({ ok: true });
    const st = await loadStatus();
    expect(st.lastSuccessAt).toBeTruthy();
    expect(st.lastError).toBeNull();
    const saved = m.files.get('/Health Plant/sauvegarde.json')!;
    expect(saved).toContain('Ficus');
    expect(saved).not.toContain('CLE-SECRETE');
    expect(saved).not.toContain('a@b.c');
  });

  test('échec → erreur enregistrée, données intactes', async () => {
    await enable();
    await createPlant({ name: 'Ficus', species: null, roomId: null, exposure: null, waterAmountMl: null, notes: '', photoId: null, careFrequencyDays: {} });
    const m = memoryClient({ failWith: new KDriveError('auth', 'Identifiants kDrive refusés (e-mail ou mot de passe d’application).', 'HTTP 401') });
    setBackupDeps({ client: () => m.client });
    const r = await backupNow();
    expect(r.ok).toBe(false);
    expect((await loadStatus()).lastError).toBe('Identifiants kDrive refusés (e-mail ou mot de passe d’application).');
    expect(await listPlants()).toHaveLength(1);
  });

  test('deux appels simultanés → un seul envoi', async () => {
    await enable();
    const m = memoryClient({ delayMs: 20 });
    setBackupDeps({ client: () => m.client });
    await Promise.all([backupNow(), backupNow()]);
    expect(m.puts()).toBe(2); // sauvegarde.json + copie du jour, une seule fois
  });
});

test('notifyChange regroupe les modifications', async () => {
  await enable();
  const m = memoryClient();
  setBackupDeps({ client: () => m.client, delayMs: 30 });
  for (let i = 0; i < 5; i++) notifyChange();
  await new Promise((r) => setTimeout(r, 120));
  expect(m.puts()).toBe(2);
});

test('checkOnOpen sauvegarde si jamais sauvegardé', async () => {
  await enable();
  const m = memoryClient();
  setBackupDeps({ client: () => m.client });
  await checkOnOpen();
  expect(m.puts()).toBe(2);
  await checkOnOpen();
  expect(m.puts()).toBe(2);
});

describe('restauration', () => {
  test('aller-retour', async () => {
    await enable();
    await createPlant({ name: 'Ficus', species: null, roomId: null, exposure: null, waterAmountMl: null, notes: '', photoId: null, careFrequencyDays: {} });
    const m = memoryClient();
    setBackupDeps({ client: () => m.client });
    await backupNow();
    await db.plants.clear();
    await restoreFromKDrive();
    expect((await listPlants()).map((p) => p.name)).toEqual(['Ficus']);
  });

  test('fichier invalide → erreur, base intacte', async () => {
    await enable();
    await createPlant({ name: 'Ficus', species: null, roomId: null, exposure: null, waterAmountMl: null, notes: '', photoId: null, careFrequencyDays: {} });
    const m = memoryClient();
    m.files.set('/Health Plant/sauvegarde.json', '{"app":"autre"}');
    setBackupDeps({ client: () => m.client });
    await expect(restoreFromKDrive()).rejects.toThrow('Fichier de sauvegarde invalide');
    expect(await listPlants()).toHaveLength(1);
  });
});

describe('relais commun', () => {
  test('vide par défaut, enregistrable', async () => {
    expect(await loadRelay()).toBe('');
    await saveRelay(' https://r.example/ ');
    expect(await loadRelay()).toBe('https://r.example');
  });

  test('migration depuis le relais Mistral', async () => {
    await db.meta.put({ key: 'ai', value: { mistral: { key: '', model: '', base: 'https://ancien.example' } } });
    expect(await loadRelay()).toBe('https://ancien.example');
  });

  test('Mistral utilise le relais commun', async () => {
    await saveRelay('https://r.example');
    expect((await loadAiSettings()).mistral.base).toBe('https://r.example');
  });
});
