<script lang="ts">
  let { before, after, beforeLabel, afterLabel }: { before: string; after: string; beforeLabel: string; afterLabel: string } = $props();
  let pos = $state(50);
</script>

<div class="ba glass" style="--pos: {pos}%">
  <img class="after" src={after} alt="Maintenant" />
  <img class="before" src={before} alt="Avant" />
  <div class="line" aria-hidden="true"><span>⇆</span></div>
  <span class="tag l">{beforeLabel}</span>
  <span class="tag r">{afterLabel}</span>
  <input type="range" min="0" max="100" bind:value={pos} aria-label="Comparer avant et après" />
</div>

<style>
  .ba {
    position: relative;
    aspect-ratio: 4 / 3;
    border-radius: 22px;
    padding: 0;
    touch-action: pan-y;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .before {
    clip-path: inset(0 calc(100% - var(--pos)) 0 0);
  }
  .line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--pos);
    width: 2px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
    transform: translateX(-1px);
    pointer-events: none;
  }
  .line span {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(10, 25, 18, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(8px);
    font-weight: 700;
  }
  .tag {
    position: absolute;
    top: 10px;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    font-size: 0.78rem;
    font-weight: 700;
    pointer-events: none;
  }
  .l {
    left: 10px;
  }
  .r {
    right: 10px;
  }
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
    margin: 0;
    z-index: 2;
  }
</style>
