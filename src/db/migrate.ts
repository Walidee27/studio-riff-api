import { config } from '../config.js';
import { runMigrations } from './migrations.js';
import { createPool } from './pool.js';

const pool = createPool(config.databaseUrl);
const applied = await runMigrations(pool);
console.log(applied.length ? `Migrations appliquées : ${applied.join(', ')}` : 'Base déjà à jour');
await pool.end();
