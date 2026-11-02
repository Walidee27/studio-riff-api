export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export class FixedClock implements Clock {
  private readonly instant: Date;

  constructor(instant: Date | string) {
    this.instant = new Date(instant);
  }

  now(): Date {
    return new Date(this.instant);
  }
}
