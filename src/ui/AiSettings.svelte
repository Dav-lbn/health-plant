<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAiSettings, saveAiSettings, providerInstance, defaultAiSettings, type AiSettings } from '../lib/ai/settings';
  import { findFreeModel, rankModels } from '../lib/ai/provider';
  import { AiError } from '../lib/ai/parse';
  import { MISTRAL_API } from '../lib/ai/mistral';
  import { PROVIDER_LABELS } from '../lib/types';
  import type { ProviderId } from '../lib/types';
  import { vibrate } from './haptics';

  let s = $state<AiSettings>(defaultAiSettings());
  let models = $state<Record<ProviderId, string[]>>({ gemini: [], mistral: [] });
  let status = $state<Record<ProviderId, { ok: boolean; text: string } | null>>({ gemini: null, mistral: null });
  let testing = $state<ProviderId | null>(null);
  let testingText = $state('');
  let show = $state<Record<ProviderId, boolean>>({ gemini: false, mistral: false });
  let loaded = $state(false);

  const LINKS: Record<ProviderId, string> = {
    gemini: 'https://aistudio.google.com/app/apikey',
    mistral: 'https://console.mistral.ai/api-keys',
  };
  const RELAY_HELP = 'https://github.com/Dav-lbn/health-plant/blob/main/relay/README.md';

  onMount(async () => {
    s = await loadAiSettings();
    for (const id of ['gemini', 'mistral'] as ProviderId[]) if (s[id].model) models[id] = [s[id].model];
    loaded = true;
  });

  async function persist() {
    await saveAiSettings($state.snapshot(s));
  }

  async function setDefault(id: ProviderId) {
    s.defaultProvider = id;
    vibrate('tap');
    await persist();
  }

  async function test(id: ProviderId) {
    const key = s[id].key.trim();
    status[id] = null;
    if (!key) {
      status[id] = { ok: false, text: 'Collez d’abord votre clé.' };
      return;
    }
    testing = id;
    testingText = 'Vérification de la clé…';
    try {
      if (id === 'mistral' && !s.mistral.base.trim()) s.mistral.base = MISTRAL_API;
      const provider = providerInstance(id, s);
      const list = await provider.listModels(key);
      if (!list.length) {
        status[id] = { ok: false, text: 'Clé valide, mais aucun modèle capable d’analyser des photos.' };
        return;
      }
      const ranked = rankModels(id, list);
      models[id] = ranked;
      s[id].key = key;
      testingText = 'Recherche d’un modèle gratuit…';
      const free = await findFreeModel(provider, key, ranked);
      if (free) {
        s[id].model = free;
        status[id] = { ok: true, text: `✓ Clé valide — modèle gratuit : ${free}` };
        vibrate('success');
      } else {
        if (!s[id].model || !ranked.includes(s[id].model)) s[id].model = ranked[0];
        status[id] = {
          ok: false,
          text: 'Clé valide, mais aucun modèle n’a répondu gratuitement pour l’instant (quota ou surcharge). Réessayez plus tard ou choisissez un modèle ci-dessous.',
        };
      }
      await persist();
    } finally {
      testing = null;
    }
  }
</script>

<section class="glass block">
  <h2>Intelligence artificielle</h2>
  <p class="muted small">Vos clés restent sur ce téléphone et ne sont jamais exportées.</p>
  {#if loaded}

  <span class="label">IA utilisée par défaut</span>
  <div class="seg">
    {#each ['gemini', 'mistral'] as const as id}
      <button class:on={s.defaultProvider === id} aria-pressed={s.defaultProvider === id} onclick={() => setDefault(id)}>
        {PROVIDER_LABELS[id]}
      </button>
    {/each}
  </div>

  {#each ['gemini', 'mistral'] as const as id}
    <div class="provider">
      <div class="head">
        <h3>{PROVIDER_LABELS[id]}</h3>
        <a href={LINKS[id]} target="_blank" rel="noopener">Obtenir une clé gratuite ↗</a>
      </div>
      <div class="keyrow">
        <input
          type={show[id] ? 'text' : 'password'}
          bind:value={s[id].key}
          onchange={persist}
          placeholder="Clé API {PROVIDER_LABELS[id]}"
          aria-label="Clé API {PROVIDER_LABELS[id]}"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="btn btn-icon" type="button" aria-label={show[id] ? 'Masquer la clé' : 'Afficher la clé'} onclick={() => (show[id] = !show[id])}>
          {show[id] ? '🙈' : '👁️'}
        </button>
      </div>
      {#if id === 'mistral'}
        <label class="field">
          Relais (facultatif)
          <input bind:value={s.mistral.base} onchange={persist} placeholder={MISTRAL_API} inputmode="url" aria-label="Relais Mistral" />
        </label>
        <a class="small" href={RELAY_HELP} target="_blank" rel="noopener">Comment créer le relais ↗</a>
      {/if}
      <button class="btn" onclick={() => test(id)} disabled={testing === id}>
        {testing === id ? testingText : 'Tester et choisir le modèle'}
      </button>
      {#if status[id]}
        <p class="status" class:ok={status[id]?.ok} role="status">{status[id]?.text}</p>
      {/if}
      {#if models[id].length}
        <label class="field">
          Modèle
          <select bind:value={s[id].model} onchange={persist} aria-label="Modèle {PROVIDER_LABELS[id]}">
            {#each models[id] as m}<option value={m}>{m}</option>{/each}
          </select>
        </label>
      {/if}
    </div>
  {/each}
  {/if}
</section>

<style>
  .block {
    padding: 16px;
    display: grid;
    gap: 12px;
  }
  .block > * {
    position: relative;
    z-index: 1;
  }
  h2,
  h3 {
    margin: 0;
  }
  .small {
    font-size: 0.82rem;
    margin: 0;
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
  .seg button.on {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #04170d;
    box-shadow: 0 4px 18px var(--accent-glow);
  }
  .provider {
    display: grid;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  a {
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
  }
  .keyrow {
    display: flex;
    gap: 8px;
  }
  .keyrow input {
    flex: 1;
    min-width: 0;
    font-family: ui-monospace, monospace;
  }
  .status {
    margin: 0;
    color: #ffb3ab;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .status.ok {
    color: var(--ok);
  }
</style>
