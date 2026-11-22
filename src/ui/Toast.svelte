<script lang="ts">
  import { toast } from '../lib/stores.svelte';

  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (!toast.id) return;
    visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => (visible = false), toast.action ? 5000 : 2600);
  });

  function act() {
    toast.action?.run();
    visible = false;
  }
</script>

{#if visible}
  {#key toast.id}
    <div class="toast glass" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {#if toast.action}
        <button class="btn btn-ghost" onclick={act}>{toast.action.label}</button>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(96px + var(--safe-bottom));
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 18px;
    min-height: 52px;
    border-radius: 999px;
    background: rgba(18, 38, 28, 0.88);
    border-color: rgba(70, 227, 138, 0.35);
    font-weight: 600;
    max-width: calc(100vw - 32px);
    animation: up 0.35s var(--ease);
  }
  .btn-ghost {
    color: var(--accent);
    min-height: 36px;
  }
  @keyframes up {
    from {
      opacity: 0;
      transform: translate(-50%, 16px);
    }
  }
</style>
