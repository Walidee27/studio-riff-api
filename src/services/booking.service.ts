import type { Pool } from '../db/pool.js';
import type { Booking } from '../domain/booking.js';
import type { Clock } from '../domain/clock.js';
import { NotFoundError } from '../domain/errors.js';
import { bookingRepository } from '../repositories/booking.repository.js';

export class BookingService {
  constructor(private readonly pool: Pool, private readonly clock: Clock) {}

  async getBooking(id: string): Promise<Booking> {
    const booking = await bookingRepository.findById(this.pool, id);
    if (!booking) throw new NotFoundError(`Réservation ${id} introuvable`);
    return booking;
  }
}
