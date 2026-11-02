import type { Room } from '../domain/room.js';
import { formatInstant } from './format.js';

export function roomView(room: Room) {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    maintenance:
      room.maintenanceStart && room.maintenanceEnd
        ? { start: formatInstant(room.maintenanceStart), end: formatInstant(room.maintenanceEnd) }
        : null,
  };
}
