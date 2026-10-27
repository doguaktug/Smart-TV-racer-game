// Solid cars. Two cars that overlap are pushed apart, and if they were closing
// in they bounce: speed along each car's heading changes, the sideways part is
// soaked up by grip. A hit away from a car's centre also turns it (cars.yaw),
// e.g. a shove on the rear quarter swings the nose toward the hitter.
//
// Works in a flat frame around the pair (s along, x side). The road's bend
// is ignored: touching cars are only metres apart. Runs after stepPhysics.

import type { Cars } from "./cars";
import { dcos, dsin } from "./dmath";
import { TUNING } from "./physics";
import { gapAhead, segmentIndex, wrapS, type Track } from "../track/track";

export const COLLIDE = {
  /** Bounciness of a hit, 0 = cars stick, 1 = fully elastic. */
  restitution: 0.2,
  /** Scales how much an off-centre hit turns a car. */
  yawGain: 0.15,
};

/** Where and how deep two cars overlap. Filled by contact(), reused every call. */
export interface Contact {
  depth: number;
  /** Unit normal from car i toward car j, (s, x). */
  ns: number;
  nx: number;
  /** Contact point relative to car i's centre, (s, x). */
  ps: number;
  px: number;
}

const hit: Contact = { depth: 0, ns: 0, nx: 0, ps: 0, px: 0 };
// Scratch axes: fs, fx, rs, rx for car i then car j.
const ax = new Float64Array(8);

/** Moment of inertia of a car, mass 1: rectangle (L^2 + W^2) / 12. */
const INERTIA = ((2 * TUNING.halfLength) ** 2 + (2 * TUNING.halfWidth) ** 2) / 12;

/** A box's corner furthest along (ns, nx). Edges nearly square to n give their midpoint. */
function support(o: number, cs: number, cx: number, ns: number, nx: number, out: Float64Array): boolean {
  const df = ax[o]! * ns + ax[o + 1]! * nx;
  const dr = ax[o + 2]! * ns + ax[o + 3]! * nx;
  const sf = Math.abs(df) < 0.05 ? 0 : Math.sign(df);
  const sr = Math.abs(dr) < 0.05 ? 0 : Math.sign(dr);
  out[0] = cs + ax[o]! * TUNING.halfLength * sf + ax[o + 2]! * TUNING.halfWidth * sr;
  out[1] = cx + ax[o + 1]! * TUNING.halfLength * sf + ax[o + 3]! * TUNING.halfWidth * sr;
  return sf === 0 || sr === 0; // touching with a flat edge, not a corner
}

const pi = new Float64Array(2);
const pj = new Float64Array(2);

/** Separating-axis test for cars i and j. Returns null when they don't overlap. */
export function contact(cars: Cars, track: Track, i: number, j: number): Contact | null {
  const L = TUNING.halfLength;
  const W = TUNING.halfWidth;
  const cs = gapAhead(track, cars.s[i]!, cars.s[j]!);
  const cx = cars.x[j]! - cars.x[i]!;
  if (Math.abs(cs) > 2 * (L + W) || Math.abs(cx) > 2 * (L + W)) return null;

  for (let k = 0; k < 2; k++) {
    const h = cars.heading[k === 0 ? i : j]!;
    const c = dcos(h);
    const s = dsin(h);
    ax.set([c, s, -s, c], 4 * k);
  }

  let best = Infinity;
  let owner = 0;
  for (let a = 0; a < 8; a += 2) {
    const us = ax[a]!;
    const ux = ax[a + 1]!;
    let r = 0;
    for (let o = 0; o < 8; o += 4) {
      r += L * Math.abs(ax[o]! * us + ax[o + 1]! * ux) + W * Math.abs(ax[o + 2]! * us + ax[o + 3]! * ux);
    }
    const d = cs * us + cx * ux;
    const overlap = r - Math.abs(d);
    if (overlap <= 0) return null;
    if (overlap < best) {
      best = overlap;
      owner = a < 4 ? 0 : 1;
      const sign = d < 0 ? -1 : 1;
      hit.ns = us * sign;
      hit.nx = ux * sign;
    }
  }

  // The corner of the other car that pokes into the face; if it touches with a
  // flat edge, the middle of the overlap (equal-size cars: average of both).
  const flatI = support(0, 0, 0, hit.ns, hit.nx, pi);
  const flatJ = support(4, cs, cx, -hit.ns, -hit.nx, pj);
  const flat = owner === 1 ? flatI : flatJ;
  const inc = owner === 1 ? pi : pj;
  hit.ps = flat ? (pi[0]! + pj[0]!) / 2 : inc[0]!;
  hit.px = flat ? (pi[1]! + pj[1]!) / 2 : inc[1]!;
  hit.depth = best;
  return hit;
}

/** Move car k by (ds, dx), keeping it on the road. A push across the line counts the lap. */
function nudge(cars: Cars, track: Track, k: number, ds: number, dx: number): void {
  const raw = cars.s[k]! + ds;
  if (raw < 0) cars.lap[k] = cars.lap[k]! - 1;
  else if (raw >= track.length) cars.lap[k] = cars.lap[k]! + 1;
  const s = wrapS(track, raw);
  const edge = track.width[segmentIndex(track, s)]! / 2 - TUNING.halfWidth;
  const x = cars.x[k]! + dx;
  cars.s[k] = s;
  cars.x[k] = x > edge ? edge : x < -edge ? -edge : x;
}

/**
 * Push overlapping cars apart, bounce them, and turn them on off-centre hits.
 * hits[i] gets bit j set for every car j that car i touches this tick.
 */
export function stepCollisions(cars: Cars, track: Track, hits: Uint8Array): void {
  hits.fill(0);
  for (let i = 0; i < cars.count; i++) {
    for (let j = i + 1; j < cars.count; j++) {
      const c = contact(cars, track, i, j);
      if (c === null) continue;
      hits[i] = hits[i]! | (1 << j);
      hits[j] = hits[j]! | (1 << i);
      const { ns, nx, ps, px } = c;
      const cs = gapAhead(track, cars.s[i]!, cars.s[j]!);
      const cx = cars.x[j]! - cars.x[i]!;
      const half = c.depth / 2;
      nudge(cars, track, i, -ns * half, -nx * half);
      nudge(cars, track, j, ns * half, nx * half);

      // Bounce only if closing in. Equal masses; car j gets +J n, car i gets -J n.
      const fsi = ax[0]!, fxi = ax[1]!, fsj = ax[4]!, fxj = ax[5]!;
      const vi = cars.v[i]!;
      const vj = cars.v[j]!;
      const closing = (vj * fsj - vi * fsi) * ns + (vj * fxj - vi * fxi) * nx;
      if (closing >= 0) continue;
      const J = ((1 + COLLIDE.restitution) * -closing) / 2;
      cars.v[i] = Math.max(0, vi - J * (ns * fsi + nx * fxi));
      cars.v[j] = Math.max(0, vj + J * (ns * fsj + nx * fxj));

      // Turn: cross(r, force) / inertia. + = clockwise from above = heading right.
      const k = (J * COLLIDE.yawGain) / INERTIA;
      cars.yaw[i] = cars.yaw[i]! - k * (ps * nx - px * ns);
      cars.yaw[j] = cars.yaw[j]! + k * ((ps - cs) * nx - (px - cx) * ns);
    }
  }
}
