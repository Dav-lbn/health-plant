/**
 * Relais Health Plant (Cloudflare Worker, offre gratuite) — Mistral et kDrive.
 *
 * Il ajoute seulement les en-têtes qui permettent à l'application web d'appeler
 * ces services. Il ne stocke rien et n'enregistre ni vos clés ni vos mots de passe :
 * ils arrivent de l'application dans l'en-tête Authorization et repartent tels quels.
 *
 *   /v1/models, /v1/chat/completions  →  https://api.mistral.ai
 *   /kdrive/{identifiant}/{chemin}     →  https://{identifiant}.connect.kdrive.infomaniak.com/{chemin}
 */
const ALLOWED_ORIGIN = 'https://dav-lbn.github.io';
const MISTRAL = 'https://api.mistral.ai';
const MISTRAL_PATHS = ['/v1/models', '/v1/chat/completions'];
const KDRIVE_METHODS = ['GET', 'PUT', 'MKCOL', 'PROPFIND', 'DELETE'];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, MKCOL, PROPFIND, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, depth',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(body, status, origin, contentType) {
  const headers = new Headers(corsHeaders(origin));
  if (contentType) headers.set('Content-Type', contentType);
  return new Response(body, { status, headers });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    if (origin !== ALLOWED_ORIGIN) return new Response('Origine non autorisée', { status: 403 });
    if (request.method === 'OPTIONS') return reply(null, 204, origin);

    const url = new URL(request.url);
    let target;
    let forwardHeaders = ['Authorization', 'Content-Type'];

    if (MISTRAL_PATHS.includes(url.pathname)) {
      if (!['GET', 'POST'].includes(request.method)) return reply('Méthode non autorisée', 405, origin);
      target = MISTRAL + url.pathname;
    } else {
      const m = /^\/kdrive\/(\d+)(\/.*)?$/.exec(url.pathname);
      if (!m) return reply('Chemin non autorisé', 404, origin);
      if (!KDRIVE_METHODS.includes(request.method)) return reply('Méthode non autorisée', 405, origin);
      target = `https://${m[1]}.connect.kdrive.infomaniak.com${m[2] || '/'}`;
      forwardHeaders = ['Authorization', 'Content-Type', 'Depth'];
    }

    const headers = {};
    for (const h of forwardHeaders) {
      const v = request.headers.get(h);
      if (v) headers[h] = v;
    }
    // Corps lu en entier : kDrive refuse les envois dont la taille n'est pas connue à l'avance.
    const body = ['POST', 'PUT'].includes(request.method) ? await request.arrayBuffer() : undefined;
    const upstream = await fetch(target, { method: request.method, headers, body });
    return reply(upstream.body, upstream.status, origin, upstream.headers.get('Content-Type'));
  },
};
