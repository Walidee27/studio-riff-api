import type { Pool } from '../db/pool.js';
import type { Booking } from '../domain/booking.js';
import { NotFoundError } from '../domain/errors.js';
import { bookingRepository } from '../repositories/booking.repository.js';
import { memberRepository } from '../repositories/member.repository.js';

export class MemberService {
  constructor(private readonly pool: Pool) {}

  async listBookings(memberId: string): Promise<Booking[]> {
    const member = await memberRepository.findById(this.pool, memberId);
    if (!member) throw new NotFoundError(`Membre ${memberId} introuvable`);
    return bookingRepository.findByMember(this.pool, memberId);
  }
}
