import type { Request, Response } from 'express';
import type { BookingService } from '../services/booking.service.js';
import { bookingView } from '../views/booking.view.js';

export function bookingController(bookings: BookingService) {
  return {
    async show(req: Request<{ id: string }>, res: Response) {
      res.json(bookingView(await bookings.getBooking(req.params.id)));
    },
  };
}
