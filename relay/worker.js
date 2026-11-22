/**
 * Relais Health Plant → Mistral (Cloudflare Worker, offre gratuite).
 *
 * Il ajoute seulement les en-têtes qui permettent à l'application web d'appeler
 * l'API Mistral. Il ne stocke rien et n'enregistre jamais votre clé :
 * la clé arrive de l'application dans l'en-tête Authorization et repart telle quelle.
 */
const ALLOWED_ORIGIN = 'https://dav-lbn.github.io';
const UPSTREAM = 'https://api.mistral.ai';
const ALLOWED_PATHS = ['/v1/models', '/v1/chat/completions'];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    if (origin !== ALLOWED_ORIGIN) {
      return new Response('Origine non autorisée', { status: 403 });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const url = new URL(request.url);
    if (!ALLOWED_PATHS.includes(url.pathname)) {
      return new Response('Chemin non autorisé', { status: 404, headers: corsHeaders(origin) });
    }
    const upstream = await fetch(UPSTREAM + url.pathname, {
      method: request.method,
      headers: {
        Authorization: request.headers.get('Authorization') ?? '',
        'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
      },
      body: request.method === 'POST' ? request.body : undefined,
    });
    const headers = new Headers(corsHeaders(origin));
    headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'application/json');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
