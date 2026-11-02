import { randomUUID } from 'node:crypto';
import type { PlanningCache } from '../cache/planning.cache.js';
import type { Pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { assertMemberLimit, cancelBooking, assertNoOverlap, parseBookingRequest, type Booking } from '../domain/booking.js';
import type { Clock } from '../domain/clock.js';
import { NotFoundError } from '../domain/errors.js';
import { assertRoomAvailable } from '../domain/room.js';
import { bookingRepository } from '../repositories/booking.repository.js';
import { memberRepository } from '../repositories/member.repository.js';
import { roomRepository } from '../repositories/room.repository.js';

export class BookingService {
  constructor(
    private readonly pool: Pool,
    private readonly clock: Clock,
    private readonly cache: PlanningCache,
  ) {}

  async getBooking(id: string): Promise<Booking> {
    const booking = await bookingRepository.findById(this.pool, id);
    if (!booking) throw new NotFoundError(`Réservation ${id} introuvable`);
    return booking;
  }

  async createBooking(roomId: string, body: unknown): Promise<Booking> {
    const booking = await withTransaction(this.pool, async (client) => {
      const room = await roomRepository.findById(client, roomId);
      if (!room) throw new NotFoundError(`Salle ${roomId} introuvable`);
      const request = parseBookingRequest(roomId, body, this.clock);
      assertRoomAvailable(room, request.start, request.end);

      const member = await memberRepository.findByIdForUpdate(client, request.memberId);
      if (!member) throw new NotFoundError(`Membre ${request.memberId} introuvable`);

      const memberBookings = await bookingRepository.findByMember(client, member.id);
      assertMemberLimit(memberBookings, this.clock);

      const roomBookings = await bookingRepository.findConfirmedByRoomBetween(client, roomId, request.start, request.end);
      assertNoOverlap(request, roomBookings);

      const booking: Booking = { id: `booking-${randomUUID()}`, ...request, status: 'confirmed' };
      await bookingRepository.insert(client, booking);
      return booking;
    });
    await this.cache.invalidate(roomId);
    return booking;
  }

  async cancelBooking(id: string): Promise<Booking> {
    const cancelled = await withTransaction(this.pool, async (client) => {
      const booking = await bookingRepository.findByIdForUpdate(client, id);
      if (!booking) throw new NotFoundError(`Réservation ${id} introuvable`);
      const cancelled = cancelBooking(booking, this.clock);
      await bookingRepository.updateStatus(client, id, cancelled.status, this.clock.now());
      return cancelled;
    });
    await this.cache.invalidate(cancelled.roomId);
    return cancelled;
  }
}
