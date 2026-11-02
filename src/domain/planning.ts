import type { Clock } from './clock.js';
import { ValidationError } from './errors.js';
import { DAY_MS, parseInstant, startOfUtcDay } from './time.js';

export interface PlanningRange {
  from: Date;
  to: Date;
}

export function resolvePlanningRange(from: unknown, to: unknown, clock: Clock): PlanningRange {
  const start = from === undefined ? startOfUtcDay(clock.now()) : parseInstant(from, 'from');
  const end = to === undefined ? new Date(start.getTime() + 7 * DAY_MS) : parseInstant(to, 'to');
  if (end <= start) throw new ValidationError('to doit être postérieur à from');
  return { from: start, to: end };
}
