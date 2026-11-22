<script lang="ts">
  import type { TimelineItem } from '../lib/care';
  import { CARE_ICONS, CARE_LABELS } from '../lib/types';
  import { formatDateFr } from '../lib/dates';
  import { photoUrl } from '../lib/photos';
  import { PROVIDER_LABELS } from '../lib/types';
  import HealthBadge from './HealthBadge.svelte';

  let { items, ondeletecare }: { items: TimelineItem[]; ondeletecare: (id: string) => void } = $props();
</script>

{#if items.length}
  <ol class="tl">
    {#each items as it (it.kind === 'care' ? it.event.id : it.kind === 'photo' ? it.photo.id : it.diagnosis.id)}
      <li>
        <span class="dot" class:photo={it.kind === 'photo'} class:diag={it.kind === 'diagnosis'}></span>
        <div class="body glass">
          <div class="head">
            <time>{formatDateFr(it.date)}</time>
            {#if it.kind === 'care'}
              <button class="del" aria-label="Supprimer ce soin" onclick={() => ondeletecare(it.event.id)}>✕</button>
            {/if}
          </div>
          {#if it.kind === 'care'}
            <p class="what">
              {CARE_ICONS[it.event.type]} {CARE_LABELS[it.event.type]}
              {#if it.event.amountMl != null}<span class="muted"> · {it.event.amountMl} mL</span>{/if}
            </p>
            {#if it.event.notes}<p class="muted note">{it.event.notes}</p>{/if}
          {:else if it.kind === 'diagnosis'}
            {@const d = it.diagnosis}
            <a class="diag" href={`#/plante/${d.plantId}/diagnostic/${d.id}`}>
              <span class="what">🔬 Diagnostic · {PROVIDER_LABELS[d.provider]}</span>
              {#if d.status === 'termine' && d.result}
                <HealthBadge state={d.result.state} />
                <span class="muted note clamp">{d.result.summary}</span>
              {:else if d.status === 'questions'}
                <span class="muted note">Questions en attente — touchez pour répondre</span>
              {:else if d.status === 'erreur'}
                <span class="muted note">Échec — touchez pour réessayer</span>
              {:else}
                <span class="muted note">En cours…</span>
              {/if}
            </a>
          {:else}
            <p class="what">📷 Photo</p>
            <img src={photoUrl(`${it.photo.id}:thumb`, it.photo.thumb)} alt="" loading="lazy" />
          {/if}
        </div>
      </li>
    {/each}
  </ol>
{:else}
  <p class="muted empty">Aucun événement pour l'instant. Enregistrez un premier soin ci-dessus.</p>
{/if}

<style>
  .tl {
    list-style: none;
    margin: 0;
    padding: 0 0 0 18px;
    position: relative;
    display: grid;
    gap: 10px;
  }
  .tl::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: linear-gradient(180deg, var(--accent), transparent);
    opacity: 0.4;
  }
  li {
    position: relative;
  }
  .dot {
    position: absolute;
    left: -18px;
    top: 18px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent-glow);
  }
  .dot.diag {
    background: #c9a4ff;
    box-shadow: 0 0 12px rgba(201, 164, 255, 0.55);
  }
  .diag {
    display: grid;
    gap: 6px;
    justify-items: start;
    color: inherit;
    text-decoration: none;
    margin-top: 2px;
    position: relative;
    z-index: 1;
  }
  .clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .dot.photo {
    background: #8fd3ff;
    box-shadow: 0 0 12px rgba(143, 211, 255, 0.5);
  }
  .body {
    padding: 10px 14px;
    border-radius: 16px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  time {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  .del {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.9rem;
    width: 36px;
    height: 36px;
    margin: -8px -10px -8px 0;
    cursor: pointer;
    position: relative;
    z-index: 1;
  }
  .what {
    margin: 2px 0 0;
    font-weight: 600;
  }
  .note {
    margin: 4px 0 0;
    font-size: 0.9rem;
  }
  img {
    margin-top: 8px;
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 12px;
    display: block;
  }
  .empty {
    text-align: center;
    padding: 12px;
  }
</style>
