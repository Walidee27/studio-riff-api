import type { Request, Response } from 'express';
import type { MemberService } from '../services/member.service.js';
import { bookingView } from '../views/booking.view.js';

export function memberController(members: MemberService) {
  return {
    async bookings(req: Request<{ id: string }>, res: Response) {
      res.json((await members.listBookings(req.params.id)).map(bookingView));
    },
  };
}
