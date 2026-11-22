import Dexie, { type Table } from 'dexie';
import type { CareEvent, Diagnosis, Photo, Plant, Room } from './types';

export interface MetaEntry {
  key: string;
  value: unknown;
}

class HealthPlantDB extends Dexie {
  rooms!: Table<Room, string>;
  plants!: Table<Plant, string>;
  careEvents!: Table<CareEvent, string>;
  photos!: Table<Photo, string>;
  meta!: Table<MetaEntry, string>;
  diagnoses!: Table<Diagnosis, string>;

  constructor() {
    super('health-plant');
    this.version(1).stores({
      rooms: 'id, order',
      plants: 'id, roomId, name',
      careEvents: 'id, plantId, [plantId+date], [plantId+type]',
      photos: 'id, plantId',
      meta: 'key',
    });
    this.version(2)
      .stores({ diagnoses: 'id, plantId, [plantId+createdAt]' })
      .upgrade((tx) =>
        tx
          .table('plants')
          .toCollection()
          .modify((p) => {
            if (p.speciesSheet === undefined) p.speciesSheet = null;
          }),
      );
  }
}

export const db = new HealthPlantDB();
