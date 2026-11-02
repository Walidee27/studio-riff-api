import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/domain/errors.js';
import { assertRoomAvailable, isUnderMaintenance, type Room } from '../../src/domain/room.js';

const bjork: Room = {
  id: 'room-4',
  name: 'Salle Björk',
  capacity: 3,
  maintenanceStart: new Date('2026-11-05T00:00:00Z'),
  maintenanceEnd: new Date('2026-11-08T00:00:00Z'),
};
const hendrix: Room = { ...bjork, id: 'room-1', name: 'Salle Hendrix', maintenanceStart: null, maintenanceEnd: null };

const at = (start: string, end: string) => [new Date(start), new Date(end)] as const;

describe('maintenance', () => {
  it('refuse un créneau pendant la maintenance', () => {
    expect(() => assertRoomAvailable(bjork, ...at('2026-11-06T14:00:00Z', '2026-11-06T16:00:00Z'))).toThrow(ConflictError);
  });

  it('accepte un créneau juste avant ou juste après la maintenance', () => {
    expect(isUnderMaintenance(bjork, ...at('2026-11-04T20:00:00Z', '2026-11-04T22:00:00Z'))).toBe(false);
    expect(isUnderMaintenance(bjork, ...at('2026-11-08T10:00:00Z', '2026-11-08T12:00:00Z'))).toBe(false);
  });

  it('accepte toute période pour une salle sans maintenance', () => {
    expect(() => assertRoomAvailable(hendrix, ...at('2026-11-06T14:00:00Z', '2026-11-06T16:00:00Z'))).not.toThrow();
  });
});
