import type { Queryable } from './pool.js';

export const rooms = [
  { id: 'room-1', name: 'Salle Hendrix', capacity: 5, maintenanceStart: null, maintenanceEnd: null },
  { id: 'room-2', name: 'Salle Simone', capacity: 4, maintenanceStart: null, maintenanceEnd: null },
  { id: 'room-3', name: 'Salle Bowie', capacity: 6, maintenanceStart: null, maintenanceEnd: null },
  { id: 'room-4', name: 'Salle Björk', capacity: 3, maintenanceStart: '2026-11-05T00:00:00Z', maintenanceEnd: '2026-11-08T00:00:00Z' },
];

export const members = [
  { id: 'member-1', name: 'Les Volts' },
  { id: 'member-2', name: 'Café Noir' },
  { id: 'member-3', name: 'Marée Basse' },
];

export const bookings = [
  { id: 'booking-1', roomId: 'room-1', memberId: 'member-1', start: '2026-11-03T18:00:00Z', end: '2026-11-03T20:00:00Z' },
  { id: 'booking-2', roomId: 'room-3', memberId: 'member-1', start: '2026-11-10T14:00:00Z', end: '2026-11-10T17:00:00Z' },
  { id: 'booking-3', roomId: 'room-2', memberId: 'member-2', start: '2026-11-02T19:00:00Z', end: '2026-11-02T21:00:00Z' },
  { id: 'booking-4', roomId: 'room-2', memberId: 'member-2', start: '2026-10-28T19:00:00Z', end: '2026-10-28T21:00:00Z' },
];

export async function seedDatabase(db: Queryable): Promise<void> {
  await db.query('TRUNCATE bookings, members, rooms RESTART IDENTITY CASCADE');
  for (const room of rooms) {
    await db.query(
      'INSERT INTO rooms (id, name, capacity, maintenance_start, maintenance_end) VALUES ($1, $2, $3, $4, $5)',
      [room.id, room.name, room.capacity, room.maintenanceStart, room.maintenanceEnd],
    );
  }
  for (const member of members) {
    await db.query('INSERT INTO members (id, name) VALUES ($1, $2)', [member.id, member.name]);
  }
  for (const booking of bookings) {
    await db.query(
      `INSERT INTO bookings (id, room_id, member_id, start_at, end_at, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed')`,
      [booking.id, booking.roomId, booking.memberId, booking.start, booking.end],
    );
  }
}
