import type { Queryable } from '../db/pool.js';
import type { Booking, BookingStatus } from '../domain/booking.js';
import { ConflictError } from '../domain/errors.js';

interface BookingRow {
  id: string;
  room_id: string;
  member_id: string;
  start_at: Date;
  end_at: Date;
  status: BookingStatus;
}

const EXCLUSION_VIOLATION = '23P01';

const columns = 'id, room_id, member_id, start_at, end_at, status';

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    memberId: row.member_id,
    start: row.start_at,
    end: row.end_at,
    status: row.status,
  };
}

export const bookingRepository = {
  async findById(db: Queryable, id: string): Promise<Booking | null> {
    const { rows } = await db.query<BookingRow>(`SELECT ${columns} FROM bookings WHERE id = $1`, [id]);
    return rows[0] ? toBooking(rows[0]) : null;
  },

  async findByIdForUpdate(db: Queryable, id: string): Promise<Booking | null> {
    const { rows } = await db.query<BookingRow>(`SELECT ${columns} FROM bookings WHERE id = $1 FOR UPDATE`, [id]);
    return rows[0] ? toBooking(rows[0]) : null;
  },

  async findByMember(db: Queryable, memberId: string): Promise<Booking[]> {
    const { rows } = await db.query<BookingRow>(
      `SELECT ${columns} FROM bookings WHERE member_id = $1 ORDER BY start_at`,
      [memberId],
    );
    return rows.map(toBooking);
  },

  async findConfirmedByRoomBetween(db: Queryable, roomId: string, from: Date, to: Date): Promise<Booking[]> {
    const { rows } = await db.query<BookingRow>(
      `SELECT ${columns} FROM bookings
       WHERE room_id = $1 AND status = 'confirmed'
         AND start_at < $3 AND start_at > $2::timestamptz - interval '4 hours' AND end_at > $2
       ORDER BY start_at`,
      [roomId, from, to],
    );
    return rows.map(toBooking);
  },

  async insert(db: Queryable, booking: Booking): Promise<void> {
    try {
      await db.query(
        `INSERT INTO bookings (id, room_id, member_id, start_at, end_at, status) VALUES ($1, $2, $3, $4, $5, $6)`,
        [booking.id, booking.roomId, booking.memberId, booking.start, booking.end, booking.status],
      );
    } catch (error) {
      if ((error as { code?: string }).code === EXCLUSION_VIOLATION) {
        throw new ConflictError('La salle est déjà réservée sur ce créneau');
      }
      throw error;
    }
  },

  async updateStatus(db: Queryable, id: string, status: BookingStatus, at: Date): Promise<void> {
    await db.query('UPDATE bookings SET status = $2, cancelled_at = $3 WHERE id = $1', [id, status, at]);
  },
};
