import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createValkeyClient, ValkeyPlanningCache } from '../../src/cache/valkey-planning.cache.js';
import { setupTestApp } from '../helpers/test-app.js';

const client = createValkeyClient(process.env.VALKEY_URL ?? 'redis://localhost:6379');
const cache = new ValkeyPlanningCache(client, { prefix: 'test-planning', ttlSeconds: 300 });
const { app, pool } = setupTestApp({ cache });

const planning = '/rooms/room-1/bookings?from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z';
const ids = (res: request.Response) => res.body.map((b: { id: string }) => b.id);

beforeAll(async () => {
  await client.connect();
});

beforeEach(async () => {
  await cache.purge();
});

afterAll(async () => {
  await client.close();
});

describe('Cache Valkey du planning', () => {
  it('stocke le planning sous une clé versionnée avec une durée de vie de 300 s', async () => {
    await request(app).get(planning).expect(200);

    const keys = await client.keys('test-planning:room-1:*');
    expect(keys).toEqual(['test-planning:room-1:v0:2026-11-02T00:00:00.000Z:2026-11-09T00:00:00.000Z']);
    const ttl = await client.ttl(keys[0]);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('sert la seconde lecture depuis Valkey', async () => {
    await request(app).get(planning).expect(200);
    await pool.query("UPDATE bookings SET end_at = '2026-11-03T21:00:00Z' WHERE id = 'booking-1'");

    const res = await request(app).get(planning);
    expect(res.body[0].end).toBe('2026-11-03T20:00:00Z');
  });

  it('affiche immédiatement une nouvelle réservation', async () => {
    expect(ids(await request(app).get(planning))).toEqual(['booking-1']);

    const created = await request(app)
      .post('/rooms/room-1/bookings')
      .send({ memberId: 'member-3', start: '2026-11-04T14:00:00Z', end: '2026-11-04T16:00:00Z' })
      .expect(201);

    expect(ids(await request(app).get(planning))).toEqual(['booking-1', created.body.id]);
  });

  it('retire immédiatement une réservation annulée', async () => {
    expect(ids(await request(app).get(planning))).toEqual(['booking-1']);

    await request(app).delete('/bookings/booking-1').expect(204);

    expect(ids(await request(app).get(planning))).toEqual([]);
  });

  it('n\'invalide que la salle concernée', async () => {
    await request(app).get(planning).expect(200);
    await request(app).get('/rooms/room-2/bookings?from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z').expect(200);

    await request(app).delete('/bookings/booking-1').expect(204);

    expect(await client.get('test-planning:room-1:version')).toBe('1');
    expect(await client.get('test-planning:room-2:version')).toBeNull();
  });
});
