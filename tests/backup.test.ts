// @vitest-environment node
import { beforeEach, describe, test, expect } from 'vitest';
import { db } from '../src/lib/db';
import { createPlant, createRoom, logCare, listPlants, listCare, listRooms } from '../src/lib/repo';
import { exportAll, importAll, lastExportDate, validateBackup } from '../src/lib/backup';

const plant = (name: string, roomId: string | null) => ({
  name, species: null, roomId, exposure: 'mi-ombre' as const,
  waterAmountMl: 200, notes: 'note', photoId: null, careFrequencyDays: { arrosage: 7 },
});

async function seed() {
  const r = await createRoom('Salon');
  const a = await createPlant(plant('Monstera', r.id));
  const b = await createPlant(plant('Ficus', null));
  await logCare({ plantId: a.id, type: 'arrosage', date: '2026-11-20', amountMl: 200, notes: '' });
  await logCare({ plantId: a.id, type: 'engrais', date: '2026-11-21', amountMl: null, notes: '' });
  await logCare({ plantId: b.id, type: 'arrosage', date: '2026-11-19', amountMl: 150, notes: '' });
  await db.photos.add({
    id: 'ph1', plantId: a.id, blob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' }),
    thumb: new Blob([new Uint8Array([9, 9])], { type: 'image/jpeg' }), takenAt: '2026-11-20T10:00:00Z',
  });
  return { r, a, b };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('export / import', () => {
  test('aller-retour complet', async () => {
    const { a } = await seed();
    const file = JSON.parse(JSON.stringify(await exportAll()));
    expect(file.app).toBe('health-plant');
    expect(file.version).toBe(1);
    await Promise.all(db.tables.map((t) => t.clear()));
    await importAll(file);
    expect((await listRooms()).map((r) => r.name)).toEqual(['Salon']);
    expect((await listPlants()).map((p) => p.name)).toEqual(['Ficus', 'Monstera']);
    expect(await listCare(a.id)).toHaveLength(2);
    const photo = await db.photos.get('ph1');
    expect(photo?.blob.size).toBe(5);
    expect(photo?.thumb.size).toBe(2);
    expect(photo?.blob.type).toBe('image/jpeg');
  });

  test('fichier invalide refusé, données intactes', async () => {
    await seed();
    await expect(importAll({ app: 'autre' })).rejects.toThrow('Fichier de sauvegarde invalide');
    await expect(importAll({ foo: 1 })).rejects.toThrow('Fichier de sauvegarde invalide');
    await expect(importAll(null)).rejects.toThrow('Fichier de sauvegarde invalide');
    expect(await listPlants()).toHaveLength(2);
  });

  test('référence cassée refusée, données intactes', async () => {
    await seed();
    const file = JSON.parse(JSON.stringify(await exportAll()));
    file.careEvents[0].plantId = 'inexistante';
    expect(validateBackup(file)).toBe(false);
    await expect(importAll(file)).rejects.toThrow('Fichier de sauvegarde invalide');
    expect(await listPlants()).toHaveLength(2);
  });

  test('lastExportDate enregistrée à l’export', async () => {
    expect(await lastExportDate()).toBeNull();
    await exportAll();
    expect(await lastExportDate()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
