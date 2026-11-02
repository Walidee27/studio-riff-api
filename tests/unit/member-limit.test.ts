import { describe, expect, it } from 'vitest';
import { assertMemberLimit, isUpcoming, type Booking } from '../../src/domain/booking.js';
import { FixedClock } from '../../src/domain/clock.js';
import { ConflictError } from '../../src/domain/errors.js';

const clock = new FixedClock('2026-11-02T09:00:00Z');

const booking = (start: string, status: Booking['status'] = 'confirmed'): Booking => ({
  id: start,
  roomId: 'room-1',
  memberId: 'member-1',
  start: new Date(start),
  end: new Date(new Date(start).getTime() + 3_600_000),
  status,
});

describe('isUpcoming', () => {
  it('ne compte que les réservations confirmées qui commencent après l\'horloge', () => {
    expect(isUpcoming(booking('2026-11-03T18:00:00Z'), clock)).toBe(true);
    expect(isUpcoming(booking('2026-10-28T19:00:00Z'), clock)).toBe(false);
    expect(isUpcoming(booking('2026-11-03T18:00:00Z', 'cancelled'), clock)).toBe(false);
  });
});

describe('assertMemberLimit', () => {
  it('accepte un membre qui a moins de 2 réservations à venir', () => {
    expect(() => assertMemberLimit([booking('2026-11-03T18:00:00Z')], clock)).not.toThrow();
  });

  it('refuse un membre qui a déjà 2 réservations à venir', () => {
    const bookings = [booking('2026-11-03T18:00:00Z'), booking('2026-11-10T14:00:00Z')];
    expect(() => assertMemberLimit(bookings, clock)).toThrow(ConflictError);
  });

  it('ignore les réservations passées et annulées', () => {
    const bookings = [
      booking('2026-11-03T18:00:00Z'),
      booking('2026-10-28T19:00:00Z'),
      booking('2026-11-10T14:00:00Z', 'late_cancelled'),
    ];
    expect(() => assertMemberLimit(bookings, clock)).not.toThrow();
  });

  it('dépend de l\'horloge : une réservation passée libère une place', () => {
    const bookings = [booking('2026-11-03T18:00:00Z'), booking('2026-11-10T14:00:00Z')];
    expect(() => assertMemberLimit(bookings, new FixedClock('2026-11-04T00:00:00Z'))).not.toThrow();
  });
});
