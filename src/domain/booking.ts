import type { Clock } from './clock.js';
import { ConflictError, ValidationError } from './errors.js';
import { HOUR_MS, intervalsOverlap, parseInstant, startOfUtcDay } from './time.js';

export type BookingStatus = 'confirmed' | 'cancelled' | 'late_cancelled';

export interface Booking {
  id: string;
  roomId: string;
  memberId: string;
  start: Date;
  end: Date;
  status: BookingStatus;
}

export interface BookingRequest {
  roomId: string;
  memberId: string;
  start: Date;
  end: Date;
}

export const OPENING_HOUR = 10;
export const CLOSING_HOUR = 23;
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 4;

function isFullHour(date: Date): boolean {
  return date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

export function assertValidSlot(start: Date, end: Date, clock: Clock): void {
  if (!isFullHour(start) || !isFullHour(end)) {
    throw new ValidationError('Un créneau commence et finit à une heure pleine');
  }
  const durationHours = (end.getTime() - start.getTime()) / HOUR_MS;
  if (durationHours < MIN_DURATION_HOURS || durationHours > MAX_DURATION_HOURS) {
    throw new ValidationError(`Un créneau dure de ${MIN_DURATION_HOURS} h à ${MAX_DURATION_HOURS} h`);
  }
  const closing = startOfUtcDay(start).getTime() + CLOSING_HOUR * HOUR_MS;
  if (start.getUTCHours() < OPENING_HOUR || end.getTime() > closing) {
    throw new ValidationError(`Un créneau se tient entre ${OPENING_HOUR} h et ${CLOSING_HOUR} h UTC`);
  }
  if (start <= clock.now()) {
    throw new ValidationError('Un créneau ne peut pas commencer dans le passé');
  }
}

export function parseBookingRequest(roomId: string, body: unknown, clock: Clock): BookingRequest {
  if (typeof body !== 'object' || body === null) throw new ValidationError('Corps de requête attendu');
  const { memberId, start, end } = body as Record<string, unknown>;
  if (typeof memberId !== 'string' || memberId.trim() === '') {
    throw new ValidationError('memberId est obligatoire');
  }
  const request = { roomId, memberId, start: parseInstant(start, 'start'), end: parseInstant(end, 'end') };
  assertValidSlot(request.start, request.end, clock);
  return request;
}

export function assertNoOverlap(request: BookingRequest, existing: Booking[]): void {
  const conflict = existing.find(
    (booking) =>
      booking.roomId === request.roomId &&
      booking.status === 'confirmed' &&
      intervalsOverlap(booking.start, booking.end, request.start, request.end),
  );
  if (conflict) throw new ConflictError('La salle est déjà réservée sur ce créneau');
}

export const MAX_UPCOMING_BOOKINGS = 2;

export function isUpcoming(booking: Booking, clock: Clock): boolean {
  return booking.status === 'confirmed' && booking.start > clock.now();
}

export function assertMemberLimit(memberBookings: Booking[], clock: Clock): void {
  const upcoming = memberBookings.filter((booking) => isUpcoming(booking, clock)).length;
  if (upcoming >= MAX_UPCOMING_BOOKINGS) {
    throw new ConflictError(`Un membre a au plus ${MAX_UPCOMING_BOOKINGS} réservations à venir`);
  }
}

export const LATE_CANCELLATION_HOURS = 24;

export function cancelBooking(booking: Booking, clock: Clock): Booking {
  if (booking.status !== 'confirmed') throw new ConflictError('Cette réservation est déjà annulée');
  const now = clock.now();
  if (booking.start <= now) throw new ConflictError('Une réservation commencée ne peut plus être annulée');
  const isLate = booking.start.getTime() - now.getTime() < LATE_CANCELLATION_HOURS * HOUR_MS;
  return { ...booking, status: isLate ? 'late_cancelled' : 'cancelled' };
}
