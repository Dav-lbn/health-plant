<script lang="ts">
  import type { Plant } from '../lib/types';
  import { generateSpeciesSheet } from '../lib/diagnosis';
  import { refresh, showToast } from '../lib/stores.svelte';
  import { AiError } from '../lib/ai/parse';
  import { vibrate } from './haptics';

  let { plant }: { plant: Plant } = $props();
  let busy = $state(false);
  let error = $state('');
  let open = $state(true);

  async function generate() {
    busy = true;
    error = '';
    try {
      await generateSpeciesSheet(plant.id);
      await refresh();
      vibrate('success');
      showToast('Fiche d’espèce générée');
    } catch (e) {
      error = e instanceof AiError ? (e.detail ? `${e.message} (${e.detail})` : e.message) : 'Génération impossible.';
    } finally {
      busy = false;
    }
  }
</script>

{#if plant.speciesSheet}
  {@const s = plant.speciesSheet}
  <section class="glass sheet">
    <button class="head" onclick={() => (open = !open)} aria-expanded={open}>
      <span>
        <span class="eyebrow">Fiche d’espèce</span>
        <strong>{s.species}</strong>
      </span>
      <span class="chev" class:up={open}>⌄</span>
    </button>
    {#if open}
      <dl>
        <div><dt>☀️ Lumière</dt><dd>{s.light}</dd></div>
        <div><dt>💧 Eau</dt><dd>{s.water}</dd></div>
        <div><dt>💦 Humidité</dt><dd>{s.humidity}</dd></div>
        <div><dt>🌡️ Température</dt><dd>{s.temperature}</dd></div>
        <div class="tox"><dt>⚠️ Toxicité</dt><dd>{s.toxicity}</dd></div>
      </dl>
      {#if s.tips.length}
        <ul>
          {#each s.tips as t}<li>{t}</li>{/each}
        </ul>
      {/if}
      <button class="btn btn-ghost regen" onclick={generate} disabled={busy}>{busy ? 'Génération…' : '↻ Régénérer'}</button>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>
{:else}
  <section class="glass empty">
    <button class="btn" onclick={generate} disabled={busy}>{busy ? '✨ Génération…' : '✨ Générer la fiche d’espèce'}</button>
    <p class="muted small">L’IA identifie l’espèce et rédige ses besoins (lumière, eau, toxicité…).</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>
{/if}

<style>
  section {
    padding: 14px 16px;
    display: grid;
    gap: 10px;
  }
  section > * {
    position: relative;
    z-index: 1;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    padding: 0;
    cursor: pointer;
  }
  .head > span:first-child {
    display: grid;
  }
  .eyebrow {
    color: var(--accent);
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  strong {
    font-size: 1.05rem;
    font-style: italic;
  }
  .chev {
    font-size: 1.4rem;
    transition: transform 0.2s;
  }
  .chev.up {
    transform: rotate(180deg);
  }
  dl {
    margin: 0;
    display: grid;
    gap: 8px;
  }
  dl div {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 8px;
  }
  dt {
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.88rem;
  }
  dd {
    margin: 0;
    font-size: 0.92rem;
  }
  .tox dd {
    color: var(--warn);
  }
  ul {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 4px;
    font-size: 0.92rem;
  }
  .regen {
    justify-self: end;
    font-size: 0.85rem;
    min-height: 36px;
  }
  .empty {
    justify-items: center;
    text-align: center;
  }
  .small {
    font-size: 0.82rem;
    margin: 0;
  }
  .error {
    color: #ffb3ab;
    margin: 0;
    font-size: 0.9rem;
  }
</style>
