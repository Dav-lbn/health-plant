import { daysBetween, formatDateFr, todayLocal } from './dates';
import { season, type Season } from './season';
import { CARE_TYPES } from './types';
import type { CareEvent, CareType, Diagnosis, Plant } from './types';

export const SEASON_FACTOR: Record<Season, number> = { hiver: 1.5, automne: 1.25, printemps: 1, été: 0.85 };

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return todayLocal(new Date(y, m - 1, d + n, 12));
}

export function baseFrequency(plant: Plant, type: CareType): number | null {
  const own = plant.careFrequencyDays[type];
  if (own && own > 0) return own;
  const fromSheet = plant.speciesSheet?.frequencies?.[type];
  return fromSheet && fromSheet > 0 ? fromSheet : null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Médiane des 5 derniers intervalles entre arrosages (≥ 2 intervalles non nuls requis). */
export function observedWateringInterval(events: CareEvent[]): number | null {
  const dates = [...new Set(events.filter((e) => e.type === 'arrosage').map((e) => e.date))].sort();
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const g = daysBetween(dates[i - 1], dates[i]);
    if (g > 0) gaps.push(g);
  }
  const recent = gaps.slice(-5);
  return recent.length >= 2 ? median(recent) : null;
}

export function wateringInterval(plant: Plant, events: CareEvent[], today: string): number | null {
  const base = baseFrequency(plant, 'arrosage');
  const seasonal = base != null ? base * SEASON_FACTOR[season(today)] : null;
  const observed = observedWateringInterval(events);
  let v: number | null;
  if (seasonal != null && observed != null) v = (seasonal + observed) / 2;
  else v = seasonal ?? observed;
  return v == null ? null : Math.max(1, Math.round(v));
}

function lastDate(events: CareEvent[], type: CareType): string | null {
  let last: string | null = null;
  for (const e of events) if (e.type === type && (!last || e.date > last)) last = e.date;
  return last;
}

function intervalFor(plant: Plant, events: CareEvent[], type: CareType, today: string): number | null {
  return type === 'arrosage' ? wateringInterval(plant, events, today) : baseFrequency(plant, type);
}

export function nextWatering(plant: Plant, events: CareEvent[], today: string): { due: string; interval: number } | null {
  const interval = wateringInterval(plant, events, today);
  if (interval == null) return null;
  const last = lastDate(events, 'arrosage');
  return { due: last ? addDays(last, interval) : today, interval };
}

export interface Task {
  id: string;
  plantId: string;
  kind: 'care' | 'action';
  careType: CareType | null;
  label: string;
  detail: string | null;
  due: string;
  status: 'retard' | 'aujourdhui' | 'bientot';
  daysLate: number;
  diagnosisId?: string;
  actionIndex?: number;
}

export const CARE_TASK_LABELS: Record<CareType, string> = {
  arrosage: 'Arroser',
  engrais: 'Donner de l’engrais',
  rempotage: 'Rempoter',
  taille: 'Tailler',
  traitement: 'Traiter',
};

export function buildTasks(
  plants: Plant[],
  care: CareEvent[],
  diagnoses: Diagnosis[],
  postponed: Record<string, string>,
  today: string,
  horizonDays = 7,
): Task[] {
  const limit = addDays(today, horizonDays);
  const tasks: (Task & { plantName: string })[] = [];

  const push = (t: Omit<Task, 'status' | 'daysLate' | 'due'> & { due: string }, plantName: string) => {
    const due = postponed[t.id] && postponed[t.id] > t.due ? postponed[t.id] : t.due;
    if (due > limit) return;
    const late = daysBetween(due, today);
    tasks.push({ ...t, due, daysLate: Math.max(0, late), status: late > 0 ? 'retard' : late === 0 ? 'aujourdhui' : 'bientot', plantName });
  };

  for (const plant of plants) {
    const events = care.filter((e) => e.plantId === plant.id);
    for (const type of CARE_TYPES) {
      const interval = intervalFor(plant, events, type, today);
      if (interval == null) continue;
      const last = lastDate(events, type);
      const ref = last ?? (type === 'arrosage' ? null : todayLocal(new Date(plant.createdAt)));
      const due = ref ? addDays(ref, interval) : today;
      push(
        {
          id: `care:${plant.id}:${type}:${last ?? 'none'}`,
          plantId: plant.id,
          kind: 'care',
          careType: type,
          label: CARE_TASK_LABELS[type],
          detail: type === 'arrosage' && plant.waterAmountMl != null ? `${plant.waterAmountMl} mL` : null,
          due,
        },
        plant.name,
      );
    }

    const latest = diagnoses
      .filter((d) => d.plantId === plant.id && d.status === 'termine' && d.result)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    latest?.result?.actions.forEach((a, i) => {
      if (a.doneAt) return;
      push(
        {
          id: `action:${latest.id}:${i}`,
          plantId: plant.id,
          kind: 'action',
          careType: a.careType,
          label: a.action,
          detail: `Diagnostic du ${formatDateFr(latest.date)}`,
          due: addDays(latest.date, a.delayDays),
          diagnosisId: latest.id,
          actionIndex: i,
        },
        plant.name,
      );
    });
  }

  tasks.sort((a, b) => a.due.localeCompare(b.due) || a.plantName.localeCompare(b.plantName, 'fr'));
  return tasks.map(({ plantName: _n, ...t }) => t);
}
