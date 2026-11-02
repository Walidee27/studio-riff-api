import type { Booking } from '../domain/booking.js';
import { formatInstant } from './format.js';

export function bookingView(booking: Booking) {
  return {
    id: booking.id,
    roomId: booking.roomId,
    memberId: booking.memberId,
    start: formatInstant(booking.start),
    end: formatInstant(booking.end),
    status: booking.status,
  };
}
