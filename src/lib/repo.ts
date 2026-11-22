import { db } from './db';
import type { CareEvent, CareType, Diagnosis, Plant, Room } from './types';

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

export type NewPlant = Omit<Plant, 'id' | 'createdAt' | 'updatedAt' | 'speciesSheet'> & { speciesSheet?: Plant['speciesSheet'] };

export async function createPlant(input: NewPlant): Promise<Plant> {
  const t = now();
  const plant: Plant = { speciesSheet: null, ...input, id: uid(), createdAt: t, updatedAt: t };
  await db.plants.add(plant);
  return plant;
}

export async function updatePlant(id: string, patch: Partial<Plant>): Promise<void> {
  const { id: _ignored, createdAt: _c, ...rest } = patch;
  await db.plants.update(id, { ...rest, updatedAt: now() });
}

export async function deletePlant(id: string): Promise<void> {
  await db.transaction('rw', [db.plants, db.careEvents, db.photos, db.diagnoses], async () => {
    await db.diagnoses.where('plantId').equals(id).delete();
    await db.careEvents.where('plantId').equals(id).delete();
    await db.photos.where('plantId').equals(id).delete();
    await db.plants.delete(id);
  });
}

export function getPlant(id: string): Promise<Plant | undefined> {
  return db.plants.get(id);
}

export async function listPlants(): Promise<Plant[]> {
  const plants = await db.plants.toArray();
  return plants.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function createRoom(name: string): Promise<Room> {
  const last = await db.rooms.orderBy('order').last();
  const room: Room = { id: uid(), name: name.trim(), order: (last?.order ?? -1) + 1 };
  await db.rooms.add(room);
  return room;
}

export async function renameRoom(id: string, name: string): Promise<void> {
  await db.rooms.update(id, { name: name.trim() });
}

export async function deleteRoom(id: string): Promise<void> {
  await db.transaction('rw', db.rooms, db.plants, async () => {
    await db.plants.where('roomId').equals(id).modify({ roomId: null });
    await db.rooms.delete(id);
  });
}

export function listRooms(): Promise<Room[]> {
  return db.rooms.orderBy('order').toArray();
}

export async function logCare(input: Omit<CareEvent, 'id' | 'createdAt'>): Promise<CareEvent> {
  const event: CareEvent = { ...input, id: uid(), createdAt: now() };
  await db.careEvents.add(event);
  return event;
}

export async function deleteCare(id: string): Promise<void> {
  await db.careEvents.delete(id);
}

const byDateDesc = (a: CareEvent, b: CareEvent) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export async function listCare(plantId: string): Promise<CareEvent[]> {
  const events = await db.careEvents.where('plantId').equals(plantId).toArray();
  return events.sort(byDateDesc);
}

export async function listAllCare(): Promise<CareEvent[]> {
  const events = await db.careEvents.toArray();
  return events.sort(byDateDesc);
}

export async function lastCare(plantId: string, type: CareType): Promise<CareEvent | undefined> {
  const events = await db.careEvents.where('[plantId+type]').equals([plantId, type]).toArray();
  return events.sort(byDateDesc)[0];
}

const byCreatedDesc = (a: Diagnosis, b: Diagnosis) => b.createdAt.localeCompare(a.createdAt);

export async function listDiagnoses(plantId: string): Promise<Diagnosis[]> {
  const list = await db.diagnoses.where('plantId').equals(plantId).toArray();
  return list.sort(byCreatedDesc);
}

export async function listAllDiagnoses(): Promise<Diagnosis[]> {
  return (await db.diagnoses.toArray()).sort(byCreatedDesc);
}

export async function lastDiagnosis(plantId: string): Promise<Diagnosis | undefined> {
  return (await listDiagnoses(plantId)).find((d) => d.status === 'termine');
}

export function getDiagnosis(id: string): Promise<Diagnosis | undefined> {
  return db.diagnoses.get(id);
}

export async function saveDiagnosis(d: Diagnosis): Promise<void> {
  await db.diagnoses.put($stateSnapshot(d));
}

export async function deleteDiagnosis(id: string): Promise<void> {
  await db.transaction('rw', db.diagnoses, db.photos, async () => {
    const d = await db.diagnoses.get(id);
    if (!d) return;
    await db.photos.bulkDelete(d.photoIds);
    await db.diagnoses.delete(id);
  });
}

/** Copie profonde simple (les objets réactifs Svelte ne sont pas clonables par IndexedDB). */
function $stateSnapshot<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
