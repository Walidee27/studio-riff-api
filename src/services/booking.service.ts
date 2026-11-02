import { randomUUID } from 'node:crypto';
import type { Pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { parseBookingRequest, type Booking } from '../domain/booking.js';
import type { Clock } from '../domain/clock.js';
import { NotFoundError } from '../domain/errors.js';
import { bookingRepository } from '../repositories/booking.repository.js';
import { memberRepository } from '../repositories/member.repository.js';
import { roomRepository } from '../repositories/room.repository.js';

export class BookingService {
  constructor(private readonly pool: Pool, private readonly clock: Clock) {}

  async getBooking(id: string): Promise<Booking> {
    const booking = await bookingRepository.findById(this.pool, id);
    if (!booking) throw new NotFoundError(`Réservation ${id} introuvable`);
    return booking;
  }

  async createBooking(roomId: string, body: unknown): Promise<Booking> {
    return withTransaction(this.pool, async (client) => {
      const room = await roomRepository.findById(client, roomId);
      if (!room) throw new NotFoundError(`Salle ${roomId} introuvable`);
      const request = parseBookingRequest(roomId, body, this.clock);

      const member = await memberRepository.findById(client, request.memberId);
      if (!member) throw new NotFoundError(`Membre ${request.memberId} introuvable`);

      const booking: Booking = { id: `booking-${randomUUID()}`, ...request, status: 'confirmed' };
      await bookingRepository.insert(client, booking);
      return booking;
    });
  }
}
