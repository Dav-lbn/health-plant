<script lang="ts">
  import { app, refresh, showToast } from '../lib/stores.svelte';
  import { deleteCare, deletePlant, updatePlant } from '../lib/repo';
  import { listPhotos, photoUrl, savePhoto } from '../lib/photos';
  import { buildTimeline } from '../lib/care';
  import { navigate } from '../lib/router';
  import { db } from '../lib/db';
  import { CARE_ICONS, CARE_LABELS, CARE_TYPES, EXPOSURE_ICONS, EXPOSURE_LABELS } from '../lib/types';
  import type { Photo } from '../lib/types';
  import CareQuickActions from './CareQuickActions.svelte';
  import Timeline from './Timeline.svelte';
  import EmptyState from './EmptyState.svelte';
  import { vibrate } from './haptics';

  let { id }: { id: string } = $props();

  const plant = $derived(app.plants.find((p) => p.id === id));
  const events = $derived(app.care.filter((e) => e.plantId === id));
  const room = $derived(plant?.roomId ? app.rooms.find((r) => r.id === plant.roomId) : undefined);

  let photos = $state<Photo[]>([]);
  let main = $state<Photo | undefined>();
  let menu = $state(false);
  let busy = $state(false);

  $effect(() => {
    const pid = id;
    const photoId = plant?.photoId;
    void app.care;
    listPhotos(pid).then((ps) => (photos = ps));
    if (photoId) db.photos.get(photoId).then((ph) => (main = ph));
    else main = undefined;
  });

  const timeline = $derived(buildTimeline(events, photos.filter((p) => p.id !== plant?.photoId)));

  async function addPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f || !plant) return;
    busy = true;
    try {
      const ph = await savePhoto(plant.id, f);
      if (!plant.photoId) await updatePlant(plant.id, { photoId: ph.id });
      await refresh();
      vibrate('success');
      showToast('Photo ajoutée');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Photo impossible à enregistrer');
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!plant) return;
    menu = false;
    if (!confirm(`Supprimer ${plant.name} et tout son historique ?`)) return;
    await deletePlant(plant.id);
    await refresh();
    showToast('Plante supprimée');
    navigate({ name: 'plants' }, true);
  }

  async function removeCare(eid: string) {
    if (!confirm('Supprimer ce soin de l’historique ?')) return;
    await deleteCare(eid);
    await refresh();
  }

  const freqs = $derived(plant ? CARE_TYPES.filter((t) => plant.careFrequencyDays[t]) : []);
</script>

{#if !plant}
  {#if app.loaded}
    <EmptyState icon="🍂" title="Plante introuvable" text="Elle a peut-être été supprimée.">
      <a class="btn" href="#/">Retour à mes plantes</a>
    </EmptyState>
  {/if}
{:else}
  <article class="detail">
    <div class="hero glass">
      {#if main}
        <img src={photoUrl(main.id, main.blob)} alt={plant.name} />
      {:else}
        <div class="nophoto">🪴</div>
      {/if}
      <div class="shine"></div>
      <div class="bar">
        <a class="btn btn-icon round back" href="#/" aria-label="Retour">‹</a>
        <button class="btn btn-icon round" aria-label="Options" onclick={() => (menu = !menu)}>⋯</button>
      </div>
      {#if menu}
        <div class="menu glass">
          <a class="btn btn-ghost" href={`#/plante/${plant.id}/modifier`}>✏️ Modifier</a>
          <button class="btn btn-ghost danger" onclick={remove}>🗑️ Supprimer</button>
        </div>
      {/if}
      <div class="title">
        <h1>{plant.name}</h1>
        {#if plant.species}<p class="species">{plant.species}</p>{/if}
      </div>
    </div>

    <div class="chips">
      {#if room}<span class="chip">🏠 {room.name}</span>{/if}
      {#if plant.exposure}<span class="chip">{EXPOSURE_ICONS[plant.exposure]} {EXPOSURE_LABELS[plant.exposure]}</span>{/if}
      <span class="chip">💧 {plant.waterAmountMl != null ? `${plant.waterAmountMl} mL` : '—'}</span>
      {#each freqs as t}<span class="chip">{CARE_ICONS[t]} tous les {plant.careFrequencyDays[t]} j</span>{/each}
    </div>

    <section>
      <h2>Soins</h2>
      <CareQuickActions {plant} {events} />
    </section>

    {#if plant.notes}
      <section class="glass notes">
        <h3>Notes</h3>
        <p>{plant.notes}</p>
      </section>
    {/if}

    <section>
      <div class="sec-head">
        <h2>Chronologie</h2>
        <label class="btn add-photo" class:busy>
          📷 {busy ? '…' : 'Ajouter une photo'}
          <input type="file" accept="image/*" capture="environment" onchange={addPhoto} hidden data-testid="add-photo" />
        </label>
      </div>
      <Timeline items={timeline} ondeletecare={removeCare} />
    </section>
  </article>
{/if}

<style>
  .detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    padding-bottom: 24px;
  }
  .hero {
    height: clamp(240px, 42vh, 380px);
    border-radius: 28px;
    padding: 0;
  }
  .hero img,
  .nophoto {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .nophoto {
    display: grid;
    place-items: center;
    font-size: 90px;
    background: radial-gradient(circle at 40% 35%, rgba(70, 227, 138, 0.3), rgba(0, 0, 0, 0.4));
  }
  .shine {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, transparent 30%, transparent 50%, rgba(4, 12, 8, 0.92) 100%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.18) 0%, transparent 35%);
    pointer-events: none;
  }
  .bar {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    z-index: 2;
  }
  .round {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    font-size: 1.5rem;
  }
  :global(.split) .back {
    visibility: hidden;
  }
  .menu {
    position: absolute;
    top: 62px;
    right: 12px;
    z-index: 3;
    display: grid;
    padding: 6px;
    border-radius: 18px;
    background: rgba(14, 30, 22, 0.95);
  }
  .menu .btn {
    justify-content: flex-start;
  }
  .danger {
    color: #ffb3ab;
  }
  .title {
    position: absolute;
    left: 20px;
    right: 20px;
    bottom: 16px;
    z-index: 1;
  }
  .title h1 {
    margin: 0;
    font-size: 2rem;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
  }
  .species {
    margin: 2px 0 0;
    font-style: italic;
    color: #cfe9da;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  h2 {
    margin-bottom: 10px;
  }
  .notes {
    padding: 14px 16px;
  }
  .notes p {
    margin: 0;
    white-space: pre-wrap;
  }
  .sec-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .sec-head h2 {
    margin: 0;
  }
  .add-photo {
    font-size: 0.85rem;
    min-height: 40px;
    cursor: pointer;
  }
</style>
