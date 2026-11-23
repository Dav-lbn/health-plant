import { db } from '../db';
import { exportBlob, importAll } from '../backup';
import { loadRelay } from '../relay';
import { todayLocal } from '../dates';
import { downloadBackup, kdriveClient, KDriveError, listBackups, uploadBackup, type KDriveClient, type KDriveConfig } from './kdrive';

const CONFIG_KEY = 'kdrive';
const STATUS_KEY = 'kdriveStatus';
const DAY_MS = 86_400_000;

export interface BackupStatus {
  lastSuccessAt: string | null;
  lastError: string | null;
  /** Date (AAAA-MM-JJ) de la dernière copie quotidienne envoyée. */
  lastDailyCopy?: string | null;
}

interface Deps {
  client?: () => KDriveClient | Promise<KDriveClient>;
  delayMs?: number;
}
let deps: Deps = {};
/** Injection pour les tests. */
export function setBackupDeps(d: Deps): void {
  deps = d;
  inflight = null;
  clearTimeout(timer);
}

export function defaultKDriveConfig(): KDriveConfig {
  return { enabled: false, driveId: '', email: '', password: '' };
}

export async function loadKDriveConfig(): Promise<KDriveConfig> {
  const v = (await db.meta.get(CONFIG_KEY))?.value as Partial<KDriveConfig> | undefined;
  return { ...defaultKDriveConfig(), ...v };
}

export async function saveKDriveConfig(c: KDriveConfig): Promise<void> {
  await db.meta.put({ key: CONFIG_KEY, value: { ...c } });
}

export async function loadStatus(): Promise<BackupStatus> {
  const v = (await db.meta.get(STATUS_KEY))?.value as Partial<BackupStatus> | undefined;
  return { lastSuccessAt: v?.lastSuccessAt ?? null, lastError: v?.lastError ?? null, lastDailyCopy: v?.lastDailyCopy ?? null };
}

async function saveStatus(s: BackupStatus): Promise<void> {
  await db.meta.put({ key: STATUS_KEY, value: s });
}

function isConfigured(c: KDriveConfig): boolean {
  return c.enabled && !!c.driveId.trim() && !!c.email.trim() && !!c.password;
}

export async function makeClient(cfg?: KDriveConfig): Promise<KDriveClient> {
  if (deps.client) return deps.client();
  return kdriveClient(cfg ?? (await loadKDriveConfig()), await loadRelay());
}

export function errorMessage(e: unknown): string {
  if (e instanceof KDriveError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Sauvegarde impossible.';
}

let inflight: Promise<{ ok: boolean; error?: string }> | null = null;

/** Sauvegarde immédiate ; une seule à la fois. */
export function backupNow(): Promise<{ ok: boolean; error?: string }> {
  if (inflight) return inflight;
  inflight = (async () => {
    const cfg = await loadKDriveConfig();
    if (!isConfigured(cfg)) return { ok: false, error: 'Sauvegarde kDrive désactivée.' };
    const status = await loadStatus();
    try {
      const client = await makeClient(cfg);
      const { blob } = await exportBlob(false);
      const today = todayLocal();
      await uploadBackup(client, blob, today, status.lastDailyCopy !== today);
      await saveStatus({ lastSuccessAt: new Date().toISOString(), lastError: null, lastDailyCopy: today });
      return { ok: true };
    } catch (e) {
      const error = errorMessage(e);
      await saveStatus({ ...status, lastError: error });
      return { ok: false, error };
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Restaure la sauvegarde la plus récente, ou la copie du jour `date` (AAAA-MM-JJ). */
export async function restoreFromKDrive(date?: string): Promise<void> {
  const client = await makeClient();
  const data = await downloadBackup(client, date);
  await importAll(data);
}

export async function availableBackups(): Promise<string[]> {
  return listBackups(await makeClient());
}

export function shouldBackupOnOpen(lastSuccessAt: string | null, now: Date): boolean {
  if (!lastSuccessAt) return true;
  return now.getTime() - new Date(lastSuccessAt).getTime() > DAY_MS;
}

export async function checkOnOpen(now = new Date()): Promise<void> {
  const cfg = await loadKDriveConfig();
  if (!isConfigured(cfg)) return;
  if (shouldBackupOnOpen((await loadStatus()).lastSuccessAt, now)) await backupNow();
}

let timer: ReturnType<typeof setTimeout> | undefined;

function delay(): number {
  if (deps.delayMs != null) return deps.delayMs;
  const w = typeof window !== 'undefined' ? (window as unknown as { __HP_BACKUP_DELAY__?: number }).__HP_BACKUP_DELAY__ : undefined;
  return w ?? 20_000;
}

/** À appeler après chaque modification : sauvegarde 20 s après la dernière. */
export function notifyChange(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    void backupNow();
  }, delay());
}
