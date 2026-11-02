import type { ErrorRequestHandler } from 'express';
import { DomainError, type DomainErrorKind } from '../domain/errors.js';

const statusByKind: Record<DomainErrorKind, number> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof DomainError) {
    res.status(statusByKind[error.kind]).json({ error: error.message });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Corps JSON invalide' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Erreur interne' });
};
