<script lang="ts">
  import { app, refresh, showToast } from '../lib/stores.svelte';
  import { createPlant, createRoom, getPlant, updatePlant } from '../lib/repo';
  import { savePhoto, photoUrl } from '../lib/photos';
  import { parseAmount } from '../lib/dates';
  import { navigate } from '../lib/router';
  import { db } from '../lib/db';
  import { CARE_ICONS, CARE_LABELS, CARE_TYPES, EXPOSURES, EXPOSURE_ICONS, EXPOSURE_LABELS } from '../lib/types';
  import type { CareType, Exposure, Plant } from '../lib/types';
  import { vibrate } from './haptics';

  let { id = null }: { id?: string | null } = $props();

  let name = $state('');
  let species = $state('');
  let roomId = $state<string>('');
  let newRoom = $state('');
  let exposure = $state<Exposure | null>(null);
  let water = $state('');
  let notes = $state('');
  let freq = $state<Record<CareType, string>>({ arrosage: '', engrais: '', rempotage: '', taille: '', traitement: '' });
  let photoFile = $state<File | null>(null);
  let preview = $state<string | null>(null);
  let existing = $state<Plant | null>(null);
  let saving = $state(false);
  let error = $state('');

  $effect(() => {
    if (!id) return;
    getPlant(id).then(async (p) => {
      if (!p) return;
      existing = p;
      name = p.name;
      species = p.species ?? '';
      roomId = p.roomId ?? '';
      exposure = p.exposure;
      water = p.waterAmountMl != null ? String(p.waterAmountMl) : '';
      notes = p.notes;
      for (const t of CARE_TYPES) freq[t] = p.careFrequencyDays[t] != null ? String(p.careFrequencyDays[t]) : '';
      if (p.photoId) {
        const ph = await db.photos.get(p.photoId);
        if (ph) preview = photoUrl(ph.id, ph.blob);
      }
    });
  });

  function onPhoto(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    photoFile = f;
    preview = URL.createObjectURL(f);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (!name.trim()) {
      error = 'Donnez un nom à votre plante.';
      return;
    }
    saving = true;
    try {
      let room: string | null = roomId || null;
      if (roomId === '__new') {
        room = newRoom.trim() ? (await createRoom(newRoom)).id : null;
      }
      const careFrequencyDays: Partial<Record<CareType, number>> = {};
      for (const t of CARE_TYPES) {
        const n = parseAmount(freq[t]);
        if (n && n > 0) careFrequencyDays[t] = Math.round(n);
      }
      const data = {
        name: name.trim(),
        species: species.trim() || null,
        roomId: room,
        exposure,
        waterAmountMl: parseAmount(water),
        notes: notes.trim(),
        careFrequencyDays,
      };
      let plantId: string;
      if (existing) {
        plantId = existing.id;
        await updatePlant(plantId, data);
      } else {
        plantId = (await createPlant({ ...data, photoId: null })).id;
      }
      if (photoFile) {
        const ph = await savePhoto(plantId, photoFile);
        await updatePlant(plantId, { photoId: ph.id });
      }
      await refresh();
      vibrate('success');
      showToast('Plante enregistrée');
      navigate({ name: 'plant', id: plantId }, true);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Enregistrement impossible.';
    } finally {
      saving = false;
    }
  }
</script>

<form class="form" onsubmit={submit}>
  <header class="top">
    <a class="btn btn-icon btn-ghost" href={existing ? `#/plante/${existing.id}` : '#/plantes'} aria-label="Retour">‹</a>
    <h1>{existing ? 'Modifier' : 'Nouvelle plante'}</h1>
  </header>

  <label class="photo glass" class:has={!!preview}>
    {#if preview}
      <img src={preview} alt="Aperçu" />
      <span class="chip">📷 Changer la photo</span>
    {:else}
      <span class="cam">📷</span>
      <span>Prendre ou choisir une photo</span>
    {/if}
    <input type="file" accept="image/*" capture="environment" onchange={onPhoto} hidden data-testid="photo-input" />
  </label>

  <div class="glass group">
    <label class="field">Nom *<input bind:value={name} placeholder="ex. Monstera du salon" required /></label>
    <label class="field">Espèce<input bind:value={species} placeholder="ex. Monstera deliciosa" /></label>
    <label class="field">
      Pièce
      <select bind:value={roomId}>
        <option value="">Sans pièce</option>
        {#each app.rooms as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
        <option value="__new">＋ Nouvelle pièce…</option>
      </select>
    </label>
    {#if roomId === '__new'}
      <label class="field">Nom de la nouvelle pièce<input bind:value={newRoom} placeholder="ex. Salon" /></label>
    {/if}
  </div>

  <div class="glass group">
    <span class="label">Exposition à la lumière</span>
    <div class="expo">
      {#each EXPOSURES as x}
        <button type="button" class="opt" class:on={exposure === x} aria-pressed={exposure === x} onclick={() => { exposure = exposure === x ? null : x; vibrate('tap'); }}>
          <span>{EXPOSURE_ICONS[x]}</span>{EXPOSURE_LABELS[x]}
        </button>
      {/each}
    </div>
    <label class="field">Quantité d'eau habituelle (mL)<input bind:value={water} inputmode="decimal" placeholder="ex. 300" /></label>
  </div>

  <details class="glass group">
    <summary>Fréquence des soins (facultatif)</summary>
    <div class="freq">
      {#each CARE_TYPES as t}
        <label class="field">{CARE_ICONS[t]} {CARE_LABELS[t]} — tous les … jours<input bind:value={freq[t]} inputmode="numeric" placeholder="—" /></label>
      {/each}
    </div>
  </details>

  <div class="glass group">
    <label class="field">Notes<textarea bind:value={notes} placeholder="Origine, particularités…"></textarea></label>
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <button class="btn btn-primary save" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
</form>

<style>
  .form {
    display: grid;
    gap: 14px;
    padding-bottom: 24px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .top h1 {
    margin: 0;
  }
  .top .btn {
    font-size: 1.8rem;
  }
  .group {
    display: grid;
    gap: 14px;
    padding: 16px;
  }
  .label,
  summary {
    font-size: 0.9rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  summary {
    cursor: pointer;
    min-height: 28px;
  }
  .freq {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }
  .photo {
    display: grid;
    place-items: center;
    gap: 6px;
    min-height: 180px;
    cursor: pointer;
    color: var(--text-muted);
    font-weight: 600;
    border-style: dashed;
  }
  .photo.has {
    border-style: solid;
    padding: 0;
  }
  .photo img {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    display: block;
  }
  .photo.has .chip {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.55);
  }
  .cam {
    font-size: 40px;
  }
  .expo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 12px;
    border-radius: 14px;
    border: 1px solid var(--glass-border);
    background: rgba(0, 0, 0, 0.22);
    color: var(--text);
    font: inherit;
    font-size: 0.88rem;
    text-align: left;
    cursor: pointer;
  }
  .opt span {
    font-size: 1.2rem;
  }
  .opt.on {
    border-color: var(--accent);
    background: rgba(70, 227, 138, 0.15);
    box-shadow: 0 0 18px rgba(70, 227, 138, 0.2);
  }
  .error {
    color: #ffb3ab;
    margin: 0;
  }
  .save {
    min-height: 54px;
    font-size: 1.05rem;
  }
</style>
