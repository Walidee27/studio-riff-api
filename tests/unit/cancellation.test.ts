import { describe, expect, it } from 'vitest';
import { cancelBooking, type Booking } from '../../src/domain/booking.js';
import { FixedClock } from '../../src/domain/clock.js';
import { ConflictError } from '../../src/domain/errors.js';

const clock = new FixedClock('2026-11-02T09:00:00Z');

const booking = (start: string, status: Booking['status'] = 'confirmed'): Booking => ({
  id: 'booking-x',
  roomId: 'room-1',
  memberId: 'member-1',
  start: new Date(start),
  end: new Date(new Date(start).getTime() + 2 * 3_600_000),
  status,
});

describe('cancelBooking', () => {
  it('passe au statut cancelled à plus de 24 h du début', () => {
    expect(cancelBooking(booking('2026-11-03T18:00:00Z'), clock).status).toBe('cancelled');
  });

  it('passe au statut late_cancelled à moins de 24 h du début', () => {
    expect(cancelBooking(booking('2026-11-02T19:00:00Z'), clock).status).toBe('late_cancelled');
  });

  it('considère exactement 24 h comme une annulation normale', () => {
    expect(cancelBooking(booking('2026-11-03T09:00:00Z'), clock).status).toBe('cancelled');
    expect(cancelBooking(booking('2026-11-03T08:59:59Z'), clock).status).toBe('late_cancelled');
  });

  it('refuse une seconde annulation', () => {
    expect(() => cancelBooking(booking('2026-11-03T18:00:00Z', 'cancelled'), clock)).toThrow(ConflictError);
    expect(() => cancelBooking(booking('2026-11-03T18:00:00Z', 'late_cancelled'), clock)).toThrow(ConflictError);
  });

  it('refuse d\'annuler une réservation déjà commencée', () => {
    expect(() => cancelBooking(booking('2026-10-28T19:00:00Z'), clock)).toThrow(ConflictError);
  });

  it('ne modifie pas la réservation reçue', () => {
    const original = booking('2026-11-03T18:00:00Z');
    cancelBooking(original, clock);
    expect(original.status).toBe('confirmed');
  });
});
