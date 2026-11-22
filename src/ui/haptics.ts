export function vibrate(kind: 'tap' | 'success'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(kind === 'tap' ? 10 : [10, 40, 20]);
  } catch {
    /* ignoré */
  }
}
