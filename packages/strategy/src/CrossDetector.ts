/** The transition reported by one {@link CrossDetector.check} call. At most one is ever true. */
export interface Cross {
  readonly above: boolean;
  readonly below: boolean;
}

/**
 * Tracks whether `left` is above or below `right` across calls and reports the transition, if any,
 * on {@link check}. One instance per pair being watched — declare it as a field and call it once
 * per tick:
 *
 * ```ts
 * private readonly fastSlowCross = new CrossDetector();
 * // ...
 * const cross = this.fastSlowCross.check(fast, slow);
 * if (cross.above) this.emitBuy(instrument, price);
 * if (cross.below) this.emitSell(instrument, price);
 * ```
 *
 * Both directions come from a single call, so they always describe the same tick. The shape this
 * replaces — `detectCrossAbove`/`detectCrossBelow` sharing one `(boolean | null)[] state, index`
 * pair — let the first of two calls overwrite the value the second needed to compare against
 * whenever both were given the same index, silently breaking whichever direction ran second. That
 * cannot happen here because {@link check} mutates once.
 *
 * Port of com.wualabs.qtsurfer.engine.strategy.CrossDetector
 */
export class CrossDetector {

  private leftAbove: boolean | null = null;

  /**
   * @param left the left-hand value
   * @param right the right-hand value
   * @returns the transition since the last call; both flags false on the first call, since there is
   *   no prior value to compare against
   */
  check(left: number, right: number): Cross {
    const now = left > right;
    const known = this.leftAbove !== null;
    const above = known && now && !this.leftAbove;
    const below = known && !now && this.leftAbove === true;
    this.leftAbove = now;
    return { above, below };
  }

  /** Forgets the tracked side, so the next {@link check} reports no transition. */
  reset(): void {
    this.leftAbove = null;
  }
}
