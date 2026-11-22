import { daysBetween, todayLocal } from './dates';
import type { CareEvent, CareType, Photo } from './types';

export function daysSinceLast(events: CareEvent[], type: CareType, today: string): number | null {
  let last: string | null = null;
  for (const e of events) if (e.type === type && (!last || e.date > last)) last = e.date;
  return last ? daysBetween(last, today) : null;
}

export type TimelineItem =
  | { kind: 'care'; date: string; event: CareEvent }
  | { kind: 'photo'; date: string; photo: Photo };

export function buildTimeline(events: CareEvent[], photos: Photo[]): TimelineItem[] {
  const items: (TimelineItem & { ts: string })[] = [
    ...events.map((event) => ({ kind: 'care' as const, date: event.date, event, ts: event.createdAt })),
    ...photos.map((photo) => ({ kind: 'photo' as const, date: todayLocal(new Date(photo.takenAt)), photo, ts: photo.takenAt })),
  ];
  const rank = (i: TimelineItem) => (i.kind === 'care' ? 0 : 1);
  items.sort((a, b) => b.date.localeCompare(a.date) || rank(a) - rank(b) || b.ts.localeCompare(a.ts));
  return items.map(({ ts: _ts, ...i }) => i as TimelineItem);
}
