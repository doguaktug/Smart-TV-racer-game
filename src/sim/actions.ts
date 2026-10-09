// Per-tick action bits, one byte per car. Humans (via input/) and bots (via
// ai/) both produce these; the sim never knows which is which.

export const LEFT = 1;
export const RIGHT = 2;
export const BRAKE = 4;

/** -1 = left, +1 = right, 0 = neither or both. */
export function steerDir(bits: number): number {
  return ((bits & RIGHT) !== 0 ? 1 : 0) - ((bits & LEFT) !== 0 ? 1 : 0);
}
