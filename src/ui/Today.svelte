<script lang="ts">
  import { app, currentTasks, refresh, showToast } from '../lib/stores.svelte';
  import { completeTask, postponeTask } from '../lib/tasks';
  import { deleteCare } from '../lib/repo';
  import { addDays, type Task } from '../lib/schedule';
  import { todayLocal } from '../lib/dates';
  import TaskCard from './TaskCard.svelte';
  import PostponeSheet from './PostponeSheet.svelte';
  import EmptyState from './EmptyState.svelte';
  import { vibrate } from './haptics';

  const today = todayLocal();
  const tasks = $derived(app.loaded ? currentTasks(today) : []);
  const late = $derived(tasks.filter((t) => t.status === 'retard'));
  const now = $derived(tasks.filter((t) => t.status === 'aujourdhui'));
  const soon = $derived(tasks.filter((t) => t.status === 'bientot'));
  const plantsById = $derived(Object.fromEntries(app.plants.map((p) => [p.id, p])));

  let showSoon = $state(false);
  let postponing = $state<Task | null>(null);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  async function done(t: Task) {
    const plant = plantsById[t.plantId];
    if (!plant) return;
    const created = await completeTask(t, plant);
    await refresh();
    vibrate('success');
    showToast(
      'Fait',
      created
        ? {
            label: 'Annuler',
            run: async () => {
              await deleteCare(created.id);
              await refresh();
            },
          }
        : null,
    );
  }

  async function postpone(days: number) {
    const t = postponing;
    postponing = null;
    if (!t) return;
    await postponeTask(t.id, addDays(today, days));
    await refresh();
    vibrate('tap');
    showToast(days === 1 ? 'Reporté à demain' : `Reporté de ${days} jours`);
  }

  const count = $derived(late.length + now.length);
</script>

<div class="today">
  <header>
    <p class="eyebrow">{dateLabel}</p>
    <h1>{greeting} 🌿</h1>
    {#if app.plants.length}
      <p class="muted summary">
        {#if count === 0}
          Rien à faire aujourd’hui.
        {:else}
          {count} tâche{count > 1 ? 's' : ''} à faire{late.length ? `, dont ${late.length} en retard` : ''}.
        {/if}
      </p>
    {/if}
  </header>

  {#if app.loaded && !app.plants.length}
    <EmptyState title="Bienvenue !" text="Ajoutez votre première plante : ses soins apparaîtront ici chaque jour.">
      <a class="btn btn-primary" href="#/nouvelle-plante">＋ Ajouter ma première plante</a>
    </EmptyState>
  {:else if app.loaded}
    {#if late.length}
      <section>
        <h2 class="sec bad">En retard · {late.length}</h2>
        <div class="list">
          {#each late as t (t.id)}
            {@const p = plantsById[t.plantId]}
            {#if p}<TaskCard task={t} plant={p} photo={p.photoId ? app.thumbs[p.photoId] : undefined} ondone={() => done(t)} onpostpone={() => (postponing = t)} />{/if}
          {/each}
        </div>
      </section>
    {/if}

    {#if now.length}
      <section>
        <h2 class="sec">Aujourd’hui · {now.length}</h2>
        <div class="list">
          {#each now as t (t.id)}
            {@const p = plantsById[t.plantId]}
            {#if p}<TaskCard task={t} plant={p} photo={p.photoId ? app.thumbs[p.photoId] : undefined} ondone={() => done(t)} onpostpone={() => (postponing = t)} />{/if}
          {/each}
        </div>
      </section>
    {/if}

    {#if count === 0}
      <div class="calm glass">
        <span>🌿</span>
        <p>Rien à faire aujourd’hui</p>
        <p class="muted small">Vos plantes sont à jour. Profitez-en pour les observer !</p>
      </div>
    {/if}

    {#if soon.length}
      <section>
        <button class="sec toggle" onclick={() => (showSoon = !showSoon)} aria-expanded={showSoon}>
          Prochains jours · {soon.length} <span class:up={showSoon}>⌄</span>
        </button>
        {#if showSoon}
          <div class="list">
            {#each soon as t (t.id)}
              {@const p = plantsById[t.plantId]}
              {#if p}<TaskCard task={t} plant={p} photo={p.photoId ? app.thumbs[p.photoId] : undefined} ondone={() => done(t)} onpostpone={() => (postponing = t)} />{/if}
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if !tasks.length && app.plants.every((p) => !Object.keys(p.careFrequencyDays).length && !p.speciesSheet)}
      <p class="muted small hint">
        Astuce : indiquez une fréquence de soin dans la fiche d’une plante, ou générez sa fiche d’espèce, pour voir apparaître les arrosages prévus.
      </p>
    {/if}
  {/if}
</div>

{#if postponing}
  <PostponeSheet label={`${postponing.label} — ${plantsById[postponing.plantId]?.name ?? ''}`} onpick={postpone} onclose={() => (postponing = null)} />
{/if}

<style>
  .today {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding-bottom: 24px;
  }
  header {
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
  .summary {
    margin: 4px 0 0;
  }
  .sec {
    margin: 0 4px 10px;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .sec.bad {
    color: var(--bad);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 0;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    padding: 6px 0;
  }
  .toggle span {
    transition: transform 0.2s;
    font-size: 1.2rem;
  }
  .toggle span.up {
    transform: rotate(180deg);
  }
  .list {
    display: grid;
    gap: 10px;
  }
  .calm {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 28px 16px;
    text-align: center;
  }
  .calm > * {
    position: relative;
    z-index: 1;
  }
  .calm span {
    font-size: 48px;
    filter: drop-shadow(0 0 20px rgba(70, 227, 138, 0.5));
  }
  .calm p {
    margin: 0;
    font-weight: 700;
  }
  .small {
    font-size: 0.85rem;
    font-weight: 500;
  }
  .hint {
    margin: 0;
    text-align: center;
  }
</style>
