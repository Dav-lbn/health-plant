import { db } from './db';
import { getDiagnosis, getPlant, lastDiagnosis, listCare, logCare, saveDiagnosis, updatePlant } from './repo';
import { savePhoto } from './photos';
import { daysBetween, todayLocal } from './dates';
import { AiError, extractJson, parseDiagnosis, parseSpeciesSheet } from './ai/parse';
import { buildDiagnosisPrompt, buildSpeciesPrompt, type DiagnosisContext } from './ai/prompts';
import { loadAiSettings, providerFor, type AiSettings } from './ai/settings';
import type { AiImage, AnalysisProvider } from './ai/provider';
import type { CareEvent, Diagnosis, Photo, PhotoKind, Plant, ProviderId, SpeciesSheet } from './types';

export interface AiDeps {
  settings?: AiSettings;
  /** Remplace le fournisseur réel (tests). */
  providerOverride?: AnalysisProvider;
}

export interface StartDeps extends AiDeps {
  storePhoto?: (plantId: string, file: Blob) => Promise<Photo>;
}

export async function blobToAiImage(b: Blob): Promise<AiImage> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mimeType: b.type || 'image/jpeg', base64: btoa(bin) };
}

export function buildContext(
  plant: Plant,
  care: CareEvent[],
  previous: Diagnosis | undefined,
  kinds: PhotoKind[],
  answers: { question: string; answer: string }[],
  today: string,
  hasPreviousPhoto: boolean,
): DiagnosisContext {
  return {
    plantName: plant.name,
    species: plant.species,
    exposure: plant.exposure,
    waterAmountMl: plant.waterAmountMl,
    recentCare: care
      .filter((c) => daysBetween(c.date, today) <= 30 && daysBetween(c.date, today) >= 0)
      .map((c) => ({ type: c.type, date: c.date })),
    today,
    previous: previous?.result ? { date: previous.date, summary: previous.result.summary, state: previous.result.state } : null,
    photoKinds: kinds,
    hasPreviousPhoto,
    answers,
  };
}

async function resolveProvider(id: ProviderId, deps: AiDeps) {
  const settings = deps.settings ?? (await loadAiSettings());
  const conf = providerFor(id, settings);
  return { ...conf, provider: deps.providerOverride ?? conf.provider };
}

export async function startDiagnosis(
  plantId: string,
  files: { kind: PhotoKind; file: Blob }[],
  providerId: ProviderId,
  deps: StartDeps = {},
): Promise<Diagnosis> {
  const store = deps.storePhoto ?? savePhoto;
  const photos: Photo[] = [];
  for (const f of files) photos.push(await store(plantId, f.file));
  const now = new Date();
  const d: Diagnosis = {
    id: crypto.randomUUID(),
    plantId,
    createdAt: now.toISOString(),
    date: todayLocal(now),
    provider: providerId,
    model: '',
    photoIds: photos.map((p) => p.id),
    photoKinds: files.map((f) => f.kind),
    answers: [],
    status: 'en-cours',
    error: null,
    result: null,
  };
  await saveDiagnosis(d);
  return runDiagnosis(d.id, deps);
}

/** Lance (ou relance) l'analyse. Ne rejette jamais : les erreurs passent en statut « erreur ». */
export async function runDiagnosis(id: string, deps: AiDeps = {}): Promise<Diagnosis> {
  const d = await getDiagnosis(id);
  if (!d) throw new Error('Diagnostic introuvable');
  d.status = 'en-cours';
  d.error = null;
  await saveDiagnosis(d);
  try {
    const plant = await getPlant(d.plantId);
    if (!plant) throw new Error('Plante introuvable');
    const { provider, key, model } = await resolveProvider(d.provider, deps);
    d.model = model;

    const previous = (await db.diagnoses.where('plantId').equals(d.plantId).toArray())
      .filter((x) => x.id !== d.id && x.status === 'termine' && x.createdAt < d.createdAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const own = await db.photos.bulkGet(d.photoIds);
    const images: AiImage[] = [];
    for (const ph of own) if (ph) images.push(await blobToAiImage(ph.blob));
    let hasPreviousPhoto = false;
    if (previous) {
      const idx = Math.max(0, previous.photoKinds.indexOf('ensemble'));
      const prevPhoto = previous.photoIds[idx] ? await db.photos.get(previous.photoIds[idx]) : undefined;
      if (prevPhoto) {
        images.push(await blobToAiImage(prevPhoto.blob));
        hasPreviousPhoto = true;
      }
    }
    const care = await listCare(d.plantId);
    const ctx = buildContext(plant, care, previous, d.photoKinds, d.answers, d.date, hasPreviousPhoto);
    const text = await provider.generateJson({ key, model, prompt: buildDiagnosisPrompt(ctx), images });
    const result = parseDiagnosis(extractJson(text));
    if (!hasPreviousPhoto) result.trend = 'inconnue';
    d.result = result;
    d.status = result.confidence < 0.6 && result.questions.length > 0 && d.answers.length === 0 ? 'questions' : 'termine';
  } catch (e) {
    d.status = 'erreur';
    d.error = e instanceof AiError ? e.message : 'Analyse impossible. Réessayez.';
  }
  await saveDiagnosis(d);
  return d;
}

export async function answerQuestions(
  id: string,
  answers: { question: string; answer: string }[],
  deps: AiDeps = {},
): Promise<Diagnosis> {
  const d = await getDiagnosis(id);
  if (!d) throw new Error('Diagnostic introuvable');
  d.answers = answers;
  await saveDiagnosis(d);
  return runDiagnosis(id, deps);
}

export async function markActionDone(diagnosisId: string, index: number): Promise<void> {
  const d = await getDiagnosis(diagnosisId);
  const action = d?.result?.actions[index];
  if (!d || !action || action.doneAt) return;
  action.doneAt = new Date().toISOString();
  await saveDiagnosis(d);
  if (action.careType) {
    const plant = await getPlant(d.plantId);
    await logCare({
      plantId: d.plantId,
      type: action.careType,
      date: todayLocal(),
      amountMl: action.careType === 'arrosage' ? (plant?.waterAmountMl ?? null) : null,
      notes: action.action,
    });
  }
}

export async function generateSpeciesSheet(plantId: string, deps: AiDeps & { providerId?: ProviderId } = {}): Promise<SpeciesSheet> {
  const plant = await getPlant(plantId);
  if (!plant) throw new Error('Plante introuvable');
  const settings = deps.settings ?? (await loadAiSettings());
  const providerId = deps.providerId ?? settings.defaultProvider;
  const { provider, key, model } = await resolveProvider(providerId, { ...deps, settings });
  const images: AiImage[] = [];
  if (plant.photoId) {
    const ph = await db.photos.get(plant.photoId);
    if (ph) images.push(await blobToAiImage(ph.blob));
  }
  const text = await provider.generateJson({ key, model, prompt: buildSpeciesPrompt(plant.name, plant.species), images });
  const parsed = parseSpeciesSheet(extractJson(text));
  const sheet: SpeciesSheet = { ...parsed, generatedAt: new Date().toISOString(), provider: providerId };
  const careFrequencyDays = { ...parsed.frequencies, ...plant.careFrequencyDays };
  await updatePlant(plantId, {
    speciesSheet: sheet,
    species: plant.species?.trim() ? plant.species : sheet.species,
    careFrequencyDays,
  });
  return sheet;
}
