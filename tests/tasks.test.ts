// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, test, expect } from 'vitest';
import { db } from '../src/lib/db';
import { createPlant, listCare, saveDiagnosis, getDiagnosis } from '../src/lib/repo';
import { loadPostponed, postponeTask, completeTask } from '../src/lib/tasks';
import { todayLocal } from '../src/lib/dates';
import { addDays, type Task } from '../src/lib/schedule';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const newPlant = () =>
  createPlant({ name: 'Ficus', species: null, roomId: null, exposure: null, waterAmountMl: 300, notes: '', photoId: null, careFrequencyDays: { arrosage: 7 } });

test('report enregistré puis relu', async () => {
  expect(await loadPostponed()).toEqual({});
  await postponeTask('care:p:arrosage:none', '2026-12-01');
  expect(await loadPostponed()).toEqual({ 'care:p:arrosage:none': '2026-12-01' });
});

test('reports de plus de 30 jours purgés', async () => {
  const old = addDays(todayLocal(), -31);
  await db.meta.put({ key: 'postponed', value: { vieux: old, recent: addDays(todayLocal(), -5) } });
  await postponeTask('nouveau', addDays(todayLocal(), 1));
  expect(Object.keys(await loadPostponed()).sort()).toEqual(['nouveau', 'recent']);
});

test('accomplir une tâche d’arrosage crée le soin du jour', async () => {
  const p = await newPlant();
  const task: Task = { id: 'care', plantId: p.id, kind: 'care', careType: 'arrosage', label: 'Arroser', detail: null, due: todayLocal(), status: 'aujourdhui', daysLate: 0 };
  await completeTask(task, p);
  const care = await listCare(p.id);
  expect(care).toHaveLength(1);
  expect(care[0]).toMatchObject({ type: 'arrosage', date: todayLocal(), amountMl: 300 });
});

test('accomplir une action de diagnostic', async () => {
  const p = await newPlant();
  await saveDiagnosis({
    id: 'd1', plantId: p.id, createdAt: new Date().toISOString(), date: todayLocal(), provider: 'gemini', model: 'm',
    photoIds: [], photoKinds: [], answers: [], status: 'termine', error: null,
    result: {
      state: 'surveiller', summary: 's', problems: [], confidence: 0.9, questions: [], trend: 'inconnue', suggestedSpecies: null,
      actions: [{ action: 'Traiter contre les cochenilles', careType: 'traitement', priority: 'haute', delayDays: 0, doneAt: null }],
    },
  });
  const task: Task = { id: 'action:d1:0', plantId: p.id, kind: 'action', careType: 'traitement', label: 'x', detail: null, due: todayLocal(), status: 'aujourdhui', daysLate: 0, diagnosisId: 'd1', actionIndex: 0 };
  await completeTask(task, p);
  expect((await getDiagnosis('d1'))?.result?.actions[0].doneAt).toBeTruthy();
  const care = await listCare(p.id);
  expect(care[0]).toMatchObject({ type: 'traitement', notes: 'Traiter contre les cochenilles' });
});
