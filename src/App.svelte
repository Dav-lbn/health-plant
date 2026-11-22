<script lang="ts">
  import { onMount } from 'svelte';
  import { app, refresh } from './lib/stores.svelte';
  import Layout from './ui/Layout.svelte';
  import PlantList from './ui/PlantList.svelte';
  import PlantDetail from './ui/PlantDetail.svelte';
  import PlantForm from './ui/PlantForm.svelte';
  import Settings from './ui/Settings.svelte';
  import Toast from './ui/Toast.svelte';

  let wide = $state(false);

  onMount(() => {
    const mq = window.matchMedia('(min-width: 600px)');
    const update = () => (wide = mq.matches);
    update();
    mq.addEventListener('change', update);
    refresh();
    return () => mq.removeEventListener('change', update);
  });

  const r = $derived(app.route);
  const selectedId = $derived(r.name === 'plant' || r.name === 'plant-edit' ? r.id : null);
</script>

{#snippet list()}
  <PlantList {selectedId} />
{/snippet}

{#snippet detail()}
  {#key r.name + (selectedId ?? '')}
    <div class="page">
      {#if r.name === 'plant'}
        <PlantDetail id={r.id} />
      {:else if r.name === 'plant-edit'}
        <PlantForm id={r.id} />
      {:else if r.name === 'plant-new'}
        <PlantForm />
      {:else if r.name === 'settings'}
        <Settings />
      {/if}
    </div>
  {/key}
{/snippet}

<Layout {list} detail={r.name === 'plants' ? null : detail} {wide} />
<Toast />

<style>
  .page {
    animation: enter 0.35s var(--ease);
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
</style>
