import { config } from '../config.js';
import { createPool } from './pool.js';
import { seedDatabase } from './seed-data.js';

const pool = createPool(config.databaseUrl);
await seedDatabase(pool);
console.log('Données de départ insérées');
await pool.end();
