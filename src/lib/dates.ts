const pad = (n: number) => String(n).padStart(2, '0');

/** Date locale du jour au format YYYY-MM-DD. */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toUtcDay(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/** Nombre de jours de a à b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(toUtcDay(b) - toUtcDay(a));
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function formatDateFr(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** Quantité en mL saisie par l'utilisateur ; null si vide, invalide ou négative. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** « aujourd'hui », « hier », « il y a N j ». */
export function relativeDays(n: number): string {
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  return `il y a ${n} j`;
}
