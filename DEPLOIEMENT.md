# Déployer XTER Transit gratuitement (Render.com) — guide pas à pas

> Tout est déjà préparé dans ce projet (`render.yaml`, script `start:prod`, dépendances runtime).
> Le déploiement prend **~7 minutes**. Aucune carte bancaire n'est demandée par Render.
>
> ⏸️ À savoir sur le plan gratuit : le site **s'endort après ~15 min sans visite** et met ~1 minute
> à se réveiller au premier clic (parfait pour tester et présenter ; préchargez la page avant une démo).
> La base (SQLite) et les fichiers téléversés **se remettent à zéro à chaque nouveau déploiement** —
> suffisant pour des tests ; pour la mise en production définitive, voir §3.

## 1. Mettre le code sur GitHub (3 min)

1. Créez un compte sur [github.com](https://github.com) si besoin, puis un dépôt **public** nommé
   `xter-transit` (bouton *New repository* → nom → *Create*, sans rien cocher d'autre).
2. Dans Git Bash, depuis le dossier du projet :

   ```bash
   cd "C:/Users/MON PC/ZCodeProject/alt-transit"
   git remote add origin https://github.com/VOTRE_COMPTE/xter-transit.git
   git push -u origin master
   ```
   (Remplacez `VOTRE_COMPTE`. Git vous demandera de vous connecter à GitHub.)

## 2. Créer le service sur Render (4 min)

1. Allez sur [render.com](https://render.com) → **Get Started** → **Sign up with GitHub**
   (autorisez l'accès à vos dépôts).
2. Tableau de bord → **New +** → **Blueprint**.
3. Sélectionnez le dépôt `xter-transit` → Render lit le fichier `render.yaml` et affiche
   le service `xter-transit` déjà configuré (plan **Free**, région Francfort).
4. Un seul champ à remplir : **ADMIN_PASSWORD** → mettez un mot de passe d'administrateur
   (ex. `XterAdmin2026!`) → **Apply**.
5. Attendez la fin du build (~4-5 min) : le site est en ligne sur
   **https://xter-transit.onrender.com** 🎉

Connexion : `admin@xter-transit.local` + le mot de passe saisi (changement demandé à la
première connexion). La base est créée et initialisée automatiquement au démarrage
(migration + paramètres + compagnies aériennes + destinations).

### Activer la recherche de vols en ligne

Tableau de bord Render → service `xter-transit` → **Environment** → complétez
`AMADEUS_CLIENT_ID` et `AMADEUS_CLIENT_SECRET` (clés gratuites sur
[developers.amadeus.com](https://developers.amadeus.com)) → *Save Changes*
(le service redémarre). Même endroit pour `SMTP_*` (e-mails réels) plus tard.

### Mettre à jour le site

```bash
git add -A && git commit -m "modification" && git push
```
Render redéploie automatiquement (⚠️ la base repart de zéro à chaque déploiement en plan gratuit).

## 3. Passer en production plus tard (recommandé après validation)

| Besoin | Solution |
|---|---|
| Base durable + vraie concurrence | PostgreSQL gratuit ([Neon](https://neon.tech)) — bascule préparée dans `src/lib/db-factory.ts` (bloc commenté) et README §2 |
| Fichiers/photos persistants | Disque Render payant (~1 $/mois) ou stockage objet |
| Zéro endormissement | Instance Render Starter (~7 $/mois) |

Les sauvegardes locales restent possibles à tout moment : arrêter le serveur local puis copier
`prisma/dev.db` et le dossier `storage/`.
