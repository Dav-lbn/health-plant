import { db } from './db';
import type { CareEvent, Photo, Plant, Room } from './types';
import { CARE_TYPES, EXPOSURES } from './types';

type SerializedPhoto = Omit<Photo, 'blob' | 'thumb'> & { blob: string; thumb: string };

export interface BackupFile {
  app: 'health-plant';
  version: 1;
  exportedAt: string;
  rooms: Room[];
  plants: Plant[];
  careEvents: CareEvent[];
  photos: SerializedPhoto[];
}

const INVALID = 'Fichier de sauvegarde invalide';
const LAST_EXPORT_KEY = 'lastExportAt';

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(url: string): Blob {
  const m = /^data:([^;,]*);base64,(.*)$/.exec(url);
  if (!m) throw new Error(INVALID);
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

export async function exportAll(): Promise<BackupFile> {
  const [rooms, plants, careEvents, photos] = await Promise.all([
    db.rooms.toArray(),
    db.plants.toArray(),
    db.careEvents.toArray(),
    db.photos.toArray(),
  ]);
  const serialized: SerializedPhoto[] = [];
  for (const p of photos) {
    serialized.push({ ...p, blob: await blobToDataUrl(p.blob), thumb: await blobToDataUrl(p.thumb) });
  }
  const exportedAt = new Date().toISOString();
  await db.meta.put({ key: LAST_EXPORT_KEY, value: exportedAt });
  return { app: 'health-plant', version: 1, exportedAt, rooms, plants, careEvents, photos: serialized };
}

export async function exportBlob(): Promise<{ blob: Blob; filename: string }> {
  const data = await exportAll();
  const day = data.exportedAt.slice(0, 10);
  return {
    blob: new Blob([JSON.stringify(data)], { type: 'application/json' }),
    filename: `health-plant-${day}.json`,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isStrOrNull = (x: unknown) => x === null || isStr(x);
const isNumOrNull = (x: unknown) => x === null || (typeof x === 'number' && Number.isFinite(x));
const isDay = (x: unknown) => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x);

export function validateBackup(x: unknown): x is BackupFile {
  if (!isObj(x) || x.app !== 'health-plant' || x.version !== 1) return false;
  const { rooms, plants, careEvents, photos } = x;
  if (![rooms, plants, careEvents, photos].every(Array.isArray)) return false;

  const roomIds = new Set<string>();
  for (const r of rooms as unknown[]) {
    if (!isObj(r) || !isStr(r.id) || !isStr(r.name) || typeof r.order !== 'number') return false;
    roomIds.add(r.id);
  }
  const plantIds = new Set<string>();
  for (const p of plants as unknown[]) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !isStrOrNull(p.species)) return false;
    if (p.roomId !== null && !(isStr(p.roomId) && roomIds.has(p.roomId))) return false;
    if (p.exposure !== null && !EXPOSURES.includes(p.exposure as never)) return false;
    if (!isNumOrNull(p.waterAmountMl) || !isStr(p.notes) || !isStrOrNull(p.photoId)) return false;
    if (!isObj(p.careFrequencyDays) || !isStr(p.createdAt) || !isStr(p.updatedAt)) return false;
    plantIds.add(p.id);
  }
  for (const e of careEvents as unknown[]) {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.plantId) || !plantIds.has(e.plantId)) return false;
    if (!CARE_TYPES.includes(e.type as never) || !isDay(e.date)) return false;
    if (!isNumOrNull(e.amountMl) || !isStr(e.notes) || !isStr(e.createdAt)) return false;
  }
  for (const ph of photos as unknown[]) {
    if (!isObj(ph) || !isStr(ph.id) || !isStr(ph.plantId) || !plantIds.has(ph.plantId)) return false;
    if (!isStr(ph.blob) || !isStr(ph.thumb) || !isStr(ph.takenAt)) return false;
    if (!ph.blob.startsWith('data:') || !ph.thumb.startsWith('data:')) return false;
  }
  return true;
}

/** Remplace toutes les données. Rien n'est modifié si le fichier est invalide. */
export async function importAll(x: unknown): Promise<void> {
  if (!validateBackup(x)) throw new Error(INVALID);
  const photos: Photo[] = x.photos.map((p) => ({ ...p, blob: dataUrlToBlob(p.blob), thumb: dataUrlToBlob(p.thumb) }));
  await db.transaction('rw', [db.rooms, db.plants, db.careEvents, db.photos], async () => {
    await Promise.all([db.rooms.clear(), db.plants.clear(), db.careEvents.clear(), db.photos.clear()]);
    await db.rooms.bulkAdd(x.rooms);
    await db.plants.bulkAdd(x.plants);
    await db.careEvents.bulkAdd(x.careEvents);
    await db.photos.bulkAdd(photos);
  });
}

export async function lastExportDate(): Promise<string | null> {
  const entry = await db.meta.get(LAST_EXPORT_KEY);
  return isStr(entry?.value) ? entry.value : null;
}
