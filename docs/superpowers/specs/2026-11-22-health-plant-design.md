# Health Plant — Design

Date : 2026-11-22
Statut : en attente d'approbation

## Intention

Une application personnelle, sur smartphone, pour prendre soin de ses plantes.
L'utilisateur photographie une plante, l'application en fait un diagnostic et
propose les actions à mener. Elle garde en mémoire chaque plante, ses
informations d'entretien, chaque diagnostic et chaque traitement.

Usage : une seule personne, pour ses propres plantes. Contrainte forte : coût
nul, ou aussi proche de zéro que possible, y compris pour les analyses.

## Objectifs

- Fonctionner confortablement sur le téléphone de l'utilisateur, un Samsung
  Galaxy Z Fold 5 (Android, Chrome / Samsung Internet), en s'installant sur
  l'écran d'accueil. L'interface s'adapte aux deux écrans : écran externe
  étroit (une colonne) et écran déplié quasi carré (liste des plantes et fiche
  côte à côte).
- Gérer une liste de plantes, chacune avec :
  - nom (et espèce, facultatif), photo principale ;
  - exposition à la lumière (plein soleil / lumière vive indirecte /
    mi-ombre / ombre) ;
  - quantité d'eau habituelle (texte libre ou mL) ;
  - date et quantité du dernier arrosage ;
  - notes libres.
- Enregistrer un arrosage en un geste (date du jour + quantité habituelle
  pré-remplie, modifiable). L'historique des arrosages est conservé.
- Choix de l'IA qui analyse : Google Gemini ou Mistral. Une IA par défaut
  dans les réglages, modifiable au moment de chaque diagnostic. Chaque
  diagnostic enregistre l'IA et le modèle utilisés.
- Diagnostic sur photo : prendre ou choisir une photo, l'envoyer à l'IA avec
  le contexte de la plante (espèce, exposition, arrosage), et afficher :
  état général, problèmes détectés, causes probables, actions recommandées.
- Conserver chaque diagnostic (photo + résultat) dans l'historique de la plante.
- Enregistrer des traitements (date, action réalisée, notes), éventuellement
  créés en un geste à partir d'une action recommandée.
- Voir pour chaque plante une chronologie : diagnostics, traitements, arrosages.
- Exporter / importer toutes les données (fichier JSON incluant les photos)
  pour sauvegarde.

## Non-objectifs

- Comptes utilisateurs, synchronisation entre appareils, partage.
- Publication sur l'App Store / Play Store.
- Rappels / notifications d'arrosage (peu fiables pour une appli web sur
  iPhone ; pourra être ajouté plus tard).
- Mode de diagnostic hors ligne ou questionnaire de secours (option écartée
  par l'utilisateur ; possible plus tard).

## Anti-objectifs

- Tout coût récurrent : pas de serveur payant, pas d'API payante.
- Perdre les données de l'utilisateur sans qu'il ait pu les sauvegarder.
- Une interface pensée pour ordinateur et pénible au doigt.

## Contraintes

- Coût nul : hébergement statique gratuit, offres gratuites des API d'IA
  (Gemini : offre gratuite ; Mistral : offre « Experiment »).
- Pas de serveur : tout tourne dans le navigateur du téléphone.
- Les clés d'API (une par IA) appartiennent à l'utilisateur, il les saisit
  une fois dans les réglages ; elle est stockée uniquement sur le téléphone, jamais dans le code
  ni dans le dépôt.

## Approches envisagées

1. **IA Google Gemini, offre gratuite (retenue).** Meilleure qualité de
   diagnostic ; gratuite pour un usage personnel. Nécessite internet ; Google
   peut faire évoluer l'offre gratuite ; sur l'offre gratuite, Google peut
   utiliser les données envoyées pour améliorer ses produits.
2. Modèle embarqué sur le téléphone : gratuit et hors ligne, mais entraîné
   surtout sur des plantes potagères, donc peu fiable pour des plantes
   d'intérieur. Écartée.
3. Questionnaire de symptômes sans IA : gratuit et fiable, mais n'analyse pas
   la photo. Écartée (proposée comme secours, non retenue).

Choix de l'utilisateur : option 1, complétée par Mistral comme seconde IA au
choix. Mistral « Experiment » est gratuit mais demande une vérification par
téléphone, et les requêtes peuvent servir à entraîner ses modèles.

## Décisions de réalisation (choix de Claude, à valider)

- **Forme** : application web progressive (PWA) installable, fonctionnant
  hors ligne pour la consultation et la saisie (seul le diagnostic requiert
  le réseau).
- **Hébergement** : GitHub Pages, depuis ce dépôt.
- **Technique** : TypeScript + Vite, framework léger (Preact ou Svelte),
  interface en français.
- **Stockage** : IndexedDB sur le téléphone (via une petite surcouche type
  Dexie). Photos redimensionnées (~1280 px, JPEG) avant stockage et envoi,
  pour limiter la place et le quota.
- **Persistance** : demander `navigator.storage.persist()` ; afficher un
  rappel discret d'export si aucune sauvegarde depuis 30 jours (Safari peut
  effacer les données d'un site non installé et non visité).
- **IA** : appel direct depuis le navigateur. Une interface commune
  « fournisseur d'analyse » avec deux implémentations : Gemini (modèle
  « Flash » de l'offre gratuite) et Mistral (modèle avec vision, p. ex.
  Mistral Small). Même prompt et même format de réponse pour les deux. Le nom
  du modèle de chaque IA est un réglage modifiable (les modèles changent
  régulièrement). À vérifier dès le début de la réalisation : que l'API
  Mistral accepte les appels directs depuis un navigateur (CORS) et que les
  modèles avec vision sont inclus dans l'offre gratuite. Si l'appel direct
  est bloqué, solution de repli : un petit relais gratuit (Cloudflare Worker)
  qui transmet la requête sans stocker la clé. Réponse demandée au format JSON structuré :
  `etat` (bon / à surveiller / malade), `resume`, `problemes[]`
  (nom, cause probable, gravité), `actions[]` (action, priorité, délai),
  `espece_suggeree`. Gestion des erreurs : pas de réseau, clé invalide,
  quota dépassé — message clair, la photo reste enregistrée pour réessayer.
- **Écrans** (deux colonnes quand le Fold est déplié) : liste des plantes (avec état du dernier diagnostic et jours
  depuis le dernier arrosage) → fiche plante (infos, bouton « Arrosé »,
  bouton « Diagnostiquer », chronologie) → résultat de diagnostic (avec
  « Marquer comme fait » sur chaque action) → réglages (IA par défaut, clé et modèle
  pour chaque IA, export / import).

## Laissé au réalisateur

- Choix précis du framework et des bibliothèques, style visuel.
- Formulation exacte du prompt envoyé à Gemini.
- Structure détaillée du format d'export.
