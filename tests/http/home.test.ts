import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/test-app.js';

const { app } = setupTestApp();

describe('Routes hors contrat', () => {
  it('GET / liste les routes de l\'API', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.routes).toContain('POST /rooms/:id/bookings');
  });

  it('renvoie un 404 JSON pour une route inconnue', async () => {
    const res = await request(app).get('/salles');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route inconnue : GET /salles' });
  });
});
