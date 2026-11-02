import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';

const { app } = setupTestApp();

const book = (start: string, end: string) =>
  request(app).post('/rooms/room-4/bookings').send({ memberId: 'member-3', start, end });

describe('Salle en maintenance', () => {
  it('refuse une réservation de room-4 pendant la maintenance', async () => {
    const res = await book('2026-11-06T14:00:00Z', '2026-11-06T16:00:00Z');

    expect(res.status).toBe(409);
  });

  it('accepte room-4 en dehors de la maintenance', async () => {
    expect((await book('2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z')).status).toBe(201);
    expect((await book('2026-11-08T10:00:00Z', '2026-11-08T12:00:00Z')).status).toBe(201);
  });
});
