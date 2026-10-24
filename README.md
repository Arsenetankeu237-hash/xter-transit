# XTER Transit — Plateforme de transit international (fret aérien & maritime, tracking)

Plateforme web professionnelle de transit international pour une entreprise de fret aérien et maritime
opérant entre le Cameroun et l'étranger (dans les deux sens), avec :

- **Site public** : accueil, suivi de colis public par numéro, demande de devis, contact, destinations, tarifs indicatifs, pages légales ;
- **Espace client sécurisé** : colis, factures, documents partagés, notifications, changement de mot de passe ;
- **Console d'administration** : tableau de bord, CRM clients, colis (numéro de suivi auto `XTER-2026-000001`), expéditions aériennes/maritimes avec **groupage multi-clients**, tracking manuel + **intégrations transporteurs (API/webhooks) avec anti-doublons**, devis (poids volumétrique, grilles tarifaires), factures & paiements, livraisons avec preuve (photo + signature), notifications e-mail, utilisateurs & rôles granulaires, journal d'audit, recherche globale, exports CSV, étiquettes QR imprimables.

> Principe directeur : **aucune donnée n'est simulée**. Sans intégration transporteur configurée, le suivi
> fonctionne à 100 % en mode manuel. Sans SMTP configuré, les e-mails sont journalisés mais non envoyés.
> Les documents générés par la plateforme restent des documents internes tant que l'entreprise ou
> l'autorité compétente ne les valide pas.

---

## 1. Démarrage rapide

Prérequis : Node.js ≥ 20.9 (développé et testé avec Node 24).

```bash
npm install
npm run db:migrate     # crée la base SQLite (prisma/dev.db) et applique le schéma
npm run db:seed        # paramètres par défaut + super-admin + modèles de notifications + pays/aéroports/ports
npm run build          # build de production
npm start              # http://localhost:3000
```

Pour le développement à chaud : `npm run dev`.

**Compte initial** (défini dans `.env`, à changer impérativement) :

- E-mail : `ADMIN_EMAIL` (défaut `admin@xter-transit.local`)
- Mot de passe : `ADMIN_PASSWORD` (défaut `Admin@2026!`) — changement forcé à la première connexion.

Tests : `npx tsx scripts/smoke-test.ts` — parcours de bout en bout (27 vérifications : colis, suivi public,
groupage, webhook transporteur avec rejet de signature invalide et anti-doublon, devis, facture, paiement,
rôles, livraison, audit) puis purge des données de test.

## 2. Stack technique

| Composant | Choix | Notes |
|---|---|---|
| Frontend + Backend | Next.js 16 (App Router, Server Actions, cacheComponents) + TypeScript | Une seule application |
| Styles | Tailwind CSS v4 | Identité bleu nuit / blanc / orange (jetons `navy-*`, `accent-*`) |
| Base de données | SQLite (développement) → PostgreSQL (production) | Via **Prisma 7** en architecture *driver adapter* |
| ORM | Prisma 7 (client généré dans `src/generated/prisma`) | Migrations versionnées dans `prisma/migrations` |
| Auth | Sessions en base + cookie HttpOnly, mots de passe **scrypt** | Aucune dépendance native d'auth |
| Documents | Stockage privé sur disque (`storage/`), servis par route authentifiée `/api/documents/[id]` | |
| PDF | Vues d'impression A4 (navigateur → Enregistrer en PDF) : factures/reçus, étiquettes QR | |
| E-mail | Nodemailer si SMTP configuré, sinon journalisation | |
| QR codes | `qrcode` (génération serveur) | L'étiquette pointe vers la page publique de suivi |

### Passage à PostgreSQL en production

1. `npm install @prisma/adapter-pg`
2. Dans `src/lib/db-factory.ts`, activez la branche PostgreSQL (bloc commenté, 3 lignes).
3. Dans `prisma/schema.prisma`, remplacez `provider = "sqlite"` par `provider = "postgresql"`.
4. `DATABASE_URL=postgresql://user:pass@host:5432/alt_transit` puis `npx prisma migrate deploy`.
5. Les statuts sont stockés en `String` (validés côté application) : aucune migration d'enum nécessaire.

## 3. Variables d'environnement (`.env`)

Copiez `.env.example` vers `.env` puis complétez. Points sensibles :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` (dev) ou URL PostgreSQL (prod) |
| `APP_URL` | URL publique — utilisée par les QR codes d'étiquettes et les liens e-mail |
| `CRON_SECRET` | **Obligatoire en production** — protège `/api/cron/sync` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Compte initial créé par le seed |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Envoi réel des e-mails (sinon journalisés avec statut SKIPPED) |
| `PAYMENT_PROVIDER/PUBLIC_KEY/SECRET_KEY` | Paiement en ligne — prestataire à configurer (voir §8) |
| `<TRANSPORTEUR>_API_KEY` | Clés transporteurs : créées lors de la souscription, référencées par nom dans les intégrations (jamais stockées en base) |

## 4. Structure du projet

```
src/
├─ app/
│  ├─ (site)/               # Site public : accueil, suivi, devis, contact, tarifs, destinations, légal
│  ├─ connexion/            # Connexion (équipe + clients)
│  ├─ espace-client/        # Portail client sécurisé (ses colis/factures/documents uniquement)
│  ├─ admin/                # Console d'administration (accès par rôles)
│  ├─ api/
│  │  ├─ documents/[id]/        # fichiers du stockage privé (contrôle d'accès)
│  │  ├─ invoices/[id]/print/   # facture/reçu imprimable A4
│  │  ├─ public/track/[number]/ # API publique de suivi (limitée en débit)
│  │  ├─ webhooks/tracking/[id]/# webhooks transporteurs (secret/HMAC)
│  │  ├─ cron/sync/             # synchronisation planifiée (CRON_SECRET)
│  │  └─ export/…               # exports CSV (colis, factures)
│  └─ actions/              # Server Actions (clients, colis, expéditions, finance, livraisons, config)
├─ components/              # UI partagée, formulaires, graphiques SVG, signature, impression
├─ lib/                     # Services métier : tracking, expéditions, devis, factures, notifications,
│                           # intégrations, documents, auth, RBAC, audit, settings, numérotation
└─ generated/prisma/        # Client Prisma généré (ignoré par git)
prisma/                     # schéma, migrations, seed
scripts/smoke-test.ts       # tests de fumée de bout en bout
storage/                    # documents privés (ignoré par git)
```

## 5. Rôles & permissions

8 rôles : Super administrateur, Administrateur, Agent de transit, Responsable d'entrepôt, Comptable,
Responsable des expéditions, Agent de livraison, Client. La matrice `src/lib/constants.ts` (`PERMISSIONS`)
définit les autorisations granulaires (ex. le comptable gère devis/factures/paiements mais pas les colis ;
le client n'accède qu'à ses données). Chaque action serveur revérifie la permission.

## 6. Intégrations transporteurs (tracking automatique)

Architecture par **adaptateurs** — la plateforme reste 100 % manuelle sans intégration :

- **`generic-rest`** (polling) : `GET {baseUrl}/{référence}` avec `Authorization: Bearer $NOM_VAR_ENV`.
  Contrat JSON attendu : `{ "events": [{ "trackingNumber", "status", "occurredAt" (ISO 8601), "location", "description", "externalId" }] }`.
- **`generic-webhook`** (push) : URL fournie par la page Intégrations ; authentification par
  `x-webhook-secret` ou `x-signature: sha256=HMAC(corps, secret)` ; idempotence par `externalId`.
- **Import CSV manuel** : `trackingNumber,status,occurredAt,location,description` — idéal pour un
  partenaire qui envoie un fichier périodique.

Traitement : normalisation des statuts externes (table par défaut + mapping personnalisé par intégration ;
**un statut inconnu est ignoré et journalisé, jamais deviné**), déduplication par empreinte unique
(intégration + réf. externe + colis + statut + date), journal `TrackingSyncLog`, échec sans perte des
événements existants. Synchronisation manuelle (bouton) ou planifiée : `GET /api/cron/sync` avec
`Authorization: Bearer $CRON_SECRET` (toutes les 15 min par exemple).

**Transporteurs connus** (à souscrire auprès d'eux — la plateforme n'invente aucun accès) :
DHL Express (portail développeur DHL, API REST), FedEx (clé API après validation), Maersk
(portail développeur, track & trace), MSC / CMA CGM (accès partenaire contractuel). Dès qu'un partenaire
peut exposer le contrat JSON ci-dessus, l'adaptateur `generic-rest` fonctionne tel quel.

## 7. Vols réels & AWB (expéditions aériennes)

Sur la fiche d'une expédition aérienne :

- **Recherche de vol (API Amadeus)** — panneau « Rechercher un vol réel » : codes IATA départ/arrivée
  (pré-remplis depuis l'expédition) + date → vols réels (compagnie, n° de vol, horaires, escales).
  « Utiliser ce vol » renseigne automatiquement le n° de vol, le départ prévu et l'ETA de l'expédition
  (source tracée dans l'audit). Configuration : compte gratuit sur https://developers.amadeus.com,
  clés Self-Service dans `.env` (`AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENV=test|production`).
  Sans clés, le panneau affiche la marche à suivre — aucun vol inventé.
- **Assistant AWB maître** — l'AWB est émis par la compagnie à la réservation (aucune API publique ne le
  génère). L'assistant compose le numéro (préfixe IATA du transporteur + série 8 chiffres + clé de contrôle
  = série mod 7, règle IATA), détecte les doublons et propose le prochain n° non utilisé dans votre base.
  Les préfixes de compagnies courantes sont pré-chargés (Partenaires → préfixe AWB modifiable).

## 8. Paiements

Moyens configurés : espèces, virement, Mobile Money (enregistrés et confirmés par un agent habilité) et
paiement en ligne. **Un paiement en ligne reste `PENDING` jusqu'à confirmation authentique du prestataire**
— le point d'entrée est la fonction `confirmPayment` (`src/lib/invoices.ts`), à brancher sur le webhook du
prestataire choisi (NotchPay, CinetPay, Stripe… : configurer `PAYMENT_*` puis ajouter la route webhook).
Aucune donnée de carte n'est stockée.

## 9. Sécurité

- Mots de passe scrypt + sessions en base (révocables) ; cookie HttpOnly/SameSite=Lax/Secure en prod ;
- Validation Zod de toutes les entrées ; requêtes exclusivement via Prisma (pas de SQL brut) ;
- Limitation de débit : suivi public 30/min/IP, connexions 8/5min, formulaires publics 5/10min
  (en mémoire — prévoir Redis si déploiement multi-instances) ;
- Fichiers privés : types MIME autorisés, 10 Mo max, noms aléatoires, accès contrôlé par rôle/propriété ;
- Journal d'audit exhaustif (avant/après, IP, agent) ; corrections de suivi tracées sans suppression ;
- Clés API et secrets uniquement dans les variables d'environnement ;
- `proxy.ts` (Next 16) : premier filtre de redirection des espaces protégés.

## 10. Sauvegardes & maintenance

- **Sauvegarde** : `prisma/dev.db` (SQLite) + dossier `storage/` (documents) + `.env`.
  En PostgreSQL : `pg_dump` quotidien recommandé + rétention 30 jours.
- **Restauration** : restaurer les fichiers/dossiers puis `npx prisma migrate deploy`.
- Scripts npm : `db:migrate` (dev), `db:deploy` (prod), `db:seed`, `db:studio` (explorateur de données).
- Durée de conservation des données configurable : Paramètres.

## 11. Déploiement

1. Serveur Node ≥ 20.9 (VPS, conteneur…) : `npm ci && npm run build && npm start` derrière un reverse proxy
   HTTPS (Nginx/Caddy) ; définir `APP_URL`, `CRON_SECRET`, SMTP et clés transporteurs dans `.env`.
2. `DATABASE_URL` PostgreSQL + `npx prisma migrate deploy` + `npm run db:seed` (première fois).
3. Planificateur : appeler `/api/cron/sync` toutes les 15 min avec le secret.
4. Sauvegardes automatiques base + `storage/`.
5. Après mise en service : créer les comptes agents, configurer la marque dans Paramètres,
   publier les textes légaux, créer les grilles tarifaires, tester un colis de bout en bout.

---

Personnalisation : tout (nom de l'entreprise, slogan, WhatsApp, préfixe de numérotation, devises, textes
légaux) se gère dans **Administration → Paramètres** sans toucher au code.
