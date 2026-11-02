import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';

const { app } = setupTestApp();

const body = { memberId: 'member-3', start: '2026-11-04T14:00:00Z', end: '2026-11-04T16:00:00Z' };

describe('POST /rooms/:id/bookings', () => {
  it('crée la réservation et renvoie 201 + Location', async () => {
    const res = await request(app).post('/rooms/room-1/bookings').send(body);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/bookings/${res.body.id}`);
    expect(res.body).toMatchObject({ roomId: 'room-1', ...body, status: 'confirmed' });

    const created = await request(app).get(res.headers.location);
    expect(created.status).toBe(200);
  });

  it('renvoie 400 pour un créneau invalide', async () => {
    const res = await request(app)
      .post('/rooms/room-1/bookings')
      .send({ ...body, start: '2026-11-04T08:00:00Z', end: '2026-11-04T10:00:00Z' });

    expect(res.status).toBe(400);
  });

  it('renvoie 400 pour une durée supérieure à 4 h', async () => {
    const res = await request(app).post('/rooms/room-1/bookings').send({ ...body, end: '2026-11-04T19:00:00Z' });

    expect(res.status).toBe(400);
  });

  it('renvoie 400 pour un JSON mal formé', async () => {
    const res = await request(app).post('/rooms/room-1/bookings').set('Content-Type', 'application/json').send('{');

    expect(res.status).toBe(400);
  });

  it('renvoie 404 pour une salle inconnue', async () => {
    const res = await request(app).post('/rooms/room-99/bookings').send(body);

    expect(res.status).toBe(404);
  });

  it('renvoie 404 pour un membre inconnu', async () => {
    const res = await request(app).post('/rooms/room-1/bookings').send({ ...body, memberId: 'member-99' });

    expect(res.status).toBe(404);
  });
});
