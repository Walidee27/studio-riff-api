import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';

const { app, pool } = setupTestApp();

const book = (memberId: string, start: string, end: string) =>
  request(app).post('/rooms/room-1/bookings').send({ memberId, start, end });

describe('Chevauchement de réservations', () => {
  it('renvoie 409 si le créneau chevauche booking-1', async () => {
    const res = await book('member-3', '2026-11-03T19:00:00Z', '2026-11-03T21:00:00Z');

    expect(res.status).toBe(409);
  });

  it('accepte un créneau qui commence quand booking-1 se termine', async () => {
    const res = await book('member-3', '2026-11-03T20:00:00Z', '2026-11-03T22:00:00Z');

    expect(res.status).toBe(201);
  });

  it('ne laisse passer qu\'une requête sur deux simultanées', async () => {
    const results = await Promise.all([
      book('member-3', '2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z'),
      book('member-2', '2026-11-04T15:00:00Z', '2026-11-04T17:00:00Z'),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM bookings WHERE room_id = 'room-1'");
    expect(rows[0].n).toBe(2);
  });

  it('la base refuse elle-même un chevauchement inséré directement', async () => {
    const insert = pool.query(
      `INSERT INTO bookings (id, room_id, member_id, start_at, end_at, status)
       VALUES ('direct', 'room-1', 'member-3', '2026-11-03T19:00:00Z', '2026-11-03T20:00:00Z', 'confirmed')`,
    );

    await expect(insert).rejects.toMatchObject({ code: '23P01' });
  });
});
