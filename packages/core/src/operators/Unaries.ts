/**
 * Port of com.wualabs.qtsurfer.engine.core.operators.Unaries
 */
export type UnaryOperator = (value: number) => number;

export const plus = (coeff: number): UnaryOperator => (v) => v + coeff;
export const minus = (coeff: number): UnaryOperator => (v) => v - coeff;
export const divide = (coeff: number): UnaryOperator => (v) => v / coeff;
export const multiply = (coeff: number): UnaryOperator => (v) => v * coeff;
export const min = (coeff: number): UnaryOperator => (v) => Math.min(v, coeff);
export const max = (coeff: number): UnaryOperator => (v) => Math.max(v, coeff);
export const clamp = (lo: number, hi: number): UnaryOperator => (v) => Math.max(lo, Math.min(hi, v));
