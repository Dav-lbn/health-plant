export type Exposure = 'plein-soleil' | 'lumiere-vive' | 'mi-ombre' | 'ombre';
export type CareType = 'arrosage' | 'engrais' | 'rempotage' | 'taille' | 'traitement';

export interface Room {
  id: string;
  name: string;
  order: number;
}

export interface Plant {
  id: string;
  name: string;
  species: string | null;
  roomId: string | null;
  exposure: Exposure | null;
  waterAmountMl: number | null;
  notes: string;
  photoId: string | null;
  careFrequencyDays: Partial<Record<CareType, number>>;
  createdAt: string;
  updatedAt: string;
}

export interface CareEvent {
  id: string;
  plantId: string;
  type: CareType;
  /** Date locale YYYY-MM-DD */
  date: string;
  amountMl: number | null;
  notes: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  plantId: string;
  blob: Blob;
  thumb: Blob;
  takenAt: string;
}

export const EXPOSURES: Exposure[] = ['plein-soleil', 'lumiere-vive', 'mi-ombre', 'ombre'];
export const EXPOSURE_LABELS: Record<Exposure, string> = {
  'plein-soleil': 'Plein soleil',
  'lumiere-vive': 'Lumière vive indirecte',
  'mi-ombre': 'Mi-ombre',
  ombre: 'Ombre',
};
export const EXPOSURE_ICONS: Record<Exposure, string> = {
  'plein-soleil': '☀️',
  'lumiere-vive': '🌤️',
  'mi-ombre': '⛅',
  ombre: '☁️',
};

export const CARE_TYPES: CareType[] = ['arrosage', 'engrais', 'rempotage', 'taille', 'traitement'];
export const CARE_LABELS: Record<CareType, string> = {
  arrosage: 'Arrosage',
  engrais: 'Engrais',
  rempotage: 'Rempotage',
  taille: 'Taille',
  traitement: 'Traitement',
};
export const CARE_ICONS: Record<CareType, string> = {
  arrosage: '💧',
  engrais: '🧪',
  rempotage: '🪴',
  taille: '✂️',
  traitement: '💊',
};
