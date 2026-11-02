# Studio Riff API

API de réservation des quatre salles de répétition de l'association Studio Riff.
Node.js, Express 5, TypeScript, PostgreSQL 17 (driver `pg`) et Valkey 8 pour le cache.

- [DECISIONS.md](DECISIONS.md) : placement des règles métier, couches, modèle relationnel, ADR
- [REPORT.md](REPORT.md) : mesures `EXPLAIN ANALYZE`, cache Valkey, sauvegarde et restauration

## Prérequis

- Docker avec Docker Compose
- Node.js 22 ou plus récent, et npm

## Démarrage

```bash
# 1. Variables d'environnement
cp .env.example .env

# 2. Bases de données (PostgreSQL 17 + Valkey), attend qu'elles soient prêtes
docker compose up -d --wait

# 3. Dépendances
npm install

# 4. Schéma puis données de départ
npm run migrate
npm run seed

# 5. API sur http://localhost:3000
npm start
```

`npm run dev` relance l'API à chaque modification. Le port se change avec la variable `PORT`.

`npm run seed` est obligatoire une fois, après `npm run migrate`. Ensuite, il ne sert qu'à remettre la base dans son état initial (il vide les tables puis réinsère les données de départ), par exemple avant de rejouer la collection Postman. Les tests n'en ont pas besoin.

> **Le port 5432 est déjà pris ?** (un PostgreSQL installé sur la machine) Créez un fichier `compose.override.yaml`, ignoré par git :
>
> ```yaml
> services:
>   postgres:
>     ports: !override
>       - "127.0.0.1:5433:5432"
> ```
>
> puis remplacez `5432` par `5433` dans `DATABASE_URL` du fichier `.env`.

## Tests

```bash
npm test
```

Les bases doivent tourner (`docker compose up -d --wait`). Les tests utilisent une base séparée, `studio_riff_test` (le nom de `DATABASE_URL` suivi de `_test`), créée et migrée automatiquement au lancement. Chaque test repart des données de départ et l'horloge est fixée au lundi 2 novembre 2026, 9 h UTC.

| Dossier | Contenu |
|---|---|
| `tests/unit` | Règles métier du domaine, horloge fixe, sans base de données |
| `tests/http` | Routes du contrat via Supertest, avec PostgreSQL et Valkey (dont Valkey injoignable) |

`npm run typecheck` vérifie les types TypeScript.

## Contrat HTTP

| Méthode | Route | Réponses |
|---|---|---|
| GET | `/rooms` | 200 |
| GET | `/rooms/:id/bookings?from=…&to=…` | 200, 404 (400 si les dates sont illisibles) |
| POST | `/rooms/:id/bookings` | 201 + `Location`, 400, 404, 409 |
| GET | `/bookings/:id` | 200, 404 |
| DELETE | `/bookings/:id` | 204, 404, 409 |
| GET | `/members/:id/bookings` | 200, 404 |

Sans `from`/`to`, le planning couvre 7 jours à partir d'aujourd'hui 0 h UTC.

```bash
curl -i -X POST http://localhost:3000/rooms/room-1/bookings \
  -H 'Content-Type: application/json' \
  -d '{ "memberId": "member-3", "start": "2026-11-04T14:00:00Z", "end": "2026-11-04T16:00:00Z" }'

curl "http://localhost:3000/rooms/room-1/bookings?from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z"
curl -i -X DELETE http://localhost:3000/bookings/booking-1
```

### Postman

Importez [`postman/studio-riff.postman_collection.json`](postman/studio-riff.postman_collection.json) (*Import* dans Postman). La collection contient 27 requêtes avec leurs assertions : lecture, création, règles métier et annulation. Exécutez-la dans l'ordre (*Run collection*) sur les données de départ. La collection modifie la base (annulations, créations) : pour la rejouer entièrement, relancez d'abord `npm run seed`. La variable `baseUrl` vaut `http://localhost:3000`.

En ligne de commande : `npx newman run postman/studio-riff.postman_collection.json`.

L'API utilise l'heure réelle : une réservation dont le début est déjà passé est refusée (400).

## Mesure de la requête de planning

```bash
docker compose exec -T postgres psql -U studio -d studio_riff < sql/generate-bookings.sql  # 100 000 réservations
docker compose exec -T postgres psql -U studio -d studio_riff < sql/planning-explain.sql
```

L'index `bookings_room_start` est créé par la migration `002`. Pour reproduire la mesure « avant », supprimez-le (`DROP INDEX bookings_room_start;`), mesurez, puis recréez-le. Relancez `npm run seed` pour revenir aux données de départ.

## Sauvegarde et restauration

```bash
./backup.sh                                # backups/studio_riff_<date>.dump, rétention 30 jours
./restore.sh                               # restaure la dernière sauvegarde dans une NOUVELLE base et compare les comptages
./restore.sh backups/fichier.dump ma_base  # fichier et base cible explicites
```

## Architecture

```
src/
├── domain/        règles métier pures (créneau, chevauchement, limite, annulation, maintenance), Clock, erreurs
├── services/      transactions et orchestration, appellent le domaine
├── repositories/  SQL (pg)
├── controllers/   HTTP → service → vue
├── views/         forme JSON des réponses
├── routes/        table des routes
├── middlewares/   erreurs du domaine → 400 / 404 / 409
├── cache/         cache du planning (Valkey, ou aucun cache)
├── db/            pool, migrations, données de départ
├── app.ts         assemble l'application (horloge, pool et cache injectés)
└── server.ts      point d'entrée
migrations/        SQL appliqué par npm run migrate
sql/               scripts de mesure
```

## Commandes Docker utiles

```bash
docker compose ps                                          # état des conteneurs
docker compose logs postgres                               # journaux PostgreSQL
docker compose exec postgres psql -U studio -d studio_riff
docker compose exec valkey valkey-cli                      # puis KEYS *, GET <clé>, TTL <clé>
docker compose down                                        # arrête, garde les données
docker compose down -v                                     # arrête et supprime les données
```
