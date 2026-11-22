<script lang="ts">
  import { CARE_ICONS, CARE_LABELS } from '../lib/types';
  import type { CareType } from '../lib/types';
  import { parseAmount, todayLocal } from '../lib/dates';
  import { untrack } from 'svelte';

  let {
    type,
    defaultAmount,
    onsave,
    onclose,
  }: {
    type: CareType;
    defaultAmount: number | null;
    onsave: (v: { date: string; amountMl: number | null; notes: string }) => void;
    onclose: () => void;
  } = $props();

  let date = $state(todayLocal());
  const initialAmount = untrack(() => defaultAmount);
  let amount = $state(initialAmount != null ? String(initialAmount) : '');
  let notes = $state('');

  function save(e: SubmitEvent) {
    e.preventDefault();
    onsave({ date: date || todayLocal(), amountMl: type === 'arrosage' ? parseAmount(amount) : null, notes: notes.trim() });
  }
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>
<form class="sheet glass" onsubmit={save} aria-label={CARE_LABELS[type]}>
  <div class="grab"></div>
  <h2>{CARE_ICONS[type]} {CARE_LABELS[type]}</h2>
  <label class="field">Date<input type="date" bind:value={date} max={todayLocal()} /></label>
  {#if type === 'arrosage'}
    <label class="field">Quantité (mL)<input bind:value={amount} inputmode="decimal" placeholder="—" /></label>
  {/if}
  <label class="field">Notes<textarea bind:value={notes} placeholder={type === 'traitement' ? 'Produit utilisé…' : ''}></textarea></label>
  <div class="row">
    <button type="button" class="btn" onclick={onclose}>Annuler</button>
    <button type="submit" class="btn btn-primary">Enregistrer</button>
  </div>
</form>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 60;
    animation: fade 0.2s;
  }
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(560px, 100%);
    z-index: 61;
    display: grid;
    gap: 14px;
    padding: 10px 20px calc(20px + var(--safe-bottom));
    border-radius: 28px 28px 0 0;
    background: rgba(14, 30, 22, 0.94);
    animation: slide 0.35s var(--ease);
  }
  .grab {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.25);
    margin: 0 auto 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @keyframes slide {
    from {
      transform: translate(-50%, 100%);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
