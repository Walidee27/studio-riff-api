import type { Request, Response } from 'express';
import type { BookingService } from '../services/booking.service.js';
import { bookingView } from '../views/booking.view.js';

export function bookingController(bookings: BookingService) {
  return {
    async show(req: Request<{ id: string }>, res: Response) {
      res.json(bookingView(await bookings.getBooking(req.params.id)));
    },

    async create(req: Request<{ id: string }>, res: Response) {
      const booking = await bookings.createBooking(req.params.id, req.body);
      res.status(201).location(`/bookings/${booking.id}`).json(bookingView(booking));
    },
  };
}
