export type Season = 'hiver' | 'printemps' | 'été' | 'automne';

/** Saison de l'hémisphère nord pour une date YYYY-MM-DD. */
export function season(date: string): Season {
  const m = Number(date.slice(5, 7));
  if (m === 12 || m <= 2) return 'hiver';
  if (m <= 5) return 'printemps';
  if (m <= 8) return 'été';
  return 'automne';
}
