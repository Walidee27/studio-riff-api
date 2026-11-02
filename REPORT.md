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
