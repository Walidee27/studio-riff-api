import type { Booking } from '../domain/booking.js';
import type { PlanningRange } from '../domain/planning.js';

export interface PlanningCache {
  getOrLoad(roomId: string, range: PlanningRange, load: () => Promise<Booking[]>): Promise<Booking[]>;
  invalidate(roomId: string): Promise<void>;
}

export const noPlanningCache: PlanningCache = {
  getOrLoad: (_roomId, _range, load) => load(),
  invalidate: async () => {},
};
