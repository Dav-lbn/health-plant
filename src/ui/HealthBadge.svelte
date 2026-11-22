<script lang="ts">
  import { STATE_LABELS } from '../lib/types';
  import type { HealthState } from '../lib/types';

  let { state, size = 'sm' }: { state: HealthState; size?: 'sm' | 'lg' } = $props();
  const ICONS: Record<HealthState, string> = { bon: '🌿', surveiller: '⚠️', malade: '🩺' };
</script>

<span class="badge {state} {size}">
  <span class="ico" aria-hidden="true">{ICONS[state]}</span>
  {STATE_LABELS[state]}
</span>

<style>
  .badge {
    --c: var(--ok);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 750;
    border-radius: 999px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, rgba(0, 0, 0, 0.45));
    border: 1px solid color-mix(in srgb, var(--c) 50%, transparent);
    box-shadow: 0 0 18px color-mix(in srgb, var(--c) 30%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    white-space: nowrap;
  }
  .surveiller {
    --c: var(--warn);
  }
  .malade {
    --c: var(--bad);
  }
  .sm {
    padding: 4px 10px;
    font-size: 0.8rem;
  }
  .lg {
    padding: 10px 20px;
    font-size: 1.25rem;
    box-shadow:
      0 0 40px color-mix(in srgb, var(--c) 40%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  .lg .ico {
    font-size: 1.5rem;
  }
</style>
