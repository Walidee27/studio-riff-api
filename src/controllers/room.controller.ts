import type { Request, Response } from 'express';
import type { RoomService } from '../services/room.service.js';
import { bookingView } from '../views/booking.view.js';
import { roomView } from '../views/room.view.js';

export function roomController(rooms: RoomService) {
  return {
    async list(_req: Request, res: Response) {
      res.json((await rooms.listRooms()).map(roomView));
    },

    async planning(req: Request<{ id: string }>, res: Response) {
      const bookings = await rooms.getPlanning(req.params.id, req.query.from, req.query.to);
      res.json(bookings.map(bookingView));
    },
  };
}
