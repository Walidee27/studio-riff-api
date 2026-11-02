# REPORT — Studio Riff

## 1. Mesure de la requête de planning

### Protocole

1. Base `studio_riff` migrée (`001_init.sql` seulement) et remplie avec les données de départ.
2. 100 000 réservations générées avec [`sql/generate-bookings.sql`](sql/generate-bookings.sql) (`generate_series(0, 99999)` puis `ANALYZE bookings`). Total : 100 004 lignes.
3. Requête du planning de `room-1` sur une semaine ([`sql/planning-explain.sql`](sql/planning-explain.sql)) lancée deux fois avec `EXPLAIN (ANALYZE, COSTS OFF)` ; la seconde exécution est reproduite (cache chaud).
4. Ajout de l'index par la migration [`002_index_bookings_room_start.sql`](migrations/002_index_bookings_room_start.sql) : `CREATE INDEX bookings_room_start ON bookings (room_id, start_at);`, puis `ANALYZE` et même requête.

```sql
SELECT id, room_id, member_id, start_at, end_at, status
FROM bookings
WHERE room_id = 'room-1'
  AND status = 'confirmed'
  AND start_at < '2028-03-08'
  AND end_at > '2028-03-01'
ORDER BY start_at;
```

### Avant l'index

```
 Sort (actual time=5.146..5.148 rows=91 loops=1)
   Sort Key: start_at
   Sort Method: quicksort  Memory: 32kB
   ->  Seq Scan on bookings (actual time=1.320..5.122 rows=91 loops=1)
         Filter: ((start_at < '2028-03-08 00:00:00+00'::timestamp with time zone) AND (end_at > '2028-03-01 00:00:00+00'::timestamp with time zone) AND (room_id = 'room-1'::text) AND (status = 'confirmed'::text))
         Rows Removed by Filter: 99913
 Planning Time: 0.196 ms
 Execution Time: 5.169 ms
```

### Après l'index `bookings_room_start (room_id, start_at)`

```
 Sort (actual time=0.825..0.827 rows=91 loops=1)
   Sort Key: start_at
   Sort Method: quicksort  Memory: 32kB
   ->  Bitmap Heap Scan on bookings (actual time=0.792..0.805 rows=91 loops=1)
         Recheck Cond: ((room_id = 'room-1'::text) AND (start_at < '2028-03-08 00:00:00+00'::timestamp with time zone))
         Filter: ((end_at > '2028-03-01 00:00:00+00'::timestamp with time zone) AND (status = 'confirmed'::text))
         Rows Removed by Filter: 5526
         Heap Blocks: exact=277
         ->  Bitmap Index Scan on bookings_room_start (actual time=0.139..0.139 rows=5617 loops=1)
               Index Cond: ((room_id = 'room-1'::text) AND (start_at < '2028-03-08 00:00:00+00'::timestamp with time zone))
 Planning Time: 0.217 ms
 Execution Time: 0.848 ms
```

### Lecture

| | Plan | Lignes lues puis écartées | Temps d'exécution |
|---|---|---|---|
| Sans index | `Seq Scan` sur toute la table | 99 913 | 5,17 ms |
| Avec index | `Bitmap Index Scan` sur `bookings_room_start` | 5 526 | 0,85 ms (÷ 6) |
| Avec index + borne basse sur `start_at` | `Bitmap Index Scan`, 93 entrées lues | 2 | 0,08 ms (÷ 65) |

Sans index, PostgreSQL lit les 100 004 lignes pour en garder 91. Avec l'index composite, il ne parcourt que les entrées de `room-1` dont `start_at` est antérieur à la fin de la semaine. La condition `end_at > from` ne peut pas servir de borne d'index sur `start_at`, d'où les 5 617 entrées encore lues (tout l'historique de la salle avant la semaine).

**Amélioration retenue dans l'application.** Une réservation dure au plus 4 h (garanti par le `CHECK bookings_duration`), donc toute réservation qui chevauche `[from, to)` commence après `from − 4 h`. Ajouter `start_at > from − 4 h` donne une borne basse exploitable par l'index ([`sql/planning-explain-bounded.sql`](sql/planning-explain-bounded.sql)) :

```
 Sort (actual time=0.062..0.064 rows=91 loops=1)
   ->  Bitmap Heap Scan on bookings (actual time=0.024..0.039 rows=91 loops=1)
         Recheck Cond: ((room_id = 'room-1'::text) AND (start_at < '2028-03-08 00:00:00+00'::timestamp with time zone) AND (start_at > ('2028-03-01 00:00:00+00'::timestamp with time zone - '04:00:00'::interval)))
         Rows Removed by Filter: 2
         ->  Bitmap Index Scan on bookings_room_start (actual time=0.016..0.016 rows=93 loops=1)
 Execution Time: 0.080 ms
```

Cette condition est utilisée par `bookingRepository.findConfirmedByRoomBetween`. L'écart ne se voit pas avec 4 réservations, mais il reste constant quand l'historique grossit, alors que la version sans borne basse se dégrade avec le nombre de semaines passées.

## 2. Cache Valkey du planning

### Clés et durée de vie

| Clé | Contenu | Durée de vie |
|---|---|---|
| `planning:{roomId}:version` | Compteur entier, incrémenté (`INCR`) à chaque réservation ou annulation de la salle | aucune (4 clés au total) |
| `planning:{roomId}:v{version}:{from}:{to}` | JSON du planning de la salle sur la période demandée | 300 s (`SET … EX 300`) |

- **Pourquoi ces clés.** L'accès est toujours « une salle, une période » : la clé reprend exactement les paramètres de `GET /rooms/:id/bookings`. La version par salle permet d'invalider d'un coup toutes les périodes d'une salle sans `KEYS` ni `SCAN` : les anciennes entrées ne sont plus jamais lues et expirent d'elles-mêmes. Une réservation de `room-1` ne vide pas le cache des trois autres salles.
- **Pourquoi 300 s.** La fraîcheur ne dépend pas du TTL : chaque écriture change la version, donc le planning est à jour immédiatement. Le TTL ne sert qu'à borner la mémoire occupée par les périodes consultées une fois (plannings d'anciennes semaines). Cinq minutes couvrent les consultations répétées d'un membre qui organise sa semaine.
- **Pas de course entre lecture et invalidation.** La version est lue une seule fois avant d'interroger PostgreSQL ; si une réservation est créée pendant la lecture, le résultat est rangé sous l'ancienne version, qui n'est plus lue.
- **Valkey indisponible.** Client configuré avec `disableOfflineQueue` et un `connectTimeout` de 500 ms ; chaque appel au cache est protégé et renvoie « absent » en cas d'erreur, la requête part alors vers PostgreSQL. Comme une invalidation peut être perdue pendant une panne, le cache vide ses clés `planning:*` à chaque (re)connexion.

Tests automatisés : [`tests/http/cache.test.ts`](tests/http/cache.test.ts) (Valkey réel) et [`tests/http/cache-unavailable.test.ts`](tests/http/cache-unavailable.test.ts) (Valkey injoignable).

### Preuve manuelle (API lancée, Valkey arrêté puis relancé)

```
$ curl "$PLANNING"   # 1re lecture, mise en cache
[{"id":"booking-1","roomId":"room-1","memberId":"member-1","start":"2026-11-03T18:00:00Z","end":"2026-11-03T20:00:00Z","status":"confirmed"}]
$ valkey-cli KEYS "planning:*"
planning:room-1:v0:2026-11-02T00:00:00.000Z:2026-11-09T00:00:00.000Z
$ valkey-cli TTL <clé>
300
$ curl -X POST /rooms/room-1/bookings (member-3, 4 nov 14h-16h)
HTTP/1.1 201 Created
Location: /bookings/booking-ed404285-291e-4b98-a1b8-7301955a6dd5
$ curl "$PLANNING"   # immédiatement à jour
[{"id":"booking-1","roomId":"room-1","memberId":"member-1","start":"2026-11-03T18:00:00Z","end":"2026-11-03T20:00:00Z","status":"confirmed"},{"id":"booking-ed404285-291e-4b98-a1b8-7301955a6dd5","roomId":"room-1","memberId":"member-3","start":"2026-11-04T14:00:00Z","end":"2026-11-04T16:00:00Z","status":"confirmed"}]
$ valkey-cli GET planning:room-1:version
1
$ docker compose stop valkey
 Container socleback-endepreuve-valkey-1 Stopped 
$ curl -w "%{http_code}" "$PLANNING"   # Valkey arrêté
[{"id":"booking-1","roomId":"room-1","memberId":"member-1","start":"2026-11-03T18:00:00Z","end":"2026-11-03T20:00:00Z","status":"confirmed"},{"id":"booking-ed404285-291e-4b98-a1b8-7301955a6dd5","roomId":"room-1","memberId":"member-3","start":"2026-11-04T14:00:00Z","end":"2026-11-04T16:00:00Z","status":"confirmed"}] -> HTTP 200
$ curl -X DELETE /bookings/booking-1   # Valkey arrêté
HTTP 204
$ curl "$PLANNING"
[{"id":"booking-ed404285-291e-4b98-a1b8-7301955a6dd5","roomId":"room-1","memberId":"member-3","start":"2026-11-04T14:00:00Z","end":"2026-11-04T16:00:00Z","status":"confirmed"}] -> HTTP 200
$ docker compose start valkey
 Container socleback-endepreuve-valkey-1 Started 
$ curl "$PLANNING"   # Valkey revenu : cache vidé à la reconnexion, pas de planning périmé
[{"id":"booking-ed404285-291e-4b98-a1b8-7301955a6dd5","roomId":"room-1","memberId":"member-3","start":"2026-11-04T14:00:00Z","end":"2026-11-04T16:00:00Z","status":"confirmed"}]
$ valkey-cli KEYS "planning:*"
planning:room-1:v0:2026-11-02T00:00:00.000Z:2026-11-09T00:00:00.000Z
```

### Quelles données dans Valkey, lesquelles dans PostgreSQL ?

| Donnée | Où | Raison |
|---|---|---|
| Salles, membres, réservations, historique des annulations | **PostgreSQL** | Source de vérité. Il faut des transactions, des clés étrangères, la contrainte d'exclusion anti-chevauchement, le verrou sur le membre, des requêtes par période et des sauvegardes cohérentes. |
| Planning d'une salle sur une période (réponse calculée) | **Valkey** | Donnée dérivée, recalculable à tout moment depuis PostgreSQL ; sa perte ne coûte qu'une requête. C'est la ressource la plus lue. |
| Candidats naturels si l'API grandit | **Valkey** | Limitation de débit par membre (`INCR` + `EXPIRE`), clés d'idempotence des `POST` (TTL de quelques minutes), sessions. Toutes sont temporaires et tolèrent une perte. |

**Les réservations pourraient-elles être stockées dans Valkey ?** Non, pas comme source de vérité :

- **Intégrité.** Valkey n'a ni contrainte d'exclusion ni clé étrangère. Empêcher deux réservations qui se chevauchent demanderait des scripts Lua ou des `WATCH`/`MULTI` écrits à la main, c'est-à-dire réécrire ce que PostgreSQL garantit déjà, avec un risque de bug sur la règle la plus importante du sujet (le double booking qui a motivé le projet).
- **Durabilité.** Dans ce `compose.yaml`, Valkey n'a pas de volume : un redémarrage efface tout (visible ci-dessus, la seule clé restante est celle recréée après redémarrage). Même avec AOF, la persistance est moins stricte qu'un commit PostgreSQL.
- **Requêtes.** « Les réservations d'un membre », « le planning d'une salle sur une semaine », le comptage des réservations à venir : tout cela est naturel en SQL, coûteux à maintenir en index secondaires dans un magasin clé-valeur.
- **Sauvegarde.** `pg_dump` donne une copie cohérente et restaurable (partie 3).

**Taille de l'association.** Studio Riff a 4 salles et quelques dizaines de membres : quelques dizaines de réservations par semaine, quelques milliers par an. PostgreSQL répond au planning en moins d'une milliseconde, même avec 100 000 lignes et le bon index (partie 1). Le cache n'est donc pas une nécessité de performance aujourd'hui. Il est gardé volontairement simple (une clé par salle et période, invalidation par version) et **facultatif** : sans `VALKEY_URL`, ou si Valkey tombe, l'API fonctionne à l'identique. Une association de cette taille ne doit pas dépendre d'un deuxième serveur pour prendre une réservation.

## 3. Sauvegarde et restauration

### Scripts

- [`backup.sh`](backup.sh) : `pg_dump -Fc` exécuté dans le conteneur, écrit dans `backups/<base>_<horodatage UTC>.dump` (écriture dans un fichier `.partial` puis renommage, pour ne jamais laisser une sauvegarde tronquée sous un nom valide), puis suppression des sauvegardes de plus de `RETENTION_DAYS` jours (30 par défaut).
- [`restore.sh`](restore.sh) `[fichier.dump] [base_cible]` : crée une **nouvelle** base avec `createdb` (refuse de restaurer dans la base d'origine), restaure avec `pg_restore`, compare le nombre de lignes de chaque table des deux côtés et vérifie que la contrainte d'exclusion est bien recréée. Code de sortie non nul si un comptage diffère.

### Preuve (base contenant les 100 000 réservations générées + les données de départ + 1 réservation créée à la main)

```
$ ./backup.sh
Sauvegarde : backups/studio_riff_20261102T124322Z.dump (536K)

$ ./restore.sh
Restauration de backups/studio_riff_20261102T124322Z.dump dans la nouvelle base studio_riff_restore_20261102124323
Durée de restauration : 3 s

table                 studio_riff   studio_riff_restore_20261102124323  resultat
rooms                           4                                    4  OK
members                         3                                    3  OK
bookings                   100005                               100005  OK
schema_migrations               2                                    2  OK

Contrainte bookings_no_overlap présente dans studio_riff_restore_20261102124323 : oui
(code de sortie : 0)

$ ./restore.sh backups/*.dump studio_riff
Refus : la restauration se fait dans une nouvelle base, pas dans studio_riff
```

### RPO, RTO et rétention

| | Valeur | Justification |
|---|---|---|
| **RPO** (perte de données maximale) | **24 h** | Une sauvegarde par nuit (`0 3 * * * /chemin/vers/backup.sh`, à 3 h UTC, quand personne ne répète). Studio Riff enregistre quelques dizaines de réservations par semaine : au pire, on perd celles d'une journée, que les membres peuvent refaire. Une sauvegarde continue (archivage WAL, réplication) coûterait un serveur et de l'administration qu'une association de bénévoles ne peut pas assurer. |
| **RTO** (durée d'interruption maximale) | **4 h** | La restauration technique prend **3 s** pour 100 000 réservations (mesuré ci-dessus), soit bien moins pour le volume réel. Le délai est donc humain : un bénévole doit s'apercevoir de la panne et lancer `restore.sh`. Les salles sont surtout réservées en soirée : une interruption d'une demi-journée ne fait perdre aucune répétition, les membres pouvant réserver plus tard ou par téléphone. Une banque viserait quelques minutes avec une réplique prête à prendre le relais ; ici ce serait disproportionné. |
| **Rétention** | **30 jours** (30 sauvegardes quotidiennes) | Une erreur (annulations en masse, script lancé sur la mauvaise base) peut n'être remarquée qu'au bout de quelques semaines, par exemple au bilan mensuel des salles. Une sauvegarde pèse environ 0,5 Mo même avec 100 000 réservations : 30 jours tiennent en moins de 20 Mo. Au-delà, on conserverait des données personnelles (noms de groupes, horaires) sans besoin, ce que le RGPD demande d'éviter. |

À prévoir en production : copier chaque sauvegarde hors de la machine (disque externe ou stockage en ligne de l'association), sans quoi une panne du disque emporte la base et ses sauvegardes, et lancer `restore.sh` une fois par mois pour vérifier que les sauvegardes sont réellement restaurables.
