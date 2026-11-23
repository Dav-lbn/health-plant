# Health Plant — Étape 3 (Aujourd'hui, tâches, prévision d'arrosage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un écran d'accueil « Aujourd'hui » listant toutes les tâches dues ou en retard (soins prévus + actions recommandées par les diagnostics), à cocher ou reporter, avec une prévision d'arrosage tenant compte de l'historique et de la saison.

**Architecture:** Les tâches ne sont pas stockées : elles sont **calculées** à partir des plantes, des soins et des diagnostics (fonctions pures dans `src/lib/schedule.ts`). Seuls les reports sont stockés (`db.meta`, clé `postponed`), indexés par un identifiant de tâche qui change à chaque nouveau cycle, si bien qu'un report ne survit pas au soin suivant.

**Tech Stack:** existant.

**Spec:** `docs/superpowers/specs/2026-11-22-health-plant-design.md` (Soins — arrosage prévu ; Écran « Aujourd'hui »).

## Global Constraints

- Interface en français, thème sombre glossy existant.
- Fréquence de base d'un soin = `plant.careFrequencyDays[type]`, sinon `plant.speciesSheet.frequencies[type]`, sinon aucune planification pour ce type.
- Coefficient saisonnier (hémisphère nord, `season()` existant) appliqué à la fréquence de base de l'**arrosage** uniquement : hiver ×1.5, automne ×1.25, printemps ×1, été ×0.85.
- Intervalle observé d'arrosage = médiane des 5 derniers intervalles entre arrosages (≥ 2 intervalles requis), intervalles de 0 jour ignorés.
- Intervalle d'arrosage = arrondi de la moyenne (base saisonnière, observé) si les deux existent, sinon celui qui existe ; minimum 1 jour.
- Date de référence : dernier soin du type ; si aucun : arrosage → dû aujourd'hui ; autres types → date de création de la plante.
- Actions de diagnostic : seulement celles du **dernier diagnostic terminé** de chaque plante, non faites ; échéance = `diagnosis.date + delayDays`.
- Identifiants de tâche : `care:{plantId}:{type}:{dateDernierSoin|none}` et `action:{diagnosisId}:{index}`.
- Écran Aujourd'hui : sections « En retard », « Aujourd'hui », « Prochains jours » (7 jours, repliée par défaut). Reporter : « Demain », « Dans 3 jours », « Dans 7 jours ».
- Navigation : `#/` = Aujourd'hui (accueil), `#/plantes` = liste. Barre du bas : Aujourd'hui · Plantes · Réglages, pastille du nombre de tâches dues (retard + aujourd'hui). Écran déplié : la colonne de droite affiche Aujourd'hui quand aucune plante n'est ouverte.

## Review Focus

1. Plante sans aucune fréquence ni fiche d'espèce → aucune tâche de soin, pas d'erreur.
2. Arrosage enregistré deux fois le même jour → intervalle de 0 ignoré, pas de prévision à 0 jour.
3. Tâche reportée puis soin enregistré → la nouvelle tâche n'hérite pas du report.
4. Diagnostic plus récent sans action → les actions de l'ancien diagnostic ne sont plus listées.
5. Plante supprimée → ses tâches disparaissent, reports orphelins sans effet.

---

### Task 1: Calcul des tâches

**Files:** Create `src/lib/schedule.ts` · Test `tests/schedule.test.ts`

**Interfaces — Produces:**
- `SEASON_FACTOR: Record<Season, number>`
- `baseFrequency(plant: Plant, type: CareType): number | null`
- `observedWateringInterval(events: CareEvent[]): number | null` (événements d'une plante, tous types)
- `wateringInterval(plant: Plant, events: CareEvent[], today: string): number | null`
- `addDays(date: string, n: number): string`
- `interface Task { id: string; plantId: string; kind: 'care' | 'action'; careType: CareType | null; label: string; detail: string | null; due: string; status: 'retard' | 'aujourdhui' | 'bientot'; daysLate: number; diagnosisId?: string; actionIndex?: number }`
- `buildTasks(plants: Plant[], care: CareEvent[], diagnoses: Diagnosis[], postponed: Record<string, string>, today: string, horizonDays = 7): Task[]` — tâches dont l'échéance (après report) ≤ today + horizon ; triées par échéance puis nom de plante. Libellés : arrosage « Arroser » + détail `« 250 mL »` si quantité ; engrais « Donner de l'engrais » ; rempotage « Rempoter » ; taille « Tailler » ; traitement « Traiter » ; action : `action.action`, détail « Diagnostic du {date fr} ».
- `nextWatering(plant, events, today): { due: string; interval: number } | null`

- [ ] Tests : `addDays('2026-02-27', 3)` → `'2026-03-02'` ; base depuis `careFrequencyDays` prioritaire sur la fiche ; repli sur `speciesSheet.frequencies` ; aucune → null ; observé : arrosages 01, 08, 15, 15, 22 → 7 (0 ignoré) ; un seul intervalle → null ; `wateringInterval` été base 10 sans historique → 9 (10×0.85=8.5 arrondi 9) ; hiver base 10 + observé 7 → round((15+7)/2) = 11 ; `buildTasks` : plante jamais arrosée avec fréquence → tâche arrosage due aujourd'hui `aujourdhui` ; dernier arrosage il y a 12 j, intervalle 10 → `retard`, `daysLate` 2 ; report vers demain → `bientot` ; nouvel arrosage après report → id différent, report ignoré ; engrais fréquence 30 sans historique, plante créée il y a 40 j → `retard` 10 ; actions : seules celles du dernier diagnostic terminé, non faites, échéance date+delay ; plante sans fréquence → aucune tâche ; horizon : tâche à J+9 exclue.
- [ ] `npm test` FAIL → implémenter → PASS. Commit `feat: calcul des tâches et prévision d'arrosage`.

### Task 2: Accomplir et reporter

**Files:** Create `src/lib/tasks.ts` · Test `tests/tasks.test.ts` (env node)

**Interfaces — Produces:** `loadPostponed(): Promise<Record<string,string>>` ; `postponeTask(id: string, until: string): Promise<void>` (nettoie les reports passés de plus de 30 j) ; `completeTask(task: Task, plant: Plant): Promise<void>` — `care` → `logCare` du jour (quantité habituelle pour l'arrosage) ; `action` → `markActionDone(diagnosisId, actionIndex)`.

- [ ] Tests : report enregistré puis relu ; `completeTask` care arrosage crée un soin du jour avec la quantité ; action → `doneAt` rempli et, si `careType`, soin créé ; reports de plus de 30 j purgés au prochain `postponeTask`.
- [ ] FAIL → implémenter → PASS. Commit `feat: accomplir et reporter les tâches`.

### Task 3: Navigation à trois onglets

**Files:** Modify `src/lib/router.ts`, `src/ui/Layout.svelte`, `src/App.svelte`, `src/ui/PlantList.svelte`, `src/ui/PlantCard.svelte` (lien), `src/ui/*` (liens `#/` vers la liste → `#/plantes`), `e2e/*.spec.ts` (chemins) · Test `tests/router.test.ts`

**Interfaces:** `Route` gagne `{ name: 'today' }` ; `parseHash('')` et `'#/'` → `today` ; `'#/plantes'` → `plants` ; `toHash({name:'today'})` → `'#/'`, `toHash({name:'plants'})` → `'#/plantes'`.

- [ ] Tests router mis à jour (FAIL puis PASS). Layout : 3 onglets avec pastille ; en large, détail par défaut = Aujourd'hui. Les retours « ‹ » des écrans plante ramènent à `#/plantes`. E2E existants adaptés et verts. Commit `feat: navigation Aujourd'hui / Plantes / Réglages`.

### Task 4: Écran Aujourd'hui et prévisions visibles

**Files:** Create `src/ui/Today.svelte`, `src/ui/TaskCard.svelte`, `src/ui/PostponeSheet.svelte` · Modify `src/lib/stores.svelte.ts` (`app.postponed`, `app.tasks` dérivé via fonction `tasksFor(today)`), `src/ui/PlantCard.svelte` (pastille « 💧 à arroser » / « 💧 en retard de N j » / « 💧 dans N j »), `src/ui/PlantDetail.svelte` (puce « Prochain arrosage : {date} · tous les N j »)

- [ ] Today : en-tête date du jour en français (« Dimanche 22 novembre ») et salutation selon l'heure ; résumé « N tâches aujourd'hui » ; sections ; `TaskCard` (miniature plante cliquable, icône, libellé, détail, échéance « en retard de N j » / « aujourd'hui » / « demain » / « dans N j », bouton rond « ✓ » avec animation de validation + vibration + toast « Fait » avec Annuler pour les soins, bouton « Reporter » → `PostponeSheet`) ; état vide « Rien à faire aujourd'hui 🌿 » ; s'il n'y a aucune plante, invitation à en ajouter.
- [ ] `svelte-check` 0 erreur, `npm test` PASS. Commit `feat: écran Aujourd'hui`.

### Task 5: Bout en bout

**Files:** Create `e2e/aujourdhui.spec.ts`

- [ ] Plante avec fréquence d'arrosage 7 j jamais arrosée → Aujourd'hui affiche « Arroser » ; pastille de l'onglet = 1 ; « ✓ » → tâche disparaît, historique de la plante contient l'arrosage, liste des plantes affiche « 💧 dans 7 j » (ou 9 j selon saison : calculer l'attendu via la même règle dans le test) ; reporter une tâche « Demain » → passe dans « Prochains jours » ; diagnostic simulé avec action « Rapprocher de la fenêtre » à délai 0 → visible dans Aujourd'hui, « ✓ » la marque faite dans le résultat du diagnostic.
- [ ] `npm run e2e` PASS aux deux tailles ; captures relues. `npm test && npm run build` PASS. Commit, push.
