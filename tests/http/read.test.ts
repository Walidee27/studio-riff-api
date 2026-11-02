import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';

const { app } = setupTestApp();

describe('GET /rooms', () => {
  it('liste les quatre salles avec leur maintenance', async () => {
    const res = await request(app).get('/rooms');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[3]).toEqual({
      id: 'room-4',
      name: 'Salle Björk',
      capacity: 3,
      maintenance: { start: '2026-11-05T00:00:00Z', end: '2026-11-08T00:00:00Z' },
    });
    expect(res.body[0].maintenance).toBeNull();
  });
});

describe('GET /rooms/:id/bookings', () => {
  it('renvoie le planning de la salle sur la période', async () => {
    const res = await request(app).get('/rooms/room-2/bookings?from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z');

    expect(res.status).toBe(200);
    expect(res.body.map((b: { id: string }) => b.id)).toEqual(['booking-3']);
  });

  it('prend la semaine en cours par défaut', async () => {
    const res = await request(app).get('/rooms/room-1/bookings');

    expect(res.status).toBe(200);
    expect(res.body.map((b: { id: string }) => b.id)).toEqual(['booking-1']);
  });

  it('renvoie 404 pour une salle inconnue', async () => {
    const res = await request(app).get('/rooms/room-99/bookings');

    expect(res.status).toBe(404);
  });

  it('renvoie 400 pour une période illisible', async () => {
    const res = await request(app).get('/rooms/room-1/bookings?from=demain');

    expect(res.status).toBe(400);
  });
});

describe('GET /bookings/:id', () => {
  it('renvoie la réservation sous la forme du contrat', async () => {
    const res = await request(app).get('/bookings/booking-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'booking-1',
      roomId: 'room-1',
      memberId: 'member-1',
      start: '2026-11-03T18:00:00Z',
      end: '2026-11-03T20:00:00Z',
      status: 'confirmed',
    });
  });

  it('renvoie 404 pour une réservation inconnue', async () => {
    const res = await request(app).get('/bookings/booking-99');

    expect(res.status).toBe(404);
  });
});

describe('GET /members/:id/bookings', () => {
  it('liste les réservations du membre', async () => {
    const res = await request(app).get('/members/member-1/bookings');

    expect(res.status).toBe(200);
    expect(res.body.map((b: { id: string }) => b.id)).toEqual(['booking-1', 'booking-2']);
  });

  it('renvoie 404 pour un membre inconnu', async () => {
    const res = await request(app).get('/members/member-99/bookings');

    expect(res.status).toBe(404);
  });
});
