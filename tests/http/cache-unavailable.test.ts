import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createValkeyClient, ValkeyPlanningCache } from '../../src/cache/valkey-planning.cache.js';
import { setupTestApp } from '../helpers/test-app.js';

const client = createValkeyClient('redis://localhost:6399');
client.connect().catch(() => {});
const { app } = setupTestApp({ cache: new ValkeyPlanningCache(client) });

const planning = '/rooms/room-1/bookings?from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z';

afterAll(() => {
  client.destroy();
});

describe('Valkey indisponible', () => {
  it('sert le planning depuis PostgreSQL', async () => {
    const res = await request(app).get(planning);

    expect(res.status).toBe(200);
    expect(res.body.map((b: { id: string }) => b.id)).toEqual(['booking-1']);
  });

  it('accepte toujours réservations et annulations', async () => {
    const created = await request(app)
      .post('/rooms/room-1/bookings')
      .send({ memberId: 'member-3', start: '2026-11-04T14:00:00Z', end: '2026-11-04T16:00:00Z' });
    expect(created.status).toBe(201);

    expect((await request(app).delete(`/bookings/${created.body.id}`)).status).toBe(204);
    expect((await request(app).get(planning)).body).toHaveLength(1);
  });
});
