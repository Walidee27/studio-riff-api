import { afterAll, beforeEach } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { createPool } from '../../src/db/pool.js';
import { seedDatabase } from '../../src/db/seed-data.js';
import { FixedClock } from '../../src/domain/clock.js';
import { testDatabaseUrl } from './database.js';

export const NOW = '2026-11-02T09:00:00Z';

export function setupTestApp(overrides: Partial<AppDependencies> = {}) {
  const pool = createPool(testDatabaseUrl);
  const app = createApp({ pool, clock: new FixedClock(NOW), ...overrides });

  beforeEach(async () => {
    await seedDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  return { app, pool };
}
