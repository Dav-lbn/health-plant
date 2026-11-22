<script lang="ts">
  import type { Plant, Photo } from '../lib/types';
  import { photoUrl } from '../lib/photos';
  import { daysBetween, relativeDays, todayLocal } from '../lib/dates';

  let { plant, photo, lastWater, selected = false }: { plant: Plant; photo?: Photo; lastWater?: string; selected?: boolean } = $props();

  const waterLabel = $derived(lastWater ? relativeDays(daysBetween(lastWater, todayLocal())) : 'jamais arrosée');
</script>

<a class="card glass" class:selected href={`#/plante/${encodeURIComponent(plant.id)}`}>
  <div class="thumb">
    {#if photo}
      <img src={photoUrl(`${photo.id}:thumb`, photo.thumb)} alt="" loading="lazy" />
    {:else}
      <span aria-hidden="true">🪴</span>
    {/if}
  </div>
  <div class="info">
    <strong>{plant.name}</strong>
    {#if plant.species}<span class="muted species">{plant.species}</span>{/if}
    <span class="chip">💧 {waterLabel}</span>
  </div>
  <span class="chev" aria-hidden="true">›</span>
</a>

<style>
  .card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px 10px 10px;
    color: inherit;
    text-decoration: none;
    border-radius: 20px;
    transition:
      transform 0.18s var(--ease),
      border-color 0.2s;
  }
  .card:active {
    transform: scale(0.98);
  }
  .card.selected {
    border-color: rgba(70, 227, 138, 0.55);
    box-shadow:
      0 0 0 1px rgba(70, 227, 138, 0.25),
      0 10px 30px rgba(70, 227, 138, 0.15);
  }
  .thumb {
    width: 64px;
    height: 64px;
    flex: none;
    border-radius: 16px;
    overflow: hidden;
    display: grid;
    place-items: center;
    font-size: 30px;
    background: linear-gradient(145deg, rgba(70, 227, 138, 0.18), rgba(0, 0, 0, 0.3));
    border: 1px solid var(--glass-border);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .info {
    display: grid;
    gap: 3px;
    min-width: 0;
    flex: 1;
    justify-items: start;
  }
  strong {
    font-size: 1.05rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .species {
    font-size: 0.85rem;
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .chip {
    margin-top: 3px;
  }
  .chev {
    font-size: 1.6rem;
    color: var(--text-muted);
  }
</style>
