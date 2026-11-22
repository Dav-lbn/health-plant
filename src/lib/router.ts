export type Route =
  | { name: 'plants' }
  | { name: 'plant'; id: string }
  | { name: 'plant-new' }
  | { name: 'plant-edit'; id: string }
  | { name: 'diagnose'; id: string }
  | { name: 'diagnosis'; id: string; diagId: string }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'plante' && parts[1]) {
    if (parts.length === 2) return { name: 'plant', id: parts[1] };
    if (parts.length === 3 && parts[2] === 'modifier') return { name: 'plant-edit', id: parts[1] };
    if (parts.length === 3 && parts[2] === 'diagnostic') return { name: 'diagnose', id: parts[1] };
    if (parts.length === 4 && parts[2] === 'diagnostic') return { name: 'diagnosis', id: parts[1], diagId: parts[3] };
  }
  if (parts.length === 1 && parts[0] === 'nouvelle-plante') return { name: 'plant-new' };
  if (parts.length === 1 && parts[0] === 'reglages') return { name: 'settings' };
  return { name: 'plants' };
}

export function toHash(r: Route): string {
  switch (r.name) {
    case 'plant':
      return `#/plante/${encodeURIComponent(r.id)}`;
    case 'plant-edit':
      return `#/plante/${encodeURIComponent(r.id)}/modifier`;
    case 'diagnose':
      return `#/plante/${encodeURIComponent(r.id)}/diagnostic`;
    case 'diagnosis':
      return `#/plante/${encodeURIComponent(r.id)}/diagnostic/${encodeURIComponent(r.diagId)}`;
    case 'plant-new':
      return '#/nouvelle-plante';
    case 'settings':
      return '#/reglages';
    default:
      return '#/';
  }
}

export function navigate(r: Route, replace = false): void {
  const h = toHash(r);
  if (replace) history.replaceState(null, '', h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
