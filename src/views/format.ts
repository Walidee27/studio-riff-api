export function formatInstant(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z');
}
