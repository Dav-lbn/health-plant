import { beforeEach, describe, test, expect } from 'vitest';
import { db } from '../src/lib/db';
import {
  createPlant, getPlant, deletePlant, logCare, listCare, lastCare,
  createRoom, deleteRoom, listPlants, listRooms, renameRoom, updatePlant,
  saveDiagnosis, lastDiagnosis, listDiagnoses, deleteDiagnosis, getDiagnosis,
} from '../src/lib/repo';

const basePlant = {
  name: 'Monstera', species: null, roomId: null, exposure: null,
  waterAmountMl: 300, notes: '', photoId: null, careFrequencyDays: {},
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('plantes', () => {
  test('createPlant puis getPlant', async () => {
    const p = await createPlant(basePlant);
    const got = await getPlant(p.id);
    expect(got?.name).toBe('Monstera');
    expect(got?.id).toBeTruthy();
    expect(got?.createdAt).toBeTruthy();
  });

  test('updatePlant modifie et met à jour updatedAt', async () => {
    const p = await createPlant(basePlant);
    await new Promise((r) => setTimeout(r, 5));
    await updatePlant(p.id, { name: 'Ficus' });
    const got = await getPlant(p.id);
    expect(got?.name).toBe('Ficus');
    expect(got!.updatedAt > p.updatedAt).toBe(true);
  });

  test('deletePlant supprime soins et photos', async () => {
    const p = await createPlant(basePlant);
    await logCare({ plantId: p.id, type: 'arrosage', date: '2026-11-20', amountMl: 300, notes: '' });
    await db.photos.add({ id: 'ph1', plantId: p.id, blob: new Blob(['x']), thumb: new Blob(['y']), takenAt: '2026-11-20T10:00:00Z' });
    await deletePlant(p.id);
    expect(await getPlant(p.id)).toBeUndefined();
    expect(await listCare(p.id)).toEqual([]);
    expect(await db.photos.where('plantId').equals(p.id).count()).toBe(0);
  });
});

describe('soins', () => {
  test('listCare trié par date décroissante, lastCare = le plus récent du type', async () => {
    const p = await createPlant(basePlant);
    await logCare({ plantId: p.id, type: 'arrosage', date: '2026-11-10', amountMl: 300, notes: '' });
    await logCare({ plantId: p.id, type: 'arrosage', date: '2026-11-20', amountMl: 250, notes: '' });
    await logCare({ plantId: p.id, type: 'engrais', date: '2026-11-21', amountMl: null, notes: '' });
    await logCare({ plantId: p.id, type: 'arrosage', date: '2026-11-15', amountMl: 300, notes: '' });
    const all = await listCare(p.id);
    expect(all.map((e) => e.date)).toEqual(['2026-11-21', '2026-11-20', '2026-11-15', '2026-11-10']);
    expect((await lastCare(p.id, 'arrosage'))?.date).toBe('2026-11-20');
    expect(await lastCare(p.id, 'taille')).toBeUndefined();
  });
});

describe('pièces', () => {
  test('createRoom ordonne et renameRoom renomme', async () => {
    await createRoom('Salon');
    const r2 = await createRoom('Chambre');
    await renameRoom(r2.id, 'Chambre parentale');
    const rooms = await listRooms();
    expect(rooms.map((r) => r.name)).toEqual(['Salon', 'Chambre parentale']);
  });

  test('deleteRoom garde les plantes, sans pièce', async () => {
    const r = await createRoom('Salon');
    const p = await createPlant({ ...basePlant, roomId: r.id });
    await deleteRoom(r.id);
    expect(await listRooms()).toEqual([]);
    const plants = await listPlants();
    expect(plants).toHaveLength(1);
    expect(plants[0].id).toBe(p.id);
    expect(plants[0].roomId).toBeNull();
  });
});

describe('diagnostics', () => {
  const diag = (id: string, plantId: string, status: 'termine' | 'erreur', createdAt: string, photoIds: string[] = []) => ({
    id, plantId, createdAt, date: createdAt.slice(0, 10), provider: 'gemini' as const, model: 'm',
    photoIds, photoKinds: photoIds.map(() => 'ensemble' as const), answers: [], status, error: null, result: null,
  });

  test('deletePlant supprime les diagnostics', async () => {
    const p = await createPlant(basePlant);
    await saveDiagnosis(diag('d1', p.id, 'termine', '2026-11-20T10:00:00Z'));
    await deletePlant(p.id);
    expect(await db.diagnoses.count()).toBe(0);
  });

  test('lastDiagnosis ignore les erreurs', async () => {
    const p = await createPlant(basePlant);
    await saveDiagnosis(diag('d1', p.id, 'termine', '2026-11-18T10:00:00Z'));
    await saveDiagnosis(diag('d2', p.id, 'termine', '2026-11-20T10:00:00Z'));
    await saveDiagnosis(diag('d3', p.id, 'erreur', '2026-11-21T10:00:00Z'));
    expect((await lastDiagnosis(p.id))?.id).toBe('d2');
    expect((await listDiagnoses(p.id)).map((d) => d.id)).toEqual(['d3', 'd2', 'd1']);
  });

  test('deleteDiagnosis supprime ses photos', async () => {
    const p = await createPlant(basePlant);
    await db.photos.add({ id: 'ph1', plantId: p.id, blob: new Blob(['x']), thumb: new Blob(['y']), takenAt: '2026-11-20T10:00:00Z' });
    await saveDiagnosis(diag('d1', p.id, 'termine', '2026-11-20T10:00:00Z', ['ph1']));
    await deleteDiagnosis('d1');
    expect(await getDiagnosis('d1')).toBeUndefined();
    expect(await db.photos.count()).toBe(0);
  });

  test('createPlant met speciesSheet à null', async () => {
    const p = await createPlant(basePlant);
    expect((await getPlant(p.id))?.speciesSheet).toBeNull();
  });
});
