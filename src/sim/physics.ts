// Car movement in track space: s = distance along the centreline, x = side
// offset, heading = angle relative to the road. All cars use the same numbers;
// rules (draft, smash, ...) change speed on top of this.

import { BRAKE, steerDir } from "./actions";
import type { Cars } from "./cars";
import { approach, dcos, dsin } from "./dmath";
import { segmentIndex, type Track } from "../track/track";

export const TUNING = {
  /** Top speed on your own, m/s. */
  topSpeed: 60,
  /** Acceleration from standstill, m/s². Fades to 0 at top speed. */
  accel: 12,
  /** Brake deceleration, m/s². */
  brake: 25,
  /** Steering turn rate, rad/s. Same on every device. */
  steerRate: 1.2,
  /** Hands-off straightening rate, rad/s. */
  recenterRate: 0.8,
  /** Max sideways acceleration, m/s². Caps turn rate at speed: yaw <= grip / v. */
  grip: 20,
  /** Largest angle to the road, rad. */
  maxHeading: 0.6,
  /** Extra deceleration while scraping the road edge, m/s². */
  edgeScrub: 15,
  /** Half the car's width, metres. */
  halfWidth: 1,
};

/** Advance every car by dt seconds. inputs[i] = action bits for car i. */
export function stepPhysics(cars: Cars, track: Track, inputs: Uint8Array, dt: number): void {
  const T = TUNING;
  for (let i = 0; i < cars.count; i++) {
    const bits = inputs[i]!;
    const seg = segmentIndex(track, cars.s[i]!);
    const k = track.curvature[seg]!;
    let v = cars.v[i]!;
    let h = cars.heading[i]!;
    let x = cars.x[i]!;

    // Speed: auto-accelerate, or brake.
    if (bits & BRAKE) v = Math.max(0, v - T.brake * dt);
    else v += T.accel * (1 - v / T.topSpeed) * dt;

    // Steering, limited by grip at speed.
    const maxYaw = Math.min(T.steerRate, T.grip / Math.max(v, 1));
    const dir = steerDir(bits);
    if (dir !== 0) h += dir * maxYaw * dt;
    else h = approach(h, 0, Math.min(T.recenterRate, maxYaw) * dt);

    // Move. Inside of a turn (k * x > 0) is shorter, so s advances faster there.
    const ds = (v * dcos(h) * dt) / (1 - k * x);
    x += v * dsin(h) * dt;
    // The road bends under the car: a right turn swings the car's relative heading left.
    h -= k * ds;
    if (h > T.maxHeading) h = T.maxHeading;
    else if (h < -T.maxHeading) h = -T.maxHeading;

    // Road edges: stop at the edge, scrub speed, stop pointing into it.
    const edge = track.width[seg]! / 2 - T.halfWidth;
    if (x > edge || x < -edge) {
      const side = x > 0 ? 1 : -1;
      x = side * edge;
      if (h * side > 0) h = 0;
      v = Math.max(0, v - T.edgeScrub * dt);
    }

    let s = cars.s[i]! + ds;
    if (s >= track.length) {
      s -= track.length;
      cars.lap[i] = cars.lap[i]! + 1;
    }

    cars.s[i] = s;
    cars.x[i] = x;
    cars.v[i] = v;
    cars.heading[i] = h;
  }
}
