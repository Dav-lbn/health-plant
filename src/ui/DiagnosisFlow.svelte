<script lang="ts">
  import { onMount } from 'svelte';
  import { app, refresh } from '../lib/stores.svelte';
  import { startDiagnosis } from '../lib/diagnosis';
  import { loadAiSettings, hasKey, type AiSettings } from '../lib/ai/settings';
  import { navigate } from '../lib/router';
  import { PHOTO_KINDS, PHOTO_KIND_LABELS, PROVIDER_LABELS } from '../lib/types';
  import type { PhotoKind, ProviderId } from '../lib/types';
  import Analyzing from './Analyzing.svelte';
  import { vibrate } from './haptics';

  let { id }: { id: string } = $props();
  const plant = $derived(app.plants.find((p) => p.id === id));

  const TIPS: Record<PhotoKind, string> = {
    ensemble: 'Toute la plante, bien éclairée, sans contre-jour',
    'gros-plan': 'Au plus près de la zone abîmée',
    dessous: 'Retournez une feuille',
    terre: 'La surface du pot',
  };
  const ICONS: Record<PhotoKind, string> = { ensemble: '🪴', 'gros-plan': '🔍', dessous: '🍃', terre: '🟫' };

  let files = $state<Partial<Record<PhotoKind, File>>>({});
  let previews = $state<Partial<Record<PhotoKind, string>>>({});
  let settings = $state<AiSettings | null>(null);
  let provider = $state<ProviderId>('gemini');
  let busy = $state(false);
  let error = $state('');

  onMount(async () => {
    settings = await loadAiSettings();
    provider = settings.defaultProvider;
    if (!hasKey(provider, settings)) {
      const other: ProviderId = provider === 'gemini' ? 'mistral' : 'gemini';
      if (hasKey(other, settings)) provider = other;
    }
  });

  const anyKey = $derived(!!settings && (hasKey('gemini', settings) || hasKey('mistral', settings)));

  function pick(kind: PhotoKind, e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (previews[kind]) URL.revokeObjectURL(previews[kind]!);
    files[kind] = f;
    previews[kind] = URL.createObjectURL(f);
    vibrate('tap');
  }

  function clear(kind: PhotoKind) {
    if (previews[kind]) URL.revokeObjectURL(previews[kind]!);
    delete files[kind];
    delete previews[kind];
  }

  async function analyze() {
    if (!files.ensemble) return;
    busy = true;
    error = '';
    try {
      const list = PHOTO_KINDS.filter((k) => files[k]).map((k) => ({ kind: k, file: files[k]! }));
      const d = await startDiagnosis(id, list, provider);
      await refresh();
      vibrate('success');
      navigate({ name: 'diagnosis', id, diagId: d.id }, true);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Analyse impossible.';
      busy = false;
    }
  }
</script>

<div class="flow">
  <header class="top">
    <a class="btn btn-icon btn-ghost" href={`#/plante/${id}`} aria-label="Retour">‹</a>
    <div>
      <p class="eyebrow">Diagnostic</p>
      <h1>{plant?.name ?? ''}</h1>
    </div>
  </header>

  {#if busy}
    <Analyzing text={`Analyse par ${PROVIDER_LABELS[provider]}…`} />
  {:else}
    <p class="muted intro">Prenez 1 à 4 photos. Plus elles sont nettes et variées, plus le diagnostic est précis.</p>

    <div class="slots">
      {#each PHOTO_KINDS as k}
        <div class="slot glass" class:filled={!!previews[k]} class:required={k === 'ensemble'}>
          <label class="pick">
            {#if previews[k]}
              <img src={previews[k]} alt={PHOTO_KIND_LABELS[k]} />
            {:else}
              <span class="ico">{ICONS[k]}</span>
            {/if}
            <span class="name">{PHOTO_KIND_LABELS[k]}{k === 'ensemble' ? ' *' : ''}</span>
            <span class="tip">{TIPS[k]}</span>
            <input type="file" accept="image/*" capture="environment" hidden onchange={(e) => pick(k, e)} data-testid={`slot-${k}`} />
          </label>
          {#if previews[k]}
            <button class="rm" aria-label={`Retirer ${PHOTO_KIND_LABELS[k]}`} onclick={() => clear(k)}>✕</button>
          {/if}
        </div>
      {/each}
    </div>

    {#if settings}
      <div class="glass who">
        <span class="label">Analyser avec</span>
        <div class="seg">
          {#each ['gemini', 'mistral'] as const as p}
            <button class:on={provider === p} disabled={!hasKey(p, settings)} aria-pressed={provider === p} onclick={() => (provider = p)}>
              {PROVIDER_LABELS[p]}
            </button>
          {/each}
        </div>
        {#if !anyKey}
          <p class="warn">Aucune clé d’IA configurée. <a href="#/reglages">Ajoutez-en une dans les Réglages</a>.</p>
        {/if}
      </div>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <button class="btn btn-primary go" disabled={!files.ensemble || !anyKey} onclick={analyze}>🔬 Analyser</button>
    {#if !files.ensemble}<p class="muted small center">Ajoutez au moins la vue d’ensemble.</p>{/if}
  {/if}
</div>

<style>
  .flow {
    display: grid;
    gap: 14px;
    padding-bottom: 24px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .top .btn {
    font-size: 1.8rem;
  }
  .top h1 {
    margin: 0;
  }
  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .intro {
    margin: 0;
  }
  .slots {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .slot {
    position: relative;
    border-style: dashed;
    border-radius: 20px;
    min-height: 160px;
  }
  .slot.required {
    border-color: rgba(70, 227, 138, 0.55);
  }
  .slot.filled {
    border-style: solid;
  }
  .pick {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 4px;
    min-height: 160px;
    padding: 12px;
    text-align: center;
    cursor: pointer;
  }
  .pick img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }
  .filled .pick::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.75));
    z-index: -1;
  }
  .filled .pick {
    align-content: end;
  }
  .ico {
    font-size: 2rem;
  }
  .name {
    font-weight: 700;
    font-size: 0.9rem;
  }
  .tip {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .filled .tip {
    display: none;
  }
  .rm {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.6);
    color: white;
    cursor: pointer;
  }
  .who {
    padding: 14px;
    display: grid;
    gap: 8px;
  }
  .who > * {
    position: relative;
    z-index: 1;
  }
  .label {
    font-size: 0.9rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--glass-border);
  }
  .seg button {
    min-height: 40px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .seg button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .seg button.on {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #04170d;
  }
  .warn {
    margin: 0;
    color: var(--warn);
    font-size: 0.9rem;
  }
  .warn a {
    color: var(--accent);
  }
  .go {
    min-height: 56px;
    font-size: 1.1rem;
  }
  .go:disabled {
    opacity: 0.45;
    box-shadow: none;
  }
  .error {
    color: #ffb3ab;
    margin: 0;
  }
  .small {
    font-size: 0.82rem;
    margin: 0;
  }
  .center {
    text-align: center;
  }
</style>
