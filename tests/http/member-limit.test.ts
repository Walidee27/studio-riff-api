import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';

const { app } = setupTestApp();

const book = (memberId: string, start: string, end: string, roomId = 'room-1') =>
  request(app).post(`/rooms/${roomId}/bookings`).send({ memberId, start, end });

describe('Limite de 2 réservations à venir', () => {
  it('refuse une 3e réservation à member-1', async () => {
    const res = await book('member-1', '2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z');

    expect(res.status).toBe(409);
  });

  it('ne compte pas la réservation passée de member-2', async () => {
    const accepted = await book('member-2', '2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z');
    const refused = await book('member-2', '2026-11-05T14:00:00Z', '2026-11-05T16:00:00Z');

    expect(accepted.status).toBe(201);
    expect(refused.status).toBe(409);
  });

  it('n\'accepte que 2 réservations sur 3 requêtes simultanées', async () => {
    const results = await Promise.all([
      book('member-3', '2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z', 'room-1'),
      book('member-3', '2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z', 'room-2'),
      book('member-3', '2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z', 'room-3'),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 201, 409]);
  });
});
