import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { unaries } from "@qtsurfer/core";

/**
 * Allow to apply a transformation function to a RTIndicator value.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.TransformRTIndicator
 */
export class TransformRTIndicator extends AbstractDecorableRTIndicator {
  private readonly transform: (value: number) => number;

  constructor(indicator: RTIndicator, transform: (value: number) => number) {
    super(indicator);
    this.transform = transform;
    this.setValue(transform(indicator.getValue()));
  }

  override update(newValue: number): number {
    return this.setValue(this.transform(this.indicator.update(newValue)));
  }

  static plus(indicator: RTIndicator, coeff: number): TransformRTIndicator {
    return new TransformRTIndicator(indicator, unaries.plus(coeff));
  }

  static minus(indicator: RTIndicator, coeff: number): TransformRTIndicator {
    return new TransformRTIndicator(indicator, unaries.minus(coeff));
  }

  static multiply(indicator: RTIndicator, coeff: number): TransformRTIndicator {
    return new TransformRTIndicator(indicator, unaries.multiply(coeff));
  }

  static divide(indicator: RTIndicator, coeff: number): TransformRTIndicator {
    return new TransformRTIndicator(indicator, unaries.divide(coeff));
  }

  static max(indicator: RTIndicator, coeff: number): TransformRTIndicator {
    return new TransformRTIndicator(indicator, unaries.max(coeff));
  }

  static min(indicator: RTIndicator, coeff: number): TransformRTIndicator {
    return new TransformRTIndicator(indicator, unaries.min(coeff));
  }

  static clamp(indicator: RTIndicator, lo: number, hi: number): TransformRTIndicator {
    if (lo >= hi) {
      throw new Error("Min range must be < max range");
    }
    return new TransformRTIndicator(indicator, unaries.clamp(lo, hi));
  }

  static abs(indicator: RTIndicator): TransformRTIndicator {
    return new TransformRTIndicator(indicator, Math.abs);
  }

  static negate(indicator: RTIndicator): TransformRTIndicator {
    return new TransformRTIndicator(indicator, (v) => -v);
  }

  static sqrt(indicator: RTIndicator): TransformRTIndicator {
    return new TransformRTIndicator(indicator, Math.sqrt);
  }

  static log(indicator: RTIndicator): TransformRTIndicator {
    return new TransformRTIndicator(indicator, Math.log);
  }

  static percent(indicator: RTIndicator): TransformRTIndicator {
    return TransformRTIndicator.multiply(indicator, 100);
  }
}
