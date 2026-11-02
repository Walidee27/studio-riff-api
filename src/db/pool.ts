import pg from 'pg';

export type Pool = pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;

export function createPool(connectionString: string): Pool {
  return new pg.Pool({ connectionString });
}
