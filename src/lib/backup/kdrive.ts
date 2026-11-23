export interface KDriveConfig {
  enabled: boolean;
  driveId: string;
  email: string;
  password: string;
}

export type KDriveErrorKind = 'auth' | 'introuvable' | 'reseau' | 'plein' | 'http';

export class KDriveError extends Error {
  constructor(
    public kind: KDriveErrorKind,
    message: string,
    public detail = '',
  ) {
    super(message);
    this.name = 'KDriveError';
  }
}

export const FOLDER = '/Health Plant/';
export const HISTORY = '/Health Plant/historique/';
export const CURRENT = '/Health Plant/sauvegarde.json';
const KEEP = 7;

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export function kdriveUrl(cfg: KDriveConfig, relay: string, path: string): string {
  const id = cfg.driveId.trim();
  if (!/^\d+$/.test(id)) throw new KDriveError('introuvable', 'Identifiant kDrive introuvable.', 'identifiant non numérique');
  const p = encodePath(path.startsWith('/') ? path : `/${path}`);
  const r = relay.trim().replace(/\/+$/, '');
  return r ? `${r}/kdrive/${id}${p}` : `https://${id}.connect.kdrive.infomaniak.com${p}`;
}

function basic(email: string, password: string): string {
  const bytes = new TextEncoder().encode(`${email.trim()}:${password}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `Basic ${btoa(bin)}`;
}

export interface KDriveClient {
  check(): Promise<void>;
  put(path: string, blob: Blob): Promise<void>;
  get(path: string): Promise<Blob>;
  mkcol(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
}

export function kdriveClient(cfg: KDriveConfig, relay: string): KDriveClient {
  const auth = basic(cfg.email, cfg.password);

  async function call(method: string, path: string, init: { body?: Blob | string; headers?: Record<string, string> } = {}, ok: number[] = []): Promise<Response> {
    const url = kdriveUrl(cfg, relay, path);
    let res: Response;
    try {
      res = await fetch(url, { method, headers: { Authorization: auth, ...init.headers }, body: init.body });
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      throw relay.trim()
        ? new KDriveError('reseau', 'Relais ou kDrive injoignable.', detail)
        : new KDriveError('reseau', 'kDrive injoignable depuis l’application : configurez le relais.', detail);
    }
    if (res.ok || ok.includes(res.status)) return res;
    const detail = `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new KDriveError('auth', 'Identifiants kDrive refusés (e-mail ou mot de passe d’application).', detail);
    if (res.status === 507) throw new KDriveError('plein', 'Espace kDrive plein.', detail);
    throw new KDriveError('http', `Erreur kDrive (HTTP ${res.status}).`, detail);
  }

  return {
    async check() {
      try {
        await call('PROPFIND', '/', { headers: { Depth: '0' } });
      } catch (e) {
        if (e instanceof KDriveError && e.detail === 'HTTP 404') throw new KDriveError('introuvable', 'Identifiant kDrive introuvable.', e.detail);
        throw e;
      }
    },
    async put(path, blob) {
      await call('PUT', path, { body: blob, headers: { 'Content-Type': 'application/json' } });
    },
    async get(path) {
      return (await call('GET', path)).blob();
    },
    async mkcol(path) {
      await call('MKCOL', path, {}, [405]);
    },
    async list(path) {
      const res = await call('PROPFIND', path, { headers: { Depth: '1' } });
      const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
      const names: string[] = [];
      for (const r of Array.from(xml.getElementsByTagNameNS('DAV:', 'response'))) {
        const href = r.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent ?? '';
        const isDir = r.getElementsByTagNameNS('DAV:', 'collection').length > 0 || href.endsWith('/');
        if (isDir) continue;
        const name = decodeURIComponent(href.split('/').filter(Boolean).pop() ?? '');
        if (name) names.push(name);
      }
      return names;
    },
    async remove(path) {
      await call('DELETE', path, {}, [404]);
    },
  };
}

export async function uploadBackup(client: KDriveClient, blob: Blob, today: string): Promise<void> {
  await client.mkcol(FOLDER);
  await client.mkcol(HISTORY);
  await client.put(CURRENT, blob);
  await client.put(`${HISTORY}health-plant-${today}.json`, blob);
  const copies = (await client.list(HISTORY)).filter((n) => /^health-plant-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  for (const old of copies.slice(0, Math.max(0, copies.length - KEEP))) await client.remove(`${HISTORY}${old}`);
}

export async function downloadBackup(client: KDriveClient): Promise<unknown> {
  const text = await (await client.get(CURRENT)).text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Fichier de sauvegarde invalide');
  }
}
