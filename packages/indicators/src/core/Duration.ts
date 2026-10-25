/**
 * An amount of time in whole milliseconds, the part of `java.time.Duration` a window needs.
 * Like Java's it is a plain value (zero and negative amounts exist); what a window accepts is
 * checked by the window.
 */
export class Duration {
  private constructor(private readonly millis: number) {}

  static ofMillis(millis: number): Duration {
    return Duration.scaled(millis, 1, "ofMillis");
  }

  static ofSeconds(seconds: number): Duration {
    return Duration.scaled(seconds, 1_000, "ofSeconds");
  }

  static ofMinutes(minutes: number): Duration {
    return Duration.scaled(minutes, 60_000, "ofMinutes");
  }

  toMillis(): number {
    return this.millis;
  }

  /** Negative, zero or positive as this is shorter than, equal to or longer than `other`. */
  compareTo(other: Duration): number {
    return Math.sign(this.millis - other.millis);
  }

  equals(other: unknown): boolean {
    return other instanceof Duration && other.millis === this.millis;
  }

  private static scaled(amount: number, factor: number, method: string): Duration {
    const millis = amount * factor;
    // Java takes a long: a fraction, NaN or an amount beyond the exact range cannot be expressed
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(millis)) {
      throw new Error(`Duration.${method} takes a whole number, got ${amount}`);
    }
    return new Duration(millis);
  }
}
