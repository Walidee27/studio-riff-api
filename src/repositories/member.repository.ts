import type { Queryable } from '../db/pool.js';
import type { Member } from '../domain/member.js';

export const memberRepository = {
  async findById(db: Queryable, id: string): Promise<Member | null> {
    const { rows } = await db.query<Member>('SELECT id, name FROM members WHERE id = $1', [id]);
    return rows[0] ?? null;
  },

  async findByIdForUpdate(db: Queryable, id: string): Promise<Member | null> {
    const { rows } = await db.query<Member>('SELECT id, name FROM members WHERE id = $1 FOR UPDATE', [id]);
    return rows[0] ?? null;
  },
};
