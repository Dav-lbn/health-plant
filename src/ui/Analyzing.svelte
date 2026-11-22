<script lang="ts">
  let { text = 'Analyse en cours…' }: { text?: string } = $props();
</script>

<div class="analyzing" role="status" aria-live="polite">
  <div class="orb"><span>🔬</span></div>
  <p>{text}</p>
  <p class="muted small">L’IA examine les feuilles, la couleur et la terre.</p>
</div>

<style>
  .analyzing {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 40px 16px;
    text-align: center;
  }
  .orb {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 48px;
    background: radial-gradient(circle at 35% 30%, rgba(125, 255, 181, 0.45), rgba(15, 157, 114, 0.15) 60%, transparent 72%);
    box-shadow: 0 0 60px rgba(70, 227, 138, 0.35);
    animation: pulse 1.6s ease-in-out infinite;
    margin-bottom: 10px;
  }
  @keyframes pulse {
    50% {
      transform: scale(1.08);
      box-shadow: 0 0 90px rgba(70, 227, 138, 0.55);
    }
  }
  p {
    margin: 0;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .small {
    font-size: 0.85rem;
    font-weight: 500;
  }
</style>
