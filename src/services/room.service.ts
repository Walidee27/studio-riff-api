import type { PlanningCache } from '../cache/planning.cache.js';
import type { Pool } from '../db/pool.js';
import type { Booking } from '../domain/booking.js';
import type { Clock } from '../domain/clock.js';
import { NotFoundError } from '../domain/errors.js';
import { resolvePlanningRange } from '../domain/planning.js';
import type { Room } from '../domain/room.js';
import { bookingRepository } from '../repositories/booking.repository.js';
import { roomRepository } from '../repositories/room.repository.js';

export class RoomService {
  constructor(
    private readonly pool: Pool,
    private readonly clock: Clock,
    private readonly cache: PlanningCache,
  ) {}

  listRooms(): Promise<Room[]> {
    return roomRepository.findAll(this.pool);
  }

  async getPlanning(roomId: string, from: unknown, to: unknown): Promise<Booking[]> {
    const room = await roomRepository.findById(this.pool, roomId);
    if (!room) throw new NotFoundError(`Salle ${roomId} introuvable`);
    const range = resolvePlanningRange(from, to, this.clock);
    return this.cache.getOrLoad(roomId, range, () =>
      bookingRepository.findConfirmedByRoomBetween(this.pool, roomId, range.from, range.to),
    );
  }
}
