# Relais Mistral (facultatif)

L'API Mistral peut refuser les appels venant directement d'une application web.
Si Health Plant affiche « Pas de connexion à l'IA » avec Mistral alors qu'internet
fonctionne, créez ce petit relais gratuit (5 minutes, une seule fois).

Le relais ne stocke rien et n'enregistre pas votre clé : il transmet la demande
à Mistral et renvoie la réponse.

## Étapes (depuis le téléphone ou un ordinateur)

1. Créez un compte gratuit sur https://dash.cloudflare.com/sign-up
2. Dans le menu, ouvrez **Workers & Pages** (ou **Compute → Workers**), puis **Créer** → **Créer un Worker**
   (modèle « Hello World »).
3. Donnez-lui un nom, par exemple `health-plant-mistral`, puis **Déployer**.
4. Touchez **Modifier le code**, effacez tout et collez le contenu du fichier
   [`worker.js`](./worker.js), puis **Déployer**.
5. Copiez l'adresse du Worker, du type `https://health-plant-mistral.<votre-nom>.workers.dev`.
6. Dans Health Plant : **Réglages → Intelligence artificielle → Mistral → Relais**,
   collez cette adresse, puis touchez **Tester et choisir le modèle**.

L'offre gratuite de Cloudflare autorise 100 000 requêtes par jour, largement
suffisant pour un usage personnel.
