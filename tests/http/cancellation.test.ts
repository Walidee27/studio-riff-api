import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';

const { app } = setupTestApp();

describe('DELETE /bookings/:id', () => {
  it('annule booking-1 (plus de 24 h avant) et garde la trace', async () => {
    const res = await request(app).delete('/bookings/booking-1');

    expect(res.status).toBe(204);
    const after = await request(app).get('/bookings/booking-1');
    expect(after.body.status).toBe('cancelled');
  });

  it('marque booking-3 late_cancelled (moins de 24 h avant)', async () => {
    await request(app).delete('/bookings/booking-3').expect(204);

    const after = await request(app).get('/bookings/booking-3');
    expect(after.body.status).toBe('late_cancelled');
  });

  it('renvoie 409 pour une seconde annulation', async () => {
    await request(app).delete('/bookings/booking-1').expect(204);

    const res = await request(app).delete('/bookings/booking-1');
    expect(res.status).toBe(409);
  });

  it('renvoie 409 pour une réservation passée', async () => {
    const res = await request(app).delete('/bookings/booking-4');

    expect(res.status).toBe(409);
  });

  it('renvoie 404 pour une réservation inconnue', async () => {
    const res = await request(app).delete('/bookings/booking-99');

    expect(res.status).toBe(404);
  });

  it('libère le créneau et la place du membre', async () => {
    await request(app).delete('/bookings/booking-1').expect(204);

    const res = await request(app)
      .post('/rooms/room-1/bookings')
      .send({ memberId: 'member-1', start: '2026-11-03T18:00:00Z', end: '2026-11-03T20:00:00Z' });
    expect(res.status).toBe(201);
  });
});
