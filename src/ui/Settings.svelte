<script lang="ts">
  import { app, refresh, showToast } from '../lib/stores.svelte';
  import { createRoom, deleteRoom, renameRoom } from '../lib/repo';
  import { exportBlob, importAll, lastExportDate } from '../lib/backup';
  import { daysBetween, formatDateFr, todayLocal } from '../lib/dates';
  import { vibrate } from './haptics';
  import AiSettings from './AiSettings.svelte';
  import KDriveSettings from './KDriveSettings.svelte';

  let newRoom = $state('');
  let lastExport = $state<string | null>(null);
  let importError = $state('');
  let busy = $state(false);

  $effect(() => {
    lastExportDate().then((d) => (lastExport = d));
  });

  const exportDay = $derived(lastExport ? todayLocal(new Date(lastExport)) : null);
  const needsBackup = $derived(app.plants.length > 0 && (!exportDay || daysBetween(exportDay, todayLocal()) > 30));

  async function addRoom(e: SubmitEvent) {
    e.preventDefault();
    if (!newRoom.trim()) return;
    await createRoom(newRoom);
    newRoom = '';
    await refresh();
    vibrate('success');
  }

  async function rename(id: string, current: string) {
    const name = prompt('Nouveau nom de la pièce', current);
    if (name && name.trim()) {
      await renameRoom(id, name);
      await refresh();
    }
  }

  async function removeRoom(id: string, name: string) {
    if (!confirm(`Supprimer la pièce « ${name} » ? Ses plantes seront conservées, sans pièce.`)) return;
    await deleteRoom(id);
    await refresh();
  }

  async function doExport() {
    busy = true;
    try {
      const { blob, filename } = await exportBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      lastExport = await lastExportDate();
      vibrate('success');
      showToast('Sauvegarde exportée');
    } finally {
      busy = false;
    }
  }

  async function doImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    importError = '';
    if (!f) return;
    if (!confirm('Remplacer toutes les données actuelles par celles du fichier ?')) return;
    busy = true;
    try {
      let data: unknown;
      try {
        data = JSON.parse(await f.text());
      } catch {
        throw new Error('Fichier de sauvegarde invalide');
      }
      await importAll(data);
      await refresh();
      vibrate('success');
      showToast('Données importées');
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Import impossible';
    } finally {
      busy = false;
    }
  }
</script>

<div class="settings">
  <header>
    <p class="eyebrow">Configuration</p>
    <h1>Réglages</h1>
  </header>

  {#if needsBackup}
    <div class="banner glass" role="note">
      <span>🛟</span>
      <p>Pensez à exporter vos données : {exportDay ? `dernière sauvegarde le ${formatDateFr(exportDay)}` : 'aucune sauvegarde pour l’instant'}.</p>
    </div>
  {/if}

  <AiSettings />

  <section class="glass block">
    <h2>Pièces</h2>
    {#if app.rooms.length}
      <ul>
        {#each app.rooms as r (r.id)}
          <li>
            <span>🏠 {r.name}</span>
            <span class="acts">
              <button class="btn btn-icon btn-ghost" aria-label={`Renommer ${r.name}`} onclick={() => rename(r.id, r.name)}>✏️</button>
              <button class="btn btn-icon btn-ghost" aria-label={`Supprimer ${r.name}`} onclick={() => removeRoom(r.id, r.name)}>🗑️</button>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Aucune pièce. Ajoutez-en pour ranger vos plantes.</p>
    {/if}
    <form class="add" onsubmit={addRoom}>
      <input bind:value={newRoom} placeholder="Nouvelle pièce (ex. Salon)" aria-label="Nouvelle pièce" />
      <button class="btn btn-primary" type="submit">Ajouter</button>
    </form>
  </section>

  <section class="glass block">
    <h2>Export manuel</h2>
    <p class="muted">
      {exportDay ? `Dernier export : ${formatDateFr(exportDay)}` : 'Aucun export pour l’instant.'}
    </p>
    <div class="row">
      <button class="btn btn-primary" onclick={doExport} disabled={busy}>⬇️ Exporter mes données</button>
      <label class="btn">
        ⬆️ Importer
        <input type="file" accept="application/json,.json" onchange={doImport} hidden data-testid="import-input" />
      </label>
    </div>
    {#if importError}<p class="error" role="alert">{importError}</p>{/if}
  </section>

  <KDriveSettings />

  <p class="muted small center">Health Plant · version {__APP_VERSION__}</p>
</div>

<style>
  .settings {
    display: grid;
    gap: 16px;
  }
  .eyebrow {
    margin: 8px 0 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
  }
  .block {
    padding: 16px;
    display: grid;
    gap: 10px;
  }
  .block h2 {
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0 2px 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    z-index: 1;
  }
  .acts {
    display: flex;
  }
  .add,
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    position: relative;
    z-index: 1;
  }
  .add input {
    flex: 1;
    min-width: 0;
  }
  .row .btn {
    flex: 1;
    cursor: pointer;
  }
  .banner {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-color: rgba(255, 181, 71, 0.45);
    background: rgba(255, 181, 71, 0.1);
  }
  .banner span {
    font-size: 1.6rem;
  }
  .banner p {
    margin: 0;
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
