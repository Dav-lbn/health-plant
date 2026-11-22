<script lang="ts">
  let { title, text, icon = '🌱', children }: { title: string; text: string; icon?: string; children?: import('svelte').Snippet } = $props();
</script>

<div class="empty glass">
  <div class="halo"><span>{icon}</span></div>
  <h2>{title}</h2>
  <p class="muted">{text}</p>
  {#if children}{@render children()}{/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 6px;
    padding: 36px 24px;
  }
  .halo {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 44px;
    background: radial-gradient(circle at 35% 30%, rgba(125, 255, 181, 0.35), rgba(15, 157, 114, 0.12) 60%, transparent 70%);
    box-shadow: 0 0 60px rgba(70, 227, 138, 0.25);
    margin-bottom: 8px;
    animation: float 4s ease-in-out infinite;
  }
  @keyframes float {
    50% {
      transform: translateY(-6px);
    }
  }
  p {
    margin: 0 0 12px;
    max-width: 30ch;
  }
</style>
