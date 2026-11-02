import { describe, expect, it } from 'vitest';
import { assertNoOverlap, type Booking, type BookingRequest } from '../../src/domain/booking.js';
import { ConflictError } from '../../src/domain/errors.js';

const existing: Booking = {
  id: 'booking-1',
  roomId: 'room-1',
  memberId: 'member-1',
  start: new Date('2026-11-03T18:00:00Z'),
  end: new Date('2026-11-03T20:00:00Z'),
  status: 'confirmed',
};

const request = (start: string, end: string, roomId = 'room-1'): BookingRequest => ({
  roomId,
  memberId: 'member-3',
  start: new Date(start),
  end: new Date(end),
});

describe('assertNoOverlap', () => {
  it('refuse un créneau qui chevauche une réservation confirmée', () => {
    expect(() => assertNoOverlap(request('2026-11-03T19:00:00Z', '2026-11-03T21:00:00Z'), [existing])).toThrow(ConflictError);
    expect(() => assertNoOverlap(request('2026-11-03T17:00:00Z', '2026-11-03T19:00:00Z'), [existing])).toThrow(ConflictError);
    expect(() => assertNoOverlap(request('2026-11-03T16:00:00Z', '2026-11-03T20:00:00Z'), [existing])).toThrow(ConflictError);
  });

  it('accepte un créneau qui commence à l\'heure exacte de fin du précédent', () => {
    expect(() => assertNoOverlap(request('2026-11-03T20:00:00Z', '2026-11-03T22:00:00Z'), [existing])).not.toThrow();
    expect(() => assertNoOverlap(request('2026-11-03T16:00:00Z', '2026-11-03T18:00:00Z'), [existing])).not.toThrow();
  });

  it('ignore les autres salles et les réservations annulées', () => {
    expect(() => assertNoOverlap(request('2026-11-03T18:00:00Z', '2026-11-03T20:00:00Z', 'room-2'), [existing])).not.toThrow();
    const cancelled: Booking = { ...existing, status: 'cancelled' };
    expect(() => assertNoOverlap(request('2026-11-03T18:00:00Z', '2026-11-03T20:00:00Z'), [cancelled])).not.toThrow();
  });
});
