<script lang="ts">
  import { onMount } from 'svelte';
  import { app, refresh } from './lib/stores.svelte';
  import Layout from './ui/Layout.svelte';
  import PlantList from './ui/PlantList.svelte';
  import PlantDetail from './ui/PlantDetail.svelte';
  import PlantForm from './ui/PlantForm.svelte';
  import Settings from './ui/Settings.svelte';
  import Toast from './ui/Toast.svelte';
  import DiagnosisFlow from './ui/DiagnosisFlow.svelte';
  import DiagnosisResult from './ui/DiagnosisResult.svelte';
  import Today from './ui/Today.svelte';

  let wide = $state(false);

  onMount(() => {
    const mq = window.matchMedia('(min-width: 600px)');
    const update = () => (wide = mq.matches);
    update();
    mq.addEventListener('change', update);
    refresh({ changed: false });
    return () => mq.removeEventListener('change', update);
  });

  const r = $derived(app.route);
  const selectedId = $derived('id' in r ? r.id : null);
</script>

{#snippet list()}
  <PlantList {selectedId} />
{/snippet}

{#snippet detail()}
  {#key r.name + (selectedId ?? '') + (r.name === 'diagnosis' ? r.diagId : '')}
    <div class="page">
      {#if r.name === 'today' || r.name === 'plants'}
        <Today />
      {:else if r.name === 'plant'}
        <PlantDetail id={r.id} />
      {:else if r.name === 'plant-edit'}
        <PlantForm id={r.id} />
      {:else if r.name === 'diagnose'}
        <DiagnosisFlow id={r.id} />
      {:else if r.name === 'diagnosis'}
        <DiagnosisResult id={r.id} diagId={r.diagId} />
      {:else if r.name === 'plant-new'}
        <PlantForm />
      {:else if r.name === 'settings'}
        <Settings />
      {/if}
    </div>
  {/key}
{/snippet}

<Layout {list} detail={!wide && r.name === 'plants' ? null : detail} {wide} dueCount={app.dueCount} />
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
