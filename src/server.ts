import { createApp } from './app.js';
import { noPlanningCache } from './cache/planning.cache.js';
import { createValkeyClient, ValkeyPlanningCache } from './cache/valkey-planning.cache.js';
import { config } from './config.js';
import { createPool } from './db/pool.js';
import { systemClock } from './domain/clock.js';

const pool = createPool(config.databaseUrl);

let cache = noPlanningCache;
if (config.valkeyUrl) {
  const client = createValkeyClient(config.valkeyUrl);
  client.connect().catch(() => console.warn('Valkey indisponible : planning servi depuis PostgreSQL'));
  cache = new ValkeyPlanningCache(client);
}

const app = createApp({ pool, clock: systemClock, cache });

app.listen(config.port, () => {
  console.log(`Studio Riff API sur http://localhost:${config.port}`);
});
