<script lang="ts">
  import type { Task } from '../lib/schedule';
  import type { Plant, Photo } from '../lib/types';
  import { CARE_ICONS } from '../lib/types';
  import { photoUrl } from '../lib/photos';

  let {
    task,
    plant,
    photo,
    ondone,
    onpostpone,
  }: { task: Task; plant: Plant; photo?: Photo; ondone: () => void; onpostpone: () => void } = $props();

  let leaving = $state(false);

  function dueText(t: Task): string {
    if (t.status === 'retard') return t.daysLate === 1 ? 'en retard d’un jour' : `en retard de ${t.daysLate} j`;
    if (t.status === 'aujourdhui') return 'aujourd’hui';
    const [y, m, d] = t.due.split('-').map(Number);
    const days = Math.round((new Date(y, m - 1, d).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
    return days === 1 ? 'demain' : `dans ${days} j`;
  }

  function done() {
    leaving = true;
    setTimeout(ondone, 260);
  }
</script>

<div class="task glass {task.status}" class:leaving>
  <a class="thumb" href={`#/plante/${plant.id}`} aria-label={plant.name}>
    {#if photo}<img src={photoUrl(`${photo.id}:thumb`, photo.thumb)} alt="" />{:else}🪴{/if}
    <span class="ico">{task.careType ? CARE_ICONS[task.careType] : '🔬'}</span>
  </a>
  <div class="txt">
    <p class="label">{task.label}{#if task.detail && task.kind === 'care'}<span class="muted"> · {task.detail}</span>{/if}</p>
    <p class="sub">
      <strong>{plant.name}</strong> · <span class="due">{dueText(task)}</span>
    </p>
    {#if task.kind === 'action' && task.detail}<p class="muted from">{task.detail}</p>{/if}
  </div>
  <div class="acts">
    <button class="check" aria-label={`Fait : ${task.label} (${plant.name})`} onclick={done}>✓</button>
    <button class="later" onclick={onpostpone}>Reporter</button>
  </div>
</div>

<style>
  .task {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 10px;
    border-radius: 20px;
    transition:
      opacity 0.25s,
      transform 0.25s var(--ease);
  }
  .task > * {
    position: relative;
    z-index: 1;
  }
  .task.retard {
    border-color: rgba(255, 107, 94, 0.45);
    box-shadow: 0 8px 30px rgba(255, 107, 94, 0.12);
  }
  .task.leaving {
    opacity: 0;
    transform: translateX(40px) scale(0.96);
  }
  .thumb {
    position: relative;
    width: 56px;
    height: 56px;
    flex: none;
    border-radius: 16px;
    overflow: visible;
    display: grid;
    place-items: center;
    font-size: 26px;
    text-decoration: none;
    background: linear-gradient(145deg, rgba(70, 227, 138, 0.18), rgba(0, 0, 0, 0.3));
    border: 1px solid var(--glass-border);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 15px;
  }
  .ico {
    position: absolute;
    right: -8px;
    bottom: -8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 15px;
    background: rgba(10, 25, 18, 0.95);
    border: 1px solid var(--glass-border);
  }
  .txt {
    flex: 1;
    min-width: 0;
  }
  .txt p {
    margin: 0;
  }
  .label {
    font-weight: 700;
  }
  .sub {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .sub strong {
    color: var(--text);
    font-weight: 600;
  }
  .retard .due {
    color: var(--bad);
    font-weight: 700;
  }
  .aujourdhui .due {
    color: var(--accent);
    font-weight: 700;
  }
  .from {
    font-size: 0.75rem;
  }
  .acts {
    display: grid;
    justify-items: center;
    gap: 2px;
  }
  .check {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #04170d;
    font-size: 1.3rem;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 4px 18px var(--accent-glow);
    transition: transform 0.15s var(--ease);
  }
  .check:active {
    transform: scale(0.88);
  }
  .later {
    background: none;
    border: 0;
    color: var(--text-muted);
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 4px;
    cursor: pointer;
  }
</style>
