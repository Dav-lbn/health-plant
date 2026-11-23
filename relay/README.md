# Relais Health Plant (Mistral et kDrive)

Certains services refusent les appels venant directement d'une application web :
c'est le cas de **kDrive** (sauvegarde) et probablement de **Mistral**. Ce petit
relais gratuit, hébergé sur votre propre compte Cloudflare, règle le problème pour
les deux. Une seule adresse à créer, une seule fois (environ 5 minutes).

Le relais ne stocke rien et n'enregistre ni vos clés ni vos mots de passe : il
transmet la demande au service et renvoie la réponse. Il n'accepte que les
demandes venant de l'application Health Plant (`https://dav-lbn.github.io`).

## Étapes (depuis le téléphone ou un ordinateur)

1. Créez un compte gratuit sur https://dash.cloudflare.com/sign-up (e-mail + mot de passe, puis validez l'e-mail reçu).
2. Dans le menu, ouvrez **Workers & Pages** (parfois **Compute (Workers)**), puis **Créer** → **Créer un Worker**
   (modèle « Hello World »).
3. Donnez-lui un nom, par exemple `health-plant-relais`, puis **Déployer**.
4. Touchez **Modifier le code**, effacez tout le code affiché et collez à la place tout le contenu du fichier
   [`worker.js`](./worker.js) (bouton « Copy raw file » sur GitHub), puis **Déployer**.
5. Copiez l'adresse du Worker, du type `https://health-plant-relais.<votre-nom>.workers.dev`.
6. Dans Health Plant, **Réglages → Sauvegarde kDrive → Relais Cloudflare** : collez cette adresse.
   Elle sert aussi automatiquement à Mistral.

L'offre gratuite de Cloudflare autorise 100 000 requêtes par jour, largement
suffisant pour un usage personnel.

## Mettre à jour le relais

Si une nouvelle version de `worker.js` est publiée, refaites l'étape 4 (Modifier le code → coller → Déployer).
L'adresse ne change pas.
