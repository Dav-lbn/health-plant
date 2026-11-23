import { describe, test, expect } from 'vitest';
import { addDays, baseFrequency, observedWateringInterval, wateringInterval, buildTasks, nextWatering } from '../src/lib/schedule';
import type { CareEvent, Diagnosis, Plant } from '../src/lib/types';

const plant = (over: Partial<Plant> = {}): Plant => ({
  id: 'p1', name: 'Monstera', species: null, roomId: null, exposure: null, waterAmountMl: 250, notes: '', photoId: null,
  careFrequencyDays: {}, speciesSheet: null, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', ...over,
});
let n = 0;
const ev = (type: CareEvent['type'], date: string, plantId = 'p1'): CareEvent => ({
  id: `e${n++}`, plantId, type, date, amountMl: null, notes: '', createdAt: `${date}T10:00:00Z`,
});
const sheet = (freq: Record<string, number>) => ({
  species: 's', light: '', water: '', humidity: '', temperature: '', toxicity: '', tips: [], frequencies: freq, generatedAt: '', provider: 'gemini' as const,
});

test('addDays', () => {
  expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
  expect(addDays('2026-11-22', -22)).toBe('2026-10-31');
});

describe('fréquences', () => {
  test('careFrequencyDays prioritaire, repli sur la fiche, sinon null', () => {
    expect(baseFrequency(plant({ careFrequencyDays: { arrosage: 5 }, speciesSheet: sheet({ arrosage: 9 }) }), 'arrosage')).toBe(5);
    expect(baseFrequency(plant({ speciesSheet: sheet({ arrosage: 9 }) }), 'arrosage')).toBe(9);
    expect(baseFrequency(plant(), 'arrosage')).toBeNull();
  });

  test('intervalle observé : médiane, 0 ignoré', () => {
    const e = ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-15', '2026-11-22'].map((d) => ev('arrosage', d));
    expect(observedWateringInterval([...e, ev('engrais', '2026-11-10')])).toBe(7);
    expect(observedWateringInterval([ev('arrosage', '2026-11-01'), ev('arrosage', '2026-11-08')])).toBeNull();
  });

  test('saison : été ×0.85, hiver mélangé avec l’observé', () => {
    expect(wateringInterval(plant({ careFrequencyDays: { arrosage: 10 } }), [], '2026-07-10')).toBe(9);
    const e = ['2026-11-01', '2026-11-08', '2026-11-15'].map((d) => ev('arrosage', d));
    expect(wateringInterval(plant({ careFrequencyDays: { arrosage: 10 } }), e, '2026-01-10')).toBe(11);
    expect(wateringInterval(plant(), e, '2026-01-10')).toBe(7);
    expect(wateringInterval(plant(), [], '2026-01-10')).toBeNull();
  });

  test('nextWatering', () => {
    expect(nextWatering(plant({ careFrequencyDays: { arrosage: 8 } }), [ev('arrosage', '2026-11-20')], '2026-11-22')).toEqual({ due: '2026-11-30', interval: 10 });
  });
});

describe('buildTasks', () => {
  const today = '2026-04-15'; // printemps : coefficient 1

  test('jamais arrosée → arrosage dû aujourd’hui', () => {
    const t = buildTasks([plant({ careFrequencyDays: { arrosage: 7 } })], [], [], {}, today);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ id: 'care:p1:arrosage:none', kind: 'care', careType: 'arrosage', label: 'Arroser', detail: '250 mL', due: today, status: 'aujourdhui', daysLate: 0 });
  });

  test('en retard de 2 jours', () => {
    const t = buildTasks([plant({ careFrequencyDays: { arrosage: 10 } })], [ev('arrosage', '2026-04-03')], [], {}, today);
    expect(t[0]).toMatchObject({ id: 'care:p1:arrosage:2026-04-03', status: 'retard', daysLate: 2, due: '2026-04-13' });
  });

  test('report puis nouveau soin', () => {
    const p = plant({ careFrequencyDays: { arrosage: 7 } });
    const postponed = { 'care:p1:arrosage:none': '2026-04-16' };
    expect(buildTasks([p], [], [], postponed, today)[0]).toMatchObject({ status: 'bientot', due: '2026-04-16' });
    const after = buildTasks([p], [ev('arrosage', '2026-04-15')], [], postponed, today);
    expect(after[0]).toMatchObject({ id: 'care:p1:arrosage:2026-04-15', due: '2026-04-22' });
  });

  test('engrais sans historique : référence = création', () => {
    const t = buildTasks([plant({ careFrequencyDays: { engrais: 30 }, createdAt: '2026-03-06T10:00:00.000Z' })], [], [], {}, today);
    expect(t[0]).toMatchObject({ careType: 'engrais', label: 'Donner de l’engrais', status: 'retard', daysLate: 10 });
  });

  test('actions du dernier diagnostic terminé seulement', () => {
    const base = { plantId: 'p1', provider: 'gemini' as const, model: 'm', photoIds: [], photoKinds: [], answers: [], error: null };
    const result = (actions: { action: string; delayDays: number; doneAt: string | null }[]) => ({
      state: 'surveiller' as const, summary: 's', problems: [], confidence: 0.9, questions: [], trend: 'inconnue' as const, suggestedSpecies: null,
      actions: actions.map((a) => ({ ...a, careType: null, priority: 'moyenne' as const })),
    });
    const old: Diagnosis = { ...base, id: 'd1', createdAt: '2026-04-01T10:00:00Z', date: '2026-04-01', status: 'termine', result: result([{ action: 'Ancienne', delayDays: 0, doneAt: null }]) };
    const recent: Diagnosis = { ...base, id: 'd2', createdAt: '2026-04-14T10:00:00Z', date: '2026-04-14', status: 'termine', result: result([
      { action: 'Rapprocher de la fenêtre', delayDays: 1, doneAt: null },
      { action: 'Déjà fait', delayDays: 0, doneAt: '2026-04-14T12:00:00Z' },
    ]) };
    const failed: Diagnosis = { ...base, id: 'd3', createdAt: '2026-04-15T09:00:00Z', date: '2026-04-15', status: 'erreur', result: null };
    const t = buildTasks([plant()], [], [old, recent, failed], {}, today);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ id: 'action:d2:0', kind: 'action', label: 'Rapprocher de la fenêtre', due: '2026-04-15', status: 'aujourdhui', diagnosisId: 'd2', actionIndex: 0 });
    expect(t[0].detail).toBe('Diagnostic du 14 avr. 2026');
  });

  test('sans fréquence → aucune tâche ; horizon de 7 jours', () => {
    expect(buildTasks([plant()], [], [], {}, today)).toEqual([]);
    const far = buildTasks([plant({ careFrequencyDays: { arrosage: 10 } })], [ev('arrosage', '2026-04-14')], [], {}, today);
    expect(far).toEqual([]);
    const near = buildTasks([plant({ careFrequencyDays: { arrosage: 7 } })], [ev('arrosage', '2026-04-14')], [], {}, today);
    expect(near[0]).toMatchObject({ status: 'bientot', due: '2026-04-21' });
  });

  test('tri par échéance puis nom', () => {
    const a = plant({ id: 'a', name: 'Zamioculcas', careFrequencyDays: { arrosage: 7 } });
    const b = plant({ id: 'b', name: 'Aloe', careFrequencyDays: { arrosage: 7 } });
    const c = plant({ id: 'c', name: 'Cactus', careFrequencyDays: { arrosage: 3 } });
    const t = buildTasks([a, b, c], [ev('arrosage', '2026-04-10', 'c')], [], {}, today);
    expect(t.map((x) => x.plantId)).toEqual(['c', 'b', 'a']);
  });
});
