/**
 * Port of com.wualabs.qtsurfer.engine.core.operators.Predicates
 */
export type Predicate = (value: number) => boolean;

export const positive: Predicate = (v) => v > 0;
export const zero: Predicate = (v) => v === 0;
export const negative: Predicate = (v) => v < 0;

export const equal = (coeff: number): Predicate => (v) => v === coeff;
export const absEqual = (coeff: number): Predicate => (v) => Math.abs(v) === coeff;
export const notEqual = (coeff: number): Predicate => (v) => v !== coeff;
export const lessThan = (coeff: number): Predicate => (v) => v < coeff;
export const absLessThan = (coeff: number): Predicate => (v) => Math.abs(v) < coeff;
export const lessOrEqual = (coeff: number): Predicate => (v) => v <= coeff;
export const absLessOrEqual = (coeff: number): Predicate => (v) => Math.abs(v) <= coeff;
export const greaterThan = (coeff: number): Predicate => (v) => v > coeff;
export const absGreaterThan = (coeff: number): Predicate => (v) => Math.abs(v) > coeff;
export const greaterOrEqual = (coeff: number): Predicate => (v) => v >= coeff;
export const absGreaterOrEqual = (coeff: number): Predicate => (v) => Math.abs(v) >= coeff;
