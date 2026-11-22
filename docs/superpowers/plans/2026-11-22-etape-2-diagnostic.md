# Health Plant — Étape 2 (diagnostic IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnostic de santé sur photos (Gemini ou Mistral au choix) avec prise de vue guidée, confiance, questions de précision, suivi d'évolution, comparaison avant/après, et fiche d'espèce générée par l'IA.

**Architecture:** Une interface commune `AnalysisProvider` (Gemini, Mistral) appelée directement depuis le navigateur avec la clé de l'utilisateur. Les prompts et la validation des réponses sont des fonctions pures testées. Un service `diagnosis.ts` assemble le contexte de la plante, appelle l'IA et enregistre un `Diagnosis` dans Dexie (version 2 du schéma). Mistral peut passer par un relais Cloudflare Worker (code fourni dans `relay/`) si l'appel direct est bloqué par CORS.

**Tech Stack:** existant (Svelte 5, Dexie 4, Vitest, Playwright). API REST Gemini `generativelanguage.googleapis.com/v1beta` et Mistral `api.mistral.ai/v1`.

**Spec:** `docs/superpowers/specs/2026-11-22-health-plant-design.md` (sections Diagnostic, Fiche d'espèce, Chronologie ; Décisions — IA).

## Global Constraints

- Interface en français ; thème sombre glossy de l'étape 1 (variables de `theme.css`).
- Clés d'API saisies par l'utilisateur, stockées dans `db.meta` uniquement ; jamais dans le code, le dépôt, ni l'export de sauvegarde.
- Coût nul : offres gratuites uniquement ; aucun serveur hors relais Cloudflare Worker optionnel.
- Gemini : appel direct (CORS vérifié : `access-control-allow-origin` renvoyé pour `https://dav-lbn.github.io`). En-tête `x-goog-api-key`. Réponse JSON via `generationConfig.responseMimeType = 'application/json'`.
- Mistral : `POST {base}/v1/chat/completions`, `Authorization: Bearer <clé>`, `response_format: { type: 'json_object' }`, images en `image_url` data URL. `base` = `https://api.mistral.ai` par défaut, ou URL du relais.
- Modèles choisis dans une liste obtenue de l'API (`GET models`), filtrée aux modèles capables d'images ; un choix par défaut automatique, modifiable.
- Photos de diagnostic : 1 obligatoire (vue d'ensemble) + jusqu'à 3 facultatives (gros plan, dessous des feuilles, terre) ; stockées comme `Photo` (1280 px) liées au diagnostic.
- États : `bon` (vert `--ok`), `surveiller` (ambre `--warn`), `malade` (corail `--bad`). Tendance : `mieux`, `stable`, `moins-bien`, `inconnue`.
- Confiance 0–1 ; si < 0.6 et questions présentes, l'app pose 1 à 3 questions puis relance l'analyse avec les réponses.
- Saison (hémisphère nord) : déc–fév hiver, mars–mai printemps, juin–août été, sept–nov automne.
- Erreurs IA : `cle` « Clé API refusée. Vérifiez-la dans les Réglages. », `quota` « Quota gratuit atteint. Réessayez plus tard ou changez d'IA. », `reseau` « Pas de connexion à l'IA. Vérifiez internet (ou le relais pour Mistral). », `reponse` « Réponse de l'IA illisible. Réessayez. » ; les photos restent enregistrées, bouton « Réessayer ».
- Export de sauvegarde : version 2 (ajoute `diagnoses`, `speciesSheet` des plantes) ; l'import accepte versions 1 et 2.

## Review Focus

1. Réponse IA mal formée (texte autour du JSON, ```json, champs manquants, valeurs hors liste) → normalisée ou erreur `reponse`, jamais de plantage d'écran.
2. Hors ligne / clé absente au moment de diagnostiquer → message clair, photos conservées, diagnostic en état `erreur` relançable.
3. Changement de modèle disparu (modèle retiré par Google) → erreur 404 traduite en message « Modèle indisponible, choisissez-en un autre dans les Réglages. ».
4. Suppression d'une plante → ses diagnostics et leurs photos supprimés.
5. Import d'une sauvegarde version 1 (étape 1) → accepté, sans diagnostics.

---

### Task 1: Schéma v2, types et sauvegarde

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/repo.ts` (`deletePlant`), `src/lib/backup.ts`
- Test: `tests/repo.test.ts`, `tests/backup.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type HealthState = 'bon' | 'surveiller' | 'malade'`, `type Trend = 'mieux' | 'stable' | 'moins-bien' | 'inconnue'`, `type ProviderId = 'gemini' | 'mistral'`, `type PhotoKind = 'ensemble' | 'gros-plan' | 'dessous' | 'terre'`
  - `interface Problem { name: string; cause: string; severity: 'faible' | 'moyenne' | 'forte' }`
  - `interface RecommendedAction { action: string; careType: CareType | null; priority: 'haute' | 'moyenne' | 'basse'; delayDays: number; doneAt: string | null }`
  - `interface DiagnosisResult { state: HealthState; summary: string; problems: Problem[]; actions: RecommendedAction[]; confidence: number; questions: string[]; trend: Trend; suggestedSpecies: string | null }`
  - `interface Diagnosis { id: string; plantId: string; createdAt: string; date: string; provider: ProviderId; model: string; photoIds: string[]; photoKinds: PhotoKind[]; answers: { question: string; answer: string }[]; status: 'en-cours' | 'questions' | 'termine' | 'erreur'; error: string | null; result: DiagnosisResult | null }`
  - `interface SpeciesSheet { species: string; light: string; water: string; humidity: string; temperature: string; toxicity: string; tips: string[]; frequencies: Partial<Record<CareType, number>>; generatedAt: string; provider: ProviderId }`
  - `Plant` gagne `speciesSheet: SpeciesSheet | null` (absent = null pour les données v1)
  - `STATE_LABELS` (`bon` « En forme », `surveiller` « À surveiller », `malade` « Malade »), `TREND_LABELS` (« Mieux », « Stable », « Moins bien », « — »), `PHOTO_KIND_LABELS` (« Vue d'ensemble », « Gros plan », « Dessous des feuilles », « Terre »)
- Produces (`db.ts`): `version(2)` ajoute `diagnoses: 'id, plantId, [plantId+createdAt]'` ; `db.diagnoses: Table<Diagnosis, string>`
- Produces (`repo.ts`): `listDiagnoses(plantId): Promise<Diagnosis[]>` (récent d'abord), `lastDiagnosis(plantId): Promise<Diagnosis | undefined>` (dernier `termine`), `saveDiagnosis(d: Diagnosis): Promise<void>`, `getDiagnosis(id)`, `deleteDiagnosis(id)` (supprime aussi ses photos)
- Produces (`backup.ts`): `BackupFile.version: 1 | 2`, `diagnoses?: Diagnosis[]`

- [ ] **Step 1: Tests** (dans les fichiers existants)
  - `deletePlant` supprime aussi `db.diagnoses` de la plante
  - `lastDiagnosis` ignore les diagnostics `erreur` et renvoie le `termine` le plus récent
  - `deleteDiagnosis` supprime ses photos (`photoIds`)
  - backup : aller-retour v2 conserve diagnostics et `speciesSheet` ; un fichier v1 (sans `diagnoses`) s'importe ; diagnostic référant une plante inexistante → rejeté ; l'export ne contient aucune clé de `meta`
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implémenter. `createPlant` met `speciesSheet: null` par défaut (paramètre optionnel dans `NewPlant`).
- [ ] **Step 4:** `npm test` → PASS. Commit `feat: schéma v2 (diagnostics, fiche d'espèce)`.

### Task 2: Prompts et validation des réponses

**Files:**
- Create: `src/lib/ai/prompts.ts`, `src/lib/ai/parse.ts`, `src/lib/season.ts`
- Test: `tests/ai-parse.test.ts`, `tests/prompts.test.ts`

**Interfaces:**
- Produces:
  - `season(date: string): 'hiver' | 'printemps' | 'été' | 'automne'`
  - `interface DiagnosisContext { plantName: string; species: string | null; exposure: Exposure | null; waterAmountMl: number | null; recentCare: { type: CareType; date: string }[]; today: string; previous: { date: string; summary: string; state: HealthState } | null; photoKinds: PhotoKind[]; hasPreviousPhoto: boolean; answers: { question: string; answer: string }[] }`
  - `buildDiagnosisPrompt(ctx: DiagnosisContext): string` — consignes en français : rôle de botaniste expert en plantes d'intérieur ; ordre et nature des images (la dernière = photo précédente si `hasPreviousPhoto`) ; contexte ; répondre UNIQUEMENT en JSON selon le schéma (clés anglaises de `DiagnosisResult` mais textes en français) ; `careType` parmi les 5 types ou `null` ; questions seulement si confiance < 0.6.
  - `buildSpeciesPrompt(name: string, species: string | null): string` — JSON `SpeciesSheet` sans `generatedAt`/`provider`.
  - `extractJson(text: string): unknown` — accepte JSON pur, entouré de ```json, ou de texte ; lève `AiError('reponse')`.
  - `parseDiagnosis(raw: unknown): DiagnosisResult` — normalise : état inconnu → `surveiller` ; confiance bornée [0,1] (défaut 0.5) ; `severity`/`priority` hors liste → `moyenne` ; `careType` hors liste → `null` ; `delayDays` entier ≥ 0 (défaut 0) ; `trend` défaut `inconnue` ; tableaux absents → `[]` ; `questions` max 3 ; `doneAt: null`. Lève `AiError('reponse')` si `summary` absent et aucun problème/action.
  - `parseSpeciesSheet(raw: unknown): Omit<SpeciesSheet, 'generatedAt' | 'provider'>` — fréquences entières 1–365 sinon ignorées.
  - `class AiError extends Error { kind: 'cle' | 'quota' | 'reseau' | 'reponse' | 'modele' }` avec `message` = texte français des Global Constraints (`modele` : « Modèle indisponible, choisissez-en un autre dans les Réglages. »).

- [ ] **Step 1: Tests** : `season('2026-01-15')` → `hiver`, `'2026-03-01'` → `printemps`, `'2026-08-31'` → `été`, `'2026-11-22'` → `automne` ; `extractJson('```json\n{"a":1}\n```')` → `{a:1}` ; `extractJson('Voici : {"a":1} fin')` → `{a:1}` ; `extractJson('rien')` lève `AiError` kind `reponse` ; `parseDiagnosis` sur réponse complète conserve les valeurs ; sur `{state:'excellent', confidence: 3, summary:'x', actions:[{action:'a', careType:'arroser', priority:'urgente', delayDays:-2}]}` → `state 'surveiller'`, `confidence 1`, `careType null`, `priority 'moyenne'`, `delayDays 0`, `doneAt null` ; `questions` de 5 éléments → 3 ; `{}` lève `reponse` ; `buildDiagnosisPrompt` contient le nom, « Mi-ombre » si exposure `mi-ombre`, « automne » pour today `2026-11-22`, la question et la réponse quand `answers` non vide, et « photo précédente » quand `hasPreviousPhoto`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implémenter. **Step 4:** `npm test` → PASS. Commit `feat: prompts et validation des réponses IA`.

### Task 3: Fournisseurs Gemini et Mistral, relais

**Files:**
- Create: `src/lib/ai/provider.ts`, `src/lib/ai/gemini.ts`, `src/lib/ai/mistral.ts`, `src/lib/ai/settings.ts`, `relay/worker.js`, `relay/README.md`
- Test: `tests/providers.test.ts`, `tests/ai-settings.test.ts`

**Interfaces:**
- Produces:
  - `interface AiImage { mimeType: string; base64: string }`
  - `interface AnalysisProvider { id: ProviderId; listModels(key: string): Promise<string[]>; generateJson(opts: { key: string; model: string; prompt: string; images: AiImage[] }): Promise<string> }`
  - `gemini: AnalysisProvider` — `listModels` : `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=200` (en-tête `x-goog-api-key`), garde ceux dont `supportedGenerationMethods` contient `generateContent` et dont le nom contient `gemini` et `flash`, exclut `tts`, `image`, `live`, `audio`, `embedding` ; renvoie les ids sans préfixe `models/`. `generateJson` : `POST .../models/{model}:generateContent` body `{ contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map(i => ({ inline_data: { mime_type, data } }))] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }` ; renvoie `candidates[0].content.parts[*].text` concaténés.
  - `mistral(base: string): AnalysisProvider` — `listModels` : `GET {base}/v1/models`, garde `capabilities.vision === true` ; `generateJson` : `POST {base}/v1/chat/completions` body `{ model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...images.map(i => ({ type: 'image_url', image_url: \`data:${mime};base64,${b64}\` }))] }] }` ; renvoie `choices[0].message.content`.
  - Erreurs HTTP communes (`toAiError(status: number): AiError`) : 400 avec message de clé / 401 / 403 → `cle` ; 404 → `modele` ; 429 → `quota` ; autres ≥ 500 → `reseau` ; `fetch` qui rejette (TypeError, CORS) → `reseau`.
  - `pickDefaultModel(provider: ProviderId, models: string[]): string | null` — Gemini : préfère un `*-flash` sans `lite`/`preview`/`exp`, version la plus haute (tri numérique sur `gemini-X.Y`), sinon le premier ; Mistral : préfère `mistral-small-latest`, sinon `pixtral-12b-latest`, sinon le premier.
  - `settings.ts` : `interface AiSettings { defaultProvider: ProviderId; gemini: { key: string; model: string }; mistral: { key: string; model: string; base: string } }`, `loadAiSettings(): Promise<AiSettings>` (défauts : provider `gemini`, clés vides, modèles vides, base `https://api.mistral.ai`), `saveAiSettings(s: AiSettings): Promise<void>` (dans `db.meta`, clé `ai`), `providerFor(id: ProviderId, s: AiSettings): { provider: AnalysisProvider; key: string; model: string }` — lève `AiError('cle')` si clé vide, `AiError('modele')` si modèle vide.
- `relay/worker.js` : Cloudflare Worker ; n'accepte que `Origin: https://dav-lbn.github.io` (constante en tête) ; répond au préflight OPTIONS ; transmet `GET /v1/models` et `POST /v1/chat/completions` vers `https://api.mistral.ai` en recopiant l'en-tête `Authorization` reçu ; ajoute les en-têtes CORS à la réponse ; ne stocke rien, ne journalise pas la clé. `relay/README.md` : déploiement en 6 étapes via le tableau de bord Cloudflare (Workers → Créer → coller le code → Déployer → copier l'URL `*.workers.dev` → la coller dans Réglages › Mistral › Relais).

- [ ] **Step 1: Tests** (`fetch` remplacé par `vi.fn` dans le test) :
  - Gemini `generateJson` : URL `.../v1beta/models/gemini-x-flash:generateContent`, méthode POST, en-tête `x-goog-api-key: K`, `parts[1].inline_data.mime_type === 'image/jpeg'`, `responseMimeType` JSON ; renvoie le texte du candidat
  - Gemini `listModels` filtre `models/gemini-2.5-flash` (gardé, rendu `gemini-2.5-flash`), `models/gemini-2.5-flash-preview-tts` (exclu), `models/text-embedding-004` (exclu)
  - Mistral `generateJson` : URL `https://relais.example/v1/chat/completions` quand base = `https://relais.example`, en-tête `Authorization: Bearer K`, `content[1].image_url` commence par `data:image/jpeg;base64,`
  - Mistral `listModels` ne garde que `capabilities.vision`
  - `toAiError` : 401→`cle`, 403→`cle`, 404→`modele`, 429→`quota`, 503→`reseau` ; fetch rejeté → `AiError` `reseau`
  - `pickDefaultModel('gemini', ['gemini-2.0-flash','gemini-2.5-flash-lite','gemini-3.0-flash-preview','gemini-2.5-flash'])` → `'gemini-2.5-flash'` ; `pickDefaultModel('mistral', ['pixtral-12b-latest','mistral-small-latest'])` → `'mistral-small-latest'` ; liste vide → `null`
  - settings : défauts au premier chargement ; aller-retour save/load ; `providerFor('gemini', clé vide)` lève `cle`
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implémenter. **Step 4:** `npm test` → PASS. Commit `feat: fournisseurs Gemini et Mistral, relais Cloudflare`.

### Task 4: Service de diagnostic et fiche d'espèce

**Files:**
- Create: `src/lib/diagnosis.ts`, `src/lib/species.ts`
- Test: `tests/diagnosis.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3, `photos.ts` (`savePhoto`, `listPhotos`), `repo.ts`
- Produces:
  - `blobToAiImage(b: Blob): Promise<AiImage>`
  - `buildContext(plant: Plant, care: CareEvent[], previous: Diagnosis | undefined, kinds: PhotoKind[], answers, today: string): DiagnosisContext` — soins des 30 derniers jours
  - `startDiagnosis(plantId: string, files: { kind: PhotoKind; file: Blob }[], providerId: ProviderId): Promise<Diagnosis>` — enregistre les photos puis un `Diagnosis` `en-cours`, puis appelle `runDiagnosis`
  - `runDiagnosis(id: string, deps?: { settings?: AiSettings; providerOverride?: AnalysisProvider }): Promise<Diagnosis>` — images = photos du diagnostic + (si un diagnostic `termine` précédent existe) sa photo d'ensemble en dernier ; appelle l'IA ; `parseDiagnosis` ; statut `questions` si `confidence < 0.6` et `questions.length > 0` et `answers.length === 0`, sinon `termine` ; en cas d'`AiError` → statut `erreur`, `error` = message ; jamais de rejet.
  - `answerQuestions(id: string, answers: {question: string; answer: string}[], deps?): Promise<Diagnosis>` — enregistre les réponses puis `runDiagnosis` (résultat `termine` même si confiance basse).
  - `markActionDone(diagnosisId: string, index: number): Promise<void>` — fixe `doneAt` ; si `careType` non nul, `logCare` du jour avec la note = `action` (et `amountMl` = quantité habituelle pour l'arrosage).
  - `generateSpeciesSheet(plantId: string, deps?): Promise<SpeciesSheet>` — photo principale (si présente) + `buildSpeciesPrompt` ; enregistre `plant.speciesSheet` ; si `plant.species` est vide, le remplit avec `sheet.species` ; complète uniquement les `careFrequencyDays` vides avec `sheet.frequencies`.

- [ ] **Step 1: Tests** (fournisseur factice `providerOverride` renvoyant un JSON fixé ; tests en environnement node pour les Blobs) :
  - `startDiagnosis` avec 2 photos → `Diagnosis` `termine`, 2 `photoIds`, `result.state` conforme ; `provider`/`model` enregistrés
  - confiance 0.4 + 2 questions → statut `questions` ; `answerQuestions` → statut `termine`, `answers` enregistrées, le 2ᵉ prompt reçu contient la réponse
  - avec un diagnostic précédent `termine` → le fournisseur reçoit 1 image de plus et le prompt contient « photo précédente »
  - fournisseur qui lève `AiError('quota')` → statut `erreur`, `error` = message quota, photos toujours en base ; `runDiagnosis` relancé avec un fournisseur OK → `termine`
  - `markActionDone` sur action `careType: 'arrosage'` → `doneAt` rempli et un `CareEvent` arrosage du jour existe ; sur `careType: null` → aucun soin créé
  - `generateSpeciesSheet` : remplit `species` vide, ne remplace pas une fréquence déjà définie, complète une fréquence vide
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implémenter. **Step 4:** `npm test` → PASS. Commit `feat: service de diagnostic et fiche d'espèce`.

### Task 5: Réglages IA

**Files:**
- Create: `src/ui/AiSettings.svelte`
- Modify: `src/ui/Settings.svelte` (insère la section en tête)

- [ ] **Step 1:** Section « Intelligence artificielle » : choix de l'IA par défaut (2 boutons Gemini / Mistral) ; pour chaque IA : champ clé (type password, bouton 👁️), bouton « Tester et choisir le modèle » (appelle `listModels`, affiche « ✓ Clé valide — N modèles », remplit une liste déroulante, présélectionne `pickDefaultModel`, enregistre), message d'erreur `AiError` sinon ; pour Mistral, champ « Relais (facultatif) » + lien « Comment créer le relais » vers `https://github.com/Dav-lbn/health-plant/blob/main/relay/README.md` ; liens « Obtenir une clé gratuite » : `https://aistudio.google.com/app/apikey`, `https://console.mistral.ai/api-keys` ; mention « Vos clés restent sur ce téléphone et ne sont jamais exportées. »
- [ ] **Step 2:** `npx svelte-check` 0 erreur ; `npm test` PASS. Commit `feat: réglages de l'IA`.

### Task 6: Parcours de diagnostic, résultat, fiche d'espèce, chronologie

**Files:**
- Create: `src/ui/DiagnosisFlow.svelte`, `src/ui/DiagnosisResult.svelte`, `src/ui/BeforeAfter.svelte`, `src/ui/SpeciesCard.svelte`, `src/ui/HealthBadge.svelte`
- Modify: `src/lib/router.ts` (+ routes), `src/App.svelte`, `src/ui/PlantDetail.svelte`, `src/ui/PlantCard.svelte`, `src/ui/PlantList.svelte`, `src/lib/care.ts` (`buildTimeline` accepte les diagnostics), `src/lib/stores.svelte.ts` (`app.lastDiag: Record<plantId, Diagnosis>`)
- Test: `tests/router.test.ts`, `tests/care.test.ts`

**Interfaces:**
- Routes : `{ name: 'diagnose'; id: string }` ↔ `#/plante/{id}/diagnostic` ; `{ name: 'diagnosis'; id: string; diagId: string }` ↔ `#/plante/{id}/diagnostic/{diagId}`
- `buildTimeline(events, photos, diagnoses: Diagnosis[] = [])` ; `TimelineItem` gagne `{ kind: 'diagnosis'; date: string; diagnosis: Diagnosis }` ; les photos appartenant à un diagnostic ne sont pas listées séparément.

- [ ] **Step 1: Tests** : aller-retour des deux nouvelles routes ; `buildTimeline` avec un diagnostic → item `diagnosis` à sa date, et ses `photoIds` absents des items `photo`.
- [ ] **Step 2:** `npm test` → FAIL ; implémenter routeur et `care.ts` ; PASS.
- [ ] **Step 3:** `DiagnosisFlow` : étape 1 prise de vue (4 emplacements avec icône et conseil : « Toute la plante, bien éclairée, sans contre-jour », « Au plus près de la zone abîmée », « Retournez une feuille », « La surface du pot ») — « Vue d'ensemble » obligatoire ; sélecteur Gemini / Mistral (défaut des réglages ; désactivé si pas de clé, avec lien vers Réglages) ; bouton « Analyser ». Étape 2 analyse : animation glossy (halo pulsé + texte « Analyse en cours… ») ; puis navigation `replace` vers la route `diagnosis`.
- [ ] **Step 4:** `DiagnosisResult` : selon statut — `en-cours` (animation), `erreur` (message + « Réessayer » → `runDiagnosis`, + « Essayer avec {autre IA} » si clé présente), `questions` (questions avec champ texte et choix rapides « Oui » / « Non » / « Je ne sais pas », « Affiner le diagnostic »), `termine` : `HealthBadge` grand format avec halo de couleur d'état, jauge de confiance, tendance (flèche ↗ → ↘), résumé, problèmes (cartes avec gravité), actions triées par priorité (icône du soin, délai « aujourd'hui » / « sous N j », bouton « ✓ Fait » → `markActionDone` + vibration + toast), `BeforeAfter` (curseur glissable comparant photo d'ensemble précédente et actuelle) si diagnostic précédent, mention « Analysé par {Gemini|Mistral} · {modèle} », bouton « Deuxième avis avec {autre IA} » (nouveau diagnostic réutilisant les mêmes fichiers photo).
- [ ] **Step 5:** `PlantDetail` : bouton principal « 🔬 Diagnostiquer » sous le hero ; `HealthBadge` compact dans le hero si dernier diagnostic ; `SpeciesCard` (fiche ou bouton « ✨ Générer la fiche d'espèce », avec « Régénérer ») ; chronologie avec items diagnostic (badge d'état, résumé tronqué, clic → résultat). `PlantCard` : point lumineux de couleur d'état du dernier diagnostic.
- [ ] **Step 6:** `npx svelte-check` 0 erreur ; `npm test` PASS. Commit `feat: parcours de diagnostic et fiche d'espèce`.

### Task 7: Bout en bout avec IA simulée

**Files:**
- Create: `e2e/diagnostic.spec.ts`

- [ ] **Step 1: Test e2e** (deux tailles Fold) ; `page.route('https://generativelanguage.googleapis.com/**')` répond : `GET models` → liste avec `models/gemini-2.5-flash` ; 1er `generateContent` → confiance 0.4 + 1 question ; 2ᵉ → état `malade`, 1 problème, 2 actions dont un arrosage, tendance `inconnue` ; 3ᵉ (fiche d'espèce) → fiche Monstera. Parcours : Réglages → coller clé `TEST` → « Tester » → « ✓ Clé valide » ; créer plante avec photo ; « Diagnostiquer » → photo d'ensemble → « Analyser » → question affichée → « Oui » → « Affiner » → badge « Malade » visible, problème visible ; « ✓ Fait » sur l'arrosage → chronologie contient un arrosage ; retour fiche → item diagnostic dans la chronologie ; « Générer la fiche d'espèce » → « Toxique » (texte de la fiche simulée) visible. Vérifier que l'export JSON ne contient pas `TEST`.
- [ ] **Step 2: Test e2e erreur** : `generateContent` → HTTP 429 → message « Quota gratuit atteint » et bouton « Réessayer » ; route remise OK → « Réessayer » → résultat affiché.
- [ ] **Step 3:** `npm run e2e -- --trace off` → PASS ; captures (deviceScaleFactor 1) du résultat aux deux tailles relues et corrigées si besoin.
- [ ] **Step 4:** `npm test && npm run build` → PASS. Commit `test: parcours de diagnostic de bout en bout`. Push de la branche.
