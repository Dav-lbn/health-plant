# Health Plant — Étape 4a (sauvegarde kDrive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sauvegarde automatique de toutes les données sur le kDrive de l'utilisateur (WebDAV), avec historique des 7 derniers jours et restauration en un geste.

**Architecture:** Un module `kdrive.ts` parle WebDAV (PUT, GET, MKCOL, PROPFIND, DELETE) soit directement, soit via le relais Cloudflare (`/kdrive/{id}/…`). Un planificateur `autobackup.ts` déclenche la sauvegarde 20 s après une modification et à l'ouverture si la dernière date de plus d'un jour. Le fichier sauvegardé est exactement celui de l'export manuel (`exportBlob()`).

**Tech Stack:** existant ; Cloudflare Worker (relais étendu).

**Spec:** `docs/superpowers/specs/2026-11-22-health-plant-design.md` (Sauvegarde ; Décisions — Sauvegarde kDrive).

## Global Constraints

- Adresse WebDAV : `https://{id}.connect.kdrive.infomaniak.com` ; identifiant kDrive = nombre (chiffres uniquement).
- Authentification : HTTP Basic `email:mot de passe d'application` ; stockés dans `db.meta` (clé `kdrive`) ; jamais exportés.
- Via relais : `{relais}/kdrive/{id}/{chemin}` ; le relais n'accepte que l'origine `https://dav-lbn.github.io`, les méthodes GET, PUT, MKCOL, PROPFIND, DELETE, OPTIONS, un identifiant numérique, et transmet le corps avec sa taille connue (kDrive refuse les envois de taille inconnue).
- Dossier : `/Health Plant/` ; fichier courant `sauvegarde.json` ; copies `historique/health-plant-AAAA-MM-JJ.json` (une par jour, les 7 plus récentes conservées).
- Automatique : seulement si kDrive est activé et configuré ; 20 s après la dernière modification ; à l'ouverture si dernière sauvegarde réussie > 24 h ou jamais ; une seule sauvegarde à la fois.
- Statut dans `db.meta` (`kdriveStatus`) : `lastSuccessAt`, `lastError` (message français + détail).
- Erreurs : 401 « Identifiants kDrive refusés (e-mail ou mot de passe d'application). » ; 404 sur le dossier racine du drive « Identifiant kDrive introuvable. » ; réseau/CORS sans relais « kDrive injoignable depuis l'application : configurez le relais. » ; réseau avec relais « Relais ou kDrive injoignable. » ; 507 « Espace kDrive plein. » ; autres « Erreur kDrive (HTTP {code}). »
- Le relais (une seule adresse) sert aussi à Mistral : le champ « Relais » devient un réglage commun (`db.meta` clé `relay`), Mistral l'utilise si renseigné.
- Interface en français, thème existant.

## Review Focus

1. Coupure réseau pendant l'envoi → `lastError` enregistré, données locales intactes, nouvel essai à la modification suivante.
2. Restauration d'un fichier invalide ou absent → message clair, rien n'est effacé.
3. Modifications en rafale → une seule sauvegarde (debounce), jamais deux en parallèle.
4. Mot de passe absent de tout export, journal ou URL.
5. Dossier `historique` inexistant au premier envoi → créé (MKCOL) sans erreur.

---

### Task 1: Client WebDAV kDrive

**Files:** Create `src/lib/backup/kdrive.ts` · Test `tests/kdrive.test.ts`

**Interfaces — Produces:**
- `interface KDriveConfig { enabled: boolean; driveId: string; email: string; password: string }`
- `class KDriveError extends Error { kind: 'auth' | 'introuvable' | 'reseau' | 'plein' | 'http'; detail: string }`
- `kdriveUrl(cfg: KDriveConfig, relay: string, path: string): string` — direct `https://{id}.connect.kdrive.infomaniak.com{path}` ; relais `{relay sans / final}/kdrive/{id}{path}` ; segments encodés (`Health%20Plant`).
- `kdriveClient(cfg, relay)` → `{ put(path, blob): Promise<void>; get(path): Promise<Blob>; mkcol(path): Promise<void>; list(path): Promise<string[]>; remove(path): Promise<void>; check(): Promise<void> }` — `check` = PROPFIND Depth 0 sur `/` ; `list` = PROPFIND Depth 1, renvoie les noms de fichiers (sans dossiers) via `DOMParser` ; `mkcol` ignore 405 (existe déjà).
- `uploadBackup(client, blob, today: string): Promise<void>` — `mkcol('/Health Plant/')`, `mkcol('/Health Plant/historique/')`, `put('/Health Plant/sauvegarde.json')`, `put('/Health Plant/historique/health-plant-{today}.json')`, puis supprime les copies au-delà des 7 plus récentes.
- `downloadBackup(client): Promise<unknown>` — GET `sauvegarde.json`, parse JSON.

- [ ] Tests (fetch simulé) : URL directe et via relais (`https://r.example/kdrive/123/Health%20Plant/sauvegarde.json`) ; `driveId` non numérique → `KDriveError` `introuvable` sans appel ; en-tête `Authorization: Basic base64(email:pass)` ; PUT envoie le Blob avec `Content-Type: application/json` ; `uploadBackup` : ordre MKCOL, MKCOL, PUT, PUT, PROPFIND, DELETE des 2 plus anciennes quand 9 copies ; MKCOL 405 ignoré ; 401 → `auth` ; 507 → `plein` ; fetch rejeté sans relais → `reseau` avec message « configurez le relais » ; `list` parse une réponse multistatus avec 1 dossier et 2 fichiers → 2 noms ; `downloadBackup` renvoie l'objet.
- [ ] FAIL → implémenter → PASS. Commit `feat: client WebDAV kDrive`.

### Task 2: Réglages, relais commun et sauvegarde automatique

**Files:** Create `src/lib/backup/autobackup.ts`, `src/lib/relay.ts` · Modify `src/lib/ai/settings.ts` (Mistral utilise le relais commun si renseigné), `src/lib/stores.svelte.ts` (appel `notifyChange()` dans `refresh`), `src/main.ts` (vérification à l'ouverture) · Test `tests/autobackup.test.ts` (env node)

**Interfaces — Produces:**
- `relay.ts` : `loadRelay(): Promise<string>`, `saveRelay(url: string): Promise<void>` ; migration : si `relay` absent et `ai.mistral.base` ≠ `https://api.mistral.ai`, il devient le relais commun.
- `autobackup.ts` : `loadKDriveConfig()`, `saveKDriveConfig(c)`, `loadStatus(): Promise<{ lastSuccessAt: string | null; lastError: string | null }>`, `backupNow(deps?): Promise<{ ok: boolean; error?: string }>` (une seule à la fois ; met à jour le statut), `restoreFromKDrive(deps?): Promise<void>` (lève une erreur lisible si invalide ; utilise `importAll`), `notifyChange()` (debounce 20 s), `checkOnOpen(now = new Date())` (sauvegarde si > 24 h ou jamais), `shouldBackupOnOpen(lastSuccessAt: string | null, now: Date): boolean`. `deps` permet d'injecter le client et les délais dans les tests.

- [ ] Tests : `shouldBackupOnOpen(null)` → true, il y a 23 h → false, 25 h → true ; `backupNow` désactivé → `{ ok: false }` sans appel ; succès → `lastSuccessAt` rempli, `lastError` null ; échec → `lastError` = message, données locales intactes ; deux `backupNow` simultanés → un seul envoi ; `notifyChange` ×5 rapprochés → un seul `backupNow` après le délai ; `restoreFromKDrive` fichier invalide → erreur « Fichier de sauvegarde invalide », base intacte ; migration du relais depuis `ai.mistral.base`.
- [ ] FAIL → implémenter → PASS. Commit `feat: sauvegarde automatique sur kDrive`.

### Task 3: Interface et relais

**Files:** Create `src/ui/KDriveSettings.svelte` · Modify `src/ui/Settings.svelte`, `src/ui/AiSettings.svelte` (champ Relais Mistral → renvoi vers le réglage commun), `relay/worker.js`, `relay/README.md`

- [ ] Section « Sauvegarde kDrive » : interrupteur Activer ; identifiant kDrive (aide : « le nombre dans l'adresse de kDrive, ex. ksuite.infomaniak.com/kdrive/app/drive/**123456**/ ») ; e-mail Infomaniak ; mot de passe d'application (masqué, lien « Créer un mot de passe d'application » → `https://manager.infomaniak.com/v3/ng/profile/user/connection-history/application-password`) ; champ « Relais Cloudflare » (commun, lien vers le guide) ; boutons « Tester la connexion », « Sauvegarder maintenant », « Restaurer depuis kDrive » (confirmation « Remplacer toutes les données de ce téléphone par la sauvegarde kDrive ? ») ; statut « ✓ Dernière sauvegarde : {date heure} » ou erreur en ambre.
- [ ] Worker : routes `/kdrive/{id}/…` (id numérique) vers `https://{id}.connect.kdrive.infomaniak.com/…`, méthodes listées, en-têtes `Authorization`, `Depth`, `Content-Type` transmis ; corps lu en entier puis renvoyé (taille connue) ; CORS (`Access-Control-Allow-Methods` incluant PROPFIND, MKCOL, DELETE, PUT ; `Allow-Headers` incluant depth) ; routes Mistral inchangées. README : guide unique « Relais Health Plant (Mistral et kDrive) ».
- [ ] `svelte-check` 0 erreur ; `npm test` PASS. Commit `feat: réglages kDrive et relais commun`.

### Task 4: Bout en bout

**Files:** Create `e2e/kdrive.spec.ts`

- [ ] Relais simulé (`page.route('https://relais.example/**')`) implémentant un mini serveur WebDAV en mémoire (PROPFIND, MKCOL, PUT, GET, DELETE) et vérifiant l'en-tête Basic. Parcours : configurer kDrive + relais → « Tester la connexion » ✓ → « Sauvegarder maintenant » → statut ✓ et fichier `sauvegarde.json` présent contenant la plante, sans mot de passe ni clé IA ; ajouter un arrosage → sauvegarde automatique (délai réduit via `window.__HP_BACKUP_DELAY__ = 200` lu par `autobackup.ts`) ; supprimer la plante → « Restaurer depuis kDrive » → la plante revient. Erreur : relais renvoyant 401 → message « Identifiants kDrive refusés ».
- [ ] `npm run e2e` PASS (deux tailles), `npm test && npm run build` PASS. Commit, push, PR.
