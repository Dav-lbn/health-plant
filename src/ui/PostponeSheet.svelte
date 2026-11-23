<script lang="ts">
  let { label, onpick, onclose }: { label: string; onpick: (days: number) => void; onclose: () => void } = $props();
  const OPTIONS = [
    { days: 1, text: 'Demain' },
    { days: 3, text: 'Dans 3 jours' },
    { days: 7, text: 'Dans 7 jours' },
  ];
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>
<div class="sheet glass" role="dialog" aria-label="Reporter">
  <div class="grab"></div>
  <h2>Reporter</h2>
  <p class="muted">{label}</p>
  {#each OPTIONS as o}
    <button class="btn" onclick={() => onpick(o.days)}>{o.text}</button>
  {/each}
  <button class="btn btn-ghost" onclick={onclose}>Annuler</button>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 60;
  }
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(560px, 100%);
    z-index: 61;
    display: grid;
    gap: 10px;
    padding: 10px 20px calc(20px + var(--safe-bottom));
    border-radius: 28px 28px 0 0;
    background: rgba(14, 30, 22, 0.95);
    animation: slide 0.3s var(--ease);
  }
  .sheet > * {
    position: relative;
    z-index: 1;
  }
  .grab {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.25);
    margin: 0 auto 4px;
  }
  h2,
  p {
    margin: 0;
  }
  @keyframes slide {
    from {
      transform: translate(-50%, 100%);
    }
  }
</style>
