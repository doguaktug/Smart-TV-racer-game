// Deterministic math for the simulation.
//
// IEEE-754 +, -, *, / and Math.sqrt are exactly rounded, so they give the
// same bits on every JS engine. Math.sin, cos, atan2, exp, pow, ... are only
// "implementation-approximated" by the spec and can differ between engines
// (e.g. an Android TV and the Node server). Sim code must use this module
// instead of those Math functions so rollback netcode stays in sync.

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;

// Taylor coefficients for sin: (-1)^k / (2k+1)!
const S3 = -1 / 6;
const S5 = 1 / 120;
const S7 = -1 / 5040;
const S9 = 1 / 362880;
const S11 = -1 / 39916800;
const S13 = 1 / 6227020800;
const S15 = -1 / 1307674368000;

// Valid for |x| <= PI/2; max error ~1e-11.
function sinPoly(x: number): number {
  const x2 = x * x;
  return x * (1 + x2 * (S3 + x2 * (S5 + x2 * (S7 + x2 * (S9 + x2 * (S11 + x2 * (S13 + x2 * S15)))))));
}

export function dsin(x: number): number {
  // Reduce to [-PI, PI], then fold to [-PI/2, PI/2] using sin(PI - x) = sin(x).
  let r = x - Math.round(x / TAU) * TAU;
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  return sinPoly(r);
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Move v toward target by at most step (step >= 0), without overshooting. */
export function approach(v: number, target: number, step: number): number {
  if (v < target) return v + step < target ? v + step : target;
  return v - step > target ? v - step : target;
}

/**
 * Seeded PRNG (mulberry32). Only integer ops, so deterministic everywhere.
 * `state` is a plain number so it can be saved/restored for rollback.
 */
export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextU32(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}
