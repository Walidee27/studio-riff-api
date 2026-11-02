import { describe, expect, it } from 'vitest';
import { assertValidSlot, parseBookingRequest } from '../../src/domain/booking.js';
import { FixedClock } from '../../src/domain/clock.js';
import { ValidationError } from '../../src/domain/errors.js';

const clock = new FixedClock('2026-11-02T09:00:00Z');
const slot = (start: string, end: string) => () => assertValidSlot(new Date(start), new Date(end), clock);

describe('assertValidSlot', () => {
  it('accepte un créneau de 2 h à heure pleine', () => {
    expect(slot('2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z')).not.toThrow();
  });

  it('accepte les bornes 1 h et 4 h', () => {
    expect(slot('2026-11-04T10:00:00Z', '2026-11-04T11:00:00Z')).not.toThrow();
    expect(slot('2026-11-04T19:00:00Z', '2026-11-04T23:00:00Z')).not.toThrow();
  });

  it('refuse moins de 1 h ou plus de 4 h', () => {
    expect(slot('2026-11-04T14:00:00Z', '2026-11-04T14:00:00Z')).toThrow(ValidationError);
    expect(slot('2026-11-04T12:00:00Z', '2026-11-04T17:00:00Z')).toThrow(ValidationError);
    expect(slot('2026-11-04T16:00:00Z', '2026-11-04T14:00:00Z')).toThrow(ValidationError);
  });

  it('refuse un début ou une fin hors heure pleine', () => {
    expect(slot('2026-11-04T14:30:00Z', '2026-11-04T16:30:00Z')).toThrow(ValidationError);
    expect(slot('2026-11-04T14:00:01Z', '2026-11-04T16:00:00Z')).toThrow(ValidationError);
  });

  it('refuse un créneau avant 10 h ou qui dépasse 23 h', () => {
    expect(slot('2026-11-04T09:00:00Z', '2026-11-04T11:00:00Z')).toThrow(ValidationError);
    expect(slot('2026-11-04T22:00:00Z', '2026-11-05T00:00:00Z')).toThrow(ValidationError);
    expect(slot('2026-11-04T23:00:00Z', '2026-11-05T00:00:00Z')).toThrow(ValidationError);
  });

  it('refuse un créneau dans le passé selon l\'horloge fournie', () => {
    expect(slot('2026-11-01T14:00:00Z', '2026-11-01T16:00:00Z')).toThrow(ValidationError);
    const later = new FixedClock('2026-11-05T00:00:00Z');
    expect(() => assertValidSlot(new Date('2026-11-04T14:00:00Z'), new Date('2026-11-04T16:00:00Z'), later)).toThrow(
      ValidationError,
    );
  });
});

describe('parseBookingRequest', () => {
  it('construit la demande à partir du corps', () => {
    const request = parseBookingRequest(
      'room-1',
      { memberId: 'member-3', start: '2026-11-04T14:00:00Z', end: '2026-11-04T16:00:00Z' },
      clock,
    );
    expect(request).toEqual({
      roomId: 'room-1',
      memberId: 'member-3',
      start: new Date('2026-11-04T14:00:00Z'),
      end: new Date('2026-11-04T16:00:00Z'),
    });
  });

  it('refuse un corps incomplet ou une date sans fuseau', () => {
    expect(() => parseBookingRequest('room-1', {}, clock)).toThrow(ValidationError);
    expect(() => parseBookingRequest('room-1', { memberId: 'member-3', start: 'x', end: 'y' }, clock)).toThrow(
      ValidationError,
    );
    expect(() =>
      parseBookingRequest('room-1', { memberId: 'member-3', start: '2026-11-04T14:00:00', end: '2026-11-04T16:00:00' }, clock),
    ).toThrow(ValidationError);
  });
});
