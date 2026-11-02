import pg from 'pg';
import { runMigrations } from '../../src/db/migrations.js';
import { createPool } from '../../src/db/pool.js';
import { testDatabaseUrl } from './database.js';

export default async function setup() {
  const target = new URL(testDatabaseUrl);
  const databaseName = target.pathname.slice(1);
  const adminUrl = new URL(testDatabaseUrl);
  adminUrl.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${databaseName}"`);
  await admin.end();

  const pool = createPool(testDatabaseUrl);
  await runMigrations(pool);
  await pool.end();
}
