import { afterEach, describe, test, expect, vi } from 'vitest';
import { kdriveUrl, kdriveClient, uploadBackup, downloadBackup, KDriveError, type KDriveConfig } from '../src/lib/backup/kdrive';

const cfg: KDriveConfig = { enabled: true, driveId: '123456', email: 'moi@exemple.fr', password: 'app-pass' };
afterEach(() => vi.unstubAllGlobals());

const multistatus = (names: { href: string; dir?: boolean }[]) => `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">${names
  .map((n) => `<d:response><d:href>${n.href}</d:href><d:propstat><d:prop><d:resourcetype>${n.dir ? '<d:collection/>' : ''}</d:resourcetype></d:prop></d:propstat></d:response>`)
  .join('')}</d:multistatus>`;

describe('kdriveUrl', () => {
  test('direct', () => {
    expect(kdriveUrl(cfg, '', '/Health Plant/sauvegarde.json')).toBe('https://123456.connect.kdrive.infomaniak.com/Health%20Plant/sauvegarde.json');
  });
  test('via relais', () => {
    expect(kdriveUrl(cfg, 'https://r.example/', '/Health Plant/sauvegarde.json')).toBe('https://r.example/kdrive/123456/Health%20Plant/sauvegarde.json');
  });
  test('identifiant non numérique refusé', () => {
    expect(() => kdriveUrl({ ...cfg, driveId: '12a' }, '', '/')).toThrow(KDriveError);
  });
});

describe('client', () => {
  test('PUT : Basic auth, JSON, corps', async () => {
    const f = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', f);
    await kdriveClient(cfg, '').put('/a.json', new Blob(['{"x":1}'], { type: 'application/json' }));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://123456.connect.kdrive.infomaniak.com/a.json');
    expect(init.method).toBe('PUT');
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Basic ' + btoa('moi@exemple.fr:app-pass'));
    expect(h['Content-Type']).toBe('application/json');
    expect(await (init.body as Blob).text()).toBe('{"x":1}');
  });

  test.each([
    [401, 'auth', 'Identifiants kDrive refusés (e-mail ou mot de passe d’application).'],
    [507, 'plein', 'Espace kDrive plein.'],
    [500, 'http', 'Erreur kDrive (HTTP 500).'],
  ])('HTTP %i → %s', async (status, kind, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status })));
    const err = await kdriveClient(cfg, '').put('/a.json', new Blob(['x'])).catch((e) => e);
    expect(err).toBeInstanceOf(KDriveError);
    expect(err.kind).toBe(kind);
    expect(err.message).toBe(message);
  });

  test('check : 404 → introuvable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })));
    await expect(kdriveClient(cfg, '').check()).rejects.toMatchObject({ kind: 'introuvable', message: 'Identifiant kDrive introuvable.' });
  });

  test('réseau sans relais / avec relais', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(kdriveClient(cfg, '').check()).rejects.toMatchObject({ kind: 'reseau', message: 'kDrive injoignable depuis l’application : configurez le relais.' });
    await expect(kdriveClient(cfg, 'https://r.example').check()).rejects.toMatchObject({ kind: 'reseau', message: 'Relais ou kDrive injoignable.' });
  });

  test('MKCOL 405 ignoré', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 405 })));
    await expect(kdriveClient(cfg, '').mkcol('/Health Plant/')).resolves.toBeUndefined();
  });

  test('list : fichiers seulement', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(multistatus([
      { href: '/Health%20Plant/historique/', dir: true },
      { href: '/Health%20Plant/historique/health-plant-2026-11-20.json' },
      { href: '/Health%20Plant/historique/health-plant-2026-11-21.json' },
    ]), { status: 207 })));
    expect(await kdriveClient(cfg, '').list('/Health Plant/historique/')).toEqual(['health-plant-2026-11-20.json', 'health-plant-2026-11-21.json']);
  });
});

test('uploadBackup : dossiers, fichiers, rotation à 7 copies', async () => {
  const calls: string[] = [];
  const copies = Array.from({ length: 9 }, (_, i) => ({ href: `/Health%20Plant/historique/health-plant-2026-11-${String(10 + i).padStart(2, '0')}.json` }));
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push(`${init.method} ${decodeURIComponent(new URL(url).pathname)}`);
    if (init.method === 'PROPFIND') return new Response(multistatus([{ href: '/Health%20Plant/historique/', dir: true }, ...copies]), { status: 207 });
    return new Response(null, { status: init.method === 'MKCOL' ? 405 : 201 });
  }));
  await uploadBackup(kdriveClient(cfg, ''), new Blob(['{}']), '2026-11-18');
  expect(calls).toEqual([
    'MKCOL /Health Plant/',
    'MKCOL /Health Plant/historique/',
    'PUT /Health Plant/sauvegarde.json',
    'PUT /Health Plant/historique/health-plant-2026-11-18.json',
    'PROPFIND /Health Plant/historique/',
    'DELETE /Health Plant/historique/health-plant-2026-11-10.json',
    'DELETE /Health Plant/historique/health-plant-2026-11-11.json',
  ]);
});

test('downloadBackup', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"app":"health-plant"}', { status: 200 })));
  expect(await downloadBackup(kdriveClient(cfg, ''))).toEqual({ app: 'health-plant' });
});
