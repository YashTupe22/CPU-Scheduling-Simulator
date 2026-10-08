/** Small shared math helpers used by several presentation models. */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))
