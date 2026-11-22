<script lang="ts">
  import { onMount } from 'svelte';
  import { app, refresh } from './lib/stores.svelte';
  import Layout from './ui/Layout.svelte';
  import PlantList from './ui/PlantList.svelte';

  let wide = $state(false);

  onMount(() => {
    const mq = window.matchMedia('(min-width: 600px)');
    const update = () => (wide = mq.matches);
    update();
    mq.addEventListener('change', update);
    refresh();
    return () => mq.removeEventListener('change', update);
  });

  const selectedId = $derived(app.route.name === 'plant' || app.route.name === 'plant-edit' ? app.route.id : null);
  const hasDetail = $derived(app.route.name !== 'plants');
</script>

{#snippet list()}
  <PlantList {selectedId} />
{/snippet}

{#snippet detail()}
  <p class="muted">Bientôt disponible.</p>
{/snippet}

<Layout {list} detail={hasDetail ? detail : null} {wide} />
