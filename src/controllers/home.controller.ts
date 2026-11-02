import type { Request, Response } from 'express';

const routes = [
  'GET /rooms',
  'GET /rooms/:id/bookings?from=…&to=…',
  'POST /rooms/:id/bookings',
  'GET /bookings/:id',
  'DELETE /bookings/:id',
  'GET /members/:id/bookings',
];

export function homeController() {
  return {
    index(_req: Request, res: Response) {
      res.json({ name: 'Studio Riff API', routes });
    },

    notFound(req: Request, res: Response) {
      res.status(404).json({ error: `Route inconnue : ${req.method} ${req.path}` });
    },
  };
}
