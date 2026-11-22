<script lang="ts">
  import { CARE_ICONS, CARE_LABELS, CARE_TYPES } from '../lib/types';
  import type { CareType, CareEvent, Plant } from '../lib/types';
  import { daysSinceLast } from '../lib/care';
  import { relativeDays, todayLocal } from '../lib/dates';
  import { deleteCare, logCare } from '../lib/repo';
  import { refresh, showToast } from '../lib/stores.svelte';
  import CareSheet from './CareSheet.svelte';
  import { vibrate } from './haptics';

  let { plant, events }: { plant: Plant; events: CareEvent[] } = $props();
  let sheet = $state<CareType | null>(null);

  async function record(type: CareType, v: { date: string; amountMl: number | null; notes: string }) {
    const e = await logCare({ plantId: plant.id, type, ...v });
    await refresh();
    vibrate('success');
    showToast(`${CARE_LABELS[type]} enregistré`, {
      label: 'Annuler',
      run: async () => {
        await deleteCare(e.id);
        await refresh();
      },
    });
  }

  function quick(type: CareType) {
    if (type === 'arrosage') {
      record(type, { date: todayLocal(), amountMl: plant.waterAmountMl, notes: '' });
    } else {
      vibrate('tap');
      sheet = type;
    }
  }

  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;
  function down(type: CareType) {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      vibrate('tap');
      sheet = type;
    }, 500);
  }
  function up(type: CareType) {
    clearTimeout(pressTimer);
    if (!longPressed) quick(type);
  }
</script>

<div class="actions">
  {#each CARE_TYPES as t}
    {@const d = daysSinceLast(events, t, todayLocal())}
    <button
      class="care glass"
      class:water={t === 'arrosage'}
      onpointerdown={() => down(t)}
      onpointerup={() => up(t)}
      onpointerleave={() => clearTimeout(pressTimer)}
      onclick={(e) => { if (e.detail === 0) quick(t); }}
      oncontextmenu={(e) => e.preventDefault()}
      aria-label={t === 'arrosage' ? 'Arrosé' : CARE_LABELS[t]}
    >
      <span class="ico">{CARE_ICONS[t]}</span>
      <span class="name">{t === 'arrosage' ? 'Arrosé' : CARE_LABELS[t]}</span>
      <span class="when">{d == null ? '—' : relativeDays(d)}</span>
    </button>
  {/each}
</div>
<p class="hint muted">Appui long pour choisir la date ou ajouter une note.</p>

{#if sheet}
  <CareSheet
    type={sheet}
    defaultAmount={plant.waterAmountMl}
    onclose={() => (sheet = null)}
    onsave={(v) => {
      const t = sheet!;
      sheet = null;
      record(t, v);
    }}
  />
{/if}

<style>
  .actions {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }
  .care {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 12px 4px 10px;
    border-radius: 18px;
    color: var(--text);
    font: inherit;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    transition: transform 0.15s var(--ease);
  }
  .care:active {
    transform: scale(0.94);
  }
  .care.water {
    background: linear-gradient(160deg, rgba(70, 200, 255, 0.22), rgba(20, 90, 140, 0.15));
    border-color: rgba(120, 210, 255, 0.4);
    box-shadow: 0 8px 26px rgba(70, 180, 255, 0.18);
  }
  .ico {
    font-size: 1.5rem;
  }
  .name {
    font-size: 0.78rem;
    font-weight: 700;
  }
  .when {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .hint {
    font-size: 0.75rem;
    margin: 6px 4px 0;
  }
  @media (max-width: 360px) {
    .name {
      font-size: 0.7rem;
    }
  }
</style>
