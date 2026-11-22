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
  speciesSheet: SpeciesSheet | null;
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

export type HealthState = 'bon' | 'surveiller' | 'malade';
export type Trend = 'mieux' | 'stable' | 'moins-bien' | 'inconnue';
export type ProviderId = 'gemini' | 'mistral';
export type PhotoKind = 'ensemble' | 'gros-plan' | 'dessous' | 'terre';

export interface Problem {
  name: string;
  cause: string;
  severity: 'faible' | 'moyenne' | 'forte';
}

export interface RecommendedAction {
  action: string;
  careType: CareType | null;
  priority: 'haute' | 'moyenne' | 'basse';
  delayDays: number;
  doneAt: string | null;
}

export interface DiagnosisResult {
  state: HealthState;
  summary: string;
  problems: Problem[];
  actions: RecommendedAction[];
  confidence: number;
  questions: string[];
  trend: Trend;
  suggestedSpecies: string | null;
}

export interface Diagnosis {
  id: string;
  plantId: string;
  createdAt: string;
  date: string;
  provider: ProviderId;
  model: string;
  photoIds: string[];
  photoKinds: PhotoKind[];
  answers: { question: string; answer: string }[];
  status: 'en-cours' | 'questions' | 'termine' | 'erreur';
  error: string | null;
  result: DiagnosisResult | null;
}

export interface SpeciesSheet {
  species: string;
  light: string;
  water: string;
  humidity: string;
  temperature: string;
  toxicity: string;
  tips: string[];
  frequencies: Partial<Record<CareType, number>>;
  generatedAt: string;
  provider: ProviderId;
}

export const HEALTH_STATES: HealthState[] = ['bon', 'surveiller', 'malade'];
export const STATE_LABELS: Record<HealthState, string> = { bon: 'En forme', surveiller: 'À surveiller', malade: 'Malade' };
export const TRENDS: Trend[] = ['mieux', 'stable', 'moins-bien', 'inconnue'];
export const TREND_LABELS: Record<Trend, string> = { mieux: 'Mieux', stable: 'Stable', 'moins-bien': 'Moins bien', inconnue: '—' };
export const PHOTO_KINDS: PhotoKind[] = ['ensemble', 'gros-plan', 'dessous', 'terre'];
export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  ensemble: "Vue d'ensemble",
  'gros-plan': 'Gros plan',
  dessous: 'Dessous des feuilles',
  terre: 'Terre',
};
export const PROVIDER_LABELS: Record<ProviderId, string> = { gemini: 'Gemini', mistral: 'Mistral' };
