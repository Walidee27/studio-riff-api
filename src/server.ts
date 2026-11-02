import { createApp } from './app.js';
import { config } from './config.js';
import { createPool } from './db/pool.js';
import { systemClock } from './domain/clock.js';

const pool = createPool(config.databaseUrl);
const app = createApp({ pool, clock: systemClock });

app.listen(config.port, () => {
  console.log(`Studio Riff API sur http://localhost:${config.port}`);
});
