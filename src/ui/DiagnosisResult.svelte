<script lang="ts">
  import { onMount } from 'svelte';
  import { app, refresh, showToast } from '../lib/stores.svelte';
  import { getDiagnosis } from '../lib/repo';
  import { answerQuestions, markActionDone, runDiagnosis, startDiagnosis } from '../lib/diagnosis';
  import { loadAiSettings, hasKey, type AiSettings } from '../lib/ai/settings';
  import { db } from '../lib/db';
  import { photoUrl } from '../lib/photos';
  import { navigate } from '../lib/router';
  import { formatDateFr } from '../lib/dates';
  import { CARE_ICONS, PROVIDER_LABELS, TREND_LABELS } from '../lib/types';
  import type { Diagnosis, Photo, ProviderId, RecommendedAction } from '../lib/types';
  import HealthBadge from './HealthBadge.svelte';
  import BeforeAfter from './BeforeAfter.svelte';
  import Analyzing from './Analyzing.svelte';
  import { vibrate } from './haptics';

  let { id, diagId }: { id: string; diagId: string } = $props();

  let d = $state<Diagnosis | null>(null);
  let photos = $state<Photo[]>([]);
  let previousPhoto = $state<Photo | null>(null);
  let previousDate = $state('');
  let settings = $state<AiSettings | null>(null);
  let answers = $state<string[]>([]);
  let working = $state(false);
  let notFound = $state(false);

  const plant = $derived(app.plants.find((p) => p.id === id));
  const other = $derived<ProviderId>(d?.provider === 'gemini' ? 'mistral' : 'gemini');
  const canOther = $derived(!!settings && hasKey(other, settings));

  async function load() {
    const got = await getDiagnosis(diagId);
    if (!got) {
      notFound = true;
      return;
    }
    d = got;
    photos = (await db.photos.bulkGet(got.photoIds)).filter((p): p is Photo => !!p);
    answers = (got.result?.questions ?? []).map(() => '');
    const prev = (await db.diagnoses.where('plantId').equals(id).toArray())
      .filter((x) => x.id !== got.id && x.status === 'termine' && x.createdAt < got.createdAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (prev) {
      const idx = Math.max(0, prev.photoKinds.indexOf('ensemble'));
      previousPhoto = (await db.photos.get(prev.photoIds[idx])) ?? null;
      previousDate = prev.date;
    } else {
      previousPhoto = null;
    }
  }

  onMount(async () => {
    settings = await loadAiSettings();
    await load();
  });

  async function retry() {
    if (!d) return;
    working = true;
    d = await runDiagnosis(d.id);
    await refresh();
    await load();
    working = false;
  }

  async function refine() {
    if (!d?.result) return;
    working = true;
    const qa = d.result.questions.map((q, i) => ({ question: q, answer: answers[i]?.trim() || 'Je ne sais pas' }));
    d = await answerQuestions(d.id, qa);
    await refresh();
    await load();
    working = false;
    vibrate('success');
  }

  async function secondOpinion() {
    if (!d) return;
    working = true;
    const files = photos.map((p, i) => ({ kind: d!.photoKinds[i], file: p.blob }));
    const nd = await startDiagnosis(id, files, other);
    await refresh();
    working = false;
    navigate({ name: 'diagnosis', id, diagId: nd.id }, true);
  }

  async function done(i: number, a: RecommendedAction) {
    if (!d || a.doneAt) return;
    await markActionDone(d.id, i);
    await refresh();
    await load();
    vibrate('success');
    showToast(a.careType ? 'Fait — ajouté à l’historique' : 'Action marquée comme faite');
  }

  function delayLabel(n: number) {
    if (n <= 0) return 'aujourd’hui';
    if (n === 1) return 'demain';
    return `sous ${n} j`;
  }

  const PRIO = { haute: 0, moyenne: 1, basse: 2 } as const;
  const sortedActions = $derived(
    (d?.result?.actions ?? []).map((a, i) => ({ a, i })).sort((x, y) => PRIO[x.a.priority] - PRIO[y.a.priority]),
  );
  const TREND_ICONS = { mieux: '↗', stable: '→', 'moins-bien': '↘', inconnue: '' } as const;
  const SEVERITY = { faible: 'Faible', moyenne: 'Moyenne', forte: 'Forte' } as const;
</script>

<div class="res">
  <header class="top">
    <a class="btn btn-icon btn-ghost" href={`#/plante/${id}`} aria-label="Retour">‹</a>
    <div>
      <p class="eyebrow">Diagnostic{d ? ` · ${formatDateFr(d.date)}` : ''}</p>
      <h1>{plant?.name ?? ''}</h1>
    </div>
  </header>

  {#if notFound}
    <p class="muted">Ce diagnostic n’existe plus.</p>
  {:else if !d || working}
    <Analyzing text={d ? `Analyse par ${PROVIDER_LABELS[d.provider]}…` : 'Chargement…'} />
  {:else if d.status === 'erreur' || d.status === 'en-cours'}
    <div class="glass card err">
      <span class="big">⚠️</span>
      <p role="alert">{d.status === 'en-cours' ? 'Analyse interrompue (application fermée pendant l’analyse).' : d.error}</p>
      <button class="btn btn-primary" onclick={retry}>↻ Réessayer</button>
      {#if canOther}
        <button class="btn" onclick={secondOpinion}>Essayer avec {PROVIDER_LABELS[other]}</button>
      {/if}
      <a class="link" href="#/reglages">Vérifier les réglages de l’IA</a>
    </div>
  {:else if d.status === 'questions' && d.result}
    <div class="glass card">
      <h2>Quelques précisions</h2>
      <p class="muted">L’IA hésite ({Math.round(d.result.confidence * 100)} % de confiance). Vos réponses l’aideront à trancher.</p>
      {#each d.result.questions as q, i}
        <div class="q">
          <p class="qt">{q}</p>
          <div class="quick">
            {#each ['Oui', 'Non', 'Je ne sais pas'] as opt}
              <button class="chip" class:sel={answers[i] === opt} onclick={() => (answers[i] = opt)}>{opt}</button>
            {/each}
          </div>
          <input bind:value={answers[i]} placeholder="Ou répondez librement…" aria-label={q} />
        </div>
      {/each}
      <button class="btn btn-primary" onclick={refine}>Affiner le diagnostic</button>
    </div>
  {:else if d.result}
    {@const r = d.result}
    <div class="hero glass {r.state}">
      <HealthBadge state={r.state} size="lg" />
      <div class="meta">
        <div class="conf">
          <span>Confiance</span>
          <div class="bar"><div style="width: {Math.round(r.confidence * 100)}%"></div></div>
          <strong>{Math.round(r.confidence * 100)} %</strong>
        </div>
        {#if r.trend !== 'inconnue'}
          <span class="chip trend {r.trend}">{TREND_ICONS[r.trend]} {TREND_LABELS[r.trend]}</span>
        {/if}
      </div>
      <p class="summary">{r.summary}</p>
    </div>

    {#if r.problems.length}
      <section>
        <h2>Problèmes détectés</h2>
        <div class="list">
          {#each r.problems as p}
            <div class="glass item sev-{p.severity}">
              <div class="row">
                <strong>{p.name}</strong>
                <span class="chip">{SEVERITY[p.severity]}</span>
              </div>
              {#if p.cause}<p class="muted">{p.cause}</p>{/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if sortedActions.length}
      <section>
        <h2>Actions recommandées</h2>
        <div class="list">
          {#each sortedActions as { a, i } (i)}
            <div class="glass item action" class:done={!!a.doneAt}>
              <span class="aico">{a.careType ? CARE_ICONS[a.careType] : '✳️'}</span>
              <div class="atext">
                <p>{a.action}</p>
                <span class="muted when">{a.priority === 'haute' ? '🔴' : a.priority === 'moyenne' ? '🟠' : '🟢'} {delayLabel(a.delayDays)}</span>
              </div>
              <button class="btn fait" class:btn-primary={!a.doneAt} disabled={!!a.doneAt} onclick={() => done(i, a)}>
                {a.doneAt ? '✓' : '✓ Fait'}
              </button>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if previousPhoto && photos[0]}
      <section>
        <h2>Avant / après</h2>
        <BeforeAfter
          before={photoUrl(previousPhoto.id, previousPhoto.blob)}
          after={photoUrl(photos[0].id, photos[0].blob)}
          beforeLabel={formatDateFr(previousDate)}
          afterLabel="Maintenant"
        />
      </section>
    {/if}

    {#if photos.length}
      <div class="thumbs">
        {#each photos as p}
          <img src={photoUrl(`${p.id}:thumb`, p.thumb)} alt="" />
        {/each}
      </div>
    {/if}

    <p class="muted small by">Analysé par {PROVIDER_LABELS[d.provider]} · {d.model}</p>
    {#if canOther}
      <button class="btn" onclick={secondOpinion}>🔁 Deuxième avis avec {PROVIDER_LABELS[other]}</button>
    {/if}
    <p class="muted small disclaimer">Diagnostic indicatif produit par une IA : en cas de doute, demandez conseil à une jardinerie.</p>
  {/if}
</div>

<style>
  .res {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding-bottom: 24px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .top .btn {
    font-size: 1.8rem;
  }
  .top h1 {
    margin: 0;
  }
  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .card {
    padding: 18px;
    display: grid;
    gap: 12px;
  }
  .card > * {
    position: relative;
    z-index: 1;
  }
  .err {
    justify-items: center;
    text-align: center;
  }
  .big {
    font-size: 2.6rem;
  }
  .link {
    color: var(--accent);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .q {
    display: grid;
    gap: 8px;
  }
  .qt {
    margin: 0;
    font-weight: 700;
  }
  .quick {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .quick .chip {
    cursor: pointer;
    min-height: 36px;
    padding: 6px 14px;
    font: inherit;
    font-size: 0.88rem;
    font-weight: 600;
  }
  .quick .chip.sel {
    background: rgba(70, 227, 138, 0.2);
    border-color: var(--accent);
    color: var(--accent);
  }
  .hero {
    --c: var(--ok);
    padding: 22px 18px;
    display: grid;
    justify-items: center;
    gap: 14px;
    text-align: center;
    background:
      radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%),
      var(--glass);
    border-color: color-mix(in srgb, var(--c) 40%, transparent);
  }
  .hero > * {
    position: relative;
    z-index: 1;
  }
  .hero.surveiller {
    --c: var(--warn);
  }
  .hero.malade {
    --c: var(--bad);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .conf {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .bar {
    width: 90px;
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--accent-2), var(--accent));
    box-shadow: 0 0 10px var(--accent-glow);
  }
  .conf strong {
    color: var(--text);
  }
  .trend.mieux {
    color: var(--ok);
  }
  .trend.moins-bien {
    color: var(--bad);
  }
  .summary {
    margin: 0;
    font-size: 1.02rem;
    line-height: 1.5;
  }
  h2 {
    margin-bottom: 10px;
  }
  .list {
    display: grid;
    gap: 10px;
  }
  .item {
    padding: 12px 14px;
    border-radius: 18px;
  }
  .item > * {
    position: relative;
    z-index: 1;
  }
  .item p {
    margin: 4px 0 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
  }
  .sev-forte {
    border-left: 3px solid var(--bad);
  }
  .sev-moyenne {
    border-left: 3px solid var(--warn);
  }
  .sev-faible {
    border-left: 3px solid var(--ok);
  }
  .action {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .action.done {
    opacity: 0.55;
  }
  .action.done p {
    text-decoration: line-through;
  }
  .aico {
    font-size: 1.5rem;
  }
  .atext {
    flex: 1;
    min-width: 0;
  }
  .atext p {
    margin: 0;
    font-weight: 600;
  }
  .when {
    font-size: 0.8rem;
  }
  .fait {
    flex: none;
    min-height: 40px;
    padding: 0 14px;
  }
  .thumbs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }
  .thumbs img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 14px;
    border: 1px solid var(--glass-border);
  }
  .small {
    font-size: 0.82rem;
    margin: 0;
  }
  .by,
  .disclaimer {
    text-align: center;
  }
</style>
