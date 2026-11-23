<script lang="ts">
  import { onMount } from 'svelte';
  import {
    backupNow,
    defaultKDriveConfig,
    errorMessage,
    loadKDriveConfig,
    loadStatus,
    makeClient,
    restoreFromKDrive,
    saveKDriveConfig,
    type BackupStatus,
  } from '../lib/backup/autobackup';
  import { loadRelay, saveRelay } from '../lib/relay';
  import { refresh, showToast } from '../lib/stores.svelte';
  import type { KDriveConfig } from '../lib/backup/kdrive';
  import { vibrate } from './haptics';

  const RELAY_HELP = 'https://github.com/Dav-lbn/health-plant/blob/main/relay/README.md';
  const APP_PASSWORD = 'https://manager.infomaniak.com/v3/ng/profile/user/connection-history/application-password';

  let cfg = $state<KDriveConfig>(defaultKDriveConfig());
  let relay = $state('');
  let status = $state<BackupStatus>({ lastSuccessAt: null, lastError: null });
  let loaded = $state(false);
  let busy = $state<'' | 'test' | 'save' | 'restore'>('');
  let message = $state<{ ok: boolean; text: string } | null>(null);
  let showPass = $state(false);

  onMount(async () => {
    cfg = await loadKDriveConfig();
    relay = await loadRelay();
    status = await loadStatus();
    loaded = true;
  });

  async function persist() {
    await saveKDriveConfig($state.snapshot(cfg));
    await saveRelay(relay);
  }

  async function toggle() {
    cfg.enabled = !cfg.enabled;
    vibrate('tap');
    await persist();
  }

  async function test() {
    busy = 'test';
    message = null;
    await persist();
    try {
      await (await makeClient($state.snapshot(cfg))).check();
      message = { ok: true, text: '✓ Connexion à kDrive réussie' };
      vibrate('success');
    } catch (e) {
      message = { ok: false, text: errorMessage(e) };
    } finally {
      busy = '';
    }
  }

  async function save() {
    busy = 'save';
    message = null;
    await persist();
    const r = await backupNow();
    status = await loadStatus();
    busy = '';
    if (r.ok) {
      vibrate('success');
      showToast('Sauvegarde envoyée sur kDrive');
    } else {
      message = { ok: false, text: r.error ?? 'Sauvegarde impossible.' };
    }
  }

  async function restore() {
    if (!confirm('Remplacer toutes les données de ce téléphone par la sauvegarde kDrive ?')) return;
    busy = 'restore';
    message = null;
    await persist();
    try {
      await restoreFromKDrive();
      await refresh({ changed: false });
      vibrate('success');
      showToast('Données restaurées depuis kDrive');
    } catch (e) {
      message = { ok: false, text: errorMessage(e) };
    } finally {
      busy = '';
    }
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const ready = $derived(!!cfg.driveId.trim() && !!cfg.email.trim() && !!cfg.password);
</script>

<section class="glass block">
  <div class="head">
    <h2>Sauvegarde kDrive</h2>
    {#if loaded}
      <button class="switch" class:on={cfg.enabled} role="switch" aria-checked={cfg.enabled} aria-label="Activer la sauvegarde kDrive" onclick={toggle}>
        <span></span>
      </button>
    {/if}
  </div>
  <p class="muted small">Sauvegarde automatique de toutes vos plantes, photos et diagnostics dans le dossier « Health Plant » de votre kDrive. Les 7 derniers jours sont conservés.</p>

  {#if loaded}
    {#if status.lastSuccessAt && !status.lastError}
      <p class="st ok">✓ Dernière sauvegarde : {fmt(status.lastSuccessAt)}</p>
    {:else if status.lastError}
      <p class="st warn" role="status">⚠️ {status.lastError}{status.lastSuccessAt ? ` — dernière réussie : ${fmt(status.lastSuccessAt)}` : ''}</p>
    {/if}

    <label class="field">
      Identifiant kDrive
      <input bind:value={cfg.driveId} onchange={persist} inputmode="numeric" placeholder="ex. 123456" aria-label="Identifiant kDrive" />
    </label>
    <p class="muted tiny">Le nombre dans l’adresse de kDrive : ksuite.infomaniak.com/kdrive/app/drive/<b>123456</b>/</p>
    <label class="field">
      E-mail Infomaniak
      <input bind:value={cfg.email} onchange={persist} type="email" autocomplete="username" aria-label="E-mail Infomaniak" />
    </label>
    <div class="field">
      <label for="kd-pass">Mot de passe d’application</label>
      <div class="row">
        <input id="kd-pass" bind:value={cfg.password} onchange={persist} type={showPass ? 'text' : 'password'} autocomplete="off" aria-label="Mot de passe d’application kDrive" />
        <button class="btn btn-icon" type="button" aria-label={showPass ? 'Masquer' : 'Afficher'} onclick={() => (showPass = !showPass)}>{showPass ? '🙈' : '👁️'}</button>
      </div>
      <a href={APP_PASSWORD} target="_blank" rel="noopener">Créer un mot de passe d’application ↗</a>
    </div>
    <label class="field">
      Relais Cloudflare (commun à kDrive et Mistral)
      <input bind:value={relay} onchange={persist} inputmode="url" placeholder="https://…workers.dev" aria-label="Relais Cloudflare" />
    </label>
    <a href={RELAY_HELP} target="_blank" rel="noopener">Comment créer le relais (5 min, gratuit) ↗</a>

    <div class="actions">
      <button class="btn" onclick={test} disabled={!ready || !!busy}>{busy === 'test' ? 'Test…' : 'Tester la connexion'}</button>
      <button class="btn btn-primary" onclick={save} disabled={!ready || !cfg.enabled || !!busy}>{busy === 'save' ? 'Envoi…' : '☁️ Sauvegarder maintenant'}</button>
      <button class="btn" onclick={restore} disabled={!ready || !!busy}>{busy === 'restore' ? 'Restauration…' : '⤓ Restaurer depuis kDrive'}</button>
    </div>
    {#if message}<p class="st" class:ok={message.ok} class:warn={!message.ok} role="status">{message.text}</p>{/if}
  {/if}
</section>

<style>
  .block {
    padding: 16px;
    display: grid;
    gap: 10px;
  }
  .block > * {
    position: relative;
    z-index: 1;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
  .tiny {
    font-size: 0.75rem;
    margin: -4px 0 0;
    overflow-wrap: anywhere;
  }
  .field {
    display: grid;
    gap: 6px;
    font-size: 0.9rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row input {
    flex: 1;
    min-width: 0;
  }
  a {
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
  }
  .actions {
    display: grid;
    gap: 8px;
    margin-top: 4px;
  }
  .st {
    margin: 0;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .st.ok {
    color: var(--ok);
  }
  .st.warn {
    color: var(--warn);
  }
  .switch {
    width: 54px;
    height: 32px;
    border-radius: 16px;
    border: 1px solid var(--glass-border);
    background: rgba(0, 0, 0, 0.35);
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
  }
  .switch span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #cfe9da;
    transition: transform 0.2s var(--ease);
  }
  .switch.on {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    box-shadow: 0 0 14px var(--accent-glow);
  }
  .switch.on span {
    transform: translateX(22px);
    background: #fff;
  }
</style>
