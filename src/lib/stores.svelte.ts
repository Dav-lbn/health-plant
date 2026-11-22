import { parseHash, type Route } from './router';
import { listAllCare, listPlants, listRooms } from './repo';
import { db } from './db';
import type { CareEvent, Photo, Plant, Room } from './types';

export const app = $state({
  route: parseHash(typeof location !== 'undefined' ? location.hash : '') as Route,
  plants: [] as Plant[],
  rooms: [] as Room[],
  care: [] as CareEvent[],
  thumbs: {} as Record<string, Photo>,
  loaded: false,
});

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    app.route = parseHash(location.hash);
  });
}

/** Relit Dexie après chaque écriture. */
export async function refresh(): Promise<void> {
  const [plants, rooms, care] = await Promise.all([listPlants(), listRooms(), listAllCare()]);
  const photoIds = plants.map((p) => p.photoId).filter((x): x is string => !!x);
  const photos = await db.photos.bulkGet(photoIds);
  const thumbs: Record<string, Photo> = {};
  for (const ph of photos) if (ph) thumbs[ph.id] = ph;
  app.plants = plants;
  app.rooms = rooms;
  app.care = care;
  app.thumbs = thumbs;
  app.loaded = true;
}

export const toast = $state({ message: '', action: null as null | { label: string; run: () => void }, id: 0 });

export function showToast(message: string, action: { label: string; run: () => void } | null = null) {
  toast.message = message;
  toast.action = action;
  toast.id++;
}
