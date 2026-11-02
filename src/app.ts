import express, { type Express } from 'express';
import { noPlanningCache, type PlanningCache } from './cache/planning.cache.js';
import type { Pool } from './db/pool.js';
import type { Clock } from './domain/clock.js';
import { errorHandler } from './middlewares/error-handler.js';
import { createRouter } from './routes/index.js';
import { BookingService } from './services/booking.service.js';
import { MemberService } from './services/member.service.js';
import { RoomService } from './services/room.service.js';

export interface AppDependencies {
  pool: Pool;
  clock: Clock;
  cache?: PlanningCache;
}

export function createApp({ pool, clock, cache = noPlanningCache }: AppDependencies): Express {
  const app = express();
  app.use(express.json());
  app.use(
    createRouter({
      rooms: new RoomService(pool, clock, cache),
      bookings: new BookingService(pool, clock, cache),
      members: new MemberService(pool),
    }),
  );
  app.use(errorHandler);
  return app;
}
