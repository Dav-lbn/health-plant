<script lang="ts">
  import { app } from '../lib/stores.svelte';
  import PlantCard from './PlantCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import type { Plant } from '../lib/types';

  let { selectedId = null }: { selectedId?: string | null } = $props();
  let query = $state('');

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  const filtered = $derived(
    query.trim()
      ? app.plants.filter((p) => norm(`${p.name} ${p.species ?? ''}`).includes(norm(query.trim())))
      : app.plants,
  );

  const sections = $derived.by(() => {
    const out: { id: string; name: string; plants: Plant[] }[] = [];
    for (const r of app.rooms) {
      const ps = filtered.filter((p) => p.roomId === r.id);
      if (ps.length) out.push({ id: r.id, name: r.name, plants: ps });
    }
    const roomIds = new Set(app.rooms.map((r) => r.id));
    const none = filtered.filter((p) => !p.roomId || !roomIds.has(p.roomId));
    if (none.length) out.push({ id: '_none', name: 'Sans pièce', plants: none });
    return out;
  });

  const lastWater = $derived.by(() => {
    const m: Record<string, string> = {};
    for (const e of app.care) if (e.type === 'arrosage' && !m[e.plantId]) m[e.plantId] = e.date;
    return m;
  });
</script>

<section class="list">
  <header>
    <div>
      <p class="eyebrow">Mon jardin</p>
      <h1>Mes plantes</h1>
    </div>
    <span class="count chip">{app.plants.length}</span>
  </header>

  {#if app.plants.length}
    <input class="search" type="search" placeholder="Rechercher une plante…" bind:value={query} aria-label="Rechercher" />
  {/if}

  {#if app.loaded && !app.plants.length}
    <EmptyState title="Aucune plante pour l'instant" text="Ajoutez votre première plante pour commencer à suivre sa santé.">
      <a class="btn btn-primary" href="#/nouvelle-plante">＋ Ajouter une plante</a>
    </EmptyState>
  {:else if app.plants.length && !filtered.length}
    <p class="muted center">Aucune plante ne correspond à « {query} ».</p>
  {/if}

  {#each sections as s (s.id)}
    <h2 class="room">{s.name} <span class="muted">· {s.plants.length}</span></h2>
    <div class="cards">
      {#each s.plants as p (p.id)}
        <PlantCard plant={p} photo={p.photoId ? app.thumbs[p.photoId] : undefined} lastWater={lastWater[p.id]} selected={p.id === selectedId} health={app.lastDiag[p.id]?.result?.state} />
      {/each}
    </div>
  {/each}

  {#if app.plants.length}
    <a class="fab btn btn-primary" href="#/nouvelle-plante" aria-label="Ajouter une plante">＋</a>
  {/if}
</section>

<style>
  .list {
    display: grid;
    gap: 12px;
    padding-bottom: 110px;
  }
  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    padding: 8px 4px 0;
  }
  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    background: linear-gradient(180deg, #ffffff 0%, #b8f5d0 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .search {
    border-radius: 999px;
    padding-left: 18px;
  }
  .room {
    margin: 10px 4px 0;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .cards {
    display: grid;
    gap: 10px;
  }
  .center {
    text-align: center;
  }
  .fab {
    position: fixed;
    right: 20px;
    bottom: calc(86px + var(--safe-bottom));
    width: 60px;
    height: 60px;
    padding: 0;
    font-size: 1.8rem;
    z-index: 20;
  }
  :global(.split) .fab {
    display: none;
  }
</style>
