import { createClient } from 'redis';
import type { Booking } from '../domain/booking.js';
import type { PlanningRange } from '../domain/planning.js';
import type { PlanningCache } from './planning.cache.js';

export function createValkeyClient(url: string) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 500,
      reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 5000),
    },
  });
  client.on('error', () => {});
  return client;
}

export type ValkeyClient = ReturnType<typeof createValkeyClient>;

interface StoredBooking extends Omit<Booking, 'start' | 'end'> {
  start: string;
  end: string;
}

export interface ValkeyPlanningCacheOptions {
  prefix: string;
  ttlSeconds: number;
}

export class ValkeyPlanningCache implements PlanningCache {
  constructor(
    private readonly client: ValkeyClient,
    private readonly options: ValkeyPlanningCacheOptions = { prefix: 'planning', ttlSeconds: 300 },
  ) {
    // Une invalidation perdue pendant une panne de Valkey laisserait un planning périmé : on repart à vide à chaque connexion.
    client.on('ready', () => {
      this.purge().catch(() => {});
    });
  }

  async getOrLoad(roomId: string, range: PlanningRange, load: () => Promise<Booking[]>): Promise<Booking[]> {
    const key = await this.safely(() => this.entryKey(roomId, range));
    if (key) {
      const cached = await this.safely(() => this.client.get(key));
      if (cached) return (JSON.parse(cached) as StoredBooking[]).map(revive);
    }

    const bookings = await load();
    if (key) {
      await this.safely(() =>
        this.client.set(key, JSON.stringify(bookings), { expiration: { type: 'EX', value: this.options.ttlSeconds } }),
      );
    }
    return bookings;
  }

  async invalidate(roomId: string): Promise<void> {
    await this.safely(() => this.client.incr(this.versionKey(roomId)));
  }

  async purge(): Promise<void> {
    for await (const keys of this.client.scanIterator({ MATCH: `${this.options.prefix}:*`, COUNT: 100 })) {
      if (keys.length) await this.client.unlink(keys);
    }
  }

  private versionKey(roomId: string): string {
    return `${this.options.prefix}:${roomId}:version`;
  }

  private async entryKey(roomId: string, range: PlanningRange): Promise<string> {
    const version = (await this.client.get(this.versionKey(roomId))) ?? '0';
    return `${this.options.prefix}:${roomId}:v${version}:${range.from.toISOString()}:${range.to.toISOString()}`;
  }

  private async safely<T>(operation: () => Promise<T>): Promise<T | null> {
    if (!this.client.isReady) return null;
    try {
      return await operation();
    } catch {
      return null;
    }
  }
}

function revive(stored: StoredBooking): Booking {
  return { ...stored, start: new Date(stored.start), end: new Date(stored.end) };
}
