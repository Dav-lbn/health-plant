import { CARE_TYPES, HEALTH_STATES, TRENDS } from '../types';
import type { CareType, DiagnosisResult, HealthState, Problem, RecommendedAction, SpeciesSheet, Trend } from '../types';

export type AiErrorKind = 'cle' | 'quota' | 'reseau' | 'reponse' | 'modele';

const MESSAGES: Record<AiErrorKind, string> = {
  cle: 'Clé API refusée. Vérifiez-la dans les Réglages.',
  quota: 'Quota gratuit atteint. Réessayez plus tard ou changez d’IA.',
  reseau: 'Pas de connexion à l’IA. Vérifiez internet (ou le relais pour Mistral).',
  reponse: 'Réponse de l’IA illisible. Réessayez.',
  modele: 'Modèle indisponible, choisissez-en un autre dans les Réglages.',
};

export class AiError extends Error {
  constructor(public kind: AiErrorKind) {
    super(MESSAGES[kind]);
    this.name = 'AiError';
  }
}

/** Extrait le premier objet JSON d'un texte (JSON pur, bloc ```json, ou texte autour). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* on cherche plus loin */
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* on cherche plus loin */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* échec */
    }
  }
  throw new AiError('reponse');
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');
const oneOf = <T extends string>(x: unknown, list: readonly T[], fallback: T): T =>
  typeof x === 'string' && (list as readonly string[]).includes(x) ? (x as T) : fallback;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export function parseDiagnosis(raw: unknown): DiagnosisResult {
  if (!isObj(raw)) throw new AiError('reponse');
  const problems: Problem[] = arr(raw.problems)
    .filter(isObj)
    .map((p) => ({
      name: str(p.name),
      cause: str(p.cause),
      severity: oneOf(p.severity, ['faible', 'moyenne', 'forte'] as const, 'moyenne'),
    }))
    .filter((p) => p.name);
  const actions: RecommendedAction[] = arr(raw.actions)
    .filter(isObj)
    .map((a) => ({
      action: str(a.action),
      careType: oneOf<CareType | 'none'>(a.careType, CARE_TYPES, 'none') === 'none' ? null : (a.careType as CareType),
      priority: oneOf(a.priority, ['haute', 'moyenne', 'basse'] as const, 'moyenne'),
      delayDays: typeof a.delayDays === 'number' && Number.isFinite(a.delayDays) ? Math.max(0, Math.round(a.delayDays)) : 0,
      doneAt: null,
    }))
    .filter((a) => a.action);
  const summary = str(raw.summary);
  if (!summary && !problems.length && !actions.length) throw new AiError('reponse');
  const c = typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : 0.5;
  return {
    state: oneOf<HealthState>(raw.state, HEALTH_STATES, 'surveiller'),
    summary,
    problems,
    actions,
    confidence: Math.min(1, Math.max(0, c)),
    questions: arr(raw.questions).map(str).filter(Boolean).slice(0, 3),
    trend: oneOf<Trend>(raw.trend, TRENDS, 'inconnue'),
    suggestedSpecies: str(raw.suggestedSpecies) || null,
  };
}

export function parseSpeciesSheet(raw: unknown): Omit<SpeciesSheet, 'generatedAt' | 'provider'> {
  if (!isObj(raw) || !str(raw.species)) throw new AiError('reponse');
  const frequencies: Partial<Record<CareType, number>> = {};
  if (isObj(raw.frequencies)) {
    for (const t of CARE_TYPES) {
      const v = raw.frequencies[t];
      if (typeof v === 'number' && Number.isFinite(v)) {
        const n = Math.round(v);
        if (n >= 1 && n <= 365) frequencies[t] = n;
      }
    }
  }
  return {
    species: str(raw.species),
    light: str(raw.light),
    water: str(raw.water),
    humidity: str(raw.humidity),
    temperature: str(raw.temperature),
    toxicity: str(raw.toxicity),
    tips: arr(raw.tips).map(str).filter(Boolean).slice(0, 8),
    frequencies,
  };
}
