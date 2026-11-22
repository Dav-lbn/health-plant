import { db } from './db';
import { logCare } from './repo';
import { markActionDone } from './diagnosis';
import { daysBetween, todayLocal } from './dates';
import type { Task } from './schedule';
import type { CareEvent, Plant } from './types';

const KEY = 'postponed';

export async function loadPostponed(): Promise<Record<string, string>> {
  const v = (await db.meta.get(KEY))?.value;
  return v && typeof v === 'object' ? { ...(v as Record<string, string>) } : {};
}

/** Reporte une tâche ; purge au passage les reports échus depuis plus de 30 jours. */
export async function postponeTask(id: string, until: string): Promise<void> {
  const today = todayLocal();
  const current = await loadPostponed();
  const kept: Record<string, string> = {};
  for (const [k, d] of Object.entries(current)) if (daysBetween(d, today) <= 30) kept[k] = d;
  kept[id] = until;
  await db.meta.put({ key: KEY, value: kept });
}

/** Accomplit une tâche ; renvoie le soin créé (pour pouvoir l'annuler), s'il y en a un. */
export async function completeTask(task: Task, plant: Plant): Promise<CareEvent | null> {
  if (task.kind === 'action' && task.diagnosisId != null && task.actionIndex != null) {
    await markActionDone(task.diagnosisId, task.actionIndex);
    return null;
  }
  if (!task.careType) return null;
  return logCare({
    plantId: task.plantId,
    type: task.careType,
    date: todayLocal(),
    amountMl: task.careType === 'arrosage' ? plant.waterAmountMl : null,
    notes: '',
  });
}
