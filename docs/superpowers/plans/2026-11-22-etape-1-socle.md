# Health Plant — Étape 1 (socle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une PWA installable, sombre et glossy, pour gérer ses plantes (pièces, fiche, soins, chronologie) avec stockage local et export/import — sans IA pour l'instant.

**Architecture:** Application Svelte 5 + TypeScript construite par Vite, servie en statique sur GitHub Pages. Toutes les données vivent dans IndexedDB via Dexie (photos en Blob). La logique métier (dates, soins, sauvegarde, photos) est dans `src/lib/` en fonctions pures ou modules testés ; l'interface dans `src/ui/`.

**Tech Stack:** Svelte 5.59, Vite 8, TypeScript, Dexie 4, vite-plugin-pwa 1.x, Vitest + fake-indexeddb, Playwright (chromium préinstallé) pour le test de bout en bout.

**Spec:** `docs/superpowers/specs/2026-11-22-health-plant-design.md` (sections Plantes, Soins — hors prévision intelligente, Chronologie, Sauvegarde — export/import manuel seulement, Design premium).

## Global Constraints

- Interface entièrement en français.
- Thème sombre uniquement, « glossy » : fonds sombres profonds avec dégradés vert forêt, cartes en verre dépoli (transparence + flou + reflet léger), vert vif = bonne santé, ambre = à surveiller, rouge corail = malade. Contraste texte ≥ 4.5:1.
- Cible : Samsung Galaxy Z Fold 5 ; une colonne en dessous de 600 px de large, deux colonnes (liste | détail) à partir de 600 px.
- Coût nul ; aucun serveur ; aucune clé ni secret dans le dépôt.
- Photos redimensionnées à 1280 px max (côté le plus long), JPEG qualité 0.85 ; miniatures 320 px.
- Expositions : `plein-soleil` « Plein soleil », `lumiere-vive` « Lumière vive indirecte », `mi-ombre` « Mi-ombre », `ombre` « Ombre ».
- Types de soins : `arrosage` 💧, `engrais` 🧪, `rempotage` 🪴, `taille` ✂️, `traitement` 💊.
- Dates de soins stockées en date locale `YYYY-MM-DD` ; horodatages techniques en ISO.
- Base GitHub Pages : `/health-plant/`.
- `navigator.storage.persist()` demandé au démarrage.

## Review Focus

1. Supprimer une plante → ses soins et photos sont supprimés aussi ; supprimer une pièce → ses plantes passent « Sans pièce », rien n'est perdu.
2. Importer un fichier invalide ou d'un autre format → refusé avec un message, les données existantes intactes (validation avant remplacement, remplacement dans une transaction).
3. Photo très grande (50 Mpx du Fold) ou tournée (EXIF) → redimensionnée et dans le bon sens.
4. Quantité d'eau vide ou non numérique → enregistrée `null`, affichée « — », jamais `NaN`.
5. Soin enregistré juste avant/après minuit → compté le bon jour local (pas de décalage UTC).

---

### Task 1: Socle du projet, thème et déploiement

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/ui/theme.css`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `.github/workflows/deploy.yml`, `.gitignore`, `vitest.config.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `test` (vitest run), `e2e` ; variables CSS de `theme.css` utilisées par toutes les vues : `--bg`, `--bg-gradient`, `--glass`, `--glass-border`, `--glass-highlight`, `--text`, `--text-muted`, `--accent` (vert vif), `--ok`, `--warn`, `--bad`, `--radius`, `--blur` ; classes utilitaires `.glass`, `.btn`, `.btn-primary`, `.chip`.

- [ ] **Step 1:** `npm create vite` équivalent à la main : Svelte 5 + TS, `base: '/health-plant/'`, vite-plugin-pwa (`registerType: 'autoUpdate'`, manifest : name « Health Plant », short_name « Plantes », lang `fr`, `display: 'standalone'`, `theme_color` et `background_color` = `--bg`, les 3 icônes), Vitest environnement `jsdom` avec `fake-indexeddb/auto` en setup.
- [ ] **Step 2:** Générer les icônes (feuille stylisée verte lumineuse sur fond sombre) avec un script Node one-shot (canvas ou SVG → PNG via Playwright), non commité.
- [ ] **Step 3:** `theme.css` : variables ci-dessus, fond `radial-gradient` vert forêt sur `#07110c`, `.glass` = fond rgba translucide + `backdrop-filter: blur(var(--blur))` + bordure 1px claire + reflet en dégradé haut, typographie système, zones tactiles ≥ 44 px, `prefers-reduced-motion` respecté.
- [ ] **Step 4:** `tests/smoke.test.ts` : `expect(1 + 1).toBe(2)` pour valider la chaîne ; `npm test` → PASS ; `npm run build` → réussit et produit `dist/manifest.webmanifest`.
- [ ] **Step 5:** `deploy.yml` : sur push de `main`, `npm ci && npm test && npm run build`, publication `dist/` via `actions/deploy-pages`.
- [ ] **Step 6:** Commit `chore: socle Vite + Svelte + PWA, thème sombre glossy`.

### Task 2: Modèle de données et dates locales

**Files:**
- Create: `src/lib/types.ts`, `src/lib/dates.ts`, `src/lib/db.ts`, `src/lib/repo.ts`
- Test: `tests/dates.test.ts`, `tests/repo.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type Exposure = 'plein-soleil' | 'lumiere-vive' | 'mi-ombre' | 'ombre'`
  - `type CareType = 'arrosage' | 'engrais' | 'rempotage' | 'taille' | 'traitement'`
  - `interface Room { id: string; name: string; order: number }`
  - `interface Plant { id: string; name: string; species: string | null; roomId: string | null; exposure: Exposure | null; waterAmountMl: number | null; notes: string; photoId: string | null; careFrequencyDays: Partial<Record<CareType, number>>; createdAt: string; updatedAt: string }`
  - `interface CareEvent { id: string; plantId: string; type: CareType; date: string /* YYYY-MM-DD */; amountMl: number | null; notes: string; createdAt: string }`
  - `interface Photo { id: string; plantId: string; blob: Blob; thumb: Blob; takenAt: string }`
  - `EXPOSURE_LABELS`, `CARE_LABELS`, `CARE_ICONS` (valeurs des Global Constraints)
- Produces (`dates.ts`): `todayLocal(now?: Date): string`, `daysBetween(a: string, b: string): number`, `formatDateFr(d: string): string` (« 22 nov. 2026 »), `parseAmount(input: string): number | null`
- Produces (`db.ts`): `db` Dexie, tables `rooms`, `plants` (index `roomId`), `careEvents` (index `plantId`, `[plantId+date]`), `photos` (index `plantId`), `meta` (clé/valeur).
- Produces (`repo.ts`): `createPlant(input: Omit<Plant,'id'|'createdAt'|'updatedAt'>): Promise<Plant>`, `updatePlant(id: string, patch: Partial<Plant>): Promise<void>`, `deletePlant(id: string): Promise<void>`, `listPlants(): Promise<Plant[]>`, `getPlant(id): Promise<Plant | undefined>`, `createRoom(name: string): Promise<Room>`, `renameRoom(id, name)`, `deleteRoom(id): Promise<void>`, `listRooms(): Promise<Room[]>`, `logCare(input: Omit<CareEvent,'id'|'createdAt'>): Promise<CareEvent>`, `deleteCare(id)`, `listCare(plantId: string): Promise<CareEvent[]>` (date décroissante), `lastCare(plantId: string, type: CareType): Promise<CareEvent | undefined>`

- [ ] **Step 1: Tests `dates.test.ts`**
  - `todayLocal(new Date(2026, 10, 22, 23, 59))` → `'2026-11-22'` ; `todayLocal(new Date(2026, 10, 23, 0, 1))` → `'2026-11-23'`
  - `daysBetween('2026-11-20', '2026-11-22')` → `2` ; à travers le changement d'heure `daysBetween('2026-10-24','2026-10-26')` → `2`
  - `parseAmount('250')` → `250`, `parseAmount(' 250,5 ')` → `250.5`, `parseAmount('')` → `null`, `parseAmount('abc')` → `null`, `parseAmount('-3')` → `null`
  - `formatDateFr('2026-11-22')` → `'22 nov. 2026'`
- [ ] **Step 2: Tests `repo.test.ts`** (base vidée avant chaque test)
  - `createPlant` puis `getPlant` renvoie la plante avec `id`, `createdAt`
  - `logCare` ×3 dates différentes → `listCare` trié décroissant ; `lastCare(id,'arrosage')` = la plus récente
  - `deletePlant` → `listCare(id)` vide et `db.photos.where('plantId').equals(id).count()` = 0
  - `deleteRoom` → les plantes de la pièce ont `roomId === null`, toujours présentes
- [ ] **Step 3:** Lancer `npm test` → FAIL (modules absents).
- [ ] **Step 4:** Implémenter `types.ts`, `dates.ts`, `db.ts`, `repo.ts`. Ids via `crypto.randomUUID()`. `deletePlant` et `deleteRoom` dans une transaction Dexie `rw` sur les tables concernées. Dates calculées sur composantes locales (jamais `toISOString().slice(0,10)`).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: modèle de données, dépôt Dexie et dates locales`.

### Task 3: Photos (redimensionnement, miniatures)

**Files:**
- Create: `src/lib/photos.ts`
- Test: `tests/photos.test.ts`

**Interfaces:**
- Consumes: `db`, `Photo`
- Produces: `fitWithin(w: number, h: number, max: number): { width: number; height: number }`, `processImage(file: Blob): Promise<{ blob: Blob; thumb: Blob }>`, `savePhoto(plantId: string, file: Blob): Promise<Photo>`, `photoUrl(blob: Blob): string` (URL objet mise en cache par id, révoquée à la suppression)

- [ ] **Step 1: Tests** `fitWithin(8160, 6120, 1280)` → `{1280, 960}` ; `fitWithin(6120, 8160, 1280)` → `{960, 1280}` ; `fitWithin(800, 600, 1280)` → `{800, 600}` (jamais agrandi) ; `fitWithin(1280,1280,320)` → `{320,320}`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implémenter. `processImage` : `createImageBitmap(file, { imageOrientation: 'from-image' })`, dessin sur `OffscreenCanvas` (repli `<canvas>`), `convertToBlob({ type: 'image/jpeg', quality: 0.85 })` pour 1280 et 320. Testé dans le navigateur à la Task 7, pas sous jsdom.
- [ ] **Step 4:** `npm test` → PASS. Commit `feat: traitement des photos`.

### Task 4: Export / import

**Files:**
- Create: `src/lib/backup.ts`
- Test: `tests/backup.test.ts`

**Interfaces:**
- Consumes: `db`, types de Task 2
- Produces:
  - `interface BackupFile { app: 'health-plant'; version: 1; exportedAt: string; rooms: Room[]; plants: Plant[]; careEvents: CareEvent[]; photos: Array<Omit<Photo,'blob'|'thumb'> & { blob: string; thumb: string }> /* data URL */ }`
  - `exportAll(): Promise<BackupFile>`, `exportBlob(): Promise<Blob>` (JSON, nom suggéré `health-plant-AAAA-MM-JJ.json`)
  - `validateBackup(x: unknown): x is BackupFile`
  - `importAll(x: unknown): Promise<void>` — lève `Error('Fichier de sauvegarde invalide')` si non valide
  - `lastExportDate(): Promise<string | null>`, enregistrée dans `meta` à chaque export

- [ ] **Step 1: Tests**
  - aller-retour : créer 1 pièce, 2 plantes, 3 soins, 1 photo → `exportAll` → vider la base → `importAll` → mêmes enregistrements (photo : même taille de Blob)
  - `importAll({ app: 'autre' })` rejette avec `'Fichier de sauvegarde invalide'` et la base contient toujours les données d'avant
  - `importAll` d'un fichier valide mais dont un soin référence une plante inexistante → rejeté, base intacte
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implémenter : validation complète (forme + références) avant toute écriture ; remplacement total dans une seule transaction `rw` sur toutes les tables.
- [ ] **Step 4:** `npm test` → PASS. Commit `feat: export et import des données`.

### Task 5: Navigation, mise en page Fold et liste des plantes

**Files:**
- Create: `src/lib/router.ts`, `src/lib/stores.svelte.ts`, `src/ui/Layout.svelte`, `src/ui/PlantList.svelte`, `src/ui/PlantCard.svelte`, `src/ui/EmptyState.svelte`, `src/ui/haptics.ts`
- Modify: `src/App.svelte`
- Test: `tests/router.test.ts`

**Interfaces:**
- Consumes: `repo.ts`, `photos.ts`, `dates.ts`
- Produces:
  - `type Route = { name: 'plants' } | { name: 'plant'; id: string } | { name: 'plant-new' } | { name: 'plant-edit'; id: string } | { name: 'settings' }`
  - `parseHash(hash: string): Route`, `toHash(r: Route): string`, `navigate(r: Route): void`, `route` (état réactif Svelte)
  - `stores.svelte.ts` : état réactif `plants`, `rooms`, `refresh(): Promise<void>` (relit Dexie après chaque écriture)
  - `vibrate(kind: 'tap' | 'success'): void` (`navigator.vibrate(10)` / `[10,40,20]`, sans effet si absent)

- [ ] **Step 1: Tests** `parseHash('#/plante/abc')` → `{name:'plant',id:'abc'}` ; `parseHash('')` → `{name:'plants'}` ; `parseHash('#/nimporte')` → `{name:'plants'}` ; `toHash(parseHash(h)) === h` pour `#/plante/abc`, `#/plante/abc/modifier`, `#/nouvelle-plante`, `#/reglages`.
- [ ] **Step 2:** `npm test` → FAIL ; implémenter `router.ts` ; PASS.
- [ ] **Step 3:** `Layout.svelte` : barre du bas (Plantes, Réglages) sous 600 px ; ≥ 600 px, la liste reste à gauche (~40 %) et la route `plant*` s'affiche à droite ; `env(safe-area-inset-*)` respecté.
- [ ] **Step 4:** `PlantList` : recherche par nom/espèce, sections par pièce (ordre `order`, puis « Sans pièce »), bouton flottant « + ». `PlantCard` : miniature, nom, espèce, pastille « 💧 il y a N j » (ou « jamais arrosée »). `EmptyState` : illustration + « Ajoutez votre première plante ».
- [ ] **Step 5:** Commit `feat: navigation, mise en page Fold et liste des plantes`.

### Task 6: Fiche plante, formulaire, soins rapides, chronologie, réglages

**Files:**
- Create: `src/ui/PlantForm.svelte`, `src/ui/PlantDetail.svelte`, `src/ui/CareQuickActions.svelte`, `src/ui/CareSheet.svelte`, `src/ui/Timeline.svelte`, `src/ui/Settings.svelte`, `src/ui/Toast.svelte`
- Test: `tests/care.test.ts`
- Create: `src/lib/care.ts`

**Interfaces:**
- Consumes: tout ce qui précède
- Produces (`care.ts`): `daysSinceLast(events: CareEvent[], type: CareType, today: string): number | null`, `buildTimeline(events: CareEvent[], photos: Photo[]): TimelineItem[]` avec `type TimelineItem = { kind: 'care'; date: string; event: CareEvent } | { kind: 'photo'; date: string; photo: Photo }`, trié date décroissante (étendu aux diagnostics à l'étape 2).

- [ ] **Step 1: Tests `care.test.ts`** `daysSinceLast([], 'arrosage', '2026-11-22')` → `null` ; avec arrosages au 2026-11-15 et 2026-11-20 → `2` ; ignore les autres types ; `buildTimeline` mélange soins et photos triés décroissant, à date égale les soins avant les photos.
- [ ] **Step 2:** `npm test` → FAIL ; implémenter `care.ts` ; PASS.
- [ ] **Step 3:** `PlantForm` : nom (obligatoire), espèce, pièce (liste + « Nouvelle pièce… »), exposition (4 boutons), quantité d'eau (mL, via `parseAmount`), fréquence par type de soin (jours, facultatif), notes, photo (`<input type="file" accept="image/*" capture="environment">` → `savePhoto`). Enregistrer → `vibrate('success')`, toast « Plante enregistrée ».
- [ ] **Step 4:** `PlantDetail` : grande photo avec reflet glossy, infos, `CareQuickActions` (5 boutons ; « 💧 Arrosé » enregistre directement aujourd'hui avec `waterAmountMl` puis toast « Arrosage enregistré — Annuler » ; appui long ou « … » ouvre `CareSheet` pour date/quantité/notes), `Timeline`, bouton « Ajouter une photo », menu Modifier / Supprimer (confirmation « Supprimer {nom} et tout son historique ? »).
- [ ] **Step 5:** `Settings` : gestion des pièces (ajout, renommage, suppression avec confirmation), « Exporter mes données » (téléchargement), « Importer » (confirmation « Remplacer toutes les données actuelles ? », message d'erreur si invalide), date du dernier export, encart « Pensez à exporter » si > 30 jours ou jamais, version de l'app.
- [ ] **Step 6:** Commit `feat: fiche plante, soins, chronologie et réglages`.

### Task 7: Vérification de bout en bout et finitions

**Files:**
- Create: `e2e/parcours.spec.ts`, `playwright.config.ts`, `e2e/fixtures/grande-photo.jpg` (générée, 6000×4000)

- [ ] **Step 1: Test e2e** (viewport 374×832 puis 690×740 — écrans externe et déplié du Fold 5) :
  - créer pièce « Salon », plante « Monstera » avec photo `grande-photo.jpg` → la miniature apparaît ; en base la photo fait ≤ 1280 px
  - « 💧 Arrosé » → chronologie affiche l'arrosage du jour ; pastille « 💧 aujourd'hui »
  - à 690 px de large, liste et fiche visibles côte à côte
  - exporter, supprimer la plante, importer → la plante et son arrosage reviennent
  - importer un fichier `{"foo":1}` → message « Fichier de sauvegarde invalide », plante toujours là
- [ ] **Step 2:** `npm run e2e -- --trace off` → PASS.
- [ ] **Step 3:** Captures d'écran (deviceScaleFactor 2) des deux largeurs, relues pour contraste et effet glossy ; corriger ce qui ne va pas.
- [ ] **Step 4:** `npm test && npm run build` → PASS. Commit `test: parcours de bout en bout étape 1`. Push de la branche.
