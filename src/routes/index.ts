import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller.js';
import { homeController } from '../controllers/home.controller.js';
import { memberController } from '../controllers/member.controller.js';
import { roomController } from '../controllers/room.controller.js';
import type { BookingService } from '../services/booking.service.js';
import type { MemberService } from '../services/member.service.js';
import type { RoomService } from '../services/room.service.js';

interface Services {
  rooms: RoomService;
  bookings: BookingService;
  members: MemberService;
}

export function createRouter(services: Services): Router {
  const router = Router();
  const rooms = roomController(services.rooms);
  const bookings = bookingController(services.bookings);
  const members = memberController(services.members);
  const home = homeController();

  router.get('/', home.index);
  router.get('/rooms', rooms.list);
  router.get('/rooms/:id/bookings', rooms.planning);
  router.post('/rooms/:id/bookings', bookings.create);
  router.get('/bookings/:id', bookings.show);
  router.delete('/bookings/:id', bookings.cancel);
  router.get('/members/:id/bookings', members.bookings);

  router.use(home.notFound);

  return router;
}
