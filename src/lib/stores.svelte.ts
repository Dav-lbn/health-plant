import { parseHash, type Route } from './router';
import { listAllCare, listAllDiagnoses, listPlants, listRooms } from './repo';
import { db } from './db';
import { loadPostponed } from './tasks';
import { buildTasks, type Task } from './schedule';
import { todayLocal } from './dates';
import type { CareEvent, Diagnosis, Photo, Plant, Room } from './types';

export const app = $state({
  route: parseHash(typeof location !== 'undefined' ? location.hash : '') as Route,
  plants: [] as Plant[],
  rooms: [] as Room[],
  care: [] as CareEvent[],
  thumbs: {} as Record<string, Photo>,
  diagnoses: [] as Diagnosis[],
  lastDiag: {} as Record<string, Diagnosis>,
  loaded: false,
  postponed: {} as Record<string, string>,
  dueCount: 0,
});

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    app.route = parseHash(location.hash);
  });
}

/** Relit Dexie après chaque écriture. */
export async function refresh(): Promise<void> {
  const [plants, rooms, care, diagnoses] = await Promise.all([listPlants(), listRooms(), listAllCare(), listAllDiagnoses()]);
  const photoIds = plants.map((p) => p.photoId).filter((x): x is string => !!x);
  const photos = await db.photos.bulkGet(photoIds);
  const thumbs: Record<string, Photo> = {};
  for (const ph of photos) if (ph) thumbs[ph.id] = ph;
  app.plants = plants;
  app.rooms = rooms;
  app.care = care;
  app.thumbs = thumbs;
  app.diagnoses = diagnoses;
  const last: Record<string, Diagnosis> = {};
  for (const d of diagnoses) if (d.status === 'termine' && !last[d.plantId]) last[d.plantId] = d;
  app.lastDiag = last;
  app.postponed = await loadPostponed();
  app.dueCount = currentTasks().filter((t) => t.status !== 'bientot').length;
  app.loaded = true;
}

export const toast = $state({ message: '', action: null as null | { label: string; run: () => void }, id: 0 });

export function showToast(message: string, action: { label: string; run: () => void } | null = null) {
  toast.message = message;
  toast.action = action;
  toast.id++;
}

/** Tâches calculées à partir de l'état courant. */
export function currentTasks(today: string = todayLocal()): Task[] {
  return buildTasks(app.plants, app.care, app.diagnoses, app.postponed, today);
}
