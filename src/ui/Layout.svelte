<script lang="ts">
  import type { Snippet } from 'svelte';
  import { app } from '../lib/stores.svelte';

  let { list, detail, wide }: { list: Snippet; detail: Snippet | null; wide: boolean } = $props();
  const r = $derived(app.route.name);
  const onList = $derived(r === 'plants' || r === 'plant' || r === 'plant-new' || r === 'plant-edit');
</script>

{#if wide}
  <div class="split">
    <aside class="pane-list">
      {@render list()}
      <nav class="side-nav">
        <a class="btn btn-primary add" href="#/nouvelle-plante" aria-label="Ajouter une plante">＋</a>
        <a class="btn" class:active={r !== 'settings'} href="#/">🌿 Plantes</a>
        <a class="btn" class:active={r === 'settings'} href="#/reglages">⚙️ Réglages</a>
      </nav>
    </aside>
    <main class="pane-detail">
      {#if detail}
        {@render detail()}
      {:else}
        <div class="placeholder muted">
          <span>🌿</span>
          <p>Sélectionnez une plante</p>
        </div>
      {/if}
    </main>
  </div>
{:else}
  <main class="single">
    {#if detail}{@render detail()}{:else}{@render list()}{/if}
  </main>
  <nav class="tabbar glass">
    <a class:active={onList} href="#/"><span>🌿</span>Plantes</a>
    <a class:active={r === 'settings'} href="#/reglages"><span>⚙️</span>Réglages</a>
  </nav>
{/if}

<style>
  .single {
    padding: calc(12px + var(--safe-top)) 16px 100px;
    max-width: 720px;
    margin: 0 auto;
  }
  .tabbar {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(12px + var(--safe-bottom));
    display: flex;
    justify-content: space-around;
    padding: 6px;
    border-radius: 999px;
    z-index: 30;
    background: rgba(10, 22, 16, 0.72);
  }
  .tabbar a {
    flex: 1;
    display: grid;
    justify-items: center;
    gap: 1px;
    padding: 6px 0;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 999px;
    position: relative;
    z-index: 1;
  }
  .tabbar a span {
    font-size: 1.25rem;
  }
  .tabbar a.active {
    color: var(--text);
    background: rgba(70, 227, 138, 0.14);
    box-shadow: inset 0 0 0 1px rgba(70, 227, 138, 0.3);
  }
  .split {
    display: grid;
    grid-template-columns: minmax(280px, min(40%, 420px)) 1fr;
    height: 100dvh;
  }
  .pane-list {
    overflow-y: auto;
    padding: calc(12px + var(--safe-top)) 14px 24px 16px;
    border-right: 1px solid var(--glass-border);
    background: rgba(0, 0, 0, 0.15);
    position: relative;
  }
  .pane-detail {
    overflow-y: auto;
    padding: calc(12px + var(--safe-top)) 20px 32px;
  }
  .side-nav {
    position: sticky;
    bottom: 0;
    display: flex;
    gap: 8px;
    padding-top: 12px;
  }
  .side-nav .btn {
    flex: 1;
    font-size: 0.9rem;
  }
  .side-nav .add {
    flex: none;
    width: 48px;
    padding: 0;
    font-size: 1.4rem;
  }
  .side-nav .active {
    background: rgba(70, 227, 138, 0.16);
    border-color: rgba(70, 227, 138, 0.4);
  }
  .placeholder {
    height: 100%;
    display: grid;
    place-content: center;
    text-align: center;
  }
  .placeholder span {
    font-size: 64px;
    opacity: 0.5;
  }
</style>
