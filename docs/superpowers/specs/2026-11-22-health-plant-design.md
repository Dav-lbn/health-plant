# Health Plant — Design

Date : 2026-11-22
Statut : en attente d'approbation

## Intention

Une application personnelle et premium, sur smartphone, pour prendre soin de
ses plantes. L'utilisateur photographie une plante, l'application en fait un
diagnostic, propose les actions à mener, les transforme en tâches et suit
l'évolution de la plante dans le temps. Elle garde en mémoire chaque plante,
ses informations d'entretien, chaque diagnostic et chaque soin.

Usage : une seule personne, pour ses propres plantes. Contrainte forte : coût
nul, ou aussi proche de zéro que possible, y compris pour les analyses.
Attente : une application qui fait « vraiment pro et premium », au design
sombre et glossy.

## Appareil cible

Samsung Galaxy Z Fold 5 (Android, Chrome / Samsung Internet). L'interface
s'adapte aux deux écrans : écran externe étroit (une colonne) et écran déplié
quasi carré (deux colonnes : liste et détail). Elle doit rester utilisable sur
tout autre smartphone récent.

## Objectifs (fonctionnalités)

### Plantes
- Liste des plantes, regroupées par **pièce** (salon, chambre, balcon…,
  pièces créées par l'utilisateur), avec recherche.
- Fiche plante : nom, espèce, photo principale, pièce, exposition à la
  lumière (plein soleil / lumière vive indirecte / mi-ombre / ombre), quantité
  d'eau habituelle (mL), notes.
- **Fiche d'espèce générée par l'IA** : lumière, eau, humidité, température,
  toxicité pour les animaux, conseils. L'IA propose l'espèce à partir de la
  photo ; l'utilisateur confirme ou corrige. La fiche est stockée et
  régénérable.

### Soins
- Types de soins : **arrosage, engrais, rempotage, taille, traitement**,
  chacun avec son icône et une fréquence propre à la plante.
- Enregistrer un soin en un geste (date du jour, quantité pré-remplie pour
  l'arrosage, modifiable). Historique complet conservé.
- **Arrosage prévu automatiquement** : prochaine date calculée à partir de la
  fréquence de base (fiche d'espèce), de l'intervalle réel observé dans
  l'historique et de la saison (intervalle allongé en automne / hiver).
  Badge « à arroser » / « en retard ». Même logique simple (fréquence +
  dernier soin) pour engrais, rempotage, taille.

### Diagnostic
- Choix de l'IA : **Google Gemini ou Mistral**. Une IA par défaut dans les
  réglages, modifiable à chaque diagnostic (pour un deuxième avis). Chaque
  diagnostic enregistre l'IA et le modèle utilisés.
- **Prise de vue guidée en plusieurs photos** : vue d'ensemble (obligatoire),
  gros plan de la zone abîmée, dessous des feuilles, terre (facultatives).
  Conseils de prise de vue à l'écran.
- Contexte envoyé à l'IA : espèce, exposition, historique récent des soins,
  saison, et dernier diagnostic.
- Résultat structuré : état (bon / à surveiller / malade), résumé, problèmes
  (nom, cause probable, gravité), actions (action, type de soin, priorité,
  délai), **niveau de confiance**.
- **Questions de précision** : si la confiance est faible, l'IA pose une à
  trois questions (« la terre est-elle humide ? ») ; l'utilisateur répond et
  le diagnostic est affiné.
- **Suivi de l'évolution** : si un diagnostic précédent existe, l'IA reçoit
  la photo précédente et indique la tendance (mieux / stable / moins bien).
  Comparaison visuelle avant/après avec un curseur.

### Écran « Aujourd'hui »
- Écran d'accueil : les tâches du jour et en retard, toutes plantes
  confondues. Sources : actions recommandées par les diagnostics (devenues
  des tâches datées) et soins prévus (arrosage, engrais…).
- Cocher une tâche enregistre le soin correspondant dans l'historique.
  Reporter une tâche est possible.

### Chronologie
- Pour chaque plante : diagnostics, soins et tâches réalisées, dans l'ordre
  du temps, avec les photos.

### Notifications
- Rappels sur le téléphone pour les tâches du jour, via **ntfy** (service
  gratuit, application Android ntfy installée par l'utilisateur, abonnée à un
  sujet secret généré aléatoirement par l'application).
- À chaque ouverture, l'application programme les rappels des 3 prochains
  jours (limite de l'envoi différé de ntfy.sh). Limite assumée : sans
  ouverture de l'application pendant plus de 3 jours, plus de rappels.
- Les messages contiennent seulement le nom de la plante et la tâche.
  Activable / désactivable, heure de rappel réglable.

### Sauvegarde
- **Sauvegarde automatique vers Google Drive et/ou kDrive** (Infomaniak),
  au choix dans les réglages (l'un, l'autre ou les deux).
  - Google Drive : dossier réservé à l'application, invisible dans le Drive.
  - kDrive : dossier « Health Plant » dans le kDrive, via WebDAV, avec
    l'identifiant du kDrive et un mot de passe d'application Infomaniak.
- Sauvegarde déclenchée après des modifications et à l'ouverture si la
  dernière date de plus d'un jour, vers chaque destination activée. Si une
  connexion a expiré ou échoue, l'application le signale et propose de
  réessayer / se reconnecter en un geste.
- Restauration depuis la destination choisie (changement de téléphone).
- Export / import manuel d'un fichier en complément.

### Design premium
- Thème **sombre et glossy** : fonds sombres profonds avec dégradés vert
  forêt, cartes en verre dépoli (transparence + flou + reflet léger),
  touches de couleur lumineuses (vert vif pour « bonne santé », ambre pour
  « à surveiller », rouge corail pour « malade »), coins arrondis, ombres
  douces et halos.
- Animations fluides et sobres (transitions entre écrans, apparition des
  résultats), retours par vibration lors des validations.
- Écrans vides soignés et explicatifs, états de chargement élégants pendant
  l'analyse.
- Mise en page dédiée à l'écran déplié du Fold (deux colonnes).
- Interface en français.

## Non-objectifs

- Comptes utilisateurs, partage, usage à plusieurs.
- Publication sur l'App Store / Play Store.
- Mode clair.
- Diagnostic hors ligne ou questionnaire de secours sans IA.

## Anti-objectifs

- Tout coût récurrent : pas de serveur payant, pas d'API payante.
- Perdre les données de l'utilisateur.
- Une interface pensée pour ordinateur et pénible au doigt.
- Un design « glossy » au détriment de la lisibilité (contrastes suffisants).

## Contraintes

- Coût nul : hébergement statique gratuit, offres gratuites (Gemini ; Mistral
  « Experiment » ; ntfy.sh ; Google Drive ; kDrive existant de l'utilisateur ;
  Cloudflare Workers si un relais est nécessaire).
- Pas de serveur à maintenir : tout tourne dans le navigateur du téléphone.
- Les clés d'API (une par IA) appartiennent à l'utilisateur, il les saisit une
  fois dans les réglages ; elles restent sur le téléphone, jamais dans le code
  ni dans le dépôt.
- Configuration unique côté utilisateur, guidée dans l'application :
  - clé Gemini (Google AI Studio) ;
  - clé Mistral (vérification par téléphone) ;
  - identifiant OAuth Google pour Drive (projet Google Cloud gratuit,
    origine autorisée = adresse GitHub Pages) ;
  - identifiant kDrive et mot de passe d'application Infomaniak ;
  - application ntfy installée sur le téléphone.
- Confidentialité : sur les offres gratuites, Google et Mistral peuvent
  utiliser les photos envoyées pour améliorer leurs modèles. Accepté.

## Approches envisagées (analyse des photos)

1. **IA en ligne via offres gratuites (retenue)** — Gemini, complété par
   Mistral au choix. Meilleure qualité de diagnostic ; nécessite internet ;
   les offres gratuites peuvent évoluer.
2. Modèle embarqué sur le téléphone : gratuit et hors ligne, mais entraîné
   surtout sur des plantes potagères. Écartée.
3. Questionnaire de symptômes sans IA : fiable, mais n'analyse pas la photo.
   Écartée.

## Décisions de réalisation (choix de Claude)

- **Forme** : application web progressive (PWA) installable, consultation et
  saisie hors ligne ; seuls diagnostic, fiche d'espèce, sauvegarde Drive et
  rappels requièrent le réseau (les actions sont mises en attente).
- **Hébergement** : GitHub Pages depuis ce dépôt, déploiement par GitHub
  Actions.
- **Technique** : TypeScript + Vite + Svelte ; Dexie (IndexedDB) pour le
  stockage local ; CSS maison pour le thème glossy (pas de bibliothèque de
  composants lourde).
- **Photos** : redimensionnées (~1280 px, JPEG) avant stockage et envoi ;
  miniatures pour les listes.
- **Persistance** : `navigator.storage.persist()`.
- **IA** : interface commune « fournisseur d'analyse » (Gemini, Mistral),
  même prompt et même schéma JSON de réponse ; deux usages : diagnostic et
  fiche d'espèce. Nom du modèle de chaque IA réglable. Erreurs gérées (pas
  de réseau, clé invalide, quota) : message clair, photos conservées pour
  réessayer.
- **À vérifier en premier** : appels directs depuis le navigateur vers
  l'API Mistral (CORS) et accès aux modèles avec vision sur l'offre
  gratuite ; idem pour l'envoi différé ntfy et pour WebDAV kDrive depuis le
  navigateur (CORS probablement bloqué pour kDrive). Si un appel
  direct est bloqué : petit relais gratuit (Cloudflare Worker) qui transmet
  sans rien stocker.
- **Sauvegarde** : interface commune « destination de sauvegarde » avec deux
  implémentations. Google Drive : Google Identity Services (jeton côté
  navigateur), portée `drive.appdata`. kDrive : WebDAV
  (`https://<id>.connect.kdrive.infomaniak.com`), taille du fichier connue à
  l'envoi (exigence kDrive), via le relais si CORS bloque. Les identifiants
  restent sur le téléphone ; le relais ne stocke rien.
- **Écrans** : Aujourd'hui → Plantes (par pièce) → Fiche plante (infos,
  fiche d'espèce, soins rapides, bouton Diagnostiquer, chronologie) →
  Diagnostic (prise de vue guidée → analyse → questions éventuelles →
  résultat, avant/après, « ajouter aux tâches ») → Réglages (IA par défaut,
  clés et modèles, pièces, notifications, sauvegardes Google Drive / kDrive,
  export/import).
- **Livraison par étapes**, chaque étape utilisable :
  1. socle, design, plantes, pièces, soins, stockage, export/import ;
  2. diagnostic (Gemini puis Mistral), plusieurs photos, confiance,
     questions, suivi d'évolution, fiche d'espèce ;
  3. écran Aujourd'hui, tâches, prévision d'arrosage ;
  4. sauvegardes Google Drive et kDrive, notifications ntfy.

## Laissé au réalisateur

- Bibliothèques secondaires, détail du style visuel dans le cadre ci-dessus.
- Formulation exacte des prompts.
- Coefficients saisonniers et formule exacte de prévision d'arrosage.
- Format détaillé de l'export.
