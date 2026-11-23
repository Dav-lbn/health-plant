// @vitest-environment node
import { afterEach, test, expect, vi } from 'vitest';
// @ts-expect-error module JS sans types
import worker from '../relay/worker.js';

const ORIGIN = 'https://dav-lbn.github.io';
afterEach(() => vi.unstubAllGlobals());

const req = (path: string, init: RequestInit & { origin?: string | null } = {}) => {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set('Origin', init.origin ?? ORIGIN);
  return new Request(`https://relais.example${path}`, { ...init, headers });
};

test('origine étrangère refusée', async () => {
  const r = await worker.fetch(req('/v1/models', { origin: 'https://pirate.example' }));
  expect(r.status).toBe(403);
});

test('préflight : méthodes WebDAV autorisées', async () => {
  const r = await worker.fetch(req('/kdrive/123/x', { method: 'OPTIONS' }));
  expect(r.status).toBe(204);
  expect(r.headers.get('Access-Control-Allow-Methods')).toContain('PROPFIND');
  expect(r.headers.get('Access-Control-Allow-Headers')).toContain('depth');
});

test('kDrive : PUT transmis avec corps complet et en-têtes', async () => {
  const f = vi.fn(async () => new Response(null, { status: 201 }));
  vi.stubGlobal('fetch', f);
  const r = await worker.fetch(req('/kdrive/123456/Health%20Plant/sauvegarde.json', {
    method: 'PUT', body: '{"a":1}', headers: { Authorization: 'Basic abc', 'Content-Type': 'application/json', Cookie: 'x' },
  }));
  expect(r.status).toBe(201);
  expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://123456.connect.kdrive.infomaniak.com/Health%20Plant/sauvegarde.json');
  expect(init.method).toBe('PUT');
  expect(init.headers).toEqual({ Authorization: 'Basic abc', 'Content-Type': 'application/json' });
  expect((init.body as ArrayBuffer).byteLength).toBe(7);
});

test('kDrive : identifiant non numérique et méthode interdite', async () => {
  vi.stubGlobal('fetch', vi.fn());
  expect((await worker.fetch(req('/kdrive/evil.com/x'))).status).toBe(404);
  expect((await worker.fetch(req('/kdrive/123/x', { method: 'POST', body: 'x' }))).status).toBe(405);
});

test('Mistral inchangé, autres chemins refusés', async () => {
  const f = vi.fn(async () => new Response('{"data":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', f);
  const r = await worker.fetch(req('/v1/models', { headers: { Authorization: 'Bearer K' } }));
  expect(r.status).toBe(200);
  expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://api.mistral.ai/v1/models');
  expect((await worker.fetch(req('/autre'))).status).toBe(404);
});
