import type { Queryable } from '../db/pool.js';
import type { Room } from '../domain/room.js';

interface RoomRow {
  id: string;
  name: string;
  capacity: number;
  maintenance_start: Date | null;
  maintenance_end: Date | null;
}

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    maintenanceStart: row.maintenance_start,
    maintenanceEnd: row.maintenance_end,
  };
}

export const roomRepository = {
  async findAll(db: Queryable): Promise<Room[]> {
    const { rows } = await db.query<RoomRow>('SELECT * FROM rooms ORDER BY id');
    return rows.map(toRoom);
  },

  async findById(db: Queryable, id: string): Promise<Room | null> {
    const { rows } = await db.query<RoomRow>('SELECT * FROM rooms WHERE id = $1', [id]);
    return rows[0] ? toRoom(rows[0]) : null;
  },
};
