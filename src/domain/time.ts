import { ValidationError } from './errors.js';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

export function parseInstant(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) {
    throw new ValidationError(`${field} doit être une date ISO 8601 en UTC`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${field} n'est pas une date valide`);
  return date;
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
