import { ConflictError } from './errors.js';
import { intervalsOverlap } from './time.js';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  maintenanceStart: Date | null;
  maintenanceEnd: Date | null;
}

export function isUnderMaintenance(room: Room, start: Date, end: Date): boolean {
  if (!room.maintenanceStart || !room.maintenanceEnd) return false;
  return intervalsOverlap(room.maintenanceStart, room.maintenanceEnd, start, end);
}

export function assertRoomAvailable(room: Room, start: Date, end: Date): void {
  if (isUnderMaintenance(room, start, end)) {
    throw new ConflictError(`${room.name} est en maintenance sur ce créneau`);
  }
}
